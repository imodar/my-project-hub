

# خطة المزامنة والنسخ الاحتياطي — النسخة النهائية

## الملفات المتأثرة
1. `src/integrations/supabase/client.ts` — إضافة `detectSessionInUrl: false`
2. `supabase/functions/account-api/index.ts` — إضافة action `get-last-updated` باستعلام SQL واحد
3. `src/hooks/useInitialSync.ts` — **جديد**
4. `src/components/FirstSyncOverlay.tsx` — تعديل جذري
5. `src/lib/warmCache.ts` — تحديث `last_sync_ts`
6. `src/pages/Settings.tsx` — قسم النسخ الاحتياطي
7. `src/i18n/ar.ts` + `src/i18n/en.ts` — مفاتيح ترجمة

---

## 1. `src/integrations/supabase/client.ts`

إضافة `detectSessionInUrl: false` في إعدادات auth لمنع مشاكل الموبايل.

---

## 2. `supabase/functions/account-api/index.ts` — action `get-last-updated`

إضافة action جديد يستخدم **استعلام SQL واحد** عبر `adminClient.rpc` أو raw query:

```text
المنطق:
1. جلب family_id من family_members للمستخدم
2. تنفيذ استعلام واحد:

SELECT GREATEST(
  (SELECT MAX(GREATEST(COALESCE(updated_at, created_at), created_at)) FROM task_lists WHERE family_id = $1),
  (SELECT MAX(GREATEST(COALESCE(updated_at, created_at), created_at)) FROM market_lists WHERE family_id = $1),
  (SELECT MAX(created_at) FROM calendar_events WHERE family_id = $1),
  (SELECT MAX(created_at) FROM chat_messages WHERE family_id = $1)
) as last_updated_at

3. إرجاع { last_updated_at: string | null }
```

ملاحظة تقنية: بما أن المشروع لا يستخدم raw SQL مباشرة، سيتم إنشاء **database function** باسم `get_family_last_updated(family_id uuid)` عبر migration، ثم استدعاؤها بـ `adminClient.rpc("get_family_last_updated", { _family_id })`. هذا أنظف وأكثر أماناً.

### Migration مطلوب:
```sql
CREATE OR REPLACE FUNCTION public.get_family_last_updated(_family_id uuid)
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT GREATEST(
    (SELECT MAX(GREATEST(COALESCE(updated_at, created_at), created_at)) FROM task_lists WHERE family_id = _family_id),
    (SELECT MAX(GREATEST(COALESCE(updated_at, created_at), created_at)) FROM market_lists WHERE family_id = _family_id),
    (SELECT MAX(created_at) FROM calendar_events WHERE family_id = _family_id),
    (SELECT MAX(created_at) FROM chat_messages WHERE family_id = _family_id)
  );
$$;
```

---

## 3. `src/hooks/useInitialSync.ts` — جديد

```text
المنطق:
1. تحقق من IndexedDB (db.task_lists.count()) — هل فيه بيانات؟
   ├── 0 (جهاز جديد) → state = "new_user"
   │   → invalidateQueries لكل query keys
   │   → await refetchQueries({ type: "active" })
   │   → localStorage.last_sync_ts = now()
   │   → state = "done"
   └── >0 (بيانات محلية موجودة)
       → استدعاء account-api { action: "get-last-updated" }
       → مقارنة localStorage.last_sync_ts مع cloud last_updated_at
       ├── cloud أحدث → state = "syncing"
       │   → invalidateQueries + await refetchQueries({ type: "active" })
       │   → localStorage.last_sync_ts = now()
       │   → state = "done"
       └── محلي أحدث/متساوي → state = "done" (صامت)

يُرجع: { state, message, run }
```

- `invalidateQueries` يضع queries كـ stale
- `refetchQueries({ type: "active" })` يسحب البيانات فوراً للصفحة الحالية فقط
- الباقي يُسحب lazily عند فتح كل صفحة

---

## 4. `src/components/FirstSyncOverlay.tsx` — تعديل

- إزالة `Progress` bar والعدّاد وقائمة `CORE_TABLES`
- استخدام `useInitialSync` بدل المنطق الحالي
- عرض **spinner بسيط** مع رسالة حسب الحالة:
  - `new_user`: "تجهيز جهازك والمحتوى العائلي..." / "Setting up your device..."
  - `syncing`: "مزامنة بياناتك..." / "Syncing your data..."
- دعم اللغتين عبر `useLanguage`
- الاحتفاظ بـ `AnimatePresence` للـ fade in/out

---

## 5. `src/lib/warmCache.ts`

إضافة سطر واحد في نهاية `warmCache`:
```ts
localStorage.setItem("last_sync_ts", new Date().toISOString());
```

---

## 6. `src/pages/Settings.tsx` — قسم "البيانات والنسخ الاحتياطي"

إضافة كارد جديد يعرض:
- **آخر مزامنة** من `localStorage.last_sync_ts` بصيغة نسبية + تاريخ
- **أيقونة حالة**: أخضر إذا < 24 ساعة، أصفر إذا أقدم
- **زر "مزامنة الآن"** يعمل:
  ```ts
  qc.invalidateQueries();
  await qc.refetchQueries({ type: "active" });
  localStorage.setItem("last_sync_ts", new Date().toISOString());
  toast.success(t.sync.syncSuccess);
  ```

دعم اللغتين كاملاً.

---

## 7. مفاتيح الترجمة — `ar.ts` + `en.ts`

```text
sync: {
  preparingDevice:  تجهيز جهازك والمحتوى العائلي...  /  Setting up your device...
  syncingData:      مزامنة بياناتك...                /  Syncing your data...
  lastBackup:       آخر نسخة احتياطية                /  Last backup
  syncNow:          مزامنة الآن                      /  Sync now
  syncing:          جاري المزامنة...                 /  Syncing...
  syncSuccess:      تمت المزامنة بنجاح               /  Sync completed
  noSyncYet:        لم تتم المزامنة بعد              /  No sync yet
  backupTitle:      البيانات والنسخ الاحتياطي         /  Data & Backup
  welcomeFamily:    أهلاً بك في عائلتي               /  Welcome to My Family
}
```

---

## ملخص التغييرات

| الملف | النوع | الجهد |
|---|---|---|
| `supabase/client.ts` | سطر واحد | دقيقة |
| Migration (DB function) | جديد | دقيقتان |
| `account-api/index.ts` | action جديد | 5 دقائق |
| `useInitialSync.ts` | هوك جديد | 10 دقائق |
| `FirstSyncOverlay.tsx` | تعديل جذري | 5 دقائق |
| `warmCache.ts` | سطر واحد | دقيقة |
| `Settings.tsx` | قسم جديد | 10 دقائق |
| `ar.ts` + `en.ts` | مفاتيح ترجمة | 3 دقائق |

