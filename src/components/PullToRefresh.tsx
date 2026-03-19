import { useState, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh?: () => Promise<void> | void;
  children: React.ReactNode;
}

const PullToRefresh = ({ onRefresh, children }: PullToRefreshProps) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const threshold = 70;

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
      setPullDistance(Math.min(dy * 0.35, 100));
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      if (navigator.vibrate) navigator.vibrate(15);
      try {
        await onRefresh?.();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pullDistance, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);
  const translateY = isRefreshing ? 40 : pullDistance;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Inline spinner indicator - sits behind the content */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-0 pointer-events-none"
        style={{
          height: "40px",
          opacity: isRefreshing ? 1 : progress,
          transform: `translateY(${isRefreshing ? 0 : -10 + progress * 10}px)`,
          transition: isRefreshing ? "opacity 0.2s" : "none",
        }}
      >
        <Loader2
          size={20}
          className={`text-primary ${isRefreshing ? "animate-spin" : ""}`}
          style={{
            transform: isRefreshing ? undefined : `rotate(${pullDistance * 5}deg)`,
          }}
        />
      </div>

      {/* Content moves down */}
      <div
        className="relative z-10 bg-background"
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isDragging.current ? "none" : "transform 0.3s cubic-bezier(0.2, 0, 0, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
