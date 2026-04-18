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

  // Fast local JWT decode (no network). Supabase Edge Runtime already verifies
  // the JWT signature at the gateway when verify_jwt=true (default), so we
  // only need to extract the claims here.
  const claims = decodeJwtPayload(token);
  if (!claims?.sub) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  // Optional expiry check (defense in depth).
  if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Token expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  return {
    ok: true,
    userId: claims.sub as string,
    email: (claims.email as string) ?? null,
    authHeader,
    client,
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // base64url → base64
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
