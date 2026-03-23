import React, { useState, useCallback, useRef, useMemo } from "react";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { createPortal } from "react-dom";
import PullToRefresh from "@/components/PullToRefresh";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Cake,
  Plane,
  Heart,
  Star,
  GraduationCap,
  Calendar as CalendarIcon,
  Trash2,
  Pencil,
  Bell,
  BellOff,
  BellRing,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import PageHeader from "@/components/PageHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { useTrash } from "@/contexts/TrashContext";


interface FamilyEvent {
  id: string;
  title: string;
  date: string;
  icon: string | null;
  reminder_before: string[] | null;
  added_by: string;
  personal_reminders: string[] | null;
}

const REMINDER_OPTIONS = [
  { key: "1d", label: "قبل يوم" },
  { key: "3d", label: "قبل ٣ أيام" },
  { key: "7d", label: "قبل أسبوع" },
  { key: "30d", label: "قبل شهر" },
];

const ICON_OPTIONS = [
  { key: "cake", label: "🎂" },
  { key: "heart", label: "💍" },
  { key: "plane", label: "✈️" },
  { key: "star", label: "⭐" },
  { key: "graduation", label: "🎓" },
  { key: "calendar", label: "📅" },
];

const EVENTS_KEY = "family_calendar_events"; // kept for reference only

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
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
function daysLabel(d: number) {
  if (d === 0) return "اليوم";
  if (d === 1) return "غداً";
  if (d < 0) return `قبل ${toArabicNum(Math.abs(d))} يوم`;
  return `${toArabicNum(d)} يوم`;
}

// initialEvents removed - data now comes from Supabase via useCalendarEvents hook

const CalendarPage = () => {
  const navigate = useNavigate();
  const { addToTrash } = useTrash();
  const today = new Date();
  const { events, isLoading, addEvent: addEventMutation, updateEvent: updateEventMutation, deleteEvent: deleteEventMutation } = useCalendarEvents();

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    hasReminder: false,
    reminder_before: [] as string[],
  });

  // Swipe
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});
  const touchStartXRef = useRef(0);
  const activeSwipeRef = useRef<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<FamilyEvent | null>(null);

  // Edit dialog
  const [editTarget, setEditTarget] = useState<FamilyEvent | null>(null);
  const [editForm, setEditForm] = useState({ title: "", date: "", hasReminder: false, reminder_before: [] as string[] });

  // Personal reminders dialog
  const [reminderTarget, setReminderTarget] = useState<FamilyEvent | null>(null);
  const [personalReminders, setPersonalReminders] = useState<string[]>([]);

  // Events are now synced via React Query - no localStorage needed

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

  const dayHasEvent = (d: number) => events.some((e) => e.date === formatDate(currentYear, currentMonth, d));

  const handleDayClick = (d: number) => setSelectedDay(formatDate(currentYear, currentMonth, d));

  const toggleReminderOption = useCallback((key: string, setter: React.Dispatch<React.SetStateAction<any>>, field: string = "reminderBefore") => {
    setter((prev: any) => ({
      ...prev,
      [field]: prev[field].includes(key)
        ? prev[field].filter((i: string) => i !== key)
        : [...prev[field], key],
    }));
  }, []);

  const handleAddEvent = () => {
    if (!newEvent.title.trim()) return;
    if (newEvent.hasReminder && newEvent.reminder_before.length === 0) return;
    const dateStr = selectedDay || todayStr;
    addEventMutation.mutate({
      title: newEvent.title.trim(),
      date: dateStr,
      icon: "calendar",
      reminder_before: newEvent.hasReminder ? newEvent.reminder_before : [],
    });
    setNewEvent({ title: "", hasReminder: false, reminder_before: [] });
    setShowAddDialog(false);
  };

  // Delete with confirmation
  const confirmDelete = () => {
    if (!deleteTarget) return;
    addToTrash({
      type: "event",
      title: deleteTarget.title,
      description: deleteTarget.date,
      deletedBy: "أنا",
      isShared: true,
      originalData: deleteTarget,
    });
    deleteEventMutation.mutate(deleteTarget.id);
    setSwipeOffset((prev) => { const n = { ...prev }; delete n[deleteTarget.id]; return n; });
    setDeleteTarget(null);
  };

  // Edit
  const openEdit = (ev: FamilyEvent) => {
    setEditTarget(ev);
    setEditForm({
      title: ev.title,
      date: ev.date,
      hasReminder: !!(ev.reminder_before && ev.reminder_before.length > 0),
      reminder_before: ev.reminder_before || [],
    });
    closeSwipe(ev.id);
  };
  const saveEdit = () => {
    if (!editTarget || !editForm.title.trim()) return;
    updateEventMutation.mutate({
      id: editTarget.id,
      title: editForm.title.trim(),
      date: editForm.date,
      reminder_before: editForm.hasReminder && editForm.reminder_before.length > 0 ? editForm.reminder_before : [],
    });
    setEditTarget(null);
  };

  // Personal reminders
  const openPersonalReminders = (ev: FamilyEvent) => {
    setReminderTarget(ev);
    setPersonalReminders(ev.personal_reminders || []);
    closeSwipe(ev.id);
  };
  const savePersonalReminders = () => {
    if (!reminderTarget) return;
    updateEventMutation.mutate({
      id: reminderTarget.id,
      personal_reminders: personalReminders.length > 0 ? personalReminders : [],
    });
    setReminderTarget(null);
  };
  const togglePersonalReminder = (key: string) => {
    setPersonalReminders((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Swipe handlers
  const SWIPE_WIDTH = 200;
  const closeSwipe = useCallback((id: string) => {
    setSwipeOffset((prev) => ({ ...prev, [id]: 0 }));
    activeSwipeRef.current = null;
  }, []);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    touchStartXRef.current = e.clientX;
    activeSwipeRef.current = id;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent, id: string) => {
    if (activeSwipeRef.current !== id) return;
    const diff = e.clientX - touchStartXRef.current;
    setSwipeOffset((prev) => ({ ...prev, [id]: diff > 0 ? Math.min(diff, SWIPE_WIDTH) : 0 }));
  };
  const handlePointerUp = (e: React.PointerEvent, id: string) => {
    const offset = swipeOffset[id] || 0;
    setSwipeOffset((prev) => ({ ...prev, [id]: offset > 60 ? SWIPE_WIDTH : 0 }));
    activeSwipeRef.current = null;
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  const getMonthShort = (dateStr: string) => ARABIC_MONTHS[new Date(dateStr).getMonth()];
  const getEventIcon = (iconKey: string | null) => ICON_OPTIONS.find((o) => o.key === iconKey)?.label || "📅";
  const getReminderLabel = (value?: string[] | null) => {
    if (!value || value.length === 0) return null;
    return value.map((item) => REMINDER_OPTIONS.find((o) => o.key === item)?.label || item).join(" • ");
  };

  // Calendar grid
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < calendarCells.length; i += 7) rows.push(calendarCells.slice(i, i + 7).reverse());

  return (
    <div className="min-h-screen max-w-2xl mx-auto flex flex-col pb-24 bg-background" dir="rtl">

      <PageHeader
        title="تقويم العائلة"
        subtitle={`${ARABIC_MONTHS[currentMonth]} ${toArabicNum(currentYear)}`}
        onBack={() => navigate("/")}
        actions={[
          {
            icon: <ChevronRight size={18} className="text-white" />,
            onClick: nextMonth,
            className: "w-9 h-9 flex items-center justify-center",
          },
          {
            icon: <ChevronLeft size={18} className="text-white" />,
            onClick: prevMonth,
            className: "w-9 h-9 flex items-center justify-center",
          },
        ]}
      />

      <PullToRefresh>
      {/* Calendar Grid */}
      <div className="px-4 mt-4">
        <div className="bg-card rounded-2xl p-4 border border-border" style={{ boxShadow: "0 2px 12px hsla(0,0%,0%,0.04)" }}>
          <div className="grid grid-cols-7 mb-3">
            {[...ARABIC_DAYS].reverse().map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          {rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-7">
              {row.map((day, ci) => {
                if (day === null) return <div key={ci} className="py-2" />;
                const dateStr = formatDate(currentYear, currentMonth, day);
                const isToday = dateStr === todayStr;
                const hasEvent = dayHasEvent(day);
                return (
                  <button key={ci} onClick={() => handleDayClick(day)}
                    className={`relative py-2 flex flex-col items-center justify-center transition-colors rounded-xl mx-0.5 my-0.5 ${isToday ? "bg-primary text-primary-foreground font-black" : "hover:bg-muted"}`}>
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

      {/* Upcoming Events */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-black text-foreground">المناسبات القادمة</h3>
        </div>

        {/* FAB - portal to escape transform context */}
        {createPortal(
          <div className="fixed bottom-24 left-4 max-w-2xl mx-auto z-30">
            <button onClick={() => { setSelectedDay(todayStr); setShowAddDialog(true); }}
              className="w-14 h-14 rounded-full shadow-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors">
              <Plus size={24} />
            </button>
          </div>,
          document.body
        )}

        <div className="space-y-3">
          {allUpcoming.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">لا توجد مناسبات قادمة</p>
          )}

          {allUpcoming.map((ev) => {
            const offset = swipeOffset[ev.id] || 0;
            const d = daysUntil(ev.date);
            const dayNum = new Date(ev.date).getDate();
            const reminderText = getReminderLabel(ev.reminder_before);
            const hasPersonalReminder = ev.personal_reminders && ev.personal_reminders.length > 0;

            return (
              <div key={ev.id} className="relative overflow-hidden rounded-2xl select-none">
                {/* 3 action buttons behind the card */}
                <div className="absolute left-0 top-0 bottom-0 flex items-stretch gap-1 rounded-2xl overflow-hidden p-1" style={{ width: `${SWIPE_WIDTH}px` }}>
                  {/* Delete */}
                  <button
                    onClick={() => { setDeleteTarget(ev); closeSwipe(ev.id); }}
                    className="flex-1 flex flex-col items-center justify-center gap-1 bg-destructive hover:bg-destructive/90 transition-colors rounded-xl"
                  >
                    <Trash2 size={16} className="text-destructive-foreground" />
                    <span className="text-[10px] text-destructive-foreground font-semibold">حذف</span>
                  </button>
                  <button
                    onClick={() => openEdit(ev)}
                    className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors rounded-xl"
                    style={{ background: "hsl(220, 60%, 50%)" }}
                  >
                    <Pencil size={16} className="text-white" />
                    <span className="text-[10px] text-white font-semibold">تعديل</span>
                  </button>
                  <button
                    onClick={() => openPersonalReminders(ev)}
                    className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors rounded-xl"
                    style={{ background: "hsl(35, 80%, 50%)" }}
                  >
                    {hasPersonalReminder ? <BellRing size={16} className="text-white" /> : <Bell size={16} className="text-white" />}
                    <span className="text-[10px] text-white font-semibold">تنبيه</span>
                  </button>
                </div>

                {/* Card */}
                <div
                  className="relative bg-card border border-border rounded-2xl p-4 flex items-center gap-3 transition-transform duration-200 ease-out cursor-grab active:cursor-grabbing"
                  style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
                  onPointerDown={(e) => handlePointerDown(e, ev.id)}
                  onPointerMove={(e) => handlePointerMove(e, ev.id)}
                  onPointerUp={(e) => handlePointerUp(e, ev.id)}
                  onPointerCancel={() => closeSwipe(ev.id)}
                >
                  <div className="w-14 h-14 rounded-2xl bg-accent flex flex-col items-center justify-center shrink-0">
                    <span className="text-lg font-black text-accent-foreground leading-none">{toArabicNum(dayNum)}</span>
                    <span className="text-[10px] font-semibold text-accent-foreground/80 mt-0.5">{getMonthShort(ev.date)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <span>{getEventIcon(ev.icon)}</span>
                      <span className="truncate">{ev.title}</span>
                      {hasPersonalReminder && (
                        <BellRing size={13} className="text-amber-500 shrink-0" />
                      )}
                    </p>
                    {reminderText && (
                      <p className="text-xs text-muted-foreground mt-1">🔔 {reminderText}</p>
                    )}
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${d <= 1 ? "text-destructive" : "text-primary"}`}>
                    {daysLabel(d)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      </PullToRefresh>

      {/* ===== DIALOGS ===== */}

      {/* Day Events Drawer */}
      <Drawer open={!!selectedDay && !showAddDialog} onOpenChange={(o) => { if (!o) setSelectedDay(null); }}>
        <DrawerContent dir="rtl">
          <DrawerHeader className="text-right">
            <DrawerTitle className="text-center text-base font-black">
              مناسبات {selectedDay ? new Date(selectedDay).toLocaleDateString("ar-EG", { day: "numeric", month: "long" }) : ""}
            </DrawerTitle>
            <DrawerDescription className="sr-only">قائمة مناسبات اليوم</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-4 pb-6">
            {selectedDay && eventsForDay(selectedDay).length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">لا توجد مناسبات في هذا اليوم</p>
            )}
            {selectedDay && eventsForDay(selectedDay).map((ev) => {
              const rt = getReminderLabel(ev.reminder_before);
              const hasP = ev.personal_reminders && ev.personal_reminders.length > 0;
              const drawerKey = `drawer_${ev.id}`;
              const offset = swipeOffset[drawerKey] || 0;
              return (
                <div key={ev.id} className="relative overflow-hidden rounded-2xl select-none">
                  {/* Swipe action buttons */}
                  <div className="absolute left-0 top-0 bottom-0 flex items-stretch gap-1 rounded-2xl overflow-hidden p-1" style={{ width: `${SWIPE_WIDTH}px` }}>
                    <button
                      onClick={() => { setDeleteTarget(ev); closeSwipe(drawerKey); }}
                      className="flex-1 flex flex-col items-center justify-center gap-1 bg-destructive hover:bg-destructive/90 transition-colors rounded-xl"
                    >
                      <Trash2 size={16} className="text-destructive-foreground" />
                      <span className="text-[10px] text-destructive-foreground font-semibold">حذف</span>
                    </button>
                    <button
                      onClick={() => { openEdit(ev); setSelectedDay(null); }}
                      className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors rounded-xl"
                      style={{ background: "hsl(220, 60%, 50%)" }}
                    >
                      <Pencil size={16} className="text-white" />
                      <span className="text-[10px] text-white font-semibold">تعديل</span>
                    </button>
                    <button
                      onClick={() => { openPersonalReminders(ev); setSelectedDay(null); }}
                      className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors rounded-xl"
                      style={{ background: "hsl(35, 80%, 50%)" }}
                    >
                      {hasP ? <BellRing size={16} className="text-white" /> : <Bell size={16} className="text-white" />}
                      <span className="text-[10px] text-white font-semibold">تنبيه</span>
                    </button>
                  </div>

                  {/* Card */}
                  <div
                    className="relative flex items-center gap-3 p-3 rounded-xl bg-card transition-transform duration-200 ease-out cursor-grab active:cursor-grabbing"
                    style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
                    onPointerDown={(e) => handlePointerDown(e, drawerKey)}
                    onPointerMove={(e) => handlePointerMove(e, drawerKey)}
                    onPointerUp={(e) => handlePointerUp(e, drawerKey)}
                    onPointerCancel={() => closeSwipe(drawerKey)}
                  >
                    <span className="text-lg">{getEventIcon(ev.icon)}</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        {ev.title}
                        {hasP && <BellRing size={13} className="text-amber-500" />}
                      </p>
                      {rt && <p className="text-xs text-muted-foreground">🔔 {rt}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
            <button onClick={() => setShowAddDialog(true)}
              className="w-full py-3 rounded-xl border-2 border-dashed border-primary/30 text-primary text-sm font-semibold active:scale-[0.98] transition-transform">
              + إضافة مناسبة
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Add Event Drawer */}
      <Drawer open={showAddDialog} onOpenChange={(o) => { setShowAddDialog(o); if (!o) setSelectedDay(null); }}>
        <DrawerContent dir="rtl">
          <DrawerHeader className="text-right">
            <DrawerTitle>إضافة مناسبة جديدة</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">اسم المناسبة</label>
              <input value={newEvent.title} onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))}
                placeholder="مثال: عيد ميلاد فهد"
                dir="auto"
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-right" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">التاريخ</label>
              <input type="date" value={selectedDay || ""} onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground block">التذكير</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button"
                  onClick={() => setNewEvent((p) => ({ ...p, hasReminder: false, reminder_before: [] }))}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${!newEvent.hasReminder ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-foreground"}`}>
                  <BellOff size={16} />
                  بدون تذكير
                </button>
                <button type="button"
                  onClick={() => setNewEvent((p) => ({ ...p, hasReminder: true }))}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${newEvent.hasReminder ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-foreground"}`}>
                  <Bell size={16} />
                  مع تذكير
                </button>
              </div>
              {newEvent.hasReminder && (
                <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">اختر أكثر من وقت للتذكير</p>
                  {REMINDER_OPTIONS.map((opt) => (
                    <label key={opt.key} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 cursor-pointer hover:bg-muted/40">
                      <span className="text-sm font-medium text-foreground">{opt.label}</span>
                      <Checkbox checked={newEvent.reminder_before.includes(opt.key)}
                        onCheckedChange={() => toggleReminderOption(opt.key, setNewEvent)} />
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleAddEvent}
              disabled={newEvent.hasReminder && newEvent.reminder_before.length === 0}
              className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed">
              إضافة المناسبة
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation */}
      <Drawer open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DrawerContent onClick={(e) => e.stopPropagation()}>
          <DrawerHeader>
            <DrawerTitle className="text-center font-black">تأكيد الحذف</DrawerTitle>
          </DrawerHeader>
          <div className="px-5 pb-6 space-y-4" dir="rtl">
            <p className="text-center text-sm text-muted-foreground">
              هل أنت متأكد من حذف مناسبة "{deleteTarget?.title}"؟ سيتم نقلها إلى سلة المحذوفات.
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                حذف
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 rounded-xl font-bold bg-muted text-foreground hover:bg-muted/80 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Edit Event Drawer */}
      <Drawer open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DrawerContent dir="rtl">
          <DrawerHeader className="text-right">
            <DrawerTitle>تعديل المناسبة</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">اسم المناسبة</label>
              <input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">التاريخ</label>
              <input type="date" value={editForm.date} onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground block">التذكير</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button"
                  onClick={() => setEditForm((p) => ({ ...p, hasReminder: false, reminder_before: [] }))}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${!editForm.hasReminder ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-foreground"}`}>
                  بدون تذكير
                </button>
                <button type="button"
                  onClick={() => setEditForm((p) => ({ ...p, hasReminder: true }))}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${editForm.hasReminder ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-foreground"}`}>
                  مع تذكير
                </button>
              </div>
              {editForm.hasReminder && (
                <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-3">
                  {REMINDER_OPTIONS.map((opt) => (
                    <label key={opt.key} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 cursor-pointer hover:bg-muted/40">
                      <span className="text-sm font-medium text-foreground">{opt.label}</span>
                      <Checkbox checked={editForm.reminder_before.includes(opt.key)}
                        onCheckedChange={() => toggleReminderOption(opt.key, setEditForm)} />
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button onClick={saveEdit}
              className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] transition-transform">
              حفظ التعديلات
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Personal Reminders Drawer */}
      <Drawer open={!!reminderTarget} onOpenChange={(o) => { if (!o) setReminderTarget(null); }}>
        <DrawerContent dir="rtl">
          <DrawerHeader className="text-right">
            <DrawerTitle className="flex items-center gap-2">
              <Bell size={18} className="text-amber-500" />
              تنبيهات شخصية
            </DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-2">
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">{reminderTarget?.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {reminderTarget?.date ? new Date(reminderTarget.date).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" }) : ""}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-1">
              <p className="text-xs text-muted-foreground mb-2">اختر متى تريد أن يتم تذكيرك بهذه المناسبة</p>
              {REMINDER_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 cursor-pointer hover:bg-muted/40">
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                  <Checkbox checked={personalReminders.includes(opt.key)} onCheckedChange={() => togglePersonalReminder(opt.key)} />
                </label>
              ))}
            </div>

            {personalReminders.length > 0 && (
              <p className="text-xs font-medium text-amber-600 text-center">
                🔔 سيتم تذكيرك: {getReminderLabel(personalReminders)}
              </p>
            )}

            <button onClick={savePersonalReminders}
              className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] transition-transform">
              {personalReminders.length > 0 ? "حفظ التنبيهات" : "إزالة التنبيهات"}
            </button>
          </div>
        </DrawerContent>
      </Drawer>

    </div>
  );
};

export default CalendarPage;
