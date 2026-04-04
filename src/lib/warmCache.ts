import { db } from "./db";
import type { QueryClient } from "@tanstack/react-query";
import { WARM_TABLES_CRITICAL, WARM_TABLES_DEFERRED, FAMILY_SCOPED_TABLES } from "./resourceRegistry";

type WarmEntry = { table: string; queryKeyPrefix: string };

async function warmEntries(qc: QueryClient, familyId: string, entries: WarmEntry[]): Promise<void> {
  const promises = entries.map(async ({ table: tableName, queryKeyPrefix }) => {
    try {
      const table = (db as any)[tableName];
      if (!table) return;
      if (qc.getQueryData([queryKeyPrefix, familyId])) return;
      let items = await table.toArray();
      if (FAMILY_SCOPED_TABLES.has(tableName)) {
        items = items.filter((i: any) => i.family_id === familyId);
      }
      qc.setQueryData([queryKeyPrefix, familyId], items);
    } catch {
      // silent fail — warmup is best-effort
    }
  });
  await Promise.all(promises);
}

/**
 * المرحلة 1: تسخين الجداول الحرجة فقط (family_members, profiles, calendar_events)
 * تحجب العرض حتى تنتهي
 */
export async function warmCacheCritical(qc: QueryClient, familyId: string | null): Promise<void> {
  if (!familyId) return;
  await warmEntries(qc, familyId, WARM_TABLES_CRITICAL);
}

/**
 * المرحلة 2: تسخين باقي الجداول في الخلفية بدون حجب العرض
 */
export async function warmCacheDeferred(qc: QueryClient, familyId: string | null): Promise<void> {
  if (!familyId) return;
  await warmEntries(qc, familyId, WARM_TABLES_DEFERRED);
  localStorage.setItem("last_sync_ts", new Date().toISOString());
}

/**
 * تسخين الكل (للتوافق مع الكود القديم)
 */
export async function warmCache(qc: QueryClient, familyId: string | null): Promise<void> {
  if (!familyId) return;
  await warmEntries(qc, familyId, WARM_TABLES_CRITICAL);
  await warmEntries(qc, familyId, WARM_TABLES_DEFERRED);
  localStorage.setItem("last_sync_ts", new Date().toISOString());
}
