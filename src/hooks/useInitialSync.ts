import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";

export type SyncState = "idle" | "new_user" | "syncing" | "done";

export function useInitialSync() {
  const [state, setState] = useState<SyncState>("idle");
  const qc = useQueryClient();
  const ranRef = useRef(false);

  const run = useCallback(async (userId: string) => {
    if (ranRef.current) return;
    ranRef.current = true;

    try {
      const firstSyncDone = localStorage.getItem("first_sync_done");

      // Check if local IndexedDB has data
      let localCount = 0;
      try {
        localCount = await db.task_lists.count();
      } catch {
        // IndexedDB may not be ready
      }

      if (localCount === 0 && !firstSyncDone) {
        // No local data and never synced — check cloud to determine if new account or new device
        try {
          const { data, error } = await supabase.functions.invoke("account-api", {
            body: { action: "get-last-updated" },
          });

          if (!error && data?.last_updated_at) {
            // Cloud has data — existing account on new device
            setState("new_user");
            await qc.invalidateQueries();
            await qc.refetchQueries({ type: "active" });
            localStorage.setItem("last_sync_ts", new Date().toISOString());
            localStorage.setItem("first_sync_done", "1");
            await new Promise(r => setTimeout(r, 800));
            setState("done");
            return;
          }
        } catch {
          // Network error — assume new account
        }

        // Cloud returned null or error — brand new account
        localStorage.setItem("first_sync_done", "1");
        localStorage.setItem("last_sync_ts", new Date().toISOString());
        setState("done");
        return;
      }

      // Local data exists — compare timestamps
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
      } catch {
        // Network error — skip cloud check
      }

      // Local is up to date or couldn't reach cloud
      localStorage.setItem("first_sync_done", "true");
      setState("done");
    } catch {
      setState("done");
    }
  }, [qc]);

  return { state, run };
}
