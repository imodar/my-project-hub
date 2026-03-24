import React, { useRef, useCallback } from "react";
import { Pencil, Trash2, Archive } from "lucide-react";

interface SwipeableCardProps {
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete: () => void;
  onArchive?: () => void;
  actionWidth?: number;
}

const SwipeableCard = ({ children, onEdit, onDelete, onArchive, actionWidth }: SwipeableCardProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isOpenRef = useRef(false);

  const actionCount = [onDelete, onEdit, onArchive].filter(Boolean).length;
  const ACTION_WIDTH = actionWidth ?? actionCount * 70;
  const SWIPE_THRESHOLD = 60;

  const getContent = useCallback(() => {
    return containerRef.current?.querySelector("[data-swipe-content]") as HTMLElement | null;
  }, []);

  const setTransform = useCallback((x: number) => {
    const content = getContent();
    if (content) content.style.transform = `translateX(${x}px)`;
  }, [getContent]);

  const closeSwipe = useCallback(() => {
    const content = getContent();
    if (content) content.style.transition = "transform 0.3s ease";
    setTransform(0);
    isOpenRef.current = false;
  }, [getContent, setTransform]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    startXRef.current = e.clientX;
    currentXRef.current = isOpenRef.current ? ACTION_WIDTH : 0;
    const content = getContent();
    if (content) content.style.transition = "none";
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [ACTION_WIDTH, getContent]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const diff = e.clientX - startXRef.current;
    const base = isOpenRef.current ? ACTION_WIDTH : 0;
    currentXRef.current = Math.max(0, Math.min(ACTION_WIDTH, base + diff));
    setTransform(currentXRef.current);
  }, [ACTION_WIDTH, setTransform]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const content = getContent();
    if (content) content.style.transition = "transform 0.3s ease";
    if (currentXRef.current > SWIPE_THRESHOLD) {
      setTransform(ACTION_WIDTH);
      isOpenRef.current = true;
    } else {
      setTransform(0);
      isOpenRef.current = false;
    }
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
  }, [ACTION_WIDTH, SWIPE_THRESHOLD, getContent, setTransform]);

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-2xl">
      {/* Action buttons behind */}
      <div
        className="absolute inset-y-0 left-0 flex items-stretch gap-1 p-1"
        style={{ width: ACTION_WIDTH }}
      >
        {onDelete && (
          <button
            onClick={() => { closeSwipe(); onDelete(); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 bg-destructive hover:bg-destructive/90 transition-colors rounded-xl"
          >
            <Trash2 size={16} className="text-destructive-foreground" />
            <span className="text-[10px] text-destructive-foreground font-semibold">حذف</span>
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => { closeSwipe(); onEdit(); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl"
            style={{ background: "hsl(220, 60%, 50%)" }}
          >
            <Pencil size={16} className="text-white" />
            <span className="text-[10px] text-white font-semibold">تعديل</span>
          </button>
        )}
        {onArchive && (
          <button
            onClick={() => { closeSwipe(); onArchive(); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl"
            style={{ background: "hsl(var(--muted))" }}
          >
            <Archive size={16} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-semibold">أرشفة</span>
          </button>
        )}
      </div>
      {/* Swipeable content */}
      <div
        data-swipe-content
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={closeSwipe}
        className="relative z-10"
        style={{ touchAction: "pan-y" }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableCard;
