import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Plus,
  Cake,
  Plane,
  Heart,
  Star,
  GraduationCap,
  Calendar as CalendarIcon,
  X,
  Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTrash } from "@/contexts/TrashContext";
import BottomNav from "@/components/home/BottomNav";

interface FamilyEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  icon: string;
  reminder?: string;
  addedBy: string;
}

const ICONS: Record<string, any> = {
  cake: Cake,
  plane: Plane,
  heart: Heart,
  star: Star,
  graduation: GraduationCap,
  calendar: CalendarIcon,
};

const ICON_OPTIONS = [
  { key: "cake", label: "🎂" },
  { key: "heart", label: "💍" },
  { key: "plane", label: "✈️" },
  { key: "star", label: "⭐" },
  { key: "graduation", label: "🎓" },
  { key: "calendar", label: "📅" },
];

const EVENTS_KEY = "family_calendar_events";

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const ARABIC_DAYS = ["أح", "إث", "ث", "أر", "خ", "ج", "س"];

const toArabicNum = (n: number) => n.toLocaleString("ar-EG");

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function daysLabel(d: number) {
  if (d === 0) return "اليوم";
  if (d === 1) return "غداً";
  if (d < 0) return `قبل ${toArabicNum(Math.abs(d))} يوم`;
  return `${toArabicNum(d)} يوم`;
}

const initialEvents: FamilyEvent[] = [
  { id: "1", title: "عيد ميلاد نورة", date: "2026-03-15", icon: "cake", reminder: "كل العائلة", addedBy: "أم فهد" },
  { id: "2", title: "ذكرى الزواج", date: "2026-03-22", icon: "heart", reminder: "أبو فهد وأم فهد", addedBy: "أبو فهد" },
  { id: "3", title: "رحلة أبها", date: "2026-04-01", icon: "plane", reminder: "كل العائلة", addedBy: "فهد" },
  { id: "4", title: "تخرج سارة", date: "2026-05-10", icon: "graduation", reminder: "كل العائلة", addedBy: "سارة" },
];

const CalendarPage = () => {
  const navigate = useNavigate();
  const { addToTrash } = useTrash();
  const today = new Date();

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<FamilyEvent[]>(() => {
    try {
      const saved = localStorage.getItem(EVENTS_KEY);
      return saved ? JSON.parse(saved) : initialEvents;
    } catch {
      return initialEvents;
    }
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", icon: "calendar", reminder: "" });

  // Swipe state
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});
  const touchStartXRef = useRef(0);
  const activeSwipeRef = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  }, [events]);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  const eventsForDay = (dateStr: string) => events.filter((e) => e.date === dateStr);

  const allUpcoming = [...events]
    .filter((e) => daysUntil(e.date) >= 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const dayHasEvent = (d: number) => {
    const dateStr = formatDate(currentYear, currentMonth, d);
    return events.some((e) => e.date === dateStr);
  };

  const handleDayClick = (d: number) => {
    const dateStr = formatDate(currentYear, currentMonth, d);
    setSelectedDay(dateStr);
  };

  const handleAddEvent = () => {
    if (!newEvent.title.trim()) return;
    const dateStr = selectedDay || formatDate(currentYear, currentMonth, today.getDate());
    const ev: FamilyEvent = {
      id: crypto.randomUUID(),
      title: newEvent.title,
      date: dateStr,
      icon: newEvent.icon,
      reminder: newEvent.reminder || "كل العائلة",
      addedBy: "أنا",
    };
    setEvents((prev) => [...prev, ev]);
    setNewEvent({ title: "", icon: "calendar", reminder: "" });
    setShowAddDialog(false);
  };

  const handleDelete = (ev: FamilyEvent) => {
    addToTrash({
      type: "event",
      title: ev.title,
      description: `${ev.date} - ${ev.reminder || ""}`,
      deletedBy: "أنا",
      isShared: true,
      originalData: ev,
    });
    setEvents((prev) => prev.filter((e) => e.id !== ev.id));
    setSwipeOffset((prev) => { const n = { ...prev }; delete n[ev.id]; return n; });
  };

  // Swipe handlers (touch + mouse for desktop)
  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    touchStartXRef.current = e.clientX;
    activeSwipeRef.current = id;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent, id: string) => {
    if (activeSwipeRef.current !== id) return;
    const diff = touchStartXRef.current - e.clientX;
    if (diff > 0) {
      setSwipeOffset((prev) => ({ ...prev, [id]: Math.min(diff, 80) }));
    } else {
      setSwipeOffset((prev) => ({ ...prev, [id]: 0 }));
    }
  };
  const handlePointerUp = (id: string) => {
    const offset = swipeOffset[id] || 0;
    setSwipeOffset((prev) => ({ ...prev, [id]: offset > 40 ? 80 : 0 }));
    activeSwipeRef.current = null;
  };

  const getMonthShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return ARABIC_MONTHS[d.getMonth()].slice(0, 3);
  };

  const getEventIcon = (iconKey: string) => {
    const opt = ICON_OPTIONS.find((o) => o.key === iconKey);
    return opt ? opt.label : "📅";
  };

  // Build calendar grid
  const calendarCells: (number | null)[] = [];
  // RTL: Sunday is last column. We reverse the day headers and day placement.
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  // Reverse each row for RTL
  const rows: (number | null)[][] = [];
  for (let i = 0; i < calendarCells.length; i += 7) {
    rows.push(calendarCells.slice(i, i + 7).reverse());
  }

  return (
    <div className="min-h-screen max-w-2xl mx-auto flex flex-col pb-24" dir="rtl"
      style={{ background: "linear-gradient(180deg, hsl(40, 20%, 97%) 0%, hsl(40, 20%, 95%) 100%)" }}>

      {/* Header */}
      <div
        className="sticky top-0 z-40 px-4 pt-12 pb-3"
        style={{
          background: "linear-gradient(135deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)))",
        }}
      >
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-1.5 rounded-full" style={{ background: "hsla(0,0%,100%,0.12)" }}>
            <ArrowRight size={20} className="text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">تقويم العائلة</h1>
            <p className="text-xs text-white/70">{ARABIC_MONTHS[currentMonth]} {toArabicNum(currentYear)}</p>
          </div>
          <div className="flex gap-1.5">
            <button onClick={nextMonth} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "hsla(0,0%,100%,0.12)" }}>
              <ChevronRight size={18} className="text-white" />
            </button>
            <button onClick={prevMonth} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "hsla(0,0%,100%,0.12)" }}>
              <ChevronLeft size={18} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="px-4 mt-4">
        <div className="bg-card rounded-2xl p-4 border border-border" style={{ boxShadow: "0 2px 12px hsla(0,0%,0%,0.04)" }}>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-3">
            {[...ARABIC_DAYS].reverse().map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          {/* Days */}
          {rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-7">
              {row.map((day, ci) => {
                if (day === null) return <div key={ci} className="py-2" />;
                const dateStr = formatDate(currentYear, currentMonth, day);
                const isToday = dateStr === todayStr;
                const hasEvent = dayHasEvent(day);
                return (
                  <button
                    key={ci}
                    onClick={() => handleDayClick(day)}
                    className={`relative py-2 flex flex-col items-center justify-center transition-colors rounded-xl mx-0.5 my-0.5 ${isToday ? "bg-primary text-primary-foreground font-black" : "hover:bg-muted"}`}
                  >
                    <span className={`text-sm ${isToday ? "font-black" : "font-semibold text-foreground"}`}>{toArabicNum(day)}</span>
                    {hasEvent && (
                      <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isToday ? "bg-primary-foreground" : ""}`}
                        style={isToday ? {} : { background: "hsl(var(--primary))" }} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Events Section */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-black text-foreground">المناسبات القادمة</h3>
          <button
            onClick={() => { setSelectedDay(todayStr); setShowAddDialog(true); }}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-card border border-border active:scale-95 transition-transform"
          >
            <Plus size={20} className="text-primary" />
          </button>
        </div>

        <div className="space-y-3">
          {allUpcoming.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">لا توجد مناسبات قادمة</p>
          )}
          {allUpcoming.map((ev) => {
            const offset = swipeOffset[ev.id] || 0;
            const d = daysUntil(ev.date);
            const dayNum = new Date(ev.date).getDate();
            return (
              <div key={ev.id} className="relative overflow-hidden rounded-2xl">
                {/* Delete button behind */}
                <div className="absolute left-0 top-0 bottom-0 w-20 flex items-center justify-center rounded-2xl bg-destructive">
                  <button onClick={() => handleDelete(ev)} className="flex flex-col items-center gap-1">
                    <Trash2 size={18} className="text-destructive-foreground" />
                    <span className="text-[10px] text-destructive-foreground font-semibold">حذف</span>
                  </button>
                </div>
                {/* Card */}
                <div
                  className="relative bg-card border border-border rounded-2xl p-4 flex items-center gap-3 transition-transform touch-pan-y"
                  style={{ transform: `translateX(${-offset}px)` }}
                  onPointerDown={(e) => handlePointerDown(e, ev.id)}
                  onPointerMove={(e) => handlePointerMove(e, ev.id)}
                  onPointerUp={() => handlePointerUp(ev.id)}
                >
                  {/* Date badge */}
                  <div className="w-14 h-14 rounded-2xl bg-primary flex flex-col items-center justify-center shrink-0">
                    <span className="text-lg font-black text-primary-foreground leading-none">{toArabicNum(dayNum)}</span>
                    <span className="text-[10px] font-semibold text-primary-foreground/80 mt-0.5">{getMonthShort(ev.date)}</span>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <span>{getEventIcon(ev.icon)}</span>
                      <span className="truncate">{ev.title}</span>
                    </p>
                    {ev.reminder && (
                      <p className="text-xs text-muted-foreground mt-1">تذكير: {ev.reminder}</p>
                    )}
                  </div>
                  {/* Days left */}
                  <span className={`text-xs font-bold shrink-0 ${d <= 1 ? "text-destructive" : "text-primary"}`}>
                    {daysLabel(d)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add button */}
        <button
          onClick={() => { setSelectedDay(todayStr); setShowAddDialog(true); }}
          className="w-full mt-6 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] transition-transform"
        >
          + إضافة مناسبة جديدة
        </button>
      </div>

      {/* Day Events Dialog */}
      <Dialog open={!!selectedDay && !showAddDialog} onOpenChange={(o) => { if (!o) setSelectedDay(null); }}>
        <DialogContent className="rounded-2xl max-w-sm mx-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-center text-base font-black">
              مناسبات {selectedDay ? new Date(selectedDay).toLocaleDateString("ar-EG", { day: "numeric", month: "long" }) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {selectedDay && eventsForDay(selectedDay).length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">لا توجد مناسبات في هذا اليوم</p>
            )}
            {selectedDay && eventsForDay(selectedDay).map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <span className="text-lg">{getEventIcon(ev.icon)}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">{ev.title}</p>
                  {ev.reminder && <p className="text-xs text-muted-foreground">{ev.reminder}</p>}
                </div>
              </div>
            ))}
            <button
              onClick={() => setShowAddDialog(true)}
              className="w-full py-3 rounded-xl border-2 border-dashed border-primary/30 text-primary text-sm font-semibold active:scale-[0.98] transition-transform"
            >
              + إضافة مناسبة
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Event Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="rounded-2xl max-w-sm mx-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-center text-base font-black">إضافة مناسبة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">اسم المناسبة</label>
              <input
                value={newEvent.title}
                onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))}
                placeholder="مثال: عيد ميلاد فهد"
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">التاريخ</label>
              <input
                type="date"
                value={selectedDay || ""}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">الأيقونة</label>
              <div className="flex gap-2">
                {ICON_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setNewEvent((p) => ({ ...p, icon: opt.key }))}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg border-2 transition-colors ${newEvent.icon === opt.key ? "border-primary bg-primary/10" : "border-border bg-muted/30"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">تذكير</label>
              <input
                value={newEvent.reminder}
                onChange={(e) => setNewEvent((p) => ({ ...p, reminder: e.target.value }))}
                placeholder="كل العائلة"
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              onClick={handleAddEvent}
              className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] transition-transform"
            >
              إضافة المناسبة
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default CalendarPage;
