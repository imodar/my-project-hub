import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

let corsHeaders: Record<string, string> = {};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_NAME = 200;
const MAX_DESC = 2000;
const MAX_NOTE = 1000;
const MAX_ADDR = 500;
const MAX_PHONE = 30;
const MAX_URL = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_TYPES = ["family", "personal"];
const ALLOWED_PRICE = ["$", "$$", "$$$", "$$$$"];
const ALLOWED_KID = ["yes", "no", "maybe"];

function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }
function validStr(v: unknown, max: number): v is string { return typeof v === "string" && v.trim().length > 0 && v.length <= max; }
function validLat(v: unknown): boolean { return typeof v === "number" && v >= -90 && v <= 90; }
function validLng(v: unknown): boolean { return typeof v === "number" && v >= -180 && v <= 180; }
function sanitize(s: string, max: number): string { return s.trim().slice(0, max); }

Deno.serve(async (req) => {
  corsHeaders = corsHeaders;
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "places-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-lists") {
      const { family_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      const { data, error } = await supabase.from("place_lists").select("*, places(count)").eq("family_id", family_id).order("updated_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-list") {
      const { family_id, name, type } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب (حد أقصى 200)" }, 400);
      if (type && !ALLOWED_TYPES.includes(type)) return json({ error: "نوع غير صالح" }, 400);
      const { data, error } = await supabase.from("place_lists").insert({ family_id, name: sanitize(name, MAX_NAME), type: type || "family", created_by: userId }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-list") {
      const { id, name, shared_with } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (name !== undefined && !validStr(name, MAX_NAME)) return json({ error: "الاسم غير صالح" }, 400);
      if (shared_with !== undefined && !Array.isArray(shared_with)) return json({ error: "shared_with يجب أن تكون مصفوفة" }, 400);
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = sanitize(name, MAX_NAME);
      if (shared_with !== undefined) {
        updates.shared_with = shared_with.slice(0, 50);
        updates.type = shared_with.length > 0 ? "family" : "personal";
      }
      const { data, error } = await supabase.from("place_lists").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-list") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("place_lists").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "get-places") {
      const { list_id } = body;
      if (!validUuid(list_id)) return json({ error: "list_id غير صالح" }, 400);
      const { data, error } = await supabase.from("places").select("*").eq("list_id", list_id);
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-place") {
      const { list_id, name, category, description, lat, lng, address, social_link, phone, price_range, rating, kid_friendly, note, must_visit } = body;
      if (!validUuid(list_id)) return json({ error: "list_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب (حد أقصى 200)" }, 400);
      if (description && typeof description === "string" && description.length > MAX_DESC) return json({ error: "الوصف طويل جداً" }, 400);
      if (lat !== undefined && lat !== null && !validLat(lat)) return json({ error: "خط العرض غير صالح" }, 400);
      if (lng !== undefined && lng !== null && !validLng(lng)) return json({ error: "خط الطول غير صالح" }, 400);
      if (address && typeof address === "string" && address.length > MAX_ADDR) return json({ error: "العنوان طويل جداً" }, 400);
      if (social_link && typeof social_link === "string" && social_link.length > MAX_URL) return json({ error: "الرابط طويل جداً" }, 400);
      if (phone && typeof phone === "string" && phone.length > MAX_PHONE) return json({ error: "رقم الهاتف طويل جداً" }, 400);
      if (price_range && !ALLOWED_PRICE.includes(price_range)) return json({ error: "نطاق السعر غير صالح" }, 400);
      if (rating !== undefined && rating !== null && (typeof rating !== "number" || rating < 0 || rating > 5)) return json({ error: "التقييم غير صالح (0-5)" }, 400);
      if (kid_friendly && !ALLOWED_KID.includes(kid_friendly)) return json({ error: "قيمة kid_friendly غير صالحة" }, 400);
      if (note && typeof note === "string" && note.length > MAX_NOTE) return json({ error: "الملاحظة طويلة جداً" }, 400);
      const { data, error } = await supabase.from("places").insert({ list_id, name: sanitize(name, MAX_NAME), category: category ? sanitize(category, 100) : null, description: description ? sanitize(description, MAX_DESC) : null, lat, lng, address: address ? sanitize(address, MAX_ADDR) : null, social_link: social_link ? sanitize(social_link, MAX_URL) : null, phone: phone ? sanitize(phone, MAX_PHONE) : null, price_range, rating, kid_friendly, note: note ? sanitize(note, MAX_NOTE) : null, must_visit: must_visit || false, added_by: userId }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-place") {
      const { id, name, description, note, ...rest } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (name !== undefined && !validStr(name, MAX_NAME)) return json({ error: "الاسم غير صالح" }, 400);
      if (description !== undefined && description !== null && typeof description === "string" && description.length > MAX_DESC) return json({ error: "الوصف طويل جداً" }, 400);
      if (note !== undefined && note !== null && typeof note === "string" && note.length > MAX_NOTE) return json({ error: "الملاحظة طويلة جداً" }, 400);
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = sanitize(name, MAX_NAME);
      if (description !== undefined) updates.description = description;
      if (note !== undefined) updates.note = note;
      for (const k of ["category", "lat", "lng", "address", "social_link", "phone", "price_range", "rating", "kid_friendly", "must_visit", "visited"]) {
        if (rest[k] !== undefined) updates[k] = rest[k];
      }
      delete updates.action;
      const { data, error } = await supabase.from("places").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-place") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("places").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
