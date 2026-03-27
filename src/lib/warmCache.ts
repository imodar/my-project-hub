import { db } from "./db";
import type { QueryClient } from "@tanstack/react-query";

const TABLES_TO_WARM = [
  { table: "task_lists", queryKeyPrefix: "task-lists" },
  { table: "market_lists", queryKeyPrefix: "market-lists" },
  { table: "calendar_events", queryKeyPrefix: "calendar-events" },
  { table: "medications", queryKeyPrefix: "medications" },
  { table: "budgets", queryKeyPrefix: "budgets" },
  { table: "debts", queryKeyPrefix: "debts" },
  { table: "chat_messages", queryKeyPrefix: "chat-messages" },
  { table: "trips", queryKeyPrefix: "trips" },
  { table: "trip_day_plans", queryKeyPrefix: "trips" },
  { table: "trip_activities", queryKeyPrefix: "trips" },
  { table: "trip_expenses", queryKeyPrefix: "trips" },
  { table: "trip_packing", queryKeyPrefix: "trips" },
  { table: "vehicles", queryKeyPrefix: "vehicles" },
  { table: "document_lists", queryKeyPrefix: "document-lists" },
  { table: "document_items", queryKeyPrefix: "document-lists" },
  { table: "albums", queryKeyPrefix: "albums" },
  { table: "album_photos", queryKeyPrefix: "albums" },
  { table: "family_members", queryKeyPrefix: "family-members-list" },
  { table: "trip_suggestions", queryKeyPrefix: "trips" },
] as const;

export async function warmCache(qc: QueryClient, familyId: string | null): Promise<void> {
  if (!familyId) return;

  const warmPromises = TABLES_TO_WARM.map(async ({ table: tableName, queryKeyPrefix }) => {
    try {
      const table = (db as any)[tableName];
      if (!table) return;
      // Skip if React Query already has data for this key
      if (qc.getQueryData([queryKeyPrefix, familyId])) return;
      const items = await table.toArray();
      if (items.length > 0) {
        qc.setQueryData([queryKeyPrefix, familyId], items);
      }
    } catch {
      // silent fail — warmup is best-effort
    }
  });

  await Promise.all(warmPromises);
  localStorage.setItem("last_sync_ts", new Date().toISOString());
}
