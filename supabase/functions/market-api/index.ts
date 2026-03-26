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

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const _rl = await checkRateLimit(adminClient, userId, "market-api");
    if (!_rl) return json({ error: "Too many requests" }, 429);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // --- LISTS ---
    if (action === "get-lists") {
      const { family_id } = body;
      const { data, error } = await supabase
        .from("market_lists")
        .select("*, market_items(*)")
        .eq("family_id", family_id)
        .order("updated_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-list") {
      const { family_id, name, type } = body;
      const listType = type || "family";

      if (listType === "family") {
        const { data: existingList, error: existingError } = await supabase
          .from("market_lists")
          .select("*")
          .eq("family_id", family_id)
          .eq("type", "family")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (existingError) return json({ error: existingError.message }, 400);
        if (existingList) return json({ data: existingList });
      }

      const { data, error } = await supabase
        .from("market_lists")
        .insert({ family_id, name, type: listType, created_by: userId })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-list") {
      const { id, name, shared_with } = body;
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (shared_with !== undefined) updates.shared_with = shared_with;
      const { data, error } = await supabase
        .from("market_lists")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-list") {
      const { id } = body;
      const { error } = await supabase.from("market_lists").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // --- ITEMS ---
    if (action === "get-items") {
      const { list_id } = body;
      const { data, error } = await supabase
        .from("market_items")
        .select("*")
        .eq("list_id", list_id)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-item") {
      const { list_id, name, category, quantity } = body;
      const { data, error } = await supabase
        .from("market_items")
        .insert({ list_id, name, category, quantity, added_by: userId })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "toggle-item") {
      const { id, checked } = body;
      const { data, error } = await supabase
        .from("market_items")
        .update({ checked, checked_by: checked ? userId : null })
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-item") {
      const { id, ...updates } = body;
      delete updates.action;
      if (updates.checked !== undefined) updates.checked_by = updates.checked ? userId : null;
      const { data, error } = await supabase.from("market_items").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-item") {
      const { id } = body;
      const { error } = await supabase.from("market_items").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
