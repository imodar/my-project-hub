

# خطة معالجة التقرير الأمني والمعماري

## ملخص التحقق

راجعت الكود وتحققت من النقاط الرئيسية. معظم الملاحظات صحيحة. سأرتب الخطة حسب الأولوية والتأثير الفعلي.

---

## المرحلة 1: إصلاحات أمنية حرجة (P0)

### 1. إضافة `.env` إلى `.gitignore`
- الملف `.gitignore` لا يحتوي على `.env` فعلاً
- سنضيف `.env` و `.env.*` للملف

### 2. مفتاح Supabase مكتوب مباشرة في `client.ts`
- **ملاحظة**: هذا الملف يُولّد تلقائياً من Lovable ولا يمكن تعديله يدوياً. المفتاح المجهول (anon key) مصمم ليكون عاماً أصلاً — الحماية تأتي من RLS. **لن نعدل هذا.**

### 3. التشفير ليس E2EE حقيقي
- **مؤكد**: `useChat.ts` سطر 165-168 يرسل مفتاح AES الخام للسيرفر عبر `exportAESKey()` ثم `upsert-family-key`
- وظائف `wrapFamilyKey()` / `unwrapFamilyKey()` موجودة في `crypto.ts` لكنها لا تُستخدم أبداً
- **الحل**: تطبيق لف ECDH الصحيح — كل عضو يحصل على نسخة ملفوفة بمفتاحه العام
- **ملاحظة**: هذا تغيير معقد يؤثر على `useChat.ts` و `chat-api` Edge Function وقد يكسر التوافقية مع المحادثات الحالية. **يحتاج تخطيط منفصل.**

### 4. فحص عضوية العائلة مفقود في Edge Functions
- إضافة `verifyFamilyMember()` لكل Edge Function تقبل `family_id` (مثل `market-api`, `chat-api`, `budget-api`, إلخ)
- نسخ نفس النمط المستخدم في `tasks-api`

### 5. CSP: إزالة `unsafe-eval`
- تعديل `public/_headers` سطر 19
- إزالة `unsafe-eval` من `script-src` (Vite production لا يحتاجه)
- إبقاء `unsafe-inline` للأنماط فقط

### 6. `verify_jwt = false` على جميع الدوال
- **ملاحظة مهمة**: هذا مقصود في مشاريع Lovable بسبب نظام signing-keys. الدوال تتحقق يدوياً عبر `getUser()`. **لن نعدل هذا** — هو نمط معتمد.

### 7. حل التعارضات كود ميت
- **مؤكد**: `syncManager.ts` سطر 52-53 يعمل `bulkPut()` مباشرة بدون فحص تعارضات
- إضافة استدعاء `isConflicting()` قبل `bulkPut()` أثناء Delta Sync
- عند اكتشاف تعارض: `saveConflict()` بدلاً من الكتابة فوقه

---

## المرحلة 2: إصلاحات متوسطة (P1)

### 8. مسح مفاتيح التشفير عند تسجيل الخروج
- إضافة `indexedDB.deleteDatabase("3ilti-keys")` في `signOut()` بـ `AuthContext.tsx`

### 9. مهلة زمنية لعميل API
- إضافة `AbortController` بمهلة 15 ثانية في `apiClient()` بـ `api.ts`

### 10. معالجة أخطاء IndexedDB QuotaExceeded
- تغليف كتابات Dexie الرئيسية (`bulkPut` في `syncManager.ts` و `fullSync.ts`) بـ try-catch
- عند `QuotaExceededError`: إشعار المستخدم وتنظيف البيانات القديمة

---

## المرحلة 3: تحسينات UX وأداء (P2) — لاحقاً

هذه تحسينات مهمة لكنها ليست عاجلة:
- تحويل صور onboarding لـ WebP
- توحيد مكتبات PDF (jspdf + pdf-lib)
- إضافة `loading="lazy"` للصور في الألبومات
- Virtual list للمحادثة
- حالات فارغة مُصوّرة
- Skeleton loading لكل صفحة

---

## ملاحظات على نقاط **لن نعالجها الآن**

| النقطة | السبب |
|--------|-------|
| `verify_jwt = false` | نمط Lovable المعتمد — التحقق يتم في الكود |
| مفتاح anon في `client.ts` | ملف يُولّد تلقائياً + المفتاح عام بطبيعته |
| إعادة هيكلة `useChat` كاملة | تغيير ضخم يحتاج مرحلة منفصلة |
| E2EE الحقيقي | يحتاج تخطيط migration للمحادثات الحالية |
| ESLint strict | تحسين تدريجي وليس إصلاح أمني |

---

## الملفات المتأثرة في المرحلة 1 و 2

```text
.gitignore                          ← إضافة .env
public/_headers                     ← إزالة unsafe-eval
src/lib/syncManager.ts              ← ربط conflict detection
src/lib/api.ts                      ← إضافة timeout
src/contexts/AuthContext.tsx         ← مسح مفاتيح التشفير
src/lib/fullSync.ts                 ← معالجة QuotaExceeded
supabase/functions/market-api/      ← إضافة verifyFamilyMember
supabase/functions/chat-api/        ← إضافة verifyFamilyMember
supabase/functions/budget-api/      ← إضافة verifyFamilyMember
supabase/functions/calendar-api/    ← إضافة verifyFamilyMember
supabase/functions/debts-api/       ← إضافة verifyFamilyMember
supabase/functions/documents-api/   ← إضافة verifyFamilyMember
supabase/functions/albums-api/      ← إضافة verifyFamilyMember
supabase/functions/trips-api/       ← إضافة verifyFamilyMember
supabase/functions/health-api/      ← إضافة verifyFamilyMember
supabase/functions/places-api/      ← إضافة verifyFamilyMember
supabase/functions/vehicles-api/    ← إضافة verifyFamilyMember
supabase/functions/will-api/        ← إضافة verifyFamilyMember
supabase/functions/worship-api/     ← إضافة verifyFamilyMember
supabase/functions/zakat-api/       ← إضافة verifyFamilyMember
```

---

## ترتيب التنفيذ المقترح

1. `.gitignore` + CSP (5 دقائق)
2. API timeout (10 دقائق)
3. مسح مفاتيح التشفير عند الخروج (5 دقائق)
4. ربط conflict detection بـ syncManager (20 دقيقة)
5. معالجة QuotaExceeded (10 دقائق)
6. إضافة verifyFamilyMember لجميع Edge Functions (30 دقيقة)

هل توافق على هذه الخطة؟ يمكنني البدء بالمرحلة 1 و 2 مباشرة.

