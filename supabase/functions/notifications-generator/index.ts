import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const PROJECT_ORIGIN_FALLBACKS = [
  "https://7571dddb-1161-4f53-9036-32778235da46.lovableproject.com",
  "https://id-preview--7571dddb-1161-4f53-9036-32778235da46.lovable.app",
  "https://ailti.lovable.app",
  "https://d0479375-ab8c-4895-86c0-45a5df6d51d8.lovableproject.com",
  "http://localhost",
  "capacitor://localhost",
];

const ALLOWED_ORIGINS = Array.from(new Set([
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ...PROJECT_ORIGIN_FALLBACKS,
]));

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  let allowed = "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    allowed = origin;
  } else if (origin === "" || origin === "null") {
    allowed = "capacitor://localhost";
  }
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

interface NotifPayload {
  user_id: string;
  family_id: string | null;
  type: string;
  title: string;
  body: string | null;
  source_type: string;
  source_id: string;
}

/**
 * Generates in-app notifications from various sources.
 * Called by pg_cron every 15 minutes.
 *
 * Sources:
 *  1. Calendar events with reminder_before
 *  2. Debts with due_date & has_reminder
 *  3. Medications with reminder_enabled
 *  4. Documents with expiry_date & reminder_enabled
 */
Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
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

    const now = new Date();
    const notifications: NotifPayload[] = [];

    // ─── 1. Calendar Events ───
    // Check events happening in the next 24 hours that have reminders
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = now.toISOString().split("T")[0];
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const { data: calEvents } = await admin
      .from("calendar_events")
      .select("id, title, date, family_id, added_by, reminder_before")
      .gte("date", todayStr)
      .lte("date", tomorrowStr);

    if (calEvents) {
      for (const ev of calEvents) {
        // Get all family members to notify
        const { data: members } = await admin
          .from("family_members")
          .select("user_id")
          .eq("family_id", ev.family_id)
          .eq("status", "active");

        if (!members) continue;

        const isToday = ev.date === todayStr;
        const label = isToday ? "اليوم" : "غداً";

        for (const m of members) {
          notifications.push({
            user_id: m.user_id,
            family_id: ev.family_id,
            type: "calendar",
            title: `📅 ${ev.title}`,
            body: `لديك موعد ${label}: ${ev.title}`,
            source_type: "calendar_event",
            source_id: ev.id,
          });
        }
      }
    }

    // ─── 2. Debts Due ───
    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);
    const in3DaysStr = in3Days.toISOString().split("T")[0];

    const { data: debts } = await admin
      .from("debts")
      .select("id, person_name, amount, currency, due_date, direction, user_id, family_id, has_reminder")
      .eq("has_reminder", true)
      .eq("is_fully_paid", false)
      .eq("is_archived", false)
      .gte("due_date", todayStr)
      .lte("due_date", in3DaysStr);

    if (debts) {
      for (const d of debts) {
        const isDueToday = d.due_date === todayStr;
        const dirLabel = d.direction === "owed_to_me" ? "لك عند" : "عليك لـ";
        const urgency = isDueToday ? "⚠️ " : "";

        notifications.push({
          user_id: d.user_id,
          family_id: d.family_id,
          type: "debt",
          title: `${urgency}💰 دين مستحق`,
          body: `${dirLabel} ${d.person_name}: ${d.amount} ${d.currency}`,
          source_type: "debt",
          source_id: d.id,
        });
      }
    }

    // ─── 3. Medications ───
    const dayOfWeek = now.getDay(); // 0=Sun
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    const { data: meds } = await admin
      .from("medications")
      .select("id, name, member_name, family_id, frequency_type, selected_days, specific_times, times_per_day")
      .eq("reminder_enabled", true);

    if (meds) {
      for (const med of meds) {
        // Check if today is a selected day for weekly meds
        if (med.frequency_type === "weekly" && med.selected_days?.length) {
          if (!med.selected_days.includes(dayOfWeek)) continue;
        }

        // Get family members to notify
        const { data: members } = await admin
          .from("family_members")
          .select("user_id")
          .eq("family_id", med.family_id)
          .eq("status", "active");

        if (!members) continue;

        const forWhom = med.member_name ? ` (${med.member_name})` : "";

        // Generate a notification for each specific dose time
        const times = med.specific_times?.length ? med.specific_times : ["00:00"];

        for (const time of times) {
          const [h, m] = time.split(":").map(Number);
          // Only notify if we're within 15 min window of this dose time
          const diffMin = (currentHour - h) * 60 + (currentMin - m);
          if (diffMin < 0 || diffMin >= 15) continue;

          for (const member of members) {
            notifications.push({
              user_id: member.user_id,
              family_id: med.family_id,
              type: "medication",
              title: `💊 تذكير دواء`,
              body: `حان موعد ${med.name}${forWhom} - الساعة ${time}`,
              source_type: "medication",
              source_id: `${med.id}_${todayStr}_${time}`,
            });
          }
        }
      }
    }

    // ─── 4. Document Expiry ───
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);
    const in7DaysStr = in7Days.toISOString().split("T")[0];

    const { data: docs } = await admin
      .from("document_items")
      .select("id, name, expiry_date, list_id, reminder_enabled")
      .eq("reminder_enabled", true)
      .gte("expiry_date", todayStr)
      .lte("expiry_date", in7DaysStr);

    if (docs) {
      for (const doc of docs) {
        // Get family_id from the list
        const { data: list } = await admin
          .from("document_lists")
          .select("family_id")
          .eq("id", doc.list_id)
          .single();

        if (!list) continue;

        const { data: members } = await admin
          .from("family_members")
          .select("user_id")
          .eq("family_id", list.family_id)
          .eq("status", "active");

        if (!members) continue;

        const isExpToday = doc.expiry_date === todayStr;
        const label = isExpToday ? "ينتهي اليوم!" : "ينتهي قريباً";

        for (const m of members) {
          notifications.push({
            user_id: m.user_id,
            family_id: list.family_id,
            type: "document",
            title: `📄 مستند ${label}`,
            body: `${doc.name} - ${label}`,
            source_type: "document",
            source_id: doc.id,
          });
        }
      }
    }

    // ─── Deduplicate: skip if same notification already exists today ───
    if (notifications.length === 0) {
      return json({ message: "No notifications to generate", count: 0 });
    }

    let inserted = 0;
    for (const notif of notifications) {
      // Check if already sent today for same source
      const { data: existing } = await admin
        .from("user_notifications")
        .select("id")
        .eq("user_id", notif.user_id)
        .eq("source_type", notif.source_type)
        .eq("source_id", notif.source_id)
        .gte("created_at", `${todayStr}T00:00:00Z`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const { error } = await admin
        .from("user_notifications")
        .insert(notif);

      if (!error) inserted++;
    }

    return json({
      message: `Generated ${inserted} notifications (${notifications.length} candidates)`,
      count: inserted,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
