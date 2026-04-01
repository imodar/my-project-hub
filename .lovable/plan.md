

# إصلاح 6 مشاكل Local-First المتبقية — خطة نهائية محدّثة

---

## ترتيب التنفيذ

### الخطوة 1 — `src/lib/db.ts`: إضافة `trash_items`

- إضافة class field:
  ```ts
  trash_items!: Table;
  ```
- إضافة version(5) مع الجدول الجديد فقط:
  ```ts
  this.version(5).stores({
    trash_items: "id, family_id, type, deleted_at",
  });
  ```

---

### الخطوة 2 — `src/App.tsx`: إصلاح `initialSyncDone`

إذا `first_sync_done` مفقود من `localStorage` → فحص `getMeaningfulLocalDataState()`. إذا Dexie فيها بيانات فعلية → `initialSyncDone = true` + كتابة `first_sync_done` في `localStorage`.

---

### الخطوة 3 — `src/hooks/useFamilyMembers.ts`: دعم offline

- إبقاء `useQuery` الحالي كما هو
- إضافة `placeholderData` من Dexie عبر `useEffect` يقرأ `db.family_members` + `db.profiles` join محلي
- بعد نجاح `queryFn` → كتابة النتائج في `db.family_members` + `db.profiles`

---

### الخطوة 4 — `src/pages/Profile.tsx`: كتابة Dexie

بعد `localStorage.setItem(...)` إضافة:
```ts
await db.profiles.put({ id: user.id, name, ...(avatarUrl ? { avatar_url: avatarUrl } : {}) });
```

---

### الخطوة 5 — `src/contexts/TrashContext.tsx`: offline support

- `placeholderData` من `db.trash_items` عبر `useEffect`
- بعد جلب API ناجح → `db.trash_items.bulkPut(items)`
- عند `addToTrash` → كتابة محلية في `db.trash_items`
- عند `permanentlyDelete` → حذف من `db.trash_items`

---

### الخطوة 6 — إضافة `filterFn` للـ hooks الناقصة

**`src/hooks/useBudgets.ts`** و **`src/hooks/useTrips.ts`**:
```ts
filterFn: (items) => items.filter(i => !familyId || i.family_id === familyId)
```

---

### الخطوة 7 — إزالة `onSuccess: () => refetch()` (4 hooks فقط)

| الملف | عدد المواضع |
|-------|-------------|
| `src/hooks/useDebts.ts` | 5 |
| `src/hooks/useDocumentLists.ts` | 1 |
| `src/hooks/usePlaceLists.ts` | 1 |
| `src/hooks/useZakatAssets.ts` | 4 |

**لا يُحذف من:**
- `useWill.ts` — البيانات object مُغلّف في array، optimistic لا يعرف الـ shape
- `useMedications.ts` — addLog يُحدّث nested data داخل medication object

---

## ملخص الملفات

| الملف | التعديل |
|-------|---------|
| `src/lib/db.ts` | class field + version(5) + `trash_items` |
| `src/App.tsx` | `initialSyncDone` يفحص Dexie |
| `src/hooks/useFamilyMembers.ts` | `placeholderData` من Dexie + كتابة بعد fetch |
| `src/pages/Profile.tsx` | `db.profiles.put()` بعد الحفظ |
| `src/contexts/TrashContext.tsx` | قراءة/كتابة Dexie |
| `src/hooks/useBudgets.ts` | إضافة `filterFn` |
| `src/hooks/useTrips.ts` | إضافة `filterFn` |
| `src/hooks/useDebts.ts` | حذف `onSuccess: refetch` (×5) |
| `src/hooks/useDocumentLists.ts` | حذف `onSuccess: refetch` (×1) |
| `src/hooks/usePlaceLists.ts` | حذف `onSuccess: refetch` (×1) |
| `src/hooks/useZakatAssets.ts` | حذف `onSuccess: refetch` (×4) |

**11 ملف، لا migration مطلوب.**

