/**
 * مدير المزامنة — Sync Manager
 *
 * مسؤول عن جلب البيانات من API وتحديث IndexedDB المحلية.
 * يدعم Delta Sync عبر تمرير آخر timestamp مزامنة.
 */
import { db } from "./db";
import type { Table } from "dexie";
import { projectPendingChanges } from "./syncQueue";

/* ────────────────────────────────────────────
 *  مزامنة جدول واحد
 * ──────────────────────────────────────────── */

/**
 * تجلب البيانات من API وتُحدّث الجدول المحلي في IndexedDB.
 *
 * @param tableName - اسم الجدول في Dexie
 * @param apiFn - دالة تجلب البيانات من الـ API (تستقبل اختيارياً lastSyncedAt)
 * @returns البيانات المُحدّثة بعد إسقاط العمليات المحلية غير المتزامنة فوقها
 *
 * @example
 * await syncTable("medications", (lastSynced) =>
 *   api.get("health-api", { action: "list", since: lastSynced })
 * );
 */
export async function syncTable<T extends { id: string; created_at?: string }>(
  tableName: string,
  apiFn: (lastSyncedAt: string | null) => Promise<{ data: T[] | null; error: string | null }>
): Promise<T[]> {
  const table = (db as unknown as Record<string, unknown>)[tableName] as Table | undefined;
  if (!table) {
    console.warn(`[SyncManager] الجدول "${tableName}" غير موجود في Dexie`);
    return [];
  }

  const lastSyncedAt = await getLastSyncTime(tableName);
  const { data, error } = await apiFn(lastSyncedAt);

  if (error || !data) {
    console.warn(`[SyncManager] فشل جلب "${tableName}": ${error} — استخدام البيانات المحلية`);
    const localData = await table.toArray();
    return projectPendingChanges(tableName, localData as T[]);
  }

  // Delta sync (since was provided): only upsert new/updated records, don't delete old ones
  // Full sync (no since): replace all — remove stale local records not in API response
  if (lastSyncedAt && data.length >= 0) {
    // Delta: just upsert returned records
    if (data.length > 0) {
      await table.bulkPut(data);
    }
  } else {
    // Full sync: remove stale records then upsert
    const apiIds = new Set(data.map((item) => item.id));
    const localItems: T[] = await table.toArray();
    const staleIds = localItems
      .filter((item) => !apiIds.has(item.id))
      .map((item) => item.id);
    if (staleIds.length > 0) {
      await table.bulkDelete(staleIds);
    }
    await table.bulkPut(data);
  }

  // تحديث وقت المزامنة
  await db.sync_meta.put({
    table: tableName,
    last_synced_at: new Date().toISOString(),
  });

  const projectedData = await projectPendingChanges(tableName, data);
  console.info(
    `[SyncManager] ✅ تمت مزامنة "${tableName}" — API: ${data.length}، حُذف ${staleIds.length} سجل قديم`
  );
  return projectedData;
}

/* ────────────────────────────────────────────
 *  مزامنة جميع الجداول
 * ──────────────────────────────────────────── */

/** خريطة الجداول مع دوال الجلب — تُملأ عند ربط الشاشات */
type SyncAllMap = Record<
  string,
  (lastSyncedAt: string | null) => Promise<{ data: unknown[] | null; error: string | null }>
>;

/**
 * تُزامن جميع الجداول المُسجّلة دفعة واحدة.
 *
 * @param tableMap - خريطة اسم_الجدول → دالة_الجلب
 *
 * @example
 * await syncAll({
 *   medications: (since) => api.get("health-api", { action: "list", since }),
 *   task_lists: (since) => api.get("tasks-api", { action: "list", since }),
 * });
 */
export async function syncAll(tableMap: SyncAllMap): Promise<void> {
  const entries = Object.entries(tableMap);
  console.info(`[SyncManager] بدء مزامنة شاملة — ${entries.length} جدول...`);

  const results = await Promise.allSettled(
    entries.map(([name, fn]) => syncTable(name, fn as never))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.info(`[SyncManager] اكتملت المزامنة الشاملة — ✅ ${succeeded} نجح، ❌ ${failed} فشل`);
}

/* ────────────────────────────────────────────
 *  قراءة آخر وقت مزامنة
 * ──────────────────────────────────────────── */

/**
 * تُرجع آخر وقت مزامنة ناجحة لجدول معيّن.
 *
 * @param tableName - اسم الجدول
 * @returns ISO string أو null إذا لم يُزامن من قبل
 */
export async function getLastSyncTime(tableName: string): Promise<string | null> {
  const meta = await db.sync_meta.get(tableName);
  return meta?.last_synced_at ?? null;
}
