

# خطة: تحسين تحميل الصور والملفات الصوتية في الدردشة

## المشكلة
- الصور والملفات الصوتية تُخزن في bucket خاص (`chat-media`) ورابطها signed URL بتاريخ انتهاء
- عند فتح الدردشة من الكاش (IndexedDB)، الروابط قد تكون منتهية الصلاحية → الصورة لا تظهر
- لا يوجد أي مؤشر تحميل (spinner) أثناء جلب الملفات
- لا يوجد تخزين محلي للملفات نفسها (blobs)

## الحل

### 1. إنشاء hook جديد: `useMediaUrl`
Hook صغير يتعامل مع رابط الوسائط بذكاء:
- يحاول تحميل الرابط الحالي أولاً
- إذا فشل (401/403 = رابط منتهي) → يستخرج الـ `path` من الرابط ويجلب signed URL جديد
- يعرض 3 حالات: `loading` / `ready` / `error`
- يخزن الـ blob في Cache API (`caches.open("chat-media")`) للمرة القادمة

```text
المنطق:
1. تحقق من Cache API أولاً → إذا موجود → أرجع blob URL فوراً
2. إذا لا → حاول fetch الرابط الحالي
3. إذا فشل (expired) → استخرج path + اطلب signed URL جديد
4. خزّن الـ response في Cache API
5. أرجع blob URL
```

### 2. تحديث `ImageBubble` في `Chat.tsx`
- استخدام `useMediaUrl(url)` بدل `src={url}` مباشرة
- عرض spinner (Loader2) أثناء التحميل
- عرض أيقونة خطأ إذا فشل الجلب

### 3. تحديث `VoicePlayer` في `Chat.tsx`
- نفس المنطق: استخدام `useMediaUrl(url)` 
- عرض spinner بدل مشغل الصوت أثناء التحميل

### 4. تحديث الكاش عند جلب رسائل جديدة
- في `useChat.ts` عند تخزين الرسائل في IndexedDB، نحتفظ أيضاً بالـ `storage_path` (نستخرجه من الرابط) لتسهيل إعادة الجلب لاحقاً

## الملفات

| # | الملف | التغيير |
|---|-------|---------|
| 1 | `src/hooks/useMediaUrl.ts` | Hook جديد - Cache API + signed URL refresh |
| 2 | `src/pages/Chat.tsx` | تحديث ImageBubble + VoicePlayer لاستخدام الـ hook |

**2 ملفات، ملف جديد واحد، بدون migration**

