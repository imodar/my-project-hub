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

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // --- EMERGENCY CONTACTS ---
    if (action === "get-emergency-contacts") {
      const { family_id } = body;
      const { data, error } = await supabase
        .from("emergency_contacts")
        .select("*")
        .eq("family_id", family_id);
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "add-emergency-contact") {
      const { family_id, name, phone } = body;
      const { data, error } = await supabase
        .from("emergency_contacts")
        .insert({ family_id, name, phone, created_by: userId })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-emergency-contact") {
      const { id } = body;
      const { error } = await supabase.from("emergency_contacts").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // --- CONSENT ---
    if (action === "log-consent") {
      const { consent_type, version, accepted, ip_address } = body;
      const { data, error } = await supabase
        .from("consent_log")
        .insert({ user_id: userId, consent_type, version, accepted: accepted !== false, ip_address })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // --- NOTIFICATION TOKENS ---
    if (action === "register-token") {
      const { token, device_info, platform } = body;
      // Upsert by token
      const { data: existing } = await supabase
        .from("notification_tokens")
        .select("id")
        .eq("token", token)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("notification_tokens")
          .update({ user_id: userId, device_info, platform })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      } else {
        const { data, error } = await supabase
          .from("notification_tokens")
          .insert({ user_id: userId, token, device_info, platform })
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
