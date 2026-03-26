

# تحويل الاستدعاءات المباشرة المتبقية إلى Edge Functions

## الوضع الحالي

الـ hooks المذكورة (budgets, market, tasks, calendar, places, vaccinations) **تم تحويلها بالفعل**. لكن يوجد **6 ملفات** لا تزال تستدعي `supabase.from()` مباشرة:

### الاستدعاءات المباشرة المتبقية (من network requests + كود)

| الملف | الجدول | نوع العملية |
|---|---|---|
| `useFamilyId.ts` | `family_members` | SELECT family_id |
| `useMyRole.ts` | `family_members` | SELECT role, is_admin |
| `useNotifications.ts` | `user_notifications` | SELECT, UPDATE, DELETE |
| `useChat.ts` | `profiles`, `family_keys`, `chat_messages`, `family_members` | SELECT, INSERT, UPDATE |
| `Settings.tsx` | `emergency_contacts` | INSERT, DELETE |
| `AdminDashboard.tsx` | `profiles`, `families`, `account_deletions` | SELECT |

### ملف إضافي (يُتجاهل)
- `src/examples/MedicationsExample.tsx` — ملف مثال فقط، ليس مستخدماً في الإنتاج

---

## خطة التحويل

### 1. `useFamilyId.ts` → `family-management`
- استبدال `supabase.from("family_members").select("family_id")` بـ:
```
supabase.functions.invoke("family-management", {
  body: { action: "get-family-id" }
})
```
- **تعديل Edge Function**: إضافة action `get-family-id` يرجع `family_id` للمستخدم الحالي
- الإبقاء على localStorage cache كما هو

### 2. `useMyRole.ts` → `family-management`
- استبدال `supabase.from("family_members").select("role, is_admin")` بـ:
```
supabase.functions.invoke("family-management", {
  body: { action: "get-my-role" }
})
```
- **تعديل Edge Function**: إضافة action `get-my-role` يرجع `{ role, is_admin }`

### 3. `useNotifications.ts` → `notifications-api` (Edge Function جديدة)
- 5 عمليات مباشرة تحتاج تحويل: get, markAsRead, markAsUnread, markAllAsRead, delete
- **إنشاء Edge Function جديدة** `notifications-api` مع actions:
  - `get-notifications`
  - `mark-read`
  - `mark-unread`
  - `mark-all-read`
  - `delete-notification`
- الإبقاء على realtime subscription كما هو (مقبول)

### 4. `useChat.ts` → `chat-api`
- أكبر ملف — ~20 استدعاء مباشر عبر 6 جداول
- تحويل:
  - قراءة `family_members` + `profiles` → `chat-api/get-members`
  - قراءة `chat_messages` → `chat-api/get-messages`
  - إدراج `chat_messages` → `chat-api/send-message`
  - تحديث `chat_messages` (pin/reactions) → `chat-api/update-message`
  - `family_keys` upsert/read → `chat-api/manage-keys`
- **ملاحظة**: الـ Edge Function `chat-api` موجودة بالفعل — تحتاج مراجعة لتغطية كل العمليات

### 5. `Settings.tsx` → `settings-api`
- عمليتان: إضافة وحذف `emergency_contacts`
- **تعديل `settings-api`**: إضافة actions `add-emergency-contact` و `remove-emergency-contact`

### 6. `AdminDashboard.tsx` → `admin-api`
- 3 استعلامات إحصائية: profiles count, families count, pending deletions
- **تعديل `admin-api`**: إضافة action `get-stats` يرجع الإحصائيات الثلاث

---

## ترتيب التنفيذ

1. **`useFamilyId.ts` + `useMyRole.ts`** → تعديل `family-management` (action واحد لكل منهما)
2. **`AdminDashboard.tsx`** → تعديل `admin-api`
3. **`Settings.tsx`** → تعديل `settings-api`
4. **`useNotifications.ts`** → إنشاء `notifications-api`
5. **`useChat.ts`** → تعديل `chat-api` (الأكبر والأعقد)

## تعديلات Edge Functions المطلوبة

| Edge Function | التعديل |
|---|---|
| `family-management` | إضافة `get-family-id` + `get-my-role` |
| `admin-api` | إضافة `get-stats` |
| `settings-api` | إضافة `add-emergency-contact` + `remove-emergency-contact` |
| `notifications-api` | **جديدة** — CRUD للإشعارات |
| `chat-api` | مراجعة وإضافة actions ناقصة |

