import { useNavigate } from "react-router-dom";
import {
  ShoppingCart, Calendar, HandCoins, Wallet,
  Image, Plane, FileText, ListChecks,
  FolderLock, TreePine, MapPin, Heart, Scale, ScrollText
} from "lucide-react";

const features = [
  { icon: ShoppingCart, label: "السوق", bg: "hsl(30 100% 93%)", color: "hsl(30 80% 45%)", route: "/market" },
  { icon: Wallet, label: "الميزانية", bg: "hsl(145 40% 93%)", color: "hsl(145 45% 35%)", route: "/budget" },
  { icon: Calendar, label: "التقويم", bg: "hsl(215 80% 93%)", color: "hsl(215 70% 50%)", route: "/calendar" },
  { icon: ListChecks, label: "المهام", bg: "hsl(270 50% 93%)", color: "hsl(270 50% 50%)", route: "/tasks" },
  { icon: Plane, label: "الرحلات", bg: "hsl(185 60% 92%)", color: "hsl(185 60% 38%)" },
  { icon: FolderLock, label: "الوثائق", bg: "hsl(43 60% 92%)", color: "hsl(43 65% 40%)", route: "/documents" },
  { icon: MapPin, label: "الأماكن", bg: "hsl(350 55% 93%)", color: "hsl(350 55% 50%)", route: "/places" },
  { icon: HandCoins, label: "الديون", bg: "hsl(0 50% 93%)", color: "hsl(0 60% 50%)", route: "/debts" },
  { icon: Scale, label: "الزكاة", bg: "hsl(160 45% 92%)", color: "hsl(160 50% 35%)", route: "/zakat" },
  { icon: ScrollText, label: "الوصية", bg: "hsl(200 45% 92%)", color: "hsl(200 50% 35%)", route: "/will" },
];

const FeatureGrid = () => {
  const navigate = useNavigate();
  return (
    <section className="px-5 mt-8">
      <div className="mb-5">
        <h2 className="text-lg font-extrabold text-foreground tracking-tight">أدوات العائلة</h2>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {features.map((feature) => (
          <button
            key={feature.label}
            onClick={() => feature.route && navigate(feature.route)}
            className="flex flex-col items-center gap-2 transition-transform active:scale-95"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: feature.bg }}
            >
              <feature.icon size={24} style={{ color: feature.color }} />
            </div>
            <span className="text-[11px] font-bold text-muted-foreground">{feature.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default FeatureGrid;
