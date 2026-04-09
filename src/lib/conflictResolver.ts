/**
 * نظام حل التعارضات — Conflict Resolver
 *
 * يكتشف التعارضات بين البيانات المحلية وبيانات السيرفر،
 * ويحفظها في جدول conflicts لعرضها للمستخدم.
 *
 * استراتيجية الحل:
 * - "local": الاحتفاظ بتعديل المستخدم وإرساله للسيرفر
 * - "server": قبول بيانات السيرفر وتجاهل التعديل المحلي
 *
 * السجلات التي لها updated_at يُقارن توقيتها تلقائياً.
 * إذا كان الفارق أقل من THRESHOLD_SECONDS يُعامَل كتعارض.
 */
import { db, type ConflictItem } from "./db";

/** الحد الأدنى لاعتبار السجلَين متعارضَين (5 دقائق) */
const THRESHOLD_SECONDS = 5 * 60;

export interface RecordWithTimestamp {
  id: string;
  updated_at?: string;
  [key: string]: unknown;
}

/**
 * يفحص ما إذا كان السجل المحلي والسجل من السيرفر في حالة تعارض.
 *
 * تعارض = كلاهما تم تعديله بعد آخر مزامنة ناجحة.
 */
export function isConflicting(
  localRecord: RecordWithTimestamp,
  serverRecord: RecordWithTimestamp,
  lastSyncedAt: string | null
): boolean {
  if (!lastSyncedAt) return false;
  const syncTime = new Date(lastSyncedAt).getTime();
  const localTime = localRecord.updated_at
    ? new Date(localRecord.updated_at).getTime()
    : 0;
  const serverTime = serverRecord.updated_at
    ? new Date(serverRecord.updated_at).getTime()
    : 0;

  // كلاهما تعدّل بعد آخر مزامنة → تعارض
  const localModified = localTime > syncTime;
  const serverModified = serverTime > syncTime;

  if (!localModified || !serverModified) return false;

  // تجاهل التعارضات إذا كان الفارق أقل من THRESHOLD_SECONDS
  // (ربما نفس الكتابة وصلت مرتين)
  const diffSeconds = Math.abs(localTime - serverTime) / 1000;
  return diffSeconds > THRESHOLD_SECONDS;
}

/**
 * يحفظ تعارضاً في قاعدة البيانات المحلية لعرضه للمستخدم.
 */
export async function saveConflict(
  table: string,
  localData: RecordWithTimestamp,
  serverData: RecordWithTimestamp
): Promise<number> {
  const conflict: ConflictItem = {
    table,
    record_id: localData.id,
    local_data: localData as Record<string, unknown>,
    server_data: serverData as Record<string, unknown>,
    detected_at: new Date().toISOString(),
    resolved: false,
  };
  const id = await db.conflicts.add(conflict);
  console.warn(`[ConflictResolver] ⚠️ تعارض محفوظ — جدول: ${table}, سجل: ${localData.id}`);

  // إرسال حدث لإعلام الـ UI
  window.dispatchEvent(
    new CustomEvent("data-conflict-detected", {
      detail: { table, record_id: localData.id, conflict_id: id },
    })
  );

  return id as number;
}

/**
 * يحل تعارضاً باختيار أي نسخة تُحفظ.
 *
 * @param conflictId - معرّف التعارض في جدول conflicts
 * @param resolution - "local" للاحتفاظ بالتعديل المحلي، "server" لقبول السيرفر
 */
export async function resolveConflict(
  conflictId: number,
  resolution: "local" | "server"
): Promise<void> {
  const conflict = await db.conflicts.get(conflictId);
  if (!conflict) throw new Error(`التعارض ${conflictId} غير موجود`);

  await db.conflicts.update(conflictId, {
    resolved: true,
    resolution,
  });

  if (resolution === "server") {
    // تطبيق بيانات السيرفر محلياً
    const table = (db as Record<string, unknown>)[conflict.table] as { put: (data: unknown) => Promise<unknown> } | undefined;
    if (table) {
      await table.put(conflict.server_data);
      console.info(
        `[ConflictResolver] ✅ تم الحل (server wins) — ${conflict.table}:${conflict.record_id}`
      );
    }
  } else {
    // local wins — لا حاجة لتغيير IndexedDB (البيانات المحلية بالفعل هناك)
    // لكن يجب إرسالها للسيرفر في المحاولة القادمة
    console.info(
      `[ConflictResolver] ✅ تم الحل (local wins) — ${conflict.table}:${conflict.record_id}`
    );
  }
}

/**
 * يُرجع جميع التعارضات غير المحلولة.
 */
export async function getUnresolvedConflicts(): Promise<ConflictItem[]> {
  return db.conflicts.where("resolved").equals(0).sortBy("detected_at");
}

/**
 * يُرجع عدد التعارضات غير المحلولة.
 */
export async function getUnresolvedConflictsCount(): Promise<number> {
  return db.conflicts.where("resolved").equals(0).count();
}
