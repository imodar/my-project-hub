

# إصلاح تكرار القوائم + Flickering — خطة محدّثة

## المشاكل

| # | المشكلة | السبب |
|---|---------|-------|
| 1 | قائمة العائلة تُنشأ عدة مرات في DB | `createListMutation` في dependency array → reference تتغير كل render → effect يُعاد |
| 2 | القوائم تختفي وترجع (flickering) | `onSuccess: () => refetch()` في كل mutation → invalidate + re-fetch → loading مؤقت |

## التغييرات

### 1. حذف `createListMutation` من dependency array

**ملفان:** `Market.tsx` (سطر 164) + `Tasks.tsx` (سطر 109)

```ts
// قبل
}, [familyId, featureAccess.isStaff, isLoading, dbLists, createListMutation]);
// بعد
}, [familyId, featureAccess.isStaff, isLoading, dbLists]);
```

### 2. حذف `onSuccess: () => refetch()` من mutations مع optimistic يدوي

**ملفان:** `useMarketLists.ts` + `useTaskLists.ts`

| Mutation | الوضع الحالي | التغيير |
|----------|-------------|---------|
| `createList` | `onSuccess: refetch()` | حذف `onSuccess` — الـ optimistic الموجود في wrapper function كافٍ |
| `addItem` | `onSuccess: refetch()` + optimistic يدوي في wrapper | حذف `onSuccess` — الـ optimistic اليدوي كافٍ |
| `updateItem` | `onSuccess: refetch()` + optimistic يدوي في wrapper (market) | حذف `onSuccess` — الـ optimistic اليدوي كافٍ |
| `toggleItem` (tasks) | لا يوجد refetch + optimistic يدوي | لا تغيير |
| `deleteItem` | `onSuccess: refetch()` بدون optimistic يدوي | **إضافة optimistic يدوي** + حذف `onSuccess` |
| `deleteList` | `onSuccess: refetch()` + `queryKey` (optimistic) | إبقاء `queryKey` للـ optimistic، حذف `onSuccess` |
| `updateList` | `onSuccess: refetch()` + `queryKey` (optimistic) | إبقاء `queryKey` للـ optimistic، حذف `onSuccess` |

### 3. إضافة optimistic يدوي لـ `deleteItem`

في wrapper function الخاص بـ `deleteItem.mutate`:

```ts
// useMarketLists.ts
deleteItem: {
  ...deleteItem,
  mutate: (itemId: string) => {
    qc.setQueryData(key, (old: any[] | undefined) => {
      if (!old) return old;
      return old.map((list: any) => ({
        ...list,
        market_items: (list.market_items || []).filter((item: any) => item.id !== itemId),
      }));
    });
    deleteItem.mutate({ id: itemId });
  },
},
```

نفس الشيء لـ `useTaskLists.ts` مع `task_items`.

### 4. إضافة guard `isPending` لمنع التكرار

**ملفان:** `Market.tsx` + `Tasks.tsx`

```ts
if (createListMutation.isPending) return; // قبل createdDefaultListRef check
```

---

## ملخص الملفات

| الملف | التعديل |
|-------|---------|
| `src/pages/Market.tsx` | حذف `createListMutation` من deps + guard `isPending` |
| `src/pages/Tasks.tsx` | نفس الشيء |
| `src/hooks/useMarketLists.ts` | حذف `onSuccess: refetch()` من create/add/update/deleteItem/deleteList/updateList + optimistic يدوي لـ deleteItem |
| `src/hooks/useTaskLists.ts` | نفس الشيء |

4 ملفات، لا ملفات جديدة، لا migration.

