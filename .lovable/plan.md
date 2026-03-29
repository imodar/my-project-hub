

# خطة إصلاح offline-first — النسخة المصححة

## الملخص

9 ملفات تعديل لإصلاح 7 مشاكل مؤكدة بعد فحص الكود الفعلي.

---

## التغييرات

### 1. `src/lib/db.ts` — إضافة جدول `worship_children` + version bump

- إضافة `worship_children!: Table;` في الكلاس (بعد سطر 80)
- إضافة `worship_children: "id, family_id"` في stores
- Version bump من 2 إلى 3

### 2. `src/hooks/useWorshipChildren.ts` — تحويل لـ useOfflineFirst + useOfflineMutation

- استبدال `useQuery` بـ `useOfflineFirst` مع table `worship_children` و queryKey `["worship-children", familyId]`
- استبدال `useMutation` (addChild) بـ `useOfflineMutation` مع operation `INSERT` و `onSuccess: () => refetch()`
- استبدال `useMutation` (removeChild) بـ `useOfflineMutation` مع operation `DELETE` و `onSuccess: () => refetch()`

### 3. `src/hooks/useKidsWorshipData.ts` — إضافة IndexedDB initial data + staleTime

- عند mount: قراءة `db.kids_worship_data.where({ child_id: childId, year, month }).toArray()` كـ `initialData`
- إضافة `staleTime: 5 * 60 * 1000` و `gcTime: 30 * 60 * 1000` لتقليل network calls
- الـ optimistic updates الحالية (onMutate + rollback) تبقى كما هي — سليمة

### 4. `src/lib/warmCache.ts` — إضافة `worship_children`

- إضافة: `{ table: "worship_children", queryKeyPrefix: "worship-children" }`
- ملاحظة: `kids_worship_data` لا يُضاف لأن queryKey مختلف `[childId, year, month]` ولا يناسب warmCache pattern

### 5. `src/lib/fullSync.ts` — إضافة 3 خطوات مزامنة

```text
{ label: "الزكاة",    action: "get-assets",    fn: "zakat-api",   table: "zakat_assets" }
{ label: "الوصية",    action: "get-will",      fn: "will-api",    table: "will_sections" }
{ label: "العبادات",  action: "get-children",  fn: "worship-api", table: "worship_children" }
```

- **تصحيح**: الوصية تستخدم `action: "get-will"` (وليس `get-sections`)
- **ملاحظة**: `family_id` يُمرر تلقائياً في سطر 39 `body: { action: step.action, family_id: familyId }`
- **ملاحظة**: `will-api` يتجاهل `family_id` ويستخدم `userId` — هذا مقبول، لن يسبب خطأ

### 6. `src/hooks/useZakatAssets.ts` — إضافة `onSuccess: () => refetch()`

- سطر 71 (`updateAsset`): إضافة `onSuccess: () => refetch(),`
- سطر 82 (`deleteAsset`): إضافة `onSuccess: () => refetch(),`

### 7. `src/hooks/useVaccinations.ts` — إضافة `filterFn`

- إضافة `filterFn: (items) => items.filter((c: any) => !familyId || c.family_id === familyId)` في `useOfflineFirst`
- ملاحظة: اللقاحات لا تحتوي `family_id` مباشرة في الـ child object — لكن API يفلتر بالـ family. الـ filterFn تحمي فقط في حالة وجود بيانات عائلة أخرى في IndexedDB

### 8. `src/hooks/useTaskLists.ts` — `deleteList` إضافة `onSuccess`

- سطر 58: إضافة `onSuccess: () => refetch(),`

### 9. `src/hooks/useMarketLists.ts` — `deleteList` إضافة `onSuccess`

- سطر 62: إضافة `onSuccess: () => refetch(),`

---

## ملخص الملفات

| الملف | التغيير |
|-------|---------|
| `src/lib/db.ts` | جدول جديد + version bump |
| `src/hooks/useWorshipChildren.ts` | إعادة كتابة → offline-first |
| `src/hooks/useKidsWorshipData.ts` | initialData + staleTime |
| `src/lib/warmCache.ts` | إضافة worship_children |
| `src/lib/fullSync.ts` | 3 خطوات sync جديدة |
| `src/hooks/useZakatAssets.ts` | onSuccess لـ update/delete |
| `src/hooks/useVaccinations.ts` | filterFn |
| `src/hooks/useTaskLists.ts` | onSuccess لـ deleteList |
| `src/hooks/useMarketLists.ts` | onSuccess لـ deleteList |

