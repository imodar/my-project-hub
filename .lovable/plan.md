

# تحويل شاشة الدخول إلى نظام OTP نظامي — خطة نهائية

## القرار المحسوم: الخيار 3

Edge function تُرجع `token_hash` → Client يستدعي `supabase.auth.verifyOtp()`. هذا هو الـ flow الرسمي لـ Supabase.

```text
Client                     phone-auth (Edge Function)              DB
──────                     ──────────────────────────              ──
1. send-otp(phone)    →    يولّد OTP 6 أرقام                      يخزن hash في otp_codes
                      ←    { success: true, code }  ← مؤقت للتوست

2. verify-otp         →    يتحقق من hash + صلاحية + attempts       يحذف OTP
   (phone, code)           يبحث/ينشئ المستخدم
                           يستدعي admin.generateLink(magiclink)
                      ←    { token_hash, type: "magiclink" }

3. Client يستدعي:
   supabase.auth.verifyOtp({ token_hash, type: "magiclink" })
   → Session تُنشأ تلقائياً ✓
```

## التغييرات

### 1. Edge Function جديدة: `supabase/functions/phone-auth/index.ts`

**`send-otp`:**
- Rate limit: max 5 أكواد لنفس الرقم خلال 10 دقائق
- حذف OTP قديم لنفس الرقم
- توليد كود 6 أرقام + تخزين SHA-256 hash في `otp_codes`
- مؤقتاً: إرجاع `code` في الرد (يُحذف عند ربط SMS)

**`verify-otp`:**
- مطابقة hash(code) مع `otp_codes` + التحقق من expires_at + attempts < 5
- فشل → زيادة attempts + إرجاع 401
- نجاح → حذف السطر، ثم:

```ts
const email = `${normalizedPhone}@phone.ailti.app`;

// ابحث عن المستخدم أو أنشئه
let user = await findUserByPhone(adminClient, normalizedPhone);
if (!user) {
  const { data } = await adminClient.auth.admin.createUser({
    email,
    phone: fullPhone,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { name: "" },
  });
  user = data.user;
}

// generateLink → أرجع token_hash للـ client
const { data: linkData } = await adminClient.auth.admin.generateLink({
  type: "magiclink",
  email: user.email,
});

return { token_hash: linkData.properties.hashed_token, type: "magiclink" };
```

### 2. `src/pages/Auth.tsx`

**sendOtp:**
```ts
const res = await supabase.functions.invoke("phone-auth", {
  body: { action: "send-otp", phone: fullPhone },
});
if (res.data?.error) throw new Error(res.data.error);
if (res.data?.code) {
  appToast.info(`رمز التحقق: ${res.data.code}`, "مؤقت");
}
setStep("otp");
setCountdown(60);
```

**verifyOtp:**
```ts
const res = await supabase.functions.invoke("phone-auth", {
  body: { action: "verify-otp", phone: fullPhone, code },
});
if (res.data?.error) throw new Error(res.data.error);

// الخطوة الحاسمة — verifyOtp من client SDK
const { error } = await supabase.auth.verifyOtp({
  token_hash: res.data.token_hash,
  type: "magiclink",
});
if (error) throw error;
appToast.success("تم الدخول بنجاح ✓");
```

- حذف `generatedOtp` state
- حذف المقارنة المحلية `code !== generatedOtp`
- حذف `supabase.auth.setSession()` — `verifyOtp` يُنشئ الجلسة تلقائياً

### 3. حذف `test-login`
- حذف `supabase/functions/test-login/index.ts`
- في `supabase/config.toml`: حذف `[functions.test-login]` + إضافة `[functions.phone-auth]`

### 4. لا migration مطلوب
جدول `otp_codes` موجود بالأعمدة المطلوبة: `phone`, `code_hash`, `expires_at`, `attempts`, `verified`.

## ملخص الملفات

| الملف | التعديل |
|-------|---------|
| `supabase/functions/phone-auth/index.ts` | **جديد** |
| `supabase/functions/test-login/index.ts` | **حذف** |
| `supabase/config.toml` | حذف test-login + إضافة phone-auth |
| `src/pages/Auth.tsx` | استدعاء phone-auth + verifyOtp من client |

4 ملفات، لا secrets جديدة، لا migration.

