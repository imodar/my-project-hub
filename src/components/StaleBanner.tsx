import React, { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/db";

const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const AUTO_HIDE_MS = 10_000;

const StaleBanner = React.forwardRef<HTMLDivElement>((_props, ref) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!navigator.onLine) return;

    let timer: ReturnType<typeof setTimeout>;

    (async () => {
      try {
        const meta = await db.sync_meta.get("task_lists");
        const lastSync = meta?.last_synced_at;
        const isStale =
          !lastSync ||
          Date.now() - new Date(lastSync).getTime() > STALE_THRESHOLD_MS;

        if (isStale) {
          setShow(true);
          timer = setTimeout(() => setShow(false), AUTO_HIDE_MS);
        }
      } catch {
        // silent
      }
    })();

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const hide = () => setShow(false);
    window.addEventListener("offline", hide);
    return () => window.removeEventListener("offline", hide);
  }, []);

  return (
    <div ref={ref}>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed top-0 left-0 right-0 z-[190] flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium text-primary-foreground bg-primary/90 backdrop-blur-sm"
          >
            <RefreshCw size={14} className="animate-spin" />
            <span>جاري تحديث بياناتك...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

StaleBanner.displayName = "StaleBanner";

export default StaleBanner;
