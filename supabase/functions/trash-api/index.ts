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

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;

    const _rl = await checkRateLimit(adminClient, userId, "trash-api");
    if (!_rl) return json({ error: "Too many requests" }, 429);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // --- MOVE TO TRASH ---
    if (action === "move-to-trash") {
      const { family_id, type, title, description, original_data, related_records, is_shared } = body;
      const { data, error } = await supabase
        .from("trash_items")
        .insert({
          family_id, user_id: userId, type, title,
          description, original_data, related_records,
          is_shared: is_shared || false,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // --- GET TRASH ---
    if (action === "get-trash") {
      const { family_id } = body;
      let query = supabase
        .from("trash_items")
        .select("*")
        .eq("restored", false)
        .order("deleted_at", { ascending: false });

      if (family_id) {
        query = query.or(`user_id.eq.${userId},family_id.eq.${family_id}`);
      } else {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // --- RESTORE ---
    if (action === "restore") {
      const { id } = body;
      const { data: item, error: getErr } = await supabase
        .from("trash_items")
        .select("*")
        .eq("id", id)
        .single();
      if (getErr || !item) return json({ error: "Item not found" }, 404);

      // Mark as restored
      const { error } = await supabase
        .from("trash_items")
        .update({ restored: true })
        .eq("id", id);
      if (error) return json({ error: error.message }, 400);

      return json({ data: item });
    }

    // --- PERMANENT DELETE ---
    if (action === "permanent-delete") {
      const { id } = body;
      const { error } = await adminClient
        .from("trash_items")
        .delete()
        .eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
