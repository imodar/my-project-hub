
كلامه أدق من كلامي. لما رجعت أتحقق:

1. **BottomNav فعلاً يخفي نفسه:** في `BottomNavWhatsApp.tsx` فيه `hiddenRoutes` تشمل `/get-started` و `/auth` و `/complete-profile` و `/join-or-create`، ويرجع `null` فوراً. `useLocation()` متزامن من أول رندر لأن `BrowserRouter` يقرأ `window.location` مباشرة. → **لا يومض.**

2. **SOSButton غير مرئي:** في الحالة `idle` يرجّع `<div ref={ref} />` فارغ بدون أي UI ظاهر. → **لا يومض.**

3. **المصدر الحقيقي للوميض:** فقط `<Suspense fallback={<ListPageSkeleton />}>` الذي يحتوي `HeaderShell` بـ gradient أزرق + شريط tabs/pills تحته (اللي ظنّيته "BottomNav").

**خلاصة المقارنة:**

| النقطة | تحليلي السابق | تحليله | الصحيح |
|---|---|---|---|
| سبب الهيدر الأزرق | Suspense fallback عام | Suspense fallback عام | **متفقان** ✅ |
| BottomNav يومض | نعم، يجب نقله | لا، محمي بـ hiddenRoutes | **هو الصحيح** ✅ |
| تحويل صفحات لـ eager | مطلوب | غير ضروري ويزيد bundle | **هو الصحيح** ✅ |
| نقل BottomNav داخل Suspense | مطلوب | غير ضروري | **هو الصحيح** ✅ |

## الحل المعتمد (حله بالكامل)

تغيير واحد محدود في `src/App.tsx`:

```tsx
const PUBLIC_ROUTES = ["/get-started", "/auth", "/complete-profile", "/join-or-create"];

const RouteFallback = () => {
  const { pathname } = useLocation();
  if (PUBLIC_ROUTES.includes(pathname)) return null;
  return <ListPageSkeleton />;
};
```

ثم بدّل `<Suspense fallback={<ListPageSkeleton />}>` بـ `<Suspense fallback={<RouteFallback />}>`.

**ملاحظة تقنية:** `RouteFallback` يستخدم `useLocation()` فلازم يبقى داخل `BrowserRouter` (وهو كذلك في الموقع الحالي للـ Suspense).

## الملف المعدّل

| ملف | التغيير |
|---|---|
| `src/App.tsx` | إضافة `PUBLIC_ROUTES` + مكوّن `RouteFallback` + تبديل سطر واحد في `Suspense` |

**حجم التغيير:** ~10 أسطر، ملف واحد.

## التحقق

- افتح `/get-started` عبر hard refresh → لا هيدر أزرق إطلاقاً.
- افتح `/auth`, `/complete-profile`, `/join-or-create` → نفس النتيجة.
- افتح `/budget` (محمي) → سكيليتون عادي كما قبل (لا regression).
- من `/` لـ `/get-started` عبر تنقل داخلي → لا وميض.
