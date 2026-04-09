

# إصلاح خطأ بناء RevenueCat: jvmTarget = 21

## المشكلة
مكتبة `@revenuecat/purchases-capacitor` تتطلب `jvmTarget = 21` لكن Kotlin الافتراضي في Capacitor لا يدعمه.

## الحل
إضافة خطوة في `build-apk.yml` بعد `cap add android` (سطر 38) وقبل `cap sync` (سطر 41) لتعديل ملفات Gradle تلقائياً.

## التعديل: `.github/workflows/build-apk.yml`

إضافة خطوة جديدة بين "Add Android platform" و "Sync web build":

```yaml
- name: Fix Kotlin/JVM target for RevenueCat
  run: |
    # Upgrade Kotlin to 2.0.21
    sed -i "s/ext.kotlin_version = .*/ext.kotlin_version = '2.0.21'/" android/build.gradle
    
    # Add compileOptions + kotlinOptions to app/build.gradle
    sed -i '/android {/a \
        compileOptions {\
            sourceCompatibility JavaVersion.VERSION_21\
            targetCompatibility JavaVersion.VERSION_21\
        }\
        kotlinOptions {\
            jvmTarget = "21"\
        }' android/app/build.gradle
```

## الملفات المتأثرة
- `.github/workflows/build-apk.yml` — إضافة خطوة واحدة فقط

