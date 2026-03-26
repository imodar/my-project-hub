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
    const _rl = await checkRateLimit(adminClient, userId, "zakat-api");
    if (!_rl) return json({ error: "Too many requests" }, 429);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // Note: zakat tables (zakat_assets, zakat_history) need to be created
    // For now, we use a simple implementation that can work once tables exist

    if (action === "get-assets") {
      const { data, error } = await supabase
        .from("zakat_assets" as any)
        .select("*, zakat_history(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-asset") {
      const { type, name, amount, currency, weight_grams, purchase_date, reminder } = body;
      const { data, error } = await supabase
        .from("zakat_assets" as any)
        .insert({ user_id: userId, type, name, amount, currency: currency || "SAR", weight_grams, purchase_date, reminder: reminder || false })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-asset") {
      const { id, ...updates } = body;
      delete updates.action;
      const { data, error } = await supabase
        .from("zakat_assets" as any)
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-asset") {
      const { id } = body;
      const { error } = await supabase.from("zakat_assets" as any).delete().eq("id", id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "pay-zakat") {
      const { asset_id, amount_paid, notes } = body;
      const { data, error } = await supabase
        .from("zakat_history" as any)
        .insert({ asset_id, amount_paid, notes, paid_at: new Date().toISOString() })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);

      await supabase
        .from("zakat_assets" as any)
        .update({ zakat_paid_at: new Date().toISOString() })
        .eq("id", asset_id);

      return json({ data });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
