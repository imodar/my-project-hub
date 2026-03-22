import { Check, Plus, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTaskLists } from "@/hooks/useTaskLists";

const DailyTasks = () => {
  const navigate = useNavigate();
  const { taskLists, isLoading } = useTaskLists();

  // Flatten all task items from all lists
  const allTasks = (taskLists || []).flatMap((list) =>
    (list.task_items || []).map((item: any) => ({
      ...item,
      listName: list.name,
    }))
  );

  // Show undone first, limit to 6
  const displayTasks = allTasks
    .sort((a: any, b: any) => Number(a.done) - Number(b.done))
    .slice(0, 6);

  if (isLoading) {
    return (
      <section className="mt-8 px-5 pb-28">
        <h2 className="text-lg font-extrabold text-foreground tracking-tight mb-4">مهام اليوم</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (displayTasks.length === 0) {
    return (
      <section className="mt-8 px-5 pb-28">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-foreground tracking-tight">مهام اليوم</h2>
          <button
            onClick={() => navigate("/tasks")}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary"
          >
            <Plus size={16} />
          </button>
        </div>
        <button
          onClick={() => navigate("/tasks")}
          className="w-full rounded-2xl p-6 text-center transition-transform active:scale-[0.98]"
          style={{ background: "hsla(0,0%,0%,0.02)", border: "1px solid hsla(0,0%,0%,0.06)" }}
        >
          <ClipboardList size={28} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-semibold text-muted-foreground">لا توجد مهام حالياً</p>
          <p className="text-xs text-muted-foreground/70 mt-1">اضغط لإضافة مهمة جديدة</p>
        </button>
      </section>
    );
  }

  const tagColors = [
    { bg: "hsl(145 40% 93%)", text: "hsl(145 45% 30%)" },
    { bg: "hsl(185 60% 92%)", text: "hsl(185 60% 30%)" },
    { bg: "hsl(270 50% 93%)", text: "hsl(270 50% 35%)" },
    { bg: "hsl(215 80% 93%)", text: "hsl(215 70% 40%)" },
  ];

  return (
    <section className="mt-8 px-5 pb-28">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-foreground tracking-tight">مهام اليوم</h2>
        <button
          onClick={() => navigate("/tasks")}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="space-y-3">
        {displayTasks.map((task: any, i: number) => {
          const tc = tagColors[i % tagColors.length];
          return (
            <div
              key={task.id}
              className={`bg-card rounded-2xl p-4 shadow-sm flex items-start gap-4 transition-transform active:scale-[0.98] ${
                task.done ? "opacity-60" : ""
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center ${
                  task.done ? "bg-primary" : "border-2 border-primary"
                }`}
              >
                {task.done && <Check size={14} className="text-primary-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className={`font-bold text-sm ${task.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {task.name}
                  </h3>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mr-2"
                    style={{ background: tc.bg, color: tc.text }}
                  >
                    {task.listName}
                  </span>
                </div>
                {task.note && <p className="text-xs text-muted-foreground mt-1">{task.note}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default DailyTasks;
