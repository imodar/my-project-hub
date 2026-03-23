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

/**
 * Processes scheduled_notifications and sends push via Nativly API.
 * Also processes unread user_notifications for push delivery.
 * Called by pg_cron every 5 minutes.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!authHeader?.includes(serviceKey)) {
      return json({ error: "Unauthorized - service role only" }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey
    );

    // ─── 1. Process scheduled_notifications ───
    const { data: scheduled, error: schedErr } = await admin
      .from("scheduled_notifications")
      .select("*")
      .eq("sent", false)
      .lte("scheduled_at", new Date().toISOString())
      .limit(100);

    if (schedErr) return json({ error: schedErr.message }, 500);

    let scheduledCount = 0;
    if (scheduled?.length) {
      // Mark as sent
      const ids = scheduled.map((n: { id: string }) => n.id);
      await admin
        .from("scheduled_notifications")
        .update({ sent: true })
        .in("id", ids);

      // Also insert into user_notifications for in-app display
      for (const s of scheduled) {
        await admin.from("user_notifications").insert({
          user_id: s.user_id,
          type: s.type,
          title: s.title,
          body: s.body,
          source_type: s.type,
          source_id: s.id,
        });
      }

      scheduledCount = ids.length;

      // TODO: Send push via Nativly API when configured
      // const NATIVLY_API_KEY = Deno.env.get("NATIVLY_API_KEY");
      // if (NATIVLY_API_KEY) {
      //   for (const notif of scheduled) {
      //     const { data: tokens } = await admin
      //       .from("notification_tokens")
      //       .select("token, platform")
      //       .eq("user_id", notif.user_id);
      //     
      //     if (tokens?.length) {
      //       await fetch("https://api.nativly.app/v1/push", {
      //         method: "POST",
      //         headers: {
      //           "Authorization": `Bearer ${NATIVLY_API_KEY}`,
      //           "Content-Type": "application/json",
      //         },
      //         body: JSON.stringify({
      //           tokens: tokens.map(t => t.token),
      //           title: notif.title,
      //           body: notif.body,
      //           data: notif.data,
      //         }),
      //       });
      //     }
      //   }
      // }
    }

    return json({
      message: `Processed ${scheduledCount} scheduled notifications`,
      scheduledCount,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
