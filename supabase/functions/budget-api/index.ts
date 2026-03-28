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
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MAX_NAME = 100;
const MAX_LABEL = 100;
const MAX_AMOUNT = 10_000_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_TYPES = ["month", "trip", "custom", "project"];
const ALLOWED_CURRENCIES = ["SAR", "USD", "EUR", "GBP", "AED", "KWD", "BHD", "QAR", "OMR", "EGP", "JOD"];

function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }
function validStr(v: unknown, max = MAX_NAME): v is string { return typeof v === "string" && v.trim().length > 0 && v.length <= max; }
function validAmount(v: unknown): v is number { return typeof v === "number" && v > 0 && v <= MAX_AMOUNT && isFinite(v); }
function sanitize(s: string, max = MAX_NAME): string { return s.trim().slice(0, max); }

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
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "budget-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-budgets") {
      const { family_id, type } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (type && !ALLOWED_TYPES.includes(type)) return json({ error: "نوع غير صالح" }, 400);
      let query = supabase.from("budgets").select("*, budget_expenses(*)").eq("family_id", family_id).order("created_at", { ascending: false });
      if (type) query = query.eq("type", type);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-budget") {
      const { family_id, type, month, label, income, trip_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (type && !ALLOWED_TYPES.includes(type)) return json({ error: "نوع غير صالح" }, 400);
      if (label && !validStr(label, MAX_LABEL)) return json({ error: "العنوان طويل جداً (حد أقصى 100)" }, 400);
      if (income !== undefined && income !== null && (typeof income !== "number" || income < 0 || income > MAX_AMOUNT)) return json({ error: "الدخل غير صالح" }, 400);
      if (month && (typeof month !== "string" || month.length > 10)) return json({ error: "الشهر غير صالح" }, 400);
      if (trip_id && !validUuid(trip_id)) return json({ error: "trip_id غير صالح" }, 400);
      const { data, error } = await supabase.from("budgets").insert({ family_id, type: type || "month", month, label: label ? sanitize(label, MAX_LABEL) : null, income, trip_id, created_by: userId }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-budget") {
      const { id, income, label } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (income !== undefined && income !== null && (typeof income !== "number" || income < 0 || income > MAX_AMOUNT)) return json({ error: "الدخل غير صالح" }, 400);
      if (label !== undefined && label !== null && !validStr(label, MAX_LABEL)) return json({ error: "العنوان طويل جداً" }, 400);
      const updates: Record<string, unknown> = {};
      if (income !== undefined) updates.income = income;
      if (label !== undefined) updates.label = label ? sanitize(label, MAX_LABEL) : label;
      const { data, error } = await supabase.from("budgets").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-budget") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "add-expense") {
      const { budget_id, name, amount, currency, date } = body;
      if (!validUuid(budget_id)) return json({ error: "budget_id غير صالح" }, 400);
      if (!validStr(name, MAX_NAME)) return json({ error: "اسم المصروف مطلوب (حد أقصى 100)" }, 400);
      if (!validAmount(amount)) return json({ error: "المبلغ غير صالح (1 - 10,000,000)" }, 400);
      if (currency && !ALLOWED_CURRENCIES.includes(currency)) return json({ error: "عملة غير مدعومة" }, 400);
      if (date && (typeof date !== "string" || date.length > 20)) return json({ error: "تاريخ غير صالح" }, 400);
      const { data, error } = await supabase.from("budget_expenses").insert({ budget_id, name: sanitize(name), amount, currency: currency || "SAR", date }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-expense") {
      const { id, name, amount, currency, date } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (name !== undefined && !validStr(name, MAX_NAME)) return json({ error: "الاسم غير صالح" }, 400);
      if (amount !== undefined && !validAmount(amount)) return json({ error: "المبلغ غير صالح" }, 400);
      if (currency !== undefined && !ALLOWED_CURRENCIES.includes(currency)) return json({ error: "عملة غير مدعومة" }, 400);
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = sanitize(name);
      if (amount !== undefined) updates.amount = amount;
      if (currency !== undefined) updates.currency = currency;
      if (date !== undefined) updates.date = date;
      const { data, error } = await supabase.from("budget_expenses").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-expense") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("budget_expenses").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
