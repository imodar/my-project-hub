# خطة إصلاح شاملة — 8 نقاط

## 1. syncQueue — إضافة UPDATE لـ 4 جداول قوائم

**ملف**: `src/lib/syncQueue.ts`

إضافة `UPDATE: "update-list"` لـ `task_lists`, `market_lists`, `document_lists`, `place_lists`. حالياً فقط INSERT و DELETE معرّفة — أي تعديل اسم قائمة offline لن يُزامن.

---

## 2. resourceRegistry — إضافة document_files و trip_documents

**ملف**: `src/lib/resourceRegistry.ts`

- إضافة `document_files` كـ nested تحت `document_items` (مؤكد: documents-api يرجع `*.document_items(*.document_files(*))`)
- إضافة `trip_documents` كـ child مباشر لـ trips (مؤكد: trips-api يرجع `trip_documents(*)`)
- إضافة entries جديدة للجدولين مع `warm: false` و `fullSync: null`

---

## 3. otp_codes — إضافة deny RLS policy

**ملف**: Migration

```sql
CREATE POLICY "No client access" ON otp_codes 
  FOR ALL TO authenticated, anon USING (false);
```

الجدول يُدار بـ service_role فقط. هذا يمنع أي محاولة وصول من client.

---

## 4. phone-auth — HMAC بـ OTP_HMAC_SECRET مستقل

**ملف**: `supabase/functions/phone-auth/index.ts`

استبدال `sha256Hex` بـ `hmacHex` تستخدم secret مستقل:

```ts
async function hmacHex(text: string): Promise<string> {
  const secret = Deno.env.get("OTP_HMAC_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}
```

**لماذا secret مستقل؟**: إذا تغيّر `SUPABASE_SERVICE_ROLE_KEY` (rotation)، الـ OTP hashes المخزونة تصبح غير قابلة للتحقق. بما أن OTP تنتهي خلال 5 دقائق الخطر منخفض، لكن فصل المسؤوليات أنظف.

**Fallback**: إذا `OTP_HMAC_SECRET` غير موجود، يستخدم `SUPABASE_SERVICE_ROLE_KEY` كـ fallback — التطبيق يعمل فوراً بدون إعداد إضافي.

**Secret**: إضافة `OTP_HMAC_SECRET` عبر أداة الـ secrets (قيمة عشوائية 64+ حرف). يمكن إضافته لاحقاً — الـ fallback يضمن عمل التطبيق.

---

## 5. localBootstrap — يعتمد على 3 جداول فقط

**ملف**: `src/lib/localBootstrap.ts`

استبدال العد اليدوي لـ `task_lists + market_lists + budgets` بـ `getMeaningfulLocalDataState()` الموجودة فعلاً والتي تعد كل الجداول.

---

## 6. useFamilyRealtime — polling بدون jitter

**ملف**: `src/hooks/useFamilyRealtime.ts`

إضافة jitter داخل callback الـ setInterval:
```ts
const interval = setInterval(() => {
  if (document.visibilityState === "visible") {
    setTimeout(() => invalidateAll(), Math.random() * 30_000);
  }
}, POLL_INTERVAL_MS);
```

---

## 7. App.tsx — cacheReady في dependency array

**ملف**: `src/App.tsx`

إزالة `cacheReady` من dependency array — هو يُعيَّن داخل الـ effect نفسه، وهذا anti-pattern قد يسبب re-run غير مقصود.

---

## 8. fullSync — إضافة timeout

**ملف**: `src/lib/fullSync.ts`

إضافة timeout 30 ثانية لكل step:
```ts
const fetchWithTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
```

---

## ملخص الملفات

| # | الملف | التغيير |
|---|-------|---------|
| 1 | `src/lib/syncQueue.ts` | إضافة `UPDATE: "update-list"` لـ 4 جداول |
| 2 | `src/lib/resourceRegistry.ts` | إضافة `document_files` nested + `trip_documents` child + 2 entries |
| 3 | `src/lib/fullSync.ts` | إضافة timeout 30s لكل step |
| 4 | `src/lib/localBootstrap.ts` | استبدال العد اليدوي بـ `getMeaningfulLocalDataState()` |
| 5 | `src/hooks/useFamilyRealtime.ts` | إضافة jitter لـ setInterval |
| 6 | `src/App.tsx` | إزالة `cacheReady` من dependency array |
| 7 | `supabase/functions/phone-auth/index.ts` | HMAC بـ `OTP_HMAC_SECRET` مع fallback |
| 8 | Migration | deny policy لـ `otp_codes` |
| 9 | Secret (اختياري) | إضافة `OTP_HMAC_SECRET` |

**8 ملفات + 1 migration + 1 secret اختياري**