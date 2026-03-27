import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map(s => s.trim()).filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

let corsHeaders: Record<string, string> = {};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Called by pg_cron daily at 4:00 AM
Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!authHeader?.includes(serviceKey)) return json({ error: "Unauthorized" }, 401);

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    // Get accounts scheduled for deletion
    const { data: deletions, error } = await adminClient
      .from("account_deletions")
      .select("id, user_id")
      .eq("status", "pending")
      .lte("scheduled_delete_at", new Date().toISOString())
      .limit(50);

    if (error) return json({ error: error.message }, 500);
    if (!deletions?.length) return json({ message: "No accounts to clean", count: 0 });

    let cleaned = 0;
    for (const deletion of deletions) {
      try {
        // Delete user data
        await adminClient.from("profiles").update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", deletion.user_id);

        // Remove from all families
        await adminClient.from("family_members").delete().eq("user_id", deletion.user_id);
        await adminClient.from("family_keys").delete().eq("user_id", deletion.user_id);

        // Delete auth user
        await adminClient.auth.admin.deleteUser(deletion.user_id);

        // Mark completed
        await adminClient
          .from("account_deletions")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", deletion.id);

        cleaned++;
      } catch (e) {
        console.error(`Failed to delete user ${deletion.user_id}:`, e);
      }
    }

    return json({ message: `Cleaned ${cleaned} accounts`, count: cleaned });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
