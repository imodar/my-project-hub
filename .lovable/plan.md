

# إصلاح CORS لدعم Capacitor APK — 29 Edge Function

## المشكلة
كل الـ Edge Functions (29 ملف) تستخدم نفس نمط CORS بقائمة origins ثابتة لا تشمل `http://localhost` و `capacitor://localhost`. عندما يعمل التطبيق كـ APK، الـ WebView يرسل origin مختلف فيُحجب الاستجابة.

## الحل
تحديث موحّد لكل الـ 29 Edge Function بنفس التعديلين:

### التعديل 1: إضافة أصول Capacitor لـ `PROJECT_ORIGIN_FALLBACKS`

```ts
const PROJECT_ORIGIN_FALLBACKS = [
  "https://7571dddb-1161-4f53-9036-32778235da46.lovableproject.com",
  "https://id-preview--7571dddb-1161-4f53-9036-32778235da46.lovable.app",
  "https://ailti.lovable.app",
  "https://d0479375-ab8c-4895-86c0-45a5df6d51d8.lovableproject.com",
  "http://localhost",
  "capacitor://localhost",
];
```

### التعديل 2: التعامل مع null/empty origin بأمان

```ts
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  let allowed = "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    allowed = origin;
  } else if (origin === "" || origin === "null") {
    allowed = "capacitor://localhost";
  }
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, ...",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
```

بدل `"*"` الخطير، نرجع `"capacitor://localhost"` — المصدر الوحيد الممكن لـ null origin في بيئتنا.

## الملفات المتأثرة (29 ملف)

| # | Edge Function |
|---|--------------|
| 1 | `account-api` |
| 2 | `account-cleanup` |
| 3 | `admin-api` |
| 4 | `admin-succession` |
| 5 | `albums-api` |
| 6 | `auth-management` |
| 7 | `budget-api` |
| 8 | `calendar-api` |
| 9 | `chat-api` |
| 10 | `debts-api` |
| 11 | `documents-api` |
| 12 | `family-management` |
| 13 | `health-api` |
| 14 | `location-api` |
| 15 | `market-api` |
| 16 | `notification-scheduler` |
| 17 | `notifications-api` |
| 18 | `notifications-generator` |
| 19 | `phone-auth` |
| 20 | `places-api` |
| 21 | `settings-api` |
| 22 | `tasks-api` |
| 23 | `trash-api` |
| 24 | `trash-cleanup` |
| 25 | `trips-api` |
| 26 | `vehicles-api` |
| 27 | `will-api` |
| 28 | `worship-api` |
| 29 | `zakat-api` |

## خطة التنفيذ
1. تحديث كل الـ 29 ملف بالتعديلين أعلاه (نفس النمط بالضبط)
2. نشر كل الـ Edge Functions دفعة واحدة
3. اختبار `phone-auth` من الـ preview للتأكد

