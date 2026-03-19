import { Check, Plus } from "lucide-react";

const tasks = [
  {
    name: "شراء تمر وحليب",
    note: "للإفطار الليلة",
    tag: "المطبخ",
    tagColor: "hsl(145 40% 93%)",
    tagTextColor: "hsl(145 45% 30%)",
    done: false,
  },
  {
    name: "استلام الغسيل",
    note: "قبل الساعة ٧ مساءً",
    tag: "مهمة",
    tagColor: "hsl(185 60% 92%)",
    tagTextColor: "hsl(185 60% 30%)",
    done: false,
  },
  {
    name: "ترتيب الغرفة",
    note: "سارة - قبل المغرب",
    tag: "المنزل",
    tagColor: "hsl(270 50% 93%)",
    tagTextColor: "hsl(270 50% 35%)",
    done: true,
  },
  {
    name: "حل الواجب",
    note: "أحمد - رياضيات",
    tag: "دراسة",
    tagColor: "hsl(215 80% 93%)",
    tagTextColor: "hsl(215 70% 40%)",
    done: false,
  },
];

const DailyTasks = () => {
  return (
    <section className="mt-8 px-5 pb-28">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-foreground tracking-tight">مهام اليوم</h2>
        <button className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary">
          <Plus size={16} />
        </button>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.name}
            className={`bg-card border border-border/50 rounded-2xl p-4 shadow-sm flex items-start gap-4 transition-transform active:scale-[0.98] ${
              task.done ? "opacity-60" : ""
            }`}
          >
            {/* Checkbox */}
            <div
              className={`w-6 h-6 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center ${
                task.done ? "bg-primary" : "border-2 border-primary"
              }`}
            >
              {task.done && <Check size={14} className="text-primary-foreground" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h3 className={`font-bold text-sm ${task.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {task.name}
                </h3>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mr-2"
                  style={{ background: task.tagColor, color: task.tagTextColor }}
                >
                  {task.tag}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{task.note}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default DailyTasks;
