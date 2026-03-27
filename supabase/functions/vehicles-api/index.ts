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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

let corsHeaders: Record<string, string> = {};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_NAME = 100;
const MAX_NOTE = 1000;
const MAX_PLATE = 30;
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
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "vehicles-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-vehicles") {
      const { family_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      const { data, error } = await supabase.from("vehicles" as any).select("*, vehicle_maintenance(*)").eq("family_id", family_id).order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-vehicle") {
      const { family_id, manufacturer, model, year, mileage, mileage_unit, color, plate_number } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (manufacturer && typeof manufacturer === "string" && manufacturer.length > MAX_NAME) return json({ error: "الشركة المصنعة طويلة جداً" }, 400);
      if (model && typeof model === "string" && model.length > MAX_NAME) return json({ error: "الموديل طويل جداً" }, 400);
      if (year !== undefined && year !== null && (typeof year !== "number" || year < 1900 || year > 2100)) return json({ error: "السنة غير صالحة" }, 400);
      if (mileage !== undefined && mileage !== null && (typeof mileage !== "number" || mileage < 0 || mileage > 10_000_000)) return json({ error: "المسافة غير صالحة" }, 400);
      if (plate_number && typeof plate_number === "string" && plate_number.length > MAX_PLATE) return json({ error: "رقم اللوحة طويل جداً" }, 400);
      if (color && typeof color === "string" && color.length > MAX_COLOR) return json({ error: "اللون طويل جداً" }, 400);
      const { data, error } = await supabase.from("vehicles" as any).insert({ family_id, manufacturer: manufacturer ? sanitize(manufacturer, MAX_NAME) : null, model: model ? sanitize(model, MAX_NAME) : null, year, mileage, mileage_unit, color, plate_number: plate_number ? sanitize(plate_number, MAX_PLATE) : null, created_by: userId }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-vehicle") {
      const { id, manufacturer, model, year, mileage, ...rest } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (manufacturer !== undefined && manufacturer !== null && typeof manufacturer === "string" && manufacturer.length > MAX_NAME) return json({ error: "الشركة المصنعة طويلة جداً" }, 400);
      if (model !== undefined && model !== null && typeof model === "string" && model.length > MAX_NAME) return json({ error: "الموديل طويل جداً" }, 400);
      if (year !== undefined && year !== null && (typeof year !== "number" || year < 1900 || year > 2100)) return json({ error: "السنة غير صالحة" }, 400);
      const updates: Record<string, unknown> = {};
      if (manufacturer !== undefined) updates.manufacturer = manufacturer;
      if (model !== undefined) updates.model = model;
      if (year !== undefined) updates.year = year;
      if (mileage !== undefined) updates.mileage = mileage;
      for (const k of ["mileage_unit", "color", "plate_number"]) { if (rest[k] !== undefined) updates[k] = rest[k]; }
      delete updates.action;
      const { data, error } = await supabase.from("vehicles" as any).update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-vehicle") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("vehicles" as any).delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "add-maintenance") {
      const { vehicle_id, type, label, date, mileage_at_service, next_mileage, next_date, notes } = body;
      if (!validUuid(vehicle_id)) return json({ error: "vehicle_id غير صالح" }, 400);
      if (label && typeof label === "string" && label.length > MAX_NAME) return json({ error: "العنوان طويل جداً" }, 400);
      if (notes && typeof notes === "string" && notes.length > MAX_NOTE) return json({ error: "الملاحظات طويلة جداً" }, 400);
      const { data, error } = await supabase.from("vehicle_maintenance").insert({ vehicle_id, type, label: label ? sanitize(label, MAX_NAME) : null, date, mileage_at_service, next_mileage, next_date, notes: notes ? sanitize(notes, MAX_NOTE) : null }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-maintenance") {
      const { id, label, notes, ...rest } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (label !== undefined && label !== null && typeof label === "string" && label.length > MAX_NAME) return json({ error: "العنوان طويل جداً" }, 400);
      if (notes !== undefined && notes !== null && typeof notes === "string" && notes.length > MAX_NOTE) return json({ error: "الملاحظات طويلة جداً" }, 400);
      const updates: Record<string, unknown> = {};
      if (label !== undefined) updates.label = label;
      if (notes !== undefined) updates.notes = notes;
      for (const k of ["type", "date", "mileage_at_service", "next_mileage", "next_date"]) { if (rest[k] !== undefined) updates[k] = rest[k]; }
      delete updates.action;
      const { data, error } = await supabase.from("vehicle_maintenance").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-maintenance") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("vehicle_maintenance").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
