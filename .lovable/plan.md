

# تقييم الخطة المقترحة

## المشكلة في الخطة الحالية

الخطة فيها مشكلة نوع (Type mismatch) ستكسر الكود:

- `pendingDrawerMember` في FamilyManagement نوعه `FamilyMember` (يحتوي `name`, `role`, `isAdmin`, `status`, `avatar`...)
- `pendingMember` في الـ Context المقترح نوعه `{ id, name, family_id }` فقط
- الـ Drawer يستخدم `pendingDrawerMember?.name` و properties أخرى من `FamilyMember`
- عند وصول Realtime event، الـ payload يحتوي فقط على `user_id`, `family_id`, `status` — بدون `name` (الاسم يأتي من جدول `profiles` عبر join في `useFamilyMembers`)

يعني الـ `name: ""` في الخطة لن يتحدث أبداً لأن لا يوجد آلية لتحديثه.

## الحل الأبسط والأصح

بدل Context معقد، نستخدم **hook بسيط + navigate**:

1. عند وصول عضو pending عبر Realtime → ننقل المشرف لصفحة `/family`
2. الكود الموجود أصلاً في FamilyManagement (سطر 149-155) يفتح الـ Drawer تلقائياً بعد تحميل الأعضاء

هذا يعمل لأن:
- الـ `useFamilyMembers` hook يجلب الاسم والدور من الـ API
- الـ `useEffect` الموجود يكشف الـ pending ويفتح الـ drawer
- لا حاجة لنقل أي UI أو تغيير types

### ملف جديد: `src/hooks/usePendingMemberAlert.ts`

```text
- يشترك بـ Realtime على family_members مع filter على family_id
- عند INSERT بـ status=pending والمستخدم admin:
  → invalidateQueries لـ family-members-list
  → إذا المستخدم ليس على /family → navigate("/family")
  → إذا المستخدم على /family → الـ invalidate وحده كافي (useEffect الموجود يفتح الـ drawer)
```

### تعديل: `src/App.tsx`

- استدعاء `usePendingMemberAlert()` داخل `WarmCacheProvider`

---

## الملفات

| # | الملف | التغيير |
|---|-------|---------|
| 1 | `src/hooks/usePendingMemberAlert.ts` | ملف جديد — Realtime + navigate |
| 2 | `src/App.tsx` | استدعاء الـ hook |

**2 ملفات فقط، بدون context، بدون migration، بدون تغيير FamilyManagement**

