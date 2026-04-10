import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * يطلب إذن الإشعارات ويحفظ FCM token في Supabase.
 * يستجيب للإشعارات الواردة (SOS وغيرها) حتى وإن كان التطبيق في الخلفية.
 *
 * ⚠️ يتطلب:
 *  1. ملف android/app/google-services.json (من Firebase Console)
 *  2. تسجيل @capacitor/push-notifications في capacitor.config.ts إذا لزم
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!user || registeredRef.current) return;
    registeredRef.current = true;

    (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        // طلب الإذن
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== "granted") return;

        await PushNotifications.register();

        // استقبال الـ token وحفظه في Supabase
        await PushNotifications.addListener("registration", async ({ value: token }) => {
          try {
            await supabase.functions.invoke("auth-management", {
              body: { action: "save-fcm-token", fcm_token: token },
            });
          } catch {
            // فشل حفظ التوكن — يُعاد عند الفتح التالي
          }
        });

        // استقبال إشعار SOS عندما التطبيق مفتوح
        await PushNotifications.addListener("pushNotificationReceived", (notification) => {
          const data = notification.data || {};
          if (data.type === "sos_alert") {
            // إطلاق حدث مخصص ليستجيب الـ UI
            window.dispatchEvent(new CustomEvent("sos-incoming", { detail: data }));
          }
        });

        // ضغط المستخدم على الإشعار من خارج التطبيق
        await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const data = action.notification.data || {};
          if (data.type === "sos_alert") {
            window.dispatchEvent(new CustomEvent("sos-incoming", { detail: data }));
          }
        });
      } catch {
        // البيئة لا تدعم Capacitor PushNotifications (web) — تجاهل
      }
    })();
  }, [user]);
}
