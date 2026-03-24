/**
 * طابور المزامنة — Sync Queue
 *
 * يحفظ العمليات (INSERT / UPDATE / DELETE) التي تمّت أثناء انقطاع الإنترنت
 * ويُعيد إرسالها تلقائياً عند عودة الاتصال بالترتيب (FIFO).
 *
 * ملاحظة: TABLE_API_MAP هو placeholder فارغ حالياً —
 * سيتم ربطه لاحقاً عند بناء Edge Functions المخصصة.
 */
import { db, type SyncOperation, type SyncQueueItem } from "./db";
import { apiClient } from "./api";

/* ────────────────────────────────────────────
 *  خريطة الجداول → Edge Functions (placeholder)
 * ──────────────────────────────────────────── */

interface TableApiMapping {
  /** اسم Edge Function */
  functionName: string;
  /** ربط كل عملية بالـ action المناسب في body */
  actions: Partial<Record<SyncOperation, string>>;
}

/**
 * خريطة ربط أسماء الجداول بالـ Edge Functions.
 * حالياً فارغة — يتم تعبئتها عند بناء الـ API endpoints.
 *
 * @example
 * // عند الربط لاحقاً:
 * TABLE_API_MAP["medications"] = {
 *   functionName: "health-api",
 *   actions: { INSERT: "add_medication", UPDATE: "update_medication", DELETE: "delete_medication" }
 * };
 */
export const TABLE_API_MAP: Record<string, TableApiMapping> = {
  // ── Tasks ──
  task_items: {
    functionName: "tasks-api",
    actions: { INSERT: "add-item", UPDATE: "update-item", DELETE: "delete-item" },
  },
  task_lists: {
    functionName: "tasks-api",
    actions: { INSERT: "create-list", DELETE: "delete-list" },
  },

  // ── Market ──
  market_items: {
    functionName: "market-api",
    actions: { INSERT: "add-item", UPDATE: "update-item", DELETE: "delete-item" },
  },
  market_lists: {
    functionName: "market-api",
    actions: { INSERT: "create-list", DELETE: "delete-list" },
  },

  // ── Calendar ──
  calendar_events: {
    functionName: "calendar-api",
    actions: { INSERT: "add-event", UPDATE: "update-event", DELETE: "delete-event" },
  },

  // ── Budget ──
  budgets: {
    functionName: "budget-api",
    actions: { INSERT: "create-budget", UPDATE: "update-budget", DELETE: "delete-budget" },
  },
  budget_expenses: {
    functionName: "budget-api",
    actions: { INSERT: "add-expense", UPDATE: "update-expense", DELETE: "delete-expense" },
  },

  // ── Debts ──
  debts: {
    functionName: "debts-api",
    actions: { INSERT: "create-debt", UPDATE: "update-debt", DELETE: "delete-debt" },
  },
  debt_payments: {
    functionName: "debts-api",
    actions: { INSERT: "add-payment" },
  },

  // ── Trips ──
  trips: {
    functionName: "trips-api",
    actions: { INSERT: "create-trip", UPDATE: "update-trip", DELETE: "delete-trip" },
  },
  trip_day_plans: {
    functionName: "trips-api",
    actions: { INSERT: "add-day-plan" },
  },
  trip_activities: {
    functionName: "trips-api",
    actions: { INSERT: "add-activity", UPDATE: "toggle-activity" },
  },
  trip_expenses: {
    functionName: "trips-api",
    actions: { INSERT: "add-expense", DELETE: "delete-expense" },
  },
  trip_packing: {
    functionName: "trips-api",
    actions: { INSERT: "add-packing", UPDATE: "toggle-packing" },
  },

  // ── Documents ──
  document_lists: {
    functionName: "documents-api",
    actions: { INSERT: "create-list", DELETE: "delete-list" },
  },
  document_items: {
    functionName: "documents-api",
    actions: { INSERT: "add-item", UPDATE: "update-item", DELETE: "delete-item" },
  },

  // ── Medications ──
  medications: {
    functionName: "health-api",
    actions: { INSERT: "create-medication", UPDATE: "update-medication", DELETE: "delete-medication" },
  },
  medication_logs: {
    functionName: "health-api",
    actions: { INSERT: "log-medication" },
  },

  // ── Vehicles ──
  vehicles: {
    functionName: "vehicles-api",
    actions: { INSERT: "add-vehicle", UPDATE: "update-vehicle", DELETE: "delete-vehicle" },
  },
  vehicle_maintenance: {
    functionName: "vehicles-api",
    actions: { INSERT: "add-maintenance", UPDATE: "update-maintenance", DELETE: "delete-maintenance" },
  },

  // ── Zakat ──
  zakat_assets: {
    functionName: "zakat-api",
    actions: { INSERT: "create-asset", UPDATE: "update-asset", DELETE: "delete-asset" },
  },

  // ── Albums ──
  albums: {
    functionName: "albums-api",
    actions: { INSERT: "create-album", DELETE: "delete-album" },
  },
  album_photos: {
    functionName: "albums-api",
    actions: { INSERT: "add-photo", DELETE: "delete-photo" },
  },

  // ── Chat ──
  chat_messages: {
    functionName: "chat-api",
    actions: { INSERT: "send-message", UPDATE: "pin-message" },
  },
};

/* ────────────────────────────────────────────
 *  الحد الأقصى لمحاولات إعادة الإرسال
 * ──────────────────────────────────────────── */
const MAX_RETRIES = 3;

/* ────────────────────────────────────────────
 *  حالة المعالجة (لمنع التشغيل المتزامن)
 * ──────────────────────────────────────────── */
let isProcessing = false;
const _warnedUnmapped = new Set<string>();

/**
 * تطبّق العمليات غير المتزامنة من sync_queue فوق البيانات الأساسية،
 * بحيث تبقى العناصر المضافة أو المعدّلة أوفلاين ظاهرة حتى لو رجعت
 * الشاشة تقرأ من السيرفر أو من جدول محلي ناقص.
 *
 * @param table - اسم الجدول المستهدف
 * @param baseItems - البيانات الأساسية القادمة من Dexie أو API بعد حفظها محلياً
 * @returns البيانات بعد إسقاط عمليات INSERT / UPDATE / DELETE المعلقة أو الفاشلة
 */
export async function projectPendingChanges<T extends { id?: string; created_at?: string }>(
  table: string,
  baseItems: T[]
): Promise<T[]> {
  const queueItems = await db.sync_queue
    .where("table")
    .equals(table)
    .filter((item) => item.status === "pending" || item.status === "failed")
    .sortBy("created_at");

  const itemsMap = new Map<string, T>();

  for (const item of baseItems) {
    if (item.id) {
      itemsMap.set(item.id, item);
    }
  }

  for (const queuedItem of queueItems) {
    const payload = queuedItem.data as T;
    const id = payload?.id;

    if (!id) continue;

    switch (queuedItem.operation) {
      case "INSERT":
        itemsMap.set(id, {
          ...itemsMap.get(id),
          ...payload,
        } as T);
        break;
      case "UPDATE":
        itemsMap.set(id, {
          ...(itemsMap.get(id) ?? ({} as T)),
          ...payload,
        });
        break;
      case "DELETE":
        itemsMap.delete(id);
        break;
    }
  }

  return Array.from(itemsMap.values()).sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) : Number.NaN;
    const bTime = b.created_at ? Date.parse(b.created_at) : Number.NaN;

    if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
    return bTime - aTime;
  });
}

/* ────────────────────────────────────────────
 *  إضافة عملية جديدة للطابور
 * ──────────────────────────────────────────── */

/**
 * تُضيف عملية جديدة لطابور المزامنة.
 * تُستخدم عند عدم توفر اتصال أو فشل إرسال العملية للـ API.
 *
 * @param table - اسم الجدول المستهدف
 * @param operation - نوع العملية (INSERT / UPDATE / DELETE)
 * @param data - البيانات المرتبطة بالعملية
 * @returns معرّف العملية في الطابور
 */
export async function addToQueue(
  table: string,
  operation: SyncOperation,
  data: Record<string, unknown>
): Promise<number> {
  const item: SyncQueueItem = {
    table,
    operation,
    data,
    created_at: new Date().toISOString(),
    status: "pending",
    retries: 0,
  };

  const id = await db.sync_queue.add(item);
  console.info(`[SyncQueue] أُضيفت عملية ${operation} على ${table} (id: ${id})`);

  if (navigator.onLine) {
    processQueue();
  }

  return id as number;
}

/* ────────────────────────────────────────────
 *  معالجة الطابور
 * ──────────────────────────────────────────── */

/**
 * تُعالج جميع العمليات المعلقة في الطابور بالترتيب (FIFO).
 * - إذا الجدول غير موجود في TABLE_API_MAP: يبقى pending بدون خطأ
 * - Retry حتى 3 مرات، بعدها status = 'failed'
 * - لا تعمل أثناء انقطاع الاتصال
 */
export async function processQueue(): Promise<void> {
  if (isProcessing || !navigator.onLine) return;
  isProcessing = true;

  try {
    const pendingItems = await db.sync_queue
      .where("status")
      .equals("pending")
      .sortBy("created_at");

    if (pendingItems.length === 0) {
      isProcessing = false;
      return;
    }

    console.info(`[SyncQueue] بدء معالجة ${pendingItems.length} عملية معلقة...`);

    for (const item of pendingItems) {
      if (!navigator.onLine) break;

      const mapping = TABLE_API_MAP[item.table];

      if (!mapping) {
        // تسجيل تحذير مرة واحدة فقط لكل جدول غير مربوط
        if (!_warnedUnmapped.has(item.table)) {
          _warnedUnmapped.add(item.table);
          console.warn(`[SyncQueue] الجدول "${item.table}" غير مربوط بـ API — يبقى pending`);
        }
        continue;
      }

      const action = mapping.actions[item.operation];
      if (!action) {
        console.warn(`[SyncQueue] لا يوجد action لـ ${item.operation} على ${item.table}`);
        continue;
      }

      try {
        const { error } = await apiClient(mapping.functionName, {
          method: "POST",
          body: { action, ...item.data },
        });

        if (error) throw new Error(error);

        await db.sync_queue.update(item.id!, { status: "synced" as const });
        console.info(`[SyncQueue] ✅ تمت مزامنة ${item.operation} على ${item.table}`);
      } catch (err) {
        const newRetries = (item.retries || 0) + 1;
        const newStatus = newRetries >= MAX_RETRIES ? "failed" : "pending";

        await db.sync_queue.update(item.id!, {
          retries: newRetries,
          status: newStatus as "pending" | "failed",
        });

        console.warn(
          `[SyncQueue] ❌ فشل ${item.operation} على ${item.table} (محاولة ${newRetries}/${MAX_RETRIES})`,
          err
        );
      }
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await db.sync_queue
      .where("status")
      .equals("synced")
      .filter((item) => item.created_at < oneDayAgo)
      .delete();
  } finally {
    isProcessing = false;
  }
}

/* ────────────────────────────────────────────
 *  عدد العمليات المعلقة
 * ──────────────────────────────────────────── */

/**
 * تُرجع عدد العمليات المعلقة في الطابور.
 */
export async function getPendingCount(): Promise<number> {
  return db.sync_queue.where("status").equals("pending").count();
}

/* ────────────────────────────────────────────
 *  ربط تلقائي مع حدث عودة الاتصال
 * ──────────────────────────────────────────── */

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.info("[SyncQueue] 🌐 عاد الاتصال — بدء معالجة الطابور...");
    processQueue();
  });

  if (document.readyState === "complete") {
    processQueue();
  } else {
    window.addEventListener("load", () => processQueue());
  }
}
