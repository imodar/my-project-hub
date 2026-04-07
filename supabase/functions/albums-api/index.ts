import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const PROJECT_ORIGIN_FALLBACKS = [
  "https://7571dddb-1161-4f53-9036-32778235da46.lovableproject.com",
  "https://id-preview--7571dddb-1161-4f53-9036-32778235da46.lovable.app",
  "https://ailti.lovable.app",
  "https://d0479375-ab8c-4895-86c0-45a5df6d51d8.lovableproject.com",
  "http://localhost",
  "capacitor://localhost",
];

const ALLOWED_ORIGINS = Array.from(new Set([
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ...PROJECT_ORIGIN_FALLBACKS,
]));

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  let allowed = "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    allowed = origin;
  } else if (origin === "" || origin === "null") {
    allowed = "capacitor://localhost";
  }
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

let corsHeaders: Record<string, string> = {};

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

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "albums-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-albums") {
      const { family_id, since } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (since && typeof since !== "string") return json({ error: "since غير صالح" }, 400);
      let query = supabase.from("albums").select("*, album_photos(*)").eq("family_id", family_id).order("created_at", { ascending: false });
      if (since) query = query.gt("created_at", since);
      const { data, error } = await query;
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
