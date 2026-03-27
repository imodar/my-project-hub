

# إصلاح Race Condition في AuthContext.tsx

## المشكلة
عند تسجيل الدخول، `fetchProfile` يُستدعى مرتين بالتوازي (من `onAuthStateChange` + `getSession`). الاستدعاء الأول يفشل لأن التوكن غير جاهز بعد، فيبقى `profileName = ""` ويُحوَّل المستخدم إلى `/complete-profile` رغم وجود اسمه في قاعدة البيانات.

## التعديل: `src/contexts/AuthContext.tsx`

### 1. منع الاستدعاء المزدوج
إضافة `useRef<boolean>` لمنع تشغيل `fetchProfile` مرتين بالتوازي:
```ts
const fetchingRef = useRef(false);
// في بداية fetchProfile:
if (fetchingRef.current) return;
fetchingRef.current = true;
// في نهاية fetchProfile:
fetchingRef.current = false;
```

### 2. إعادة محاولة مرة واحدة إذا فشل ولا يوجد cache
```ts
let success = await Promise.race([networkFetch(), timeout]);
if (!success && !cached) {
  await new Promise(r => setTimeout(r, 1200));
  await Promise.race([networkFetch(), timeout2]);
}
```

### 3. إصلاح السباق بين onAuthStateChange و getSession
- `onAuthStateChange`: يضبط `session` و `loading` فقط، **لا يستدعي `fetchProfile`** إلا عند event `SIGNED_IN` وبشرط عدم وجود fetch جارٍ.
- `getSession().then()`: يستدعي `fetchProfile` للجلسة الموجودة مسبقاً.
- عند logout (`!newSession`): يمسح `profileName` ويضبط `profileReady = true`.

### الملف الوحيد المتأثر
| الملف | التغيير |
|---|---|
| `src/contexts/AuthContext.tsx` | منع استدعاء مزدوج + retry + إصلاح race condition |

