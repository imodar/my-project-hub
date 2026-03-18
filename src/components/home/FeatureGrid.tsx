import { useNavigate } from "react-router-dom";
import {
  ShoppingCart, Calendar, HandCoins, Wallet,
  Image, Plane, FileText, ListChecks,
  FolderLock, TreePine, MapPin, Heart
} from "lucide-react";

const features = [
  { icon: ShoppingCart, label: "السوق", color: "hsl(145, 40%, 42%)", bg: "hsl(145, 40%, 95%)", badge: 3, route: "/market" },
  { icon: Calendar, label: "التقويم", color: "hsl(220, 60%, 50%)", bg: "hsl(220, 60%, 95%)", route: "/calendar" },
  { icon: HandCoins, label: "الديون", color: "hsl(0, 60%, 55%)", bg: "hsl(0, 60%, 95%)", badge: 2, route: "/debts" },
  { icon: Wallet, label: "الميزانية", color: "hsl(270, 40%, 50%)", bg: "hsl(270, 40%, 95%)" },
  { icon: Image, label: "الألبوم", color: "hsl(330, 50%, 55%)", bg: "hsl(330, 50%, 95%)" },
  { icon: Plane, label: "الرحلات", color: "hsl(200, 60%, 45%)", bg: "hsl(200, 60%, 95%)" },
  { icon: FileText, label: "الوصية", color: "hsl(30, 60%, 45%)", bg: "hsl(30, 60%, 95%)" },
  { icon: ListChecks, label: "المهام", color: "hsl(160, 50%, 40%)", bg: "hsl(160, 50%, 95%)", badge: 5 },
  { icon: FolderLock, label: "الوثائق", color: "hsl(45, 60%, 45%)", bg: "hsl(45, 60%, 95%)" },
  { icon: TreePine, label: "شجرتي", color: "hsl(120, 35%, 40%)", bg: "hsl(120, 35%, 95%)" },
  { icon: MapPin, label: "الأماكن", color: "hsl(350, 55%, 50%)", bg: "hsl(350, 55%, 95%)" },
  { icon: Heart, label: "الزكاة", color: "hsl(43, 55%, 48%)", bg: "hsl(43, 55%, 95%)" },
];

const FeatureGrid = () => {
  const navigate = useNavigate();
  return (
    <div className="px-5 mt-8">
      <h3 className="text-base font-bold text-foreground mb-4">الأدوات</h3>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
        {features.map((feature) => (
          <button
            key={feature.label}
            onClick={() => feature.route && navigate(feature.route)}
            className="relative flex flex-col items-center gap-2 py-4 rounded-2xl transition-transform active:scale-95"
            style={{
              background: feature.bg,
            }}
          >
            {feature.badge && (
              <span className="absolute top-2 left-2 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: "hsl(0, 70%, 55%)" }}>
                {feature.badge}
              </span>
            )}
            <feature.icon size={24} style={{ color: feature.color }} />
            <span className="text-[11px] font-semibold text-foreground/80">{feature.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default FeatureGrid;
