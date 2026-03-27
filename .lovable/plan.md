

# خطة إصلاح المشاكل الحرجة والأداء والاستقرار — النسخة النهائية

---

## المرحلة 1: مشاكل حرجة

### 1. Rate Limit — DB Function ذرية + UNIQUE constraint
- **Migration**:
  1. حذف duplicates قبل إضافة الـ constraint
  2. إضافة `UNIQUE(user_id, endpoint)`
  3. إنشاء دالة `check_rate_limit` ذرية بـ `ON CONFLICT DO UPDATE`

```sql
DELETE FROM rate_limit_counters a
USING rate_limit_counters b
WHERE a.id > b.id AND a.user_id = b.user_id AND a.endpoint = b.endpoint;

ALTER TABLE rate_limit_counters ADD CONSTRAINT rate_limit_unique UNIQUE (user_id, endpoint);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id uuid, _endpoint text, _max_per_minute int DEFAULT 60
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE _count int;
BEGIN
  INSERT INTO rate_limit_counters (user_id, endpoint, count, window_start)
  VALUES (_user_id, _endpoint, 1, now())
  ON CONFLICT (user_id, endpoint) DO UPDATE SET
    count = CASE WHEN rate_limit_counters.window_start > now() - interval '1 minute'
      THEN rate_limit_counters.count + 1 ELSE 1 END,
    window_start = CASE WHEN rate_limit_counters.window_start > now() - interval '1 minute'
      THEN rate_limit_counters.window_start ELSE now() END
  RETURNING count INTO _count;
  RETURN _count <= _max_per_minute;
END; $$;
```

- **Edge Functions**: استبدال كود `checkRateLimit` المكرر في ~15 function بـ:
```ts
const { data: allowed } = await adminClient.rpc("check_rate_limit", {
  _user_id: userId, _endpoint: "function-name", _max_per_minute: 60
});
if (!allowed) return json({ error: "Too many requests" }, 429);
```

### 2. CORS — تقييد Origins عبر env variable
- قراءة `ALLOWED_ORIGINS` من environment variable
- إنشاء helper في كل function:

```ts
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map(s => s.trim()).filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}
```

- **Fallback آمن**: إذا كان `ALLOWED_ORIGINS` فارغاً (نسيان إضافة الـ secret)، القيمة ستكون `""` — المتصفح سيرفض الطلب بدل السماح للجميع
- **يجب إضافة secret**: `ALLOWED_ORIGINS` بقيمة:
  `https://ailti.app,https://www.ailti.app,https://ailti.lovable.app,capacitor://localhost,http://localhost:8080`
- تحديث جميع Edge Functions (~15 ملف)

### 3. warmCache — إضافة trip_suggestions
- إضافة `{ table: "trip_suggestions", queryKeyPrefix: "trips" }` في `warmCache.ts`
- `trip_packing` موجود فعلاً — يبقى كما هو

### 4. useInitialSync — إصلاح منطق "حساب جديد"
- استبدال فحص الدقيقتين بمنطق أوضح:
  - إذا `first_sync_done` غير موجود + لا بيانات في IndexedDB → فحص السحاب عبر `get-last-updated`
  - إذا أرجع `null` → حساب جديد فعلاً
  - إذا أرجع timestamp → جهاز جديد لحساب قديم → مزامنة
  - بعد أول sync ناجح → `localStorage.first_sync_done = "1"`

### 5. Documents — Storage بدل base64
- رفع الملفات الجديدة إلى Supabase Storage bucket `documents`
- **التوافقية مع البيانات القديمة**:
```ts
const isLegacy = file.url.startsWith("data:");
// legacy → عرض مباشر من base64
// https → جلب signed URL من Storage
```
- القديمة تعمل كما هي — الجديدة فقط تُرفع إلى Storage

---

## المرحلة 2: مشاكل الأداء

### 6. useOfflineFirst — التأكد من useCallback
- مراجعة جميع hooks التي تستخدم `useOfflineFirst` والتأكد من أن `apiFn` ملفوفة بـ `useCallback` بـ dependencies صحيحة

### 7. Delta Sync — البدء بـ chat_messages فقط
- إضافة فلتر `since` في `chat-api` action `get-messages`
- تمرير `lastSyncedAt` من `useChat` إلى الـ API

### 8. chat_messages — pagination
- إضافة `limit(50)` + `cursor` في `chat-api`
- infinite scroll في واجهة الدردشة

### 9. location-api — throttle
- تغيير `maxPerMinute` إلى `10` لـ action `update`

---

## المرحلة 3: UX والاستقرار

### 10. AuthGuard — API fallback
- إذا غاب `cached_family_id` من localStorage → استدعاء API قبل التوجيه لـ `join-or-create`

### 11. useMyRole — staleTime
- تقليل من 30 دقيقة إلى 5 دقائق + invalidation عند `visibilitychange`

### 12. eslint — تفعيل no-unused-vars
- تغيير من `"off"` إلى `"warn"`

### 13. ParentDashboard — إصلاح dark mode
- سطر 104: `from-purple-50 via-pink-50 to-amber-50` → إضافة `dark:from-background dark:via-background dark:to-background`
- سطر 362: `from-purple-50 to-pink-50` → إضافة `dark:from-muted dark:to-muted`
- سطر 371: `bg-purple-100` → إضافة `dark:bg-muted`
- سطر 420: `bg-amber-50` → إضافة `dark:bg-amber-950`

---

## ترتيب التنفيذ

| # | المهمة | الملفات | الجهد |
|---|---|---|---|
| 1 | Rate limit DB function + UNIQUE | Migration + ~15 Edge Functions | 30 دقيقة |
| 2 | CORS env variable (fallback آمن `""`) | Secret + ~15 Edge Functions | 15 دقيقة |
| 3 | warmCache trip_suggestions | `warmCache.ts` | دقيقة |
| 4 | useInitialSync إصلاح | `useInitialSync.ts` | 5 دقائق |
| 5 | Documents Storage | `Documents.tsx` | 15 دقيقة |
| 6 | AuthGuard API fallback | `AuthGuard.tsx` | 10 دقائق |
| 7 | useMyRole staleTime | `useMyRole.ts` | دقيقة |
| 8 | location throttle | `location-api/index.ts` | دقيقة |
| 9 | eslint warn | `eslint.config.js` | دقيقة |
| 10 | ParentDashboard dark mode | `ParentDashboard.tsx` | 5 دقائق |
| 11 | Delta sync (chat فقط) | `chat-api` + `useChat` | 20 دقيقة |
| 12 | Chat pagination | `chat-api` + Chat UI | 15 دقيقة |

