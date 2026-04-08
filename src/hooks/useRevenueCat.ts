import { useEffect, useRef, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { appToast } from "@/lib/toast";

let rcInitialized = false;

async function getRevenueCatKey(): Promise<string | null> {
  try {
    const platform = Capacitor.getPlatform();
    const settingKey = platform === "ios" ? "revenuecat_ios_key" : "revenuecat_android_key";
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", settingKey)
      .maybeSingle();
    const key = data?.value;
    if (typeof key === "string" && key.length > 0) return key;
    return null;
  } catch {
    return null;
  }
}

export function useRevenueCat() {
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (!user || initRef.current || !Capacitor.isNativePlatform()) return;
    initRef.current = true;

    (async () => {
      try {
        const apiKey = await getRevenueCatKey();
        if (!apiKey) return;

        const { Purchases } = await import("@revenuecat/purchases-capacitor");
        await Purchases.configure({ apiKey, appUserID: user.id });
        rcInitialized = true;
        setIsReady(true);
      } catch (err) {
        console.warn("RevenueCat init failed:", err);
      }
    })();
  }, [user?.id]);

  // Fetch available offerings (packages) from RevenueCat
  const getOfferings = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !rcInitialized) return null;
    try {
      const { Purchases } = await import("@revenuecat/purchases-capacitor");
      const result = await (Purchases as any).getOfferings();
      return (result as any).offerings?.current ?? result.current ?? null;
    } catch {
      return null;
    }
  }, []);

  // Purchase the yearly family package
  const purchaseYearly = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
      appToast.info("متاح على الهاتف", "الشراء متاح فقط عبر تطبيق الهاتف");
      return false;
    }
    if (!rcInitialized) {
      appToast.error("خطأ", "متجر المشتريات غير جاهز، حاول مجدداً");
      return false;
    }

    setIsPurchasing(true);
    try {
      const { Purchases } = await import("@revenuecat/purchases-capacitor");
      const offerings = await Purchases.getOfferings();
      const pkg = offerings?.offerings?.current?.availablePackages?.[0];
      if (!pkg) {
        appToast.error("خطأ", "لا توجد باقات متاحة حالياً");
        return false;
      }
      await Purchases.purchasePackage({ aPackage: pkg });
      // After purchase: RevenueCat webhook updates Supabase automatically
      appToast.success("تم الاشتراك! 🎉", "يتم تفعيل اشتراكك الآن...");
      return true;
    } catch (err: any) {
      // User cancelled — no error toast needed
      if (!err?.message?.includes("cancel")) {
        appToast.error("فشل الشراء", err?.message || "حاول مرة أخرى");
      }
      return false;
    } finally {
      setIsPurchasing(false);
    }
  }, []);

  // Restore purchases (for reinstalls)
  const restorePurchases = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !rcInitialized) return;
    try {
      const { Purchases } = await import("@revenuecat/purchases-capacitor");
      await Purchases.restorePurchases();
      appToast.success("تم الاستعادة", "تم التحقق من مشترياتك السابقة");
    } catch (err: any) {
      appToast.error("فشل الاستعادة", err?.message || "حاول مرة أخرى");
    }
  }, []);

  // Open Google Play / App Store subscription management (cancel, etc.)
  const manageSubscriptions = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !rcInitialized) {
      // Fallback: open Google Play subscriptions page
      window.open("https://play.google.com/store/account/subscriptions", "_blank");
      return;
    }
    try {
      const { Purchases } = await import("@revenuecat/purchases-capacitor");
      await (Purchases as any).showManageSubscriptions();
    } catch {
      window.open("https://play.google.com/store/account/subscriptions", "_blank");
    }
  }, []);

  return {
    isReady,
    isPurchasing,
    purchaseYearly,
    restorePurchases,
    manageSubscriptions,
    getOfferings,
  };
}
