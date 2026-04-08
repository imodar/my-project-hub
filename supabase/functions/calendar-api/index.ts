import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_TITLE = 200;
const MAX_ICON = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }
function validStr(v: unknown, max: number): v is string { return typeof v === "string" && v.trim().length > 0 && v.length <= max; }
function sanitize(s: string, max: number): string { return s.trim().slice(0, max); }

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
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "calendar-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-events") {
      const { family_id, month, limit: reqLimit, offset } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (month && (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month))) return json({ error: "صيغة الشهر غير صالحة (YYYY-MM)" }, 400);
      const safeLimit = Math.min(Math.max(Number(reqLimit) || 200, 1), 500);
      const safeOffset = Math.max(Number(offset) || 0, 0);
      let query = supabase.from("calendar_events").select("*").eq("family_id", family_id).order("date", { ascending: true }).range(safeOffset, safeOffset + safeLimit - 1);
      if (month) { query = query.gte("date", `${month}-01`).lte("date", `${month}-31`); }
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data, hasMore: (data?.length ?? 0) === safeLimit });
    }

    if (action === "create-event") {
      const { family_id, title, date, icon, reminder_before } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!validStr(title, MAX_TITLE)) return json({ error: "العنوان مطلوب (حد أقصى 200 حرف)" }, 400);
      if (!date || !DATE_RE.test(date)) return json({ error: "التاريخ مطلوب (YYYY-MM-DD)" }, 400);
      if (icon && !validStr(icon, MAX_ICON)) return json({ error: "الأيقونة طويلة جداً" }, 400);
      if (reminder_before && (!Array.isArray(reminder_before) || reminder_before.length > 10)) return json({ error: "التذكيرات غير صالحة" }, 400);
      const { data, error } = await supabase.from("calendar_events").insert({ family_id, title: sanitize(title, MAX_TITLE), date, icon: icon ? sanitize(icon, MAX_ICON) : null, reminder_before: reminder_before || [], added_by: userId }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-event") {
      const { id, title, date, icon, reminder_before, personal_reminders } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (title !== undefined && !validStr(title, MAX_TITLE)) return json({ error: "العنوان غير صالح" }, 400);
      if (date !== undefined && !DATE_RE.test(date)) return json({ error: "التاريخ غير صالح" }, 400);
      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = sanitize(title, MAX_TITLE);
      if (date !== undefined) updates.date = date;
      if (icon !== undefined) updates.icon = icon ? sanitize(icon, MAX_ICON) : icon;
      if (reminder_before !== undefined) updates.reminder_before = Array.isArray(reminder_before) ? reminder_before.slice(0, 10) : [];
      if (personal_reminders !== undefined) updates.personal_reminders = Array.isArray(personal_reminders) ? personal_reminders.slice(0, 10) : [];
      const { data, error } = await supabase.from("calendar_events").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-event") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("calendar_events").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
