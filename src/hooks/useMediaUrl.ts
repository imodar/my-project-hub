import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE_NAME = "chat-media-v1";

/**
 * Extract the storage path from a Supabase signed URL.
 * Signed URLs look like:
 *   https://<ref>.supabase.co/storage/v1/object/sign/chat-media/<familyId>/<fileId>.jpg?token=...
 * We want: <familyId>/<fileId>.jpg
 */
function extractStoragePath(url: string): string | null {
  try {
    const u = new URL(url);
    // Pattern: /storage/v1/object/sign/<bucket>/<path...>
    const match = u.pathname.match(/\/storage\/v1\/object\/sign\/chat-media\/(.+)/);
    if (match) return match[1];
    // Also handle /storage/v1/object/public/chat-media/<path>
    const match2 = u.pathname.match(/\/storage\/v1\/object\/public\/chat-media\/(.+)/);
    if (match2) return match2[1];
    return null;
  } catch {
    return null;
  }
}

type MediaState = {
  url: string | null;
  status: "loading" | "ready" | "error";
};

export function useMediaUrl(originalUrl: string | undefined): MediaState {
  const [state, setState] = useState<MediaState>(() => {
    if (!originalUrl) return { url: null, status: "error" };
    return { url: null, status: "loading" };
  });

  useEffect(() => {
    if (!originalUrl) {
      setState({ url: null, status: "error" });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // 1. Check Cache API first
        if ("caches" in window) {
          const cache = await caches.open(CACHE_NAME);
          const storagePath = extractStoragePath(originalUrl);
          if (storagePath) {
            const cached = await cache.match(storagePath);
            if (cached) {
              const blob = await cached.blob();
              if (!cancelled) {
                setState({ url: URL.createObjectURL(blob), status: "ready" });
              }
              return;
            }
          }
        }

        // 2. Try fetching the original URL
        const resp = await fetch(originalUrl, { mode: "cors" });

        if (resp.ok) {
          const blob = await resp.blob();
          if (!cancelled) {
            setState({ url: URL.createObjectURL(blob), status: "ready" });
          }
          // Cache it
          cacheBlob(originalUrl, blob);
          return;
        }

        // 3. If 401/403 (expired), refresh the signed URL
        if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
          const storagePath = extractStoragePath(originalUrl);
          if (!storagePath) {
            if (!cancelled) setState({ url: null, status: "error" });
            return;
          }

          const { data: signed, error } = await supabase.storage
            .from("chat-media")
            .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

          if (error || !signed?.signedUrl) {
            if (!cancelled) setState({ url: null, status: "error" });
            return;
          }

          const resp2 = await fetch(signed.signedUrl, { mode: "cors" });
          if (!resp2.ok) {
            if (!cancelled) setState({ url: null, status: "error" });
            return;
          }

          const blob = await resp2.blob();
          if (!cancelled) {
            setState({ url: URL.createObjectURL(blob), status: "ready" });
          }
          cacheBlob(originalUrl, blob);
          return;
        }

        // Other error
        if (!cancelled) setState({ url: null, status: "error" });
      } catch (err) {
        console.warn("[useMediaUrl] Error:", err);
        if (!cancelled) setState({ url: null, status: "error" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [originalUrl]);

  return state;
}

async function cacheBlob(originalUrl: string, blob: Blob) {
  try {
    if (!("caches" in window)) return;
    const storagePath = extractStoragePath(originalUrl);
    if (!storagePath) return;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(storagePath, new Response(blob));
  } catch {
    // Silently fail cache write
  }
}
