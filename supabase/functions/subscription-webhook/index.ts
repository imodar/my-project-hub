import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Verify RevenueCat webhook secret
  const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  const authHeader = req.headers.get("Authorization");
  if (webhookSecret && authHeader !== webhookSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const payload = await req.json();
    const event = payload?.event;
    if (!event?.type) return json({ error: "No event type" }, 400);

    const { type, expiration_at_ms, price, currency } = event;

    // RevenueCat sends original_app_user_id which is the Supabase user UUID we configured
    const userId = event.original_app_user_id || event.app_user_id;
    if (!userId) return json({ error: "No user ID in event" }, 400);

    // Determine subscription plan to set based on event type
    let profileUpdate: Record<string, unknown> | null = null;

    switch (type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
      case "TRANSFER":
        profileUpdate = {
          subscription_plan: "yearly",
          subscription_expires_at: expiration_at_ms
            ? new Date(Number(expiration_at_ms)).toISOString()
            : null,
        };
        break;

      case "CANCELLATION":
        // User cancelled — keep plan active until expiry date, do not cut off
        if (expiration_at_ms) {
          profileUpdate = {
            subscription_expires_at: new Date(Number(expiration_at_ms)).toISOString(),
          };
        }
        break;

      case "EXPIRATION":
        // Subscription fully expired — downgrade to free
        profileUpdate = {
          subscription_plan: "free",
          subscription_expires_at: null,
        };
        break;

      case "PRODUCT_CHANGE":
        profileUpdate = {
          subscription_plan: "yearly",
          subscription_expires_at: expiration_at_ms
            ? new Date(Number(expiration_at_ms)).toISOString()
            : null,
        };
        break;

      // BILLING_ISSUE, SUBSCRIBER_ALIAS, NON_RENEWING_PURCHASE — log only
    }

    // Apply profile update if determined
    if (profileUpdate && Object.keys(profileUpdate).length > 0) {
      const { error: updateErr } = await adminClient
        .from("profiles")
        .update(profileUpdate)
        .eq("id", userId);
      if (updateErr) {
        console.error("Profile update failed:", updateErr.message);
      }
    }

    // Log the event in subscription_events for admin visibility
    await adminClient.from("subscription_events").insert({
      user_id: userId,
      event_type: type.toLowerCase(),
      plan: "yearly",
      amount: price || null,
      currency: currency || "SAR",
    });

    return json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return json({ error: err.message }, 500);
  }
});
