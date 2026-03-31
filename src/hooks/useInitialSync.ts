import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fullSync, type SyncProgress } from "@/lib/fullSync";
import { getMeaningfulLocalDataState } from "@/lib/meaningfulLocalData";

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
      // Bootstrap rows (profile/family/member) لا تُعتبر بيانات فعلية للجهاز
      const { hasMeaningfulLocalData } = await getMeaningfulLocalDataState();

      if (hasMeaningfulLocalData) {
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

      // Device is empty — force a blocking full sync.
      // الاعتماد على فحص سحابي هنا يسبب race بعد OTP وقد يجعل الجهاز الجديد
      // يُعلَّم خطأً كمكتمل قبل تنزيل أي بيانات فعلية.
      const firstSyncDone = localStorage.getItem("first_sync_done");

      if (!firstSyncDone) {
        if (!navigator.onLine) {
          // Empty device + offline = nothing to do
          setState("done");
          return;
        }

        setState("new_user");
        await fullSync(familyId, setProgress);
        setState("done");
        return;
      }

      // first_sync_done exists but Dexie has no meaningful data.
      // هذا يعني Cache مفرغة/ناقصة، لذلك delta sync لا يكفي لإعادة بناء الجهاز.
      if (!navigator.onLine) {
        setState("done");
        return;
      }

      setState("new_user");
      await fullSync(familyId, setProgress);
      setState("done");
    } catch {
      setState("done");
    }
  }, [qc]);

  return { state, run, progress };
}
