import { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { CheckCircle, Crown, Users, MessageCircle, FileText, Star } from "lucide-react";
import { useRevenueCat } from "@/hooks/useRevenueCat";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";

interface UpgradePromptSheetProps {
  open: boolean;
  onClose: () => void;
  feature?: string;
  /** Called after successful subscription */
  onSuccess?: () => void;
}

const FEATURES = [
  { icon: <Users size={16} />, text: "أفراد عائلة غير محدودين" },
  { icon: <MessageCircle size={16} />, text: "محادثة عائلية غير محدودة" },
  { icon: <FileText size={16} />, text: "الوصية والزكاة والتصدير" },
  { icon: <Star size={16} />, text: "متابعة عبادة الأطفال" },
  { icon: <CheckCircle size={16} />, text: "كل الميزات مفتوحة بالكامل" },
];

export default function UpgradePromptSheet({ open, onClose, feature, onSuccess }: UpgradePromptSheetProps) {
  const { purchaseYearly, restorePurchases, isPurchasing } = useRevenueCat();
  const { refreshSubscription } = useSubscription();
  const [price, setPrice] = useState<string>("49");

  // Fetch configurable price from system_settings
  useEffect(() => {
    if (!open) return;
    supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["subscription_price_sar"])
      .then(({ data }) => {
        if (!data) return;
        for (const row of data) {
          if (row.key === "subscription_price_sar" && row.value) setPrice(String(row.value));
        }
      });
  }, [open]);

  const handleSubscribe = async () => {
    const success = await purchaseYearly();
    if (success) {
      // Give webhook a moment to update Supabase, then refresh
      setTimeout(() => {
        refreshSubscription();
        onSuccess?.();
        onClose();
      }, 2000);
    }
  };

  const handleRestore = async () => {
    await restorePurchases();
    setTimeout(() => {
      refreshSubscription();
    }, 1500);
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[90vh]" dir="rtl">
        <DrawerHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="bg-yellow-100 p-3 rounded-full">
              <Crown size={28} className="text-yellow-600" />
            </div>
          </div>
          <DrawerTitle className="text-xl font-bold">اشتراك عائلة كامل</DrawerTitle>
          <p className="text-muted-foreground text-sm mt-1">
            {feature === "add_member"
              ? "لإضافة أفراد لعائلتك، يلزمك الاشتراك"
              : "لفتح هذه الميزة، يلزمك الاشتراك"}
          </p>
        </DrawerHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* Price card */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold text-primary">
              {price} <span className="text-lg font-normal text-muted-foreground">ريال</span>
            </p>
            <p className="text-muted-foreground text-sm mt-0.5">سنوياً — أقل من 4 ريال بالشهر</p>
            <p className="text-xs text-muted-foreground mt-1">يتجدد تلقائياً • يمكن الإلغاء في أي وقت</p>
          </div>

          {/* Features list */}
          <div className="space-y-2.5">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-primary">{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>

          {/* Subscribe button */}
          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={handleSubscribe}
            disabled={isPurchasing}
          >
            {isPurchasing ? "جاري المعالجة..." : `اشترك الآن — ${price} ريال/سنة`}
          </Button>

          {/* Restore */}
          <button
            className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
            onClick={handleRestore}
            disabled={isPurchasing}
          >
            استعادة مشترياتي السابقة
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
