import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_REASON = 500;
const MAX_SECTIONS = 50000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }

async function checkRateLimit(ac: any, userId: string, endpoint: string, maxPerMinute = 60): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60000).toISOString();
  const { data } = await ac.from("rate_limit_counters").select("id, count, window_start").eq("user_id", userId).eq("endpoint", endpoint).maybeSingle();
  if (data) {
    if (data.window_start > windowStart) { if (data.count >= maxPerMinute) return false; await ac.from("rate_limit_counters").update({ count: data.count + 1 }).eq("id", data.id); }
    else { await ac.from("rate_limit_counters").update({ count: 1, window_start: now.toISOString() }).eq("id", data.id); }
  } else { await ac.from("rate_limit_counters").insert({ user_id: userId, endpoint, count: 1, window_start: now.toISOString() }); }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (!await checkRateLimit(adminClient, userId, "will-api")) return json({ error: "Too many requests" }, 429);

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

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
