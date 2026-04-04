import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const PROJECT_ORIGIN_FALLBACKS = [
  "https://7571dddb-1161-4f53-9036-32778235da46.lovableproject.com",
  "https://id-preview--7571dddb-1161-4f53-9036-32778235da46.lovable.app",
  "https://ailti.lovable.app",
  "https://d0479375-ab8c-4895-86c0-45a5df6d51d8.lovableproject.com",
];

const ALLOWED_ORIGINS = Array.from(new Set([
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ...PROJECT_ORIGIN_FALLBACKS,
]));

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

const normalizePhone = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("0")) return `966${digits.slice(1)}`;
  if (digits.startsWith("5")) return `966${digits}`;
  return digits;
};

async function hmacHex(text: string): Promise<string> {
  const secret = Deno.env.get("OTP_HMAC_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const findUserById = async (
  adminClient: ReturnType<typeof createClient>,
  fullPhone: string,
  email: string,
) => {
  const { data: userId, error } = await adminClient.rpc("find_user_by_phone_or_email", {
    _phone: fullPhone,
    _email: email,
  });
  if (error) throw error;
  if (!userId) return null;
  const { data: userData, error: userErr } = await adminClient.auth.admin.getUserById(userId);
  if (userErr) throw userErr;
  return userData?.user ?? null;
};

// ─── Handler ────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { action, phone, code } = await req.json();

    if (!action || !phone) {
      return json({ error: "action و phone مطلوبان" }, 400);
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 12) {
      return json({ error: "رقم جوال غير صالح" }, 400);
    }
    const fullPhone = `+${normalizedPhone}`;
    const email = `${normalizedPhone}@phone.ailti.app`;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ━━━━━━━━━━━━━━━ send-otp ━━━━━━━━━━━━━━━
    if (action === "send-otp") {
      // Rate limit: max 5 codes per phone in 10 minutes
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count } = await adminClient
        .from("otp_codes")
        .select("id", { count: "exact", head: true })
        .eq("phone", normalizedPhone)
        .gte("created_at", tenMinAgo);

      if ((count ?? 0) >= 5) {
        return json({ error: "تم تجاوز الحد الأقصى. حاول بعد 10 دقائق" }, 429);
      }

      // Delete old OTPs for same phone
      await adminClient.from("otp_codes").delete().eq("phone", normalizedPhone);

      // Generate 6-digit code
      const otpCode = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = await hmacHex(otpCode);

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const { error: insertErr } = await adminClient.from("otp_codes").insert({
        phone: normalizedPhone,
        code_hash: codeHash,
        expires_at: expiresAt,
        attempts: 0,
        verified: false,
      });

      if (insertErr) throw insertErr;

      // مؤقت: إرجاع الكود للتوست (يُحذف عند ربط SMS)
      return json({ success: true, code: otpCode });
    }

    // ━━━━━━━━━━━━━━━ verify-otp ━━━━━━━━━━━━━━━
    if (action === "verify-otp") {
      if (!code || typeof code !== "string" || code.length !== 6) {
        return json({ error: "رمز التحقق مطلوب (6 أرقام)" }, 400);
      }

      const codeHash = await hmacHex(code);

      // Find matching OTP
      const { data: otpRow, error: otpErr } = await adminClient
        .from("otp_codes")
        .select("*")
        .eq("phone", normalizedPhone)
        .eq("code_hash", codeHash)
        .eq("verified", false)
        .gte("expires_at", new Date().toISOString())
        .lt("attempts", 5)
        .maybeSingle();

      if (otpErr) throw otpErr;

      if (!otpRow) {
        // Increment attempts on all non-expired codes for this phone
        const { data: rows } = await adminClient
          .from("otp_codes")
          .select("id, attempts")
          .eq("phone", normalizedPhone)
          .eq("verified", false);

        if (rows && rows.length > 0) {
          for (const r of rows) {
            await adminClient
              .from("otp_codes")
              .update({ attempts: (r.attempts ?? 0) + 1 })
              .eq("id", r.id);
          }
        }

        return json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية" }, 401);
      }

      // OTP is valid — delete it
      await adminClient.from("otp_codes").delete().eq("id", otpRow.id);

      // Find or create user
      let user = await findUserByPhone(adminClient, normalizedPhone, email);

      if (!user) {
        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email,
          phone: fullPhone,
          email_confirm: true,
          phone_confirm: true,
          user_metadata: { name: "" },
        });

        if (createErr) {
          // Phone might already exist under a different email
          if (createErr.message?.toLowerCase().includes("phone")) {
            user = await findUserByPhone(adminClient, normalizedPhone, email);
            if (!user) throw createErr;
          } else {
            throw createErr;
          }
        } else {
          user = newUser.user;
        }
      }

      if (!user) {
        return json({ error: "تعذر العثور على المستخدم أو إنشاؤه" }, 500);
      }

      // Generate magic link token
      const { data: linkData, error: linkErr } =
        await adminClient.auth.admin.generateLink({
          type: "magiclink",
          email: user.email!,
        });

      if (linkErr) throw linkErr;

      const tokenHash = linkData?.properties?.hashed_token;
      if (!tokenHash) {
        return json({ error: "فشل إنشاء رمز الجلسة" }, 500);
      }

      return json({
        token_hash: tokenHash,
        type: "magiclink",
      });
    }

    return json({ error: `action غير معروف: ${action}` }, 400);
  } catch (err) {
    return json({ error: getErrorMessage(err) }, 500);
  }
});
