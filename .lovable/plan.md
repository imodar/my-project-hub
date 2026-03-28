

# إصلاح offline-first للـ mutations الناقصة — 5 ملفات

## الحالة الحالية بعد المراجعة

| الملف | المشكلة | الحالة |
|-------|---------|--------|
| useZakatAssets.ts | queryKey خاطئ | **تم إصلاحه سابقاً** |
| useMedications.ts (addLog) | لا يحدّث IndexedDB | **تم إصلاحه سابقاً** |
| useWill.ts | لا يستخدم useOfflineFirst | **يحتاج إصلاح** |
| useDebts.ts | updateDebt/deleteDebt بدون onSuccess | **يحتاج إصلاح** |
| useBudgets.ts | updateBudget/deleteBudget بدون onSuccess | **يحتاج إصلاح** |
| useVehicles.ts | updateVehicle/deleteVehicle بدون onSuccess | **يحتاج إصلاح** |
| useCalendarEvents.ts | updateEvent/deleteEvent بدون onSuccess | **يحتاج إصلاح** |
| useMedications.ts | updateMedication/deleteMedication بدون onSuccess | **يحتاج إصلاح** |

## التعديلات

### 1. `src/hooks/useWill.ts` — تحويل لـ useOfflineFirst

تحويل `willQuery` من `useQuery` العادي إلى `useOfflineFirst` مع جدول `will_sections`:

- إضافة imports: `useOfflineFirst`, `useOfflineMutation`, `useCallback`
- استبدال `useQuery` بـ `useOfflineFirst<any>({ table: "will_sections", queryKey: key, apiFn, enabled })`
- `apiFn` يستدعي `will-api` مع `action: "get-will"` ويرجع `{ data: [data], error }` (يلف النتيجة في array لأن useOfflineFirst يتوقع array)
- تحويل `upsertWill` و `deleteWill` لـ `useOfflineMutation` مع `onSuccess: () => refetch()`
- `createOpenRequest` يبقى `useMutation` عادي (لا يحتاج offline)
- النتيجة: `will: data?.[0] ?? null` (أول عنصر من الـ array)

### 2. `src/hooks/useDebts.ts` — إضافة onSuccess

- سطر 66 (`updateDebt`): إضافة `onSuccess: () => refetch(),`
- سطر 78 (`deleteDebt`): إضافة `onSuccess: () => refetch(),`

### 3. `src/hooks/useBudgets.ts` — إضافة onSuccess

- سطر 62 (`updateBudget`): إضافة `onSuccess: () => refetch(),`
- سطر 74 (`deleteBudget`): إضافة `onSuccess: () => refetch(),`

### 4. `src/hooks/useVehicles.ts` — إضافة onSuccess

- سطر 51 (`updateVehicle`): إضافة `onSuccess: () => refetch(),`
- سطر 62 (`deleteVehicle`): إضافة `onSuccess: () => refetch(),`

### 5. `src/hooks/useCalendarEvents.ts` — إضافة onSuccess

- سطر 54 (`updateEvent`): إضافة `onSuccess: () => refetch(),`
- سطر 66 (`deleteEvent`): إضافة `onSuccess: () => refetch(),`

### 6. `src/hooks/useMedications.ts` — إضافة onSuccess

- سطر 75 (`updateMedication`): إضافة `onSuccess: () => refetch(),`
- سطر 87 (`deleteMedication`): إضافة `onSuccess: () => refetch(),`

## ملخص
- **6 ملفات** تعديل
- **10 mutations** تحصل على `onSuccess: () => refetch()`
- **useWill** يتحول من `useQuery` إلى `useOfflineFirst` + `useOfflineMutation`
- النتيجة: كل update/delete يحدّث الكاش فوراً بدل انتظار إعادة تشغيل التطبيق

