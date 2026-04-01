

# الخطة الشاملة المحدّثة — 4 إصلاحات نهائية

## ما تم إصلاحه سابقاً (مؤكد)
- ✅ syncQueue — 8 جداول + JWT guard + labels
- ✅ resourceRegistry — childTables + warm:false
- ✅ fullSync — persistChildTables
- ✅ useMarketLists / useTaskLists — onSuccess
- ✅ useZakatAssets — table: "zakat_history"
- ✅ useFamilyRealtime — jitter عند online
- ✅ worship-api — user_id في get/save/delete
- ✅ Migration — RLS لـ prayer_logs و kids_worship_data

---

## الإصلاح 1 — signOut ناقص جدولين

`worship_children` و `trash_items` غير موجودين في قائمة `.clear()` بـ `AuthContext.tsx`.

**الإصلاح**: إضافة سطرين بعد سطر 196:
```ts
db.worship_children.clear(),
db.trash_items.clear(),
```

**ملف**: `src/contexts/AuthContext.tsx`

---

## الإصلاح 2 — Private Key extractable

في `crypto.ts` سطر 220، `loadPrivateKeyLocally` يستورد المفتاح بـ `true` (extractable). أي XSS يستخدم `exportKey` لسرقته.

**الإصلاح**: تغيير `true` إلى `false` في سطر 220:
```ts
false,  // non-extractable after initial save
```

`savePrivateKeyLocally` يبقى كما هو (يحتاج export مرة واحدة عند الإنشاء).

**ملف**: `src/lib/crypto.ts`

---

## الإصلاح 3 — الوصية SHA-256 بدون salt → PBKDF2

### النهج المعتمد (بناءً على ملاحظة المستخدم)

**لا ترقية تلقائية عند الدخول.** بدلاً منه:
- الوصايا القديمة (بدون `password_salt`) تبقى تعمل بـ SHA-256
- الوصايا الجديدة تُنشأ بـ PBKDF2
- الترقية تحدث فقط عندما يغيّر المستخدم كلمة المرور يدوياً

### التغييرات

**`src/pages/Will.tsx`**:
1. إضافة دالتين `hashPasswordPBKDF2(password, salt?)` و `verifyPasswordPBKDF2(password, hash, salt)`
2. `handleCreatePassword`: استخدام PBKDF2 دائماً (وصية جديدة) → إرسال `{ password_hash, password_salt }`
3. `handleEnterPassword`:
   ```ts
   if (!will.password_salt) {
     // نظام قديم — SHA-256
     const oldHash = await sha256(password);
     if (oldHash !== will.password_hash) { setEnterError(...); return; }
   } else {
     // نظام جديد — PBKDF2
     const valid = await verifyPasswordPBKDF2(password, will.password_hash, will.password_salt);
     if (!valid) { setEnterError(...); return; }
   }
   setIsUnlocked(true);
   ```
   لا ترقية تلقائية. لا مفاجآت.

**`supabase/functions/will-api/index.ts`**:
- `save-will` action: قبول `password_salt` من body وتخزينه مع `password_hash`

**Migration**:
```sql
ALTER TABLE wills ADD COLUMN IF NOT EXISTS password_salt text;
```

---

## الإصلاح 4 — Performance indexes

Migration لتسريع `get_family_last_updated`:
```sql
CREATE INDEX IF NOT EXISTS idx_task_lists_family_updated ON task_lists(family_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_lists_family_updated ON market_lists(family_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_events_family_created ON calendar_events(family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_family_created ON chat_messages(family_id, created_at DESC);
```

---

## ملخص الملفات

| # | الملف | التغيير |
|---|-------|---------|
| 1 | `src/contexts/AuthContext.tsx` | إضافة `worship_children` و `trash_items` في signOut |
| 2 | `src/lib/crypto.ts` | تغيير extractable إلى false |
| 3 | `src/pages/Will.tsx` | PBKDF2 للجديد + SHA-256 backward compat بدون ترقية تلقائية |
| 4 | `supabase/functions/will-api/index.ts` | قبول password_salt في save-will |
| 5 | Migration | إضافة `password_salt` + 4 performance indexes |

**5 ملفات + 1 migration**

