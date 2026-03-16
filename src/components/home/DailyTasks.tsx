import { Check, Clock, Star } from "lucide-react";

const tasks = [
  {
    name: "ترتيب الغرفة",
    assignee: "سارة",
    points: 10,
    done: true,
    avatar: "🧕",
  },
  {
    name: "حل الواجب",
    assignee: "أحمد",
    points: 15,
    done: false,
    avatar: "👦",
  },
  {
    name: "قراءة جزء من القرآن",
    assignee: "خالد",
    points: 20,
    done: false,
    overdue: true,
    avatar: "👦",
  },
  {
    name: "صلاة الفجر في وقتها",
    assignee: "الجميع",
    points: 25,
    done: true,
    avatar: "👨‍👩‍👧‍👦",
  },
];

const DailyTasks = () => {
  const completedCount = tasks.filter((t) => t.done).length;

  return (
    <div className="mt-8 px-5 pb-28">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-foreground">مهام اليوم</h3>
        <span className="text-xs text-muted-foreground font-semibold">
          {completedCount}/{tasks.length} مكتملة
        </span>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.name}
            className={`flex items-center gap-3 p-4 rounded-2xl transition-transform active:scale-[0.98] ${
              task.done ? "opacity-70" : ""
            }`}
            style={{
              background: task.overdue
                ? "hsl(0, 60%, 97%)"
                : "hsl(var(--card))",
              boxShadow: "0 2px 12px hsla(0,0%,0%,0.04)",
              border: task.overdue ? "1px solid hsl(0, 50%, 90%)" : "1px solid hsl(var(--border))",
            }}
          >
            {/* Avatar */}
            <span className="text-2xl">{task.avatar}</span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${task.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {task.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-muted-foreground">{task.assignee}</span>
                {task.overdue && (
                  <span className="flex items-center gap-0.5 text-[10px] font-semibold" style={{ color: "hsl(0, 60%, 55%)" }}>
                    <Clock size={10} />
                    متأخرة
                  </span>
                )}
              </div>
            </div>

            {/* Points + Status */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{
                background: "hsl(43, 55%, 95%)",
              }}>
                <Star size={12} style={{ color: "hsl(var(--gold))" }} fill="hsl(var(--gold))" />
                <span className="text-[11px] font-bold" style={{ color: "hsl(43, 50%, 40%)" }}>{task.points}</span>
              </div>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  task.done ? "bg-primary" : "border-2"
                }`}
                style={{
                  borderColor: task.done ? undefined : "hsl(var(--border))",
                }}
              >
                {task.done && <Check size={14} className="text-primary-foreground" />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DailyTasks;
