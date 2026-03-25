import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();
    const fullPhone = phone.startsWith("+") ? phone : `+966${phone.replace(/^0/, "")}`;

    // Create a deterministic email from the phone number
    const sanitized = fullPhone.replace(/\D/g, "");
    const email = `user-${sanitized}@ailti.app`;
    const password = `Ailti!${sanitized}Secure2024`;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try to find existing user by email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let user = existingUsers?.users?.find((u) => u.email === email);

    if (!user) {
      // Check if phone is already on another user and remove it first
      const phoneUser = existingUsers?.users?.find((u) => u.phone === fullPhone);
      if (phoneUser) {
        await supabaseAdmin.auth.admin.updateUser(phoneUser.id, { phone: "" });
      }

      // Create user with this phone
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        phone: fullPhone,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: { name: "" },
      });
      if (createError) throw createError;
      user = newUser.user;
    }

    // Sign in with password
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) throw signInError;

    return new Response(
      JSON.stringify({
        access_token: signInData.session?.access_token,
        refresh_token: signInData.session?.refresh_token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
