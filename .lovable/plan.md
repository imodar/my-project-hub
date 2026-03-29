

# إصلاح المشاركة + flickering — 8 ملفات

## التحقق المطلوب ✅
تم التحقق: `update-list` action موجود في **كل** الـ Edge Functions الأربع:
- `tasks-api` ✅
- `market-api` ✅
- `documents-api` ✅ (سطر 77)
- `places-api` ✅ (سطر 84)

لا حاجة لتعديل أي Edge Function.

---

## التغييرات — نفس الخطة السابقة بدون تغيير

### الـ Hooks (4 ملفات) — إضافة `updateList` + حذف `queryKey` من `createList`

| الملف | التعديل |
|-------|---------|
| `useMarketLists.ts` | إضافة `updateList` mutation + حذف `queryKey` من `createList` + إرجاع `updateList` |
| `useTaskLists.ts` | نفس الشيء |
| `useDocumentLists.ts` | نفس الشيء |
| `usePlaceLists.ts` | نفس الشيء |

### الشاشات (4 ملفات) — ربط `shareList` بالـ mutation

| الملف | التعديل |
|-------|---------|
| `Market.tsx` | `shareList` يستدعي `updateList.mutate({ id, shared_with })` |
| `Tasks.tsx` | نفس الشيء |
| `Documents.tsx` | نفس الشيء |
| `Places.tsx` | نفس الشيء |

## ملخص
8 ملفات، لا تغيير عن الخطة المعتمدة سابقاً.

