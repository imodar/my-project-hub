/**
 * مؤشر حالة المزامنة — SyncStatus
 *
 * يعرض نقطة ملونة تدل على حالة الاتصال والمزامنة:
 * - 🟢 أخضر: متصل + لا عمليات معلقة
 * - 🟠 برتقالي (متحرك): يتزامن الآن
 * - ⚫ رمادي: غير متصل + عدد العمليات المعلقة
 */
import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

interface SyncStatusProps {
  /** إظهار النص بجانب النقطة */
  showLabel?: boolean;
  /** حجم النقطة */
  size?: "sm" | "md";
  className?: string;
}

const SyncStatus = ({ showLabel = false, size = "sm", className }: SyncStatusProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  // مراقبة حالة الاتصال
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // مراقبة عدد العمليات المعلقة في الوقت الحقيقي
  const pendingCount = useLiveQuery(
    () => db.sync_queue.where("status").equals("pending").count(),
    [],
    0
  );

  // تحديد الحالة عند تغيّر العمليات المعلقة
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      setIsSyncing(true);
      const timer = setTimeout(() => setIsSyncing(false), 3000);
      return () => clearTimeout(timer);
    }
    setIsSyncing(false);
  }, [isOnline, pendingCount]);

  // ── تحديد اللون والنص ──
  const dotSize = size === "sm" ? "h-2 w-2" : "h-3 w-3";

  let dotClass = "";
  let label = "";

  if (!isOnline) {
    dotClass = "bg-muted-foreground";
    label = pendingCount > 0 ? `غير متصل (${pendingCount})` : "غير متصل";
  } else if (isSyncing) {
    dotClass = "bg-orange-500 animate-pulse";
    label = "يتزامن...";
  } else {
    dotClass = "bg-green-500";
    label = "متصل";
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)} dir="rtl">
      <span className={cn("rounded-full shrink-0", dotSize, dotClass)} />
      {showLabel && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
      {!isOnline && pendingCount > 0 && !showLabel && (
        <span className="text-[10px] font-medium text-muted-foreground">
          {pendingCount}
        </span>
      )}
    </div>
  );
};

export default SyncStatus;
