import { supabase } from "@/integrations/supabase/client";
import { db } from "./db";

export interface SyncProgress {
  current: number; // 0-100
  label: string;
}

const SYNC_STEPS = [
  { label: "المهام", action: "get-lists", fn: "tasks-api", table: "task_lists" },
  { label: "السوق", action: "get-lists", fn: "market-api", table: "market_lists" },
  { label: "التقويم", action: "get-events", fn: "calendar-api", table: "calendar_events" },
  { label: "الأدوية", action: "get-medications", fn: "health-api", table: "medications" },
  { label: "الميزانية", action: "get-budgets", fn: "budget-api", table: "budgets" },
  { label: "الديون", action: "get-debts", fn: "debts-api", table: "debts" },
  { label: "الرحلات", action: "get-trips", fn: "trips-api", table: "trips" },
  { label: "الوثائق", action: "get-lists", fn: "documents-api", table: "document_lists" },
  { label: "الأماكن", action: "get-lists", fn: "places-api", table: "place_lists" },
  { label: "الألبومات", action: "get-albums", fn: "albums-api", table: "albums" },
  { label: "المركبات", action: "get-vehicles", fn: "vehicles-api", table: "vehicles" },
  { label: "اللقاحات", action: "get-children", fn: "health-api", table: "vaccinations" },
  { label: "الزكاة", action: "get-assets", fn: "zakat-api", table: "zakat_assets" },
  { label: "الوصية", action: "get-will", fn: "will-api", table: "will_sections" },
  { label: "العبادات", action: "get-children", fn: "worship-api", table: "worship_children" },
];

export async function fullSync(
  familyId: string,
  onProgress: (p: SyncProgress) => void
): Promise<void> {
  const total = SYNC_STEPS.length;
  let completed = 0;

  onProgress({ current: 0, label: "جاري التجهيز..." });

  await Promise.allSettled(
    SYNC_STEPS.map(async (step) => {
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
