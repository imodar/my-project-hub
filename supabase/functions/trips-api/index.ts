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

const MAX_NAME = 200;
const MAX_DEST = 200;
const MAX_NOTE = 1000;
const MAX_AMOUNT = 10_000_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_STATUS = ["planning", "active", "completed", "cancelled"];
const ALLOWED_SUGGESTION_STATUS = ["pending", "accepted", "rejected"];

function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }
function validStr(v: unknown, max: number): v is string { return typeof v === "string" && v.trim().length > 0 && v.length <= max; }
function validAmount(v: unknown): boolean { return typeof v === "number" && v >= 0 && v <= MAX_AMOUNT && isFinite(v); }
function sanitize(s: string, max: number): string { return s.trim().slice(0, max); }
function getErrorMessage(err: unknown): string { return err instanceof Error ? err.message : String(err); }

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
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "trips-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-trips") {
      const { family_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      const { data, error } = await supabase.from("trips").select("*, trip_day_plans(*, trip_activities(*)), trip_expenses(*), trip_packing(*), trip_suggestions(*), trip_documents(*)").eq("family_id", family_id).order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "get-trip") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { data, error } = await supabase.from("trips").select("*, trip_day_plans(*, trip_activities(*)), trip_packing(*), trip_expenses(*), trip_suggestions(*), trip_documents(*)").eq("id", id).single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-trip") {
      const { family_id, name, destination, start_date, end_date, budget, status } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب (حد أقصى 200)" }, 400);
      if (destination && typeof destination === "string" && destination.length > MAX_DEST) return json({ error: "الوجهة طويلة جداً" }, 400);
      if (budget !== undefined && budget !== null && !validAmount(budget)) return json({ error: "الميزانية غير صالحة" }, 400);
      if (status && !ALLOWED_STATUS.includes(status)) return json({ error: "حالة غير صالحة" }, 400);
      const { data, error } = await supabase.from("trips").insert({ family_id, name: sanitize(name, MAX_NAME), destination: destination ? sanitize(destination, MAX_DEST) : null, start_date, end_date, budget, status: status || "planning", created_by: userId }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-trip") {
      const { id, name, destination, budget, status, ...rest } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (name !== undefined && !validStr(name, MAX_NAME)) return json({ error: "الاسم غير صالح" }, 400);
      if (destination !== undefined && destination !== null && typeof destination === "string" && destination.length > MAX_DEST) return json({ error: "الوجهة طويلة جداً" }, 400);
      if (budget !== undefined && budget !== null && !validAmount(budget)) return json({ error: "الميزانية غير صالحة" }, 400);
      if (status !== undefined && !ALLOWED_STATUS.includes(status)) return json({ error: "حالة غير صالحة" }, 400);
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = sanitize(name, MAX_NAME);
      if (destination !== undefined) updates.destination = destination;
      if (budget !== undefined) updates.budget = budget;
      if (status !== undefined) updates.status = status;
      for (const k of ["start_date", "end_date"]) { if (rest[k] !== undefined) updates[k] = rest[k]; }
      delete updates.action;
      const { data, error } = await supabase.from("trips").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-trip") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "add-day-plan") {
      const { trip_id, day_number, city } = body;
      if (!validUuid(trip_id)) return json({ error: "trip_id غير صالح" }, 400);
      if (typeof day_number !== "number" || day_number < 1 || day_number > 365) return json({ error: "رقم اليوم غير صالح" }, 400);
      if (city && typeof city === "string" && city.length > MAX_NAME) return json({ error: "اسم المدينة طويل جداً" }, 400);
      const { data, error } = await supabase.from("trip_day_plans").insert({ trip_id, day_number, city: city ? sanitize(city, MAX_NAME) : null }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-activity") {
      const { day_plan_id, id: clientId, name, time, location, cost } = body;
      if (!validUuid(day_plan_id)) return json({ error: "day_plan_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب" }, 400);
      if (cost !== undefined && cost !== null && !validAmount(cost)) return json({ error: "التكلفة غير صالحة" }, 400);
      if (location && typeof location === "string" && location.length > MAX_NAME) return json({ error: "الموقع طويل جداً" }, 400);
      // Check if parent day plan exists (might be optimistic and not synced yet)
      const { data: dpExists } = await supabase.from("trip_day_plans").select("id").eq("id", day_plan_id).maybeSingle();
      if (!dpExists) return json({ data: { id: clientId || day_plan_id, day_plan_id, name, time, location, cost } });
      const { data, error } = await supabase.from("trip_activities").insert({ day_plan_id, name: sanitize(name, MAX_NAME), time, location: location ? sanitize(location, MAX_NAME) : null, cost }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "toggle-activity") {
      const { id, completed } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const updates: Record<string, unknown> = {};
      if (completed !== undefined) updates.completed = completed;
      const { data, error } = await supabase.from("trip_activities").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-expense") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("trip_expenses").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "add-document") {
      const { trip_id, name, type, file_url, file_name, notes } = body;
      if (!validUuid(trip_id)) return json({ error: "trip_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب" }, 400);
      if (notes && typeof notes === "string" && notes.length > MAX_NOTE) return json({ error: "الملاحظات طويلة جداً" }, 400);
      const { data, error } = await supabase.from("trip_documents").insert({ trip_id, name: sanitize(name, MAX_NAME), type, file_url, file_name, notes: notes ? sanitize(notes, MAX_NOTE) : null }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-document") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("trip_documents").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "add-packing") {
      const { trip_id, name } = body;
      if (!validUuid(trip_id)) return json({ error: "trip_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب" }, 400);
      const { data, error } = await supabase.from("trip_packing").insert({ trip_id, name: sanitize(name, MAX_NAME) }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "toggle-packing") {
      const { id, packed } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (typeof packed !== "boolean") return json({ error: "packed يجب أن يكون true أو false" }, 400);
      const { data, error } = await supabase.from("trip_packing").update({ packed }).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-expense") {
      const { trip_id, name, amount } = body;
      if (!validUuid(trip_id)) return json({ error: "trip_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب" }, 400);
      if (amount !== undefined && !validAmount(amount)) return json({ error: "المبلغ غير صالح" }, 400);
      const { data, error } = await supabase.from("trip_expenses").insert({ trip_id, name: sanitize(name, MAX_NAME), amount }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-suggestion") {
      const { trip_id, place_name, type, reason, location } = body;
      if (!validUuid(trip_id)) return json({ error: "trip_id غير صالح" }, 400);
      if (!validStr(place_name, MAX_NAME)) return json({ error: "اسم المكان مطلوب" }, 400);
      if (reason && typeof reason === "string" && reason.length > MAX_NOTE) return json({ error: "السبب طويل جداً" }, 400);
      const { data, error } = await supabase.from("trip_suggestions").insert({ trip_id, place_name: sanitize(place_name, MAX_NAME), type, reason: reason ? sanitize(reason, MAX_NOTE) : null, location, suggested_by: userId }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-suggestion-status") {
      const { id, status } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (!ALLOWED_SUGGESTION_STATUS.includes(status)) return json({ error: "حالة غير صالحة" }, 400);
      const { data, error } = await supabase.from("trip_suggestions").update({ status }).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: getErrorMessage(err) }, 500);
  }
});
