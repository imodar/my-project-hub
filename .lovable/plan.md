

## خطة إصلاح رفع الملفات في صفحة المستندات

### المشاكل
1. مسار الرفع بدون `familyId/` → RLS يرفض الرفع
2. fallback base64 غير عملي ويجب إزالته
3. `useMediaUrl` مقيد بـ `chat-media` فقط → لا يعمل مع المستندات
4. لا يوجد تخزين مؤقت محلي → الملفات لا تفتح أوفلاين

### التعديلات

#### 1. `src/pages/Documents.tsx`
- استيراد `useFamilyId` واستخراج `familyId`
- تغيير مسار الرفع من `${fileId}.${ext}` إلى `${familyId}/${fileId}.${ext}`
- إزالة fallback base64 بالكامل واستبداله بـ toast خطأ
- بعد رفع ناجح: تخزين الـ blob في Cache API (`documents-cache-v1`) للأوفلاين
- عند عرض ملف: التحقق من الكاش أولاً قبل الشبكة

#### 2. `src/hooks/useMediaUrl.ts`
- إضافة معامل `bucket` اختياري (افتراضي `chat-media`)
- تعميم `extractStoragePath` ليقبل أي اسم حاوية
- تعميم `createSignedUrl` ليستخدم الحاوية الممررة
- تحديث اسم الكاش ليشمل الحاوية: `${bucket}-cache-v1`

#### 3. `src/pages/Documents.tsx` (عرض الملفات)
- استخدام `useMediaUrl` المعدّل مع `bucket: "documents"` عند فتح/عرض الملفات
- هذا يضمن: كاش محلي + تجديد تلقائي للروابط المنتهية

### ملاحظات
- صلاحيات Android سليمة، لا تحتاج تعديل
- نستخدم `familyId` (وليس `userId`) لأن الوثائق مشتركة عائلياً
- سياسة RLS permissive تقبل كلا المسارين لكن `familyId` هو الصحيح معمارياً

