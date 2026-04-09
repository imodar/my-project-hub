/**
 * مدير المزامنة — Sync Manager
 *
 * مسؤول عن جلب البيانات من API وتحديث IndexedDB المحلية.
 * يدعم Delta Sync عبر تمرير آخر timestamp مزامنة.
 */
import { db } from "./db";
import type { Table } from "dexie";
import { projectPendingChanges } from "./syncQueue";
import { isConflicting, saveConflict, type RecordWithTimestamp } from "./conflictResolver";

/* ────────────────────────────────────────────
 *  مزامنة جدول واحد
 * ──────────────────────────────────────────── */

/**
 * تجلب البيانات من API وتُحدّث الجدول المحلي في IndexedDB.
 *
 * @param tableName - اسم الجدول في Dexie
 * @param apiFn - دالة تجلب البيانات من الـ API (تستقبل اختيارياً lastSyncedAt)
 * @param postFilter - فلتر اختياري يُطبّق على البيانات المحلية بعد المزامنة (مثل فلترة family_id)
 * @param scopeKey - مفتاح نطاق اختياري (مثل familyId) لعزل sync_meta بين العائلات
 * @returns البيانات المُحدّثة بعد إسقاط العمليات المحلية غير المتزامنة فوقها
 */
export async function syncTable<T extends { id: string; created_at?: string }>(
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

  // Delta sync (since was provided): only upsert new/updated records, don't delete old ones
  // Full sync (no since): replace all — remove stale local records not in API response
  if (lastSyncedAt && data.length >= 0) {
    // Delta: فحص التعارضات قبل الكتابة
    if (data.length > 0) {
      const toWrite: T[] = [];
      for (const serverRecord of data as RecordWithTimestamp[]) {
        const localRecord = (await table.get(serverRecord.id)) as RecordWithTimestamp | undefined;
        if (localRecord && isConflicting(localRecord, serverRecord, lastSyncedAt)) {
          // حفظ التعارض وتخطي الكتابة — يبقى الـ local كما هو حتى يختار المستخدم
          await saveConflict(tableName, localRecord, serverRecord);
        } else {
          toWrite.push(serverRecord as T);
        }
      }
      if (toWrite.length > 0) await table.bulkPut(toWrite);
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

  // تحديث وقت المزامنة — بالمفتاح المُقيّد بالنطاق
  await db.sync_meta.put({
    table: metaKey,
    last_synced_at: new Date().toISOString(),
  });

  // After sync, return ALL local data filtered by scope
  const allLocal: T[] = await table.toArray();
  const filtered = postFilter ? postFilter(allLocal) : allLocal;
  // projectPendingChanges يستخدم tableName الأصلي (بدون scope)
  const projectedData = await projectPendingChanges(tableName, filtered);
  console.info(
    `[SyncManager] ✅ تمت مزامنة "${tableName}" — API: ${data.length}، محلي: ${filtered.length}${lastSyncedAt ? " (delta)" : " (full)"}`
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
 * @param metaKey - مفتاح الجدول (قد يتضمن scopeKey مثل "medications:abc123")
 * @returns ISO string أو null إذا لم يُزامن من قبل
 */
export async function getLastSyncTime(metaKey: string): Promise<string | null> {
  const meta = await db.sync_meta.get(metaKey);
  return meta?.last_synced_at ?? null;
}
