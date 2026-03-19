import { useState, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";

interface PullToRefreshProps {
  onRefresh?: () => Promise<void> | void;
  children: React.ReactNode;
}

const PullToRefresh = ({ onRefresh, children }: PullToRefreshProps) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const threshold = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      startY.current = e.touches[0].clientY;
      isDragging.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || isRefreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setPullDistance(Math.min(dy * 0.4, 120));
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      if (navigator.vibrate) navigator.vibrate(20);
      try {
        await onRefresh?.();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pullDistance, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);
  const isActive = pullDistance > 0 || isRefreshing;
  const height = isActive ? Math.max(pullDistance, isRefreshing ? 56 : 0) : 0;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="overflow-hidden transition-all duration-200 ease-out"
        style={{ height }}
      >
        <div
          className="flex flex-col items-center justify-center h-full gap-1"
          style={{
            background: "linear-gradient(180deg, hsl(var(--primary) / 0.08) 0%, transparent 100%)",
          }}
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
              isRefreshing ? "bg-primary/15 scale-100" : "bg-primary/10"
            }`}
            style={{
              opacity: isRefreshing ? 1 : progress,
              transform: `scale(${isRefreshing ? 1 : 0.5 + progress * 0.5})`,
            }}
          >
            <RefreshCw
              size={18}
              className={`text-primary transition-transform duration-300 ${
                isRefreshing ? "animate-spin" : ""
              }`}
              style={{
                transform: isRefreshing ? undefined : `rotate(${pullDistance * 4}deg)`,
              }}
            />
          </div>
          <span
            className="text-[10px] font-semibold text-primary/70 transition-opacity duration-200"
            style={{ opacity: isRefreshing ? 1 : progress > 0.6 ? 1 : 0 }}
          >
            {isRefreshing ? "جارٍ التحديث..." : progress >= 1 ? "أفلت للتحديث" : "اسحب للتحديث"}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
};

export default PullToRefresh;
