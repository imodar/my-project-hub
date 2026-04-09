/**
 * مؤشر حالة المزامنة — SyncStatus (محسَّن)
 *
 * يعرض:
 * - حالة الاتصال (متصل / غير متصل)
 * - عدد العمليات المعلقة
 * - عدد العمليات الفاشلة مع زر إعادة المحاولة
 * - حالة جارٍ التزامن...
 */
import { useState, useEffect, forwardRef, useCallback } from "react";
import { db } from "@/lib/db";
import { retryFailedItems, processQueue } from "@/lib/syncQueue";
import { cn } from "@/lib/utils";
import { RefreshCw, AlertTriangle, CheckCircle2, WifiOff } from "lucide-react";
import { appToast } from "@/lib/toast";

interface SyncStatusProps {
  showLabel?: boolean;
  showRetryButton?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const SyncStatus = forwardRef<HTMLDivElement, SyncStatusProps>(
  ({ showLabel = false, showRetryButton = false, size = "sm", className }, ref) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);
    const [failedCount, setFailedCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);

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

    // Polling لحالة الطابور — كل 10 ثوانٍ
    const checkQueue = useCallback(async () => {
      try {
        const [pending, failed] = await Promise.all([
          db.sync_queue.where("status").equals("pending").count(),
          db.sync_queue.where("status").equals("failed").count(),
        ]);
        setPendingCount(pending);
        setFailedCount(failed);
      } catch {
        // silent
      }
    }, []);

    useEffect(() => {
      checkQueue();
      const interval = setInterval(checkQueue, 10_000);
      return () => clearInterval(interval);
    }, [checkQueue]);

    // تحديث حالة التزامن
    useEffect(() => {
      if (isOnline && pendingCount > 0) {
        setIsSyncing(true);
        const timer = setTimeout(() => setIsSyncing(false), 3000);
        return () => clearTimeout(timer);
      }
      setIsSyncing(false);
    }, [isOnline, pendingCount]);

    // إعادة المحاولة يدوياً
    const handleRetry = useCallback(async () => {
      if (isRetrying || !isOnline) return;
      setIsRetrying(true);
      try {
        const count = await retryFailedItems();
        if (count > 0) {
          appToast.success("إعادة المزامنة", `جاري إعادة مزامنة ${count} عملية...`);
        }
        await processQueue();
        await checkQueue();
      } catch {
        appToast.error("فشل", "تعذر إعادة المزامنة، تحقق من الاتصال");
      } finally {
        setIsRetrying(false);
      }
    }, [isRetrying, isOnline, checkQueue]);

    // ── تحديد الحالة ──
    const dotSize = size === "sm" ? "h-2 w-2" : "h-3 w-3";
    const iconSize = size === "sm" ? 12 : 14;

    type StatusConfig = {
      dotClass: string;
      label: string;
      icon: React.ReactNode;
    };

    let status: StatusConfig;

    if (!isOnline) {
      status = {
        dotClass: "bg-red-500",
        label: pendingCount > 0
          ? `غير متصل — ${pendingCount} في الانتظار`
          : "غير متصل",
        icon: <WifiOff size={iconSize} className="text-red-500" />,
      };
    } else if (failedCount > 0) {
      status = {
        dotClass: "bg-amber-500 animate-pulse",
        label: `${failedCount} عملية فشلت`,
        icon: <AlertTriangle size={iconSize} className="text-amber-500" />,
      };
    } else if (isSyncing) {
      status = {
        dotClass: "bg-blue-500 animate-pulse",
        label: `يتزامن... (${pendingCount})`,
        icon: <RefreshCw size={iconSize} className="text-blue-500 animate-spin" />,
      };
    } else {
      status = {
        dotClass: "bg-green-500",
        label: "متزامن",
        icon: <CheckCircle2 size={iconSize} className="text-green-500" />,
      };
    }

    return (
      <div ref={ref} className={cn("flex items-center gap-1.5", className)} dir="rtl">
        {showLabel ? (
          status.icon
        ) : (
          <span className={cn("rounded-full shrink-0", dotSize, status.dotClass)} />
        )}

        {showLabel && (
          <span className="text-xs text-muted-foreground">{status.label}</span>
        )}

        {/* عداد الفاشلة بدون label */}
        {!showLabel && (pendingCount > 0 || failedCount > 0) && (
          <span className={cn(
            "text-[10px] font-medium",
            failedCount > 0 ? "text-amber-500" : "text-muted-foreground"
          )}>
            {failedCount > 0 ? failedCount : pendingCount}
          </span>
        )}

        {/* زر إعادة المحاولة */}
        {showRetryButton && failedCount > 0 && isOnline && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            aria-label="إعادة مزامنة العمليات الفاشلة"
            className={cn(
              "text-xs text-amber-600 underline hover:text-amber-800 transition-colors",
              isRetrying && "opacity-50 cursor-not-allowed"
            )}
          >
            {isRetrying ? "جارٍ..." : "أعد المحاولة"}
          </button>
        )}
      </div>
    );
  }
);

SyncStatus.displayName = "SyncStatus";

export default SyncStatus;
