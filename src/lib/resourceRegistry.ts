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

export interface ChildTableConfig {
  /** اسم الحقل في الكائن الأب (مثل "trip_day_plans") */
  key: string;
  /** اسم جدول Dexie */
  table: string;
  /** أحفاد (مستوى ثانٍ) */
  nested?: { key: string; table: string }[];
}

export interface ResourceEntry {
  /** اسم الجدول في Dexie */
  table: string;
  /** مفتاح React Query (بدون familyId — يُضاف ديناميكياً) */
  queryKeyPrefix: string;
  /** هل الجدول يملك family_id مباشرة؟ */
  familyScoped: boolean;
  /** هل يُحمّل في warmCache؟ */
  warm: boolean;
  /** أولوية التسخين: critical = يحجب العرض، deferred = يُحمّل في الخلفية */
  warmPriority: "critical" | "deferred";
  /** إعدادات fullSync — null = لا يُزامن */
  fullSync: {
    action: string;
    fn: string;
    label: string;
    childTables?: ChildTableConfig[];
  } | null;
  /** هل يُضاف لقائمة invalidation عند visibility/online؟ */
  realtime: boolean;
}

/**
 * جميع الموارد المسجلة في التطبيق.
 * ترتيب الإدخالات لا يؤثر — لكنه منظّم حسب الموديول.
 */
export const RESOURCE_REGISTRY: ResourceEntry[] = [
  // ── المهام ──
  { table: "task_lists", queryKeyPrefix: "task-lists", familyScoped: true, warm: true, warmPriority: "deferred", realtime: true,
    fullSync: { action: "get-lists", fn: "tasks-api", label: "المهام",
      childTables: [{ key: "task_items", table: "task_items" }],
    } },
  { table: "task_items", queryKeyPrefix: "task-lists", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },

  // ── السوق ──
  { table: "market_lists", queryKeyPrefix: "market-lists", familyScoped: true, warm: true, warmPriority: "deferred", realtime: true,
    fullSync: { action: "get-lists", fn: "market-api", label: "السوق",
      childTables: [{ key: "market_items", table: "market_items" }],
    } },
  { table: "market_items", queryKeyPrefix: "market-lists", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },

  // ── التقويم ──
  { table: "calendar_events", queryKeyPrefix: "calendar-events", familyScoped: true, warm: true, warmPriority: "deferred", realtime: true,
    fullSync: { action: "get-events", fn: "calendar-api", label: "التقويم" } },

  // ── الأدوية ──
  { table: "medications", queryKeyPrefix: "medications", familyScoped: true, warm: true, warmPriority: "deferred", realtime: true,
    fullSync: { action: "get-medications", fn: "health-api", label: "الأدوية" } },
  { table: "medication_logs", queryKeyPrefix: "medication-logs", familyScoped: false, warm: true, warmPriority: "deferred", realtime: false, fullSync: null },

  // ── الميزانية ──
  { table: "budgets", queryKeyPrefix: "budgets", familyScoped: true, warm: true, warmPriority: "deferred", realtime: true,
    fullSync: { action: "get-budgets", fn: "budget-api", label: "الميزانية",
      childTables: [{ key: "budget_expenses", table: "budget_expenses" }],
    } },
  { table: "budget_expenses", queryKeyPrefix: "budgets", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },

  // ── الديون ──
  { table: "debts", queryKeyPrefix: "debts", familyScoped: true, warm: true, warmPriority: "deferred", realtime: true,
    fullSync: { action: "get-debts", fn: "debts-api", label: "الديون",
      childTables: [
        { key: "debt_payments", table: "debt_payments" },
        { key: "debt_postponements", table: "debt_postponements" },
      ],
    } },
  { table: "debt_payments", queryKeyPrefix: "debts", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },
  { table: "debt_postponements", queryKeyPrefix: "debts", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },

  // ── الرحلات ──
  { table: "trips", queryKeyPrefix: "trips", familyScoped: true, warm: true, warmPriority: "deferred", realtime: true,
    fullSync: { action: "get-trips", fn: "trips-api", label: "الرحلات",
      childTables: [
        { key: "trip_day_plans", table: "trip_day_plans", nested: [
          { key: "trip_activities", table: "trip_activities" },
        ]},
        { key: "trip_expenses", table: "trip_expenses" },
        { key: "trip_packing", table: "trip_packing" },
        { key: "trip_suggestions", table: "trip_suggestions" },
        { key: "trip_documents", table: "trip_documents" },
      ],
    } },
  { table: "trip_day_plans", queryKeyPrefix: "trips", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },
  { table: "trip_activities", queryKeyPrefix: "trips", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },
  { table: "trip_expenses", queryKeyPrefix: "trips", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },
  { table: "trip_packing", queryKeyPrefix: "trips", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },
  { table: "trip_suggestions", queryKeyPrefix: "trips", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },
  { table: "trip_documents", queryKeyPrefix: "trips", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },

  // ── المستندات ──
  { table: "document_lists", queryKeyPrefix: "document-lists", familyScoped: true, warm: true, warmPriority: "deferred", realtime: true,
    fullSync: { action: "get-lists", fn: "documents-api", label: "الوثائق",
      childTables: [{ key: "document_items", table: "document_items", nested: [
        { key: "document_files", table: "document_files" },
      ] }],
    } },
  { table: "document_items", queryKeyPrefix: "document-lists", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },
  { table: "document_files", queryKeyPrefix: "document-lists", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },

  // ── الأماكن ──
  { table: "place_lists", queryKeyPrefix: "place-lists", familyScoped: true, warm: true, warmPriority: "deferred", realtime: true,
    fullSync: { action: "get-lists", fn: "places-api", label: "الأماكن" } },
  { table: "places", queryKeyPrefix: "place-lists", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },

  // ── الألبومات ──
  { table: "albums", queryKeyPrefix: "albums", familyScoped: true, warm: true, warmPriority: "deferred", realtime: true,
    fullSync: { action: "get-albums", fn: "albums-api", label: "الألبومات",
      childTables: [{ key: "album_photos", table: "album_photos" }],
    } },
  { table: "album_photos", queryKeyPrefix: "albums", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },

  // ── المركبات ──
  { table: "vehicles", queryKeyPrefix: "vehicles", familyScoped: true, warm: true, warmPriority: "critical", realtime: true,
    fullSync: { action: "get-vehicles", fn: "vehicles-api", label: "المركبات" } },

  // ── التطعيمات ──
  { table: "vaccinations", queryKeyPrefix: "vaccinations", familyScoped: true, warm: true, warmPriority: "deferred", realtime: true,
    fullSync: { action: "get-children", fn: "health-api", label: "اللقاحات" } },

  // ── العائلة ──
  { table: "family_members", queryKeyPrefix: "family-members-list", familyScoped: true, warm: true, warmPriority: "critical", realtime: true, fullSync: null },
  { table: "families", queryKeyPrefix: "families", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },
  { table: "profiles", queryKeyPrefix: "profiles", familyScoped: false, warm: true, warmPriority: "critical", realtime: false, fullSync: null },

  // ── المحادثات ──
  { table: "chat_messages", queryKeyPrefix: "chat-messages", familyScoped: true, warm: true, warmPriority: "deferred", realtime: false, fullSync: null },

  // ── الزكاة ──
  { table: "zakat_assets", queryKeyPrefix: "zakat-assets", familyScoped: false, warm: true, warmPriority: "critical", realtime: true,
    fullSync: { action: "get-assets", fn: "zakat-api", label: "الزكاة" } },

  // ── الوصية ──
  { table: "will_sections", queryKeyPrefix: "will", familyScoped: false, warm: true, warmPriority: "critical", realtime: true,
    fullSync: { action: "get-will", fn: "will-api", label: "الوصية" } },

  // ── العبادات ──
  { table: "worship_children", queryKeyPrefix: "worship-children", familyScoped: true, warm: true, warmPriority: "deferred", realtime: true,
    fullSync: { action: "get-children", fn: "worship-api", label: "العبادات" } },
  { table: "kids_worship_data", queryKeyPrefix: "kids-worship", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },
  { table: "prayer_logs", queryKeyPrefix: "prayer-logs", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },
  { table: "tasbih_sessions", queryKeyPrefix: "tasbih-sessions", familyScoped: false, warm: false, warmPriority: "deferred", realtime: false, fullSync: null },

  // ── الطوارئ ──
  { table: "emergency_contacts", queryKeyPrefix: "emergency-contacts", familyScoped: true, warm: true, warmPriority: "deferred", realtime: false, fullSync: null },

  // ── سلة المحذوفات ──
  { table: "trash_items", queryKeyPrefix: "trash-items", familyScoped: true, warm: false, warmPriority: "deferred", realtime: true, fullSync: null },
];

/* ────────────────────────────────────────────
 *  Derived collections — يُستخدمها warmCache, fullSync, useFamilyRealtime
 * ──────────────────────────────────────────── */

/** الجداول التي تحتوي family_id مباشرة */
export const FAMILY_SCOPED_TABLES = new Set(
  RESOURCE_REGISTRY.filter(r => r.familyScoped).map(r => r.table)
);

/** جداول warmCache — critical فقط (تحجب العرض) */
export const WARM_TABLES_CRITICAL = RESOURCE_REGISTRY
  .filter(r => r.warm && r.warmPriority === "critical")
  .map(r => ({ table: r.table, queryKeyPrefix: r.queryKeyPrefix }));

/** جداول warmCache — deferred (تُحمّل في الخلفية) */
export const WARM_TABLES_DEFERRED = RESOURCE_REGISTRY
  .filter(r => r.warm && r.warmPriority === "deferred")
  .map(r => ({ table: r.table, queryKeyPrefix: r.queryKeyPrefix }));

/** كل جداول warmCache (للتوافق) */
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
    childTables: r.fullSync!.childTables,
  }));

/** مفاتيح React Query التي يجب invalidation عند visibility/online */
export const REALTIME_QUERY_KEYS = [
  ...new Set(
    RESOURCE_REGISTRY.filter(r => r.realtime).map(r => r.queryKeyPrefix)
  ),
];
