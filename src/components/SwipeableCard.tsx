import React, { useRef, useState, useCallback } from "react";
import { haptic } from "@/lib/haptics";

export interface SwipeAction {
  icon: React.ReactNode;
  label: string;
  color: string;        // tailwind bg class e.g. "bg-primary" or "bg-destructive"
  textColor?: string;   // defaults to "text-white"
  onClick: () => void;
}

interface SwipeableCardProps {
  children: React.ReactNode;
  actions: SwipeAction[];   // 1–4 actions
  onSwipeOpen?: () => void; // called when card opens (to close siblings)
}

const BUTTON_WIDTH = 68; // px per action button
const THRESHOLD = 60;    // px to trigger snap open

export const SwipeableCard = ({ children, actions, onSwipeOpen }: SwipeableCardProps) => {
  const ACTION_WIDTH = actions.length * BUTTON_WIDTH;

  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const isOpen = useRef(false);
  const isDragging = useRef(false);
  const isVertical = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
    isVertical.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;

    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Detect vertical scroll — lock direction early
    if (!isVertical.current && Math.abs(dy) > Math.abs(dx) + 5) {
      isVertical.current = true;
      return;
    }
    if (isVertical.current) return;

    // RTL: drag right (positive dx) reveals actions on the left
    const base = isOpen.current ? ACTION_WIDTH : 0;
    const newOffset = Math.max(0, Math.min(ACTION_WIDTH, base + dx));
    setOffset(newOffset);
    offsetRef.current = newOffset;
  }, [ACTION_WIDTH]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    if (isVertical.current) return;

    const current = offsetRef.current;
    const shouldOpen = current > THRESHOLD;

    if (shouldOpen && !isOpen.current) {
      offsetRef.current = ACTION_WIDTH;
      setOffset(ACTION_WIDTH);
      isOpen.current = true;
      onSwipeOpen?.();
      haptic.light();
    } else if (current < ACTION_WIDTH / 2) {
      offsetRef.current = 0;
      setOffset(0);
      isOpen.current = false;
    } else if (isOpen.current) {
      offsetRef.current = ACTION_WIDTH;
      setOffset(ACTION_WIDTH);
    }
  }, [ACTION_WIDTH, onSwipeOpen]);

  const close = useCallback(() => {
    setOffset(0);
    offsetRef.current = 0;
    isOpen.current = false;
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Action buttons — revealed on left when swiping right */}
      <div
        className="absolute inset-y-0 left-0 flex items-stretch"
        style={{ width: ACTION_WIDTH }}
      >
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => { action.onClick(); close(); }}
            aria-label={action.label}
            className={`flex-1 flex flex-col items-center justify-center gap-1 
                        ${action.color} ${action.textColor ?? "text-white"}
                        ${i === 0 ? "rounded-r-none" : ""}
                        ${i === actions.length - 1 ? "rounded-l-2xl" : ""}`}
          >
            {action.icon}
            <span className="text-[10px] font-semibold">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Card content — slides right to reveal actions */}
      <div
        className="relative z-10"
        style={{ transform: `translateX(${offset}px)`, transition: isDragging.current ? "none" : "transform 250ms ease-out" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (isOpen.current) close(); }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableCard;
