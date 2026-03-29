

# إصلاح النقطة المتبقية — إزالة `handleConfirmRole` القديم

## الملخص

من أصل 3 نقاط:
- **النقطة 1**: غير صحيحة — `useWorshipChildren` محوّل بالفعل لـ `useOfflineFirst`
- **النقطة 2**: لا مشكلة — `get-family-id` يُرجع `pending_family_id` بشكل صحيح
- **النقطة 3**: صحيحة — `handleConfirmRole` والـ drawer المرتبط به لا يزالان موجودين من النظام القديم

## التغييرات المطلوبة

### `src/pages/FamilyManagement.tsx`

1. **حذف `handleConfirmRole`** (سطر 412-431) — الدالة القديمة التي تستدعي `confirm-role`
2. **حذف state المرتبط**: `confirmMember`, `confirmRole`, `confirmingRole`
3. **حذف الـ Drawer/Bottom Sheet** الخاص بتأكيد الدور للأعضاء الـ active بدون `role_confirmed`
4. **إبقاء `handleAcceptMember`** و `handleRejectMember` — هذا هو النظام الجديد الصحيح

### `supabase/functions/family-management/index.ts`

- **اختياري**: حذف action `confirm-role` (سطر 282+) — لكن يمكن إبقاؤه كـ backward compatibility بدون ضرر. الأفضل حذفه لتنظيف الكود.

## ملخص
تعديل ملف واحد أساسي (`FamilyManagement.tsx`) لإزالة المسار القديم، مع تعديل اختياري للـ Edge Function.

