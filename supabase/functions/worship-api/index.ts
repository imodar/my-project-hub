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

const MAX_NOTE = 1000;
const MAX_CHILD_ID = 200;
const MAX_REMINDER_ID = 100;
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
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "worship-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-prayer-logs") {
      const { child_id, date } = body;
      if (!validUuid(child_id)) return json({ error: "child_id غير صالح" }, 400);
      if (date && !DATE_RE.test(date)) return json({ error: "التاريخ غير صالح" }, 400);
      let query = supabase.from("prayer_logs").select("*").eq("child_id", child_id);
      if (date) query = query.eq("date", date);
      const { data, error } = await query.order("date", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "save-prayer-log") {
      const { child_id, date, prayers, notes } = body;
      if (!validUuid(child_id)) return json({ error: "child_id غير صالح" }, 400);
      if (!DATE_RE.test(date)) return json({ error: "التاريخ مطلوب (YYYY-MM-DD)" }, 400);
      if (!prayers || typeof prayers !== "object") return json({ error: "بيانات الصلوات غير صالحة" }, 400);
      if (notes && typeof notes === "string" && notes.length > MAX_NOTE) return json({ error: "الملاحظات طويلة جداً" }, 400);
      const { data: existing } = await supabase.from("prayer_logs").select("id").eq("child_id", child_id).eq("date", date).maybeSingle();
      if (existing) {
        const { data, error } = await supabase.from("prayer_logs").update({ prayers, notes: notes ? sanitize(notes, MAX_NOTE) : null }).eq("id", existing.id).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      } else {
        const { data, error } = await supabase.from("prayer_logs").insert({ child_id, date, prayers, notes: notes ? sanitize(notes, MAX_NOTE) : null }).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
    }

    if (action === "get-worship-data") {
      const { child_id, year, month } = body;
      if (!validStr(child_id, MAX_CHILD_ID)) return json({ error: "child_id غير صالح" }, 400);
      if (typeof year !== "number" || year < 2000 || year > 2100) return json({ error: "السنة غير صالحة" }, 400);
      if (typeof month !== "number" || month < 1 || month > 12) return json({ error: "الشهر غير صالح" }, 400);
      const { data, error } = await supabase.from("kids_worship_data").select("*").eq("child_id", child_id).eq("year", year).eq("month", month).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "save-worship-data") {
      const { child_id, year, month, day, items } = body;
      if (!validStr(child_id, MAX_CHILD_ID)) return json({ error: "child_id غير صالح" }, 400);
      if (typeof year !== "number" || year < 2000 || year > 2100) return json({ error: "السنة غير صالحة" }, 400);
      if (typeof month !== "number" || month < 1 || month > 12) return json({ error: "الشهر غير صالح" }, 400);
      if (typeof day !== "number" || day < 1 || day > 31) return json({ error: "اليوم غير صالح" }, 400);
      if (!items || typeof items !== "object") return json({ error: "البيانات غير صالحة" }, 400);
      const { data: existing } = await supabase.from("kids_worship_data").select("id").eq("child_id", child_id).eq("year", year).eq("month", month).eq("day", day).maybeSingle();
      if (existing) {
        const { data, error } = await supabase.from("kids_worship_data").update({ items }).eq("id", existing.id).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      } else {
        const { data, error } = await supabase.from("kids_worship_data").insert({ child_id, year, month, day, items, user_id: userId }).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
    }

    if (action === "save-tasbih") {
      const { count } = body;
      if (typeof count !== "number" || count < 0 || count > 1_000_000) return json({ error: "العدد غير صالح" }, 400);
      const { data, error } = await supabase.from("tasbih_sessions").insert({ user_id: userId, count }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "get-tasbih-history") {
      const { data, error } = await supabase.from("tasbih_sessions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "get-reminder-prefs") {
      const { data, error } = await supabase.from("islamic_reminder_prefs").select("*").eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "toggle-reminder") {
      const { reminder_id, enabled } = body;
      if (!validStr(reminder_id, MAX_REMINDER_ID)) return json({ error: "reminder_id غير صالح" }, 400);
      if (typeof enabled !== "boolean") return json({ error: "enabled يجب أن يكون true أو false" }, 400);
      const { data: existing } = await supabase.from("islamic_reminder_prefs").select("id").eq("user_id", userId).eq("reminder_id", reminder_id).maybeSingle();
      if (existing) {
        const { data, error } = await supabase.from("islamic_reminder_prefs").update({ enabled }).eq("id", existing.id).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      } else {
        const { data, error } = await supabase.from("islamic_reminder_prefs").insert({ user_id: userId, reminder_id, enabled }).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
    }

    if (action === "clear-tasbih") {
      const { error } = await supabase.from("tasbih_sessions").delete().eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "delete-worship-data") {
      const { child_id, year, month, day } = body;
      if (!validStr(child_id, MAX_CHILD_ID)) return json({ error: "child_id غير صالح" }, 400);
      if (typeof year !== "number" || typeof month !== "number" || typeof day !== "number") return json({ error: "بيانات التاريخ غير صالحة" }, 400);
      const { error } = await supabase.from("kids_worship_data").delete().eq("child_id", child_id).eq("year", year).eq("month", month).eq("day", day).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "get-children") {
      const familyId = body.family_id;
      if (!validUuid(familyId)) return json({ error: "family_id غير صالح" }, 400);
      const { data, error } = await supabase.from("worship_children").select("*").eq("family_id", familyId).order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-child") {
      const { family_id, name } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!validStr(name, 100)) return json({ error: "اسم الطفل غير صالح" }, 400);
      const { data, error } = await supabase.from("worship_children").insert({ family_id, name: sanitize(name, 100), created_by: userId }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "remove-child") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("worship_children").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
