import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Normalize phone:
// - If starts with "+" → strip "+" and use as-is (frontend already sends E.164)
// - Else fallback to Saudi Arabia logic for backward compatibility
const normalizePhone = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) {
    return trimmed.slice(1).replace(/\D/g, "");
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("0")) return `966${digits.slice(1)}`;
  if (digits.startsWith("5")) return `966${digits}`;
  return digits;
};

const findUserById = async (
  adminClient: any,
  fullPhone: string,
  email: string,
  normalizedPhone: string,
) => {
  const phonesAndEmails = [
    { _phone: fullPhone, _email: email },
    { _phone: normalizedPhone, _email: `user-${normalizedPhone}@ailti.app` },
  ];

  for (const params of phonesAndEmails) {
    const { data: userId, error } = await adminClient.rpc("find_user_by_phone_or_email", params);
    if (error) throw error;
    if (typeof userId === "string" && userId) {
      const { data: userData, error: userErr } = await adminClient.auth.admin.getUserById(userId);
      if (userErr) throw userErr;
      if (userData?.user) return userData.user;
    }
  }
  return null;
};

// ── Audit logger ──
async function logOtpAudit(
  adminClient: any,
  phone: string,
  action: string,
  success: boolean,
  req: Request,
  details?: Record<string, unknown>,
) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;
    const userAgent = req.headers.get("user-agent") || null;
    await adminClient.from("otp_audit_log").insert({
      phone,
      action,
      success,
      ip_address: ip,
      user_agent: userAgent,
      details: details ?? null,
    });
  } catch {
    // Don't let audit logging break the flow
  }
}

// ── Twilio Verify helper ──
async function twilioVerifyRequest(path: string, body: Record<string, string>) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not configured");
  }
  const credentials = btoa(`${accountSid}:${authToken}`);
  const res = await fetch(`https://verify.twilio.com/v2${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// Map Twilio error codes → friendly Arabic messages
function twilioErrorMessage(code: number | string | undefined): string {
  const c = String(code ?? "");
  switch (c) {
    case "60200":
      return "رقم الجوال غير صالح";
    case "60203":
      return "تم تجاوز الحد المسموح من المحاولات. حاول لاحقاً";
    case "60212":
      return "تم تجاوز الحد المسموح من المحاولات. حاول لاحقاً";
    case "60410":
      return "تم حظر هذا الرقم مؤقتاً. حاول لاحقاً";
    case "20429":
      return "النظام مشغول حالياً، حاول بعد قليل";
    default:
      return "تعذر إرسال رمز التحقق. حاول مرة أخرى";
  }
}

// ─── Handler ────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { action, phone, code, channel } = await req.json();

    if (!action || !phone) {
      return json({ error: "action و phone مطلوبان" }, 400);
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 8) {
      return json({ error: "رقم جوال غير صالح" }, 400);
    }
    const fullPhone = `+${normalizedPhone}`;
    const email = `${normalizedPhone}@phone.ailti.app`;

    const verifyServiceSid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");
    if (!verifyServiceSid) {
      console.error("[phone-auth] TWILIO_VERIFY_SERVICE_SID not configured");
      return json({ error: "خدمة التحقق غير مهيأة" }, 500);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ━━━━━━━━━━━━━━━ send-otp ━━━━━━━━━━━━━━━
    if (action === "send-otp") {
      const sendChannel = channel === "whatsapp" ? "whatsapp" : "sms";

      const { ok, status, data } = await twilioVerifyRequest(
        `/Services/${verifyServiceSid}/Verifications`,
        { To: fullPhone, Channel: sendChannel },
      );

      if (!ok || data?.status === "failed" || data?.status === "canceled") {
        await logOtpAudit(adminClient, normalizedPhone, "send", false, req, {
          twilio_status: status,
          twilio_code: data?.code,
          twilio_message: data?.message,
        });
        return json({ error: twilioErrorMessage(data?.code) }, status >= 400 ? status : 400);
      }

      await logOtpAudit(adminClient, normalizedPhone, "send", true, req, {
        channel: sendChannel,
        sid: data?.sid,
      });

      return json({ success: true });
    }

    // ━━━━━━━━━━━━━━━ verify-otp ━━━━━━━━━━━━━━━
    if (action === "verify-otp") {
      if (!code || typeof code !== "string" || code.length < 4 || code.length > 10) {
        return json({ error: "رمز التحقق مطلوب" }, 400);
      }

      const { ok, status, data } = await twilioVerifyRequest(
        `/Services/${verifyServiceSid}/VerificationCheck`,
        { To: fullPhone, Code: code },
      );

      if (!ok || data?.status !== "approved") {
        await logOtpAudit(adminClient, normalizedPhone, "verify", false, req, {
          twilio_status: status,
          twilio_check_status: data?.status,
          twilio_code: data?.code,
          twilio_message: data?.message,
        });
        const errMsg =
          data?.status === "pending"
            ? "رمز التحقق غير صحيح"
            : twilioErrorMessage(data?.code) || "رمز التحقق غير صحيح أو منتهي الصلاحية";
        return json({ error: errMsg }, 401);
      }

      // Find or create user
      let user = await findUserById(adminClient, fullPhone, email, normalizedPhone);

      if (!user) {
        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email,
          phone: fullPhone,
          email_confirm: true,
          phone_confirm: true,
          user_metadata: { name: "" },
        });

        if (createErr) {
          if (createErr.message?.toLowerCase().includes("phone")) {
            user = await findUserById(adminClient, fullPhone, email, normalizedPhone);
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

      await logOtpAudit(adminClient, normalizedPhone, "verify", true, req, { user_id: user.id });

      return json({
        token_hash: tokenHash,
        type: "magiclink",
      });
    }

    return json({ error: `action غير معروف: ${action}` }, 400);
  } catch (err) {
    console.error("[phone-auth]", err);
    return json({ error: "حدث خطأ داخلي" }, 500);
  }
});
