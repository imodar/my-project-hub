
# خطة الإصلاح: منع الرجوع الخاطئ إلى `complete-profile` بعد تسجيل الخروج ثم تسجيل الدخول

## التشخيص
المشكلة ليست من الداتابيز ولا من الـ API:
- من سجلات الشبكة واضح أن `auth-management` يرجّع الاسم الحالي بنجاح:
  - `{"name":"مضر"}`
- إذن البيانات موجودة فعلاً، لكن الواجهة تحكمت مبكرًا بشكل خاطئ.

## السبب الجذري
بعد `signOut` ثم `signIn`:
- `profileReady` يبقى `true` من الجلسة السابقة
- بينما `profileName` تم مسحه عند الخروج
- عند بدء الجلسة الجديدة، `AuthGuard` يرى:
  - `session` موجودة
  - `profileReady === true`
  - `profileName === ""`
- فيحوّل المستخدم فورًا إلى `/complete-profile` قبل أن ينتهي `fetchProfile()` من استرجاع الاسم من:
  1. `localStorage`
  2. ثم الـ API إذا لم يوجد كاش

يعني المشكلة الأساسية: **لم يتم إعادة تهيئة حالة البروفايل عند بدء جلسة جديدة**.

## التعديل المطلوب

### 1) إصلاح `src/contexts/AuthContext.tsx`
عند بداية أي جلسة جديدة للمستخدم:
- إعادة `profileReady` إلى `false` قبل بدء تحميل البروفايل
- إعادة تعيين `initialFetchDoneRef` بشكل صحيح عندما يتبدل المستخدم
- التأكد أن `fetchProfile()` لا يعلن الجاهزية النهائية إلا بعد:
  - قراءة الكاش المحلي أولاً
  - ثم محاولة API
  - ثم retry واحد فقط عند الحاجة

التعديل العملي:
- داخل `onAuthStateChange` عند وجود `newSession`:
  - إذا كان المستخدم جديدًا بالنسبة للحالة الحالية أو حدث `SIGNED_IN`
  - نفذ:
  ```ts
  setProfileReady(false);
  ```
- داخل `getSession().then(...)`:
  - قبل `fetchProfile(existingSession.user.id)` أيضًا:
  ```ts
  setProfileReady(false);
  ```
- الاحتفاظ بمنع الاستدعاء المزدوج الموجود حاليًا.

### 2) تقوية منطق `AuthGuard`
تعديل شرط التحويل إلى `/complete-profile` ليعتمد على **الاسم من الذاكرة أو الكاش المحلي** بدل `profileName` فقط.

الفكرة:
- حساب قيمة احتياطية:
  ```ts
  const effectiveProfileName =
    profileName || (session?.user?.id ? localStorage.getItem(`profile_name_${session.user.id}`) ?? "" : "");
  ```
- ثم:
  ```ts
  if (!effectiveProfileName) {
    return <Navigate to="/complete-profile" replace />;
  }
  ```

هذا يضمن:
- إذا كان الاسم موجودًا محليًا → يدخل مباشرة
- إذا لم يكن موجودًا محليًا → ينتظر `profileReady`
- وإذا انتهى التحميل ولم يجد شيئًا في المحلي ولا في الـ API → فقط وقتها يذهب إلى `complete-profile`

### 3) الحفاظ على التسلسل المطلوب منك
السلوك النهائي بعد الإصلاح سيكون:

```text
1. المستخدم يسجل الدخول
2. التطبيق يشيك على localStorage
3. إذا الاسم موجود -> يدخل فورًا
4. إذا غير موجود -> يطلب auth-management/get-profile
5. إذا API رجّع اسم -> يخزن محليًا ويدخل
6. إذا المحلي و API كلاهما فارغان -> يذهب إلى /complete-profile فقط
```

## الملفات المتأثرة
| الملف | التغيير |
|---|---|
| `src/contexts/AuthContext.tsx` | إعادة ضبط `profileReady` عند بدء جلسة جديدة ومنع الحكم المبكر |
| `src/components/AuthGuard.tsx` | استخدام fallback من localStorage قبل التحويل إلى `/complete-profile` |

## لماذا هذه الخطة صحيحة
- تستخدم **API فقط** ولا تضيف أي استدعاء مباشر للداتابيز
- لا تغيّر UX إلا في النقطة الخاطئة الحالية
- تتوافق مع منطقك المطلوب حرفيًا:
  - المحلي أولًا
  - ثم API
  - ثم `complete-profile` فقط إذا لم يوجد شيء في الاثنين

## ملاحظة تقنية
بناءً على الكود الحالي، `CompleteProfile.tsx` ما يزال يحدّث جدول `profiles` مباشرة عبر:
```ts
supabase.from("profiles").update(...)
```
هذا ليس ضمن سبب المشكلة الحالية، لكنه يخالف قاعدة “API فقط”. لن ألمسه ضمن هذا الإصلاح إلا إذا أردت أن أحدّث هذه الشاشة أيضًا لتستخدم `auth-management` بدل الاستدعاء المباشر.

## تنفيذ مقترح
سأنفذ الإصلاح في خطوتين فقط:
1. إعادة ضبط حالة البروفايل في `AuthContext`
2. إضافة fallback محلي واضح في `AuthGuard`
