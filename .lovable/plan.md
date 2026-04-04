

# حذف البيانات والحساب بالكامل

## الوضع الحالي
- يوجد زر "مسح البيانات" في الإعدادات بدون أي `onClick` handler
- يوجد `account-api` edge function مع action `request-deletion` — لكنها soft delete (30 يوم انتظار)
- يوجد `account-cleanup` edge function يعمل عبر pg_cron لحذف الحسابات المعلقة
- المطلوب: حذف فوري وشامل لكل البيانات + الحساب

## الخطة

### 1. Edge Function جديد: `account-delete-now`
إضافة action جديد في `account-api` اسمه `delete-account-now` يقوم بـ:
- حذف جميع بيانات المستخدم من كل الجداول (باستخدام adminClient/service role):
  - `family_members`, `family_keys` — إزالة العضوية
  - `task_items`, `market_items` (added_by = userId)
  - `calendar_events` (added_by = userId)
  - `budgets`, `budget_expenses`, `debts`, `debt_payments`
  - `medications`, `medication_logs`
  - `chat_messages` (sender_id)
  - `albums`, `album_photos` — حذف الصور من Storage أيضاً
  - `document_lists`, `document_items`, `document_files` — حذف الملفات من Storage
  - `places`, `place_lists`
  - `trips` + جداولها الفرعية
  - `vehicles`, `vaccinations`, `zakat_assets`, `will_sections`
  - `tasbih_sessions`, `kids_worship_data`, `prayer_logs`, `worship_children`
  - `trash_items`, `emergency_contacts`
  - `notification_tokens`, `scheduled_notifications`
  - `consent_log`, `data_export_requests`, `account_deletions`
  - `profiles` — حذف
  - ملفات الـ avatar من Storage bucket `avatars`
- فحص إذا كان المشرف الوحيد في عائلة → يرفض الحذف مع رسالة خطأ
- حذف المستخدم من `auth.users` عبر `adminClient.auth.admin.deleteUser()`
- إرجاع `{ success: true }` مع progress steps

### 2. واجهة المستخدم: Bottom Sheet في Settings.tsx
عند الضغط على "مسح البيانات":
- يفتح Bottom Sheet يحتوي على:
  - **أيقونة تحذير كبيرة** حمراء
  - **عنوان**: "حذف الحساب والبيانات"
  - **تنبيهات** (3 نقاط):
    1. سيتم حذف جميع بياناتك نهائياً
    2. لن تتمكن من استعادة أي بيانات بعد الحذف
    3. يمكنك إعادة التسجيل لكن بدون بياناتك السابقة
  - **Checkbox تأكيد**: "أفهم أن هذا الإجراء لا يمكن التراجع عنه"
  - **حقل إدخال اختياري**: سبب الحذف
  - **زر أحمر**: "حذف الحساب نهائياً" (معطل حتى يتم تفعيل الـ checkbox)

- عند الضغط على الزر:
  - يظهر **شريط تقدم** مع مراحل:
    1. "جاري حذف البيانات من السيرفر..." (استدعاء Edge Function)
    2. "جاري مسح البيانات المحلية..." (مسح IndexedDB + localStorage + Cache API)
    3. "تم الحذف بنجاح"
  - بعد الانتهاء → `signOut()` → navigate إلى `/auth`

### 3. ترجمات
إضافة نصوص عربية وإنجليزية جديدة لكل عناصر الشيت.

## الملفات

| # | الملف | التغيير |
|---|-------|---------|
| 1 | `supabase/functions/account-api/index.ts` | إضافة action `delete-account-now` |
| 2 | `src/pages/Settings.tsx` | Bottom Sheet + progress bar + ربط الزر |
| 3 | `src/i18n/ar.ts` | ترجمات عربية |
| 4 | `src/i18n/en.ts` | ترجمات إنجليزية |

**4 ملفات، بدون migration جديد** (الحذف يتم عبر service role في Edge Function)

