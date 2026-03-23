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
      const { family_id, name, type } = body;
      const { data, error } = await supabase
        .from("task_lists")
        .insert({ family_id, name, type: type || "family", created_by: userId })
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
      const { list_id, name, note, priority, assigned_to, repeat_enabled, repeat_days } = body;
      const { data, error } = await supabase
        .from("task_items")
        .insert({
          list_id, name, note,
          priority: priority || "none",
          assigned_to,
          repeat_enabled: repeat_enabled || false,
          repeat_days: repeat_days || [],
        })
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
