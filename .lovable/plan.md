

# إصلاح 3 ملاحظات صغيرة — vehicles filterFn + debts enabled + vehicles index

## التغييرات

### 1. `src/hooks/useVehicles.ts` — إضافة `filterFn`
```ts
const filterByFamily = useCallback(
  (items: any[]) => familyId ? items.filter((v: any) => v.family_id === familyId) : [],
  [familyId]
);

const { data: vehicles, isLoading, refetch } = useOfflineFirst<any>({
  table: "vehicles",
  queryKey: key,
  apiFn,
  enabled: !!familyId,
  scopeKey: familyId ?? undefined,
  filterFn: filterByFamily,
});
```

### 2. `src/hooks/useDebts.ts` — تغيير `enabled`
```ts
enabled: !!user && !!familyId,
```

### 3. `src/lib/db.ts` — إضافة `family_id` index للمركبات
```ts
vehicles: "id, family_id",
```

## ملخص
3 تعديلات بسيطة في 3 ملفات — سطر واحد لكل ملف تقريباً.

