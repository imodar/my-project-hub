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
const MAX_NOTE = 1000;
const MAX_DOSAGE = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_GENDERS = ["male", "female"];

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
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "health-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-medications") {
      const { family_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      const { data, error } = await supabase.from("medications").select("*, medication_logs(*)").eq("family_id", family_id).order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-medication") {
      const { family_id, name, dosage, member_name, notes, color, times_per_day, frequency_value } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب (حد أقصى 200)" }, 400);
      if (dosage && typeof dosage === "string" && dosage.length > MAX_DOSAGE) return json({ error: "الجرعة طويلة جداً" }, 400);
      if (member_name && typeof member_name === "string" && member_name.length > MAX_NAME) return json({ error: "اسم العضو طويل جداً" }, 400);
      if (notes && typeof notes === "string" && notes.length > MAX_NOTE) return json({ error: "الملاحظات طويلة جداً" }, 400);
      if (times_per_day !== undefined && (typeof times_per_day !== "number" || times_per_day < 1 || times_per_day > 20)) return json({ error: "عدد المرات غير صالح" }, 400);
      if (frequency_value !== undefined && (typeof frequency_value !== "number" || frequency_value < 1 || frequency_value > 365)) return json({ error: "تكرار غير صالح" }, 400);
      const { member_id, frequency_type, selected_days, specific_times, start_date, end_date, reminder_enabled } = body;
      const { data, error } = await supabase.from("medications").insert({ family_id, name: sanitize(name, MAX_NAME), dosage: dosage ? sanitize(dosage, MAX_DOSAGE) : null, member_id, member_name: member_name ? sanitize(member_name, MAX_NAME) : null, frequency_type, frequency_value, selected_days, times_per_day, specific_times, start_date, end_date, notes: notes ? sanitize(notes, MAX_NOTE) : null, color, reminder_enabled: reminder_enabled || false }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-medication") {
      const { id, name, dosage, notes, ...rest } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (name !== undefined && !validStr(name, MAX_NAME)) return json({ error: "الاسم غير صالح" }, 400);
      if (dosage !== undefined && dosage !== null && typeof dosage === "string" && dosage.length > MAX_DOSAGE) return json({ error: "الجرعة طويلة جداً" }, 400);
      if (notes !== undefined && notes !== null && typeof notes === "string" && notes.length > MAX_NOTE) return json({ error: "الملاحظات طويلة جداً" }, 400);
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = sanitize(name, MAX_NAME);
      if (dosage !== undefined) updates.dosage = dosage;
      if (notes !== undefined) updates.notes = notes;
      for (const k of ["member_id", "member_name", "frequency_type", "frequency_value", "selected_days", "times_per_day", "specific_times", "start_date", "end_date", "color", "reminder_enabled"]) {
        if (rest[k] !== undefined) updates[k] = rest[k];
      }
      delete updates.action;
      const { data, error } = await supabase.from("medications").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-medication") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("medications").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "log-medication") {
      const { medication_id, skipped, notes } = body;
      if (!validUuid(medication_id)) return json({ error: "medication_id غير صالح" }, 400);
      if (notes && typeof notes === "string" && notes.length > MAX_NOTE) return json({ error: "الملاحظات طويلة جداً" }, 400);
      const { data, error } = await adminClient.from("medication_logs").insert({ medication_id, taken_by: userId, skipped: skipped || false, notes: notes ? sanitize(notes, MAX_NOTE) : null }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "get-medication-logs") {
      const { medication_id, date_from, date_to } = body;
      if (!validUuid(medication_id)) return json({ error: "medication_id غير صالح" }, 400);
      let query = supabase.from("medication_logs").select("*").eq("medication_id", medication_id).order("taken_at", { ascending: false });
      if (date_from) query = query.gte("taken_at", date_from);
      if (date_to) query = query.lte("taken_at", date_to);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "get-children") {
      const { family_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      const { data, error } = await supabase.from("vaccination_children").select("*, vaccine_notes(*)").eq("family_id", family_id).order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-child") {
      const { family_id, name, gender, birth_date } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب (حد أقصى 200)" }, 400);
      if (gender && !ALLOWED_GENDERS.includes(gender)) return json({ error: "الجنس غير صالح" }, 400);
      const { data, error } = await supabase.from("vaccination_children").insert({ family_id, name: sanitize(name, MAX_NAME), gender, birth_date }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-child") {
      const { id, name, gender, birth_date } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (name !== undefined && !validStr(name, MAX_NAME)) return json({ error: "الاسم غير صالح" }, 400);
      if (gender !== undefined && !ALLOWED_GENDERS.includes(gender)) return json({ error: "الجنس غير صالح" }, 400);
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = sanitize(name, MAX_NAME);
      if (gender !== undefined) updates.gender = gender;
      if (birth_date !== undefined) updates.birth_date = birth_date;
      const { data, error } = await supabase.from("vaccination_children").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "toggle-vaccine") {
      const { child_id, vaccine_id, completed } = body;
      if (!validUuid(child_id)) return json({ error: "child_id غير صالح" }, 400);
      if (!vaccine_id || typeof vaccine_id !== "string" || vaccine_id.length > 100) return json({ error: "vaccine_id غير صالح" }, 400);
      if (typeof completed !== "boolean") return json({ error: "completed يجب أن يكون true أو false" }, 400);
      const { data: child } = await supabase.from("vaccination_children").select("completed_vaccines").eq("id", child_id).single();
      const current = (child?.completed_vaccines as string[]) || [];
      const updated = completed ? [...new Set([...current, vaccine_id])] : current.filter((v: string) => v !== vaccine_id);
      const { data, error } = await supabase.from("vaccination_children").update({ completed_vaccines: updated }).eq("id", child_id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-vaccine-note") {
      const { child_id, vaccine_id, note } = body;
      if (!validUuid(child_id)) return json({ error: "child_id غير صالح" }, 400);
      if (!vaccine_id || typeof vaccine_id !== "string" || vaccine_id.length > 100) return json({ error: "vaccine_id غير صالح" }, 400);
      if (!validStr(note, MAX_NOTE)) return json({ error: "الملاحظة مطلوبة (حد أقصى 1000)" }, 400);
      const { data, error } = await supabase.from("vaccine_notes").insert({ child_id, vaccine_id, note: sanitize(note, MAX_NOTE) }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-reminder-settings") {
      const { child_id, settings } = body;
      if (!validUuid(child_id)) return json({ error: "child_id غير صالح" }, 400);
      if (!settings || typeof settings !== "object") return json({ error: "الإعدادات غير صالحة" }, 400);
      const { data, error } = await supabase.from("vaccination_children").update({ reminder_settings: settings }).eq("id", child_id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
