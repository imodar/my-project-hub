

# إصلاح Optimistic Updates للعناصر الفرعية — 10 ملفات

## المشكلة
mutations على عناصر فرعية (items/photos/expenses/logs/maintenance) تستخدم `queryKey` الخاص بالكيان الأم، فالـ optimistic update في `useOfflineMutation` يضيف العنصر الفرعي كأنه كيان رئيسي جديد (قائمة/رحلة/ألبوم) بدل إضافته داخل الكيان الأم.

## القاعدة
- **كيان رئيسي** (createList/deleteList/createTrip) → يبقى `queryKey`
- **عنصر فرعي** (addItem/addPhoto/addExpense) → حذف `queryKey`، إضافة `onSuccess: () => refetch()` إن لم يكن موجوداً

---

## التعديلات بالتفصيل

### 1. `src/hooks/useTaskLists.ts`
| Mutation | الحالة الحالية | التعديل |
|---|---|---|
| `updateItem` (سطر 75-79) | `queryKey: key` بدون `onSuccess` | حذف `queryKey: key` + إضافة `onSuccess: () => refetch()` |
| `deleteItem` (سطر 81-85) | `queryKey: key` بدون `onSuccess` | حذف `queryKey: key` + إضافة `onSuccess: () => refetch()` |

### 2. `src/hooks/useDocumentLists.ts`
| Mutation | الحالة الحالية | التعديل |
|---|---|---|
| `addItem` (سطر 47-51) | `queryKey: key, onSuccess: () => refetch()` | حذف `queryKey: key` فقط |
| `updateItem` (سطر 53-57) | `queryKey: key` بدون `onSuccess` | حذف `queryKey: key` + إضافة `onSuccess: () => refetch()` |
| `deleteItem` (سطر 59-63) | `queryKey: key` بدون `onSuccess` | حذف `queryKey: key` + إضافة `onSuccess: () => refetch()` |
| `addFile` (سطر 65-69) | `queryKey: key, onSuccess: () => refetch()` | حذف `queryKey: key` فقط |
| `deleteFile` (سطر 71-75) | `queryKey: key` بدون `onSuccess` | حذف `queryKey: key` + إضافة `onSuccess: () => refetch()` |

### 3. `src/hooks/useTrips.ts`
| Mutation | سطر | الحالة | التعديل |
|---|---|---|---|
| `addDayPlan` | 58-62 | `queryKey: key, onSuccess` | حذف `queryKey: key` |
| `addActivity` | 64-68 | `queryKey: key, onSuccess` | حذف `queryKey: key` |
| `updateActivity` | 70-74 | `queryKey: key` | حذف `queryKey: key` + إضافة `onSuccess: () => refetch()` |
| `addExpense` | 76-80 | `queryKey: key, onSuccess` | حذف `queryKey: key` |
| `deleteExpense` | 82-86 | `queryKey: key` | حذف `queryKey: key` + إضافة `onSuccess: () => refetch()` |
| `addPackingItem` | 88-92 | `queryKey: key, onSuccess` | حذف `queryKey: key` |
| `updatePackingItem` | 94-98 | `queryKey: key` | حذف `queryKey: key` + إضافة `onSuccess: () => refetch()` |
| `addSuggestion` | 100-104 | `queryKey: key, onSuccess` | حذف `queryKey: key` |
| `updateSuggestion` | 106-110 | `queryKey: key` | حذف `queryKey: key` + إضافة `onSuccess: () => refetch()` |
| `addDocument` | 112-116 | `queryKey: key, onSuccess` | حذف `queryKey: key` |
| `deleteDocument` | 118-122 | `queryKey: key` | حذف `queryKey: key` + إضافة `onSuccess: () => refetch()` |

### 4. `src/hooks/useBudgets.ts`
| Mutation | سطر | الحالة | التعديل |
|---|---|---|---|
| `addExpense` | 77-96 | `queryKey: key, onSuccess` | حذف `queryKey: key` |
| `updateExpense` | 98-109 | `queryKey: key` | حذف `queryKey: key` + إضافة `onSuccess: () => refetch()` |
| `deleteExpense` | 111-121 | `queryKey: key` | حذف `queryKey: key` + إضافة `onSuccess: () => refetch()` |

### 5. `src/hooks/useDebts.ts`
| Mutation | سطر | الحالة | التعديل |
|---|---|---|---|
| `addPayment` | 81-102 | `queryKey: key, onSuccess` | حذف `queryKey: key` |
| `addPostponement` | 104-121 | `queryKey: key, onSuccess` | حذف `queryKey: key` |

### 6. `src/hooks/useAlbums.ts`
| Mutation | سطر | الحالة | التعديل |
|---|---|---|---|
| `addPhoto` | 73-83 | `queryKey: key, onSuccess` | حذف `queryKey: key` |
| `deletePhoto` | 85-94 | `queryKey: key` | حذف `queryKey: key` + إضافة `onSuccess: () => refetch()` |

### 7. `src/hooks/useMedications.ts`
| Mutation | سطر | الحالة | التعديل |
|---|---|---|---|
| `addLog` | 89-106 | `queryKey, onSuccess` | حذف `queryKey` |

### 8. `src/hooks/useVehicles.ts`
| Mutation | سطر | الحالة | التعديل |
|---|---|---|---|
| `addMaintenance` | 65-75 | `queryKey: key, onSuccess` | حذف `queryKey: key` |
| `updateMaintenance` | 77-87 | `queryKey: key` | حذف `queryKey: key` + إضافة `onSuccess: () => refetch()` |
| `deleteMaintenance` | 89-98 | `queryKey: key` | حذف `queryKey: key` + إضافة `onSuccess: () => refetch()` |

### 9. `src/hooks/usePlaceLists.ts`
| Mutation | سطر | الحالة | التعديل |
|---|---|---|---|
| `addPlace` | 57-76 | `queryKey: key, onSuccess` | حذف `queryKey: key` |
| `updatePlace` | 78-90 | `queryKey: key, onSuccess` | حذف `queryKey: key` |
| `deletePlace` | 92-103 | `queryKey: key, onSuccess` | حذف `queryKey: key` |

### 10. `src/pages/Medications.tsx`
**السطر 43:** تحويل `useState` + `useEffect` إلى `useMemo`:
```ts
// قبل (سطر 43 + سطر 67-80 تقريباً):
const [medications, setMedications] = useState<Medication[]>([]);
useEffect(() => { setMedications(dbMeds.map(mapToLocal)); }, [dbMeds]);

// بعد:
const medications = useMemo(() => dbMeds.map(mapToLocal), [dbMeds]);
```
حذف `setMedications` وأي `useEffect` يعتمد عليه، واستبداله بـ `useMemo`.

---

## ملخص الأرقام
- **10 ملفات** تحتاج تعديل
- **29 mutation** تحتاج حذف `queryKey`
- **15 mutation** تحتاج إضافة `onSuccess: () => refetch()`
- **1 تحويل** من `useState`+`useEffect` إلى `useMemo`

