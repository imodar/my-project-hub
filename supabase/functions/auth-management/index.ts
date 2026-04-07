import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_NAME = 100;
const MAX_PHONE = 30;
const MAX_URL = 2000;

function validStr(v: unknown, max: number): v is string { return typeof v === "string" && v.length <= max; }
function sanitize(s: string, max: number): string { return s.trim().slice(0, max); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;
    const _rlClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    { const { data: _rlOk } = await _rlClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "auth-management", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body._method || body.action || "GET";

    if (action === "GET" || action === "get-profile") {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "PUT" || action === "update-profile") {
      const { name, phone, avatar_url } = body;
      if (name !== undefined && !validStr(name, MAX_NAME)) return json({ error: "الاسم طويل جداً (حد أقصى 100)" }, 400);
      if (phone !== undefined && !validStr(phone, MAX_PHONE)) return json({ error: "رقم الهاتف طويل جداً (حد أقصى 30)" }, 400);
      if (avatar_url !== undefined && avatar_url !== null && !validStr(avatar_url, MAX_URL)) return json({ error: "رابط الصورة طويل جداً" }, 400);
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name ? sanitize(name, MAX_NAME) : name;
      if (phone !== undefined) updates.phone = phone ? sanitize(phone, MAX_PHONE) : phone;
      if (avatar_url !== undefined) updates.avatar_url = avatar_url;
      const { data, error } = await supabase.from("profiles").update(updates).eq("id", userId).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-login") {
      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await adminClient.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", userId);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
