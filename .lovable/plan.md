
بعد مراجعة `src/pages/Documents.tsx` و `src/components/FAB.tsx` و `src/lib/haptics.ts` و `supabase/functions/documents-api/index.ts`:

1) ما هو صحيح فعلاً الآن
- يوجد haptic قبل فتح الـ file picker في مسار "إضافة مستند جديد":
  - `src/components/FAB.tsx:25-31` يستدعي `haptic.medium()` قبل `onClick`
  - `src/pages/Documents.tsx:854` يستدعي `haptic.medium(); openFilePicker("new")`
  هذا يعني أن مسار الرفع الجديد يمر فعلاً عبر side effects قبل `input.click()`, وهو مرشح قوي للمشكلة على الموبايل.
- `progressInterval` قد لا يُحذف عند exception:
  - `src/pages/Documents.tsx:353-402`
  لأن `clearInterval()` ليس داخل `finally`.
- يوجد تسرب في `URL.createObjectURL`:
  - يتم الإنشاء في `handleFileSelected` و `startUpload` و `confirmCrop`
  - الإلغاء ينظف جزئياً، لكن النجاح و unmount لا يغطيان كل الحالات.
- `fullPreviewDoc` مخزن كـ snapshot object:
  - `src/pages/Documents.tsx:231` و `1071+`
  وهذا يجعل الـ preview الكامل يعرض بيانات قديمة بعد التعديل أو الإرفاق.
- `filteredItems` محسوب خارج `useMemo`:
  - `src/pages/Documents.tsx:280-295`
  فتصير إعادة الحساب شبه دائمة.
- الـ signed URL صلاحيته سنة:
  - `src/pages/Documents.tsx:383-387`
  وهذا فعلاً غير مناسب لوثائق حساسة.

2) ما هو صحيح جزئياً لكن الوصف الحالي ليس دقيقاً
- مشكلة `haptic.medium()`:
  - الوصف يقول إنه Capacitor async bridge. هذا غير مطابق للكود الحالي؛ `src/lib/haptics.ts` يستخدم `navigator.vibrate()` فقط.
  - لكن النتيجة العملية ما زالت صحيحة: الأفضل ألا يسبق أي haptic فتح الـ picker إطلاقاً، خاصة مع وجود haptic مزدوج من `FAB` + `Documents`.
- مشكلة `activeListId`:
  - `useEffect` الحالي (`219-228`) ليس "يعيد الضبط دائماً عند كل refetch"، لكنه هشّ ويحتاج تثبيت أفضل لاختيار القائمة والحفاظ على الاختيار الحالي.
- مشكلة `confirmUpload`:
  - ليست stale closure بالمعنى المذكور، لأن `useCallback` يعاد إنشاؤه مع تغير `activeListId`.
  - المشكلة الأدق: المستند الجديد يعتمد على `activeListId` الحالي وقت التأكيد، وليس على القائمة التي بدأ منها تدفق الرفع. الأفضل تجميد `targetListId` داخل upload state من البداية.

3) ما هو غير صحيح أو قديم في القائمة
- `setTimeout` حول `click()`:
  - لم يعد موجوداً. `openFilePicker` الحالي (`337-347`) يستدعي `fileInputRef.current?.click()` مباشرة.
  - واقتراح `requestAnimationFrame` ليس بديلاً آمناً هنا لأنه async أيضاً ويخرج من نفس user gesture chain.
- `input.value = ""` قبل قراءة الملف:
  - هذه لم تعد موجودة. `handleFileSelected` (`406-411`) لا يمسح القيمة مبكراً.
- `className="hidden"`:
  - لم يعد موجوداً. الإدخال الحالي (`1409-1415`) مخفي بـ `absolute w-0 h-0 opacity-0 overflow-hidden`.
  - لكن ما زال من الممكن تحسينه أكثر لصيغة off-screen 1px لأن الإخفاء الصفري قد يبقى حساساً على بعض WebViews.
- `renderItem` / `renderCategoryForm`:
  - هذه ملاحظة جودة كود فقط، والسبب المذكور عن unmount/remount غير دقيق.

4) الاستنتاج الأقرب لسبب المشكلة الحالية
الأسباب الأقوى المتبقية في الكود الحالي ليست `setTimeout` ولا `hidden` ولا المسح المبكر، بل:
- وجود haptic قبل `click()` في مسار FAB الجديد، ومضاعف مرتين.
- إغلاق الـ sheet في attach mode قبل `click()` (`341-343`) ويُفضّل إعادة ترتيب هذا المسار احتياطياً.
- أسلوب إخفاء input الحالي ما زال صفري الأبعاد، ويمكن تقويته إلى off-screen invisible element.

5) خطة الإصلاح المقترحة
المرحلة 1 — إصلاح picker على الموبايل أولاً
- إزالة أي haptic قبل `fileInputRef.current?.click()` في مسار الوثائق:
  - من `Documents.tsx`
  - ومن `FAB.tsx` لهذا الاستخدام تحديداً عبر prop لتعطيل haptic أو مسار خاص لفتح picker
- إبقاء `click()` مباشراً في نفس stack بدون `setTimeout` وبدون `requestAnimationFrame`
- في attach mode: تنفيذ `click()` أولاً، ثم إغلاق الـ sheet بعده أو بعد بدء `onChange`
- استبدال إخفاء input الحالي بصيغة off-screen أكثر أماناً:
```ts
style={{
  position: "fixed",
  top: "-1000px",
  left: "-1000px",
  width: "1px",
  height: "1px",
  opacity: 0,
  pointerEvents: "none",
}}
```

المرحلة 2 — تثبيت دورة الرفع والتنظيف
- وضع `clearInterval` داخل `finally`
- إضافة cleanup موحد لكل `previewUrl`:
  - عند cancel
  - عند success
  - عند استبدال preview أثناء crop/upload
  - عند unmount
- إبقاء `input.value = ""` فقط بعد اكتمال/إلغاء/فشل المسار بشكل آمن

المرحلة 3 — تثبيت الحالة والمنطق
- استبدال منطق `activeListId` الحالي بمنطق initialization + existence check حتى لا يتدخل عند refetch بلا داعٍ
- حفظ `targetListId` داخل `uploadOverlay` من لحظة فتح picker بدل الاعتماد على `activeListId` وقت التأكيد
- تحويل `fullPreviewDoc` من object إلى `id` ثم اشتقاقه من البيانات الحية

المرحلة 4 — تحسينات الأمان والأداء
- تقليل signed URL من سنة إلى مدة قصيرة
- إضافة helper لتجديد الرابط قبل الفتح/المشاركة عند الحاجة
- نقل `filteredItems` إلى `useMemo`
- تأجيل ملاحظات الـ typing والتنظيم الداخلي إلى آخر مرحلة لأنها ليست سبب العطل الحالي

6) التنفيذ الذي أوصي به أولاً
إذا وافقت، أنفذها على دفعتين:
- دفعة 1: إصلاح picker الفعلي على الموبايل (`haptic` + ترتيب attach mode + input style)
- دفعة 2: cleanup/state/security (`object URLs` + interval + preview/live state + URL expiry)

بهذا سنعالج أولاً السبب الأكثر احتمالاً للمشكلة الحالية، ونترك البنود القديمة أو غير الدقيقة خارج مسار التشخيص الأساسي.
