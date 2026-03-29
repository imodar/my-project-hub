

# إصلاح ترتيب الشاشات بعد تسجيل الدخول — App.tsx

## المشكلة

التسلسل الحالي في `App.tsx` (سطر 233-242):

```text
<BrowserRouter>
  <OfflineBanner />
  <FirstSyncOverlay />    ← خارج WarmCacheProvider
  <ScrollToTop />
  <WarmCacheProvider>     ← يعرض FirstSyncOverlay ثاني كـ fallback
    <AnimatedRoutes />
  </WarmCacheProvider>
  <BottomNav />           ← خارج WarmCacheProvider — يظهر دائماً
</BrowserRouter>
```

النتيجة: بعد تسجيل الدخول، يظهر `BottomNav` + شاشة بيضاء + توست "تم تسجيل الدخول"، ثم بعدها تظهر شاشة "أهلاً بك في عائلي". السبب أن `BottomNav` و`FirstSyncOverlay` الأول خارج `WarmCacheProvider`.

## الحل

ملف واحد: `src/App.tsx`

1. **حذف** `<FirstSyncOverlay />` من سطر 235 — يكفي الذي داخل `WarmCacheProvider`
2. **نقل** `<BottomNav />` إلى **داخل** `WarmCacheProvider` — لا يظهر إلا بعد جاهزية الكاش

```text
<BrowserRouter>
  <OfflineBanner />
  <ScrollToTop />
  <WarmCacheProvider>
    <Suspense fallback={null}>
      <AnimatedRoutes />
    </Suspense>
    <BottomNav />
  </WarmCacheProvider>
</BrowserRouter>
```

النتيجة: أثناء التجهيز يظهر `FirstSyncOverlay` فقط (من داخل `WarmCacheProvider`)، وبعد الجاهزية يظهر المحتوى + `BottomNav` معاً.

