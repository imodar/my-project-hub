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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_TYPES = ["family", "personal"];
const ALLOWED_PRIORITIES = ["none", "low", "medium", "high"];

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
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "tasks-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    async function verifyFamilyMember(familyId: string) {
      const { data } = await adminClient.rpc("is_family_member", { _user_id: userId, _family_id: familyId });
      return !!data;
    }
    async function getFamilyIdFromList(listId: string): Promise<string | null> {
      const { data } = await adminClient.from("task_lists").select("family_id").eq("id", listId).single();
      return data?.family_id || null;
    }

    if (action === "get-lists") {
      const { family_id, since } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (since && typeof since !== "string") return json({ error: "since غير صالح" }, 400);
      let query = supabase.from("task_lists").select("*, task_items(*)").eq("family_id", family_id).order("updated_at", { ascending: false }).order("created_at", { ascending: false, referencedTable: "task_items" });
      if (since) query = query.gt("updated_at", since);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-list") {
      const { family_id, name, type, id: clientId } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب (حد أقصى 200)" }, 400);
      if (type && !ALLOWED_TYPES.includes(type)) return json({ error: "نوع غير صالح" }, 400);
      if (clientId && !validUuid(clientId)) return json({ error: "id غير صالح" }, 400);
      if (!await verifyFamilyMember(family_id)) return json({ error: "Unauthorized" }, 403);
      const insertData: Record<string, unknown> = { family_id, name: sanitize(name, MAX_NAME), type: type || "family", created_by: userId };
      if (clientId) insertData.id = clientId;
      const { data, error } = await adminClient.from("task_lists").insert(insertData).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-list") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("task_lists").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "get-items") {
      const { list_id } = body;
      if (!validUuid(list_id)) return json({ error: "list_id غير صالح" }, 400);
      const { data, error } = await supabase.from("task_items").select("*").eq("list_id", list_id).order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-item") {
      const { list_id, name, note, priority, assigned_to, repeat_enabled, repeat_days, id: clientId } = body;
      if (!validUuid(list_id)) return json({ error: "list_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب (حد أقصى 200)" }, 400);
      if (note && typeof note === "string" && note.length > MAX_NOTE) return json({ error: "الملاحظة طويلة جداً (حد أقصى 1000)" }, 400);
      if (priority && !ALLOWED_PRIORITIES.includes(priority)) return json({ error: "أولوية غير صالحة" }, 400);
      if (assigned_to && !validUuid(assigned_to)) return json({ error: "assigned_to غير صالح" }, 400);
      if (clientId && !validUuid(clientId)) return json({ error: "id غير صالح" }, 400);
      if (repeat_days && (!Array.isArray(repeat_days) || repeat_days.length > 7)) return json({ error: "repeat_days غير صالح" }, 400);
      const familyId = await getFamilyIdFromList(list_id);
      if (!familyId || !await verifyFamilyMember(familyId)) return json({ error: "Unauthorized" }, 403);
      const insertData: Record<string, unknown> = { list_id, name: sanitize(name, MAX_NAME), note: note ? sanitize(note, MAX_NOTE) : null, priority: priority || "none", assigned_to, repeat_enabled: repeat_enabled || false, repeat_days: repeat_days || [] };
      if (clientId) insertData.id = clientId;
      const { data, error } = await adminClient.from("task_items").insert(insertData).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-item") {
      const { id, name, note, priority, assigned_to, done, repeat_enabled, repeat_days } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (name !== undefined && !validStr(name, MAX_NAME)) return json({ error: "الاسم غير صالح" }, 400);
      if (note !== undefined && note !== null && typeof note === "string" && note.length > MAX_NOTE) return json({ error: "الملاحظة طويلة جداً" }, 400);
      if (priority !== undefined && !ALLOWED_PRIORITIES.includes(priority)) return json({ error: "أولوية غير صالحة" }, 400);
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = sanitize(name, MAX_NAME);
      if (note !== undefined) updates.note = note;
      if (priority !== undefined) updates.priority = priority;
      if (assigned_to !== undefined) updates.assigned_to = assigned_to;
      if (done !== undefined) updates.done = done;
      if (repeat_enabled !== undefined) updates.repeat_enabled = repeat_enabled;
      if (repeat_days !== undefined) updates.repeat_days = repeat_days;
      const { data, error } = await supabase.from("task_items").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "toggle-item") {
      const { id, done } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (typeof done !== "boolean") return json({ error: "done يجب أن يكون true أو false" }, 400);
      const { data, error } = await supabase.from("task_items").update({ done }).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-item") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("task_items").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
