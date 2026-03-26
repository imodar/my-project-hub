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

async function checkRateLimit(
  ac: any, userId: string, endpoint: string, maxPerMinute = 60
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60000).toISOString();
  const { data } = await ac.from("rate_limit_counters").select("id, count, window_start").eq("user_id", userId).eq("endpoint", endpoint).maybeSingle();
  if (data) {
    if (data.window_start > windowStart) {
      if (data.count >= maxPerMinute) return false;
      await ac.from("rate_limit_counters").update({ count: data.count + 1 }).eq("id", data.id);
    } else {
      await ac.from("rate_limit_counters").update({ count: 1, window_start: now.toISOString() }).eq("id", data.id);
    }
  } else {
    await ac.from("rate_limit_counters").insert({ user_id: userId, endpoint, count: 1, window_start: now.toISOString() });
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  // Validate user via service role client (bypasses JWT algorithm issues)
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const _rl = await checkRateLimit(adminClient, user.id, "location-api", 120);
  if (!_rl) return json({ error: "Too many requests" }, 429);
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // ─── UPDATE MY LOCATION ───
    if (action === "update" && req.method === "POST") {
      const { lat, lng, accuracy, familyId, isSharing } = await req.json();
      if (!lat || !lng || !familyId) return json({ error: "Missing fields" }, 400);

      const { data: member } = await adminClient
        .from("family_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("family_id", familyId)
        .eq("status", "active")
        .maybeSingle();
      if (!member) return json({ error: "Not a family member" }, 403);

      const { error } = await adminClient
        .from("member_locations")
        .upsert(
          {
            user_id: user.id,
            family_id: familyId,
            lat,
            lng,
            accuracy: accuracy || null,
            updated_at: new Date().toISOString(),
            is_sharing: isSharing !== false,
          },
          { onConflict: "user_id,family_id", ignoreDuplicates: false }
        );
      if (error) {
        console.error("Upsert error:", error.message);
        throw error;
      }

      return json({ ok: true });
    }

    // ─── GET FAMILY LOCATIONS ───
    if (action === "list") {
      const familyId = url.searchParams.get("familyId");
      if (!familyId) return json({ error: "Missing familyId" }, 400);

      const { data: member } = await adminClient
        .from("family_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("family_id", familyId)
        .eq("status", "active")
        .maybeSingle();
      if (!member) return json({ error: "Not a family member" }, 403);

      const { data: locations, error } = await adminClient
        .from("member_locations")
        .select("user_id, lat, lng, accuracy, updated_at, is_sharing")
        .eq("family_id", familyId);
      if (error) throw error;

      const userIds = (locations || []).map((l: any) => l.user_id);
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: p } = await adminClient
          .from("profiles")
          .select("id, name, avatar_url")
          .in("id", userIds);
        profiles = p || [];
      }

      const { data: members } = await adminClient
        .from("family_members")
        .select("user_id, role")
        .eq("family_id", familyId)
        .eq("status", "active")
        .in("user_id", userIds);

      const result = (locations || []).map((loc: any) => {
        const profile = profiles.find((p: any) => p.id === loc.user_id);
        const memberInfo = (members || []).find((m: any) => m.user_id === loc.user_id);
        return {
          ...loc,
          name: profile?.name || "عضو",
          avatar_url: profile?.avatar_url,
          role: memberInfo?.role || "member",
          isMe: loc.user_id === user.id,
        };
      });

      return json(result);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message || "Server error" }, 500);
  }
});
