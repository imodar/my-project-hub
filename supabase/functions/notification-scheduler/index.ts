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

// Called by pg_cron every 5 minutes
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify service role key for cron calls
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!authHeader?.includes(serviceKey)) {
      return json({ error: "Unauthorized - service role only" }, 401);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey
    );

    // Get pending notifications
    const { data: notifications, error } = await adminClient
      .from("scheduled_notifications")
      .select("*, notification_tokens:user_id(token, platform)")
      .eq("sent", false)
      .lte("scheduled_at", new Date().toISOString())
      .limit(100);

    if (error) return json({ error: error.message }, 500);
    if (!notifications?.length) return json({ message: "No pending notifications", count: 0 });

    // TODO: Send via FCM when Firebase is configured
    // For now, mark as sent
    const ids = notifications.map((n: { id: string }) => n.id);
    await adminClient
      .from("scheduled_notifications")
      .update({ sent: true })
      .in("id", ids);

    return json({ message: `Processed ${ids.length} notifications`, count: ids.length });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
