import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";
import {
  subscribeToasts,
  getToasts,
  appToast,
  type AppToastItem,
  type ToastType,
} from "@/lib/toast";

const ICON_MAP: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLOR_MAP: Record<ToastType, string> = {
  success: "bg-primary",
  error: "bg-destructive",
  warning: "bg-amber-500",
  info: "bg-blue-500",
};

const ToastCard = ({ item }: { item: AppToastItem }) => {
  const Icon = ICON_MAP[item.type];
  const bg = COLOR_MAP[item.type];
  const startY = useRef(0);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      if (info.offset.y < -30) {
        appToast.dismiss(item.id);
      }
    },
    [item.id]
  );

  return (
    <motion.div
      layout
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      drag="y"
      dragConstraints={{ top: -60, bottom: 0 }}
      dragElastic={0.3}
      onDragEnd={handleDragEnd}
      className={`${bg} mx-4 rounded-2xl px-5 py-3 flex items-start gap-3 shadow-lg cursor-grab active:cursor-grabbing select-none`}
      style={{ touchAction: "none" }}
    >
      <Icon className="w-5 h-5 text-white/90 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug">
          {item.title}
        </p>
        {item.description && (
          <p className="text-xs text-white/75 mt-0.5 leading-snug">
            {item.description}
          </p>
        )}
      </div>
    </motion.div>
  );
};

const AppToast: React.FC = () => {
  const [items, setItems] = useState<AppToastItem[]>(getToasts);

  useEffect(() => subscribeToasts(setItems), []);

  return createPortal(
    <div
      className="fixed top-0 inset-x-0 z-[9999] flex flex-col gap-3"
      style={{ pointerEvents: items.length ? "auto" : "none", paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}
    >
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default AppToast;
