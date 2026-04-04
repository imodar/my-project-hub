/**
 * مؤشر حالة المزامنة — SyncStatus
 *
 * يستخدم polling خفيف بدل useLiveQuery لتقليل الحمل على IndexedDB.
 * مخصص لصفحة الإعدادات فقط — لا يُعرض في PageHeader.
 */
import { useState, useEffect, forwardRef, useCallback } from "react";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

interface SyncStatusProps {
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const SyncStatus = forwardRef<HTMLDivElement, SyncStatusProps>(({ showLabel = false, size = "sm", className }, ref) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
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

  // Polling بدل useLiveQuery — كل 15 ثانية
  const checkPending = useCallback(async () => {
    try {
      const count = await db.sync_queue.where("status").equals("pending").count();
      setPendingCount(count);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    checkPending();
    const interval = setInterval(checkPending, 15_000);
    return () => clearInterval(interval);
  }, [checkPending]);

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
    dotClass = "bg-red-500";
    label = pendingCount > 0 ? `غير متصل (${pendingCount})` : "غير متصل";
  } else if (isSyncing) {
    dotClass = "bg-orange-500 animate-pulse";
    label = "يتزامن...";
  } else {
    dotClass = "bg-green-500";
    label = "متصل";
  }

  return (
    <div ref={ref} className={cn("flex items-center gap-1.5", className)} dir="rtl">
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
});

SyncStatus.displayName = "SyncStatus";

export default SyncStatus;
