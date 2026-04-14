

# خطة شاملة لإصلاح جميع النقاط القابلة للحل

---

## ملخص سريع

بعد مراجعة الكود الفعلي، عدد من نقاط التقرير **خاطئة أو مبالغ فيها** (كما ناقشنا سابقاً). هذه الخطة تغطي فقط النقاط **الحقيقية والقابلة للتنفيذ**.

> **خطأ calendar-api 401**: هذا ليس خطأ برمجي — الكود يتحقق من JWT بشكل صحيح. السبب غالباً جلسة منتهية الصلاحية أو مشكلة اتصال. يُحل بتسجيل خروج وإعادة دخول.

---

## الإصلاح 1: تسريب ذاكرة ObjectURL في useMediaUrl

**الملف:** `src/hooks/useMediaUrl.ts`

**المشكلة:** كل `URL.createObjectURL(blob)` لا يتم تحريره عند تغيّر الـ URL أو عند unmount.

**الحل:**
- حفظ الـ URL الحالي في `useRef`
- في cleanup function الخاصة بـ `useEffect`: استدعاء `URL.revokeObjectURL(ref.current)` لتحرير الذاكرة
- تحرير الـ URL القديم قبل تعيين الجديد

```text
useEffect cleanup:
  if (urlRef.current) URL.revokeObjectURL(urlRef.current)
```

---

## الإصلاح 2: Race Condition في إنشاء القوائم الافتراضية

**الملفات:** `Tasks.tsx`, `Market.tsx`, `Documents.tsx`

**المشكلة:** `createdDefaultListRef.current = familyId` يُنفذ **قبل** نجاح الـ mutation — فإذا فشلت العملية لا يُعاد المحاولة.

**الحل:** في الثلاث صفحات:
- نقل `createdDefaultListRef.current = familyId` من **قبل** `mutate()` إلى داخل `onSuccess`
- إبقاء فحص `createListMutation.isPending` لمنع التكرار أثناء التنفيذ

```text
قبل:
  createdDefaultListRef.current = familyId;
  createListMutation.mutate({...}, { onError: () => { ref = null } });

بعد:
  if (createListMutation.isPending) return;
  createListMutation.mutate({...}, {
    onSuccess: () => { createdDefaultListRef.current = familyId; },
  });
```

---

## الإصلاح 3: إضافة `.env` إلى `.gitignore`

**الملف:** `.gitignore`

**المشكلة:** `.env` غير موجود في `.gitignore`

**الحل:** إضافة:
```
.env
.env.*
!.env.example
```

> ملاحظة: المفاتيح الموجودة هي `anon key` العامة — ليست سرية. لكن كإجراء وقائي يُضاف `.env` للـ gitignore.

---

## الإصلاح 4: إزالة `unsafe-eval` من CSP (إذا كان موجوداً)

**الملف:** `public/_headers`

**الحالة:** بعد المراجعة، **`unsafe-eval` غير موجود أصلاً** في CSP الحالي. فقط `unsafe-inline` موجود وهو مطلوب للأنماط. **لا حاجة لتغيير.**

---

## الإصلاح 5: مسح مفاتيح التشفير عند تسجيل الخروج

**الملف:** `src/contexts/AuthContext.tsx`

**الحالة:** بعد المراجعة، **هذا مُنفّذ فعلاً** في السطر 209:
```ts
try { indexedDB.deleteDatabase("3ilti-keys"); } catch {}
```
**لا حاجة لتغيير.**

---

## الإصلاح 6: فحص عضوية العائلة في Edge Functions

**الحالة:** بعد فحص جميع الـ 14 Edge Function، **جميعها تحتوي `verifyFamily()` بالفعل.** التقرير كان خاطئاً في هذه النقطة. **لا حاجة لتغيير.**

---

## الإصلاح 7: معالجة خطأ QuotaExceeded

**الملف:** `src/lib/syncManager.ts`

**الحالة:** بعد المراجعة، **هذا مُنفّذ فعلاً** في السطور 85-92 مع `QuotaExceededError` handling و `storage-quota-exceeded` event. **لا حاجة لتغيير.**

---

## الإصلاح 8: API Timeout

**الملف:** `src/lib/api.ts`

**الحالة:** بعد المراجعة، **هذا مُنفّذ فعلاً** — `AbortController` بمهلة 15 ثانية (السطور 9, 45-46). **لا حاجة لتغيير.**

---

## الإصلاح 9: ربط Conflict Detection بـ syncManager

**الملف:** `src/lib/syncManager.ts`

**الحالة:** بعد المراجعة، **هذا مُنفّذ فعلاً** — السطور 46-71 تفحص `isConflicting()` وتستدعي `saveConflict()`. **لا حاجة لتغيير.**

---

## ملخص ما يحتاج فعلاً للتنفيذ

| # | الإصلاح | الملفات | الصعوبة |
|---|---------|---------|---------|
| 1 | تسريب ObjectURL | `useMediaUrl.ts` | منخفضة |
| 2 | Race Condition للقوائم الافتراضية | `Tasks.tsx`, `Market.tsx`, `Documents.tsx` | منخفضة |
| 3 | إضافة `.env` لـ `.gitignore` | `.gitignore` | منخفضة |

**3 إصلاحات فقط من أصل 9** تحتاج تنفيذ فعلي — الباقي إما مُنفّذ مسبقاً أو التقرير كان خاطئاً بشأنه.

---

## تحسينات إضافية (ليست أخطاء لكن مفيدة)

هذه من النقاط التي ناقشناها سابقاً وأكدنا صحتها:

### تحسين 1: React.memo للمكونات الثقيلة
- **الملفات:** `HeroSection.tsx`, `FeatureGrid.tsx`, `BottomNav.tsx`
- لف كل مكون بـ `React.memo()` لمنع إعادة الرسم غير الضرورية

### تحسين 2: Empty States مصوّرة
- **الملفات:** كل صفحات القوائم (Tasks, Market, Documents, Calendar, etc.)
- إنشاء مكون `<EmptyState icon message action />` عام واستخدامه

### تحسين 3: تحسين Skeleton Loading
- استخدام `PageSkeletons.tsx` الموجود فعلاً في كل الصفحات بدل spinner البسيط

---

## ترتيب التنفيذ

1. إصلاح تسريب ObjectURL (5 دقائق)
2. إصلاح Race Condition في 3 ملفات (10 دقائق)
3. إضافة `.env` لـ `.gitignore` (دقيقة واحدة)
4. React.memo للمكونات الثقيلة (10 دقائق)

هل توافق على تنفيذ هذه الخطة؟

