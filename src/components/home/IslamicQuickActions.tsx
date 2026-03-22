import { BookOpen, Heart, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIslamicMode } from "@/contexts/IslamicModeContext";
import islamicPattern from "@/assets/islamic-pattern.png";

const TasbihIcon = ({ size = 22, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="5" r="2.5" />
    <circle cx="6" cy="8" r="2.2" />
    <circle cx="18" cy="8" r="2.2" />
    <circle cx="4.5" cy="13.5" r="2" />
    <circle cx="19.5" cy="13.5" r="2" />
    <circle cx="7" cy="18.5" r="2" />
    <circle cx="17" cy="18.5" r="2" />
    <circle cx="12" cy="20.5" r="2.2" />
  </svg>
);

const actions = [
  { icon: BookOpen, label: "القرآن", path: "/" },
  { icon: TasbihIcon, label: "المسبحة", path: "/tasbih" },
  { icon: Heart, label: "الأذكار", path: "/athkar" },
];

const IslamicQuickActions = () => {
  const navigate = useNavigate();
  const { islamicMode } = useIslamicMode();

  if (!islamicMode) return null;

  return (
    <div className="px-5 mt-4">
      <div className="relative rounded-2xl p-4 overflow-hidden">
        {/* Pattern background image */}
        <img
          src={islamicPattern}
          alt=""
          className="absolute inset-0 w-full h-full object-contain opacity-[0.08]"
          aria-hidden="true"
        />

        {/* Content */}
        <div className="relative z-10 flex items-center justify-around">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center gap-2 px-3 py-2 rounded-xl transition-transform active:scale-95"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10"
              >
                {typeof action.icon === "function" && action.icon === TasbihIcon ? (
                  <TasbihIcon size={24} className="text-primary" />
                ) : (
                  <action.icon size={24} className="text-primary" />
                )}
              </div>
              <span className="text-xs font-semibold text-foreground">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IslamicQuickActions;
