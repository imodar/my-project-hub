/**
 * مدير المزامنة — Sync Manager
 *
 * مسؤول عن جلب البيانات من API وتحديث IndexedDB المحلية.
 * يدعم Delta Sync عبر تمرير آخر timestamp مزامنة.
 * يدعم اكتشاف التعارضات عبر isConflicting().
 */
import { db } from "./db";
import type { Table } from "dexie";
import { projectPendingChanges } from "./syncQueue";
import { isConflicting, saveConflict, type RecordWithTimestamp } from "./conflictResolver";
import { reportError } from "./errorReporting";

/* ────────────────────────────────────────────
 *  مزامنة جدول واحد
 * ──────────────────────────────────────────── */

/**
 * تجلب البيانات من API وتُحدّث الجدول المحلي في IndexedDB.
 */
export async function syncTable<T extends { id: string; created_at?: string; updated_at?: string }>(
  tableName: string,
  apiFn: (lastSyncedAt: string | null) => Promise<{ data: T[] | null; error: string | null }>,
  postFilter?: (items: T[]) => T[],
  scopeKey?: string
): Promise<T[]> {
  const table = (db as unknown as Record<string, unknown>)[tableName] as Table | undefined;
  if (!table) {
    console.warn(`[SyncManager] الجدول "${tableName}" غير موجود في Dexie`);
    return [];
  }

  // استخدام metaKey مع scope لعزل sync_meta بين العائلات
  const metaKey = scopeKey ? `${tableName}:${scopeKey}` : tableName;
  const lastSyncedAt = await getLastSyncTime(metaKey);
  const { data, error } = await apiFn(lastSyncedAt);

  if (error || !data) {
    console.warn(`[SyncManager] فشل جلب "${tableName}": ${error} — استخدام البيانات المحلية`);
    const localData = await table.toArray();
    const filtered = postFilter ? postFilter(localData as T[]) : (localData as T[]);
    return projectPendingChanges(tableName, filtered);
  }

  try {
    // Delta sync (since was provided): check for conflicts before upserting
    if (lastSyncedAt && data.length >= 0) {
      if (data.length > 0) {
        const nonConflicting: T[] = [];

        for (const serverRecord of data) {
          const localRecord = await table.get(serverRecord.id) as T | undefined;

          if (localRecord && isConflicting(
            localRecord as unknown as RecordWithTimestamp,
            serverRecord as unknown as RecordWithTimestamp,
            lastSyncedAt
          )) {
            // تعارض — حفظه بدلاً من الكتابة فوقه
            await saveConflict(
              tableName,
              localRecord as unknown as RecordWithTimestamp,
              serverRecord as unknown as RecordWithTimestamp
            );
          } else {
            nonConflicting.push(serverRecord);
          }
        }

        if (nonConflicting.length > 0) {
          await table.bulkPut(nonConflicting);
        }
      }
    } else {
      // Full sync: remove stale records then upsert
      const apiIds = new Set(data.map((item) => item.id));
      const localItems: T[] = await table.toArray();
      const staleIds = localItems
        .filter((item) => !apiIds.has(item.id))
        .map((item) => item.id);
      if (staleIds.length > 0) {
        const deletionRatio = staleIds.length / (localItems.length || 1);
        if (deletionRatio > 0.5 && localItems.length > 10) {
          console.warn(`[SyncManager] تخطي حذف ${staleIds.length} من "${tableName}" — نسبة الحذف مرتفعة (${Math.round(deletionRatio * 100)}%)`);
          reportError(new Error(`SyncManager anomaly: ${tableName} — ${staleIds.length}/${localItems.length} stale`), { source: "syncManager" });
          window.dispatchEvent(new CustomEvent("sync-anomaly-detected", {
            detail: { tableName, staleCount: staleIds.length, localCount: localItems.length }
          }));
        } else {
          await table.bulkDelete(staleIds);
        }
      }
      await table.bulkPut(data);
    }
  } catch (err: unknown) {
    // معالجة خطأ تجاوز حصة التخزين
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      console.error(`[SyncManager] ⚠️ مساحة التخزين ممتلئة أثناء مزامنة "${tableName}"`);
      window.dispatchEvent(new CustomEvent("storage-quota-exceeded", { detail: { table: tableName } }));
    } else {
      throw err;
    }
  }

  // تحديث وقت المزامنة
  await db.sync_meta.put({
    table: metaKey,
    last_synced_at: new Date().toISOString(),
  });

  // After sync, return ALL local data filtered by scope
  const allLocal: T[] = await table.toArray();
  const filtered = postFilter ? postFilter(allLocal) : allLocal;
  const projectedData = await projectPendingChanges(tableName, filtered);
  console.info(
    `[SyncManager] ✅ تمت مزامنة "${tableName}" — API: ${data.length}، محلي: ${filtered.length}${lastSyncedAt ? " (delta)" : " (full)"}`
  );
  return projectedData;
}

/* ────────────────────────────────────────────
 *  مزامنة جميع الجداول
 * ──────────────────────────────────────────── */

type SyncAllMap = Record<
  string,
  (lastSyncedAt: string | null) => Promise<{ data: unknown[] | null; error: string | null }>
>;

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

export async function getLastSyncTime(metaKey: string): Promise<string | null> {
  const meta = await db.sync_meta.get(metaKey);
  return meta?.last_synced_at ?? null;
}
