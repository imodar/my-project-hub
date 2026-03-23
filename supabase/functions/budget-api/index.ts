import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // --- BUDGETS ---
    if (action === "get-budgets") {
      const { family_id, type } = body;
      let query = supabase
        .from("budgets")
        .select("*, budget_expenses(*)")
        .eq("family_id", family_id)
        .order("created_at", { ascending: false });
      if (type) query = query.eq("type", type);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-budget") {
      const { family_id, type, month, label, income, trip_id } = body;
      const { data, error } = await supabase
        .from("budgets")
        .insert({ family_id, type: type || "month", month, label, income, trip_id, created_by: userId })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-budget") {
      const { id, income, label } = body;
      const updates: Record<string, unknown> = {};
      if (income !== undefined) updates.income = income;
      if (label !== undefined) updates.label = label;
      const { data, error } = await supabase
        .from("budgets")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-budget") {
      const { id } = body;
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // --- EXPENSES ---
    if (action === "add-expense") {
      const { budget_id, name, amount, currency, date } = body;
      const { data, error } = await supabase
        .from("budget_expenses")
        .insert({ budget_id, name, amount, currency: currency || "SAR", date })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-expense") {
      const { id, name, amount, currency, date } = body;
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (amount !== undefined) updates.amount = amount;
      if (currency !== undefined) updates.currency = currency;
      if (date !== undefined) updates.date = date;
      const { data, error } = await supabase
        .from("budget_expenses")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-expense") {
      const { id } = body;
      const { error } = await supabase.from("budget_expenses").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
