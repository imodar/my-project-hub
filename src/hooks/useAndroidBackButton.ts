import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * يعترض زر الباك الهاردوير على Android ويُحوّله إلى رجوع طبيعي.
 * إذا لم يكن هناك تاريخ للرجوع → يُصغّر التطبيق بدلاً من إغلاقه.
 */
export function useAndroidBackButton() {
  const navigate = useNavigate();

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) {
            navigate(-1);
          } else {
            App.minimizeApp();
          }
        });
        cleanup = () => handle.remove();
      } catch {
        // Web بيئة أو Capacitor غير متوفر — تجاهل
      }
    })();

    return () => { cleanup?.(); };
  }, [navigate]);
}
