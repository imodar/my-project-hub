import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map(s => s.trim()).filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

let corsHeaders: Record<string, string> = {};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_TITLE = 200;
const MAX_BODY = 1000;
const MAX_SEARCH = 100;
const MAX_VERSION = 50;
const MAX_NOTES = 2000;
const MAX_KEY = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }
function validStr(v: unknown, max: number): v is string { return typeof v === "string" && v.trim().length > 0 && v.length <= max; }
function sanitize(s: string, max: number): string { return s.trim().slice(0, max); }

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "admin-api", _max_per_minute: 120 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleData) return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    const logAudit = async (actionName: string, targetType?: string, targetId?: string, details?: unknown) => {
      await adminClient.from("admin_audit_log").insert({ admin_id: userId, action: actionName, target_type: targetType, target_id: targetId, details: details || {} });
    };

    // ─── DASHBOARD ───
    if (action === "dashboard-full") {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      const [{ count: userCount }, { count: familyCount }, { count: activeToday }, { count: newUsers7d }] = await Promise.all([
        adminClient.from("profiles").select("*", { count: "exact", head: true }).eq("is_deleted", false),
        adminClient.from("families").select("*", { count: "exact", head: true }),
        adminClient.from("profiles").select("*", { count: "exact", head: true }).gte("last_login_at", `${todayStr}T00:00:00Z`),
        adminClient.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
      ]);
      const { data: profiles } = await adminClient.from("profiles").select("subscription_plan").eq("is_deleted", false);
      const planCounts: Record<string, number> = {};
      (profiles || []).forEach((p: any) => { const plan = p.subscription_plan || "free"; planCounts[plan] = (planCounts[plan] || 0) + 1; });
      const subscription_breakdown = Object.entries(planCounts).map(([plan, count]) => ({ plan, count }));
      const { data: featureData } = await adminClient.from("feature_usage").select("feature_name").gte("created_at", weekAgo);
      const featureCounts: Record<string, number> = {};
      (featureData || []).forEach((f: any) => { featureCounts[f.feature_name] = (featureCounts[f.feature_name] || 0) + 1; });
      const top_features = Object.entries(featureCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
      return json({ data: { total_users: userCount || 0, total_families: familyCount || 0, active_today: activeToday || 0, new_users_7d: newUsers7d || 0, subscription_breakdown, top_features } });
    }

    // ─── USERS ───
    if (action === "get-users") {
      const { page = 1, limit = 20, search } = body;
      const safePage = Math.max(1, Math.min(Number(page) || 1, 1000));
      const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
      if (search && typeof search === "string" && search.length > MAX_SEARCH) return json({ error: "البحث طويل جداً" }, 400);
      let query = adminClient.from("profiles").select("*", { count: "exact" }).eq("is_deleted", false).order("created_at", { ascending: false }).range((safePage - 1) * safeLimit, safePage * safeLimit - 1);
      if (search) { query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`); }
      const { data, error, count } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data, total: count });
    }

    // ─── FAMILIES ───
    if (action === "get-families") {
      const { page = 1, limit = 20, search } = body;
      const safePage = Math.max(1, Math.min(Number(page) || 1, 1000));
      const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
      if (search && typeof search === "string" && search.length > MAX_SEARCH) return json({ error: "البحث طويل جداً" }, 400);
      let query = adminClient.from("families").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((safePage - 1) * safeLimit, safePage * safeLimit - 1);
      if (search) { query = query.ilike("name", `%${search}%`); }
      const { data: families, error, count } = await query;
      if (error) return json({ error: error.message }, 400);
      if (!families?.length) return json({ data: [], total: count });

      // Batch: get all members for these families in ONE query
      const familyIds = families.map((f: any) => f.id);
      const { data: allMembers } = await adminClient.from("family_members")
        .select("id, user_id, role, is_admin, status, family_id")
        .in("family_id", familyIds)
        .eq("status", "active");

      // Batch: get all profile names in ONE query
      const userIds = [...new Set((allMembers || []).map((m: any) => m.user_id))];
      const profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await adminClient.from("profiles").select("id, name").in("id", userIds);
        (profiles || []).forEach((p: any) => { profileMap[p.id] = p.name || null; });
      }

      // Group members by family_id
      const membersByFamily: Record<string, any[]> = {};
      (allMembers || []).forEach((m: any) => {
        if (!membersByFamily[m.family_id]) membersByFamily[m.family_id] = [];
        membersByFamily[m.family_id].push({ ...m, profile_name: profileMap[m.user_id] || null });
      });

      const enriched = families.map((f: any) => ({
        ...f,
        member_count: (membersByFamily[f.id] || []).length,
        members: membersByFamily[f.id] || [],
      }));

      return json({ data: enriched, total: count });
    }

    // ─── CONTENT STATS ───
    if (action === "content-stats") {
      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];
      const counts = await Promise.all([
        adminClient.from("calendar_events").select("*", { count: "exact", head: true }),
        adminClient.from("task_items").select("*", { count: "exact", head: true }),
        adminClient.from("task_items").select("*", { count: "exact", head: true }).eq("done", true),
        adminClient.from("market_lists").select("*", { count: "exact", head: true }),
        adminClient.from("market_items").select("*", { count: "exact", head: true }),
        adminClient.from("medications").select("*", { count: "exact", head: true }),
        adminClient.from("medication_logs").select("*", { count: "exact", head: true }),
        adminClient.from("debts").select("*", { count: "exact", head: true }).eq("is_fully_paid", false),
        adminClient.from("debts").select("*", { count: "exact", head: true }).eq("is_fully_paid", true),
        adminClient.from("trips").select("*", { count: "exact", head: true }),
        adminClient.from("document_items").select("*", { count: "exact", head: true }),
        adminClient.from("document_items").select("*", { count: "exact", head: true }).lte("expiry_date", in7Days).gte("expiry_date", now.toISOString().split("T")[0]),
        adminClient.from("albums").select("*", { count: "exact", head: true }),
        adminClient.from("album_photos").select("*", { count: "exact", head: true }),
        adminClient.from("chat_messages").select("*", { count: "exact", head: true }),
        adminClient.from("places").select("*", { count: "exact", head: true }),
        adminClient.from("vaccination_children").select("*", { count: "exact", head: true }),
      ]);
      let vehicleCount = 0; try { const { count } = await adminClient.from("vehicles").select("*", { count: "exact", head: true }); vehicleCount = count || 0; } catch {}
      let willCount = 0; try { const { count } = await adminClient.from("wills").select("*", { count: "exact", head: true }); willCount = count || 0; } catch {}
      let zakatCount = 0; try { const { count } = await adminClient.from("zakat_assets").select("*", { count: "exact", head: true }); zakatCount = count || 0; } catch {}
      return json({ data: { events: counts[0].count || 0, tasks: counts[1].count || 0, tasks_done: counts[2].count || 0, market_lists: counts[3].count || 0, market_items: counts[4].count || 0, medications: counts[5].count || 0, med_logs: counts[6].count || 0, debts: counts[7].count || 0, debts_paid: counts[8].count || 0, trips: counts[9].count || 0, documents: counts[10].count || 0, docs_expiring: counts[11].count || 0, albums: counts[12].count || 0, photos: counts[13].count || 0, chat_messages: counts[14].count || 0, places: counts[15].count || 0, vacc_children: counts[16].count || 0, vehicles: vehicleCount, wills: willCount, zakat: zakatCount } });
    }

    if (action === "get-audit-log") {
      const { page = 1, limit = 50 } = body;
      const safePage = Math.max(1, Number(page) || 1);
      const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
      const { data, error } = await adminClient.from("admin_audit_log").select("*").order("created_at", { ascending: false }).range((safePage - 1) * safeLimit, safePage * safeLimit - 1);
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "get-notification-log") {
      const { page = 1, limit = 50 } = body;
      const safePage = Math.max(1, Number(page) || 1);
      const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
      const { data, error } = await adminClient.from("notification_log").select("*").order("sent_at", { ascending: false }).range((safePage - 1) * safeLimit, safePage * safeLimit - 1);
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "get-subscriptions") {
      const { data: profiles } = await adminClient.from("profiles").select("subscription_plan").eq("is_deleted", false);
      const planCounts: Record<string, number> = {};
      let paid = 0, free = 0;
      (profiles || []).forEach((p: any) => { const plan = p.subscription_plan || "free"; planCounts[plan] = (planCounts[plan] || 0) + 1; if (plan === "free") free++; else paid++; });
      const { data: events } = await adminClient.from("subscription_events").select("*").order("created_at", { ascending: false }).limit(50);
      const totalRevenue = (events || []).reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
      return json({ data: { breakdown: Object.entries(planCounts).map(([plan, count]) => ({ plan, count })), paid_count: paid, free_count: free, total_revenue: totalRevenue, recent_events: events || [] } });
    }

    if (action === "get-settings") {
      const { data, error } = await adminClient.from("system_settings").select("*").order("updated_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-setting") {
      const { key, value } = body;
      if (!validStr(key, MAX_KEY)) return json({ error: "المفتاح مطلوب (حد أقصى 100)" }, 400);
      const { data: existing } = await adminClient.from("system_settings").select("id").eq("key", key).maybeSingle();
      if (existing) { await adminClient.from("system_settings").update({ value, updated_by: userId }).eq("id", existing.id); }
      else { await adminClient.from("system_settings").insert({ key: sanitize(key, MAX_KEY), value, updated_by: userId }); }
      await logAudit("update_setting", "setting", key, { value });
      return json({ success: true });
    }

    if (action === "get-versions") {
      const { data, error } = await adminClient.from("app_versions").select("*").order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-version") {
      const { version, release_notes, force_update, min_supported_version, update_message } = body;
      if (!validStr(version, MAX_VERSION)) return json({ error: "الإصدار مطلوب (حد أقصى 50)" }, 400);
      if (release_notes && typeof release_notes === "string" && release_notes.length > MAX_NOTES) return json({ error: "ملاحظات الإصدار طويلة جداً" }, 400);
      if (update_message && typeof update_message === "string" && update_message.length > 500) return json({ error: "رسالة التحديث طويلة جداً" }, 400);
      const { error } = await adminClient.from("app_versions").insert({ version: sanitize(version, MAX_VERSION), release_notes: release_notes ? sanitize(release_notes, MAX_NOTES) : null, force_update: force_update || false, min_supported_version: min_supported_version || null, update_message: update_message || null });
      if (error) return json({ error: error.message }, 400);
      await logAudit("add_version", "app_version", version, { release_notes });
      return json({ success: true });
    }

    if (action === "get-security") {
      const todayStr = new Date().toISOString().split("T")[0];
      const [{ count: otpToday }, { count: consentCount }, { count: exportReqs }, { count: deletionReqs }] = await Promise.all([
        adminClient.from("otp_codes").select("*", { count: "exact", head: true }).gte("created_at", `${todayStr}T00:00:00Z`),
        adminClient.from("consent_log").select("*", { count: "exact", head: true }),
        adminClient.from("data_export_requests").select("*", { count: "exact", head: true }),
        adminClient.from("account_deletions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      const { data: recentOtps } = await adminClient.from("otp_codes").select("*").order("created_at", { ascending: false }).limit(20);
      const { data: deletionList } = await adminClient.from("account_deletions").select("*").order("requested_at", { ascending: false }).limit(20);
      return json({ data: { otp_today: otpToday || 0, consent_count: consentCount || 0, export_requests: exportReqs || 0, deletion_requests: deletionReqs || 0, recent_otps: recentOtps || [], deletion_list: deletionList || [] } });
    }

    if (action === "suspend-user") {
      const { target_user_id, reason } = body;
      if (!validUuid(target_user_id)) return json({ error: "target_user_id غير صالح" }, 400);
      if (reason && typeof reason === "string" && reason.length > 500) return json({ error: "السبب طويل جداً" }, 400);
      await adminClient.auth.admin.updateUserById(target_user_id, { ban_duration: "876000h" });
      await logAudit("suspend_user", "user", target_user_id, { reason });
      return json({ success: true });
    }

    if (action === "unsuspend-user") {
      const { target_user_id } = body;
      if (!validUuid(target_user_id)) return json({ error: "target_user_id غير صالح" }, 400);
      await adminClient.auth.admin.updateUserById(target_user_id, { ban_duration: "none" });
      await logAudit("unsuspend_user", "user", target_user_id);
      return json({ success: true });
    }

    if (action === "send-broadcast") {
      const { title, body: notifBody } = body;
      if (!validStr(title, MAX_TITLE)) return json({ error: "العنوان مطلوب (حد أقصى 200)" }, 400);
      if (notifBody && typeof notifBody === "string" && notifBody.length > MAX_BODY) return json({ error: "المحتوى طويل جداً" }, 400);
      await adminClient.from("notification_log").insert({ title: sanitize(title, MAX_TITLE), body: notifBody ? sanitize(notifBody, MAX_BODY) : null, sent_by: userId, target_type: "broadcast" });
      await logAudit("send_broadcast", "notification", null, { title });
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
