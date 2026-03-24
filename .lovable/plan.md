

# تحليل الأخطاء في Offline-First Architecture + خطة الإصلاح

## الأخطاء المكتشفة

### خطأ 1 — `useOfflineMutation` يُفعّل `invalidateQueries` حتى في وضع الأوفلاين
عندما المستخدم يضيف شيء وهو أوفلاين، `mutationFn` ترجع `null`. لكن `onSuccess` يشتغل ويستدعي `invalidateQueries` — هذا يُفعّل refetch فوري. الـ refetch يستدعي `syncTable` → API يفشل (أوفلاين) → يرجع البيانات المحلية. لكن عندما يرجع النت، نفس الـ refetch يتكرر ويجلب بيانات السيرفر فقط.

**المشكلة الجوهرية:** `onSuccess` لا يُفرّق بين "نجح فعلاً" و"أُضيف للطابور".

### خطأ 2 — `useOfflineMutation` لا يُحدّث React Query cache مباشرة
الـ Hook يُحدّث IndexedDB فوراً (optimistic) لكن **لا يُحدّث React Query cache**. الشاشة تعتمد على `query.data` من React Query، فلازم ينتظر الـ refetch ليعكس التغيير. هذا يخلق فجوة زمنية حيث البيانات القديمة تظهر.

### خطأ 3 — تعارض زمني عند عودة الاتصال
عندما يرجع النت، يحصل سباق:
1. `processQueue()` يشتغل (لكن TABLE_API_MAP فارغ → العناصر تبقى pending)
2. React Query يعيد الجلب → `syncTable` → API يرجع بيانات السيرفر فقط
3. `bulkPut(serverData)` يُحدّث IndexedDB
4. `table.toArray()` يرجع كل شي (سيرفر + محلي)
5. `projectPendingChanges` المفروض يُسقط العناصر المعلقة...

**لكن:** `setLocalData(filtered)` في `fetchAndSync` يُحدّث الـ state، وبين لحظة الـ `bulkPut` ولحظة `projectPendingChanges`، ممكن يحصل render بالبيانات الناقصة.

### خطأ 4 — `filterFn` غير مُثبّتة (not memoized)
في `MedicationsExample`، الـ `filterFn` هي inline arrow function تتغير كل render. هذا يجعل `readLocal` يُعاد إنشاؤه كل مرة مما يُسبب loops غير ضرورية.

### خطأ 5 — `processQueue` يتكرر بلا فائدة
عند تحميل الصفحة، `processQueue` يشتغل وينتج عشرات التحذيرات لكل عنصر pending لأن TABLE_API_MAP فارغ. هذا مقبول كـ placeholder لكن يجب إيقاف التكرار.

---

## خطة الإصلاح (4 ملفات)

### 1. `src/hooks/useOfflineMutation.ts` — إصلاح جوهري
- **فصل نتيجة المزامنة:** إرجاع object `{ data, queued: boolean }` من `mutationFn`
- **تحديث React Query cache بشكل optimistic** قبل إرسال API: استخدام `qc.setQueryData` لإضافة/حذف/تعديل العنصر في الكاش مباشرة
- **عدم استدعاء `invalidateQueries` إذا كانت العملية queued** — فقط عند نجاح API الحقيقي
- إضافة `onMutate` لـ optimistic cache update مع `onError` rollback

### 2. `src/hooks/useOfflineFirst.ts` — تثبيت القراءة
- تثبيت `readLocal` بإزالة `filterFn` من dependencies (استخدام `useRef` لـ filterFn)
- إضافة `readLocal` بعد كل mutation ناجح عبر تصدير `refreshLocal` callback
- التأكد أن `fetchAndSync` لا يمسح `localData` أبداً — فقط يدمج

### 3. `src/lib/syncQueue.ts` — تقليل الضوضاء
- في `processQueue`: إذا TABLE_API_MAP فارغ لجدول معين، تسجيل تحذير مرة واحدة فقط (باستخدام Set) بدل كل مرة
- إضافة `skipUnmapped` flag لتجاوز الجداول غير المربوطة بصمت

### 4. `src/examples/MedicationsExample.tsx` — تثبيت filterFn
- نقل `filterFn` خارج المكوّن أو لفّها بـ `useCallback` لتجنب إعادة الإنشاء كل render

---

## ملخص التعديلات

```text
useOfflineMutation.ts  →  Optimistic cache update + لا invalidate عند queued
useOfflineFirst.ts     →  تثبيت readLocal + حماية من مسح localData
syncQueue.ts           →  تقليل logs المتكررة
MedicationsExample.tsx →  memoize filterFn
```

لا تعديل على أي صفحة أخرى. لا تعديل على db.ts أو syncManager.ts.

