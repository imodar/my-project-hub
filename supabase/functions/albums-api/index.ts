import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_NAME = 100;
const MAX_CAPTION = 500;
const MAX_URL = 2000;
const MAX_COLOR = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }
function validStr(v: unknown, max: number): v is string { return typeof v === "string" && v.trim().length > 0 && v.length <= max; }
function sanitize(s: string, max: number): string { return s.trim().slice(0, max); }

async function checkRateLimit(ac: any, userId: string, endpoint: string, maxPerMinute = 60): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60000).toISOString();
  const { data } = await ac.from("rate_limit_counters").select("id, count, window_start").eq("user_id", userId).eq("endpoint", endpoint).maybeSingle();
  if (data) {
    if (data.window_start > windowStart) { if (data.count >= maxPerMinute) return false; await ac.from("rate_limit_counters").update({ count: data.count + 1 }).eq("id", data.id); }
    else { await ac.from("rate_limit_counters").update({ count: 1, window_start: now.toISOString() }).eq("id", data.id); }
  } else { await ac.from("rate_limit_counters").insert({ user_id: userId, endpoint, count: 1, window_start: now.toISOString() }); }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (!await checkRateLimit(adminClient, userId, "albums-api")) return json({ error: "Too many requests" }, 429);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-albums") {
      const { family_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      const { data, error } = await supabase.from("albums").select("*, album_photos(*)").eq("family_id", family_id).order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-album") {
      const { family_id, name, cover_color, linked_trip_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب (حد أقصى 100)" }, 400);
      if (cover_color && typeof cover_color === "string" && cover_color.length > MAX_COLOR) return json({ error: "اللون طويل جداً" }, 400);
      if (linked_trip_id && !validUuid(linked_trip_id)) return json({ error: "linked_trip_id غير صالح" }, 400);
      const { data, error } = await supabase.from("albums").insert({ family_id, name: sanitize(name, MAX_NAME), cover_color, linked_trip_id, created_by: userId }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-album") {
      const { id, name, cover_color } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (name !== undefined && !validStr(name, MAX_NAME)) return json({ error: "الاسم غير صالح" }, 400);
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = sanitize(name, MAX_NAME);
      if (cover_color !== undefined) updates.cover_color = cover_color;
      const { data, error } = await supabase.from("albums").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-album") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("albums").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "get-photos") {
      const { album_id } = body;
      if (!validUuid(album_id)) return json({ error: "album_id غير صالح" }, 400);
      const { data, error } = await supabase.from("album_photos").select("*").eq("album_id", album_id).order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-photo") {
      const { album_id, url, date, caption } = body;
      if (!validUuid(album_id)) return json({ error: "album_id غير صالح" }, 400);
      if (!validStr(url, MAX_URL)) return json({ error: "رابط الصورة مطلوب" }, 400);
      if (caption && typeof caption === "string" && caption.length > MAX_CAPTION) return json({ error: "التعليق طويل جداً" }, 400);
      const { data, error } = await supabase.from("album_photos").insert({ album_id, url: url.slice(0, MAX_URL), date, caption: caption ? sanitize(caption, MAX_CAPTION) : null }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-photo") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("album_photos").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
