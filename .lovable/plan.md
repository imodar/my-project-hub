

# خطة الإصلاحات الشاملة — محدّثة (3 مراحل + Capacitor)

كل ما في المراحل 1-3 تم تنفيذه مسبقاً. المتبقي هو تحديث `capacitor.config.ts` + توثيق تعديلات Android النيتف.

---

## ما تم تنفيذه (مكتمل)

- Eager imports للصفحات الخمس الرئيسية
- Suspense fallback مرئي
- DOMPurify
- tasks-api يحدّث `updated_at` عند تغيير items
- Realtime channels في useMarketLists و useTaskLists
- Exponential backoff في syncQueue
- staleTime لـ useMyRole → ساعة

---

## المتبقي — تحديث Capacitor config

### الملف: `capacitor.config.ts`

تحديث الـ config ليشمل إعدادات Android و SplashScreen:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d0479375ab8c489586c045a5df6d51d8',
  appName: 'منظم العائلة',
  webDir: 'dist',
  server: {
    url: 'https://d0479375-ab8c-4895-86c0-45a5df6d51d8.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    backgroundColor: '#FFFFFF',
    captureInput: true,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#FFFFFF',
    scrollEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#FFFFFF',
      androidSplashResourceName: 'splash',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
```

### ملاحظة: `appId`

الـ `appId` يبقى كما هو (`app.lovable.d0479375...`). إذا كنت تريد تغييره لـ `com.aelati.app`، أخبرني وسأحدّثه — لكن تغيير الـ ID يعني أن أي نسخة منشورة سابقاً ستُعتبر تطبيق مختلف.

---

## تعديلات Android النيتف (تُطبَّق محلياً على جهازك)

هذه التعديلات لا يمكن تطبيقها من Lovable لأن مجلد `android/` يُنشأ محلياً بعد `npx cap add android`.

### بعد `npx cap add android`، عدّل:

**الملف:** `android/app/src/main/res/values/styles.xml`
```xml
<style name="AppTheme" parent="Theme.AppCompat.NoActionBar">
    <item name="android:windowBackground">@color/white</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
    <item name="android:navigationBarColor">@android:color/transparent</item>
    <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
</style>
```

**الملف:** `android/app/src/main/java/.../MainActivity.java`
- تأكد أن لا يوجد `SYSTEM_UI_FLAG_IMMERSIVE` أو `SYSTEM_UI_FLAG_HIDE_NAVIGATION`
- Capacitor الافتراضي لا يضيفها، لكن إذا وجدتها احذفها

### الخطوات على جهازك بعد التنفيذ:
```bash
git pull
npm install
npx cap add android    # إذا لم يُضَف مسبقاً
npx cap sync android
# عدّل styles.xml يدوياً
npx cap run android
```

---

## ملخص

| التغيير | أين يُطبَّق | من Lovable؟ |
|---------|------------|------------|
| `capacitor.config.ts` — android/ios/plugins | المشروع | ✅ نعم |
| `styles.xml` — شفافية navigation bar | محلي | ❌ يدوي |
| `MainActivity.java` — حذف immersive flags | محلي | ❌ يدوي |

