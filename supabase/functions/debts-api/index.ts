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
const MAX_NOTE = 2000;
const MAX_AMOUNT = 10_000_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_DIRECTIONS = ["owed_to_me", "i_owe"];
const ALLOWED_CURRENCIES = ["SAR", "USD", "EUR", "GBP", "AED", "KWD", "BHD", "QAR", "OMR", "EGP", "JOD"];

function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }
function validStr(v: unknown, max: number): v is string { return typeof v === "string" && v.trim().length > 0 && v.length <= max; }
function validAmount(v: unknown): v is number { return typeof v === "number" && v > 0 && v <= MAX_AMOUNT && isFinite(v); }
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
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "debts-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-debts") {
      const { data, error } = await supabase.from("debts").select("*, debt_payments(*), debt_postponements(*)").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-debt") {
      const { family_id, direction, person_name, amount, currency, date, due_date, note, payment_details, has_reminder } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!ALLOWED_DIRECTIONS.includes(direction)) return json({ error: "اتجاه الدين غير صالح" }, 400);
      if (!validStr(person_name, MAX_NAME)) return json({ error: "اسم الشخص مطلوب (حد أقصى 100)" }, 400);
      if (!validAmount(amount)) return json({ error: "المبلغ غير صالح (1 - 10,000,000)" }, 400);
      if (currency && !ALLOWED_CURRENCIES.includes(currency)) return json({ error: "عملة غير مدعومة" }, 400);
      if (note && typeof note === "string" && note.length > MAX_NOTE) return json({ error: "الملاحظة طويلة جداً (حد أقصى 2000)" }, 400);
      if (date && typeof date === "string" && date.length > 20) return json({ error: "تاريخ غير صالح" }, 400);
      if (due_date && typeof due_date === "string" && due_date.length > 20) return json({ error: "تاريخ الاستحقاق غير صالح" }, 400);
      const { data, error } = await supabase.from("debts").insert({ family_id, user_id: userId, direction, person_name: sanitize(person_name, MAX_NAME), amount, currency: currency || "SAR", date, due_date, note: note ? sanitize(note, MAX_NOTE) : null, payment_details, has_reminder: has_reminder || false }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-debt") {
      const { id, person_name, amount, note, direction, ...rest } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (person_name !== undefined && !validStr(person_name, MAX_NAME)) return json({ error: "الاسم غير صالح" }, 400);
      if (amount !== undefined && !validAmount(amount)) return json({ error: "المبلغ غير صالح" }, 400);
      if (note !== undefined && note !== null && typeof note === "string" && note.length > MAX_NOTE) return json({ error: "الملاحظة طويلة جداً" }, 400);
      if (direction !== undefined && !ALLOWED_DIRECTIONS.includes(direction)) return json({ error: "اتجاه غير صالح" }, 400);
      const updates: Record<string, unknown> = {};
      if (person_name !== undefined) updates.person_name = sanitize(person_name, MAX_NAME);
      if (amount !== undefined) updates.amount = amount;
      if (note !== undefined) updates.note = note;
      if (direction !== undefined) updates.direction = direction;
      // Safe fields
      for (const k of ["currency", "date", "due_date", "has_reminder", "is_archived", "is_fully_paid", "payment_details"]) {
        if (rest[k] !== undefined) updates[k] = rest[k];
      }
      delete updates.action;
      const { data, error } = await supabase.from("debts").update(updates).eq("id", id).eq("user_id", userId).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-debt") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("debts").delete().eq("id", id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "add-payment") {
      const { debt_id, amount, currency, date, type, item_description, payment_details } = body;
      if (!validUuid(debt_id)) return json({ error: "debt_id غير صالح" }, 400);
      if (!validAmount(amount)) return json({ error: "المبلغ غير صالح" }, 400);
      if (currency && !ALLOWED_CURRENCIES.includes(currency)) return json({ error: "عملة غير مدعومة" }, 400);
      if (item_description && typeof item_description === "string" && item_description.length > MAX_NOTE) return json({ error: "الوصف طويل جداً" }, 400);
      const { data, error } = await supabase.from("debt_payments").insert({ debt_id, amount, currency: currency || "SAR", date, type, item_description: item_description ? sanitize(item_description, MAX_NOTE) : null, payment_details }).select().single();
      if (error) return json({ error: error.message }, 400);

      const { data: payments } = await supabase.from("debt_payments").select("amount").eq("debt_id", debt_id);
      const { data: debt } = await supabase.from("debts").select("amount").eq("id", debt_id).single();
      if (payments && debt) {
        const totalPaid = payments.reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0);
        if (totalPaid >= Number(debt.amount)) {
          await supabase.from("debts").update({ is_fully_paid: true }).eq("id", debt_id);
        }
      }
      return json({ data });
    }

    if (action === "add-postponement") {
      const { debt_id, new_date, reason } = body;
      if (!validUuid(debt_id)) return json({ error: "debt_id غير صالح" }, 400);
      if (reason && typeof reason === "string" && reason.length > 500) return json({ error: "السبب طويل جداً" }, 400);
      const { data, error } = await supabase.from("debt_postponements").insert({ debt_id, new_date, reason: reason ? sanitize(reason, 500) : null }).select().single();
      if (error) return json({ error: error.message }, 400);
      if (new_date) { await supabase.from("debts").update({ due_date: new_date }).eq("id", debt_id); }
      return json({ data });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
