## المرحلة 0 — Schema ✅ مكتمل

### تم إنشاء:
- 3 Enums: `app_role`, `family_role`, `subscription_plan`
- 40+ جدول مع RLS على كل جدول
- 5 Security Definer Functions: `has_role`, `is_family_member`, `is_family_admin`, `get_user_family_id`, `is_staff_member`
- 4 Storage Buckets: `avatars`, `documents`, `album-photos`, `trip-documents`
- Realtime enabled: `chat_messages`, `market_items`, `task_items`
- Auto-create profile trigger on signup

### ملاحظات:
- `otp_codes` و `rate_limit_counters`: بدون RLS policies (تُدار من Edge Functions فقط)
- Vault + pg_cron: يُعدّان يدوياً من Dashboard (Pro plan)

---

## المرحلة التالية: المرحلة 1 — المصادقة

### المطلوب:
1. صفحة Auth.tsx (OTP + Google)
2. AuthContext.tsx (إدارة الجلسة)
3. AuthGuard.tsx (حماية المسارات)
4. تفعيل Phone Auth + Google OAuth من Dashboard
5. ربط Twilio
