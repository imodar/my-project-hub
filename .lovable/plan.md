

# الخطة الشاملة المحدّثة — 3 مشاكل أساسية + 3 نقاط متوسطة

هذه الخطة تدمج جميع الملاحظات والتصحيحات السابقة في نسخة واحدة نهائية.

---

## المشكلة 1 — syncQueue ناقص جداول + JWT guard

**الوضع الحالي**: `TABLE_API_MAP` لا يغطي 7 جداول: `vaccinations`, `worship_children`, `emergency_contacts`, `trash_items`, `will_sections`, `trip_suggestions`, `prayer_logs`. كذلك `processQueue` يعمل عند module load بدون التحقق من وجود session.

**الإصلاح في `src/lib/syncQueue.ts`**:

1. إضافة الجداول الناقصة في `TABLE_API_MAP`:
```ts
vaccinations: { functionName: "health-api", actions: { INSERT: "add-child", UPDATE: "update-child", DELETE: "remove-child" } },
worship_children: { functionName: "worship-api", actions: { INSERT: "add-child", DELETE: "remove-child" } },
emergency_contacts: { functionName: "settings-api", actions: { INSERT: "add-emergency-contact", DELETE: "delete-emergency-contact" } },
trash_items: { functionName: "trash-api", actions: { INSERT: "move-to-trash", DELETE: "permanent-delete" } },
will_sections: { functionName: "will-api", actions: { UPDATE: "save-will", DELETE: "delete-will" } },
trip_suggestions: { functionName: "trips-api", actions: { INSERT: "add-suggestion", UPDATE: "update-suggestion-status" } },
prayer_logs: { functionName: "worship-api", actions: { INSERT: "save-prayer-log" } },
debt_postponements: { functionName: "debts-api", actions: { INSERT: "add-postponement" } },
```

2. إضافة labels عربية لهذه الجداول في `TABLE_LABELS`.

3. إضافة JWT guard في بداية `processQueue`:
```ts
import { supabase } from "@/integrations/supabase/client";

export async function processQueue(): Promise<void> {
  if (isProcessing || !navigator.onLine) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  // ... باقي الكود
}
```

---

## المشكلة 2 — fullSync لا يفكك nested data

**الوضع الحالي**: APIs مثل `get-trips` ترجع بيانات متداخلة، لكن `fullSync` يكتب فقط في parent table.

**الإصلاح — جزءان**:

### أ) تعديل types في `src/lib/resourceRegistry.ts`:

إضافة `ChildTableConfig` interface وتحديث `ResourceEntry`:
```ts
interface ChildTableConfig {
  key: string;
  table: string;
  nested?: { key: string; table: string }[];
}

export interface ResourceEntry {
  table: string;
  queryKeyPrefix: string;
  familyScoped: boolean;
  warm: boolean;
  fullSync: {
    action: string;
    fn: string;
    label: string;
    childTables?: ChildTableConfig[];
  } | null;
  realtime: boolean;
}
```

إضافة `childTables` للإدخالات المناسبة:
- **trips**: `trip_day_plans` (مع nested `trip_activities`), `trip_expenses`, `trip_packing`, `trip_suggestions`
- **market_lists**: `market_items`
- **task_lists**: `task_items`
- **document_lists**: `document_items`
- **debts**: `debt_payments`, `debt_postponements`
- **budgets**: `budget_expenses`
- **albums**: `album_photos`

تحديث `FULL_SYNC_STEPS` ليحمل `childTables`:
```ts
export const FULL_SYNC_STEPS = RESOURCE_REGISTRY
  .filter(r => r.fullSync !== null)
  .map(r => ({
    label: r.fullSync!.label,
    action: r.fullSync!.action,
    fn: r.fullSync!.fn,
    table: r.table,
    childTables: r.fullSync!.childTables,
  }));
```

### ب) تعديل `src/lib/fullSync.ts`:

بعد `bulkPut` للأب، استخراج وكتابة الأبناء:
```ts
if (step.childTables && items.length > 0) {
  for (const child of step.childTables) {
    const childItems = items.flatMap((item: any) => item[child.key] || []);
    if (childItems.length > 0) {
      await (db as any)[child.table]?.bulkPut(childItems);
    }
    if (child.nested) {
      for (const grandChild of child.nested) {
        const gcItems = childItems.flatMap((c: any) => c[grandChild.key] || []);
        if (gcItems.length > 0) {
          await (db as any)[grandChild.table]?.bulkPut(gcItems);
        }
      }
    }
  }
}
```

---

## المشكلة 3 — warmCache يكتب child tables فوق parent بنفس queryKey

**الوضع الحالي**: child tables مثل `trip_day_plans`, `trip_activities`, `document_items`, `album_photos` كلها `warm: true` مع نفس `queryKeyPrefix` كالأب → كل واحدة تمسح ما قبلها في `setQueryData`.

**الإصلاح في `src/lib/resourceRegistry.ts`**:

تغيير `warm: false` لهذه الجداول الفرعية:
- `trip_day_plans` → `warm: false`
- `trip_activities` → `warm: false`
- `trip_expenses` → `warm: false`
- `trip_packing` → `warm: false`
- `trip_suggestions` → `warm: false`
- `document_items` → `warm: false`
- `album_photos` → `warm: false`

الأب يُحمّل من Dexie بنفسه ويحتوي nested data (aggregate model)، فلا حاجة لعمل setQueryData مستقل من child tables.

---

## المشكلة 4 (medium) — createList لا يستبدل optimistic بالـ real data

**الوضع الحالي**: `createList` في `useMarketLists` و`useTaskLists` ليس عنده `queryKey` ولا `onSuccess`.

**لماذا لا نضيف `queryKey: key`**: لأن الـ wrapper يضيف القائمة يدوياً عبر `qc.setQueryData`، وإضافة `queryKey` ستجعل `useOfflineMutation.onMutate` يضيفها مرة ثانية → تكرار.

**الإصلاح الصحيح**: إبقاء `createList` بدون `queryKey`، وإضافة `onSuccess` لاستبدال UUID المؤقت:

```ts
// في useMarketLists.ts
const createList = useOfflineMutation<any, any>({
  table: "market_lists", operation: "INSERT",
  apiFn: async (input) => { ... },
  onSuccess: (data, variables) => {
    if (!data) return;
    qc.setQueryData<any[]>(key, (old) =>
      (old ?? []).map(item =>
        item.id === variables.id ? { ...item, ...data } : item
      )
    );
  },
});
```

نفس الإصلاح في `useTaskLists.ts`.

---

## المشكلة 5 (medium) — processQueue بدون JWT

مُغطاة في المشكلة 1 (JWT guard).

---

## المشكلة 6 (medium) — WarmCacheProvider flash

Flash بسيط (مللي ثانية) ناتج عن async check. لا يستحق تعقيد إضافي — يُتجاوز.

---

## ملخص الملفات المتأثرة

| الملف | التغيير |
|---|---|
| `src/lib/syncQueue.ts` | إضافة 8 جداول ناقصة + labels + JWT guard |
| `src/lib/resourceRegistry.ts` | تعديل `ResourceEntry` type + إضافة `ChildTableConfig` + إضافة `childTables` لـ 7 parents + تغيير `warm: false` لـ 7 child tables + تحديث `FULL_SYNC_STEPS` |
| `src/lib/fullSync.ts` | استخراج وكتابة nested data في child Dexie tables |
| `src/hooks/useMarketLists.ts` | إضافة `onSuccess` لـ createList |
| `src/hooks/useTaskLists.ts` | إضافة `onSuccess` لـ createList |

**5 ملفات، لا migration مطلوب.**

