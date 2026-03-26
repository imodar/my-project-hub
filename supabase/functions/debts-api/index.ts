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

async function checkRateLimit(
  ac: any, userId: string, endpoint: string, maxPerMinute = 60
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60000).toISOString();
  const { data } = await ac.from("rate_limit_counters").select("id, count, window_start").eq("user_id", userId).eq("endpoint", endpoint).maybeSingle();
  if (data) {
    if (data.window_start > windowStart) {
      if (data.count >= maxPerMinute) return false;
      await ac.from("rate_limit_counters").update({ count: data.count + 1 }).eq("id", data.id);
    } else {
      await ac.from("rate_limit_counters").update({ count: 1, window_start: now.toISOString() }).eq("id", data.id);
    }
  } else {
    await ac.from("rate_limit_counters").insert({ user_id: userId, endpoint, count: 1, window_start: now.toISOString() });
  }
  return true;
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

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const _rl = await checkRateLimit(adminClient, userId, "debts-api");
    if (!_rl) return json({ error: "Too many requests" }, 429);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // --- DEBTS ---
    if (action === "get-debts") {
      const { data, error } = await supabase
        .from("debts")
        .select("*, debt_payments(*), debt_postponements(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "create-debt") {
      const { family_id, direction, person_name, amount, currency, date, due_date, note, payment_details, has_reminder } = body;
      const { data, error } = await supabase
        .from("debts")
        .insert({
          family_id, user_id: userId, direction, person_name,
          amount, currency: currency || "SAR", date, due_date, note,
          payment_details, has_reminder: has_reminder || false,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-debt") {
      const { id, ...updates } = body;
      delete updates.action;
      const { data, error } = await supabase
        .from("debts")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-debt") {
      const { id } = body;
      const { error } = await supabase.from("debts").delete().eq("id", id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // --- PAYMENTS ---
    if (action === "add-payment") {
      const { debt_id, amount, currency, date, type, item_description, payment_details } = body;
      const { data, error } = await supabase
        .from("debt_payments")
        .insert({ debt_id, amount, currency: currency || "SAR", date, type, item_description, payment_details })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);

      // Check if fully paid
      const { data: payments } = await supabase
        .from("debt_payments")
        .select("amount")
        .eq("debt_id", debt_id);
      const { data: debt } = await supabase
        .from("debts")
        .select("amount")
        .eq("id", debt_id)
        .single();

      if (payments && debt) {
        const totalPaid = payments.reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0);
        if (totalPaid >= Number(debt.amount)) {
          await supabase.from("debts").update({ is_fully_paid: true }).eq("id", debt_id);
        }
      }

      return json({ data });
    }

    // --- POSTPONEMENTS ---
    if (action === "add-postponement") {
      const { debt_id, new_date, reason } = body;
      const { data, error } = await supabase
        .from("debt_postponements")
        .insert({ debt_id, new_date, reason })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);

      if (new_date) {
        await supabase.from("debts").update({ due_date: new_date }).eq("id", debt_id);
      }

      return json({ data });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
