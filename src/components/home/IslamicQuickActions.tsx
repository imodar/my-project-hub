import React from "react";
import { BookOpen, Heart, Bell } from "lucide-react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { useIslamicMode } from "@/contexts/IslamicModeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import islamicPattern from "@/assets/islamic-pattern.webp";

const TasbihIcon = React.forwardRef<SVGSVGElement, { size?: number; className?: string }>(
  ({ size = 22, className = "" }, ref) => (
    <svg ref={ref} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="6" cy="8" r="2.2" />
      <circle cx="18" cy="8" r="2.2" />
      <circle cx="4.5" cy="13.5" r="2" />
      <circle cx="19.5" cy="13.5" r="2" />
      <circle cx="7" cy="18.5" r="2" />
      <circle cx="17" cy="18.5" r="2" />
      <circle cx="12" cy="20.5" r="2.2" />
    </svg>
  )
);
TasbihIcon.displayName = "TasbihIcon";

const IslamicQuickActions = React.forwardRef<HTMLDivElement>((_props, ref) => {
  const navigate = useAppNavigate();
  const { islamicMode } = useIslamicMode();
  const { t } = useLanguage();

  const actions = [
    { icon: BookOpen, label: t.islamic.quran, path: "/" },
    { icon: TasbihIcon, label: t.islamic.tasbih, path: "/tasbih" },
    { icon: Heart, label: t.islamic.athkar, path: "/athkar" },
    { icon: Bell, label: t.islamic.reminders, path: "/islamic-reminders" },
  ];

  if (!islamicMode) return <div ref={ref} style={{ display: "none" }} />;

  return (
    <div ref={ref} className="px-5 mt-4">
      <div className="relative rounded-2xl p-4 overflow-hidden">
        <img
          src={islamicPattern}
          alt=""
          className="absolute inset-0 w-full h-full object-contain opacity-[0.08]"
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-center justify-around">
          {actions.map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center gap-2 px-3 py-2 rounded-xl transition-transform active:scale-95"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
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
});

IslamicQuickActions.displayName = "IslamicQuickActions";

export default IslamicQuickActions;
