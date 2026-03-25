import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");

  if (!digits) return "";
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("0")) return `966${digits.slice(1)}`;
  if (digits.startsWith("5")) return `966${digits}`;

  return digits;
};

const findAuthUserByPhoneOrEmail = async (
  adminClient: ReturnType<typeof createClient>,
  email: string,
  normalizedPhone: string,
) => {
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data.users ?? [];
    const matchedUser = users.find((candidate) => {
      const candidatePhone = normalizePhone(candidate.phone ?? "");
      return candidate.email === email || candidatePhone === normalizedPhone;
    });

    if (matchedUser) return matchedUser;
    if (users.length < perPage) return null;

    page += 1;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();
    const normalizedPhone = normalizePhone(phone);
    const fullPhone = `+${normalizedPhone}`;

    // Create a deterministic email from the phone number
    const sanitized = normalizedPhone;
    const email = `user-${sanitized}@ailti.app`;
    const password = `Ailti!${sanitized}Secure2024`;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let user = await findAuthUserByPhoneOrEmail(supabaseAdmin, email, normalizedPhone);

    if (!user) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        phone: fullPhone,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: { name: "" },
      });

      if (createError) {
        const phoneAlreadyExists = createError.message?.toLowerCase().includes("phone number already registered");
        if (!phoneAlreadyExists) throw createError;

        user = await findAuthUserByPhoneOrEmail(supabaseAdmin, email, normalizedPhone);
        if (!user) throw createError;
      } else {
        user = newUser.user;
      }
    }

    if (!user) {
      throw new Error("تعذر العثور على المستخدم أو إنشاؤه");
    }

    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email,
      password,
      phone: fullPhone,
      email_confirm: true,
      phone_confirm: true,
    });

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
