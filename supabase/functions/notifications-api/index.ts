import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

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
    if (!await checkRateLimit(adminClient, userId, "notifications-api")) return json({ error: "Too many requests" }, 429);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-notifications") {
      const { limit: reqLimit, before } = body;
      if (before && typeof before !== "string") return json({ error: "before غير صالح" }, 400);
      const safeLimit = Math.min(Math.max(Number(reqLimit) || 30, 1), 100);
      let query = supabase.from("user_notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(safeLimit);
      if (before && typeof before === "string") { query = query.lt("created_at", before); }
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data, hasMore: (data?.length ?? 0) === safeLimit });
    }

    if (action === "mark-read") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("user_notifications").update({ is_read: true } as any).eq("id", id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "mark-unread") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("user_notifications").update({ is_read: false } as any).eq("id", id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "mark-all-read") {
      const { error } = await supabase.from("user_notifications").update({ is_read: true } as any).eq("user_id", userId).eq("is_read", false);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "delete-notification") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("user_notifications").delete().eq("id", id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
