import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { useFamilyId } from "./useFamilyId";

const TABLE_QUERY_KEY_MAP: Record<string, string> = {
  task_items: "task-lists",
  task_lists: "task-lists",
  market_items: "market-lists",
  market_lists: "market-lists",
  calendar_events: "calendar-events",
  budgets: "budgets",
  budget_expenses: "budgets",
  trips: "trips",
  trip_expenses: "trips",
  trip_activities: "trips",
  trip_day_plans: "trips",
  trip_packing: "trips",
  trip_documents: "trips",
  debts: "debts",
  debt_payments: "debts",
  document_items: "document-lists",
  document_lists: "document-lists",
  albums: "albums",
  album_photos: "albums",
  vehicles: "vehicles",
  medications: "medications",
  medication_logs: "medications",
};

// Tables where we should NOT write realtime payloads to IndexedDB
// (e.g. chat needs decryption first)
const SKIP_IDB_WRITE = new Set(["chat_messages"]);

export function useFamilyRealtime() {
  const { familyId } = useFamilyId();
  const qc = useQueryClient();

  useEffect(() => {
    if (!familyId) return;

    const channel = supabase
      .channel(`family-realtime-${familyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", filter: `family_id=eq.${familyId}` },
        async (payload) => {
          const tableName = payload.table;
          const queryKeyPrefix = TABLE_QUERY_KEY_MAP[tableName];

          if (!queryKeyPrefix) return;

          // Update IndexedDB (best-effort, skip chat)
          if (!SKIP_IDB_WRITE.has(tableName)) {
            try {
              const table = (db as any)[tableName];
              if (table) {
                if (payload.eventType === "DELETE" && payload.old) {
                  await table.delete((payload.old as any).id);
                } else if (payload.new && Object.keys(payload.new).length > 0) {
                  await table.put(payload.new);
                }
              }
            } catch {
              // silent
            }
          }

          // Invalidate React Query cache
          qc.invalidateQueries({
            queryKey: [queryKeyPrefix, familyId],
            exact: false,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, qc]);
}
