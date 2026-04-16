

# إصلاح بوصلة القبلة على Android

## المشكلة
على Android Chrome، `deviceorientation` يعطي `alpha` نسبي لاتجاه الجهاز عند فتح الصفحة — وليس نسبة للشمال الحقيقي. فقط iOS يوفر `webkitCompassHeading`.

## التعديل
ملف واحد: `src/components/home/QiblaCompass.tsx`

### 1. تعديل useEffect (السطور 71-82)
تسجيل على `deviceorientationabsolute` أولاً، مع fallback على `deviceorientation`:
- إذا وصل `deviceorientationabsolute` → يُستخدم ويُتجاهل `deviceorientation`
- إذا فقط `deviceorientation` وصل → يُستخدم كـ fallback

### 2. تعديل requestPermission (السطور 57-68)
نفس المنطق: عند عدم وجود `requestPermission` (أي ليس iOS)، نسجّل على كلا الـ events بنفس أولوية `absolute` أولاً.

### 3. handleOrientation - بدون تغيير
المعادلة `(360 - e.alpha) % 360` تبقى صحيحة لأن `alpha` من `deviceorientationabsolute` يكون نسبة للشمال الحقيقي.

