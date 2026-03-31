import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fullSync, type SyncProgress } from "@/lib/fullSync";
import { db } from "@/lib/db";

export type SyncState = "idle" | "new_user" | "syncing" | "done";

export function useInitialSync() {
  const [state, setState] = useState<SyncState>("idle");
  const [progress, setProgress] = useState<SyncProgress>({ current: 0, label: "" });
  const qc = useQueryClient();
  const ranRef = useRef(false);

  const run = useCallback(async (userId: string, familyId: string) => {
    if (ranRef.current) return;
    ranRef.current = true;

    try {
      // Check if device has local data in Dexie
      const [taskCount, marketCount, budgetCount, memberCount] = await Promise.all([
        db.task_lists.count().catch(() => 0),
        db.market_lists.count().catch(() => 0),
        db.budgets.count().catch(() => 0),
        db.family_members.count().catch(() => 0),
      ]);
      const hasLocalData = (taskCount + marketCount + budgetCount + memberCount) > 0;

      if (hasLocalData) {
        // Device has local data — no blocking sync needed
        // Mark sync done and do background delta sync
        localStorage.setItem("first_sync_done", "1");
        setState("done");

        // Background delta sync if online
        if (navigator.onLine) {
          try {
            const localTs = localStorage.getItem("last_sync_ts");
            const { data, error } = await supabase.functions.invoke("account-api", {
              body: { action: "get-last-updated" },
            });
            if (!error && data?.last_updated_at) {
              const cloudTime = new Date(data.last_updated_at).getTime();
              const localTime = localTs ? new Date(localTs).getTime() : 0;
              if (cloudTime > localTime) {
                await qc.invalidateQueries();
                await qc.refetchQueries({ type: "active" });
                localStorage.setItem("last_sync_ts", new Date().toISOString());
              }
            }
          } catch {}
        }
        return;
      }

      // Device is empty — need to check cloud
      const firstSyncDone = localStorage.getItem("first_sync_done");

      if (!firstSyncDone) {
        if (!navigator.onLine) {
          // Empty device + offline = nothing to do
          setState("done");
          return;
        }

        try {
          const { data, error } = await supabase.functions.invoke("account-api", {
            body: { action: "get-last-updated" },
          });
          if (!error && data?.last_updated_at) {
            setState("new_user");
            await fullSync(familyId, setProgress);
            setState("done");
            return;
          }
        } catch {}

        localStorage.setItem("first_sync_done", "1");
        localStorage.setItem("last_sync_ts", new Date().toISOString());
        setState("done");
        return;
      }

      // first_sync_done exists but Dexie is empty (cleared cache?)
      // Do a delta sync
      if (!navigator.onLine) {
        setState("done");
        return;
      }

      const localTs = localStorage.getItem("last_sync_ts");
      try {
        const { data, error } = await supabase.functions.invoke("account-api", {
          body: { action: "get-last-updated" },
        });
        if (!error && data?.last_updated_at) {
          const cloudTime = new Date(data.last_updated_at).getTime();
          const localTime = localTs ? new Date(localTs).getTime() : 0;
          if (cloudTime > localTime) {
            setState("syncing");
            await qc.invalidateQueries();
            await qc.refetchQueries({ type: "active" });
            localStorage.setItem("last_sync_ts", new Date().toISOString());
            await new Promise(r => setTimeout(r, 600));
            setState("done");
            return;
          }
        }
      } catch {}

      setState("done");
    } catch {
      setState("done");
    }
  }, [qc]);

  return { state, run, progress };
}
