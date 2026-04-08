import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Crown, CheckCircle, AlertTriangle, Calendar, RefreshCw, ExternalLink } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useRevenueCat } from "@/hooks/useRevenueCat";
import UpgradePromptSheet from "@/components/UpgradePromptSheet";
import { Button } from "@/components/ui/button";

const Subscription = () => {
  const navigate = useNavigate();
  const { isSubscribed, plan, expiresAt, daysUntilExpiry, isGracePeriod, isLoading, refreshSubscription } = useSubscription();
  const { manageSubscriptions } = useRevenueCat();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const planLabel = plan === "free" ? "مجاني" : plan === "yearly" ? "سنوي" : plan;

  return (
    <div
      className="min-h-screen flex flex-col pb-20 bg-background"
      style={{ paddingTop: "max(env(safe-area-inset-top), 0px)" }}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="w-16" />
        <h1 className="text-lg font-bold text-foreground">إدارة الاشتراك</h1>
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-1 px-3 py-2 rounded-2xl text-sm font-semibold text-foreground bg-muted"
        >
          رجوع
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex-1 px-4 space-y-5">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Status card */}
            <div
              className="rounded-2xl p-5 text-center"
              style={{
                background: isSubscribed
                  ? "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.15))"
                  : "hsl(var(--muted))",
                border: isSubscribed
                  ? "1px solid hsl(var(--primary) / 0.2)"
                  : "1px solid hsl(var(--border))",
              }}
            >
              <div className="flex justify-center mb-3">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{
                    background: isSubscribed ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted-foreground) / 0.1)",
                  }}
                >
                  {isSubscribed ? (
                    <Crown size={28} className="text-primary" />
                  ) : (
                    <Crown size={28} className="text-muted-foreground" />
                  )}
                </div>
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">
                {isSubscribed ? "مشترك ✅" : "غير مشترك"}
              </h2>
              <p className="text-sm text-muted-foreground">
                الخطة: <span className="font-semibold text-foreground">{planLabel}</span>
              </p>
            </div>

            {/* Details */}
            {isSubscribed && (
              <div className="rounded-2xl bg-card p-4 space-y-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10">
                    <Calendar size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-sm font-semibold text-foreground">تاريخ التجديد</p>
                    <p className="text-xs text-muted-foreground">{formatDate(expiresAt)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10">
                    {isGracePeriod ? (
                      <AlertTriangle size={18} className="text-yellow-500" />
                    ) : (
                      <CheckCircle size={18} className="text-green-500" />
                    )}
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-sm font-semibold text-foreground">الحالة</p>
                    <p className="text-xs text-muted-foreground">
                      {isGracePeriod
                        ? "فترة سماح — يرجى تجديد الاشتراك"
                        : daysUntilExpiry !== null
                          ? `متبقي ${daysUntilExpiry} يوم`
                          : "نشط"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Grace period warning */}
            {isGracePeriod && (
              <div
                className="rounded-2xl p-4 flex items-start gap-3"
                style={{
                  background: "hsl(43, 55%, 54%, 0.1)",
                  border: "1px solid hsl(43, 55%, 54%, 0.2)",
                }}
              >
                <AlertTriangle size={18} style={{ color: "hsl(43, 55%, 48%)" }} className="shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/80 leading-relaxed">
                  اشتراكك منتهي وأنت في فترة السماح. بعض الميزات قد تتوقف قريباً. يرجى تجديد الاشتراك.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              {isSubscribed ? (
                <>
                  <Button
                    onClick={() => manageSubscriptions()}
                    variant="outline"
                    className="w-full h-12 text-sm font-semibold gap-2"
                  >
                    <ExternalLink size={16} />
                    إدارة الاشتراك من المتجر
                  </Button>
                  <Button
                    onClick={() => refreshSubscription()}
                    variant="ghost"
                    className="w-full h-10 text-sm gap-2"
                  >
                    <RefreshCw size={16} />
                    تحديث حالة الاشتراك
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setShowUpgrade(true)}
                  className="w-full h-12 text-base font-semibold gap-2"
                >
                  <Crown size={18} />
                  اشترك الآن
                </Button>
              )}
            </div>

            {/* Info */}
            <p className="text-xs text-center text-muted-foreground leading-relaxed px-4">
              الاشتراك يتجدد تلقائياً عبر متجر التطبيقات. يمكنك إلغاؤه في أي وقت من إعدادات المتجر.
            </p>
          </>
        )}
      </div>

      <UpgradePromptSheet
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onSuccess={() => setShowUpgrade(false)}
      />
    </div>
  );
};

export default Subscription;
