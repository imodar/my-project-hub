import { db } from "./db";
import type { QueryClient } from "@tanstack/react-query";
import { WARM_TABLES, FAMILY_SCOPED_TABLES } from "./resourceRegistry";

export async function warmCache(qc: QueryClient, familyId: string | null): Promise<void> {
  if (!familyId) return;

  const warmPromises = WARM_TABLES.map(async ({ table: tableName, queryKeyPrefix }) => {
    try {
      const table = (db as any)[tableName];
      if (!table) return;
      // Skip if React Query already has data for this key
      if (qc.getQueryData([queryKeyPrefix, familyId])) return;
      let items = await table.toArray();
      // فلترة الجداول العائلية فقط — الجداول الفرعية تبقى بدون فلترة
      if (FAMILY_SCOPED_TABLES.has(tableName)) {
        items = items.filter((i: any) => i.family_id === familyId);
      }
      qc.setQueryData([queryKeyPrefix, familyId], items);
    } catch {
      // silent fail — warmup is best-effort
    }
  });

  await Promise.all(warmPromises);
  localStorage.setItem("last_sync_ts", new Date().toISOString());
}
