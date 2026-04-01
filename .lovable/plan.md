

# Local-First Architecture — الخطة النهائية المُنفَّذة

## الحالة: ✅ تم التنفيذ

---

## ما تم تنفيذه

### 1. Resource Registry الموحّد (`src/lib/resourceRegistry.ts`)
- مصدر واحد لكل مورد: table, queryKey, familyScoped, warm, fullSync, realtime
- يُستهلك من warmCache, fullSync, useFamilyRealtime
- لا drift بين الملفات بعد الآن

### 2. إصلاح Optimistic Create للقوائم
- `useMarketLists.ts`: إضافة `qc.setQueryData` قبل `createList.mutate/mutateAsync`
- `useTaskLists.ts`: نفس الإصلاح
- `useDocumentLists.ts`: كان يملك `queryKey` أصلاً — ✅
- `usePlaceLists.ts`: كان يملك `queryKey` أصلاً — ✅

### 3. توحيد warmCache/fullSync/useFamilyRealtime من Registry
- `warmCache.ts`: يقرأ من `WARM_TABLES` و `FAMILY_SCOPED_TABLES`
- `fullSync.ts`: يقرأ من `FULL_SYNC_STEPS`
- `useFamilyRealtime.ts`: يقرأ من `REALTIME_QUERY_KEYS`

### 4. إزالة `onSuccess: refetch()` الزائدة
- `useCalendarEvents.ts`: حذف 3 مواضع
- `useVehicles.ts`: حذف 6 مواضع (جميع mutations)

### 5. توسيع Realtime Query Keys
مفاتيح جديدة مُضافة تلقائياً من Registry:
- `zakat-assets`
- `will`
- `worship-children`
- `trash-items`

### 6. Local Reads للشاشات الخارجية
- `useMyRole.ts`: إضافة Dexie placeholder من `family_members`
- `TrashContext.tsx`: كان يملك Dexie reads/writes أصلاً — ✅

### 7. الشاشات التي تبقى Online-First (مقصود)
- OTP/Auth
- File uploads
- Live location
- Admin analytics
- invite code generation

---

## الملفات المُعدَّلة

| الملف | التعديل |
|-------|---------|
| `src/lib/resourceRegistry.ts` | **جديد** — Registry مركزي |
| `src/lib/warmCache.ts` | يقرأ من Registry |
| `src/lib/fullSync.ts` | يقرأ من Registry |
| `src/hooks/useFamilyRealtime.ts` | يقرأ من Registry |
| `src/hooks/useMarketLists.ts` | optimistic create |
| `src/hooks/useTaskLists.ts` | optimistic create |
| `src/hooks/useCalendarEvents.ts` | حذف onSuccess:refetch |
| `src/hooks/useVehicles.ts` | حذف onSuccess:refetch |
| `src/hooks/useMyRole.ts` | Dexie placeholder |
