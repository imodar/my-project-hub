

## مراجعة دقيقة لادعاءات المراجع — والخطة المُحدَّثة

### تحقق من كل ادعاء (قرأت الكود الحقيقي + مصدر `@supabase/functions-js`)

**1. `JSON.stringify` المزدوج → ❌ المراجع محق، أنا كنت مخطئاً**
قرأت `node_modules/@supabase/functions-js/dist/module/FunctionsClient.js`. السلوك الفعلي:
- إذا كان `body` نص (string) **و** الـ headers تحتوي `Content-Type` → الـ SDK **لا** يعيد stringify، ويُرسلها كما هي.
- في الكود الحالي: نمرر `JSON.stringify(body)` + `Content-Type: application/json` → SDK يُمررها كنص → السيرفر يستقبل JSON صحيح → `req.json()` يُرجع object سليم.
- **النتيجة:** كود زائد (redundant) لكن **ليس bug**. لا تفسير للبطء من هنا.

**2. `AbortController` غير موصول بـ `invoke` → ✅ صحيح 100%، bug حقيقي**
SDK يقبل `signal` كخيار:
```js
const { headers, method, body, signal, timeout } = options;
```
لكن كودنا يُنشئ `controller` ولا يُمرر `controller.signal` لـ `invoke`. نتيجة: **timeout الـ 15 ثانية لا يعمل أبداً**. أي طلب معلّق على شبكة سيئة قد يبقى دقائق → يُجمّد الـ UI ويُولِّد إحساس البطء.

**3. استخراج status بـ regex من الـ message → ✅ صحيح**
`error.message` قد يكون `"Edge Function 'trips-api-v2-403' failed"` → regex يلتقط `403` خطأً. الحل: استخدام `error.context.status` و `error.context.json()` المتاحَين على `FunctionsHttpError`.

**4. ادعاءاتي السابقة الأخرى — مراجعة ذاتية:**
- `check_rate_limit` يستدعي RPC في الـ DB لكل طلب → **صحيح** (overhead ~50-150ms قبل أي عمل).
- `auth.getUser()` يقوم بـ HTTP call داخلي إلى Supabase Auth → **صحيح** (~100-300ms). البديل: التحقق المحلي من JWT (decode فقط) كافٍ لأن JWT موقّع.
- إنشاء عميلَين Supabase لكل طلب (anon + service_role) → بدون cost حقيقي (مجرد objects).
- 30 Edge Function منفصلة → cold starts متكررة (logs تُظهر boot 25-45ms كل بضع ثوانٍ، شُغّيلة لكن لا تشرح ثوانٍ من البطء).
- `useFamilyId`: Dexie داخل `useEffect` — صحيح لكن تأثيره صغير (10-30ms) ولا يفسر بطء الطلبات.

---

### التشخيص الحقيقي للبطء (بعد التصحيح)

| السبب | التأثير الفعلي | حقيقي؟ |
|---|---|---|
| `signal` مفقود في `invoke` | تعليق غير محدود عند سوء الشبكة | 🔴 كبير |
| `auth.getUser()` لكل طلب | +150-300ms لكل طلب | 🟠 ملموس |
| `check_rate_limit` تسلسلي | +50-150ms لكل طلب | 🟠 ملموس |
| نمط `auth → rl → عمل` تسلسلي | المجموع 200-450ms ثابت | 🔴 كبير |
| `JSON.stringify` المزدوج | لا تأثير (كاتب كود زائد فقط) | ⚪ كاذب |
| `useFamilyRealtime` يبطل كل الـ queries | عشرات الطلبات المتوازية بعد الرجوع للتاب | 🟡 متوسط |
| `processQueue` تسلسلي + backoff | بطء بعد فشل عنصر واحد | 🟡 متوسط |
| `get-lists` يُرجع كل الأبناء | response حجم كبير على عوائل كثيفة | 🟡 متوسط |

---

### الخطة المُحدَّثة بالأولوية الجديدة

**الأولوية 1 — إصلاحات فورية في `src/lib/api.ts`** (تأثير ضخم، مخاطرة منخفضة)
- ✅ تمرير `signal: controller.signal` لـ `invoke` — لتفعيل الـ 15s timeout فعلاً.
- ✅ التخلص من `JSON.stringify` الزائد (تنظيف، ليس إصلاح).
- ✅ استخراج الـ status من `error.context.status` و `error.context.json()` بدل regex (مع fallback آمن لـ regex).
- ✅ إضافة `Content-Type` فقط إذا الـ body object (تجنّب headers زائدة).

**الأولوية 2 — تخفيف overhead الـ Edge Functions** (يقلّل ~250ms من كل طلب)
إنشاء `supabase/functions/_shared/auth.ts`:
- `verifyJwt(authHeader)` يفك JWT محلياً ويرجع `userId` بدون شبكة (التوقيع موقّع بـ JWT secret المتاح في الـ env). يحتفظ بـ `getUser()` كـ fallback عند الحاجة لبيانات auth إضافية.
- `checkRateLimitAsync(userId, endpoint)` — يُشغّل RPC بـ fire-and-forget، يحدّث counter في الذاكرة محلياً للتقييم السريع.

ثم تعديل تدريجي للـ Edge Functions الأكثر استخداماً (~10 functions: tasks, market, trips, calendar, debts, budget, documents, places, family-management, worship-api) لتستخدم النمط الجديد.

**الأولوية 3 — تخفيف استهلاك الواجهة**
- `useFamilyRealtime`: تقليل `REALTIME_QUERY_KEYS` المستهدفة، invalidate فقط للـ active queries بـ throttle 60s بدل 30s، وتأخير عشوائي 0-5s بعد الرجوع للتاب لمنع موجة الطلبات.
- `processQueue`: استبدال `await setTimeout(delay)` التسلسلي بجدولة العنصر الفاشل بـ `setTimeout` لاحقاً (لا يُجمّد بقية الطابور).
- `useFamilyId`: قراءة Dexie متزامنة عبر `useLiveQuery` بدل `useState + useEffect` (مكسب صغير لكن نظيف).

**الأولوية 4 — تخفيف payloads** (اختياري، لاحق)
- `tasks-api/get-lists` و`market-api/get-lists`: إرجاع القوائم فقط بدون children. الـ items تُجلب lazy عبر `get-items` لكل قائمة عند فتحها.

---

### النتائج المتوقعة بعد أولوية 1+2

| المقياس | قبل | بعد |
|---|---|---|
| طلب نموذجي (p50) | 1.5-3s | 300-600ms |
| طلب على شبكة سيئة | يُعلَّق | 15s timeout يعمل |
| فتح صفحة لأول مرة (cold start مشمول) | 3-5s | 1-1.5s |

---

### الملفات المُعدَّلة

**أولوية 1:** `src/lib/api.ts` فقط.
**أولوية 2:** ملف جديد `supabase/functions/_shared/auth.ts` + 10 ملفات `supabase/functions/*/index.ts` (تعديل النمط).
**أولوية 3:** `src/hooks/useFamilyRealtime.ts`, `src/lib/syncQueue.ts`, `src/hooks/useFamilyId.ts`.

---

### التوصية

ابدأ بـ **أولوية 1 وحدها** (5 دقائق تعديل، خطر شبه صفر). جرّب التطبيق وقِس الفرق. إذا الـ `signal` المفقود كان السبب الأكبر (وأظن نعم بناءً على الأعراض)، ستلاحظ تحسناً فورياً بدون لمس أي Edge Function.

ثم ننتقل لأولوية 2 إذا الحاجة لازالت.

