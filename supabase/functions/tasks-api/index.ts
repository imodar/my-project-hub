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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // Helper: verify user is a family member for a given family_id
    async function verifyFamilyMember(familyId: string) {
      const { data } = await adminClient.rpc("is_family_member", { _user_id: userId, _family_id: familyId });
      return !!data;
    }

    // Helper: get family_id from a list_id
    async function getFamilyIdFromList(listId: string): Promise<string | null> {
      const { data } = await adminClient.from("task_lists").select("family_id").eq("id", listId).single();
      return data?.family_id || null;
    }

    // --- LISTS ---
    if (action === "get-lists") {
      const { family_id } = body;
      const { data, error } = await supabase
        .from("task_lists")
        .select("*, task_items(count)")
        .eq("family_id", family_id)
        .order("updated_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-list") {
      const { family_id, name, type, id: clientId } = body;
      if (!await verifyFamilyMember(family_id)) return json({ error: "Unauthorized" }, 403);
      const insertData: Record<string, unknown> = { family_id, name, type: type || "family", created_by: userId };
      if (clientId) insertData.id = clientId;
      const { data, error } = await adminClient
        .from("task_lists")
        .insert(insertData)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-list") {
      const { id } = body;
      const { error } = await supabase.from("task_lists").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // --- ITEMS ---
    if (action === "get-items") {
      const { list_id } = body;
      const { data, error } = await supabase
        .from("task_items")
        .select("*")
        .eq("list_id", list_id)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-item") {
      const { list_id, name, note, priority, assigned_to, repeat_enabled, repeat_days, id: clientId } = body;
      // Verify membership via the list's family
      const familyId = await getFamilyIdFromList(list_id);
      if (!familyId || !await verifyFamilyMember(familyId)) return json({ error: "Unauthorized" }, 403);
      const insertData: Record<string, unknown> = {
        list_id, name, note,
        priority: priority || "none",
        assigned_to,
        repeat_enabled: repeat_enabled || false,
        repeat_days: repeat_days || [],
      };
      if (clientId) insertData.id = clientId;
      const { data, error } = await adminClient
        .from("task_items")
        .insert(insertData)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-item") {
      const { id, ...updates } = body;
      delete updates.action;
      const { data, error } = await supabase
        .from("task_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "toggle-item") {
      const { id, done } = body;
      const { data, error } = await supabase
        .from("task_items")
        .update({ done })
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-item") {
      const { id } = body;
      const { error } = await supabase.from("task_items").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
