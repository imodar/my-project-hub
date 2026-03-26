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

    // Vehicles tables need to be created
    if (action === "get-vehicles") {
      const { family_id } = body;
      const { data, error } = await supabase
        .from("vehicles" as any)
        .select("*, vehicle_maintenance(*)")
        .eq("family_id", family_id)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-vehicle") {
      const { family_id, manufacturer, model, year, mileage, mileage_unit, color, plate_number } = body;
      const { data, error } = await supabase
        .from("vehicles" as any)
        .insert({ family_id, manufacturer, model, year, mileage, mileage_unit, color, plate_number, created_by: userId })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-vehicle") {
      const { id, ...updates } = body;
      delete updates.action;
      const { data, error } = await supabase.from("vehicles" as any).update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-vehicle") {
      const { id } = body;
      const { error } = await supabase.from("vehicles" as any).delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // --- MAINTENANCE ---
    if (action === "add-maintenance") {
      const { vehicle_id, type, label, date, mileage_at_service, next_mileage, next_date, notes } = body;
      const { data, error } = await supabase
        .from("vehicle_maintenance")
        .insert({ vehicle_id, type, label, date, mileage_at_service, next_mileage, next_date, notes })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-maintenance") {
      const { id } = body;
      const { error } = await supabase.from("vehicle_maintenance").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
