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
    const _rl = await checkRateLimit(adminClient, userId, "worship-api");
    if (!_rl) return json({ error: "Too many requests" }, 429);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // --- PRAYER LOGS ---
    if (action === "get-prayer-logs") {
      const { child_id, date } = body;
      let query = supabase.from("prayer_logs").select("*").eq("child_id", child_id);
      if (date) query = query.eq("date", date);
      const { data, error } = await query.order("date", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "save-prayer-log") {
      const { child_id, date, prayers, notes } = body;
      // Upsert by child_id + date
      const { data: existing } = await supabase
        .from("prayer_logs")
        .select("id")
        .eq("child_id", child_id)
        .eq("date", date)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("prayer_logs")
          .update({ prayers, notes })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      } else {
        const { data, error } = await supabase
          .from("prayer_logs")
          .insert({ child_id, date, prayers, notes })
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
    }

    // --- KIDS WORSHIP ---
    if (action === "get-worship-data") {
      const { child_id, year, month } = body;
      const { data, error } = await supabase
        .from("kids_worship_data")
        .select("*")
        .eq("child_id", child_id)
        .eq("year", year)
        .eq("month", month);
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "save-worship-data") {
      const { child_id, year, month, day, items } = body;
      const { data: existing } = await supabase
        .from("kids_worship_data")
        .select("id")
        .eq("child_id", child_id)
        .eq("year", year)
        .eq("month", month)
        .eq("day", day)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("kids_worship_data")
          .update({ items })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      } else {
        const { data, error } = await supabase
          .from("kids_worship_data")
          .insert({ child_id, year, month, day, items })
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
    }

    // --- TASBIH ---
    if (action === "save-tasbih") {
      const { count } = body;
      const { data, error } = await supabase
        .from("tasbih_sessions")
        .insert({ user_id: userId, count })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "get-tasbih-history") {
      const { data, error } = await supabase
        .from("tasbih_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // --- ISLAMIC REMINDERS ---
    if (action === "get-reminder-prefs") {
      const { data, error } = await supabase
        .from("islamic_reminder_prefs")
        .select("*")
        .eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "toggle-reminder") {
      const { reminder_id, enabled } = body;
      const { data: existing } = await supabase
        .from("islamic_reminder_prefs")
        .select("id")
        .eq("user_id", userId)
        .eq("reminder_id", reminder_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("islamic_reminder_prefs")
          .update({ enabled })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      } else {
        const { data, error } = await supabase
          .from("islamic_reminder_prefs")
          .insert({ user_id: userId, reminder_id, enabled })
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
