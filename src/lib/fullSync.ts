import { supabase } from "@/integrations/supabase/client";
import { db } from "./db";
import { FULL_SYNC_STEPS } from "./resourceRegistry";

export interface SyncProgress {
  current: number; // 0-100
  label: string;
}

export async function fullSync(
  familyId: string,
  onProgress: (p: SyncProgress) => void
): Promise<void> {
  const total = FULL_SYNC_STEPS.length;
  let completed = 0;

  onProgress({ current: 0, label: "جاري التجهيز..." });

  await Promise.allSettled(
    FULL_SYNC_STEPS.map(async (step) => {
      try {
        const { data: response } = await supabase.functions.invoke(step.fn, {
          body: { action: step.action, family_id: familyId },
        });

        const items = response?.data || [];
        if (items.length > 0) {
          const table = (db as any)[step.table];
          if (table) await table.bulkPut(items);
        }
      } catch {
        // فشل جدول واحد لا يوقف الباقي
      }

      completed++;
      onProgress({
        current: Math.round((completed / total) * 100),
        label: step.label,
      });
    })
  );

  onProgress({ current: 100, label: "اكتمل" });
  localStorage.setItem("first_sync_done", "1");
  localStorage.setItem("last_sync_ts", new Date().toISOString());
}
