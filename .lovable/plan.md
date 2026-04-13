

# خطة شاملة لإصلاح 13 مشكلة

## الملفات المتأثرة
- `index.html` — إضافة لون خلفية أولي لمنع الشاشة البيضاء
- `src/pages/Auth.tsx` — كيبورد أرقام للهاتف و OTP
- `src/pages/Documents.tsx` — حذف البحث، نقل 3 نقاط، حذف بار الإحصائيات، فتح على أول كاتيغوري
- `src/pages/Chat.tsx` — progress bar للتشفير، مسافة أمان لآخر رسالة
- `src/hooks/useChat.ts` — تحسين مراحل تحميل التشفير
- `src/pages/Map.tsx` — حجب الصفحة بطلب تفعيل اللوكيشن
- `src/pages/Medications.tsx` + `src/hooks/useMedications.ts` — مراجعة منطق الأوفلاين
- `src/pages/FamilyManagement.tsx` + `src/hooks/useFamilyMembers.ts` — عدم عرض بيانات حتى التحقق من السيرفر
- `src/components/PermissionsScreen.tsx` (جديد) — شاشة طلب صلاحيات بعد المزامنة الأولى
- `src/App.tsx` — إضافة مسار شاشة الصلاحيات

---

### 1. الشاشة البيضاء عند فتح التطبيق
**ملف:** `index.html`
- إضافة `style="background-color: hsl(222.2, 84%, 4.9%)"` على `<body>` (لون الـ dark theme)
- إضافة inline CSS في `<div id="root">` بنفس اللون

### 2. كيبورد أرقام في شاشة الهاتف
**ملف:** `src/pages/Auth.tsx`
- Input الهاتف (سطر ~226-238): إضافة `pattern="[0-9]*"` مع الحفاظ على `inputMode="numeric"` و `type="tel"`

### 3. كيبورد أرقام في شاشة OTP
**ملف:** `src/pages/Auth.tsx`
- InputOTP (سطر ~324): التأكد من وجود `inputMode="numeric"` — موجود بالفعل، لكن يجب إضافة `pattern="[0-9]*"` على كل slot إذا أمكن أو على InputOTP wrapper

### 4. فتح الوثائق على أول كاتيغوري (هوية)
**ملف:** `src/pages/Documents.tsx`
- تغيير `activeCategory` initial state من `null` إلى `"identity"`

### 5. حذف بار البحث
**ملف:** `src/pages/Documents.tsx`
- حذف الكود بين سطر ~840-851 (البحث)
- إبقاء `searchQuery` كـ `""` دائماً أو حذف المتغير

### 6. نقل زر 3 نقاط إلى الهيدر
**ملف:** `src/pages/Documents.tsx`
- إضافة أيقونة `MoreVertical` كـ action ثاني في `PageHeader.actions[]` بجانب زر `+`
- الزر يفتح `setShowListActions(true)` (نفس الوظيفة الحالية)

### 7. حذف بار الإحصائيات
**ملف:** `src/pages/Documents.tsx`
- حذف الكود بين سطر ~796-816 (Stats bar مع عدد المستندات و MoreVertical)

### 8. شاشة طلب الصلاحيات بعد المزامنة الأولى
**ملف جديد:** `src/components/PermissionsScreen.tsx`
- شاشة جميلة تطلب إذن الإشعارات (`Notification.requestPermission()`) والموقع (`Geolocation`)
- تظهر مرة واحدة بعد `first_sync_done` وقبل الدخول للتطبيق
- تُخزن `permissions_requested` في `localStorage`

**ملف:** `src/App.tsx`
- إضافة route `/permissions` بعد `first_sync_done`
- في `FirstSyncOverlay.onInitialSyncReady`: التحقق من `permissions_requested` وتوجيه المستخدم

### 9. حجب شاشة الخريطة بدون إذن اللوكيشن
**ملف:** `src/pages/Map.tsx`
- إضافة فحص `navigator.permissions.query({ name: "geolocation" })` عند فتح الصفحة
- إذا كان الإذن `denied` أو `prompt`: عرض overlay مهذب يطلب التفعيل
- على Capacitor: محاولة استدعاء `Geolocation.requestPermissions()` مباشرة

### 10. Progress bar بدل "تجهيز التشفير"
**ملف:** `src/pages/Chat.tsx` + `src/hooks/useChat.ts`
- إضافة state للـ progress في `useChat`: مراحل (تحميل مفاتيح → تهيئة تشفير → جلب رسائل)
- عرض `Progress` component بدل النص الثابت مع وصف المرحلة الحالية
- عرض الرسائل المخبأة فوراً (موجود) مع progress للجلب من السيرفر

### 11. مسافة أمان بين آخر رسالة وبوكس الكتابة
**ملف:** `src/pages/Chat.tsx`
- تغيير `pb-28` في div الرسائل (سطر ~412) إلى `pb-40` أو أكثر لضمان مسافة كافية

### 12. مشكلة الأدوية 409 والأوفلاين
**ملف:** `src/hooks/useMedications.ts`
- `addLog`: إضافة فحص أن الدواء موجود بالسيرفر قبل إرسال الطلب
- إذا كان الدواء أوفلاين فقط: تخزين اللوغ محلياً فقط بدون إرسال للسيرفر
- تعديل المنطق ليكون truly offline-first: اللوغ يُسجل محلياً أولاً ويُزامن لاحقاً

**ملف:** `src/pages/Medications.tsx`
- عدم عرض خطأ 409 للمستخدم — معالجته صامتاً مع retry تلقائي

### 13. شاشة /family — عرض أسماء خاطئة مؤقتاً
**ملف:** `src/hooks/useFamilyMembers.ts`
- تغيير المنطق: عدم استخدام `placeholderData` من Dexie إلا إذا كانت البيانات المحلية تحتوي أسماء حقيقية (ليست "عضو" أو ROLE_LABELS)
- إذا كانت الأسماء المحلية هي fallback names فقط: عرض skeleton/loading حتى يرد السيرفر

**ملف:** `src/pages/FamilyManagement.tsx`
- إضافة حالة loading حتى يتم التحقق من السيرفر فعلاً

---

## ترتيب التنفيذ
1. إصلاحات سريعة: #1, #2, #3, #4, #5, #7, #11 (تغييرات بسيطة)
2. إصلاحات متوسطة: #6, #9, #12, #13
3. إصلاحات كبيرة: #8, #10

