

# خطة: عرض جميع أفراد العائلة فوراً في الخريطة

## المشكلة
`useLocationTracking` يجلب البيانات فقط من `location-api` (السيرفر). الأعضاء الذين ليس لهم سجل في جدول `member_locations` لا يظهرون أبداً. لذلك يظهر عضو واحد فقط بدل 3.

## الحل
دمج بيانات الأعضاء المحلية (من Dexie عبر `useFamilyMembers`) مع بيانات المواقع من السيرفر. الأعضاء يظهرون فوراً في الـ Bottom Sheet، والموقع يُحمّل من السيرفر مع spinner.

```text
فتح الخريطة
  ├─ فوراً: عرض 3 أعضاء من Dexie (بدون إحداثيات)
  └─ بعد fetch: دمج الإحداثيات مع الأسماء
```

## التغييرات

### 1. `src/pages/Map.tsx`
- استدعاء `useFamilyMembers({ excludeSelf: false })` للحصول على كل الأعضاء فوراً
- دمج `members` مع `locations` من `useLocationTracking`:
  - لكل عضو محلي: إذا عنده location → استخدمها، وإلا → أظهره بدون إحداثيات (`lat: 0, lng: 0, is_sharing: false`)
- تمرير القائمة المدمجة إلى `MemberSheet` و `FamilyMap`

### 2. `src/components/map/MemberSheet.tsx`
- إضافة حالة "جاري التحميل" لكل عضو ليس عنده إحداثيات بعد:
  - إذا `isLoading` (من useLocationTracking) وعضو بدون lat/lng → عرض `Loader2` spinner بدل أيقونة الموقع
  - إذا انتهى التحميل وعضو بدون lat/lng → عرض "لا يوجد موقع"
- تمرير `isLoading` كـ prop جديد

### 3. `src/components/map/FamilyMap.tsx`
- بدون تغيير جوهري — `allWithCoords` filter الموجود يتجاهل الأعضاء بدون إحداثيات تلقائياً (الماركرات تظهر فقط للي عندهم موقع)

## الملفات

| # | الملف | التغيير |
|---|-------|---------|
| 1 | `src/pages/Map.tsx` | استدعاء `useFamilyMembers` + دمج مع locations |
| 2 | `src/components/map/MemberSheet.tsx` | إضافة prop `isLoading` + spinner لكل عضو بدون موقع |

**2 ملفات، بدون migration، بدون ملفات جديدة**

