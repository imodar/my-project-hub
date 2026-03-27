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

// Called by pg_cron daily at 3:00 AM
Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!authHeader?.includes(serviceKey)) return json({ error: "Unauthorized" }, 401);

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    // Get items past their permanent delete date
    const { data: items, error } = await adminClient
      .from("trash_items")
      .select("id, type, original_data")
      .eq("restored", false)
      .lte("permanent_delete_at", new Date().toISOString())
      .limit(500);

    if (error) return json({ error: error.message }, 500);
    if (!items?.length) return json({ message: "No items to clean", count: 0 });

    // Delete associated storage files if applicable
    for (const item of items) {
      const data = item.original_data as Record<string, unknown> | null;
      if (data?.file_url && typeof data.file_url === "string") {
        const bucket = data.file_url.includes("/album-photos/") ? "album-photos"
          : data.file_url.includes("/documents/") ? "documents"
          : data.file_url.includes("/trip-documents/") ? "trip-documents"
          : null;
        if (bucket) {
          const path = data.file_url.split(`/${bucket}/`)[1];
          if (path) await adminClient.storage.from(bucket).remove([path]);
        }
      }
    }

    // Hard delete
    const ids = items.map((i: { id: string }) => i.id);
    await adminClient.from("trash_items").delete().in("id", ids);

    return json({ message: `Cleaned ${ids.length} trash items`, count: ids.length });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
