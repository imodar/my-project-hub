import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import PageHeader from "@/components/PageHeader";
import PullToRefresh from "@/components/PullToRefresh";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Plane, MapPin, Calendar, Clock, DollarSign, Users, ChevronLeft,
  Check, X, HelpCircle, GripVertical, List, Map as MapIcon,
  PackageCheck, Calculator, Lightbulb, Trash2, Pencil, Star
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

// Types
interface Activity {
  id: string;
  name: string;
  time: string;
  location: string;
  cost: number;
  completed: boolean;
}

interface DayPlan {
  id: string;
  dayNumber: number;
  city: string;
  activities: Activity[];
}

interface Suggestion {
  id: string;
  placeName: string;
  type: string;
  reason: string;
  location: string;
  suggestedBy: string;
  status: "pending" | "accepted" | "rejected" | "reviewing";
}

interface PackingItem {
  id: string;
  name: string;
  packed: boolean;
}

interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  participants: string[];
  budget: number;
  status: "planning" | "confirmed" | "completed";
  type: "family" | "personal";
  days: DayPlan[];
  suggestions: Suggestion[];
  packingList: PackingItem[];
  accommodation: number;
  transportation: number;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  planning: { label: "تخطيط", color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.1)" },
  confirmed: { label: "مؤكدة", color: "hsl(145 45% 35%)", bg: "hsl(145 40% 93%)" },
  completed: { label: "منتهية", color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted))" },
};

const SUGGESTION_STATUS: Record<string, { label: string; icon: typeof Check; color: string }> = {
  pending: { label: "قيد الانتظار", icon: Clock, color: "hsl(43 65% 40%)" },
  accepted: { label: "مقبول", icon: Check, color: "hsl(145 45% 35%)" },
  rejected: { label: "مرفوض", icon: X, color: "hsl(0 60% 50%)" },
  reviewing: { label: "قيد الدراسة", icon: HelpCircle, color: "hsl(215 70% 50%)" },
};

const INITIAL_TRIPS: Trip[] = [
  {
    id: "1",
    name: "رحلة إسطنبول",
    destination: "إسطنبول، تركيا",
    startDate: "2026-04-15",
    endDate: "2026-04-22",
    participants: ["أحمد", "سارة", "ياسين", "لينا"],
    budget: 12000,
    status: "confirmed",
    type: "family",
    accommodation: 3500,
    transportation: 2800,
    days: [
      {
        id: "d1", dayNumber: 1, city: "إسطنبول — السلطان أحمد",
        activities: [
          { id: "a1", name: "زيارة آيا صوفيا", time: "09:00", location: "السلطان أحمد", cost: 200, completed: false },
          { id: "a2", name: "جامع السلطان أحمد", time: "11:30", location: "السلطان أحمد", cost: 0, completed: false },
          { id: "a3", name: "غداء بمطعم فاتح", time: "13:00", location: "الفاتح", cost: 350, completed: false },
        ]
      },
      {
        id: "d2", dayNumber: 2, city: "إسطنبول — تقسيم",
        activities: [
          { id: "a4", name: "شارع الاستقلال", time: "10:00", location: "تقسيم", cost: 0, completed: false },
          { id: "a5", name: "برج غلطة", time: "14:00", location: "غلطة", cost: 150, completed: false },
        ]
      }
    ],
    suggestions: [
      { id: "s1", placeName: "البازار الكبير", type: "تسوق", reason: "أسعار ممتازة للهدايا", location: "الفاتح", suggestedBy: "ياسين", status: "accepted" },
      { id: "s2", placeName: "جزر الأميرات", type: "طبيعة", reason: "مناظر خلابة", location: "بحر مرمرة", suggestedBy: "لينا", status: "pending" },
    ],
    packingList: [
      { id: "p1", name: "جوازات السفر", packed: true },
      { id: "p2", name: "شواحن الأجهزة", packed: true },
      { id: "p3", name: "أدوية الطوارئ", packed: false },
      { id: "p4", name: "ملابس شتوية خفيفة", packed: false },
    ],
  },
  {
    id: "2",
    name: "استراحة نهاية الأسبوع",
    destination: "العُلا",
    startDate: "2026-05-01",
    endDate: "2026-05-03",
    participants: ["أحمد"],
    budget: 3000,
    status: "planning",
    type: "personal",
    accommodation: 1200,
    transportation: 600,
    days: [],
    suggestions: [],
    packingList: [],
  },
];

// Swipeable card component
const ACTION_WIDTH = 140;

function SwipeableCard({ onEdit, onDelete, children }: {
  onEdit: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const startX = useRef(0);
  const currentX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleStart = (clientX: number) => { startX.current = clientX; };
  const handleMove = (clientX: number) => {
    const diff = clientX - startX.current;
    if (diff > 0) {
      currentX.current = Math.min(diff, ACTION_WIDTH);
      if (cardRef.current) cardRef.current.style.transform = `translateX(${currentX.current}px)`;
    }
  };
  const handleEnd = () => {
    const snap = currentX.current > ACTION_WIDTH / 2 ? ACTION_WIDTH : 0;
    currentX.current = snap;
    if (cardRef.current) {
      cardRef.current.style.transition = "transform 0.25s ease-out";
      cardRef.current.style.transform = `translateX(${snap}px)`;
      setTimeout(() => { if (cardRef.current) cardRef.current.style.transition = ""; }, 250);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-y-0 left-0 flex items-stretch" style={{ width: ACTION_WIDTH }}>
        <button onClick={onEdit} className="flex-1 flex flex-col items-center justify-center gap-1 bg-primary text-primary-foreground">
          <Pencil size={16} /><span className="text-[10px]">تعديل</span>
        </button>
        <button onClick={onDelete} className="flex-1 flex flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground">
          <Trash2 size={16} /><span className="text-[10px]">حذف</span>
        </button>
      </div>
      <div
        ref={cardRef}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={handleEnd}
        onMouseDown={(e) => handleStart(e.clientX)}
        onMouseMove={(e) => { if (e.buttons === 1) handleMove(e.clientX); }}
        onMouseUp={handleEnd}
        className="relative z-10 bg-card"
      >
        {children}
      </div>
    </div>
  );
}

const Trips = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>(INITIAL_TRIPS);
  const [activeTab, setActiveTab] = useState("family");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [tripView, setTripView] = useState<"itinerary" | "suggestions" | "packing" | "calculator">("itinerary");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Load family members
  const familyMembers: { id: string; name: string; role: string }[] = (() => {
    try {
      const saved = localStorage.getItem("family_members");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  })();

  // Drawers
  const [newTripDrawer, setNewTripDrawer] = useState(false);
  const [newActivityDrawer, setNewActivityDrawer] = useState(false);
  const [newSuggestionDrawer, setNewSuggestionDrawer] = useState(false);
  const [newPackingDrawer, setNewPackingDrawer] = useState(false);
  const [deleteDrawer, setDeleteDrawer] = useState(false);
  const [newDayDrawer, setNewDayDrawer] = useState(false);
  const [suggestionReviewDrawer, setSuggestionReviewDrawer] = useState(false);

  // Form states
  const [tripName, setTripName] = useState("");
  const [tripDest, setTripDest] = useState("");
  const [tripStart, setTripStart] = useState("");
  const [tripEnd, setTripEnd] = useState("");
  const [tripBudget, setTripBudget] = useState("");
  const [tripParticipants, setTripParticipants] = useState<string[]>([]);

  const [activityName, setActivityName] = useState("");
  const [activityTime, setActivityTime] = useState("");
  const [activityLocation, setActivityLocation] = useState("");
  const [activityCost, setActivityCost] = useState("");
  const [selectedDayId, setSelectedDayId] = useState("");

  const [suggestionName, setSuggestionName] = useState("");
  const [suggestionType, setSuggestionType] = useState("");
  const [suggestionReason, setSuggestionReason] = useState("");
  const [suggestionLocation, setSuggestionLocation] = useState("");

  const [packingItemName, setPackingItemName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [dayCity, setDayCity] = useState("");

  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [reviewingSuggestion, setReviewingSuggestion] = useState<Suggestion | null>(null);

  // Drag state
  const [draggedActivity, setDraggedActivity] = useState<string | null>(null);

  const filteredTrips = trips.filter((t) => t.type === activeTab);

  const resetTripForm = () => {
    setTripName(""); setTripDest(""); setTripStart(""); setTripEnd(""); setTripBudget(""); setTripParticipants([]);
    setEditingTripId(null);
  };

  const handleSaveTrip = () => {
    if (!tripName.trim() || !tripDest.trim()) return;
    if (editingTripId) {
      setTrips((prev) => prev.map((t) => t.id === editingTripId ? {
        ...t, name: tripName, destination: tripDest, startDate: tripStart, endDate: tripEnd,
        budget: Number(tripBudget) || 0, participants: tripParticipants,
      } : t));
      if (selectedTrip?.id === editingTripId) {
        setSelectedTrip((prev) => prev ? {
          ...prev, name: tripName, destination: tripDest, startDate: tripStart, endDate: tripEnd,
          budget: Number(tripBudget) || 0, participants: tripParticipants,
        } : null);
      }
      toast.success("تم تعديل الرحلة");
    } else {
      const newTrip: Trip = {
        id: Date.now().toString(), name: tripName, destination: tripDest,
        startDate: tripStart, endDate: tripEnd,
        participants: tripParticipants,
        budget: Number(tripBudget) || 0, status: "planning", type: activeTab as "family" | "personal",
        days: [], suggestions: [], packingList: [], accommodation: 0, transportation: 0,
      };
      setTrips((prev) => [...prev, newTrip]);
      toast.success("تم إنشاء الرحلة");
    }
    resetTripForm();
    setNewTripDrawer(false);
  };

  const handleEditTrip = (trip: Trip) => {
    setEditingTripId(trip.id);
    setTripName(trip.name);
    setTripDest(trip.destination);
    setTripStart(trip.startDate);
    setTripEnd(trip.endDate);
    setTripBudget(trip.budget.toString());
    setTripParticipants([...trip.participants]);
    setNewTripDrawer(true);
  };

  const handleDeleteTrip = () => {
    if (!deleteTarget) return;
    setTrips((prev) => prev.filter((t) => t.id !== deleteTarget));
    if (selectedTrip?.id === deleteTarget) setSelectedTrip(null);
    setDeleteTarget(null);
    setDeleteDrawer(false);
    toast.success("تم حذف الرحلة");
  };

  const handleAddDay = () => {
    if (!selectedTrip || !dayCity.trim()) return;
    const newDay: DayPlan = {
      id: Date.now().toString(),
      dayNumber: selectedTrip.days.length + 1,
      city: dayCity,
      activities: [],
    };
    const updated = { ...selectedTrip, days: [...selectedTrip.days, newDay] };
    setSelectedTrip(updated);
    setTrips((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    setDayCity("");
    setNewDayDrawer(false);
    toast.success("تم إضافة اليوم");
  };

  const handleAddActivity = () => {
    if (!selectedTrip || !selectedDayId || !activityName.trim()) return;
    const newAct: Activity = {
      id: Date.now().toString(), name: activityName, time: activityTime,
      location: activityLocation, cost: Number(activityCost) || 0, completed: false,
    };
    const updatedDays = selectedTrip.days.map((d) =>
      d.id === selectedDayId ? { ...d, activities: [...d.activities, newAct] } : d
    );
    const updated = { ...selectedTrip, days: updatedDays };
    setSelectedTrip(updated);
    setTrips((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    setActivityName(""); setActivityTime(""); setActivityLocation(""); setActivityCost("");
    setNewActivityDrawer(false);
    toast.success("تم إضافة النشاط");
  };

  const handleAddSuggestion = () => {
    if (!selectedTrip || !suggestionName.trim()) return;
    const newSug: Suggestion = {
      id: Date.now().toString(), placeName: suggestionName, type: suggestionType,
      reason: suggestionReason, location: suggestionLocation, suggestedBy: "أنت", status: "pending",
    };
    const updated = { ...selectedTrip, suggestions: [...selectedTrip.suggestions, newSug] };
    setSelectedTrip(updated);
    setTrips((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    setSuggestionName(""); setSuggestionType(""); setSuggestionReason(""); setSuggestionLocation("");
    setNewSuggestionDrawer(false);
    toast.success("تم إرسال المقترح");
  };

  const handleSuggestionDecision = (status: "accepted" | "rejected" | "reviewing") => {
    if (!selectedTrip || !reviewingSuggestion) return;
    const updatedSuggestions = selectedTrip.suggestions.map((s) =>
      s.id === reviewingSuggestion.id ? { ...s, status } : s
    );
    const updated = { ...selectedTrip, suggestions: updatedSuggestions };
    setSelectedTrip(updated);
    setTrips((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    setReviewingSuggestion(null);
    setSuggestionReviewDrawer(false);
    toast.success(status === "accepted" ? "تم قبول المقترح" : status === "rejected" ? "تم رفض المقترح" : "قيد الدراسة");
  };

  const handleAddPackingItem = () => {
    if (!selectedTrip || !packingItemName.trim()) return;
    const newItem: PackingItem = { id: Date.now().toString(), name: packingItemName, packed: false };
    const updated = { ...selectedTrip, packingList: [...selectedTrip.packingList, newItem] };
    setSelectedTrip(updated);
    setTrips((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    setPackingItemName("");
    setNewPackingDrawer(false);
    toast.success("تم إضافة العنصر");
  };

  const togglePackingItem = (itemId: string) => {
    if (!selectedTrip) return;
    const updatedList = selectedTrip.packingList.map((p) =>
      p.id === itemId ? { ...p, packed: !p.packed } : p
    );
    const updated = { ...selectedTrip, packingList: updatedList };
    setSelectedTrip(updated);
    setTrips((prev) => prev.map((t) => t.id === updated.id ? updated : t));
  };

  const handleChangeStatus = (tripId: string, status: Trip["status"]) => {
    setTrips((prev) => prev.map((t) => t.id === tripId ? { ...t, status } : t));
    if (selectedTrip?.id === tripId) setSelectedTrip((p) => p ? { ...p, status } : null);
    toast.success("تم تحديث الحالة");
  };

  // Calculate totals
  const getTripCosts = (trip: Trip) => {
    const activitiesCost = trip.days.reduce((sum, d) => sum + d.activities.reduce((s, a) => s + a.cost, 0), 0);
    return { activities: activitiesCost, accommodation: trip.accommodation, transportation: trip.transportation, total: activitiesCost + trip.accommodation + trip.transportation };
  };

  // Drag & Drop handlers for activities
  const handleDragStart = (activityId: string) => setDraggedActivity(activityId);
  const handleDrop = (dayId: string, targetIndex: number) => {
    if (!selectedTrip || !draggedActivity) return;
    let sourceDayId = "";
    let activity: Activity | null = null;
    for (const d of selectedTrip.days) {
      const found = d.activities.find((a) => a.id === draggedActivity);
      if (found) { sourceDayId = d.id; activity = found; break; }
    }
    if (!activity) return;
    const updatedDays = selectedTrip.days.map((d) => {
      let acts = [...d.activities];
      if (d.id === sourceDayId) acts = acts.filter((a) => a.id !== draggedActivity);
      if (d.id === dayId) acts.splice(targetIndex, 0, activity!);
      return { ...d, activities: acts };
    });
    const updated = { ...selectedTrip, days: updatedDays };
    setSelectedTrip(updated);
    setTrips((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    setDraggedActivity(null);
  };

  // Trip detail view
  if (selectedTrip) {
    const costs = getTripCosts(selectedTrip);
    const statusInfo = STATUS_MAP[selectedTrip.status];
    const packedCount = selectedTrip.packingList.filter((p) => p.packed).length;

    return (
      <div className="min-h-screen bg-background pb-32" dir="rtl">
        <PageHeader
          title={selectedTrip.name}
          subtitle={selectedTrip.destination}
          onBack={() => setSelectedTrip(null)}
          actions={[
            {
              icon: <Pencil size={18} className="text-white" />,
              onClick: () => handleEditTrip(selectedTrip),
            },
          ]}
        >
          <div className="flex items-center gap-2 mt-3 pb-1">
            <Badge className="text-[11px] border-0" style={{ background: statusInfo.bg, color: statusInfo.color }}>
              {statusInfo.label}
            </Badge>
            <span className="text-white/60 text-xs">
              {selectedTrip.startDate && format(new Date(selectedTrip.startDate), "d MMM", { locale: ar })}
              {" — "}
              {selectedTrip.endDate && format(new Date(selectedTrip.endDate), "d MMM yyyy", { locale: ar })}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-1 pb-1">
            <Users size={14} className="text-white/60" />
            <span className="text-white/70 text-xs">{selectedTrip.participants.join(" · ")}</span>
          </div>
        </PageHeader>

        {/* Sub tabs */}
        <div className="px-4 mt-4">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {[
              { key: "itinerary", label: "خط السير", icon: List },
              { key: "suggestions", label: "المقترحات", icon: Lightbulb },
              { key: "packing", label: "التجهيزات", icon: PackageCheck },
              { key: "calculator", label: "التكاليف", icon: Calculator },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTripView(tab.key as any)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                  tripView === tab.key
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status changer */}
        <div className="px-5 mt-4">
          <div className="flex gap-2">
            {(["planning", "confirmed", "completed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleChangeStatus(selectedTrip.id, s)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  selectedTrip.status === s ? "ring-2 ring-primary" : ""
                }`}
                style={{ background: STATUS_MAP[s].bg, color: STATUS_MAP[s].color }}
              >
                {STATUS_MAP[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Itinerary */}
        {tripView === "itinerary" && (
          <div className="px-5 mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">الأيام</h3>
              <div className="flex gap-2">
                <button onClick={() => setViewMode(viewMode === "list" ? "map" : "list")}
                  className="p-1.5 rounded-lg bg-muted">
                  {viewMode === "list" ? <MapIcon size={16} className="text-muted-foreground" /> : <List size={16} className="text-muted-foreground" />}
                </button>
                <button onClick={() => setNewDayDrawer(true)} className="p-1.5 rounded-lg bg-primary/10">
                  <Plus size={16} className="text-primary" />
                </button>
              </div>
            </div>

            {selectedTrip.days.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">لم تُضف أيام بعد</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setNewDayDrawer(true)}>
                  <Plus size={14} /> أضف يوماً
                </Button>
              </div>
            )}

            {selectedTrip.days.map((day) => (
              <div key={day.id} className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between p-4 border-b border-border/30">
                  <div>
                    <span className="text-xs font-bold text-primary">اليوم {day.dayNumber}</span>
                    <p className="text-sm font-bold text-foreground mt-0.5">{day.city}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedDayId(day.id); setNewActivityDrawer(true); }}
                    className="p-1.5 rounded-lg bg-primary/10"
                  >
                    <Plus size={14} className="text-primary" />
                  </button>
                </div>
                <div className="divide-y divide-border/20">
                  {day.activities.map((act, idx) => (
                    <div
                      key={act.id}
                      draggable
                      onDragStart={() => handleDragStart(act.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(day.id, idx)}
                      className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical size={14} className="text-muted-foreground/40 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{act.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {act.time && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock size={10} /> {act.time}
                            </span>
                          )}
                          {act.location && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin size={10} /> {act.location}
                            </span>
                          )}
                        </div>
                      </div>
                      {act.cost > 0 && (
                        <span className="text-xs font-bold text-primary whitespace-nowrap">{act.cost} ر.س</span>
                      )}
                    </div>
                  ))}
                  {day.activities.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-4">لا أنشطة</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {tripView === "suggestions" && (
          <div className="px-5 mt-5 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-foreground">مقترحات العائلة</h3>
              <button onClick={() => setNewSuggestionDrawer(true)} className="p-1.5 rounded-lg bg-primary/10">
                <Plus size={16} className="text-primary" />
              </button>
            </div>

            {selectedTrip.suggestions.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Lightbulb size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">لا مقترحات بعد</p>
              </div>
            )}

            {selectedTrip.suggestions.map((sug) => {
              const sInfo = SUGGESTION_STATUS[sug.status];
              return (
                <button
                  key={sug.id}
                  onClick={() => { setReviewingSuggestion(sug); setSuggestionReviewDrawer(true); }}
                  className="w-full text-right bg-card rounded-2xl border border-border/50 p-4 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{sug.placeName}</p>
                      <p className="text-xs text-muted-foreground mt-1">{sug.reason}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] text-muted-foreground">{sug.suggestedBy}</span>
                        {sug.type && <Badge variant="secondary" className="text-[10px]">{sug.type}</Badge>}
                      </div>
                    </div>
                    <Badge className="text-[10px] border-0 shrink-0" style={{ background: `${sInfo.color}15`, color: sInfo.color }}>
                      <sInfo.icon size={10} className="ml-1" />
                      {sInfo.label}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Packing List */}
        {tripView === "packing" && (
          <div className="px-5 mt-5 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-foreground">قائمة التجهيزات</h3>
                {selectedTrip.packingList.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {packedCount} من {selectedTrip.packingList.length} جاهز
                  </p>
                )}
              </div>
              <button onClick={() => setNewPackingDrawer(true)} className="p-1.5 rounded-lg bg-primary/10">
                <Plus size={16} className="text-primary" />
              </button>
            </div>

            {selectedTrip.packingList.length > 0 && (
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(packedCount / selectedTrip.packingList.length) * 100}%` }}
                />
              </div>
            )}

            {selectedTrip.packingList.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <PackageCheck size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">لم تُضف تجهيزات بعد</p>
              </div>
            )}

            {selectedTrip.packingList.map((item) => (
              <button
                key={item.id}
                onClick={() => togglePackingItem(item.id)}
                className="w-full flex items-center gap-3 bg-card rounded-xl border border-border/50 p-3.5 active:scale-[0.98] transition-transform"
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                  item.packed ? "bg-primary border-primary" : "border-muted-foreground/30"
                }`}>
                  {item.packed && <Check size={12} className="text-primary-foreground" />}
                </div>
                <span className={`text-sm font-medium ${item.packed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Calculator */}
        {tripView === "calculator" && (
          <div className="px-5 mt-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">حاسبة التكاليف</h3>
            <div className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">تكاليف الأنشطة</span>
                <span className="text-sm font-bold text-foreground">{costs.activities} ر.س</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الإقامة</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={selectedTrip.accommodation}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      const updated = { ...selectedTrip, accommodation: val };
                      setSelectedTrip(updated);
                      setTrips((prev) => prev.map((t) => t.id === updated.id ? updated : t));
                    }}
                    className="w-24 h-8 text-xs text-left"
                    dir="ltr"
                  />
                  <span className="text-xs text-muted-foreground">ر.س</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">المواصلات</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={selectedTrip.transportation}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      const updated = { ...selectedTrip, transportation: val };
                      setSelectedTrip(updated);
                      setTrips((prev) => prev.map((t) => t.id === updated.id ? updated : t));
                    }}
                    className="w-24 h-8 text-xs text-left"
                    dir="ltr"
                  />
                  <span className="text-xs text-muted-foreground">ر.س</span>
                </div>
              </div>
              <div className="border-t border-border/50 pt-3 flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">المجموع</span>
                <span className="text-base font-extrabold text-primary">{costs.total} ر.س</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">الميزانية المحددة</span>
                <span className="text-sm font-bold text-foreground">{selectedTrip.budget} ر.س</span>
              </div>
              {costs.total > selectedTrip.budget && selectedTrip.budget > 0 && (
                <div className="bg-destructive/10 rounded-xl p-3 text-center">
                  <p className="text-xs font-bold text-destructive">
                    ⚠ تجاوزت الميزانية بـ {costs.total - selectedTrip.budget} ر.س
                  </p>
                </div>
              )}
              {costs.total <= selectedTrip.budget && selectedTrip.budget > 0 && (
                <div className="rounded-xl p-3 text-center" style={{ background: "hsl(145 40% 93%)" }}>
                  <p className="text-xs font-bold" style={{ color: "hsl(145 45% 35%)" }}>
                    ✓ ضمن الميزانية — متبقي {selectedTrip.budget - costs.total} ر.س
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FAB for itinerary */}
        {tripView === "itinerary" && selectedTrip.days.length > 0 && createPortal(
          <button
            onClick={() => {
              setSelectedDayId(selectedTrip.days[selectedTrip.days.length - 1].id);
              setNewActivityDrawer(true);
            }}
            className="fixed left-5 bottom-24 z-50 w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            <Plus size={24} />
          </button>,
          document.body
        )}

        {/* FAB for suggestions */}
        {tripView === "suggestions" && createPortal(
          <button
            onClick={() => setNewSuggestionDrawer(true)}
            className="fixed left-5 bottom-24 z-50 w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            <Plus size={24} />
          </button>,
          document.body
        )}

        {/* FAB for packing */}
        {tripView === "packing" && createPortal(
          <button
            onClick={() => setNewPackingDrawer(true)}
            className="fixed left-5 bottom-24 z-50 w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            <Plus size={24} />
          </button>,
          document.body
        )}

        {/* Add Day Drawer */}
        <Drawer open={newDayDrawer} onOpenChange={setNewDayDrawer}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>إضافة يوم جديد</DrawerTitle></DrawerHeader>
            <div className="px-5 pb-8 space-y-4">
              <Input placeholder="المدينة / المنطقة" value={dayCity} onChange={(e) => setDayCity(e.target.value)} />
              <Button className="w-full rounded-xl" onClick={handleAddDay}>إضافة</Button>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Add Activity Drawer */}
        <Drawer open={newActivityDrawer} onOpenChange={setNewActivityDrawer}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>إضافة نشاط</DrawerTitle></DrawerHeader>
            <div className="px-5 pb-8 space-y-4">
              <Input placeholder="اسم النشاط" value={activityName} onChange={(e) => setActivityName(e.target.value)} />
              <Input type="time" placeholder="الوقت" value={activityTime} onChange={(e) => setActivityTime(e.target.value)} />
              <Input placeholder="الموقع" value={activityLocation} onChange={(e) => setActivityLocation(e.target.value)} />
              <Input type="number" placeholder="التكلفة التقديرية" value={activityCost} onChange={(e) => setActivityCost(e.target.value)} dir="ltr" />
              {selectedTrip.days.length > 1 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">اليوم</label>
                  <div className="flex gap-2 flex-wrap">
                    {selectedTrip.days.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDayId(d.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          selectedDayId === d.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        يوم {d.dayNumber}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Button className="w-full rounded-xl" onClick={handleAddActivity}>إضافة</Button>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Add Suggestion Drawer */}
        <Drawer open={newSuggestionDrawer} onOpenChange={setNewSuggestionDrawer}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>إضافة مقترح</DrawerTitle></DrawerHeader>
            <div className="px-5 pb-8 space-y-4">
              <Input placeholder="اسم المكان" value={suggestionName} onChange={(e) => setSuggestionName(e.target.value)} />
              <Input placeholder="النوع (مطعم، سياحة، تسوق...)" value={suggestionType} onChange={(e) => setSuggestionType(e.target.value)} />
              <Textarea placeholder="سبب التوصية" value={suggestionReason} onChange={(e) => setSuggestionReason(e.target.value)} />
              <Input placeholder="الموقع" value={suggestionLocation} onChange={(e) => setSuggestionLocation(e.target.value)} />
              <Button className="w-full rounded-xl" onClick={handleAddSuggestion}>إرسال المقترح</Button>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Review Suggestion Drawer */}
        <Drawer open={suggestionReviewDrawer} onOpenChange={setSuggestionReviewDrawer}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>مراجعة المقترح</DrawerTitle></DrawerHeader>
            {reviewingSuggestion && (
              <div className="px-5 pb-8 space-y-4">
                <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-bold text-foreground">{reviewingSuggestion.placeName}</p>
                  <p className="text-xs text-muted-foreground">{reviewingSuggestion.reason}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>🗂 {reviewingSuggestion.type}</span>
                    <span>📍 {reviewingSuggestion.location}</span>
                    <span>👤 {reviewingSuggestion.suggestedBy}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 rounded-xl" style={{ background: "hsl(145 45% 35%)" }}
                    onClick={() => handleSuggestionDecision("accepted")}>
                    <Check size={16} /> قبول
                  </Button>
                  <Button className="flex-1 rounded-xl" variant="outline"
                    onClick={() => handleSuggestionDecision("reviewing")}>
                    <HelpCircle size={16} /> دراسة
                  </Button>
                  <Button className="flex-1 rounded-xl" variant="destructive"
                    onClick={() => handleSuggestionDecision("rejected")}>
                    <X size={16} /> رفض
                  </Button>
                </div>
              </div>
            )}
          </DrawerContent>
        </Drawer>

        {/* Add Packing Item Drawer */}
        <Drawer open={newPackingDrawer} onOpenChange={setNewPackingDrawer}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>إضافة تجهيز</DrawerTitle></DrawerHeader>
            <div className="px-5 pb-8 space-y-4">
              <Input placeholder="اسم العنصر" value={packingItemName} onChange={(e) => setPackingItemName(e.target.value)} />
              <Button className="w-full rounded-xl" onClick={handleAddPackingItem}>إضافة</Button>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Edit Trip Drawer (in detail view) */}
        <Drawer open={newTripDrawer} onOpenChange={(o) => { setNewTripDrawer(o); if (!o) resetTripForm(); }}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{editingTripId ? "تعديل الرحلة" : "رحلة جديدة"}</DrawerTitle>
            </DrawerHeader>
            <div className="px-5 pb-8 space-y-4">
              <Input placeholder="اسم الرحلة" value={tripName} onChange={(e) => setTripName(e.target.value)} />
              <Input placeholder="الوجهة الرئيسية" value={tripDest} onChange={(e) => setTripDest(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">تاريخ البداية</label>
                  <Input type="date" value={tripStart} onChange={(e) => setTripStart(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">تاريخ النهاية</label>
                  <Input type="date" value={tripEnd} onChange={(e) => setTripEnd(e.target.value)} dir="ltr" />
                </div>
              </div>
              <Input type="number" placeholder="الميزانية الإجمالية" value={tripBudget} onChange={(e) => setTripBudget(e.target.value)} dir="ltr" />
              <Input placeholder="المشاركون (مفصولين بفاصلة ،)" value={tripParticipants} onChange={(e) => setTripParticipants(e.target.value)} />
              <Button className="w-full rounded-xl" onClick={handleSaveTrip}>
                {editingTripId ? "حفظ التعديلات" : "إنشاء الرحلة"}
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  // Trip list view
  return (
    <div className="min-h-screen bg-background pb-32" dir="rtl">
      <PageHeader title="الرحلات" subtitle="خطط لرحلاتك العائلية والشخصية" />

      <PullToRefresh onRefresh={async () => {}}>
        <div className="px-5 mt-5">
          <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
            <TabsList className="w-full grid grid-cols-2 rounded-xl h-11">
              <TabsTrigger value="family" className="rounded-lg text-xs font-bold">
                <Users size={14} className="ml-1" /> رحلات عائلية
              </TabsTrigger>
              <TabsTrigger value="personal" className="rounded-lg text-xs font-bold">
                <Plane size={14} className="ml-1" /> رحلات شخصية
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4 space-y-3">
              {filteredTrips.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Plane size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-sm font-medium">لا رحلات {activeTab === "family" ? "عائلية" : "شخصية"} بعد</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => { resetTripForm(); setNewTripDrawer(true); }}>
                    <Plus size={14} /> أنشئ رحلة
                  </Button>
                </div>
              )}

              {filteredTrips.map((trip) => {
                const statusInfo = STATUS_MAP[trip.status];
                const costs = getTripCosts(trip);
                return (
                  <SwipeableCard
                    key={trip.id}
                    onEdit={() => handleEditTrip(trip)}
                    onDelete={() => { setDeleteTarget(trip.id); setDeleteDrawer(true); }}
                  >
                    <button
                      onClick={() => setSelectedTrip(trip)}
                      className="w-full text-right p-4 active:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-foreground">{trip.name}</h3>
                            <Badge className="text-[10px] border-0" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                              {statusInfo.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <MapPin size={11} /> {trip.destination}
                          </p>
                          {trip.startDate && (
                            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar size={11} />
                              {format(new Date(trip.startDate), "d MMM", { locale: ar })}
                              {trip.endDate && ` — ${format(new Date(trip.endDate), "d MMM", { locale: ar })}`}
                            </p>
                          )}
                        </div>
                        <div className="text-left shrink-0">
                          <p className="text-xs font-bold text-primary">{trip.budget > 0 ? `${trip.budget} ر.س` : ""}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{trip.days.length} أيام</p>
                        </div>
                      </div>
                      {trip.participants.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          <Users size={11} className="text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">{trip.participants.join(" · ")}</span>
                        </div>
                      )}
                    </button>
                  </SwipeableCard>
                );
              })}
            </TabsContent>
          </Tabs>
        </div>
      </PullToRefresh>

      {/* FAB */}
      {createPortal(
        <button
          onClick={() => { resetTripForm(); setNewTripDrawer(true); }}
          className="fixed left-5 bottom-24 z-50 w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus size={24} />
        </button>,
        document.body
      )}

      {/* New/Edit Trip Drawer */}
      <Drawer open={newTripDrawer} onOpenChange={(o) => { setNewTripDrawer(o); if (!o) resetTripForm(); }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{editingTripId ? "تعديل الرحلة" : "رحلة جديدة"}</DrawerTitle>
          </DrawerHeader>
          <div className="px-5 pb-8 space-y-4">
            <Input placeholder="اسم الرحلة" value={tripName} onChange={(e) => setTripName(e.target.value)} />
            <Input placeholder="الوجهة الرئيسية" value={tripDest} onChange={(e) => setTripDest(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">تاريخ البداية</label>
                <Input type="date" value={tripStart} onChange={(e) => setTripStart(e.target.value)} dir="ltr" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">تاريخ النهاية</label>
                <Input type="date" value={tripEnd} onChange={(e) => setTripEnd(e.target.value)} dir="ltr" />
              </div>
            </div>
            <Input type="number" placeholder="الميزانية الإجمالية" value={tripBudget} onChange={(e) => setTripBudget(e.target.value)} dir="ltr" />
            <Input placeholder="المشاركون (مفصولين بفاصلة ،)" value={tripParticipants} onChange={(e) => setTripParticipants(e.target.value)} />
            <Button className="w-full rounded-xl" onClick={handleSaveTrip}>
              {editingTripId ? "حفظ التعديلات" : "إنشاء الرحلة"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation Drawer */}
      <Drawer open={deleteDrawer} onOpenChange={setDeleteDrawer}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>حذف الرحلة</DrawerTitle></DrawerHeader>
          <div className="px-5 pb-8 space-y-4">
            <p className="text-sm text-muted-foreground text-center">هل أنت متأكد من حذف هذه الرحلة؟ لا يمكن التراجع.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDeleteDrawer(false)}>إلغاء</Button>
              <Button variant="destructive" className="flex-1 rounded-xl" onClick={handleDeleteTrip}>حذف</Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Trips;
