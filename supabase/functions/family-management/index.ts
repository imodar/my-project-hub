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

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function generateUniqueInviteCode(client: any): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateInviteCode();
    const { data } = await client
      .from("families")
      .select("id")
      .eq("invite_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return generateInviteCode().slice(0, 4) + ts;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = authUser.id;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ── Admin authorization for sensitive actions ──
    if (["toggle-admin", "remove-member", "confirm-role"].includes(action)) {
      const { family_id } = body;
      if (!family_id) return json({ error: "family_id مطلوب" }, 400);
      const { data: isAdmin } = await supabase.rpc("is_family_admin", {
        _user_id: userId,
        _family_id: family_id,
      });
      if (!isAdmin) return json({ error: "غير مصرح" }, 403);
    }

    // CREATE family
    if (action === "create") {
      const { name, role } = body;
      if (!name) return json({ error: "اسم العائلة مطلوب" }, 400);

      const inviteCode = await generateUniqueInviteCode(adminClient);

      const { data: family, error: famErr } = await adminClient
        .from("families")
        .insert({ name, created_by: userId, invite_code: inviteCode })
        .select()
        .single();
      if (famErr) return json({ error: famErr.message }, 400);

      const { error: memErr } = await adminClient.from("family_members").insert({
        family_id: family.id,
        user_id: userId,
        role: role || "father",
        is_admin: true,
        status: "active",
        role_confirmed: true,
      });
      if (memErr) return json({ error: memErr.message }, 400);

      return json({ data: family });
    }

    // JOIN family by invite code
    if (action === "join") {
      const { invite_code, role } = body;
      if (!invite_code) return json({ error: "رمز الدعوة مطلوب" }, 400);

      console.log("Join attempt with code:", invite_code.toUpperCase(), "by user:", userId);

      const { data: family, error: findErr } = await supabase
        .from("families")
        .select("id")
        .eq("invite_code", invite_code.toUpperCase())
        .single();
      console.log("Family lookup result:", { family, findErr });
      if (findErr || !family) return json({ error: "رمز الدعوة غير صحيح — تأكد من الكود" }, 404);

      const { data: existing } = await supabase
        .from("family_members")
        .select("id")
        .eq("family_id", family.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) return json({ error: "أنت عضو بالفعل في هذه العائلة" }, 400);

      const { error: joinErr } = await adminClient.from("family_members").insert({
        family_id: family.id,
        user_id: userId,
        role: role || "son",
        is_admin: false,
        status: "active",
        role_confirmed: false,
      });
      console.log("Join insert result:", { joinErr });
      if (joinErr) return json({ error: "فشل الانضمام: " + joinErr.message }, 400);

      // Notify admins about new member
      try {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("name")
          .eq("id", userId)
          .single();
        const memberName = profile?.name || "عضو جديد";

        const { data: admins } = await adminClient
          .from("family_members")
          .select("user_id")
          .eq("family_id", family.id)
          .eq("is_admin", true)
          .eq("status", "active");

        if (admins && admins.length > 0) {
          const notifications = admins
            .filter((a: any) => a.user_id !== userId)
            .map((a: any) => ({
              user_id: a.user_id,
              type: "new_member",
              title: "طلب انضمام جديد",
              body: `${memberName} انضم للعائلة — تحقق من دوره`,
              scheduled_at: new Date().toISOString(),
              sent: false,
              data: { family_id: family.id, member_id: userId },
            }));
          if (notifications.length > 0) {
            await adminClient.from("scheduled_notifications").insert(notifications);
          }
        }
      } catch {
        // Non-critical — don't fail the join
      }

      return json({ data: { family_id: family.id } });
    }

    // CONFIRM ROLE
    if (action === "confirm-role") {
      const { family_id, target_user_id, role } = body;
      if (!target_user_id || !role) return json({ error: "بيانات ناقصة" }, 400);

      const { error } = await adminClient
        .from("family_members")
        .update({ role, role_confirmed: true })
        .eq("family_id", family_id)
        .eq("user_id", target_user_id);
      if (error) return json({ error: error.message }, 400);

      // Notify the member
      try {
        await adminClient.from("scheduled_notifications").insert({
          user_id: target_user_id,
          type: "role_confirmed",
          title: "تم تأكيد انضمامك",
          body: "تم تأكيد دورك في العائلة من قبل المشرف",
          scheduled_at: new Date().toISOString(),
          sent: false,
          data: { family_id },
        });
      } catch {}

      return json({ success: true });
    }

    // GET members
    if (action === "get-members") {
      const { family_id } = body;
      if (!family_id) return json({ error: "family_id مطلوب" }, 400);

      const { data, error } = await supabase
        .from("family_members")
        .select("*, profiles:user_id(name, avatar_url, phone)")
        .eq("family_id", family_id)
        .eq("status", "active");
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // GET my family
    if (action === "get-my-family") {
      const { data: membership } = await supabase
        .from("family_members")
        .select("family_id, role, is_admin, families(id, name, invite_code, created_at)")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      return json({ data: membership });
    }

    // TOGGLE admin
    if (action === "toggle-admin") {
      const { family_id, target_user_id, is_admin } = body;

      const { data, error } = await supabase
        .from("family_members")
        .update({ is_admin })
        .eq("family_id", family_id)
        .eq("user_id", target_user_id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // REMOVE member
    if (action === "remove-member") {
      const { family_id, target_user_id, reason } = body;

      await adminClient.from("member_removals").insert({
        family_id,
        removed_user_id: target_user_id,
        removed_by: userId,
        reason,
      });

      await supabase
        .from("family_keys")
        .delete()
        .eq("family_id", family_id)
        .eq("user_id", target_user_id);

      const { error } = await supabase
        .from("family_members")
        .delete()
        .eq("family_id", family_id)
        .eq("user_id", target_user_id);
      if (error) return json({ error: error.message }, 400);

      return json({ success: true });
    }

    // REGENERATE invite code
    if (action === "regenerate-code") {
      const { family_id } = body;
      if (!family_id) return json({ error: "family_id مطلوب" }, 400);

      const newCode = await generateUniqueInviteCode(adminClient);

      const { data, error } = await adminClient
        .from("families")
        .update({ invite_code: newCode })
        .eq("id", family_id)
        .select("invite_code")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data: { invite_code: data.invite_code } });
    }

    // GET current invite code
    if (action === "get-invite-code") {
      const { family_id } = body;
      if (!family_id) return json({ error: "family_id مطلوب" }, 400);

      const { data, error } = await adminClient
        .from("families")
        .select("invite_code")
        .eq("id", family_id)
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data: { invite_code: data.invite_code } });
    }

    // LEAVE family (self-removal)
    if (action === "leave") {
      const { family_id } = body;
      if (!family_id) return json({ error: "family_id مطلوب" }, 400);

      // Check membership
      const { data: membership } = await supabase
        .from("family_members")
        .select("id, is_admin")
        .eq("family_id", family_id)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (!membership) return json({ error: "أنت لست عضواً في هذه العائلة" }, 400);

      // Count remaining admins to prevent leaving with no admin
      if (membership.is_admin) {
        const { data: admins } = await adminClient
          .from("family_members")
          .select("id")
          .eq("family_id", family_id)
          .eq("is_admin", true)
          .eq("status", "active");
        if (admins && admins.length <= 1) {
          return json({ error: "لا يمكنك المغادرة — أنت المشرف الوحيد. عيّن مشرفاً آخر أولاً." }, 400);
        }
      }

      // Remove family key
      await adminClient
        .from("family_keys")
        .delete()
        .eq("family_id", family_id)
        .eq("user_id", userId);

      // Delete membership
      const { error } = await adminClient
        .from("family_members")
        .delete()
        .eq("family_id", family_id)
        .eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);

      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
