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

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    // Verify admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // --- DASHBOARD ---
    if (action === "dashboard") {
      const { count: userCount } = await adminClient
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_deleted", false);

      const { count: familyCount } = await adminClient
        .from("families")
        .select("*", { count: "exact", head: true });

      const { count: activeToday } = await adminClient
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_login_at", new Date(Date.now() - 86400000).toISOString());

      return json({
        data: {
          total_users: userCount || 0,
          total_families: familyCount || 0,
          active_today: activeToday || 0,
        },
      });
    }

    // --- USERS ---
    if (action === "get-users") {
      const { page = 1, limit = 20, search } = body;
      let query = adminClient
        .from("profiles")
        .select("*", { count: "exact" })
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (search) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data, total: count });
    }

    // --- AUDIT LOG ---
    if (action === "get-audit-log") {
      const { page = 1, limit = 50 } = body;
      const { data, error } = await adminClient
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // --- LOG ACTION ---
    const logAudit = async (actionName: string, targetType?: string, targetId?: string, details?: unknown) => {
      await adminClient.from("admin_audit_log").insert({
        admin_id: userId,
        action: actionName,
        target_type: targetType,
        target_id: targetId,
        details: details || {},
      });
    };

    // --- SUSPEND USER ---
    if (action === "suspend-user") {
      const { target_user_id, reason } = body;
      await adminClient.auth.admin.updateUserById(target_user_id, { ban_duration: "876000h" });
      await logAudit("suspend_user", "user", target_user_id, { reason });
      return json({ success: true });
    }

    // --- UNSUSPEND USER ---
    if (action === "unsuspend-user") {
      const { target_user_id } = body;
      await adminClient.auth.admin.updateUserById(target_user_id, { ban_duration: "none" });
      await logAudit("unsuspend_user", "user", target_user_id);
      return json({ success: true });
    }

    // --- SYSTEM SETTINGS ---
    if (action === "get-settings") {
      const { data, error } = await adminClient.from("system_settings").select("*");
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-setting") {
      const { key, value } = body;
      const { data: existing } = await adminClient
        .from("system_settings")
        .select("id")
        .eq("key", key)
        .maybeSingle();

      if (existing) {
        await adminClient.from("system_settings").update({ value, updated_by: userId }).eq("id", existing.id);
      } else {
        await adminClient.from("system_settings").insert({ key, value, updated_by: userId });
      }
      await logAudit("update_setting", "setting", key, { value });
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
