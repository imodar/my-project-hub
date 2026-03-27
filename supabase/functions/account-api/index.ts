import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

let corsHeaders: Record<string, string> = {};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_REASON = 500;

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
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "account-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "request-export") {
      const { data, error } = await supabase.from("data_export_requests").insert({ user_id: userId }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "get-exports") {
      const { data, error } = await supabase.from("data_export_requests").select("*").eq("user_id", userId).order("requested_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "request-deletion") {
      const { reason } = body;
      if (reason && typeof reason === "string" && reason.length > MAX_REASON) return json({ error: "السبب طويل جداً (حد أقصى 500)" }, 400);

      const { data: memberships } = await supabase.from("family_members").select("family_id, is_admin").eq("user_id", userId).eq("is_admin", true);
      if (memberships?.length) {
        for (const m of memberships) {
          const { data: otherAdmins } = await supabase.from("family_members").select("id").eq("family_id", m.family_id).eq("is_admin", true).neq("user_id", userId);
          if (!otherAdmins?.length) {
            return json({ error: "أنت المشرف الوحيد في عائلتك. يجب تعيين مشرف آخر أو حذف العائلة أولاً." }, 400);
          }
        }
      }

      const { data, error } = await supabase.from("account_deletions").insert({ user_id: userId, reason: reason ? reason.trim().slice(0, MAX_REASON) : null }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "cancel-deletion") {
      const { error } = await supabase.from("account_deletions").delete().eq("user_id", userId).eq("status", "pending");
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "get-last-updated") {
      const { data: member } = await supabase.from("family_members").select("family_id").eq("user_id", userId).eq("status", "active").maybeSingle();
      if (!member?.family_id) return json({ last_updated_at: null });
      const { data, error } = await adminClient.rpc("get_family_last_updated", { _family_id: member.family_id });
      if (error) return json({ error: error.message }, 400);
      return json({ last_updated_at: data });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
