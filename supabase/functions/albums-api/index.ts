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
    const _rl = await checkRateLimit(adminClient, userId, "albums-api");
    if (!_rl) return json({ error: "Too many requests" }, 429);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // --- ALBUMS ---
    if (action === "get-albums") {
      const { family_id } = body;
      const { data, error } = await supabase
        .from("albums")
        .select("*, album_photos(*)")
        .eq("family_id", family_id)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-album") {
      const { family_id, name, cover_color, linked_trip_id } = body;
      const { data, error } = await supabase
        .from("albums")
        .insert({ family_id, name, cover_color, linked_trip_id, created_by: userId })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-album") {
      const { id, name, cover_color } = body;
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (cover_color !== undefined) updates.cover_color = cover_color;
      const { data, error } = await supabase.from("albums").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-album") {
      const { id } = body;
      const { error } = await supabase.from("albums").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // --- PHOTOS ---
    if (action === "get-photos") {
      const { album_id } = body;
      const { data, error } = await supabase
        .from("album_photos")
        .select("*")
        .eq("album_id", album_id)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-photo") {
      const { album_id, url, date, caption } = body;
      const { data, error } = await supabase
        .from("album_photos")
        .insert({ album_id, url, date, caption })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-photo") {
      const { id } = body;
      const { error } = await supabase.from("album_photos").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
