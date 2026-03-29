

# تسريع fullSync — من تسلسلي إلى متوازي

## الملخص
ملف واحد: `src/lib/fullSync.ts` — تحويل الـ loop من `for...await` إلى `Promise.allSettled` مع `map`.

## التغيير
استبدال الـ `for` loop بـ `Promise.allSettled(SYNC_STEPS.map(...))` كما في المقترح بالضبط:
- متغير `completed` يزيد مع كل جدول ينتهي
- `onProgress` يتحدث بعد كل جدول
- الأخطاء لا توقف الباقي (بفضل `allSettled`)

## النتيجة المتوقعة
من ~7.5 ثانية إلى ~1-1.5 ثانية.

