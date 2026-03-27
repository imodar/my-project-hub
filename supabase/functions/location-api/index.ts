import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const PROJECT_ORIGIN_FALLBACKS = [
  "https://7571dddb-1161-4f53-9036-32778235da46.lovableproject.com",
  "https://id-preview--7571dddb-1161-4f53-9036-32778235da46.lovable.app",
  "https://ailti.lovable.app",
  "https://d0479375-ab8c-4895-86c0-45a5df6d51d8.lovableproject.com",
];

const ALLOWED_ORIGINS = Array.from(new Set([
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ...PROJECT_ORIGIN_FALLBACKS,
]));

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

let corsHeaders: Record<string, string> = {};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }
function validLat(v: unknown): boolean { return typeof v === "number" && v >= -90 && v <= 90 && isFinite(v); }
function validLng(v: unknown): boolean { return typeof v === "number" && v >= -180 && v <= 180 && isFinite(v); }

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: user.id, _endpoint: "location-api", _max_per_minute: 10 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "update" && req.method === "POST") {
      const { lat, lng, accuracy, familyId, isSharing } = await req.json();
      if (!validLat(lat)) return json({ error: "خط العرض غير صالح" }, 400);
      if (!validLng(lng)) return json({ error: "خط الطول غير صالح" }, 400);
      if (!validUuid(familyId)) return json({ error: "familyId غير صالح" }, 400);
      if (accuracy !== undefined && accuracy !== null && (typeof accuracy !== "number" || accuracy < 0 || accuracy > 100000)) return json({ error: "الدقة غير صالحة" }, 400);

      const { data: member } = await adminClient.from("family_members").select("id").eq("user_id", user.id).eq("family_id", familyId).eq("status", "active").maybeSingle();
      if (!member) return json({ error: "Not a family member" }, 403);

      const { error } = await adminClient.from("member_locations").upsert({ user_id: user.id, family_id: familyId, lat, lng, accuracy: accuracy || null, updated_at: new Date().toISOString(), is_sharing: isSharing !== false }, { onConflict: "user_id,family_id", ignoreDuplicates: false });
      if (error) { console.error("Upsert error:", error.message); throw error; }
      return json({ ok: true });
    }

    if (action === "list") {
      const familyId = url.searchParams.get("familyId");
      if (!validUuid(familyId)) return json({ error: "familyId غير صالح" }, 400);

      const { data: member } = await adminClient.from("family_members").select("id").eq("user_id", user.id).eq("family_id", familyId).eq("status", "active").maybeSingle();
      if (!member) return json({ error: "Not a family member" }, 403);

      const { data: locations, error } = await adminClient.from("member_locations").select("user_id, lat, lng, accuracy, updated_at, is_sharing").eq("family_id", familyId);
      if (error) throw error;

      const userIds = (locations || []).map((l: any) => l.user_id);
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: p } = await adminClient.from("profiles").select("id, name, avatar_url").in("id", userIds);
        profiles = p || [];
      }

      const { data: members } = await adminClient.from("family_members").select("user_id, role").eq("family_id", familyId).eq("status", "active").in("user_id", userIds);

      const result = (locations || []).map((loc: any) => {
        const profile = profiles.find((p: any) => p.id === loc.user_id);
        const memberInfo = (members || []).find((m: any) => m.user_id === loc.user_id);
        return { ...loc, name: profile?.name || "عضو", avatar_url: profile?.avatar_url, role: memberInfo?.role || "member", isMe: loc.user_id === user.id };
      });

      return json(result);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message || "Server error" }, 500);
  }
});
