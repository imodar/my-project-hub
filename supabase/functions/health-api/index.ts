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

    // --- MEDICATIONS ---
    if (action === "get-medications") {
      const { family_id } = body;
      const { data, error } = await supabase
        .from("medications")
        .select("*")
        .eq("family_id", family_id)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-medication") {
      const { family_id, name, dosage, member_id, member_name, frequency_type, frequency_value, selected_days, times_per_day, specific_times, start_date, end_date, notes, color, reminder_enabled } = body;
      const { data, error } = await supabase
        .from("medications")
        .insert({ family_id, name, dosage, member_id, member_name, frequency_type, frequency_value, selected_days, times_per_day, specific_times, start_date, end_date, notes, color, reminder_enabled: reminder_enabled || false })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-medication") {
      const { id, ...updates } = body;
      delete updates.action;
      const { data, error } = await supabase.from("medications").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-medication") {
      const { id } = body;
      const { error } = await supabase.from("medications").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // --- MEDICATION LOGS ---
    if (action === "log-medication") {
      const { medication_id, skipped, notes } = body;
      const { data, error } = await supabase
        .from("medication_logs")
        .insert({ medication_id, taken_by: userId, skipped: skipped || false, notes })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "get-medication-logs") {
      const { medication_id, date_from, date_to } = body;
      let query = supabase
        .from("medication_logs")
        .select("*")
        .eq("medication_id", medication_id)
        .order("taken_at", { ascending: false });
      if (date_from) query = query.gte("taken_at", date_from);
      if (date_to) query = query.lte("taken_at", date_to);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // --- VACCINATIONS ---
    if (action === "get-children") {
      const { family_id } = body;
      const { data, error } = await supabase
        .from("vaccination_children")
        .select("*, vaccine_notes(*)")
        .eq("family_id", family_id)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-child") {
      const { family_id, name, gender, birth_date } = body;
      const { data, error } = await supabase
        .from("vaccination_children")
        .insert({ family_id, name, gender, birth_date })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-child") {
      const { id, ...updates } = body;
      delete updates.action;
      const { data, error } = await supabase.from("vaccination_children").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "toggle-vaccine") {
      const { child_id, vaccine_id, completed } = body;
      const { data: child } = await supabase
        .from("vaccination_children")
        .select("completed_vaccines")
        .eq("id", child_id)
        .single();

      const current = (child?.completed_vaccines as string[]) || [];
      const updated = completed
        ? [...new Set([...current, vaccine_id])]
        : current.filter((v: string) => v !== vaccine_id);

      const { data, error } = await supabase
        .from("vaccination_children")
        .update({ completed_vaccines: updated })
        .eq("id", child_id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-vaccine-note") {
      const { child_id, vaccine_id, note } = body;
      const { data, error } = await supabase
        .from("vaccine_notes")
        .insert({ child_id, vaccine_id, note })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
