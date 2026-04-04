import React from "react";
import { CalendarDays } from "lucide-react";
import { useUserRole } from "@/contexts/UserRoleContext";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const UpcomingEvents = React.forwardRef<HTMLElement>((_props, ref) => {
  const { featureAccess } = useUserRole();
  const { events, isLoading } = useCalendarEvents();
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  if (featureAccess.isStaff) return <section ref={ref} style={{ display: "none" }} />;

  const upcoming = (events || [])
    .filter((e) => new Date(e.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6);

  if (isLoading) {
    return (
      <section ref={ref} className="mt-8 pb-28 px-5">
        <h2 className="text-lg font-extrabold text-foreground tracking-tight mb-5">{t.upcomingEvents.title}</h2>
        <div className="flex gap-4 overflow-x-auto pb-3 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[220px] h-[80px] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (upcoming.length === 0) {
    return (
      <section ref={ref} className="mt-8 px-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold text-foreground tracking-tight">{t.upcomingEvents.title}</h2>
        </div>
        <button
          onClick={() => navigate("/calendar")}
          className="w-full rounded-2xl p-6 text-center transition-transform active:scale-[0.98]"
          style={{ background: "hsla(0,0%,0%,0.02)", border: "1px solid hsla(0,0%,0%,0.06)" }}
        >
          <CalendarDays size={28} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-semibold text-muted-foreground">{t.upcomingEvents.noEvents}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">{t.upcomingEvents.addEvent}</p>
        </button>
      </section>
    );
  }

  const getDaysLeft = (dateStr: string) => {
    const diff = Math.ceil((new Date(dateStr).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
    return diff === 0 ? t.upcomingEvents.today : t.upcomingEvents.inDays.replace("{0}", String(diff));
  };

  const locale = language === "ar" ? "ar-SA" : "en-US";

  const colors = [
    { bg: "hsl(145 40% 93%)", color: "hsl(145 50% 30%)", accent: "hsl(145 50% 35%)" },
    { bg: "hsl(30 100% 93%)", color: "hsl(20 80% 30%)", accent: "hsl(20 80% 40%)" },
    { bg: "hsl(215 70% 94%)", color: "hsl(215 70% 30%)", accent: "hsl(215 70% 45%)" },
    { bg: "hsl(0 60% 95%)", color: "hsl(0 60% 35%)", accent: "hsl(0 60% 50%)" },
    { bg: "hsl(270 50% 93%)", color: "hsl(270 50% 30%)", accent: "hsl(270 50% 40%)" },
    { bg: "hsl(185 60% 92%)", color: "hsl(185 60% 30%)", accent: "hsl(185 60% 40%)" },
  ];

  return (
    <section ref={ref} className="mt-8 px-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-extrabold text-foreground tracking-tight">{t.upcomingEvents.title}</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-3 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
        {upcoming.map((event, i) => {
          const c = colors[i % colors.length];
          return (
            <div
              key={event.id}
              className="min-w-[240px] rounded-xl p-3 relative overflow-hidden border border-white/20"
              style={{ background: c.bg, boxShadow: "0 2px 8px -2px hsla(0,0%,0%,0.03)" }}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-bold" style={{ color: `${c.accent}99` }}>
                    {event.icon || "📅"}
                  </span>
                  <div
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                    style={{
                      background: `${c.accent}15`,
                      color: c.accent,
                      borderColor: `${c.accent}30`,
                    }}
                  >
                    {getDaysLeft(event.date)}
                  </div>
                </div>
                <h3 className="text-sm font-extrabold leading-tight" style={{ color: c.color }}>
                  {event.title}
                </h3>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: `${c.accent}B0` }}>
                  {new Date(event.date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});

UpcomingEvents.displayName = "UpcomingEvents";

export default UpcomingEvents;
