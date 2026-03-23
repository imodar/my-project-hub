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
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
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

    // Use service role for DB operations (user already authenticated above)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // CREATE family
    if (action === "create") {
      const { name, role } = body;
      if (!name) return json({ error: "اسم العائلة مطلوب" }, 400);

      const inviteCode = generateInviteCode();

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
      });
      if (memErr) return json({ error: memErr.message }, 400);

      return json({ data: family });
    }

    // JOIN family by invite code
    if (action === "join") {
      const { invite_code, role } = body;
      if (!invite_code) return json({ error: "رمز الدعوة مطلوب" }, 400);

      const { data: family, error: findErr } = await supabase
        .from("families")
        .select("id")
        .eq("invite_code", invite_code.toUpperCase())
        .single();
      if (findErr || !family) return json({ error: "رمز الدعوة غير صحيح" }, 404);

      // Check not already member
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
      });
      if (joinErr) return json({ error: joinErr.message }, 400);

      return json({ data: { family_id: family.id } });
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

      // Record removal
      await adminClient.from("member_removals").insert({
        family_id,
        removed_user_id: target_user_id,
        removed_by: userId,
        reason,
      });

      // Delete family key
      await supabase
        .from("family_keys")
        .delete()
        .eq("family_id", family_id)
        .eq("user_id", target_user_id);

      // Remove from family
      const { error } = await supabase
        .from("family_members")
        .delete()
        .eq("family_id", family_id)
        .eq("user_id", target_user_id);
      if (error) return json({ error: error.message }, 400);

      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
