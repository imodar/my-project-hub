/**
 * ConflictResolutionDrawer — واجهة حل التعارضات
 *
 * يظهر زر عائم عندما تُكتشف تعارضات بين البيانات المحلية والسيرفر.
 * يفتح درج يعرض كل تعارض مع خيار الاحتفاظ بالتعديل المحلي أو قبول السيرفر.
 */
import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, GitMerge, Check, Server, Smartphone } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { appToast } from "@/lib/toast";
import {
  getUnresolvedConflicts,
  resolveConflict,
} from "@/lib/conflictResolver";
import type { ConflictItem } from "@/lib/db";

/* ── Arabic labels for table names ───────────────────────────── */
const TABLE_LABELS: Record<string, string> = {
  task_lists: "قوائم المهام",
  task_items: "المهام",
  market_lists: "قوائم التسوق",
  market_items: "أغراض السوق",
  calendar_events: "التقويم",
  budgets: "الميزانيات",
  budget_expenses: "المصروفات",
  debts: "الديون",
  debt_payments: "مدفوعات الديون",
  trips: "الرحلات",
  trip_day_plans: "خطط الرحلة",
  medications: "الأدوية",
  medication_logs: "سجل الأدوية",
  documents: "المستندات",
  will_items: "الوصايا",
  vaccinations: "التطعيمات",
  places: "الأماكن",
  vehicle_records: "السيارة",
  zakat_records: "الزكاة",
};

/* ── Displayable field labels ─────────────────────────────────── */
const FIELD_LABELS: Record<string, string> = {
  name: "الاسم",
  title: "العنوان",
  amount: "المبلغ",
  note: "ملاحظة",
  description: "الوصف",
  priority: "الأولوية",
  done: "مكتمل",
  checked: "محدد",
  quantity: "الكمية",
  updated_at: "آخر تعديل",
  status: "الحالة",
  category: "الفئة",
  date: "التاريخ",
};

/** الحقول التي يجب استبعادها من المقارنة */
const SKIP_FIELDS = new Set(["id", "family_id", "user_id", "created_at", "created_by"]);

/** يُرجع الحقول التي تختلف بين سجلَين */
function getDiffFields(local: Record<string, unknown>, server: Record<string, unknown>) {
  const allKeys = new Set([...Object.keys(local), ...Object.keys(server)]);
  const diffs: Array<{ key: string; local: unknown; server: unknown }> = [];

  for (const key of allKeys) {
    if (SKIP_FIELDS.has(key)) continue;
    const lv = local[key];
    const sv = server[key];
    if (JSON.stringify(lv) !== JSON.stringify(sv)) {
      diffs.push({ key, local: lv, server: sv });
    }
  }
  return diffs.slice(0, 6); // max 6 diffs to keep UI clean
}

/** يُنسّق قيمة الحقل للعرض */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "string" && value.includes("T") && value.includes(":")) {
    // ISO datetime
    try {
      return new Date(value).toLocaleString("ar-SA", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return value;
    }
  }
  return String(value);
}

/* ── Component ────────────────────────────────────────────────── */
export default function ConflictResolutionDrawer() {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState<number | null>(null);

  const loadConflicts = useCallback(async () => {
    try {
      const list = await getUnresolvedConflicts();
      setConflicts(list);
    } catch {
      // silent
    }
  }, []);

  // Poll on mount + listen for new conflict events
  useEffect(() => {
    loadConflicts();

    const handler = () => {
      loadConflicts();
      setOpen(true); // فتح تلقائي عند اكتشاف تعارض جديد
    };

    window.addEventListener("data-conflict-detected", handler);
    const interval = setInterval(loadConflicts, 60_000);

    return () => {
      window.removeEventListener("data-conflict-detected", handler);
      clearInterval(interval);
    };
  }, [loadConflicts]);

  const handleResolve = useCallback(
    async (conflictId: number, resolution: "local" | "server") => {
      setResolving(conflictId);
      try {
        await resolveConflict(conflictId, resolution);
        const label = resolution === "local" ? "تعديلك" : "نسخة السيرفر";
        appToast.success("تم الحل", `تم الاحتفاظ بـ ${label}`);
        await loadConflicts();
      } catch {
        appToast.error("فشل", "تعذر حل التعارض، حاول مرة أخرى");
      } finally {
        setResolving(null);
      }
    },
    [loadConflicts]
  );

  if (conflicts.length === 0) return null;

  return (
    <>
      {/* Floating badge */}
      <button
        onClick={() => setOpen(true)}
        aria-label={`${conflicts.length} تعارض في البيانات — اضغط للحل`}
        className="fixed z-50 flex items-center gap-1.5 px-3 py-2 rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-colors text-sm font-semibold"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)",
          right: "16px",
        }}
      >
        <AlertTriangle size={14} aria-hidden="true" />
        <span>{conflicts.length} تعارض</span>
      </button>

      {/* Drawer */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent dir="rtl" className="max-h-[90dvh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 text-amber-600">
              <GitMerge size={18} />
              تعارضات البيانات
            </DrawerTitle>
            <DrawerDescription>
              {conflicts.length === 1
                ? "يوجد تعارض واحد بين بياناتك وبيانات السيرفر"
                : `يوجد ${conflicts.length} تعارضات بين بياناتك وبيانات السيرفر`}
              . اختر أي نسخة تريد الاحتفاظ بها.
            </DrawerDescription>
          </DrawerHeader>

          <div className="overflow-y-auto px-4 pb-8 space-y-4">
            {conflicts.map((conflict) => {
              const tableLabel = TABLE_LABELS[conflict.table] ?? conflict.table;
              const diffs = getDiffFields(conflict.local_data, conflict.server_data);
              const isResolving = resolving === conflict.id;

              return (
                <div
                  key={conflict.id}
                  className="border border-amber-200 dark:border-amber-900/50 rounded-2xl overflow-hidden bg-amber-50/30 dark:bg-amber-950/20"
                >
                  {/* Header */}
                  <div className="px-3 py-2 bg-amber-100/60 dark:bg-amber-900/30 flex items-center gap-2 border-b border-amber-200 dark:border-amber-900/50">
                    <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                      {tableLabel}
                    </span>
                    <span className="text-[10px] text-amber-600/70 mr-auto">
                      {new Date(conflict.detected_at).toLocaleString("ar-SA", {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Diff table */}
                  {diffs.length > 0 && (
                    <div className="px-3 py-2">
                      <div className="grid grid-cols-3 gap-1 text-[10px] font-semibold text-muted-foreground mb-1">
                        <span>الحقل</span>
                        <span className="flex items-center gap-1">
                          <Smartphone size={9} /> تعديلك
                        </span>
                        <span className="flex items-center gap-1">
                          <Server size={9} /> السيرفر
                        </span>
                      </div>
                      <div className="space-y-1">
                        {diffs.map(({ key, local, server }) => (
                          <div key={key} className="grid grid-cols-3 gap-1 text-xs">
                            <span className="text-muted-foreground font-medium">
                              {FIELD_LABELS[key] ?? key}
                            </span>
                            <span className="text-blue-700 dark:text-blue-300 truncate bg-blue-50 dark:bg-blue-950/30 px-1 rounded">
                              {formatValue(local)}
                            </span>
                            <span className="text-green-700 dark:text-green-300 truncate bg-green-50 dark:bg-green-950/30 px-1 rounded">
                              {formatValue(server)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="px-3 py-2 flex gap-2 border-t border-amber-100 dark:border-amber-900/30">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isResolving}
                      onClick={() => handleResolve(conflict.id!, "local")}
                      className="flex-1 text-xs h-8 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300"
                    >
                      {isResolving ? (
                        "جارٍ..."
                      ) : (
                        <>
                          <Smartphone size={11} className="ml-1" />
                          احتفظ بتعديلي
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isResolving}
                      onClick={() => handleResolve(conflict.id!, "server")}
                      className="flex-1 text-xs h-8 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300"
                    >
                      {isResolving ? (
                        "جارٍ..."
                      ) : (
                        <>
                          <Server size={11} className="ml-1" />
                          قبل السيرفر
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}

            {conflicts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                disabled={resolving !== null}
                className="w-full text-xs text-muted-foreground"
                onClick={async () => {
                  setResolving(-1);
                  try {
                    for (const c of conflicts) {
                      await resolveConflict(c.id!, "local");
                    }
                    appToast.success("تم الحل", "تم الاحتفاظ بجميع تعديلاتك");
                    await loadConflicts();
                    setOpen(false);
                  } catch {
                    appToast.error("فشل", "تعذر حل بعض التعارضات");
                  } finally {
                    setResolving(null);
                  }
                }}
              >
                <Check size={13} className="ml-1" />
                احتفظ بجميع تعديلاتي
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
