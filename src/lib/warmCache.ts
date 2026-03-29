import { db } from "./db";
import type { QueryClient } from "@tanstack/react-query";

/**
 * الجداول التي تحتوي family_id مباشرة — تُفلتر في warmCache.
 * الجداول الفرعية (medication_logs, trip_day_plans, album_photos...) لا تُفلتر
 * لأنها لا تملك family_id — فلترتها تتم عبر الجدول الأب.
 */
const FAMILY_SCOPED_TABLES = new Set([
  "task_lists", "market_lists", "calendar_events", "medications",
  "budgets", "debts", "trips", "vehicles", "document_lists",
  "albums", "family_members", "vaccinations", "place_lists",
  "worship_children", "emergency_contacts", "chat_messages",
]);

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
  { table: "vaccinations", queryKeyPrefix: "vaccinations" },
  { table: "place_lists", queryKeyPrefix: "place-lists" },
  { table: "medication_logs", queryKeyPrefix: "medication-logs" },
  { table: "zakat_assets", queryKeyPrefix: "zakat-assets" },
  { table: "will_sections", queryKeyPrefix: "will" },
  { table: "profiles", queryKeyPrefix: "profiles" },
  { table: "worship_children", queryKeyPrefix: "worship-children" },
  { table: "emergency_contacts", queryKeyPrefix: "emergency-contacts" },
] as const;

export async function warmCache(qc: QueryClient, familyId: string | null): Promise<void> {
  if (!familyId) return;

  const warmPromises = TABLES_TO_WARM.map(async ({ table: tableName, queryKeyPrefix }) => {
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
