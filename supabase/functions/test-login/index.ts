import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const PROJECT_ORIGIN_FALLBACKS = [
  "https://7571dddb-1161-4f53-9036-32778235da46.lovableproject.com",
  "https://id-preview--7571dddb-1161-4f53-9036-32778235da46.lovable.app",
  "https://ailti.lovable.app",
  "https://d0479375-ab8c-4895-86c0-45a5df6d51d8.lovableproject.com",
];

const ALLOWED_ORIGINS = Array.from(new Set([
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ...PROJECT_ORIGIN_FALLBACKS,
]));

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

let corsHeaders: Record<string, string> = {};

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");

  if (!digits) return "";
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("0")) return `966${digits.slice(1)}`;
  if (digits.startsWith("5")) return `966${digits}`;

  return digits;
};

const findAuthUserByPhoneOrEmail = async (
  adminClient: any,
  email: string,
  normalizedPhone: string,
) => {
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = (data.users ?? []) as Array<{ id: string; email?: string | null; phone?: string | null }>;
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
  corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();
    const normalizedPhone = normalizePhone(phone);
    const fullPhone = `+${normalizedPhone}`;

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
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
