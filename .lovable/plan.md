

# إصلاح مشاكل رفع الملفات على الموبايل

## المشاكل والحلول

### 1. إزالة setTimeout من click()
- استدعاء `fileInputRef.current?.click()` مباشرة بدون `setTimeout`
- إذا كان الـ sheet مفتوح، نغلقه بعد فتح الـ picker وليس قبله، أو نستخدم طريقة بديلة لا تكسر الـ user gesture chain

### 2. تأخير مسح input.value
- نقل `input.value = ""` إلى ما بعد الانتهاء الكامل من معالجة الملف (بعد القص/الرفع) بدل مسحه فوراً

### 3. إخفاء الـ input بـ CSS بديل
- استبدال `className="hidden"` بـ:
```
className="absolute w-0 h-0 opacity-0 overflow-hidden"
```

## الملف المتأثر
- `src/pages/Documents.tsx`

