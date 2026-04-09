import React, { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const OfflineBanner = React.forwardRef<HTMLDivElement>((_props, ref) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <div ref={ref}>
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-destructive-foreground bg-destructive shadow-lg"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <WifiOff size={16} aria-hidden="true" />
            <span>لا يوجد اتصال بالإنترنت — التطبيق يعمل بوضع أوفلاين</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

OfflineBanner.displayName = "OfflineBanner";

export default OfflineBanner;
