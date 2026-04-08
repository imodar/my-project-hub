

# إصلاح trash-api: استبدال getClaims بـ getUser

## المشكلة
`supabase.auth.getClaims()` غير موجودة في Supabase JS SDK — تسبب خطأ 500.

## الحل
نعم، تحليلك صحيح 100%. استبدال السطور بـ:
```ts
const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
if (authError || !authUser?.id) return json({ error: "Unauthorized" }, 401);
const userId = authUser.id;
```

بالإضافة لإصلاح باقي أخطاء البناء الـ 36:

### التعديل 1: trash-api/index.ts
- استبدال `getClaims` بـ `getUser()`

### التعديل 2: جميع الـ 29 Edge Function
- تغيير `catch (err)` إلى `catch (err: any)` لحل خطأ `TS18046: 'err' is of type 'unknown'`

### التعديل 3: phone-auth/index.ts
- تغيير نوع `adminClient` في `logOtpAudit` و `findUserById` من `SupabaseClient<unknown, never, GenericSchema>` إلى `any`
- إصلاح `getUserById(userId)` — التأكد من تمرير string وليس object

### التعديل 4: admin-api/index.ts
- تغيير `null` إلى `undefined` في استدعاء `logAudit`

### التعديل 5: useRevenueCat.ts
- إصلاح أخطاء `offerings` و `showManageSubscriptions` بإضافة type assertions

## الملفات المتأثرة
- `supabase/functions/trash-api/index.ts`
- `supabase/functions/phone-auth/index.ts`
- `supabase/functions/admin-api/index.ts`
- `src/hooks/useRevenueCat.ts`
- جميع الـ 29 Edge Function (إصلاح `catch (err: any)`)

