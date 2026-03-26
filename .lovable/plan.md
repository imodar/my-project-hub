

# خطة تحويل معمارية الأمان: من Client → DB مباشر إلى Edge Functions

## الملخص

تحويل **14 ملف متبقي** من `supabase.from()` مباشر إلى Edge Functions، مع تحديث `syncQueue.ts` بعد كل مرحلة والتزام صارم بترتيب التنفيذ.

---

## ✅ تم إنجازه سابقاً

| الملف | Edge Function |
|-------|-------------|
| `useWill.ts` | `will-api` |
| `useZakatAssets.ts` | `zakat-api` |
| `useDebts.ts` | `debts-api` |
| `useBudgets.ts` | `budget-api` |
| `Profile.tsx` | `auth-management` |
| Rate Limiting | 22 Edge Function |

---

## المرحلة 2 — البنية الأساسية (تُنفَّذ معاً في deploy واحد)

> **تحذير حرج**: `AuthContext.tsx` و `useFamilyMembers.ts` يجب أن يُنشران معاً — لأن `AuthContext` يتحكم بـ `profileReady` الذي يعتمد عليه `AuthGuard`. تغيير سلوكه منفرداً قد يكسر التطبيق بالكامل.

### 2.1 `AuthContext.tsx` → `auth-management`
- استبدال `supabase.from("profiles").select("name")` بـ `supabase.functions.invoke("auth-management", { body: { action: "get-profile" } })`
- الإبقاء على `supabase.auth.*` و `db.*` كما هم
- الـ timeout 5s يبقى
- يجب أن تكون الاستجابة متوافقة: `data.data.name` أو حسب ما ترجعه الـ Edge Function

### 2.2 `useFamilyMembers.ts` → `family-management`
- هذا hook **قراءة فقط** — لا `useOfflineMutation` — فقط تغيير `queryFn`
- استبدال الاستعلامين المباشرين باستدعاء واحد: `{ action: "get-members", family_id }`
- **تعديل `get-members` في Edge Function**: إضافة `created_by` من `families` في الاستجابة
- **Fix bug**: نقل تعريف `adminClient` قبل استدعاء `checkRateLimit` في `family-management/index.ts`

> **تنبيه**: بعد التحويل اختبر أن البنية المرجعة تحتوي على: `id`, `name`, `role`, `isAdmin`, `isCreator`, `roleConfirmed` — وإلا ستنكسر `FamilyManagement.tsx` و `UserRoleContext.tsx`

### 2.3 `TrashContext.tsx` → `trash-api`
- تحويل القراءة/الإضافة/الحذف إلى `trash-api`
- **نقل منطق الاستعادة بالكامل إلى `trash-api`** (بدل client-side):
  - `restore` في الـ Edge Function يجلب العنصر، يعيد إدخاله حسب `type` (`market_list` → `market_lists` + `market_items`، `task_list` → `task_lists` + `task_items`، إلخ)، ثم يحدّث `restored = true`
  - هذا يضمن atomicity — لا بيانات نصف مستعادة

### تحقق بعد المرحلة 2
- مراجعة `TABLE_API_MAP` في `syncQueue.ts` — لا يوجد تأثير مباشر هنا لأن هذه الملفات لا تكتب عبر `useOfflineMutation`، لكن تأكد أن لا شيء تكسر.

---

## المرحلة 3أ — بيانات عائلية

### 3.1 `useMedications.ts` → `health-api`
- تحويل كل `apiFn` لـ `health-api`
- **تعديل Edge Function**: `get-medications` يرجع `medication_logs(*)` مع الأدوية

### 3.2 `useVaccinations.ts` → `health-api`
- تحويل كل `apiFn`
- **إضافة action**: `update-reminder-settings`

### 3.3 `useVehicles.ts` → `vehicles-api`
- تحويل كل `apiFn`
- **إضافة action**: `update-maintenance`

### 3.4 `useAlbums.ts` → `albums-api`
- تحويل كل `apiFn`
- **تعديل Edge Function**: `get-albums` يرجع `album_photos(*)` بدل `album_photos(count)`

### تحقق بعد المرحلة 3أ
مراجعة `TABLE_API_MAP` في `syncQueue.ts`:
- `medications`: actions `INSERT: "create-medication"` ✓ موجود
- `medication_logs`: action `INSERT: "log-medication"` ✓ موجود
- `vehicles`: actions ✓ موجود
- `vehicle_maintenance`: يحتاج التأكد أن `update-maintenance` مطابق لـ `UPDATE: "update-maintenance"` ✓ موجود
- `albums` / `album_photos`: ✓ موجود

---

## المرحلة 3ب — بيانات عائلية (تكملة)

### 3.5 `useTrips.ts` → `trips-api`
- 13 mutation تحتاج تحويل
- **إضافة actions ناقصة**: `delete-expense` (موجود في MAP ✓)، `add-document`, `delete-document`

### 3.6 `useDocumentLists.ts` → `documents-api`
- **تعديل Edge Function**: `get-lists` يرجع `document_items(*, document_files(*))`

### 3.7 `useCalendarEvents.ts` → `calendar-api`
- تحويل كل `apiFn`

### 3.8 `usePlaceLists.ts` → `places-api`
- تحويل كل `apiFn`

### تحقق بعد المرحلة 3ب
مراجعة `TABLE_API_MAP` في `syncQueue.ts`:
- `trips`, `trip_day_plans`, `trip_activities`, `trip_expenses`, `trip_packing`: ✓ موجود — تأكد أن `add-document` و `delete-document` مضافة إذا لزم (لا يوجد `trip_documents` في MAP حالياً — **يجب إضافته**)
- `calendar_events`: ✓ موجود
- `document_lists`, `document_items`: ✓ موجود
- `places` / `place_lists`: **غير موجود في MAP — يجب إضافته**

---

## المرحلة 3ج — قوائم + مهام

### 3.9 `useMarketLists.ts` → `market-api`
- **تعديل Edge Function**: `get-lists` يرجع `market_items(*)` + إضافة action `update-item`

### 3.10 `useTaskLists.ts` → `tasks-api`
- تحويل كل `apiFn`

### تحقق بعد المرحلة 3ج
- `market_items`: MAP يحتوي `UPDATE: "update-item"` — تأكد أن الـ Edge Function تدعم هذا الـ action فعلاً
- `task_items`, `task_lists`: ✓ موجود

---

## المرحلة 4 — منخفض الأولوية

### 4.1 `useTasbihSessions.ts` → `worship-api`
- **إضافة action**: `clear-tasbih`

### 4.2 `useKidsWorshipData.ts` → `worship-api`
- **إضافة action**: `delete-worship-data`

### 4.3 `AdminDashboard.tsx` → `admin-api`
- تحويل الاستعلامات المباشرة

### تحقق بعد المرحلة 4
- `tasbih_sessions` و `kids_worship_data` **غير موجودة في `TABLE_API_MAP`** — يجب إضافتها إذا كانت تُستخدم مع `useOfflineMutation`

---

## Rate Limiting المخصص

| Edge Function | الحد |
|---------------|------|
| `family-management` | 10 creates/hour per user |
| `auth-management` | 20 profile updates/hour |
| `health-api`, `trips-api`, `market-api` | 200 writes/hour per user |
| `admin-api` | بلا حد (admins فقط) |
| الباقي | 60 req/min (الافتراضي الحالي) |

---

## تعديلات Edge Functions المطلوبة

| Edge Function | التعديل |
|---|---|
| `family-management` | fix `adminClient` ordering + إرجاع `created_by` في `get-members` |
| `trash-api` | نقل منطق الاستعادة الكامل للـ backend |
| `market-api` | `get-lists` → `market_items(*)` + action `update-item` |
| `albums-api` | `get-albums` → `album_photos(*)` |
| `documents-api` | `get-lists` → `document_items(*, document_files(*))` |
| `trips-api` | actions: `add-document`, `delete-document` |
| `vehicles-api` | action: `update-maintenance` (تأكد من وجوده) |
| `health-api` | `get-medications` → `medication_logs(*)` + action `update-reminder-settings` |
| `worship-api` | actions: `clear-tasbih`, `delete-worship-data` |

---

## تحديثات `syncQueue.ts` — `TABLE_API_MAP`

بعد كل مرحلة، تحقق من:
1. كل جدول mapped لـ Edge Function **تملك فعلاً الـ action المكتوب**
2. الجداول الناقصة يجب إضافتها:

```text
مطلوب إضافته في TABLE_API_MAP:
├─ trip_documents   → trips-api    { INSERT: "add-document", DELETE: "delete-document" }
├─ places           → places-api   { INSERT: "add-place", UPDATE: "update-place", DELETE: "delete-place" }
├─ place_lists      → places-api   { INSERT: "create-list", DELETE: "delete-list" }
├─ tasbih_sessions  → worship-api  { INSERT: "save-tasbih" }
└─ kids_worship_data→ worship-api  { INSERT: "save-worship-data", DELETE: "delete-worship-data" }
```

3. الجداول الموجودة: تأكد أن أسماء الـ actions تطابق ما هو مكتوب في الـ Edge Functions بالضبط

---

## النمط الموحد لكل تحويل

```text
// useOfflineMutation: تغيير apiFn فقط
// قبل:
apiFn: async (input) => {
  const { error } = await supabase.from("table").insert({...});
  return { data: null, error: error?.message || null };
}

// بعد:
apiFn: async (input) => {
  const { data, error } = await supabase.functions.invoke("xxx-api", {
    body: { action: "action-name", ...fields },
  });
  return { data: data?.data ?? null, error: data?.error || error?.message || null };
}
```

- الـ offline-first pattern يبقى كما هو
- `syncQueue.processQueue()` يستدعي Edge Functions عبر `apiClient` (صحيح وجيد)
- `supabase.auth.*` يبقى مباشر (مقبول)

---

## ملخص نهائي

| | العدد |
|---|---|
| ✅ ملفات منجزة | 5 |
| ⏳ ملفات متبقية | 14 |
| Edge Functions تحتاج تعديل | 9 |
| إضافات في `TABLE_API_MAP` | 5 جداول |
| Migrations جديدة | 0 |

