import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useFamilyId } from "./useFamilyId";
import { REALTIME_QUERY_KEYS } from "@/lib/resourceRegistry";

/**
 * Smart refetch: replaces the old global Realtime channel.
 *
 * Old approach: one Supabase Realtime channel per user → 100k users = 100k channels.
 * New approach: refetch stale queries when the tab becomes visible again,
 * plus a lightweight periodic poll every 5 minutes while visible.
 *
 * Chat & notifications already have their own targeted Realtime subscriptions
 * (useChat.ts, useNotifications.ts) — those stay as-is.
 *
 * Query keys are derived from RESOURCE_REGISTRY — single source of truth.
 */

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useFamilyRealtime() {
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const lastRefetchRef = useRef(0);

  useEffect(() => {
    if (!familyId) return;

    const invalidateAll = () => {
      // Throttle: don't refetch more than once per 30 seconds
      const now = Date.now();
      if (now - lastRefetchRef.current < 30_000) return;
      lastRefetchRef.current = now;

      for (const key of REALTIME_QUERY_KEYS) {
        qc.invalidateQueries({
          queryKey: [key, familyId],
          exact: false,
          refetchType: "active", // only refetch queries that are currently mounted
        });
      }
    };

    // Refetch when user returns to the tab
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        invalidateAll();
      }
    };

    // Refetch when coming back online (with jitter to prevent thundering herd)
    const onOnline = () => {
      const jitter = Math.random() * 60_000; // 0-60s random delay
      setTimeout(() => invalidateAll(), jitter);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    // Periodic poll while visible (with jitter to prevent thundering herd)
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        setTimeout(() => invalidateAll(), Math.random() * 30_000);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
  }, [familyId, qc]);
}
