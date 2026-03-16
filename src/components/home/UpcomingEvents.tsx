import { Gift, GraduationCap, Cake, Star } from "lucide-react";

const events = [
  {
    icon: Cake,
    title: "عيد ميلاد سارة",
    date: "٢٥ رمضان",
    daysLeft: 4,
    color: "hsl(330, 50%, 55%)",
    bg: "linear-gradient(135deg, hsl(330, 50%, 95%), hsl(330, 40%, 90%))",
  },
  {
    icon: Star,
    title: "عيد الفطر",
    date: "١ شوال",
    daysLeft: 10,
    color: "hsl(43, 55%, 48%)",
    bg: "linear-gradient(135deg, hsl(43, 55%, 95%), hsl(43, 45%, 90%))",
  },
  {
    icon: GraduationCap,
    title: "تخرّج أحمد",
    date: "١٥ شوال",
    daysLeft: 24,
    color: "hsl(220, 60%, 50%)",
    bg: "linear-gradient(135deg, hsl(220, 60%, 95%), hsl(220, 50%, 90%))",
  },
  {
    icon: Gift,
    title: "ذكرى الزواج",
    date: "٣ ذو القعدة",
    daysLeft: 42,
    color: "hsl(0, 60%, 55%)",
    bg: "linear-gradient(135deg, hsl(0, 60%, 96%), hsl(0, 50%, 91%))",
  },
];

const UpcomingEvents = () => {
  return (
    <div className="mt-8 px-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-foreground">المناسبات القادمة</h3>
        <button className="text-xs font-semibold text-primary">عرض الكل</button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
        {events.map((event) => (
          <div
            key={event.title}
            className="flex-shrink-0 w-40 rounded-2xl p-4 transition-transform active:scale-[0.98]"
            style={{ background: event.bg }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{
              background: `${event.color}20`,
            }}>
              <event.icon size={20} style={{ color: event.color }} />
            </div>
            <p className="text-sm font-bold text-foreground mb-1">{event.title}</p>
            <p className="text-[11px] text-muted-foreground mb-2">{event.date}</p>
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{
              background: `${event.color}15`,
              color: event.color,
            }}>
              بعد {event.daysLeft} يوم
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpcomingEvents;
