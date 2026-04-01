/**
 * Resource Registry — المصدر الوحيد لتعريف الموارد المحلية
 *
 * كل مورد يُسجَّل مرة واحدة هنا، ويستهلكه:
 * - warmCache.ts
 * - fullSync.ts
 * - useFamilyRealtime.ts
 * - syncQueue.ts (TABLE_API_MAP)
 *
 * هذا يمنع drift بين الملفات ويضمن أن أي إضافة جديدة
 * تُغطّى تلقائياً في كل الأنظمة الفرعية.
 */

export interface ResourceEntry {
  /** اسم الجدول في Dexie */
  table: string;
  /** مفتاح React Query (بدون familyId — يُضاف ديناميكياً) */
  queryKeyPrefix: string;
  /** هل الجدول يملك family_id مباشرة؟ */
  familyScoped: boolean;
  /** هل يُحمّل في warmCache؟ */
  warm: boolean;
  /** إعدادات fullSync — null = لا يُزامن */
  fullSync: { action: string; fn: string; label: string } | null;
  /** هل يُضاف لقائمة invalidation عند visibility/online؟ */
  realtime: boolean;
}

/**
 * جميع الموارد المسجلة في التطبيق.
 * ترتيب الإدخالات لا يؤثر — لكنه منظّم حسب الموديول.
 */
export const RESOURCE_REGISTRY: ResourceEntry[] = [
  // ── المهام ──
  { table: "task_lists", queryKeyPrefix: "task-lists", familyScoped: true, warm: true, realtime: true,
    fullSync: { action: "get-lists", fn: "tasks-api", label: "المهام" } },
  { table: "task_items", queryKeyPrefix: "task-lists", familyScoped: false, warm: false, realtime: false, fullSync: null },

  // ── السوق ──
  { table: "market_lists", queryKeyPrefix: "market-lists", familyScoped: true, warm: true, realtime: true,
    fullSync: { action: "get-lists", fn: "market-api", label: "السوق" } },
  { table: "market_items", queryKeyPrefix: "market-lists", familyScoped: false, warm: false, realtime: false, fullSync: null },

  // ── التقويم ──
  { table: "calendar_events", queryKeyPrefix: "calendar-events", familyScoped: true, warm: true, realtime: true,
    fullSync: { action: "get-events", fn: "calendar-api", label: "التقويم" } },

  // ── الأدوية ──
  { table: "medications", queryKeyPrefix: "medications", familyScoped: true, warm: true, realtime: true,
    fullSync: { action: "get-medications", fn: "health-api", label: "الأدوية" } },
  { table: "medication_logs", queryKeyPrefix: "medication-logs", familyScoped: false, warm: true, realtime: false, fullSync: null },

  // ── الميزانية ──
  { table: "budgets", queryKeyPrefix: "budgets", familyScoped: true, warm: true, realtime: true,
    fullSync: { action: "get-budgets", fn: "budget-api", label: "الميزانية" } },
  { table: "budget_expenses", queryKeyPrefix: "budgets", familyScoped: false, warm: false, realtime: false, fullSync: null },

  // ── الديون ──
  { table: "debts", queryKeyPrefix: "debts", familyScoped: true, warm: true, realtime: true,
    fullSync: { action: "get-debts", fn: "debts-api", label: "الديون" } },
  { table: "debt_payments", queryKeyPrefix: "debts", familyScoped: false, warm: false, realtime: false, fullSync: null },

  // ── الرحلات ──
  { table: "trips", queryKeyPrefix: "trips", familyScoped: true, warm: true, realtime: true,
    fullSync: { action: "get-trips", fn: "trips-api", label: "الرحلات" } },
  { table: "trip_day_plans", queryKeyPrefix: "trips", familyScoped: false, warm: true, realtime: false, fullSync: null },
  { table: "trip_activities", queryKeyPrefix: "trips", familyScoped: false, warm: true, realtime: false, fullSync: null },
  { table: "trip_expenses", queryKeyPrefix: "trips", familyScoped: false, warm: true, realtime: false, fullSync: null },
  { table: "trip_packing", queryKeyPrefix: "trips", familyScoped: false, warm: true, realtime: false, fullSync: null },
  { table: "trip_suggestions", queryKeyPrefix: "trips", familyScoped: false, warm: true, realtime: false, fullSync: null },

  // ── المستندات ──
  { table: "document_lists", queryKeyPrefix: "document-lists", familyScoped: true, warm: true, realtime: true,
    fullSync: { action: "get-lists", fn: "documents-api", label: "الوثائق" } },
  { table: "document_items", queryKeyPrefix: "document-lists", familyScoped: false, warm: true, realtime: false, fullSync: null },

  // ── الأماكن ──
  { table: "place_lists", queryKeyPrefix: "place-lists", familyScoped: true, warm: true, realtime: true,
    fullSync: { action: "get-lists", fn: "places-api", label: "الأماكن" } },
  { table: "places", queryKeyPrefix: "place-lists", familyScoped: false, warm: false, realtime: false, fullSync: null },

  // ── الألبومات ──
  { table: "albums", queryKeyPrefix: "albums", familyScoped: true, warm: true, realtime: true,
    fullSync: { action: "get-albums", fn: "albums-api", label: "الألبومات" } },
  { table: "album_photos", queryKeyPrefix: "albums", familyScoped: false, warm: true, realtime: false, fullSync: null },

  // ── المركبات ──
  { table: "vehicles", queryKeyPrefix: "vehicles", familyScoped: true, warm: true, realtime: true,
    fullSync: { action: "get-vehicles", fn: "vehicles-api", label: "المركبات" } },

  // ── التطعيمات ──
  { table: "vaccinations", queryKeyPrefix: "vaccinations", familyScoped: true, warm: true, realtime: true,
    fullSync: { action: "get-children", fn: "health-api", label: "اللقاحات" } },

  // ── العائلة ──
  { table: "family_members", queryKeyPrefix: "family-members-list", familyScoped: true, warm: true, realtime: true, fullSync: null },
  { table: "families", queryKeyPrefix: "families", familyScoped: false, warm: false, realtime: false, fullSync: null },
  { table: "profiles", queryKeyPrefix: "profiles", familyScoped: false, warm: true, realtime: false, fullSync: null },

  // ── المحادثات ──
  { table: "chat_messages", queryKeyPrefix: "chat-messages", familyScoped: true, warm: true, realtime: false, fullSync: null },

  // ── الزكاة ──
  { table: "zakat_assets", queryKeyPrefix: "zakat-assets", familyScoped: false, warm: true, realtime: true,
    fullSync: { action: "get-assets", fn: "zakat-api", label: "الزكاة" } },

  // ── الوصية ──
  { table: "will_sections", queryKeyPrefix: "will", familyScoped: false, warm: true, realtime: true,
    fullSync: { action: "get-will", fn: "will-api", label: "الوصية" } },

  // ── العبادات ──
  { table: "worship_children", queryKeyPrefix: "worship-children", familyScoped: true, warm: true, realtime: true,
    fullSync: { action: "get-children", fn: "worship-api", label: "العبادات" } },
  { table: "kids_worship_data", queryKeyPrefix: "kids-worship", familyScoped: false, warm: false, realtime: false, fullSync: null },
  { table: "prayer_logs", queryKeyPrefix: "prayer-logs", familyScoped: false, warm: false, realtime: false, fullSync: null },
  { table: "tasbih_sessions", queryKeyPrefix: "tasbih-sessions", familyScoped: false, warm: false, realtime: false, fullSync: null },

  // ── الطوارئ ──
  { table: "emergency_contacts", queryKeyPrefix: "emergency-contacts", familyScoped: true, warm: true, realtime: false, fullSync: null },

  // ── سلة المحذوفات ──
  { table: "trash_items", queryKeyPrefix: "trash-items", familyScoped: true, warm: false, realtime: true, fullSync: null },
];

/* ────────────────────────────────────────────
 *  Derived collections — يُستخدمها warmCache, fullSync, useFamilyRealtime
 * ──────────────────────────────────────────── */

/** الجداول التي تحتوي family_id مباشرة */
export const FAMILY_SCOPED_TABLES = new Set(
  RESOURCE_REGISTRY.filter(r => r.familyScoped).map(r => r.table)
);

/** جداول warmCache مع queryKeyPrefix */
export const WARM_TABLES = RESOURCE_REGISTRY
  .filter(r => r.warm)
  .map(r => ({ table: r.table, queryKeyPrefix: r.queryKeyPrefix }));

/** خطوات fullSync */
export const FULL_SYNC_STEPS = RESOURCE_REGISTRY
  .filter(r => r.fullSync !== null)
  .map(r => ({
    label: r.fullSync!.label,
    action: r.fullSync!.action,
    fn: r.fullSync!.fn,
    table: r.table,
  }));

/** مفاتيح React Query التي يجب invalidation عند visibility/online */
export const REALTIME_QUERY_KEYS = [
  ...new Set(
    RESOURCE_REGISTRY.filter(r => r.realtime).map(r => r.queryKeyPrefix)
  ),
];
