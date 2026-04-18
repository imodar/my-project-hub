// Shared fast-auth helper for Edge Functions.
//
// Why: supabase.auth.getUser() does a network round-trip to /auth/v1/user
// which observed at 2-5 seconds in production logs. getClaims() verifies the
// JWT locally against the cached JWKS (from /.well-known/jwks.json) — typically
// sub-millisecond after the first call.
//
// Usage:
//   import { verifyAuth } from "../_shared/auth.ts";
//   const auth = await verifyAuth(req);
//   if (!auth.ok) return auth.response;
//   const userId = auth.userId;

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export type AuthResult =
  | { ok: true; userId: string; email: string | null; authHeader: string; client: SupabaseClient }
  | { ok: false; response: Response };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

export async function verifyAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const token = authHeader.replace("Bearer ", "");

  // Build a client scoped to this request's user (for RLS).
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fast local JWT verification via JWKS (cached by SDK).
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  return {
    ok: true,
    userId: data.claims.sub as string,
    email: (data.claims.email as string) ?? null,
    authHeader,
    client,
  };
}

export function getAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
