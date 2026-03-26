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
    const _rl = await checkRateLimit(adminClient, userId, "trips-api");
    if (!_rl) return json({ error: "Too many requests" }, 429);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // --- TRIPS ---
    if (action === "get-trips") {
      const { family_id } = body;
      const { data, error } = await supabase
        .from("trips")
        .select("*, trip_day_plans(*, trip_activities(*)), trip_expenses(*), trip_packing(*), trip_suggestions(*), trip_documents(*)")
        .eq("family_id", family_id)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "get-trip") {
      const { id } = body;
      const { data, error } = await supabase
        .from("trips")
        .select("*, trip_day_plans(*, trip_activities(*)), trip_packing(*), trip_expenses(*), trip_suggestions(*), trip_documents(*)")
        .eq("id", id)
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-trip") {
      const { family_id, name, destination, start_date, end_date, budget, status } = body;
      const { data, error } = await supabase
        .from("trips")
        .insert({ family_id, name, destination, start_date, end_date, budget, status: status || "planning", created_by: userId })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-trip") {
      const { id, ...updates } = body;
      delete updates.action;
      const { data, error } = await supabase.from("trips").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-trip") {
      const { id } = body;
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // --- DAY PLANS ---
    if (action === "add-day-plan") {
      const { trip_id, day_number, city } = body;
      const { data, error } = await supabase
        .from("trip_day_plans")
        .insert({ trip_id, day_number, city })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // --- ACTIVITIES ---
    if (action === "add-activity") {
      const { day_plan_id, name, time, location, cost } = body;
      const { data, error } = await supabase
        .from("trip_activities")
        .insert({ day_plan_id, name, time, location, cost })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "toggle-activity") {
      const { id, completed } = body;
      const { data, error } = await supabase.from("trip_activities").update({ completed }).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // --- PACKING ---
    if (action === "add-packing") {
      const { trip_id, name } = body;
      const { data, error } = await supabase.from("trip_packing").insert({ trip_id, name }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "toggle-packing") {
      const { id, packed } = body;
      const { data, error } = await supabase.from("trip_packing").update({ packed }).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // --- EXPENSES ---
    if (action === "add-expense") {
      const { trip_id, name, amount } = body;
      const { data, error } = await supabase.from("trip_expenses").insert({ trip_id, name, amount }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // --- SUGGESTIONS ---
    if (action === "add-suggestion") {
      const { trip_id, place_name, type, reason, location } = body;
      const { data, error } = await supabase
        .from("trip_suggestions")
        .insert({ trip_id, place_name, type, reason, location, suggested_by: userId })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-suggestion-status") {
      const { id, status } = body;
      const { data, error } = await supabase.from("trip_suggestions").update({ status }).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
