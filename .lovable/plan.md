

# حذف `onSuccess: refetch()` الزائد من 5 hooks

## القاعدة
أي mutation عنده optimistic يدوي في الـ wrapper → حذف `onSuccess: () => refetch()`.

## التغييرات

### 1. `useTrips.ts` — 11 mutation

| Mutation | عنده optimistic يدوي؟ | التغيير |
|----------|----------------------|---------|
| `createTrip` | نعم (queryKey) | حذف `onSuccess: () => refetch()` |
| `addDayPlan` | نعم | حذف `onSuccess` |
| `addActivity` | نعم | حذف `onSuccess` |
| `updateActivity` | نعم | حذف `onSuccess` |
| `addExpense` | نعم | حذف `onSuccess` |
| `deleteExpense` | نعم | حذف `onSuccess` |
| `addPackingItem` | نعم | حذف `onSuccess` |
| `updatePackingItem` | نعم | حذف `onSuccess` |
| `addSuggestion` | نعم | حذف `onSuccess` |
| `updateSuggestion` | نعم | حذف `onSuccess` |
| `addDocument` | نعم | حذف `onSuccess` |
| `deleteDocument` | نعم | حذف `onSuccess` |

### 2. `useBudgets.ts` — 6 mutations

| Mutation | عنده optimistic؟ | التغيير |
|----------|------------------|---------|
| `createBudget` | queryKey | حذف `onSuccess` |
| `updateBudget` | queryKey | حذف `onSuccess` |
| `deleteBudget` | queryKey | حذف `onSuccess` |
| `addExpense` | نعم (يدوي) | حذف `onSuccess` |
| `updateExpense` | نعم (يدوي) | حذف `onSuccess` |
| `deleteExpense` | نعم (يدوي) | حذف `onSuccess` |

### 3. `useAlbums.ts` — 3 mutations

| Mutation | عنده optimistic؟ | التغيير |
|----------|------------------|---------|
| `createAlbum` | queryKey | حذف `onSuccess` |
| `addPhoto` | نعم (يدوي) | حذف `onSuccess` |
| `deletePhoto` | نعم (يدوي) | حذف `onSuccess` |

### 4. `useDocumentLists.ts` — 6 mutations

| Mutation | عنده optimistic؟ | التغيير |
|----------|------------------|---------|
| `createList` | لا | **إبقاء** `onSuccess: refetch()` (ضروري) |
| `updateList` | queryKey | حذف `onSuccess` |
| `deleteList` | queryKey | حذف `onSuccess` |
| `addItem` | نعم (يدوي) | حذف `onSuccess` |
| `updateItem` | نعم (يدوي) | حذف `onSuccess` |
| `deleteItem` | نعم (يدوي) | حذف `onSuccess` |
| `addFile` | نعم (يدوي) | حذف `onSuccess` |
| `deleteFile` | نعم (يدوي) | حذف `onSuccess` |

### 5. `usePlaceLists.ts` — 5 mutations

| Mutation | عنده optimistic؟ | التغيير |
|----------|------------------|---------|
| `createList` | لا | **إبقاء** `onSuccess: refetch()` |
| `updateList` | queryKey | حذف `onSuccess` |
| `deleteList` | queryKey | حذف `onSuccess` |
| `addPlace` | نعم (يدوي) | حذف `onSuccess` |
| `updatePlace` | نعم (يدوي) | حذف `onSuccess` |
| `deletePlace` | نعم (يدوي) | حذف `onSuccess` |

---

## ملخص

| الملف | عدد `onSuccess: refetch()` محذوف |
|-------|--------------------------------|
| `useTrips.ts` | 11 |
| `useBudgets.ts` | 6 |
| `useAlbums.ts` | 3 |
| `useDocumentLists.ts` | 7 (إبقاء 1 في createList) |
| `usePlaceLists.ts` | 5 (إبقاء 1 في createList) |
| **المجموع** | **32** |

5 ملفات، تغيير واحد متكرر: حذف `, onSuccess: () => refetch()` من سطور الـ mutation definitions.

