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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // --- MESSAGES ---
    if (action === "get-messages") {
      const { family_id, limit: msgLimit, before } = body;
      let query = supabase
        .from("chat_messages")
        .select("*, profiles:sender_id(name, avatar_url)")
        .eq("family_id", family_id)
        .order("created_at", { ascending: false })
        .limit(msgLimit || 50);
      if (before) query = query.lt("created_at", before);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data: data?.reverse() });
    }

    if (action === "send-message") {
      const { family_id, encrypted_text, iv, mention_user_id } = body;
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({ family_id, sender_id: userId, encrypted_text, iv, mention_user_id })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "pin-message") {
      const { id, pinned } = body;
      const { data, error } = await supabase
        .from("chat_messages")
        .update({ pinned })
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "react") {
      const { id, reactions } = body;
      const { data, error } = await supabase
        .from("chat_messages")
        .update({ reactions })
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update-status") {
      const { id, status } = body;
      const { data, error } = await supabase
        .from("chat_messages")
        .update({ status })
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete-message") {
      const { id } = body;
      const { error } = await supabase.from("chat_messages").delete().eq("id", id).eq("sender_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
