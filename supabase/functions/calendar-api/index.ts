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

    if (action === "get-events") {
      const { family_id, month } = body;
      let query = supabase
        .from("calendar_events")
        .select("*")
        .eq("family_id", family_id)
        .order("date", { ascending: true });
      if (month) {
        query = query.gte("date", `${month}-01`).lte("date", `${month}-31`);
      }
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-event") {
      const { family_id, title, date, icon, reminder_before } = body;
      const { data, error } = await supabase
        .from("calendar_events")
        .insert({
          family_id, title, date, icon,
          reminder_before: reminder_before || [],
          added_by: userId,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-event") {
      const { id, title, date, icon, reminder_before, personal_reminders } = body;
      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = title;
      if (date !== undefined) updates.date = date;
      if (icon !== undefined) updates.icon = icon;
      if (reminder_before !== undefined) updates.reminder_before = reminder_before;
      if (personal_reminders !== undefined) updates.personal_reminders = personal_reminders;
      const { data, error } = await supabase
        .from("calendar_events")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-event") {
      const { id } = body;
      const { error } = await supabase.from("calendar_events").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
