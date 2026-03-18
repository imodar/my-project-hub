import { useState, useRef, useCallback } from "react";

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
    // Only activate if at top of page
    if (window.scrollY <= 0) {
      startY.current = e.touches[0].clientY;
      isDragging.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || isRefreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      // Rubber band effect
      setPullDistance(Math.min(dy * 0.4, 120));
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(20);
      try {
        await onRefresh?.();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pullDistance, isRefreshing, onRefresh]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all"
        style={{
          height: pullDistance > 0 || isRefreshing ? Math.max(pullDistance, isRefreshing ? 48 : 0) : 0,
        }}
      >
        <div
          className={`w-6 h-6 rounded-full border-2 border-primary border-t-transparent ${
            isRefreshing ? "animate-spin" : ""
          }`}
          style={{
            opacity: Math.min(pullDistance / threshold, 1),
            transform: `rotate(${pullDistance * 3}deg) scale(${Math.min(pullDistance / threshold, 1)})`,
          }}
        />
      </div>
      {children}
    </div>
  );
};

export default PullToRefresh;
