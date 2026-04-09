/**
 * قاعدة البيانات المحلية — Dexie.js (IndexedDB)
 *
 * تُخزّن نسخة محلية من جميع بيانات التطبيق لتوفير تجربة فورية
 * بدون انتظار الشبكة (Offline-First).
 *
 * الجداول مطابقة لجداول Supabase مع إضافة:
 * - sync_queue: طابور العمليات المعلقة
 * - sync_meta: بيانات آخر مزامنة لكل جدول
 */
import Dexie, { type Table } from "dexie";

/* ────────────────────────────────────────────
 *  أنواع طابور المزامنة
 * ──────────────────────────────────────────── */

// Re-exported from syncQueue for convenience
export type SyncStatus = "pending" | "synced" | "failed";

export type SyncOperation = "INSERT" | "UPDATE" | "DELETE";

export interface SyncQueueItem {
  id?: number;
  /** مفتاح فريد لمنع إعادة المعالجة — UUID يُولَّد عند الإضافة */
  idempotency_key: string;
  table: string;
  operation: SyncOperation;
  data: Record<string, unknown>;
  created_at: string;
  status: SyncStatus;
  retries: number;
  /** آخر خطأ حدث — لمساعدة المستخدم في فهم السبب */
  last_error?: string;
}

export interface SyncMeta {
  /** اسم الجدول (مفتاح رئيسي) */
  table: string;
  /** آخر وقت مزامنة ناجحة (ISO string) */
  last_synced_at: string;
}

/** تعارض بيانات بين النسخة المحلية والسيرفر */
export interface ConflictItem {
  id?: number;
  /** اسم الجدول */
  table: string;
  /** معرّف السجل المتعارض */
  record_id: string;
  /** البيانات المحلية (ما غيّره المستخدم) */
  local_data: Record<string, unknown>;
  /** البيانات من السيرفر */
  server_data: Record<string, unknown>;
  /** وقت اكتشاف التعارض */
  detected_at: string;
  /** هل تم الحل */
  resolved: boolean;
  /** من اختار المستخدم — "local" أو "server" */
  resolution?: "local" | "server";
}

/* ────────────────────────────────────────────
 *  تعريف قاعدة البيانات
 * ──────────────────────────────────────────── */

class AppDatabase extends Dexie {
  // ── بيانات التطبيق ──
  medications!: Table;
  medication_logs!: Table;
  task_lists!: Table;
  task_items!: Table;
  market_lists!: Table;
  market_items!: Table;
  calendar_events!: Table;
  budgets!: Table;
  budget_expenses!: Table;
  debts!: Table;
  debt_payments!: Table;
  trips!: Table;
  trip_day_plans!: Table;
  trip_activities!: Table;
  trip_expenses!: Table;
  trip_packing!: Table;
  trip_documents!: Table;
  trip_suggestions!: Table;
  document_lists!: Table;
  document_items!: Table;
  document_files!: Table;
  place_lists!: Table;
  places!: Table;
  albums!: Table;
  album_photos!: Table;
  families!: Table;
  family_members!: Table;
  profiles!: Table;
  chat_messages!: Table;
  vehicles!: Table;
  vaccinations!: Table;
  zakat_assets!: Table;
  will_sections!: Table;
  tasbih_sessions!: Table;
  kids_worship_data!: Table;
  prayer_logs!: Table;
  worship_children!: Table;
  emergency_contacts!: Table;
  trash_items!: Table;

  // ── جداول المزامنة ──
  sync_queue!: Table<SyncQueueItem, number>;
  sync_meta!: Table<SyncMeta, string>;
  /** تعارضات البيانات بين المحلي والسيرفر */
  conflicts!: Table<ConflictItem, number>;

  constructor() {
    super("ailti_offline_db");

    this.version(4).stores({
      // ── الأدوية ──
      medications: "id, family_id, member_id, created_at",
      medication_logs: "id, medication_id, taken_at",

      // ── المهام ──
      task_lists: "id, family_id, created_by",
      task_items: "id, list_id, assigned_to, done",

      // ── السوق ──
      market_lists: "id, family_id, created_by",
      market_items: "id, list_id, checked",

      // ── التقويم ──
      calendar_events: "id, family_id, date",

      // ── الميزانية ──
      budgets: "id, family_id, month, type",
      budget_expenses: "id, budget_id",

      // ── الديون ──
      debts: "id, family_id, user_id, direction",
      debt_payments: "id, debt_id",

      // ── الرحلات ──
      trips: "id, family_id",
      trip_day_plans: "id, trip_id, day_number",
      trip_activities: "id, day_plan_id",
      trip_expenses: "id, trip_id",
      trip_packing: "id, trip_id",
      trip_documents: "id, trip_id",
      trip_suggestions: "id, trip_id, suggested_by, status",

      // ── المستندات ──
      document_lists: "id, family_id, created_by",
      document_items: "id, list_id",
      document_files: "id, document_id",

      // ── الأماكن ──
      place_lists: "id, family_id",
      places: "id, list_id",

      // ── الألبومات ──
      albums: "id, family_id",
      album_photos: "id, album_id",

      // ── العائلة ──
      families: "id",
      family_members: "id, family_id, user_id",
      profiles: "id",

      // ── المحادثات ──
      chat_messages: "id, family_id, sender_id, created_at",

      // ── المركبات ──
      vehicles: "id, family_id",

      // ── التطعيمات ──
      vaccinations: "id",

      // ── الزكاة ──
      zakat_assets: "id",

      // ── الوصية ──
      will_sections: "id",

      // ── التسبيح ──
      tasbih_sessions: "id, user_id, created_at",

      // ── عبادة الأطفال ──
      kids_worship_data: "id, child_id, year, month, day",
      prayer_logs: "id, child_id, date",
      worship_children: "id, family_id",

      // ── الطوارئ ──
      emergency_contacts: "id, family_id",

      // ── طابور المزامنة ──
      sync_queue: "++id, idempotency_key, table, status, created_at",

      // ── بيانات المزامنة ──
      sync_meta: "table",
    });

    // ── الإصدار 5: إضافة سلة المحذوفات ──
    this.version(5).stores({
      trash_items: "id, family_id, type, deleted_at",
    });

    // ── الإصدار 6: إضافة جدول التعارضات و idempotency_key ──
    this.version(6).stores({
      sync_queue: "++id, idempotency_key, table, status, created_at",
      conflicts: "++id, table, record_id, resolved, detected_at",
    });
  }
}

/** نسخة وحيدة من قاعدة البيانات المحلية */
export const db = new AppDatabase();
