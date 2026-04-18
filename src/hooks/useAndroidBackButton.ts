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

    // منع زر Backspace في لوحة المفاتيح الفيزيائية من إثارة "رجوع"
    // عندما يكون التركيز خارج حقل إدخال (يحدث في بعض WebViews القديمة على الأندرويد).
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace") return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable;
      if (!isEditable) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      cleanup?.();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [navigate]);
}
