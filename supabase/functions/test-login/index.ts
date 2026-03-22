import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEST_PHONE = "+966539998666";
const TEST_EMAIL = "test-user-539998666@ailti.app";
const TEST_PASSWORD = "AiltiTest2024!Secure";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();
    const fullPhone = phone.startsWith("+") ? phone : `+966${phone.replace(/^0/, "")}`;

    if (fullPhone !== TEST_PHONE) {
      return new Response(
        JSON.stringify({ error: "هذا الرقم غير مخصص للاختبار" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try to find existing user by email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let user = existingUsers?.users?.find((u) => u.email === TEST_EMAIL);

    if (!user) {
      // Create test user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        phone: TEST_PHONE,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: { name: "حساب تجريبي" },
      });
      if (createError) throw createError;
      user = newUser.user;
    }

    // Generate a magic link token to sign in
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: TEST_EMAIL,
    });

    if (linkError) throw linkError;

    // Extract token from the link
    const url = new URL(linkData.properties.action_link);
    const token = url.searchParams.get("token") || url.hash;

    // Use signInWithOtp verify approach with the token
    // Actually, let's use a simpler approach - sign in with password
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
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
