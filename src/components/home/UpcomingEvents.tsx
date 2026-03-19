import { Moon, PartyPopper, GraduationCap, Gift } from "lucide-react";

const events = [
  {
    icon: Moon,
    category: "مناسبة دينية",
    title: "ليلة القدر",
    date: "الثلاثاء، ٢٤ مارس",
    daysLeft: 5,
    bg: "hsl(145 40% 93%)",
    color: "hsl(145 50% 30%)",
    accent: "hsl(145 50% 35%)",
    bgIcon: "night_sight_max",
  },
  {
    icon: PartyPopper,
    category: "احتفال",
    title: "عيد الفطر",
    date: "الاثنين، ٣١ مارس",
    daysLeft: 12,
    bg: "hsl(30 100% 93%)",
    color: "hsl(20 80% 30%)",
    accent: "hsl(20 80% 40%)",
    bgIcon: "celebration",
  },
  {
    icon: GraduationCap,
    category: "مناسبة عائلية",
    title: "تخرّج أحمد",
    date: "الأحد، ١٥ أبريل",
    daysLeft: 27,
    bg: "hsl(215 70% 94%)",
    color: "hsl(215 70% 30%)",
    accent: "hsl(215 70% 45%)",
    bgIcon: "school",
  },
  {
    icon: Gift,
    category: "ذكرى",
    title: "ذكرى الزواج",
    date: "الجمعة، ٣ مايو",
    daysLeft: 45,
    bg: "hsl(0 60% 95%)",
    color: "hsl(0 60% 35%)",
    accent: "hsl(0 60% 50%)",
    bgIcon: "favorite",
  },
];

const UpcomingEvents = () => {
  return (
    <section className="mt-8 px-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-extrabold text-foreground tracking-tight">المناسبات القادمة</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-3 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
        {events.map((event) => (
          <div
            key={event.title}
            className="min-w-[240px] rounded-xl p-3 relative overflow-hidden border border-white/20"
            style={{ background: event.bg, boxShadow: "0 4px 20px -2px hsla(0,0%,0%,0.05)" }}
          >
            {/* Background decoration */}
            <div className="absolute -left-3 -bottom-3 opacity-10">
              <event.icon size={60} style={{ color: event.color }} className="rotate-12" />
            </div>

            <div className="relative z-10 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-bold" style={{ color: `${event.accent}99` }}>
                    {event.category}
                  </span>
                  <div
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                    style={{
                      background: `${event.accent}15`,
                      color: event.accent,
                      borderColor: `${event.accent}30`,
                    }}
                  >
                    بعد {event.daysLeft} يوم
                  </div>
                </div>
                <h3 className="text-sm font-extrabold leading-tight" style={{ color: event.color }}>
                  {event.title}
                </h3>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: `${event.accent}B0` }}>
                  {event.date}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default UpcomingEvents;
