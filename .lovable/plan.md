

# الخطة الشاملة النهائية — Supabase خارجي + Vault + كل التفاصيل

---

## الوضع الحالي

- **28 صفحة** تعمل بالكامل على `localStorage` (18 ملف، 284 استدعاء)
- لا يوجد مجلد `supabase/` ولا أي backend
- لا نظام مصادقة — الأدوار تُحاكى عبر `UserRoleContext`
- سلة محذوفات محلية عبر `TrashContext`
- 3 contexts: `IslamicModeContext`, `TrashContext`, `UserRoleContext`
- 2 hooks فقط: `use-mobile`, `use-toast`
- 3 مكتبات: `haptics`, `tripBudgetSync`, `utils`

---

## المرحلة 0: إعداد Supabase خارجي + Schema + RLS + Vault + pg_cron

### 0.1 إنشاء مشروع Supabase

```text
1. supabase.com → New Project
2. Region: Frankfurt (eu-central-1)
3. كلمة مرور قوية لقاعدة البيانات
4. في Lovable → Supabase Integration → Connect External Project
5. إدخال Project URL + Anon Key
6. Lovable يُنشئ تلقائياً:
   ├── src/integrations/supabase/client.ts
   ├── src/integrations/supabase/types.ts
   └── supabase/config.toml
```

### 0.2 تفعيل Extensions

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Vault مُفعّل افتراضياً في Supabase
```

### 0.3 تخزين Service Role Key في Vault

```sql
-- تخزين المفتاح بشكل آمن
SELECT vault.create_secret(
  'supabase_service_role_key',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'  -- المفتاح الفعلي
);
```

### 0.4 كل الجداول (40+ جدول)

**المصادقة والمستخدمين:**

```text
profiles
├── id (uuid PK, FK → auth.users)
├── name (text)
├── phone (text)
├── avatar_url (text)
├── subscription_plan (text default 'free')
├── subscription_expires_at (timestamptz)
├── is_deleted (boolean default false)
├── deleted_at (timestamptz)
├── last_login_at (timestamptz)
├── created_at, updated_at

user_roles
├── id (uuid PK)
├── user_id (uuid FK → auth.users, unique with role)
├── role (app_role enum: admin/moderator/user)

user_keypairs
├── id (uuid PK)
├── user_id (uuid FK, unique)
├── public_key (text) — ECDH P-256
├── encrypted_private_key (text)
├── iv (text), salt (text)
├── created_at

consent_log
├── id (uuid PK)
├── user_id (uuid FK)
├── consent_type (text) — terms/privacy/data_processing
├── version (text), accepted (boolean), ip_address (text), created_at
```

**العائلة:**

```text
families
├── id (uuid PK), name (text), invite_code (text unique)
├── created_by (uuid FK), created_at

family_members
├── id (uuid PK), family_id (uuid FK), user_id (uuid FK)
├── role (text) — father/mother/husband/wife/son/daughter/worker/maid/driver
├── is_admin (boolean default false), status (text), joined_at

family_invites
├── id, family_id, invited_by, invite_type (code/qr/link)
├── role_assigned, expires_at, used_by, used_at, created_at

family_keys
├── id, family_id, user_id
├── encrypted_key (text) — Family Key مشفر بالمفتاح العام للعضو
├── created_at

family_deletions
├── id, family_id, deleted_by, reason
├── status (pending/scheduled/completed/restored)
├── deleted_at, permanent_delete_at, restored_at

member_removals
├── id, family_id, removed_user_id, removed_by, reason
├── personal_data_migrated, deleted_at, permanent_delete_at, restored_at

admin_transfer_requests
├── id, family_id, requested_by, reason
├── approvals (jsonb), required_approvals, status, created_at
```

**التسوق:**

```text
market_lists: id, family_id, name, type, shared_with (uuid[]), created_by, created_at, updated_at
market_items: id, list_id (FK), name, category, quantity, added_by, checked, checked_by, created_at
```

**الميزانية:**

```text
budgets: id, family_id, type (month/project/trip), month, label, income (numeric), trip_id, shared_with, created_by, created_at
budget_expenses: id, budget_id (FK), name, amount (numeric), currency (text default 'SAR'), date, created_at
```

**المهام:**

```text
task_lists: id, family_id, name, type, shared_with, created_by, updated_at
task_items: id, list_id (FK), name, note, priority, assigned_to, done, repeat_enabled, repeat_days (int[]), repeat_count, created_at
```

**التقويم:**

```text
calendar_events: id, family_id, title, date, icon, reminder_before (text[]), added_by, personal_reminders (text[]), created_at
```

**الديون (numeric بدل jsonb):**

```text
debts
├── id, family_id, user_id, direction (given/taken)
├── person_name, amount (numeric), currency (text default 'SAR')
├── payment_details (jsonb nullable) — فقط للسداد بعروض
├── date, due_date, note, is_fully_paid, is_archived, has_reminder, created_at

debt_payments
├── id, debt_id (FK), amount (numeric), currency (text default 'SAR')
├── payment_details (jsonb nullable), date, type, item_description, created_at

debt_postponements: id, debt_id (FK), new_date, reason, created_at
```

**الرحلات:**

```text
trips: id, family_id, name, destination, start_date, end_date, budget (numeric), status, created_by, created_at
trip_day_plans: id, trip_id, day_number, city
trip_activities: id, day_plan_id, name, time, location, cost (numeric), completed
trip_suggestions: id, trip_id, place_name, type, reason, location, suggested_by, status
trip_packing: id, trip_id, name, packed
trip_expenses: id, trip_id, name, amount (numeric)
trip_documents: id, trip_id, name, type, file_url, file_name, notes, added_at
```

**الوثائق:**

```text
document_lists: id, family_id, name, type, shared_with, created_by, updated_at
document_items: id, list_id, name, category, expiry_date, reminder_enabled, note, added_by, added_at
document_files: id, document_id, name, type (image/pdf), file_url, size, added_at
```

**الأماكن:**

```text
place_lists: id, family_id, name, type, shared_with, created_by, updated_at
places: id, list_id, name, category, description, lat, lng, address, social_link, phone, price_range, rating, kid_friendly, added_by, suggested_by, visited, must_visit, note
```

**الألبومات:**

```text
albums: id, family_id, name, cover_color, linked_trip_id, created_by, created_at
album_photos: id, album_id, url, date, caption, created_at
```

**الزكاة:**

```text
zakat_assets: id, user_id, type, name, amount (numeric), currency, weight_grams, purchase_date, reminder, zakat_paid_at, created_at
zakat_history: id, asset_id (FK), amount_paid (numeric), paid_at, notes
```

**الوصية (E2EE):**

```text
wills: id, user_id, sections (jsonb — [{key, label, encrypted_content, iv, salt}]), password_hash, is_locked, updated_at, created_at
will_open_requests: id, will_id, requested_by, reason, status, approvals (jsonb), required_approvals, created_at
```

**المركبات:**

```text
vehicles: id, family_id, manufacturer, model, year, mileage, mileage_unit, color, plate_number, shared_with, created_by, created_at
vehicle_maintenance: id, vehicle_id, type, label, date, mileage_at_service, next_mileage, next_date, notes
```

**الصحة:**

```text
medications: id, family_id, name, dosage, member_id, member_name, frequency_type, frequency_value, selected_days, times_per_day, specific_times, start_date, end_date, notes, color, reminder_enabled, created_at

medication_logs (جدول منفصل بدل jsonb):
├── id, medication_id (FK), taken_at, taken_by, skipped, notes, created_at

vaccination_children: id, family_id, name, gender, birth_date, completed_vaccines, reminder_settings, created_at
vaccine_notes: id, child_id, vaccine_id, note, created_at
```

**العبادة:**

```text
prayer_logs: id, child_id, date, prayers (jsonb), notes, created_at
kids_worship_data: id, child_id, year, month, day, items (jsonb)
tasbih_sessions: id, user_id, count, created_at
islamic_reminder_prefs: id, user_id, reminder_id, enabled
```

**الدردشة (E2EE):**

```text
chat_messages: id, family_id, sender_id, encrypted_text, iv, pinned, reactions (jsonb), mention_user_id, status (sent/delivered/read), created_at
```

**الطوارئ والسلة:**

```text
emergency_contacts: id, family_id, name, phone, created_by

trash_items
├── id, family_id, user_id
├── type (text) — كل أنواع العناصر (task/trip/debt/event/document/place/album/zakat/medication/vehicle/market/will_section/chat/vaccination/family_member)
├── title, description
├── original_data (jsonb), related_records (jsonb)
├── is_shared, deleted_at
├── permanent_delete_at (= deleted_at + 30 يوم)
├── restored (boolean default false)
```

**الإشعارات:**

```text
notification_tokens: id, user_id, token (FCM), device_info, platform, created_at
scheduled_notifications: id, user_id, type, title, body, scheduled_at, sent, data (jsonb), created_at
```

**OTP:**

```text
otp_codes: id, phone, code_hash, attempts (max 5), expires_at (5 min), verified, created_at
```

**PDPL:**

```text
data_export_requests: id, user_id, status, file_url, requested_at, completed_at, expires_at
account_deletions: id, user_id, reason, status, requested_at, scheduled_delete_at, completed_at
data_retention_policy: table_name, retention_days, auto_purge, description
```

**إصدارات التطبيق:**

```text
app_versions: id, version, min_supported_version, force_update, update_message, release_notes, created_at
```

**الاشتراكات:**

```text
upgrade_attempts: id, user_id, plan_attempted, price, step_reached, abandoned_at, completed_at, followup_sent
subscription_events: id, user_id, event_type, plan, amount (numeric), currency, created_at
```

**جداول الأدمن:**

```text
admin_audit_log: id, admin_id, action, target_type, target_id, details (jsonb), ip_address, created_at
feature_usage: id, user_id, feature_name, page_path, session_id, created_at
user_sessions: id, user_id, device_info, platform, ip_address, started_at, ended_at
notification_log: id, sent_by, target_type, target_id, title, body, sent_at, opened_count
system_settings: id, key, value (jsonb), updated_by, updated_at
rate_limit_counters: id, user_id, endpoint, count, window_start
```

### 0.5 Security Definer Functions

```text
has_role(user_id, role) → boolean
is_family_member(user_id, family_id) → boolean
is_family_admin(user_id, family_id) → boolean
get_user_family_id(user_id) → uuid
is_staff_member(user_id) → boolean
```

### 0.6 RLS — صلاحيات الطاقم

```text
✅ الطاقم يصل: قوائم تسوق عائلية، مهام معيّنة له، مركبات مشاركة، أدويته
❌ لا يصل: ديون، زكاة، وصية، تقويم، أماكن، ميزانية، وثائق، ألبومات (افتراضياً)
⚠️ المحادثة: قناة منفصلة (Staff Chat) بمفتاح مختلف
```

### 0.7 Storage Buckets

```text
avatars, documents, album-photos, trip-documents
```

### 0.8 إعداد Cron Jobs عبر pg_cron + Vault (مُصحَّح)

**تخزين المفتاح في Vault أولاً:**

```sql
SELECT vault.create_secret(
  'supabase_service_role_key',
  'eyJhbGciOiJIUzI1NiIs...'
);
```

**كل الـ Cron Jobs:**

```sql
-- 1. notification-scheduler: كل 5 دقائق
SELECT cron.schedule(
  'notification-scheduler',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://PROJECT_ID.supabase.co/functions/v1/notification-scheduler',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'supabase_service_role_key'
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 2. trash-cleanup: كل يوم 3:00 صباحاً
SELECT cron.schedule(
  'trash-cleanup',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://PROJECT_ID.supabase.co/functions/v1/trash-cleanup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'supabase_service_role_key'
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 3. account-cleanup: كل يوم 4:00 صباحاً
SELECT cron.schedule(
  'account-cleanup',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://PROJECT_ID.supabase.co/functions/v1/account-cleanup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'supabase_service_role_key'
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 4. admin-succession: كل أحد 6:00 صباحاً
SELECT cron.schedule(
  'admin-succession',
  '0 6 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://PROJECT_ID.supabase.co/functions/v1/admin-succession',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'supabase_service_role_key'
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 5. export-cleanup: كل يوم 5:00 صباحاً
SELECT cron.schedule(
  'export-cleanup',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://PROJECT_ID.supabase.co/functions/v1/export-cleanup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'supabase_service_role_key'
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 6. otp-cleanup: كل 10 دقائق — SQL مباشر بدون Edge Function
SELECT cron.schedule(
  'otp-cleanup',
  '*/10 * * * *',
  $$DELETE FROM otp_codes WHERE expires_at < NOW()$$
);

-- 7. subscription-check: كل يوم 2:00 صباحاً — SQL مباشر
SELECT cron.schedule(
  'subscription-check',
  '0 2 * * *',
  $$
  UPDATE profiles
  SET subscription_plan = 'free'
  WHERE subscription_expires_at < NOW() - INTERVAL '7 days'
    AND subscription_plan != 'free';
  $$
);
```

**إدارة Cron Jobs:**

```sql
SELECT * FROM cron.job;                    -- عرض كل الـ Jobs
SELECT cron.unschedule('trash-cleanup');    -- إيقاف
SELECT * FROM cron.job_run_details         -- سجل التنفيذ
  ORDER BY start_time DESC LIMIT 20;
```

---

## المرحلة 1: المصادقة — Twilio OTP + Google OAuth + WebOTP

### ملفات جديدة

```text
src/pages/Auth.tsx — شاشة تسجيل الدخول
src/contexts/AuthContext.tsx — إدارة الجلسة
src/components/AuthGuard.tsx — حماية المسارات
src/lib/crypto.ts — E2EE
```

### شاشة Auth.tsx

- حقل رقم جوال (+966 افتراضي)
- زر إرسال OTP → Supabase Phone Auth (Twilio مدمج)
- حقل OTP (6 خانات) مع **WebOTP Auto-fill:**
  - `navigator.credentials.get({ otp: { transport: ["sms"] } })`
  - صياغة الرسالة: `رمز التحقق: 123456\n@domain.com #123456`
  - Capacitor: `@capacitor-community/sms-retriever`
  - Fallback: إدخال يدوي
- زر "تسجيل بحساب Google"
- **لا كلمة مرور — لا نسيت كلمة المرور**

### إعداد Twilio في Supabase

```text
Supabase Dashboard → Authentication → Providers → Phone:
├── تفعيل Phone Provider
├── إدخال Twilio Account SID + Auth Token + Phone Number
├── أو Edge Function مخصصة لتحكم أكبر (rate limiting، رسالة عربية مخصصة)
```

### إعداد Google OAuth

```text
Supabase Dashboard → Authentication → Providers → Google:
├── تفعيل Google Provider
├── إدخال Client ID + Client Secret من Google Cloud Console
```

### أول تسجيل دخول

- إنشاء profile + user_keypairs (ECDH P-256) تلقائياً
- شاشة موافقة على الشروط → `consent_log`
- فحص `app_versions` (هل الإصدار مدعوم؟)
- توجيه لإعداد/انضمام عائلة

---

## المرحلة 2: Firebase FCM + Push Notifications

### الإعداد

```text
public/firebase-messaging-sw.js — Service Worker
src/lib/fcm.ts — تهيئة + طلب إذن + تسجيل token
```

### Edge Functions

```text
register-fcm-token: حفظ/تحديث FCM token في notification_tokens
send-notification: إرسال فوري عبر Firebase Admin SDK
notification-scheduler (يُستدعى من pg_cron كل 5 دقائق):
├── يفحص scheduled_notifications WHERE scheduled_at <= NOW() AND sent = false
├── يُرسل عبر FCM
├── يُحدّث sent = true
```

### أنواع الإشعارات

أدوية، لقاحات، تنبيهات دينية (صيام، أضحية، عاشوراء...)، أحداث تقويم، انتهاء صلاحية وثائق، صيانة مركبات، تذكير زكاة

---

## المرحلة 3: طبقة API + Rate Limiting

### `src/lib/api.ts` — Wrapper موحد

```text
apiClient(functionName, method, body)
├── يستخدم supabase.functions.invoke()
├── يُرسل JWT تلقائياً
├── retry + error handling
├── يفحص app_versions مرة/جلسة
```

### Rate Limiting

```text
عمليات عادية: 100 req/min/user
عمليات حساسة (auth, will, export): 10 req/min/user
OTP: 3 req/10 min/phone
Chat: 30 msg/min/user
التنفيذ: pg function مع rate_limit_counters أو Upstash Redis
```

### 25 Edge Function بالتفصيل

| # | الدالة | الوظيفة |
|---|--------|---------|
| 1 | `auth-management` | إنشاء profile تلقائي بعد التسجيل. تحديث الاسم/الصورة/الهاتف. رفع avatar إلى Storage. تحديث `last_login_at`. إنشاء `user_keypairs` (ECDH). |
| 2 | `family-management` | **POST /create**: إنشاء عائلة + invite_code + Family Key مشفر بمفتاح المنشئ. **POST /join**: انضمام بكود/QR/رابط → حالة pending. **PUT /approve**: المشرف يوافق + يشفر Family Key للعضو الجديد. **PUT /toggle-admin**: منح/إزالة صلاحية مشرف (الخيار الاختياري). **DELETE /member**: نقل لـ `member_removals` + حذف `family_key`. **DELETE /family**: نقل لـ `family_deletions` (30 يوم). **POST /restore-member**, **POST /restore-family**. **GET /members**. |
| 3 | `market-api` | CRUD لـ `market_lists` + `market_items`. مشاركة. تحديث `checked`/`checked_by`. الطاقم: قوائم عائلية فقط. |
| 4 | `budget-api` | CRUD لـ `budgets` + `budget_expenses`. ربط تلقائي مع رحلة. حساب مجاميع/نسب. الطاقم: لا وصول. |
| 5 | `tasks-api` | CRUD لـ `task_lists` + `task_items`. أولوية، تكرار، تعيين. الطاقم: مهامه فقط. |
| 6 | `calendar-api` | CRUD لـ `calendar_events`. تذكيرات شخصية. الطاقم: لا وصول. |
| 7 | `debts-api` | CRUD ديون (amount numeric). دفعات + تأجيلات. حساب المتبقي: `amount - SUM(payments)`. الطاقم: لا وصول. |
| 8 | `trips-api` | CRUD رحلات + 6 جداول فرعية. رفع وثائق. ربط ميزانية تلقائي. |
| 9 | `documents-api` | CRUD وثائق + ملفات. رفع لـ Storage. تنبيه انتهاء الصلاحية. الطاقم: لا وصول. |
| 10 | `places-api` | CRUD أماكن + قوائم. تصفية/تقييم. الطاقم: لا وصول. |
| 11 | `albums-api` | CRUD ألبومات + صور. رفع لـ Storage. ربط برحلة. الطاقم: اختياري (المشرف يقرر). |
| 12 | `zakat-api` | CRUD أصول (amount numeric). سجل تزكية. تذكيرات الحول. الطاقم: لا وصول. |
| 13 | `will-api` | حفظ/جلب الوصية المشفرة (E2EE). طلبات فتح + موافقات. الطاقم: لا وصول. |
| 14 | `vehicles-api` | CRUD مركبات + صيانة. مشاركة مع طاقم عبر `shared_with`. |
| 15 | `health-api` | CRUD أدوية + `medication_logs` (جدول منفصل). لقاحات + ملاحظات. الطاقم: أدويته فقط. |
| 16 | `worship-api` | عبادات أطفال + prayer_logs + تسبيح + تنبيهات دينية. |
| 17 | `chat-api` | إرسال رسائل مشفرة (E2EE بـ Family Key). تثبيت، تفاعلات، حالة القراءة. قناتين: عائلية + طاقم. |
| 18 | `trash-api` | نقل أي عنصر للسلة (يجمع original_data + related_records). استعادة. حذف نهائي + ملفات Storage. |
| 19 | `settings-api` | إعدادات المستخدم. جهات طوارئ. إعدادات SOS. |
| 20 | `account-api` | تصدير بيانات → ZIP → Storage (TTL 7 أيام). soft delete → منع المشرف الوحيد. إلغاء خلال 30 يوم. |
| 21 | `admin-api` | كل عمليات لوحة الأدمن — يتحقق من `user_roles.role = 'admin'`. Dashboard، مستخدمين، عوائل، اشتراكات، تقارير، إشعارات، audit log. |
| 22 | `notification-scheduler` | يُستدعى من pg_cron كل 5 دقائق. يفحص ويرسل عبر FCM. |
| 23 | `trash-cleanup` | يُستدعى من pg_cron يومياً. حذف نهائي بعد 30 يوم + ملفات Storage. |
| 24 | `account-cleanup` | يُستدعى من pg_cron يومياً. hard delete للحسابات بعد 30 يوم. |
| 25 | `admin-succession` | يُستدعى من pg_cron أسبوعياً. فحص غياب المشرفين 90+ يوم → نقل الإدارة. |

---

## المرحلة 4: تحويل الصفحات من localStorage → API

### 18 ملف يُحوَّل بالكامل (284 استدعاء localStorage يُحذف)

### ملفات Hooks جديدة

```text
src/hooks/useMarket.ts      — market-api
src/hooks/useBudget.ts      — budget-api
src/hooks/useTasks.ts       — tasks-api
src/hooks/useDebts.ts       — debts-api
src/hooks/useTrips.ts       — trips-api
src/hooks/useDocuments.ts   — documents-api
src/hooks/usePlaces.ts      — places-api
src/hooks/useAlbums.ts      — albums-api
src/hooks/useZakat.ts       — zakat-api
src/hooks/useVehicles.ts    — vehicles-api
src/hooks/useHealth.ts      — health-api
src/hooks/useWorship.ts     — worship-api
src/hooks/useChat.ts        — chat-api
src/hooks/useCalendar.ts    — calendar-api
src/hooks/useFamily.ts      — family-management
src/hooks/useWill.ts        — will-api
src/hooks/useTrash.ts       — trash-api
src/hooks/useSettings.ts    — settings-api
```

كل hook يستخدم React Query (`useQuery`/`useMutation`) مع optimistic updates. لا localStorage للبيانات.

---

## المرحلة 5: Supabase Realtime + Offline Queue

### Realtime (مجاني ومدمج)

```text
chat_messages — رسائل فورية
market_items — تحديث لحظي للشراء
task_items — تحديث لحظي للإنجاز
تفعيل: Dashboard → Database → Replication
```

### Offline Queue

```text
React Query + idb-keyval (IndexedDB)
├── فقدان اتصال → تخزين محلي
├── عودة اتصال → إرسال تلقائي
├── Conflict: Last-Write-Wins (updated_at)
├── الجداول المدعومة: market_items, task_items, tasbih_sessions, medication_logs
```

---

## المرحلة 6: Stripe + الاشتراكات

```text
الخطط:
├── free: عائلة واحدة، 3 أفراد
├── monthly: SAR 19.99/شهر
├── yearly: SAR 149.99/سنة (خصم ~37%)
├── family: SAR 249.99/سنة — عائلتين، 20 فرد

Edge Functions:
├── create-checkout-session — Stripe Checkout + upgrade_attempts
├── stripe-webhook — تحديث الاشتراك + Grace Period 7 أيام
├── check-subscription — middleware ضمن كل API

Apple Pay + Google Pay + SAR عبر Stripe Payment Element
```

---

## المرحلة 7: PDPL + E2EE

### PDPL

```text
consent_log عند التسجيل
تصدير البيانات → JSON/ZIP → Storage (TTL 7 أيام)
حذف الحساب: soft → 30 يوم → hard (cron)
سياسة الاحتفاظ: trash 30 يوم، OTP 10 دقائق، exports 7 أيام
src/pages/PrivacyPolicy.tsx
أزرار "تصدير بياناتي" + "حذف حسابي" في الإعدادات
```

### E2EE — `src/lib/crypto.ts`

```text
generateKeyPair() → ECDH P-256
encryptPrivateKey/decryptPrivateKey — بـ PIN
generateFamilyKey() → AES-256
encryptFamilyKeyForMember/decryptFamilyKey — ECDH key agreement
encryptContent/decryptContent — للوصية (PBKDF2 → AES-GCM)
encryptMessage/decryptMessage — للمحادثة (Family Key)
```

**آلية مشاركة Family Key:**

```text
إنشاء عائلة → Family Key عشوائي → مشفر بمفتاح المنشئ العام
انضمام عضو → المشرف يفك Family Key بمفتاحه الخاص → يعيد تشفيره بمفتاح العضو الجديد
الطاقم → Staff Key منفصل — لا يحصل على Family Key
Supabase لا يرى المحتوى أبداً
```

---

## المرحلة 8: لوحة تحكم الأدمن

### الأمان

```text
/admin — مسار مخفي (لا رابط في التطبيق)
├── user_roles.role = 'admin' (Security Definer)
├── OTP إضافي (2FA) عند كل دخول
├── تسجيل في admin_audit_log
├── حظر بعد 5 محاولات فاشلة
```

### الصفحات

```text
/admin              → Dashboard (بطاقات + رسوم بيانية)
/admin/users        → بحث + فلترة + تعليق/تفعيل + إشعار + سجل نشاط
/admin/families     → عوائل + أفراد + أدوار + مشرفين معاونين
/admin/subscriptions → توزيع + abandoned checkout + تمديد/كوبون/إلغاء
/admin/reports      → كل التقارير (أدناه)
/admin/notifications → Push لـ: الكل/اشتراك/عائلة/مستخدم + جدولة + قوالب
/admin/audit-log    → سجل عمليات مفلتر
/admin/settings     → أسعار + ميزات + maintenance mode + قوالب OTP
/admin/app-versions → إصدارات + تحديث إجباري
```

### التقارير

```text
مستخدمين: تسجيلات، DAU/WAU/MAU، Retention D1/D7/D30، غير نشطين 30+، توزيع جغرافي
مالية: MRR/ARR، إيرادات/نوع، Refunds، ARPU، LTV، Churn Rate، ترقيات غير مكتملة
استخدام: أكثر الميزات، متوسط جلسة، جلسات/مستخدم، أكثر الصفحات، نقاط خروج، ميزات دينية
عوائل: أحجام، الأنشط، أدوار شائعة، استخدام طاقم
تقنية: أخطاء، أداء API، أجهزة/متصفحات، تخزين
تصدير: PDF/CSV/Excel + جدولة تقارير بالبريد
```

---

## سياسة الحذف الشاملة — كل السيناريوهات

### كل شيء يمر بالسلة (30 يوم)

مهام، رحلات، ديون، أحداث، وثائق، أماكن، ألبومات، زكاة، أدوية، مركبات، تسوق، وصية، رسائل، لقاحات، أفراد عائلة.

### حذف فرد من العائلة

المشرف يزيل عضواً → `member_removals` (30 يوم) → يفقد الوصول فوراً. يُحذف `family_key` الخاص به. يحتفظ ببياناته الشخصية. ينضم لعائلة جديدة فوراً.

### حذف البروفايل

Soft delete → 30 يوم → hard delete. المشرف الوحيد: **يُمنع** — يجب منح مشرف آخر أو حذف العائلة أولاً.

### حذف العائلة

تأكيد مزدوج. إشعار Push لكل الأعضاء. `family_deletions` (30 يوم). كل عضو يحتفظ ببياناته الشخصية. بعد 30 يوم: hard delete + Storage.

### المشرف الاحتياطي (خيار اختياري)

المشرف يرى "إضافة مشرف" في إدارة العائلة → يمنح `is_admin = true` لعضو بالغ. يستطيع إزالة الصلاحية لاحقاً (إلا المشرف الأخير).

### وفاة/غياب المشرف (90+ يوم)

Cron `admin-succession` أسبوعي → إذا يوجد مشرف معاون: ينقل الإدارة. إذا لا: إشعار للبالغين → طلب إدارة يحتاج أغلبية.

### سيناريو الطلاق

الأب يزيل الأم → تفقد وصول العائلة. تحتفظ بحسابها + بياناتها الشخصية. تنضم لعائلة جديدة مع بياناتها الشخصية فقط. الأولاد يبقون مع الأب.

---

## ترتيب التنفيذ النهائي

```text
الخطوة │ البند                                            │ التبعيات
───────┼──────────────────────────────────────────────────┼──────────
  0    │ إنشاء Supabase (Frankfurt) + ربط بـ Lovable       │ لا شيء
  0.5  │ كل الجداول + RLS + Extensions + Vault + pg_cron   │ 0
  1    │ Auth (Twilio Phone + Google OAuth + WebOTP)        │ 0.5
  2    │ Firebase FCM + Push Notifications                  │ 0.5
  3    │ API layer (api.ts + 25 Edge Function)              │ 1
  4    │ تحويل 18 صفحة من localStorage → API               │ 3
  5    │ Supabase Realtime + Offline Queue                  │ 4
  6    │ Stripe + اشتراكات                                  │ 3
  7    │ PDPL + E2EE (crypto.ts + will + chat)              │ 3
  8    │ لوحة الأدمن + التقارير + App Versions              │ 4+6
```

### ملاحظات Supabase خارجي

```text
النسخ الاحتياطية: Free = يومية (7 أيام) | Pro ($25/شهر) = PITR
حدود Free: 500MB DB, 1GB Storage, 500K Edge invocations
الأمان: SSL مُفعّل، Service Role Key في Edge Functions فقط + Vault
المراقبة: Dashboard → Logs + Reports + Query Performance
```

