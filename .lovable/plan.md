

# خطة إصلاح أمان featureAccess — قراءة الدور من قاعدة البيانات

## المشكلة
`UserRoleContext` يقرأ الدور من `localStorage` — أي مستخدم يقدر يغيّر دوره من DevTools ويوصل لصفحات ممنوعة (الوصية، الزكاة، إلخ).

## الحل — 4 ملفات جديدة/معدّلة

### 1. إنشاء `src/hooks/useMyRole.ts`
- يستخدم React Query لجلب `role` و `is_admin` من جدول `family_members` حيث `user_id = auth.uid()` و `status = 'active'`
- `staleTime: 5 * 60 * 1000`
- يرجع `{ dbRole: UserRole | null, isAdmin: boolean, isLoading: boolean }`
- يعتمد على `useAuth()` مباشرة (لا يحتاج `useFamilyId`)

### 2. تعديل `src/contexts/UserRoleContext.tsx`
- إضافة `dbRole`, `isAdmin`, `isLoading` للـ context type
- استدعاء `useMyRole()` داخل Provider
- **`featureAccess` يُبنى من `dbRole`** وليس `currentRole`
- الإبقاء على `currentRole` + `setCurrentRole` للتوافق فقط (لكن لا يؤثر على الصلاحيات)
- إذا `isLoading` أو `dbRole === null` → `featureAccess` يكون غير مقيّد (أو مقيّد بالكامل حسب الأمان — الأفضل: مقيّد حتى يتم التحميل)

### 3. إنشاء `src/components/RoleGuard.tsx`
- Props: `requireNonStaff: boolean`, `children`
- يقرأ `dbRole` و `isLoading` من `useUserRole()`
- `isLoading` → spinner
- إذا `dbRole` هو staff (`worker/maid/driver`) و `requireNonStaff` مفعّل → `<Navigate to="/" />`
- غير ذلك → يعرض `children`

### 4. تعديل `src/App.tsx`
- لف هذه الروتات بـ `RoleGuard requireNonStaff`:
  - `/will`, `/zakat`, `/places`, `/calendar`, `/albums`
- مثال: `<AuthGuard><RoleGuard requireNonStaff><Will /></RoleGuard></AuthGuard>`

### 5. تعديل `src/pages/Settings.tsx` (سطور 191-225)
- استبدال Role Switcher التفاعلي بعرض الدور الحالي من DB فقط (read-only)
- إزالة `setCurrentRole` من الاستدعاء
- عرض `dbRole` مع label عربي + badge "من قاعدة البيانات"
- إذا `isLoading` → skeleton

---

## ملخص الملفات

| الملف | العملية |
|---|---|
| `src/hooks/useMyRole.ts` | جديد |
| `src/contexts/UserRoleContext.tsx` | تعديل |
| `src/components/RoleGuard.tsx` | جديد |
| `src/App.tsx` | تعديل (5 روتات) |
| `src/pages/Settings.tsx` | تعديل (role selector → read-only) |

لا تعديل على أي edge function أو migration — البيانات موجودة فعلاً في `family_members.role`.

