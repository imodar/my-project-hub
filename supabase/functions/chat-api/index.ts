import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_TEXT = 5000;
const MAX_KEY = 10000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = ["sent", "delivered", "read"];

function validUuid(v: unknown): v is string { return typeof v === "string" && UUID_RE.test(v); }
function validStr(v: unknown, max: number): v is string { return typeof v === "string" && v.trim().length > 0 && v.length <= max; }

async function checkRateLimit(ac: any, userId: string, endpoint: string, maxPerMinute = 60): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60000).toISOString();
  const { data } = await ac.from("rate_limit_counters").select("id, count, window_start").eq("user_id", userId).eq("endpoint", endpoint).maybeSingle();
  if (data) {
    if (data.window_start > windowStart) { if (data.count >= maxPerMinute) return false; await ac.from("rate_limit_counters").update({ count: data.count + 1 }).eq("id", data.id); }
    else { await ac.from("rate_limit_counters").update({ count: 1, window_start: now.toISOString() }).eq("id", data.id); }
  } else { await ac.from("rate_limit_counters").insert({ user_id: userId, endpoint, count: 1, window_start: now.toISOString() }); }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return json({ error: "Unauthorized" }, 401);
    const userId = authUser.id;
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (!await checkRateLimit(adminClient, userId, "chat-api")) return json({ error: "Too many requests" }, 429);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "get-chat-members") {
      const { family_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      const { data: members } = await supabase.from("family_members").select("user_id").eq("family_id", family_id).eq("status", "active");
      if (!members?.length) return json({ data: [] });
      const ids = members.map((m: any) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, name").in("id", ids);
      return json({ data: profs || [] });
    }

    if (action === "get-family-key") {
      const { family_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      const { data } = await supabase.from("family_keys").select("encrypted_key").eq("family_id", family_id).eq("user_id", userId).maybeSingle();
      return json({ data });
    }

    if (action === "get-any-family-key") {
      const { family_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      const { data } = await supabase.from("family_keys").select("encrypted_key").eq("family_id", family_id).limit(1).maybeSingle();
      return json({ data });
    }

    if (action === "upsert-family-key") {
      const { family_id, encrypted_key } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!validStr(encrypted_key, MAX_KEY)) return json({ error: "encrypted_key مطلوب" }, 400);
      const { data, error } = await supabase.from("family_keys").upsert({ family_id, user_id: userId, encrypted_key: encrypted_key.slice(0, MAX_KEY) }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "get-messages") {
      const { family_id, limit: msgLimit, before } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (before && typeof before !== "string") return json({ error: "before غير صالح" }, 400);
      const safeLimit = Math.min(Math.max(Number(msgLimit) || 50, 1), 100);
      let query = supabase.from("chat_messages").select("*, profiles:sender_id(name, avatar_url)").eq("family_id", family_id).order("created_at", { ascending: false }).limit(safeLimit);
      if (before) query = query.lt("created_at", before);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data: data?.reverse(), hasMore: (data?.length ?? 0) === safeLimit });
    }

    if (action === "send-message") {
      const { family_id, encrypted_text, iv, mention_user_id } = body;
      if (!validUuid(family_id)) return json({ error: "family_id غير صالح" }, 400);
      if (!validStr(encrypted_text, MAX_TEXT)) return json({ error: "الرسالة مطلوبة (حد أقصى 5000)" }, 400);
      if (iv && typeof iv !== "string") return json({ error: "iv غير صالح" }, 400);
      if (mention_user_id && !validUuid(mention_user_id)) return json({ error: "mention_user_id غير صالح" }, 400);
      const { data, error } = await supabase.from("chat_messages").insert({ family_id, sender_id: userId, encrypted_text: encrypted_text.slice(0, MAX_TEXT), iv, mention_user_id }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "pin-message") {
      const { id, pinned } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (typeof pinned !== "boolean") return json({ error: "pinned يجب أن يكون true أو false" }, 400);
      const { data, error } = await supabase.from("chat_messages").update({ pinned }).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "react") {
      const { id, reactions } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (reactions && typeof reactions !== "object") return json({ error: "reactions غير صالح" }, 400);
      const { data, error } = await supabase.from("chat_messages").update({ reactions }).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-status") {
      const { id, status } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      if (!ALLOWED_STATUSES.includes(status)) return json({ error: "حالة غير صالحة" }, 400);
      const { data, error } = await supabase.from("chat_messages").update({ status }).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-message") {
      const { id } = body;
      if (!validUuid(id)) return json({ error: "id غير صالح" }, 400);
      const { error } = await supabase.from("chat_messages").delete().eq("id", id).eq("sender_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
