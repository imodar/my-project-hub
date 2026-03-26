import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_TITLE = 200;
const MAX_DESC = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_TYPES = ["market_list", "task_list", "document_list", "place_list", "trip", "album", "budget", "debt", "medication", "vehicle", "calendar_event"];

function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }
function validStr(v: unknown, max: number): v is string { return typeof v === "string" && v.trim().length > 0 && v.length <= max; }
function sanitize(s: string, max: number): string { return s.trim().slice(0, max); }

async function checkRateLimit(ac: any, userId: string, endpoint: string, maxPerMinute = 60): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60000).toISOString();
  const { data } = await ac.from("rate_limit_counters").select("id, count, window_start").eq("user_id", userId).eq("endpoint", endpoint).maybeSingle();
  if (data) {
    if (data.window_start > windowStart) { if (data.count >= maxPerMinute) return false; await ac.from("rate_limit_counters").update({ count: data.count + 1 }).eq("id", data.id); }
    else { await ac.from("rate_limit_counters").update({ count: 1, window_start: now.toISOString() }).eq("id", data.id); }
  } else { await ac.from("rate_limit_counters").insert({ user_id: userId, endpoint, count: 1, window_start: now.toISOString() }); }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;
    if (!await checkRateLimit(adminClient, userId, "trash-api")) return json({ error: "Too many requests" }, 429);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "move-to-trash") {
      const { family_id, type, title, description, original_data, related_records, is_shared } = body;
      if (family_id && !validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!validStr(type, 50)) return json({ error: "النوع مطلوب" }, 400);
      if (!ALLOWED_TYPES.includes(type)) return json({ error: "نوع غير صالح" }, 400);
      if (!validStr(title, MAX_TITLE)) return json({ error: "العنوان مطلوب (حد أقصى 200)" }, 400);
      if (description && typeof description === "string" && description.length > MAX_DESC) return json({ error: "الوصف طويل جداً" }, 400);
      const { data, error } = await supabase.from("trash_items").insert({ family_id, user_id: userId, type, title: sanitize(title, MAX_TITLE), description: description ? sanitize(description, MAX_DESC) : null, original_data, related_records, is_shared: is_shared || false }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "get-trash") {
      const { family_id } = body;
      if (family_id && !validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      let query = supabase.from("trash_items").select("*").eq("restored", false).order("deleted_at", { ascending: false });
      if (family_id) { query = query.or(`user_id.eq.${userId},family_id.eq.${family_id}`); }
      else { query = query.eq("user_id", userId); }
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "restore") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { data: item, error: getErr } = await supabase.from("trash_items").select("*").eq("id", id).single();
      if (getErr || !item) return json({ error: "Item not found" }, 404);

      const originalData = item.original_data;
      const relatedRecords = item.related_records;

      if (item.type === "market_list" && originalData) {
        const { error: listError } = await adminClient.from("market_lists").insert({ id: originalData.id, name: originalData.name, type: originalData.type, family_id: originalData.family_id, created_by: originalData.created_by, shared_with: originalData.shared_with || [], use_categories: originalData.use_categories ?? true });
        if (listError) return json({ error: "فشل استعادة القائمة: " + listError.message }, 400);
        if (relatedRecords && relatedRecords.length > 0) {
          const itemsToInsert = relatedRecords.map((it: any) => ({ id: it.id, list_id: originalData.id, name: it.name, category: it.category, quantity: it.quantity, checked: it.checked, checked_by: it.checked_by, added_by: it.added_by }));
          const { error: itemsError } = await adminClient.from("market_items").insert(itemsToInsert);
          if (itemsError) { await adminClient.from("market_lists").delete().eq("id", originalData.id); return json({ error: "فشل استعادة العناصر: " + itemsError.message }, 400); }
        }
      } else if (item.type === "task_list" && originalData) {
        const { error: listError } = await adminClient.from("task_lists").insert({ id: originalData.id, name: originalData.name, type: originalData.type, family_id: originalData.family_id, created_by: originalData.created_by, shared_with: originalData.shared_with || [] });
        if (listError) return json({ error: "فشل استعادة القائمة: " + listError.message }, 400);
        if (relatedRecords && relatedRecords.length > 0) {
          const itemsToInsert = relatedRecords.map((it: any) => ({ id: it.id, list_id: originalData.id, name: it.name, note: it.note, priority: it.priority, assigned_to: it.assigned_to, done: it.done, repeat_enabled: it.repeat_enabled, repeat_days: it.repeat_days, repeat_count: it.repeat_count }));
          const { error: itemsError } = await adminClient.from("task_items").insert(itemsToInsert);
          if (itemsError) { await adminClient.from("task_lists").delete().eq("id", originalData.id); return json({ error: "فشل استعادة المهام: " + itemsError.message }, 400); }
        }
      }

      const { error } = await supabase.from("trash_items").update({ restored: true }).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ data: item });
    }

    if (action === "permanent-delete") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await adminClient.from("trash_items").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
