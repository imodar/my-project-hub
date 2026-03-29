

# إصلاح المشكلتين المتبقيتين

## المشاكل المؤكدة

| # | الملف | المشكلة |
|---|-------|---------|
| 1 | `src/hooks/useDocumentLists.ts` | `deleteList` بدون `onSuccess: () => refetch()` |
| 2 | `src/hooks/useMarketLists.ts` | `updateItem` بدون `onSuccess` — الـ optimistic update اليدوي موجود لكن لا refetch بعد نجاح السيرفر |

## التغييرات

### 1. `src/hooks/useDocumentLists.ts` — سطر 74-78
إضافة `onSuccess: () => refetch(),` في `deleteList`:
```ts
const deleteList = useOfflineMutation<any, any>({
  table: "document_lists", operation: "DELETE",
  apiFn: async (input) => invoke("delete-list", { id: input.id }),
  queryKey: key,
  onSuccess: () => refetch(),  // ← إضافة
});
```

### 2. `src/hooks/useMarketLists.ts` — سطر 72-75
إضافة `onSuccess: () => refetch(),` في `updateItem`:
```ts
const updateItem = useOfflineMutation<any, any>({
  table: "market_items", operation: "UPDATE",
  apiFn: async (input) => { const { id, ...updates } = input; return invoke("update-item", { id, ...updates }); },
  onSuccess: () => refetch(),  // ← إضافة
});
```

## ملخص
تعديلان بسيطان — سطر واحد في كل ملف.

