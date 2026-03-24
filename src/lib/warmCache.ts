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
}
