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

const MAX_NAME = 100;
const MAX_NOTE = 1000;
const MAX_AMOUNT = 10_000_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_TYPES = ["cash", "gold", "silver", "stocks", "property", "business", "other"];
const ALLOWED_CURRENCIES = ["SAR", "USD", "EUR", "GBP", "AED", "KWD", "BHD", "QAR", "OMR", "EGP", "JOD"];

function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }
function validStr(v: unknown, max: number): v is string { return typeof v === "string" && v.trim().length > 0 && v.length <= max; }
function validAmount(v: unknown): boolean { return typeof v === "number" && v >= 0 && v <= MAX_AMOUNT && isFinite(v); }
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
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "zakat-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-assets") {
      const { data, error } = await supabase.from("zakat_assets" as any).select("*, zakat_history(*)").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-asset") {
      const { type, name, amount, currency, weight_grams, purchase_date, reminder } = body;
      if (type && !ALLOWED_TYPES.includes(type)) return json({ error: "نوع الأصل غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "الاسم مطلوب (حد أقصى 100)" }, 400);
      if (amount !== undefined && !validAmount(amount)) return json({ error: "المبلغ غير صالح" }, 400);
      if (currency && !ALLOWED_CURRENCIES.includes(currency)) return json({ error: "عملة غير مدعومة" }, 400);
      if (weight_grams !== undefined && weight_grams !== null && (typeof weight_grams !== "number" || weight_grams < 0 || weight_grams > 1_000_000)) return json({ error: "الوزن غير صالح" }, 400);
      const { data, error } = await supabase.from("zakat_assets" as any).insert({ user_id: userId, type, name: sanitize(name, MAX_NAME), amount, currency: currency || "SAR", weight_grams, purchase_date, reminder: reminder || false }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-asset") {
      const { id, name, amount, type, ...rest } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (name !== undefined && !validStr(name, MAX_NAME)) return json({ error: "الاسم غير صالح" }, 400);
      if (amount !== undefined && !validAmount(amount)) return json({ error: "المبلغ غير صالح" }, 400);
      if (type !== undefined && !ALLOWED_TYPES.includes(type)) return json({ error: "نوع غير صالح" }, 400);
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = sanitize(name, MAX_NAME);
      if (amount !== undefined) updates.amount = amount;
      if (type !== undefined) updates.type = type;
      for (const k of ["currency", "weight_grams", "purchase_date", "reminder"]) { if (rest[k] !== undefined) updates[k] = rest[k]; }
      delete updates.action;
      const { data, error } = await supabase.from("zakat_assets" as any).update(updates).eq("id", id).eq("user_id", userId).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-asset") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("zakat_assets" as any).delete().eq("id", id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "pay-zakat") {
      const { asset_id, amount_paid, notes } = body;
      if (!validUuid(asset_id)) return json({ error: "asset_id غير صالح" }, 400);
      if (!validAmount(amount_paid)) return json({ error: "المبلغ المدفوع غير صالح" }, 400);
      if (notes && typeof notes === "string" && notes.length > MAX_NOTE) return json({ error: "الملاحظات طويلة جداً" }, 400);
      const { data, error } = await supabase.from("zakat_history" as any).insert({ asset_id, amount_paid, notes: notes ? sanitize(notes, MAX_NOTE) : null, paid_at: new Date().toISOString() }).select().single();
      if (error) return json({ error: error.message }, 400);
      await supabase.from("zakat_assets" as any).update({ zakat_paid_at: new Date().toISOString() }).eq("id", asset_id);
      return json({ data });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
