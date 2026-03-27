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
const MAX_QTY = 50;
const MAX_CAT = 50;
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
    const userId = authUser?.id;
    if (authError || !validUuid(userId)) return json({ error: "Unauthorized" }, 401);
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "market-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-lists") {
      const { family_id, since } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (since && typeof since !== "string") return json({ error: "since غير صالح" }, 400);
      let query = supabase.from("market_lists").select("*, market_items(*)").eq("family_id", family_id).order("updated_at", { ascending: false });
      if (since) query = query.gt("updated_at", since);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-list") {
      const { family_id, name, type, use_categories, id: clientId } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب (حد أقصى 100)" }, 400);
      const listType = type || "family";
      if (!ALLOWED_TYPES.includes(listType)) return json({ error: "نوع غير صالح" }, 400);

      // Check if a default family list already exists for this family
      let isDefault = false;
      if (listType === "family") {
        const { data: existing } = await supabase.from("market_lists").select("id").eq("family_id", family_id).eq("type", "family").eq("is_default", true).limit(1).maybeSingle();
        if (!existing) isDefault = true;
      }
      const useCategories = typeof use_categories === "boolean" ? use_categories : true;
      const insertData: Record<string, unknown> = { family_id, name: sanitize(name, MAX_NAME), type: listType, created_by: userId, is_default: isDefault, use_categories: useCategories };
      if (validUuid(clientId)) insertData.id = clientId;
      const { data, error } = await supabase.from("market_lists").insert(insertData).select().single();
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
      const { data, error } = await supabase.from("market_lists").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-list") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      // Prevent deleting default lists
      const { data: listToDelete } = await supabase.from("market_lists").select("is_default").eq("id", id).single();
      if (listToDelete?.is_default) return json({ error: "لا يمكن حذف القائمة الافتراضية" }, 403);
      const { error } = await supabase.from("market_lists").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "get-items") {
      const { list_id } = body;
      if (!validUuid(list_id)) return json({ error: "list_id غير صالح" }, 400);
      const { data, error } = await supabase.from("market_items").select("*").eq("list_id", list_id).order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-item") {
      const { list_id, name, category, quantity } = body;
      if (!validUuid(list_id)) return json({ error: "list_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب (حد أقصى 100)" }, 400);
      if (category && !validStr(category, MAX_CAT)) return json({ error: "التصنيف طويل جداً" }, 400);
      if (quantity && !validStr(quantity, MAX_QTY)) return json({ error: "الكمية طويلة جداً" }, 400);
      const { data, error } = await supabase.from("market_items").insert({ list_id, name: sanitize(name, MAX_NAME), category: category ? sanitize(category, MAX_CAT) : null, quantity: quantity ? sanitize(quantity, MAX_QTY) : null, added_by: userId }).select().single();
      if (error) return json({ error: error.message }, 400);
      await supabase.from("market_lists").update({ updated_at: new Date().toISOString() }).eq("id", list_id);
      return json({ data });
    }

    if (action === "toggle-item") {
      const { id, checked } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (typeof checked !== "boolean") return json({ error: "checked يجب أن يكون true أو false" }, 400);
      const { data, error } = await supabase.from("market_items").update({ checked, checked_by: checked ? userId : null }).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      if (data?.list_id) await supabase.from("market_lists").update({ updated_at: new Date().toISOString() }).eq("id", data.list_id);
      return json({ data });
    }

    if (action === "update-item") {
      const { id, name, category, quantity, checked } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (name !== undefined && !validStr(name, MAX_NAME)) return json({ error: "الاسم غير صالح" }, 400);
      if (category !== undefined && category !== null && typeof category === "string" && category.length > MAX_CAT) return json({ error: "التصنيف طويل جداً" }, 400);
      if (quantity !== undefined && quantity !== null && typeof quantity === "string" && quantity.length > MAX_QTY) return json({ error: "الكمية طويلة جداً" }, 400);
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = sanitize(name, MAX_NAME);
      if (category !== undefined) updates.category = category;
      if (quantity !== undefined) updates.quantity = quantity;
      if (checked !== undefined) { updates.checked = checked; updates.checked_by = checked ? userId : null; }
      const { data, error } = await supabase.from("market_items").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      if (data?.list_id) await supabase.from("market_lists").update({ updated_at: new Date().toISOString() }).eq("id", data.list_id);
      return json({ data });
    }

    if (action === "delete-item") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { data: itemToDelete } = await supabase.from("market_items").select("list_id").eq("id", id).maybeSingle();
      const { error } = await supabase.from("market_items").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      if (itemToDelete?.list_id) await supabase.from("market_lists").update({ updated_at: new Date().toISOString() }).eq("id", itemToDelete.list_id);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
