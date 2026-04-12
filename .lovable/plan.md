

# إضافة توستات تشخيصية لتتبع مسار رفع الصورة على Capacitor

## المشكلة
بعد اختيار الصورة على Capacitor (Android)، لا يحدث شيء. يعمل بشكل طبيعي في المتصفح على الكمبيوتر وعلى الموبايل.

## السبب المحتمل الأقوى
على Capacitor WebView، حدث `onChange` على `<input type="file">` قد لا يُطلق بنفس الطريقة، أو أن `File` object يكون فارغاً/null. كذلك `getCroppedImg` يستخدم `crossOrigin = "anonymous"` على blob URL وهذا قد يفشل صامتاً على WebView.

## الخطة: إضافة توستات debug في كل نقطة حرجة

### الملف: `src/pages/Documents.tsx`

**1. عند استدعاء `openFilePicker`** (سطر ~350):
```
appToast.info("DEBUG: openFilePicker called", mode);
```

**2. عند بداية `handleFileSelected`** (سطر ~439):
```
appToast.info("DEBUG: handleFileSelected triggered");
```
- ثم بعد قراءة الملف: اسم الملف، نوعه، حجمه
- إذا لم يوجد ملف: توست خطأ

**3. عند إنشاء blob URL للكروب** (سطر ~472):
```
appToast.info("DEBUG: Image preview created", previewUrl);
```

**4. عند ضبط `uploadOverlay` بحالة cropping** (سطر ~477):
```
appToast.info("DEBUG: Crop overlay set");
```

**5. عند بداية `startUpload`** (سطر ~376):
```
appToast.info("DEBUG: startUpload called");
```

**6. عند بداية `confirmCrop`** (سطر ~504):
```
appToast.info("DEBUG: confirmCrop called");
```

**7. في `getCroppedImg`** — إضافة try/catch حول تحميل الصورة مع توست:
```
appToast.info("DEBUG: getCroppedImg loading image");
// وفي حالة الخطأ:
appToast.error("DEBUG: Image load failed in getCroppedImg");
```

**8. إضافة listener على input `click` event** للتأكد أنه فعلاً يُنقر:
```
appToast.info("DEBUG: file input click event fired");
```

## ملاحظة مهمة
هذه التوستات مؤقتة للتشخيص فقط. بعد تحديد المشكلة سنزيلها ونطبق الإصلاح الفعلي.

## التعديلات
- ملف واحد فقط: `src/pages/Documents.tsx`

