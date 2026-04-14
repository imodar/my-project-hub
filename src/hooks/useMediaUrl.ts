import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type SupportedBucket = "chat-media" | "documents" | "album-photos" | "trip-documents";

function getCacheName(bucket: SupportedBucket) {
  return `${bucket}-cache-v1`;
}

/**
 * Extract the storage path from a Supabase signed URL for a given bucket.
 */
function extractStoragePath(url: string, bucket: SupportedBucket): string | null {
  try {
    const u = new URL(url);
    const signMatch = u.pathname.match(
      new RegExp(`/storage/v1/object/sign/${bucket}/(.+)`)
    );
    if (signMatch) return signMatch[1];
    const pubMatch = u.pathname.match(
      new RegExp(`/storage/v1/object/public/${bucket}/(.+)`)
    );
    if (pubMatch) return pubMatch[1];
    return null;
  } catch {
    return null;
  }
}

type MediaState = {
  url: string | null;
  status: "loading" | "ready" | "error";
};

interface UseMediaUrlOptions {
  bucket?: SupportedBucket;
}

export function useMediaUrl(
  originalUrl: string | undefined,
  options?: UseMediaUrlOptions
): MediaState {
  const bucket = options?.bucket ?? "chat-media";
  const objectUrlRef = useRef<string | null>(null);

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
    const cacheName = getCacheName(bucket);

    const setUrl = (blobUrl: string) => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = blobUrl;
      setState({ url: blobUrl, status: "ready" });
    };

    (async () => {
      try {
        // 1. Check Cache API first
        if ("caches" in window) {
          const cache = await caches.open(cacheName);
          const storagePath = extractStoragePath(originalUrl, bucket);
          if (storagePath) {
            const cached = await cache.match(storagePath);
            if (cached) {
              const blob = await cached.blob();
              if (!cancelled) setUrl(URL.createObjectURL(blob));
              return;
            }
          }
        }

        // 2. Try fetching the original URL
        const resp = await fetch(originalUrl, { mode: "cors" });

        if (resp.ok) {
          const blob = await resp.blob();
          if (!cancelled) setUrl(URL.createObjectURL(blob));
          cacheBlob(originalUrl, blob, bucket);
          return;
        }

        // 3. If expired, refresh the signed URL
        if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
          const storagePath = extractStoragePath(originalUrl, bucket);
          if (!storagePath) {
            if (!cancelled) setState({ url: null, status: "error" });
            return;
          }

          const { data: signed, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

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
          if (!cancelled) setUrl(URL.createObjectURL(blob));
          cacheBlob(originalUrl, blob, bucket);
          return;
        }

        if (!cancelled) setState({ url: null, status: "error" });
      } catch (err) {
        console.warn("[useMediaUrl] Error:", err);
        if (!cancelled) setState({ url: null, status: "error" });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [originalUrl, bucket]);

  return state;
}

async function cacheBlob(originalUrl: string, blob: Blob, bucket: SupportedBucket) {
  try {
    if (!("caches" in window)) return;
    const storagePath = extractStoragePath(originalUrl, bucket);
    if (!storagePath) return;
    const cache = await caches.open(getCacheName(bucket));
    await cache.put(storagePath, new Response(blob));
  } catch {
    // Silently fail cache write
  }
}
