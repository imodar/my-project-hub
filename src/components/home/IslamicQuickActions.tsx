import { BookOpen, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIslamicMode } from "@/contexts/IslamicModeContext";

// Tasbih bead icon
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
  { icon: Heart, label: "الأذكار", path: "/" },
];

// Islamic geometric pattern as SVG
const IslamicPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="islamic-geo" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        {/* 8-pointed star pattern */}
        <path d="M20 0 L24 8 L32 4 L28 12 L40 12 L32 16 L40 20 L32 20 L40 28 L28 24 L32 32 L24 28 L20 40 L16 28 L8 32 L12 24 L0 28 L8 20 L0 16 L8 12 L0 8 L12 12 L8 4 L16 8 Z"
          fill="none" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="20" cy="20" r="3" fill="none" stroke="currentColor" strokeWidth="0.4" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#islamic-geo)" />
  </svg>
);

const IslamicQuickActions = () => {
  const navigate = useNavigate();
  const { islamicMode } = useIslamicMode();

  if (!islamicMode) return null;

  return (
    <div className="px-5 mt-4">
      <div
        className="relative rounded-2xl p-4 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, hsl(150 30% 18%), hsl(160 25% 22%))",
        }}
      >
        {/* Islamic pattern overlay */}
        <div className="absolute inset-0 text-white">
          <IslamicPattern />
        </div>

        {/* Content */}
        <div className="relative z-10 flex items-center justify-around">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center gap-2 px-3 py-2 rounded-xl transition-transform active:scale-95"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "hsla(0,0%,100%,0.12)" }}
              >
                {typeof action.icon === "function" && action.icon === TasbihIcon ? (
                  <TasbihIcon size={24} className="text-emerald-300" />
                ) : (
                  <action.icon size={24} className="text-emerald-300" />
                )}
              </div>
              <span className="text-xs font-semibold text-white">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IslamicQuickActions;
