import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

let corsHeaders: Record<string, string> = {};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_NAME = 100;
const MAX_PHONE = 30;
const MAX_TOKEN = 500;
const MAX_VERSION = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }
function validStr(v: unknown, max: number): v is string { return typeof v === "string" && v.trim().length > 0 && v.length <= max; }
function sanitize(s: string, max: number): string { return s.trim().slice(0, max); }

Deno.serve(async (req) => {
  corsHeaders = corsHeaders;
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "settings-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-emergency-contacts") {
      const { family_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      const { data, error } = await supabase.from("emergency_contacts").select("*").eq("family_id", family_id);
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-emergency-contact") {
      const { family_id, name, phone } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب (حد أقصى 100)" }, 400);
      if (!validStr(phone, MAX_PHONE)) return json({ error: "رقم الهاتف مطلوب (حد أقصى 30)" }, 400);
      const { data, error } = await supabase.from("emergency_contacts").insert({ family_id, name: sanitize(name, MAX_NAME), phone: sanitize(phone, MAX_PHONE), created_by: userId }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-emergency-contact") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("emergency_contacts").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "log-consent") {
      const { consent_type, version, accepted, ip_address } = body;
      if (!validStr(consent_type, 50)) return json({ error: "نوع الموافقة مطلوب" }, 400);
      if (!validStr(version, MAX_VERSION)) return json({ error: "الإصدار مطلوب" }, 400);
      const { data, error } = await supabase.from("consent_log").insert({ user_id: userId, consent_type: sanitize(consent_type, 50), version: sanitize(version, MAX_VERSION), accepted: accepted !== false, ip_address: ip_address ? sanitize(ip_address, 50) : null }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "register-token") {
      const { token, device_info, platform } = body;
      if (!validStr(token, MAX_TOKEN)) return json({ error: "التوكن مطلوب" }, 400);
      if (device_info && typeof device_info === "string" && device_info.length > 200) return json({ error: "معلومات الجهاز طويلة جداً" }, 400);
      if (platform && typeof platform === "string" && platform.length > 30) return json({ error: "المنصة طويلة جداً" }, 400);
      const { data: existing } = await supabase.from("notification_tokens").select("id").eq("token", token).maybeSingle();
      if (existing) {
        const { data, error } = await supabase.from("notification_tokens").update({ user_id: userId, device_info, platform }).eq("id", existing.id).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      } else {
        const { data, error } = await supabase.from("notification_tokens").insert({ user_id: userId, token: token.slice(0, MAX_TOKEN), device_info, platform }).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
