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

const MAX_REASON = 500;

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
    { const { data: _rlOk } = await adminClient.rpc("check_rate_limit", { _user_id: userId, _endpoint: "account-api", _max_per_minute: 60 }); if (!_rlOk) return json({ error: "Too many requests" }, 429); }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "request-export") {
      const { data, error } = await supabase.from("data_export_requests").insert({ user_id: userId }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "get-exports") {
      const { data, error } = await supabase.from("data_export_requests").select("*").eq("user_id", userId).order("requested_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "request-deletion") {
      const { reason } = body;
      if (reason && typeof reason === "string" && reason.length > MAX_REASON) return json({ error: "السبب طويل جداً (حد أقصى 500)" }, 400);

      const { data: memberships } = await supabase.from("family_members").select("family_id, is_admin").eq("user_id", userId).eq("is_admin", true);
      if (memberships?.length) {
        for (const m of memberships) {
          const { data: otherAdmins } = await supabase.from("family_members").select("id").eq("family_id", m.family_id).eq("is_admin", true).neq("user_id", userId);
          if (!otherAdmins?.length) {
            return json({ error: "أنت المشرف الوحيد في عائلتك. يجب تعيين مشرف آخر أو حذف العائلة أولاً." }, 400);
          }
        }
      }

      const { data, error } = await supabase.from("account_deletions").insert({ user_id: userId, reason: reason ? reason.trim().slice(0, MAX_REASON) : null }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "cancel-deletion") {
      const { error } = await supabase.from("account_deletions").delete().eq("user_id", userId).eq("status", "pending");
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "get-last-updated") {
      const { data: member } = await supabase.from("family_members").select("family_id").eq("user_id", userId).eq("status", "active").maybeSingle();
      if (!member?.family_id) return json({ last_updated_at: null });
      const { data, error } = await adminClient.rpc("get_family_last_updated", { _family_id: member.family_id });
      if (error) return json({ error: error.message }, 400);
      return json({ last_updated_at: data });
    }

    /* ──────────────────────────────────────────────
       DELETE ACCOUNT NOW — immediate & permanent
    ────────────────────────────────────────────── */
    if (action === "delete-account-now") {
      const { reason } = body;

      // 1. Check sole-admin constraint
      const { data: memberships } = await adminClient
        .from("family_members")
        .select("family_id, is_admin")
        .eq("user_id", userId)
        .eq("is_admin", true);

      if (memberships?.length) {
        for (const m of memberships) {
          const { data: otherAdmins } = await adminClient
            .from("family_members")
            .select("id")
            .eq("family_id", m.family_id)
            .eq("is_admin", true)
            .neq("user_id", userId);
          if (!otherAdmins?.length) {
            return json({
              error: "أنت المشرف الوحيد في عائلتك. يجب تعيين مشرف آخر أو حذف العائلة أولاً.",
              error_code: "SOLE_ADMIN",
            }, 400);
          }
        }
      }

      // 2. Get family_id for family-scoped data
      const { data: memberRow } = await adminClient
        .from("family_members")
        .select("family_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      const familyId = memberRow?.family_id;

      // 3. Delete storage files (avatar)
      try {
        const { data: avatarFiles } = await adminClient.storage.from("avatars").list(userId);
        if (avatarFiles?.length) {
          await adminClient.storage.from("avatars").remove(avatarFiles.map(f => `${userId}/${f.name}`));
        }
      } catch (_) { /* ignore storage errors */ }

      // 4. Delete chat media from storage
      if (familyId) {
        try {
          const { data: chatMsgs } = await adminClient
            .from("chat_messages")
            .select("media_url")
            .eq("sender_id", userId)
            .not("media_url", "is", null);
          if (chatMsgs?.length) {
            const paths = chatMsgs
              .map(m => {
                try {
                  const url = new URL(m.media_url!);
                  const idx = url.pathname.indexOf("/chat-media/");
                  return idx >= 0 ? url.pathname.slice(idx + "/chat-media/".length) : null;
                } catch { return null; }
              })
              .filter(Boolean) as string[];
            if (paths.length) await adminClient.storage.from("chat-media").remove(paths);
          }
        } catch (_) { /* ignore */ }
      }

      // 5. Delete all user data from tables (using adminClient to bypass RLS)
      const deletes: PromiseLike<any>[] = [];

      // Personal tables (user_id based)
      deletes.push(adminClient.from("tasbih_sessions").delete().eq("user_id", userId));
      deletes.push(adminClient.from("kids_worship_data").delete().eq("user_id", userId));
      deletes.push(adminClient.from("islamic_reminder_prefs").delete().eq("user_id", userId));
      deletes.push(adminClient.from("notification_tokens").delete().eq("user_id", userId));
      deletes.push(adminClient.from("scheduled_notifications").delete().eq("user_id", userId));
      deletes.push(adminClient.from("consent_log").delete().eq("user_id", userId));
      deletes.push(adminClient.from("data_export_requests").delete().eq("user_id", userId));
      deletes.push(adminClient.from("account_deletions").delete().eq("user_id", userId));
      deletes.push(adminClient.from("trash_items").delete().eq("user_id", userId));
      deletes.push(adminClient.from("feature_usage").delete().eq("user_id", userId));
      deletes.push(adminClient.from("member_locations").delete().eq("user_id", userId));

      // Debts and related
      const { data: userDebts } = await adminClient.from("debts").select("id").eq("user_id", userId);
      if (userDebts?.length) {
        const debtIds = userDebts.map(d => d.id);
        deletes.push(adminClient.from("debt_payments").delete().in("debt_id", debtIds));
        deletes.push(adminClient.from("debt_postponements").delete().in("debt_id", debtIds));
      }
      deletes.push(adminClient.from("debts").delete().eq("user_id", userId));

      // Chat messages
      deletes.push(adminClient.from("chat_messages").delete().eq("sender_id", userId));

      // Family keys
      deletes.push(adminClient.from("family_keys").delete().eq("user_id", userId));

      // Items added by user
      deletes.push(adminClient.from("calendar_events").delete().eq("added_by", userId));

      // Family membership — remove
      deletes.push(adminClient.from("family_members").delete().eq("user_id", userId));

      // Emergency contacts created by user
      deletes.push(adminClient.from("emergency_contacts").delete().eq("created_by", userId));

      await Promise.allSettled(deletes);

      // 6. Delete profile
      await adminClient.from("profiles").delete().eq("id", userId);

      // 7. Delete auth user
      const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteUserError) {
        return json({ error: deleteUserError.message }, 500);
      }

      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
