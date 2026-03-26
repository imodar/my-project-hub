import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function checkRateLimit(
  ac: any, userId: string, endpoint: string, maxPerMinute = 60
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60000).toISOString();
  const { data } = await ac.from("rate_limit_counters").select("id, count, window_start").eq("user_id", userId).eq("endpoint", endpoint).maybeSingle();
  if (data) {
    if (data.window_start > windowStart) {
      if (data.count >= maxPerMinute) return false;
      await ac.from("rate_limit_counters").update({ count: data.count + 1 }).eq("id", data.id);
    } else {
      await ac.from("rate_limit_counters").update({ count: 1, window_start: now.toISOString() }).eq("id", data.id);
    }
  } else {
    await ac.from("rate_limit_counters").insert({ user_id: userId, endpoint, count: 1, window_start: now.toISOString() });
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // --- EXPORT DATA ---
    if (action === "request-export") {
      const { data, error } = await supabase
        .from("data_export_requests")
        .insert({ user_id: userId })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      // TODO: Trigger actual export job
      return json({ data });
    }

    if (action === "get-exports") {
      const { data, error } = await supabase
        .from("data_export_requests")
        .select("*")
        .eq("user_id", userId)
        .order("requested_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // --- DELETE ACCOUNT ---
    if (action === "request-deletion") {
      const { reason } = body;

      // Check if sole admin
      const { data: memberships } = await supabase
        .from("family_members")
        .select("family_id, is_admin")
        .eq("user_id", userId)
        .eq("is_admin", true);

      if (memberships?.length) {
        for (const m of memberships) {
          const { data: otherAdmins } = await supabase
            .from("family_members")
            .select("id")
            .eq("family_id", m.family_id)
            .eq("is_admin", true)
            .neq("user_id", userId);

          if (!otherAdmins?.length) {
            return json({
              error: "أنت المشرف الوحيد في عائلتك. يجب تعيين مشرف آخر أو حذف العائلة أولاً."
            }, 400);
          }
        }
      }

      const { data, error } = await supabase
        .from("account_deletions")
        .insert({ user_id: userId, reason })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "cancel-deletion") {
      const { error } = await supabase
        .from("account_deletions")
        .delete()
        .eq("user_id", userId)
        .eq("status", "pending");
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
