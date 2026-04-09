/**
 * ServiceWorkerUpdatePrompt — إشعار تحديث التطبيق
 *
 * يُعلم المستخدم عند توفر إصدار جديد من التطبيق (Service Worker تحديث).
 * يظهر شريط في الأسفل مع زر "تحديث الآن".
 *
 * يستخدم vite-plugin-pwa lifecycle events.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ServiceWorkerUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // مراقبة حدث تحديث Service Worker من vite-plugin-pwa
    const handleSWUpdate = (event: Event) => {
      const swReg = (event as CustomEvent<ServiceWorkerRegistration>).detail;
      setRegistration(swReg);
      setShowPrompt(true);
    };

    window.addEventListener("sw-updated", handleSWUpdate);

    // فحص Service Worker الحالي عند التحميل
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) {
        setRegistration(reg);
        setShowPrompt(true);
      }
    }).catch(() => {});

    return () => {
      window.removeEventListener("sw-updated", handleSWUpdate);
    };
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      // إرسال رسالة لـ Service Worker لتفعيل الإصدار الجديد
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    // إعادة تحميل الصفحة لتطبيق التحديث
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-20 left-4 right-4 z-[300] mx-auto max-w-sm"
          dir="rtl"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-lg">
            <RefreshCw size={20} className="shrink-0 text-primary" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                تحديث متاح
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                إصدار جديد من التطبيق جاهز
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={handleUpdate}
                className="h-8 text-xs"
              >
                تحديث الآن
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleDismiss}
                className="h-8 w-8"
                aria-label="إغلاق الإشعار"
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
