import { BookOpen, Heart, Hand } from "lucide-react";

const actions = [
  { icon: BookOpen, label: "القرآن", color: "hsl(145, 40%, 45%)" },
  { icon: Heart, label: "الأذكار", color: "hsl(200, 50%, 55%)" },
  { icon: Hand, label: "المسبحة", color: "hsl(43, 55%, 54%)" },
];

const QuickActions = () => {
  return (
    <div className="flex items-center justify-center gap-4 px-5 -mt-5 relative z-20">
      {actions.map((action) => (
        <button
          key={action.label}
          className="flex flex-col items-center gap-2 px-5 py-4 rounded-2xl transition-transform active:scale-95 flex-1"
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
