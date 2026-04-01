

# خطة إصلاح شاملة — 8 نقاط (محدّثة)

كلام المستخدم عن `OTP_HMAC_SECRET` المستقل صحيح 100%. الخطة محدّثة لتعكس ذلك.

---

## 1. syncQueue — إضافة UPDATE لـ 4 جداول قوائم

**ملف**: `src/lib/syncQueue.ts` — سطور 44, 54, 112, 176

إضافة `UPDATE: "update-list"` لـ `task_lists`, `market_lists`, `document_lists`, `place_lists`.

---

## 2. resourceRegistry — إضافة document_files و trip_documents

**ملف**: `src/lib/resourceRegistry.ts`

- سطر 110: إضافة `nested: [{ key: "document_files", table: "document_files" }]` داخل `document_items` child
- إضافة entry جديد: `{ table: "document_files", ..., warm: false, fullSync: null }`
- سطر 98: إضافة `{ key: "trip_documents", table: "trip_documents" }` في trips childTables
- إضافة entry جديد: `{ table: "trip_documents", ..., warm: false, fullSync: null }`

---

## 3. otp_codes — deny RLS policy

**Migration**:
```sql
CREATE POLICY "No client access" ON otp_codes 
  FOR ALL TO authenticated, anon USING (false);
```

---

## 4. phone-auth — HMAC بـ OTP_HMAC_SECRET مستقل

**ملف**: `supabase/functions/phone-auth/index.ts`

استبدال `sha256Hex` (سطر 42-48) بـ `hmacHex`:
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

استبدال كل استدعاء `sha256Hex` بـ `hmacHex` (في send-otp و verify-otp).

**Secret**: إضافة `OTP_HMAC_SECRET` عبر أداة secrets (قيمة عشوائية 64+ حرف). Fallback لـ `SUPABASE_SERVICE_ROLE_KEY` يضمن عمل التطبيق فوراً بدون إعداد.

**لماذا مستقل؟**: فصل المسؤوليات — rotation لـ SERVICE_ROLE_KEY لا يكسر OTPs النشطة. الخطر منخفض أصلاً (5 دقائق) لكن هذا أنظف.

---

## 5. localBootstrap — استخدام getMeaningfulLocalDataState

**ملف**: `src/lib/localBootstrap.ts`

استبدال العد اليدوي لـ 3 جداول (سطر 39-48) بـ:
```ts
import { getMeaningfulLocalDataState } from "./meaningfulLocalData";

const [profile, member, meaningful] = await Promise.all([
  db.profiles.toCollection().first(),
  db.family_members.toCollection().first(),
  getMeaningfulLocalDataState(),
]);
hasLocalData = meaningful.hasMeaningfulLocalData || !!member;
```

---

## 6. useFamilyRealtime — jitter لـ polling

**ملف**: `src/hooks/useFamilyRealtime.ts` — سطر 61-65

```ts
const interval = setInterval(() => {
  if (document.visibilityState === "visible") {
    setTimeout(() => invalidateAll(), Math.random() * 30_000);
  }
}, POLL_INTERVAL_MS);
```

---

## 7. App.tsx — إزالة cacheReady من deps

**ملف**: `src/App.tsx` — سطر 187

إزالة `cacheReady` من dependency array.

---

## 8. fullSync — timeout 30s

**ملف**: `src/lib/fullSync.ts`

إضافة `fetchWithTimeout` helper واستخدامه لكل step:
```ts
const fetchWithTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
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
| 3 | `src/lib/fullSync.ts` | إضافة timeout 30s |
| 4 | `src/lib/localBootstrap.ts` | استبدال العد اليدوي بـ `getMeaningfulLocalDataState()` |
| 5 | `src/hooks/useFamilyRealtime.ts` | إضافة jitter لـ setInterval |
| 6 | `src/App.tsx` | إزالة `cacheReady` من dependency array |
| 7 | `supabase/functions/phone-auth/index.ts` | HMAC بـ `OTP_HMAC_SECRET` مع fallback |
| 8 | Migration | deny policy لـ `otp_codes` |
| 9 | Secret (اختياري) | `OTP_HMAC_SECRET` |

**8 ملفات + 1 migration + 1 secret اختياري**

