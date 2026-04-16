

# تقييم الخطة — ممتازة بنسبة ~95%

بعد مراجعة الكود الفعلي، الخطة **دقيقة ومتسقة مع الكود الموجود**. كل الأسطر والملفات المذكورة صحيحة. عندي ملاحظات بسيطة فقط:

---

## ملاحظات على الخطة

### Fix 9 — استخدام Sentry عبر window غير نظيف

الخطة تستخدم `(window as any).__sentryReportError` — هذا غير موجود في الكود. المشروع يستخدم `reportError()` من `src/lib/errorReporting.ts`. لكن `syncManager.ts` ملف lib وليس React component، فيمكن استيراد `reportError` مباشرة:

```ts
import { reportError } from "./errorReporting";
// ...
reportError(new Error(`SyncManager anomaly: ${tableName}`), { source: "syncManager" });
```

### Fix 10 — الملف المشترك لن يتضمن CORS headers

`safeError()` المقترح يُرجع Response بدون CORS headers. كل Edge Function لها `json()` helper محلي يتضمن CORS. الأفضل: **لا ننشئ ملف مشترك جديد**، بل نُعدّل catch block في كل ملف ليستخدم `json()` المحلي الموجود أصلاً:

```ts
// بدل safeError():
} catch (err) {
  console.error("[function-name]", err);
  return json({ error: "حدث خطأ داخلي" }, 500);
}
```

هذا أبسط، لا يكسر CORS، ويُطبّق نفس المبدأ. عدد الملفات: **20 Edge Function** (وليس 6 فقط كما ذُكر).

### Fix 2 — CSP: ملاحظة بسيطة

`img-src` تحتوي أيضاً على `https://*.supabase.in` — يجب تحديدها أيضاً: `https://ptmhrfovbyvpewfdpejf.supabase.in` أو إزالتها إذا غير مستخدمة.

### CORS helper الموجود غير مُستخدم

لاحظت أن `_shared/cors.ts` موجود فيه `getCorsHeaders()` مع whitelist — لكن **لا أحد من الـ 28 Edge Function يستخدمه**. كلهم يعرّفون CORS headers محلياً بـ `"*"`. هذا ليس إصلاح مطلوب الآن (مبرر بسبب Capacitor)، لكنه ملاحظة للمستقبل.

---

## الخطة النهائية المعدّلة

10 إصلاحات في **~30 ملفاً** (وليس 13):

| # | الإصلاح | الملفات | ملاحظة |
|---|---------|---------|--------|
| 1 | إزالة OTP | `phone-auth/index.ts` + `Auth.tsx` | كما في الخطة ✅ |
| 2 | CSP تشديد | `_headers` | + تحديد `img-src` أيضاً ✅ |
| 3 | File signatures | `storage.ts` | كما في الخطة ✅ |
| 4 | RoleGuard skeleton | `RoleGuard.tsx` | كما في الخطة ✅ |
| 5 | null role → false | `UserRoleContext.tsx` | كما في الخطة ✅ |
| 6 | await deleteDatabase | `AuthContext.tsx` | كما في الخطة ✅ |
| 7 | Conflict → 60s | `conflictResolver.ts` | كما في الخطة ✅ |
| 8 | AdminGuard | `App.tsx` | كما في الخطة ✅ |
| 9 | Sync protection | `syncManager.ts` | تعديل: `reportError()` بدل `window.__sentry` |
| 10 | Error leakage | **~20 Edge Function** | تعديل: استخدام `json()` المحلي + `console.error`، بدون ملف مشترك |

### ترتيب التنفيذ

**المجموعة 1 — حرج (أولاً):**
- Fix 1: OTP leak
- Fix 5: null role
- Fix 4: RoleGuard

**المجموعة 2 — عالي:**
- Fix 8: AdminGuard
- Fix 6: await deleteDatabase
- Fix 3: File signatures

**المجموعة 3 — متوسط:**
- Fix 2: CSP
- Fix 7: Conflict threshold
- Fix 9: Sync protection
- Fix 10: Error leakage (20 ملف)

