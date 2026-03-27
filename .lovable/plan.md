

# إصلاح المشاكل المتبقية — خطة محدثة نهائية

## ما تم التحقق منه وهو مُصلَح فعلاً ✓
- `handleRequestOpen` — مُصلَح (onSuccess/onError)
- `toggleMemberSOS` — محذوف من Settings.tsx
- `creatorRole` — مُستخدَم فعلاً وليس كود ميت
- `useChat subscription cleanup` — موجود
- `Will handleRefresh` — مُصلَح (invalidateQueries)

---

## 1. SOSButton — إصلاح شامل (حرج جداً)

`activateSOS()` حالياً = toast + صوت فقط. لا API call، لا notification حقيقي.

### التغييرات في `src/components/home/SOSButton.tsx`:
- **حذف useEffect cleanup المكرر** (سطور 91-98 — نسخة مطابقة لـ 83-90)
- **حذف localStorage لجهات الاتصال** — إزالة `STORAGE_KEY`, `SOS_DISABLED_KEY`, و useEffect الذي يحفظ فيه
- **استبدال direct DB queries**: بدل `supabase.from("family_members")` + `supabase.from("profiles")`، استدعاء:
  ```ts
  supabase.functions.invoke("family-management", {
    body: { action: "get-members", family_id: familyId }
  })
  ```
- **قراءة جهات الاتصال من DB**: استدعاء `settings-api` بـ `get-emergency-contacts` بدل localStorage
- **إصلاح `activateSOS()`**: إضافة API call حقيقي:
  ```ts
  await supabase.functions.invoke("notifications-api", {
    body: { action: "send-sos-alert", family_id: familyId }
  });
  ```
- **إصلاح `handleCancelSOS()`**: إرسال إشعار إلغاء عبر `cancel-sos-alert` بنوع مختلف

### التغييرات في `supabase/functions/notifications-api/index.ts`:

**Action: `send-sos-alert`**
1. التحقق من `family_id` + عضوية المستخدم
2. جلب أعضاء العائلة النشطين (باستثناء المُرسِل)
3. جلب اسم المُرسِل من `profiles`
4. إدخال في `user_notifications` (وليس `scheduled_notifications`) — يظهر فوراً عبر realtime
5. `is_read: false` صريح في كل insert
6. إرجاع `{ data: { notified: memberIds.length } }`

```ts
await adminClient.from("user_notifications").insert(
  memberIds.map(uid => ({
    user_id: uid, type: "sos_alert",
    title: "🚨 تنبيه طوارئ",
    body: `${senderName} يحتاج مساعدة`,
    source_type: "sos", source_id: userId, is_read: false,
  }))
);
```

**Action: `cancel-sos-alert`**
- نفس المنطق لكن بنوع **`sos_cancelled`** (وليس `sos_alert`) حتى يميّز الـ client بينهما
- `is_read: false` صريح
- العنوان: "✅ إلغاء تنبيه الطوارئ"
- الجسم: `${senderName} بخير — تم إلغاء التنبيه`

```ts
await adminClient.from("user_notifications").insert(
  memberIds.map(uid => ({
    user_id: uid, type: "sos_cancelled",
    title: "✅ إلغاء تنبيه الطوارئ",
    body: `${senderName} بخير — تم إلغاء التنبيه`,
    source_type: "sos", source_id: userId, is_read: false,
  }))
);
```

---

## 2. addSuggestion/updateSuggestion — table خاطئ

### `src/hooks/useTrips.ts`:
- `table: "trip_packing"` → `table: "trip_suggestions"` في `addSuggestion` و `updateSuggestion`

### `src/lib/db.ts`:
- إضافة `trip_suggestions!: Table;`
- إضافة في schema: `trip_suggestions: "id, trip_id, suggested_by, status"`
- Version bump من 1 إلى 2

### `src/contexts/AuthContext.tsx`:
- إضافة `db.trip_suggestions.clear()` في signOut

---

## 3. rate_limit_counters cleanup

إضافة pg_cron job:
```sql
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 */6 * * *',
  $$DELETE FROM public.rate_limit_counters
    WHERE window_start < now() - interval '24 hours'$$
);
```

---

## ترتيب التنفيذ
1. SOSButton + notifications-api (الأهم — ميزة safety)
2. useTrips + db.ts + AuthContext (trip_suggestions)
3. rate_limit_counters cron job

---

## نقاط ليست مشاكل (تم التحقق)

| النقطة | الحالة |
|--------|--------|
| handleRequestOpen race condition | مُصلَح بالفعل |
| creatorRole unused | مُستخدَم فعلاً |
| useChat subscription leak | cleanup موجود |
| useOfflineMutation INSERT duplicate | invalidateQueries يحل الأمر |
| QueryClient staleTime 10min | قرار تصميمي مقصود |
| No retry exponential | مقبول مع offline queue |
| Dark mode | يحفظ في localStorage — يعمل |
| Chat 0 أعضاء subtitle | طبيعي أثناء التحميل |

