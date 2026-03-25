import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart, Calendar, HandCoins, Wallet,
  Image, Plane, FileText, ListChecks,
  FolderLock, TreePine, MapPin, Heart, Scale, ScrollText, Camera, BookHeart, Car, Syringe, Pill
} from "lucide-react";
import { useUserRole } from "@/contexts/UserRoleContext";

const features = [
  { icon: ShoppingCart, label: "السوق", bg: "hsl(30 100% 93%)", color: "hsl(30 80% 45%)", route: "/market" },
  { icon: Wallet, label: "الميزانية", bg: "hsl(145 40% 93%)", color: "hsl(145 45% 35%)", route: "/budget" },
  { icon: Calendar, label: "التقويم", bg: "hsl(215 80% 93%)", color: "hsl(215 70% 50%)", route: "/calendar" },
  { icon: ListChecks, label: "المهام", bg: "hsl(270 50% 93%)", color: "hsl(270 50% 50%)", route: "/tasks" },
  { icon: Plane, label: "الرحلات", bg: "hsl(185 60% 92%)", color: "hsl(185 60% 38%)", route: "/trips" },
  { icon: FolderLock, label: "الوثائق", bg: "hsl(43 60% 92%)", color: "hsl(43 65% 40%)", route: "/documents" },
  { icon: MapPin, label: "الأماكن", bg: "hsl(350 55% 93%)", color: "hsl(350 55% 50%)", route: "/places" },
  { icon: HandCoins, label: "الديون", bg: "hsl(0 50% 93%)", color: "hsl(0 60% 50%)", route: "/debts" },
  { icon: Camera, label: "الألبومات", bg: "hsl(290 45% 92%)", color: "hsl(290 50% 45%)", route: "/albums" },
  { icon: Scale, label: "الزكاة", bg: "hsl(160 45% 92%)", color: "hsl(160 50% 35%)", route: "/zakat" },
  { icon: ScrollText, label: "الوصية", bg: "hsl(200 45% 92%)", color: "hsl(200 50% 35%)", route: "/will" },
  { icon: Car, label: "المركبات", bg: "hsl(220 50% 93%)", color: "hsl(220 55% 45%)", route: "/vehicle" },
  { icon: BookHeart, label: "عبادات الأطفال", bg: "hsl(320 50% 93%)", color: "hsl(320 55% 45%)", route: "/kids-worship" },
  { icon: Syringe, label: "اللقاحات", bg: "hsl(170 45% 92%)", color: "hsl(170 50% 35%)", route: "/vaccinations" },
  { icon: Pill, label: "الأدوية", bg: "hsl(0 55% 93%)", color: "hsl(0 60% 45%)", route: "/medications" },
];

const FeatureGrid = React.forwardRef<HTMLElement>((_props, ref) => {
  const navigate = useNavigate();
  const { featureAccess } = useUserRole();

  const visibleFeatures = features.filter(
    (f) => !featureAccess.hidden.includes(f.route)
  );

  return (
    <section ref={ref} className="px-5 mt-8">
      <div className="mb-5">
        <h2 className="text-lg font-extrabold text-foreground tracking-tight">
          {featureAccess.isStaff ? "الأدوات" : "أدوات العائلة"}
        </h2>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {visibleFeatures.map((feature) => {
          const isDisabled = featureAccess.disabled.includes(feature.route);
          return (
            <button
              key={feature.label}
              onClick={() => !isDisabled && feature.route && navigate(feature.route)}
              className={`flex flex-col items-center gap-2 transition-transform active:scale-95 ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: feature.bg }}
              >
                <feature.icon size={24} style={{ color: feature.color }} />
              </div>
              <span className="text-[11px] font-bold text-muted-foreground">{feature.label}</span>
              {isDisabled && (
                <span className="text-[9px] text-muted-foreground -mt-1">غير متاح</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
});

FeatureGrid.displayName = "FeatureGrid";

export default FeatureGrid;
