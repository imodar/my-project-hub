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
const MAX_CAT = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_TYPES = ["family", "personal"];

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
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "documents-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-lists") {
      const { family_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      const { data, error } = await supabase.from("document_lists").select("*, document_items(*, document_files(*))").eq("family_id", family_id).order("updated_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-list") {
      const { family_id, name, type } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب (حد أقصى 200)" }, 400);
      if (type && !ALLOWED_TYPES.includes(type)) return json({ error: "نوع غير صالح" }, 400);
      const { data, error } = await supabase.from("document_lists").insert({ family_id, name: sanitize(name, MAX_NAME), type: type || "family", created_by: userId }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-list") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("document_lists").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "get-items") {
      const { list_id } = body;
      if (!validUuid(list_id)) return json({ error: "list_id غير صالح" }, 400);
      const { data, error } = await supabase.from("document_items").select("*, document_files(*)").eq("list_id", list_id).order("added_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-item") {
      const { list_id, name, category, expiry_date, note, reminder_enabled } = body;
      if (!validUuid(list_id)) return json({ error: "list_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب (حد أقصى 200)" }, 400);
      if (category && typeof category === "string" && category.length > MAX_CAT) return json({ error: "التصنيف طويل جداً" }, 400);
      if (note && typeof note === "string" && note.length > MAX_NOTE) return json({ error: "الملاحظة طويلة جداً" }, 400);
      if (expiry_date && typeof expiry_date === "string" && expiry_date.length > 20) return json({ error: "تاريخ الانتهاء غير صالح" }, 400);
      const { data, error } = await supabase.from("document_items").insert({ list_id, name: sanitize(name, MAX_NAME), category: category ? sanitize(category, MAX_CAT) : null, expiry_date, note: note ? sanitize(note, MAX_NOTE) : null, reminder_enabled: reminder_enabled || false, added_by: userId }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-item") {
      const { id, name, category, expiry_date, note, reminder_enabled } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (name !== undefined && !validStr(name, MAX_NAME)) return json({ error: "الاسم غير صالح" }, 400);
      if (note !== undefined && note !== null && typeof note === "string" && note.length > MAX_NOTE) return json({ error: "الملاحظة طويلة جداً" }, 400);
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = sanitize(name, MAX_NAME);
      if (category !== undefined) updates.category = category;
      if (expiry_date !== undefined) updates.expiry_date = expiry_date;
      if (note !== undefined) updates.note = note;
      if (reminder_enabled !== undefined) updates.reminder_enabled = reminder_enabled;
      const { data, error } = await supabase.from("document_items").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-item") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("document_items").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "add-file") {
      const { document_id, name, type, file_url, size } = body;
      if (!validUuid(document_id)) return json({ error: "document_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب" }, 400);
      if (size !== undefined && size !== null && (typeof size !== "number" || size < 0 || size > 100_000_000)) return json({ error: "حجم الملف غير صالح" }, 400);
      const { data, error } = await supabase.from("document_files").insert({ document_id, name: sanitize(name, MAX_NAME), type, file_url, size }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-file") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("document_files").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
