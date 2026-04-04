

# إصلاحان: calendar_events priority + findUserByPhone performance

## 1. `src/lib/resourceRegistry.ts`
تغيير `calendar_events` من `warmPriority: "critical"` إلى `"deferred"`.

## 2. Migration — إنشاء RPC function

```sql
CREATE OR REPLACE FUNCTION public.find_user_by_phone_or_email(_phone text, _email text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT id FROM auth.users
  WHERE phone = _phone OR email = _email
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_user_by_phone_or_email FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_by_phone_or_email TO service_role;
```

بدون `SET search_path` — الدالة تقرأ `auth.users` بالاسم الكامل فلا حاجة لتعريض الـ schema. الصلاحية مقيّدة لـ `service_role` فقط.

## 3. `supabase/functions/phone-auth/index.ts`
حذف دالة `findUserByPhone` (الـ pagination loop) واستبدالها بـ:

```typescript
const { data: userId } = await adminClient.rpc('find_user_by_phone_or_email', {
  _phone: fullPhone,
  _email: email,
});
```

ثم إذا وُجد `userId`: جلب المستخدم بـ `adminClient.auth.admin.getUserById(userId)`.

| # | الملف | التغيير |
|---|-------|---------|
| 1 | `src/lib/resourceRegistry.ts` | `calendar_events` → `warmPriority: "deferred"` |
| 2 | Migration جديد | `find_user_by_phone_or_email` RPC + REVOKE/GRANT |
| 3 | `supabase/functions/phone-auth/index.ts` | حذف loop، استخدام RPC |

