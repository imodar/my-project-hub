/**
 * AppUpdateBanner — شريط تحديث التطبيق
 *
 * يظهر عندما يُرجع السيرفر 426 Upgrade Required،
 * مما يعني أن هذا الإصدار من التطبيق لم يعد مدعوماً.
 */
import { useState, useEffect } from "react";
import { RefreshCw, ArrowUpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AppUpdateBanner() {
  const [show, setShow] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener("app-update-required", handler);
    return () => window.removeEventListener("app-update-required", handler);
  }, []);

  const handleUpdate = () => {
    setIsReloading(true);
    // Clear caches then reload to pick up latest assets
    if ("caches" in window) {
      caches.keys().then((names) => {
        Promise.all(names.map((n) => caches.delete(n))).finally(() => {
          window.location.reload();
        });
      });
    } else {
      window.location.reload();
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          role="alert"
          aria-live="assertive"
          dir="rtl"
          className="fixed top-0 inset-x-0 z-[200] bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-lg"
        >
          <ArrowUpCircle size={18} aria-hidden="true" className="shrink-0" />
          <p className="flex-1 text-sm font-semibold">
            يتطلب التطبيق تحديثاً للمتابعة
          </p>
          <button
            onClick={handleUpdate}
            disabled={isReloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-bold disabled:opacity-60"
          >
            <RefreshCw
              size={13}
              aria-hidden="true"
              className={isReloading ? "animate-spin" : ""}
            />
            {isReloading ? "جارٍ..." : "تحديث الآن"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
