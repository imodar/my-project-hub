

# إصلاح 6 مشاكل حرجة — خطة نهائية

## تحقق نوع البيانات: worship_children vs kids_worship_data

`kids_worship_data.child_id` هو `text` وفيه بيانات موجودة. تغييره لـ `uuid` سيكسر البيانات الحالية.

**القرار**: إبقاء `child_id` كـ `text`. `worship_children.id` يبقى `uuid` لكن عند الربط يُمرَّر كـ `child.id.toString()`.

---

## 1. Will.tsx — حماية حقيقية بكلمة مرور (client-side فقط)

- إضافة `isUnlocked` state يبدأ بـ `false`
- `handleUnlock()`: حساب SHA-256 محلياً ومقارنته مع `will.password_hash` — بدون API call
- إذا لم يكن هناك `password_hash`: إجبار إنشاء كلمة مرور أولاً عبر `upsertWill`
- عندما `!isUnlocked`: عرض شاشة قفل فقط
- استبدال `supabase.from("family_members")` → `supabase.functions.invoke("family-management", { body: { action: "get-members" } })`
- **لا تعديل على `will-api` أو `useWill.ts`**

**ملفات**: `src/pages/Will.tsx`

---

## 2. QR Code — رابط كامل + قراءة `?code=`

- تعديل `FamilyManagement.tsx`: QR يرمّز `https://ailti.lovable.app/join-or-create?code=ABC12345`
- تعديل `JoinOrCreate.tsx`: قراءة `?code=` من `useSearchParams` وملء حقل الكود تلقائياً

**ملفات**: `src/pages/FamilyManagement.tsx`, `src/pages/JoinOrCreate.tsx`

---

## 3. إزالة Realtime Channels المكررة

- حذف `useEffect` الذي ينشئ `supabase.channel(...)` من `useTaskLists.ts` و `useMarketLists.ts`
- `useFamilyRealtime` يغطي بالفعل هذه الجداول

**ملفات**: `src/hooks/useTaskLists.ts`, `src/hooks/useMarketLists.ts`

---

## 4. KidsWorship — نقل أسماء الأطفال إلى DB

**Migration**:
```sql
CREATE TABLE worship_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE worship_children ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members access worship children"
  ON worship_children FOR ALL TO authenticated
  USING (is_family_member(auth.uid(), family_id));
CREATE INDEX idx_worship_children_family ON worship_children(family_id);
```

- إضافة actions في `worship-api`: `get-children`, `add-child`, `remove-child`
- إنشاء hook `useWorshipChildren.ts` (`useQuery` + `useMutation`)
- تعديل `KidsWorship.tsx` و `ParentDashboard.tsx` لاستخدام الـ hook
- عند تمرير `childId` لـ `useKidsWorshipData`: يستخدم `child.id` (uuid as string)
- إبقاء `worshipData.ts` كـ fallback

**ملفات**: migration, `supabase/functions/worship-api/index.ts`, `src/hooks/useWorshipChildren.ts` (جديد), `src/pages/KidsWorship.tsx`, `src/pages/ParentDashboard.tsx`

---

## 5. Sentry — تفعيل حقيقي

- تثبيت `@sentry/react`
- `Sentry.init()` في `main.tsx` مع `VITE_SENTRY_DSN` (optional — إذا غير موجود يظل console.log)
- `reportError()` يستدعي `Sentry.captureException()`
- **عند تسجيل الدخول** في `AuthContext`: `Sentry.setUser({ id: user.id, email: user.email })`
- **عند تسجيل الخروج** في `signOut()` قبل `supabase.auth.signOut()`: `Sentry.setUser(null)` — بدونه ستُنسب أخطاء المستخدم التالي للسابق

**ملفات**: `package.json`, `src/main.tsx`, `src/lib/errorReporting.ts`, `src/contexts/AuthContext.tsx`

---

## 6. TypeScript strict mode

- تفعيل `strict: true` و `noImplicitAny: true` في `tsconfig.app.json`
- أولوية الإصلاح:
  1. كل `useOfflineMutation<any, any>` → أنواع حقيقية
  2. كل `apiFn: async (input: any)` → أنواع حقيقية
  3. الباقي `// @ts-expect-error TODO 2026-03-26: fix types`

**ملفات**: `tsconfig.app.json`, hooks الرئيسية

---

## ترتيب التنفيذ

1. Will.tsx — إصلاح القفل + إزالة DB call المباشر
2. QR Code — URL كامل + قراءة `?code=`
3. Realtime مكرر — حذف channels
4. KidsWorship — migration + hook + تعديل الصفحات
5. Sentry — تثبيت + تفعيل (مع `setUser(null)` عند الخروج)
6. TypeScript strict — تفعيل + إصلاح تدريجي

