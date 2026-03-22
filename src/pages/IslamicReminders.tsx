import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff, Moon, Sun, Utensils, Scissors, Calendar } from "lucide-react";

interface ReminderItem {
  id: string;
  title: string;
  subtitle: string;
  frequency: string;
  hadith: string;
  hadithSource: string;
  details?: string;
  icon: string;
  color: string;
  bg: string;
}

const reminders: ReminderItem[] = [
  {
    id: "monday_thursday",
    title: "صيام الاثنين والخميس",
    subtitle: "أسبوعي",
    frequency: "كل اثنين وخميس",
    hadith: "تُعرَض الأعمال يوم الاثنين والخميس، فأحب أن يُعرَض عملي وأنا صائم",
    hadithSource: "رواه الترمذي",
    icon: "🌙",
    color: "hsl(210 70% 45%)",
    bg: "hsl(210 60% 95%)",
  },
  {
    id: "white_days",
    title: "صيام الأيام البيض",
    subtitle: "13 و14 و15 من كل شهر هجري",
    frequency: "شهري",
    hadith: "كان يأمرنا بصيام أيام البِيض ثلاث عشرة وأربع عشرة وخمس عشرة",
    hadithSource: "رواه أبو داود عن أبي ذر",
    details: "«صوم ثلاثة أيام من كل شهر صوم الدهر كله» — رواه البخاري",
    icon: "🌕",
    color: "hsl(45 70% 45%)",
    bg: "hsl(45 60% 94%)",
  },
  {
    id: "shawwal_six",
    title: "صيام ست من شوال",
    subtitle: "خلال شهر شوال بعد رمضان",
    frequency: "سنوي — شوال",
    hadith: "من صام رمضان ثم أتبعه ستاً من شوال كان كصيام الدهر",
    hadithSource: "رواه مسلم",
    details: "التنبيه في رابع يوم من شوال",
    icon: "🌟",
    color: "hsl(160 50% 38%)",
    bg: "hsl(160 45% 94%)",
  },
  {
    id: "ashura",
    title: "صيام عاشوراء",
    subtitle: "9 و10 محرم (ويُستحب إضافة يوم)",
    frequency: "سنوي — محرم",
    hadith: "صيام يوم عاشوراء أحتسب على الله أن يكفّر السنة التي قبله",
    hadithSource: "رواه مسلم",
    details: "التنبيه صباح يوم 8 محرم",
    icon: "📿",
    color: "hsl(280 45% 45%)",
    bg: "hsl(280 40% 95%)",
  },
  {
    id: "arafah",
    title: "صيام يوم عرفة",
    subtitle: "9 ذو الحجة (لغير الحاج)",
    frequency: "سنوي — ذو الحجة",
    hadith: "صيام يوم عرفة أحتسب على الله أن يكفّر السنة التي قبله والسنة التي بعده",
    hadithSource: "رواه مسلم",
    details: "تذكير المستخدم يوم 8 ذي الحجة",
    icon: "🕋",
    color: "hsl(25 65% 42%)",
    bg: "hsl(25 55% 94%)",
  },
  {
    id: "dhul_hijjah_ten",
    title: "صيام العشر الأوائل من ذي الحجة",
    subtitle: "1–8 ذو الحجة",
    frequency: "سنوي — ذو الحجة",
    hadith: "ما من أيام العمل الصالح فيها أحب إلى الله من هذه الأيام العشر",
    hadithSource: "رواه البخاري",
    icon: "🌄",
    color: "hsl(35 70% 42%)",
    bg: "hsl(35 60% 94%)",
  },
  {
    id: "udhiyah",
    title: "الأضحية — وقت الذبح",
    subtitle: "10–13 ذو الحجة (أيام النحر)",
    frequency: "سنوي — ذو الحجة",
    hadith: "ما عمل آدمي من عمل يوم النحر أحب إلى الله من إهراق الدم",
    hadithSource: "رواه الترمذي",
    details: "تذكير يوم 8 ذي الحجة\n\nتوزيع الأضحية خلال أيام التشريق 11–13 ذو الحجة\nالأفضل تقسيم الأضحية: ثلث للأكل، ثلث للهدية، ثلث للصدقة — وهو قول جمهور العلماء",
    icon: "🐑",
    color: "hsl(145 45% 35%)",
    bg: "hsl(145 40% 94%)",
  },
  {
    id: "no_trimming",
    title: "الامتناع عن تقليم الأظافر والشعر",
    subtitle: "من دخول ذي الحجة حتى الذبح",
    frequency: "سنوي — ذو الحجة",
    hadith: "إذا رأيتم هلال ذي الحجة وأراد أحدكم أن يُضحّي فليُمسك عن شعره وأظفاره",
    hadithSource: "رواه مسلم",
    details: "تذكير يوم 20 ذي القعدة إذا كان لديه نية الأضحية",
    icon: "✂️",
    color: "hsl(0 55% 50%)",
    bg: "hsl(0 45% 95%)",
  },
];

const STORAGE_KEY = "islamic_reminders";

const loadReminders = (): Record<string, boolean> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  // Default: all enabled
  const defaults: Record<string, boolean> = {};
  reminders.forEach((r) => (defaults[r.id] = true));
  return defaults;
};

const IslamicReminders = () => {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState<Record<string, boolean>>(loadReminders);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
  }, [enabled]);

  const allEnabled = reminders.every((r) => enabled[r.id]);
  const someEnabled = reminders.some((r) => enabled[r.id]);

  const toggleAll = () => {
    const newVal = !allEnabled;
    const next: Record<string, boolean> = {};
    reminders.forEach((r) => (next[r.id] = newVal));
    setEnabled(next);
  };

  const toggleOne = (id: string) => {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-background pb-24" style={{ direction: "rtl" }}>
      <PageHeader
        title="التنبيهات الدينية"
        subtitle={`${reminders.filter((r) => enabled[r.id]).length} تنبيه مفعّل من ${reminders.length}`}
        onBack={() => navigate("/")}
        actions={[
          {
            icon: allEnabled ? (
              <Bell size={20} className="text-white" />
            ) : (
              <BellOff size={20} className="text-white" />
            ),
            onClick: toggleAll,
            style: {
              background: allEnabled
                ? "hsla(145, 60%, 45%, 0.35)"
                : "hsla(0, 70%, 55%, 0.35)",
            },
          },
        ]}
      />

      <div className="px-4 pt-4 space-y-3">
        {/* Master status */}
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: allEnabled
              ? "hsl(145 50% 94%)"
              : someEnabled
              ? "hsl(45 60% 94%)"
              : "hsl(0 50% 95%)",
            border: `1px solid ${
              allEnabled
                ? "hsl(145 40% 80%)"
                : someEnabled
                ? "hsl(45 50% 80%)"
                : "hsl(0 40% 85%)"
            }`,
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: allEnabled
                ? "hsl(145 45% 40%)"
                : someEnabled
                ? "hsl(45 60% 50%)"
                : "hsl(0 55% 55%)",
            }}
          >
            {allEnabled ? (
              <Bell size={18} className="text-white" />
            ) : (
              <BellOff size={18} className="text-white" />
            )}
          </div>
          <div className="flex-1">
            <p
              className="text-sm font-bold"
              style={{
                color: allEnabled
                  ? "hsl(145 45% 30%)"
                  : someEnabled
                  ? "hsl(45 55% 30%)"
                  : "hsl(0 50% 40%)",
              }}
            >
              {allEnabled
                ? "جميع التنبيهات مفعّلة"
                : someEnabled
                ? "بعض التنبيهات مفعّلة"
                : "جميع التنبيهات معطّلة"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              اضغط على الأيقونة في الأعلى للتحكم بالكل
            </p>
          </div>
        </div>

        {/* Reminder cards */}
        {reminders.map((reminder) => {
          const isOn = enabled[reminder.id];
          const isExpanded = expandedId === reminder.id;

          return (
            <div
              key={reminder.id}
              className="rounded-2xl overflow-hidden transition-all"
              style={{
                background: isOn ? reminder.bg : "hsl(0 0% 96%)",
                border: `1px solid ${isOn ? `${reminder.color}22` : "hsl(0 0% 90%)"}`,
                opacity: isOn ? 1 : 0.65,
              }}
            >
              {/* Main row */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : reminder.id)
                  }
                  className="flex items-center gap-3 flex-1 text-right"
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
                    style={{
                      background: isOn ? `${reminder.color}18` : "hsl(0 0% 90%)",
                    }}
                  >
                    {reminder.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-bold leading-snug"
                      style={{ color: isOn ? reminder.color : "hsl(0 0% 50%)" }}
                    >
                      {reminder.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {reminder.subtitle}
                    </p>
                    <span
                      className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{
                        background: isOn ? `${reminder.color}15` : "hsl(0 0% 88%)",
                        color: isOn ? reminder.color : "hsl(0 0% 55%)",
                      }}
                    >
                      {reminder.frequency}
                    </span>
                  </div>
                </button>
                <Switch
                  checked={isOn}
                  onCheckedChange={() => toggleOne(reminder.id)}
                />
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div
                  className="px-4 pb-4 pt-1 space-y-2.5 border-t"
                  style={{ borderColor: `${reminder.color}15` }}
                >
                  {/* Hadith */}
                  <div
                    className="rounded-xl px-3.5 py-3"
                    style={{ background: "hsla(0,0%,100%,0.7)" }}
                  >
                    <p
                      className="text-[12px] leading-relaxed font-medium"
                      style={{ color: reminder.color }}
                    >
                      «{reminder.hadith}»
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1.5 font-semibold">
                      — {reminder.hadithSource}
                    </p>
                  </div>

                  {/* Additional details */}
                  {reminder.details && (
                    <div
                      className="rounded-xl px-3.5 py-2.5"
                      style={{ background: `${reminder.color}08` }}
                    >
                      {reminder.details.split("\n").map((line, i) =>
                        line.trim() ? (
                          <p
                            key={i}
                            className="text-[11px] text-muted-foreground leading-relaxed"
                          >
                            {line}
                          </p>
                        ) : (
                          <div key={i} className="h-1.5" />
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IslamicReminders;
