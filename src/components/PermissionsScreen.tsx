import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, MapPin, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface PermissionsScreenProps {
  onComplete: () => void;
}

const PermissionsScreen = ({ onComplete }: PermissionsScreenProps) => {
  const { isRTL } = useLanguage();
  const [notifGranted, setNotifGranted] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [requesting, setRequesting] = useState<"notif" | "location" | null>(null);

  const requestNotifications = async () => {
    setRequesting("notif");
    try {
      // Try Capacitor push notifications first
      const { PushNotifications } = await import("@capacitor/push-notifications").catch(() => ({ PushNotifications: null }));
      if (PushNotifications) {
        const result = await PushNotifications.requestPermissions();
        setNotifGranted(result.receive === "granted");
      } else if ("Notification" in window) {
        const result = await Notification.requestPermission();
        setNotifGranted(result === "granted");
      }
    } catch {
      // Silently fail
    } finally {
      setRequesting(null);
    }
  };

  const requestLocation = async () => {
    setRequesting("location");
    try {
      const { Geolocation } = await import("@capacitor/geolocation").catch(() => ({ Geolocation: null }));
      if (Geolocation) {
        const result = await Geolocation.requestPermissions();
        setLocationGranted(result.location === "granted");
      } else {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => { setLocationGranted(true); resolve(); },
            () => { resolve(); }
          );
        });
      }
    } catch {
      // Silently fail
    } finally {
      setRequesting(null);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("permissions_requested", "1");
    onComplete();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex flex-col bg-background"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-sm mx-auto text-center gap-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <span className="text-5xl">🔔</span>
          <h2 className="text-xl font-bold text-foreground mt-4">
            {isRTL ? "صلاحيات التطبيق" : "App Permissions"}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {isRTL
              ? "للحصول على تجربة كاملة، نحتاج إلى بعض الصلاحيات"
              : "For the full experience, we need some permissions"}
          </p>
        </motion.div>

        <div className="w-full space-y-4">
          {/* Notifications */}
          <motion.div
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Bell size={22} className="text-primary" />
            </div>
            <div className="flex-1 text-start">
              <p className="text-sm font-bold text-foreground">
                {isRTL ? "الإشعارات" : "Notifications"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isRTL ? "تنبيهات الأدوية والمواعيد" : "Medication & event reminders"}
              </p>
            </div>
            {notifGranted ? (
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check size={18} className="text-green-600" />
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={requestNotifications}
                disabled={requesting === "notif"}
                className="shrink-0"
              >
                {isRTL ? "تفعيل" : "Enable"}
              </Button>
            )}
          </motion.div>

          {/* Location */}
          <motion.div
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border"
          >
            <div className="w-12 h-12 rounded-xl bg-accent/30 flex items-center justify-center shrink-0">
              <MapPin size={22} className="text-accent-foreground" />
            </div>
            <div className="flex-1 text-start">
              <p className="text-sm font-bold text-foreground">
                {isRTL ? "الموقع الجغرافي" : "Location"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isRTL ? "مشاركة الموقع مع العائلة" : "Share location with family"}
              </p>
            </div>
            {locationGranted ? (
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check size={18} className="text-green-600" />
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={requestLocation}
                disabled={requesting === "location"}
                className="shrink-0"
              >
                {isRTL ? "تفعيل" : "Enable"}
              </Button>
            )}
          </motion.div>
        </div>

        <Button
          onClick={handleComplete}
          className="w-full h-14 rounded-xl text-base font-semibold gap-2"
        >
          {isRTL ? "متابعة" : "Continue"}
          <ArrowLeft size={16} className={isRTL ? "" : "rotate-180"} />
        </Button>

        <button
          onClick={handleComplete}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isRTL ? "تخطي" : "Skip"}
        </button>
      </div>
    </motion.div>
  );
};

export default PermissionsScreen;
