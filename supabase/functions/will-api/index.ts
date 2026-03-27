import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

let corsHeaders: Record<string, string> = {};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_REASON = 500;
const MAX_SECTIONS = 50000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }

// SHA-256 hash helper
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "will-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-will") {
      const { data, error } = await supabase.from("wills" as any).select("*").eq("user_id", userId).maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "save-will") {
      const { sections, password_hash, is_locked } = body;
      if (sections !== undefined && typeof sections !== "object") return json({ error: "البيانات غير صالحة" }, 400);
      if (sections && JSON.stringify(sections).length > MAX_SECTIONS) return json({ error: "حجم البيانات كبير جداً" }, 400);
      if (password_hash && typeof password_hash !== "string") return json({ error: "كلمة المرور غير صالحة" }, 400);
      if (is_locked !== undefined && typeof is_locked !== "boolean") return json({ error: "is_locked يجب أن يكون true أو false" }, 400);
      const { data: existing } = await supabase.from("wills" as any).select("id").eq("user_id", userId).maybeSingle();
      if (existing) {
        const { data, error } = await supabase.from("wills" as any).update({ sections, password_hash, is_locked }).eq("id", existing.id).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      } else {
        const { data, error } = await supabase.from("wills" as any).insert({ user_id: userId, sections, password_hash, is_locked: is_locked || false }).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
    }

    if (action === "request-open") {
      const { will_id, reason } = body;
      if (!validUuid(will_id)) return json({ error: "will_id غير صالح" }, 400);
      if (reason && typeof reason === "string" && reason.length > MAX_REASON) return json({ error: "السبب طويل جداً" }, 400);
      const { data, error } = await supabase.from("will_open_requests" as any).insert({ will_id, requested_by: userId, reason: reason ? reason.trim().slice(0, MAX_REASON) : null }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-will") {
      const { data: existing } = await supabase.from("wills" as any).select("id").eq("user_id", userId).maybeSingle();
      if (!existing) return json({ error: "No will found" }, 404);
      const { error } = await supabase.from("wills" as any).delete().eq("id", existing.id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // ── Request reset OTP: generate 6-digit code, store hash, return code (for now) ──
    if (action === "request-reset-otp") {
      // Rate limit: max 3 reset requests per minute
      if (!await checkRateLimit(adminClient, userId, "will-reset-otp", 3)) {
        return json({ error: "طلبات كثيرة. انتظر دقيقة." }, 429);
      }

      // Get user phone from profile
      const { data: profile } = await adminClient.from("profiles").select("phone").eq("id", userId).maybeSingle();
      if (!profile?.phone) return json({ error: "لا يوجد رقم جوال مسجل في حسابك" }, 400);

      // Generate 6-digit code
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = await sha256(code);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

      // Store in otp_codes
      await adminClient.from("otp_codes").insert({
        phone: profile.phone,
        code_hash: codeHash,
        expires_at: expiresAt,
        verified: false,
        attempts: 0,
      });

      // TODO: Send SMS via Twilio when connected
      // For now, return code for testing
      return json({ success: true, code, phone: profile.phone.replace(/.(?=.{4})/g, "*") });
    }

    // ── Verify reset OTP ──
    if (action === "verify-reset-otp") {
      const { code } = body;
      if (!code || typeof code !== "string" || code.length !== 6) {
        return json({ error: "الرمز غير صالح" }, 400);
      }

      // Get user phone
      const { data: profile } = await adminClient.from("profiles").select("phone").eq("id", userId).maybeSingle();
      if (!profile?.phone) return json({ error: "لا يوجد رقم جوال" }, 400);

      // Find latest unexpired, unverified OTP for this phone
      const { data: otpRecord } = await adminClient
        .from("otp_codes")
        .select("*")
        .eq("phone", profile.phone)
        .eq("verified", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otpRecord) return json({ error: "الرمز منتهي الصلاحية. أعد الطلب." }, 400);

      // Check attempts
      if (otpRecord.attempts >= 5) {
        return json({ error: "تم تجاوز عدد المحاولات. أعد الطلب." }, 400);
      }

      // Increment attempts
      await adminClient.from("otp_codes").update({ attempts: otpRecord.attempts + 1 }).eq("id", otpRecord.id);

      // Verify hash
      const inputHash = await sha256(code);
      if (inputHash !== otpRecord.code_hash) {
        return json({ error: "الرمز غير صحيح" }, 400);
      }

      // Mark as verified
      await adminClient.from("otp_codes").update({ verified: true }).eq("id", otpRecord.id);

      return json({ success: true, verified: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
