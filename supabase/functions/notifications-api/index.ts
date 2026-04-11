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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }

/** إرسال FCM Push Notification عبر Firebase HTTP v1 API */
async function sendFcmPush(tokens: string[], title: string, body: string, data: Record<string, string>) {
  const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
  if (!fcmServerKey || tokens.length === 0) return;

  // FCM Legacy HTTP API — يعمل مع توكنات الجهاز مباشرةً
  const payload = {
    registration_ids: tokens,
    notification: { title, body, sound: "default" },
    data: { ...data, click_action: "FLUTTER_NOTIFICATION_CLICK" },
    priority: "high",
    android: { priority: "HIGH" },
    apns: { headers: { "apns-priority": "10" } },
  };

  await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${fcmServerKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).catch(() => {/* non-fatal */});
}

async function handleSosAlert(adminClient: any, userId: string, familyId: string, type: "send" | "cancel") {
  // Verify membership
  const { data: membership } = await adminClient.from("family_members")
    .select("id").eq("user_id", userId).eq("family_id", familyId).eq("status", "active").maybeSingle();
  if (!membership) return json({ error: "غير مصرح" }, 403);

  // Get sender name
  const { data: profile } = await adminClient.from("profiles").select("name, fcm_token").eq("id", userId).single();
  const senderName = profile?.name || "أحد أفراد العائلة";

  // Get other active members + their FCM tokens
  const { data: members } = await adminClient.from("family_members")
    .select("user_id").eq("family_id", familyId).eq("status", "active").neq("user_id", userId);
  const memberIds = (members || []).map((m: any) => m.user_id);
  if (memberIds.length === 0) return json({ data: { notified: 0 } });

  // جلب FCM tokens لأعضاء العائلة
  const { data: profiles } = await adminClient.from("profiles")
    .select("id, fcm_token").in("id", memberIds);
  const fcmTokens = (profiles || []).map((p: any) => p.fcm_token).filter(Boolean) as string[];

  const notifTitle = type === "send" ? "🚨 تنبيه طوارئ" : "✅ إلغاء تنبيه الطوارئ";
  const notifBody  = type === "send"
    ? `${senderName} يحتاج مساعدة!`
    : `${senderName} بخير — تم إلغاء التنبيه`;

  // إرسال FCM Push (حتى لو التطبيق مغلق)
  await sendFcmPush(fcmTokens, notifTitle, notifBody, {
    type: type === "send" ? "sos_alert" : "sos_cancelled",
    sender_id: userId,
    family_id: familyId,
    sender_name: senderName,
  });

  // حفظ الإشعار في قاعدة البيانات (للتاريخ وللمستخدمين الذين لا يملكون FCM token)
  await adminClient.from("user_notifications").insert(
    memberIds.map((uid: string) => ({
      user_id: uid,
      family_id: familyId,
      type: type === "send" ? "sos_alert" : "sos_cancelled",
      title: notifTitle,
      body: notifBody,
      source_type: "sos",
      source_id: userId,
      is_read: false,
    }))
  );

  return json({ data: { notified: memberIds.length, pushed: fcmTokens.length } });
}

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
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "notifications-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-notifications") {
      const { limit: reqLimit, before } = body;
      if (before && typeof before !== "string") return json({ error: "before غير صالح" }, 400);
      const safeLimit = Math.min(Math.max(Number(reqLimit) || 30, 1), 100);
      let query = supabase.from("user_notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(safeLimit);
      if (before && typeof before === "string") { query = query.lt("created_at", before); }
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data, hasMore: (data?.length ?? 0) === safeLimit });
    }

    if (action === "mark-read") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("user_notifications").update({ is_read: true } as any).eq("id", id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "mark-unread") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("user_notifications").update({ is_read: false } as any).eq("id", id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "mark-all-read") {
      const { error } = await supabase.from("user_notifications").update({ is_read: true } as any).eq("user_id", userId).eq("is_read", false);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "delete-notification") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("user_notifications").delete().eq("id", id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "send-sos-alert") {
      const { family_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      return handleSosAlert(adminClient, userId, family_id, "send");
    }

    if (action === "cancel-sos-alert") {
      const { family_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      return handleSosAlert(adminClient, userId, family_id, "cancel");
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
