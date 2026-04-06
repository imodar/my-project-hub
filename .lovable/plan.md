

# خطة الإصلاحات الشاملة — 3 مراحل

## المرحلة 1 — إصلاحات فورية

### 1.1 Eager import للصفحات الخمس الرئيسية
**الملف:** `src/App.tsx`

تحويل 5 صفحات من `lazyRetry` إلى import مباشر (أسطر 47, 51, 58, 60, 64):
```ts
import Index from "./pages/Index";
import Market from "./pages/Market";
import Tasks from "./pages/Tasks";
import Chat from "./pages/Chat";
import CalendarPage from "./pages/Calendar";
```
حذف هذه الخمسة من قسم lazy imports.

**الملف:** `src/lib/preloadPages.ts`

حذف Market, Tasks, Chat, Calendar من مصفوفة `CRITICAL_PAGES` (أسطر 7-9, 12) لأنها أصبحت eager.

### 1.2 Suspense fallback مرئي
**الملف:** `src/App.tsx` سطر 299

```tsx
<Suspense fallback={<div className="min-h-screen bg-background" />}>
```

### 1.3 DOMPurify لـ dangerouslySetInnerHTML
تثبيت `dompurify` و `@types/dompurify`.

**`src/components/LegalPageSheet.tsx`** سطر 88:
```ts
import DOMPurify from "dompurify";
// ...
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
```

**`src/pages/admin/AdminLegalPages.tsx`**: نفس التغيير على أي `dangerouslySetInnerHTML`.

---

## المرحلة 2 — Realtime + تحديث tasks-api

### 2.1 إصلاح tasks-api — تحديث updated_at عند تغيير items
**الملف:** `supabase/functions/tasks-api/index.ts`

**`add-item`** (سطر 148-150) — `list_id` متاح مباشرة من body:
```ts
const { data, error } = await adminClient.from("task_items").insert(insertData).select().single();
if (error) return json({ error: error.message }, 400);
await adminClient.from("task_lists").update({ updated_at: new Date().toISOString() }).eq("id", list_id);
return json({ data });
```

**`update-item`** (سطر 167-169) — `list_id` يأتي في response من `.select().single()`:
```ts
const { data, error } = await supabase.from("task_items").update(updates).eq("id", id).select().single();
if (error) return json({ error: error.message }, 400);
if (data?.list_id) await supabase.from("task_lists").update({ updated_at: new Date().toISOString() }).eq("id", data.list_id);
return json({ data });
```

**`toggle-item`** (سطر 176-178) — نفس النمط:
```ts
const { data, error } = await supabase.from("task_items").update({ done }).eq("id", id).select().single();
if (error) return json({ error: error.message }, 400);
if (data?.list_id) await supabase.from("task_lists").update({ updated_at: new Date().toISOString() }).eq("id", data.list_id);
return json({ data });
```

**`delete-item`** (سطر 181-186) — يجب جلب `list_id` **قبل** الحذف:
```ts
const { data: itemToDelete } = await supabase.from("task_items").select("list_id").eq("id", id).maybeSingle();
const { error } = await supabase.from("task_items").delete().eq("id", id);
if (error) return json({ error: error.message }, 400);
if (itemToDelete?.list_id) await supabase.from("task_lists").update({ updated_at: new Date().toISOString() }).eq("id", itemToDelete.list_id);
return json({ success: true });
```

### 2.2 Realtime channel في useMarketLists
**الملف:** `src/hooks/useMarketLists.ts`

```ts
const lastOwnMutationRef = useRef(0);

useEffect(() => {
  if (!familyId) return;
  const channel = supabase.channel(`market-rt-${familyId}`)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "market_lists",
      filter: `family_id=eq.${familyId}`,
    }, () => {
      if (Date.now() - lastOwnMutationRef.current < 2000) return;
      qc.invalidateQueries({ queryKey: key });
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [familyId]);
```

**لا channel لـ market_items** — channel واحد على `market_lists` كافٍ لأن `market-api` يحدّث `updated_at` عند كل تغيير على items.

تحديث كل mutation wrapper بـ `lastOwnMutationRef.current = Date.now()`.

### 2.3 Realtime channel في useTaskLists
**الملف:** `src/hooks/useTaskLists.ts`

نفس النمط — channel واحد على `task_lists` فقط مع filter `family_id=eq.${familyId}`.
بعد إصلاح 2.1، أي تغيير على items سيُطلق حدث UPDATE على `task_lists`.

---

## المرحلة 3 — صقل

### 3.1 Exponential backoff في syncQueue
**الملف:** `src/lib/syncQueue.ts` سطر 478

إضافة delay تصاعدي قبل تحديث الـ retries:
```ts
const newRetries = (item.retries || 0) + 1;
const delay = Math.min(1000 * Math.pow(2, newRetries), 30000);
await new Promise(r => setTimeout(r, delay));
```

### 3.2 رفع staleTime لـ useMyRole
**الملف:** `src/hooks/useMyRole.ts` سطر 48

```ts
staleTime: 60 * 60 * 1000, // ساعة بدل 5 دقائق
```

---

## ملخص الملفات

| المرحلة | الملف | التغيير |
|---------|-------|---------|
| 1 | `src/App.tsx` | eager imports + suspense fallback |
| 1 | `src/lib/preloadPages.ts` | حذف الصفحات الـ eager |
| 1 | `src/components/LegalPageSheet.tsx` | DOMPurify |
| 1 | `src/pages/admin/AdminLegalPages.tsx` | DOMPurify |
| 2 | `supabase/functions/tasks-api/index.ts` | تحديث `updated_at` عند تغيير items (4 actions) |
| 2 | `src/hooks/useMarketLists.ts` | Realtime channel (market_lists فقط) + timestamp ignore |
| 2 | `src/hooks/useTaskLists.ts` | Realtime channel (task_lists فقط) + timestamp ignore |
| 3 | `src/lib/syncQueue.ts` | exponential backoff |
| 3 | `src/hooks/useMyRole.ts` | staleTime → ساعة |

