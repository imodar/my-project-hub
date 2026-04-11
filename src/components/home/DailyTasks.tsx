import React from "react";
import { Check, Plus, ClipboardList } from "lucide-react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { useTaskLists } from "@/hooks/useTaskLists";
import { useLanguage } from "@/contexts/LanguageContext";

interface TaskRow {
  id: string;
  name?: string;
  done?: boolean;
  note?: string | null;
  listName?: string;
  [key: string]: unknown;
}

const DailyTasks = React.forwardRef<HTMLElement>((_props, ref) => {
  const navigate = useAppNavigate();
  const { lists: taskLists, isLoading } = useTaskLists();
  const { t } = useLanguage();

  const allTasks = (taskLists || []).flatMap((list) =>
    (list.task_items || []).map((item: TaskRow) => ({
      ...item,
      listName: list.name,
    }))
  );

  const displayTasks = allTasks
    .sort((a: TaskRow, b: TaskRow) => Number(a.done) - Number(b.done))
    .slice(0, 6);

  if (isLoading) {
    return (
      <section ref={ref} className="mt-8 px-5 pb-28">
        <h2 className="text-lg font-extrabold text-foreground tracking-tight mb-4">{t.dailyTasks.title}</h2>
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
      <section ref={ref} className="mt-8 px-5 pb-28">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-foreground tracking-tight">{t.dailyTasks.title}</h2>
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
          <p className="text-sm font-semibold text-muted-foreground">{t.dailyTasks.noTasks}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">{t.dailyTasks.addTask}</p>
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
    <section ref={ref} className="mt-8 px-5 pb-28">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-foreground tracking-tight">{t.dailyTasks.title}</h2>
        <button
          onClick={() => navigate("/tasks")}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="space-y-3">
        {displayTasks.map((task: TaskRow, i: number) => {
          const tc = tagColors[i % tagColors.length];
          return (
            <div
              key={task.id}
              className={`bg-card rounded-2xl p-4 shadow-sm flex items-center gap-4 transition-transform active:scale-[0.98] ${
                task.done ? "opacity-60" : ""
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center ${
                  task.done ? "bg-primary" : "border-2 border-primary"
                }`}
              >
                {task.done && <Check size={14} className="text-primary-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className={`font-bold text-sm break-words overflow-hidden ${task.done ? "line-through text-muted-foreground" : "text-foreground"}`} style={{ overflowWrap: "anywhere" }}>
                    {task.name}
                  </h3>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ms-2"
                    style={{ background: tc.bg, color: tc.text }}
                  >
                    {task.listName}
                  </span>
                </div>
                {task.note && <p className="text-xs text-muted-foreground mt-1">{String(task.note)}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});

DailyTasks.displayName = "DailyTasks";

export default DailyTasks;
