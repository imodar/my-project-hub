import { BookOpen, Heart, Hand, ShoppingCart, Calendar, HandCoins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIslamicMode } from "@/contexts/IslamicModeContext";

const islamicActions = [
  { icon: BookOpen, label: "القرآن", color: "hsl(145, 40%, 45%)", path: "/" },
  { icon: Heart, label: "الأذكار", color: "hsl(200, 50%, 55%)", path: "/" },
  { icon: Hand, label: "المسبحة", color: "hsl(43, 55%, 54%)", path: "/tasbih" },
];

const generalActions = [
  { icon: ShoppingCart, label: "السوق", color: "hsl(145, 40%, 42%)", path: "/" },
  { icon: Calendar, label: "التقويم", color: "hsl(220, 60%, 50%)", path: "/calendar" },
  { icon: HandCoins, label: "الديون", color: "hsl(0, 60%, 55%)", path: "/debts" },
];

const QuickActions = () => {
  const navigate = useNavigate();
  const { islamicMode } = useIslamicMode();
  const actions = islamicMode ? islamicActions : generalActions;

  return (
    <div className="flex items-center justify-center gap-4 px-5 -mt-5 relative z-20">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => navigate(action.path)}
          className="flex flex-col items-center gap-2 px-5 py-4 rounded-2xl transition-transform active:scale-95 flex-1 sm:max-w-[200px]"
          style={{
            background: "hsla(0,0%,100%,0.95)",
            boxShadow: "0 4px 20px hsla(0,0%,0%,0.08)",
          }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{
            background: `${action.color}15`,
          }}>
            <action.icon size={22} style={{ color: action.color }} />
          </div>
          <span className="text-xs font-semibold text-foreground">{action.label}</span>
        </button>
      ))}
    </div>
  );
};

export default QuickActions;
