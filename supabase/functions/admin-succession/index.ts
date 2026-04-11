import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Called by pg_cron weekly on Sundays at 6:00 AM
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!authHeader?.includes(serviceKey)) return json({ error: "Unauthorized" }, 401);

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Find families where ALL admins have been inactive 90+ days
    const { data: families } = await adminClient
      .from("families")
      .select("id, family_members(user_id, is_admin, role, profiles:user_id(last_login_at))");

    if (!families?.length) return json({ message: "No families to check", count: 0 });

    let transferred = 0;

    for (const family of families) {
      const members = (family as any).family_members || [];
      const admins = members.filter((m: any) => m.is_admin);
      const nonAdminAdults = members.filter((m: any) =>
        !m.is_admin && !["worker", "maid", "driver"].includes(m.role)
      );

      if (!admins.length) continue;

      // Check if all admins are inactive
      const allInactive = admins.every((a: any) => {
        const lastLogin = a.profiles?.last_login_at;
        return !lastLogin || lastLogin < ninetyDaysAgo;
      });

      if (!allInactive) continue;

      // Find co-admin or most active adult
      if (nonAdminAdults.length > 0) {
        // Sort by last login descending
        nonAdminAdults.sort((a: any, b: any) => {
          const aLogin = a.profiles?.last_login_at || "";
          const bLogin = b.profiles?.last_login_at || "";
          return bLogin.localeCompare(aLogin);
        });

        const newAdmin = nonAdminAdults[0];
        await adminClient
          .from("family_members")
          .update({ is_admin: true })
          .eq("family_id", family.id)
          .eq("user_id", newAdmin.user_id);

        transferred++;
      }
    }

    return json({ message: `Transferred admin in ${transferred} families`, count: transferred });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
