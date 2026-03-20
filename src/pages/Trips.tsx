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
  PackageCheck, Calculator, Lightbulb, Trash2, Pencil, Star, Camera, Image
} from "lucide-react";
import { format, addDays, differenceInDays } from "date-fns";
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

interface Expense {
  id: string;
  name: string;
  amount: number;
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
  expenses: Expense[];
}


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
    expenses: [
      { id: "e1", name: "الإقامة", amount: 3500 },
      { id: "e2", name: "المواصلات", amount: 2800 },
      { id: "e3", name: "تذاكر طيران", amount: 4200 },
    ],
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
    expenses: [
      { id: "e4", name: "الإقامة", amount: 1200 },
      { id: "e5", name: "المواصلات", amount: 600 },
    ],
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
  const [tripView, setTripView] = useState<"itinerary" | "suggestions" | "packing" | "calculator" | "album">("itinerary");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Load family members
  const familyMembers: { id: string; name: string; role: string }[] = (() => {
    try {
      const saved = localStorage.getItem("family_members");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  })();

  // Drawers
  const [newExpenseDrawer, setNewExpenseDrawer] = useState(false);
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
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
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
      const newType = tripParticipants.length > 1 ? "family" : "personal";
      setTrips((prev) => prev.map((t) => t.id === editingTripId ? {
        ...t, name: tripName, destination: tripDest, startDate: tripStart, endDate: tripEnd,
        budget: Number(tripBudget) || 0, participants: tripParticipants, type: newType,
      } : t));
      if (selectedTrip?.id === editingTripId) {
        setSelectedTrip((prev) => prev ? {
          ...prev, name: tripName, destination: tripDest, startDate: tripStart, endDate: tripEnd,
          budget: Number(tripBudget) || 0, participants: tripParticipants, type: newType,
        } : null);
      }
      toast.success(newType !== trips.find(t => t.id === editingTripId)?.type
        ? newType === "family" ? "تم تحويل الرحلة إلى عائلية" : "تم تحويل الرحلة إلى شخصية"
        : "تم تعديل الرحلة"
      );
    } else {
      const newTrip: Trip = {
        id: Date.now().toString(), name: tripName, destination: tripDest,
        startDate: tripStart, endDate: tripEnd,
        participants: tripParticipants,
        budget: Number(tripBudget) || 0, status: "planning",
        type: tripParticipants.length > 1 ? "family" : "personal",
        days: [], suggestions: [], packingList: [], expenses: [],
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

  const handleAddExpense = () => {
    if (!selectedTrip || !expenseName.trim()) return;
    const newExp: Expense = { id: Date.now().toString(), name: expenseName, amount: Number(expenseAmount) || 0 };
    const updated = { ...selectedTrip, expenses: [...selectedTrip.expenses, newExp] };
    setSelectedTrip(updated);
    setTrips((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    setExpenseName("");
    setExpenseAmount("");
    setNewExpenseDrawer(false);
    toast.success("تم إضافة المصروف");
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


  // Calculate totals
  const getTripCosts = (trip: Trip) => {
    const expensesTotal = trip.expenses.reduce((sum, e) => sum + e.amount, 0);
    return { total: expensesTotal };
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
            <span className="text-xs font-medium" style={{ color: "hsl(var(--accent))" }}>
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
              ...(selectedTrip.type === "family" || selectedTrip.participants.length > 1
                ? [{ key: "suggestions", label: "المقترحات", icon: Lightbulb }]
                : []),
              { key: "packing", label: "التجهيزات", icon: PackageCheck },
              { key: "calculator", label: "التكاليف", icon: Calculator },
              ...((() => {
                // Check if there's an album linked to this trip
                try {
                  const storedAlbums = localStorage.getItem("family-albums");
                  if (storedAlbums) {
                    const albums = JSON.parse(storedAlbums);
                    if (albums.some((a: any) => a.linkedTripId === selectedTrip.id)) {
                      return [{ key: "album", label: "ألبوم الرحلة", icon: Camera }];
                    }
                  }
                } catch {}
                // Also check default data
                if (selectedTrip.id === "1") return [{ key: "album", label: "ألبوم الرحلة", icon: Camera }];
                return [];
              })()),
            ].map((tab) => {
              const isActive = tripView === tab.key;
              const activeColors: Record<string, string> = {
                itinerary: "hsl(var(--primary))",
                suggestions: "hsl(40 90% 50%)",
                packing: "hsl(145 45% 40%)",
                calculator: "hsl(280 50% 55%)",
                album: "hsl(350 65% 55%)",
              };
              return (
                <button
                  key={tab.key}
                  onClick={() => setTripView(tab.key as any)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                    isActive ? "text-white shadow-md" : "bg-muted text-muted-foreground"
                  }`}
                  style={isActive ? { background: activeColors[tab.key] || "hsl(var(--primary))" } : undefined}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              );
            })}
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
                    <span className="text-xs font-bold" style={{ color: "hsl(var(--accent))" }}>
                      اليوم {day.dayNumber}
                      {selectedTrip.startDate && ` — ${format(addDays(new Date(selectedTrip.startDate), day.dayNumber - 1), "EEEE d MMM", { locale: ar })}`}
                    </span>
                    <p className="text-sm font-bold text-foreground mt-0.5">{day.city}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedDayId(day.id); setNewActivityDrawer(true); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
                    style={{ background: "hsl(var(--accent) / 0.15)", color: "hsl(var(--accent))" }}
                  >
                    <Plus size={14} />
                    <span>نشاط</span>
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
                        <span className="text-xs font-bold text-primary whitespace-nowrap">{act.cost.toLocaleString()}</span>
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
                    <Badge className="text-[10px] border-0 shrink-0" style={{ background: sInfo.color.replace(")", " / 0.12)"), color: sInfo.color }}>
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
            {/* Budget summary */}
            <div className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الميزانية المحددة</span>
                <span className="text-sm font-bold text-foreground">{selectedTrip.budget.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">إجمالي المصروفات</span>
                <span className="text-sm font-bold text-foreground">{costs.total.toLocaleString()}</span>
              </div>
              {selectedTrip.budget > 0 && (
                <>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min((costs.total / selectedTrip.budget) * 100, 100)}%`,
                        background: costs.total > selectedTrip.budget ? "hsl(var(--destructive))" : "hsl(var(--primary))",
                      }}
                    />
                  </div>
                  {costs.total > selectedTrip.budget ? (
                    <div className="bg-destructive/10 rounded-xl p-3 text-center">
                      <p className="text-xs font-bold text-destructive">
                        ⚠ تجاوزت الميزانية بـ {(costs.total - selectedTrip.budget).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl p-3 text-center" style={{ background: "hsl(145 40% 93%)" }}>
                      <p className="text-xs font-bold" style={{ color: "hsl(145 45% 35%)" }}>
                        ✓ ضمن الميزانية — متبقي {(selectedTrip.budget - costs.total).toLocaleString()}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Expenses list */}
            <h3 className="text-sm font-bold text-foreground">المصروفات</h3>
            {selectedTrip.expenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                لا توجد مصروفات بعد — أضف أول مصروف
              </div>
            ) : (
              <div className="space-y-2">
                {selectedTrip.expenses.map((exp) => (
                  <div key={exp.id} className="bg-card rounded-xl border border-border/50 p-3 flex items-center justify-between">
                    <span className="text-sm text-foreground">{exp.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{exp.amount.toLocaleString()}</span>
                      <button
                        onClick={() => {
                          const updated = { ...selectedTrip, expenses: selectedTrip.expenses.filter((e) => e.id !== exp.id) };
                          setSelectedTrip(updated);
                          setTrips((prev) => prev.map((t) => t.id === updated.id ? updated : t));
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

        {/* FAB for calculator */}
        {tripView === "calculator" && createPortal(
          <button
            onClick={() => setNewExpenseDrawer(true)}
            className="fixed left-5 bottom-24 z-50 w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            <Plus size={24} />
          </button>,
          document.body
        )}

        {/* Album view */}
        {tripView === "album" && (() => {
          // Get album photos for this trip
          let albumPhotos: { id: string; url: string; date: string; caption?: string }[] = [];
          let albumName = "";
          try {
            const storedAlbums = localStorage.getItem("family-albums");
            if (storedAlbums) {
              const albums = JSON.parse(storedAlbums);
              const linked = albums.find((a: any) => a.linkedTripId === selectedTrip.id);
              if (linked) {
                albumPhotos = linked.photos || [];
                albumName = linked.name;
              }
            }
          } catch {}
          // Fallback for demo
          if (albumPhotos.length === 0 && selectedTrip.id === "1") {
            albumPhotos = [
              { id: "tp1", url: "", date: "2026-04-15", caption: "وصول إسطنبول" },
              { id: "tp2", url: "", date: "2026-04-15", caption: "آيا صوفيا" },
              { id: "tp3", url: "", date: "2026-04-16", caption: "برج غلطة" },
              { id: "tp4", url: "", date: "2026-04-16", caption: "شارع الاستقلال" },
              { id: "tp5", url: "", date: "2026-04-17", caption: "البازار الكبير" },
            ];
            albumName = "رحلة إسطنبول";
          }

          return (
            <div className="px-5 mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-foreground">ألبوم الرحلة</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary font-bold"
                  onClick={() => navigate("/albums")}
                >
                  عرض الكل
                </Button>
              </div>

              {albumPhotos.length === 0 ? (
                <div className="flex flex-col items-center py-12">
                  <Image size={32} className="text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm font-bold">لا توجد صور</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {albumPhotos.map((photo) => {
                    const hue = (photo.id.charCodeAt(photo.id.length - 1) * 47) % 360;
                    return (
                      <div
                        key={photo.id}
                        className="aspect-square rounded-xl overflow-hidden relative"
                        style={{
                          background: photo.url
                            ? `url(${photo.url}) center/cover`
                            : `linear-gradient(135deg, hsl(${hue} 40% 75%), hsl(${(hue + 40) % 360} 50% 65%))`,
                        }}
                      >
                        {!photo.url && (
                          <div className="w-full h-full flex items-center justify-center">
                            <Camera size={20} className="text-white/40" />
                          </div>
                        )}
                        {photo.caption && (
                          <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/50 to-transparent">
                            <span className="text-[9px] text-white/90 font-medium">{photo.caption}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

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
              {selectedTrip.startDate && selectedTrip.endDate && (() => {
                const start = new Date(selectedTrip.startDate);
                const end = new Date(selectedTrip.endDate);
                const totalDays = differenceInDays(end, start) + 1;
                const allDays = Array.from({ length: totalDays }, (_, i) => ({
                  index: i,
                  date: addDays(start, i),
                  dayPlan: selectedTrip.days.find((d) => d.dayNumber === i + 1),
                }));
                return (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">اختر اليوم</label>
                    <div className="flex gap-2 flex-wrap">
                      {allDays.map((d) => {
                        const dayId = d.dayPlan?.id || `new-day-${d.index + 1}`;
                        return (
                          <button
                            key={dayId}
                            onClick={() => setSelectedDayId(dayId)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                              selectedDayId === dayId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <span className="block">{format(d.date, "EEEE", { locale: ar })}</span>
                            <span className="block text-[10px] opacity-75">{format(d.date, "d MMM", { locale: ar })}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
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

        {/* Add Expense Drawer */}
        <Drawer open={newExpenseDrawer} onOpenChange={setNewExpenseDrawer}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>إضافة مصروف</DrawerTitle></DrawerHeader>
            <div className="px-5 pb-8 space-y-4">
              <Input placeholder="اسم المصروف (إقامة، طيران، طعام...)" value={expenseName} onChange={(e) => setExpenseName(e.target.value)} />
              <Input type="number" placeholder="المبلغ" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} dir="ltr" />
              <Button className="w-full rounded-xl" onClick={handleAddExpense}>إضافة</Button>
            </div>
          </DrawerContent>
        </Drawer>

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
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">المشاركون</label>
                {familyMembers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {familyMembers.map((m) => {
                      const selected = tripParticipants.includes(m.name);
                      return (
                        <button key={m.id} type="button"
                          onClick={() => setTripParticipants((prev) => selected ? prev.filter((n) => n !== m.name) : [...prev, m.name])}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95"
                          style={{
                            background: selected ? "hsl(var(--primary))" : "hsl(var(--muted))",
                            color: selected ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                          }}
                        >
                          {selected && <Check size={12} />}
                          <Users size={12} />
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">أضف أفراد العائلة أولاً من إدارة العائلة</p>
                )}
              </div>
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
            <TabsList className="w-full grid grid-cols-2 rounded-xl h-11 bg-muted">
              <TabsTrigger value="family" className="rounded-lg text-xs font-bold data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-md">
                <Users size={14} className="ml-1" /> رحلات عائلية
              </TabsTrigger>
              <TabsTrigger value="personal" className="rounded-lg text-xs font-bold data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-md">
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
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <MapPin size={11} /> {trip.destination}
                          </p>
                          {trip.startDate && (
                            <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: "hsl(145 45% 35%)" }}>
                              <Calendar size={11} />
                              {format(new Date(trip.startDate), "d MMM", { locale: ar })}
                              {trip.endDate && ` — ${format(new Date(trip.endDate), "d MMM", { locale: ar })}`}
                            </p>
                          )}
                        </div>
                        <div className="text-left shrink-0">
                          <p className="text-xs font-bold" style={{ color: "hsl(var(--accent))" }}>{trip.budget > 0 ? trip.budget.toLocaleString() : ""}</p>
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
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">المشاركون</label>
              {familyMembers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {familyMembers.map((m) => {
                    const selected = tripParticipants.includes(m.name);
                    return (
                      <button key={m.id} type="button"
                        onClick={() => setTripParticipants((prev) => selected ? prev.filter((n) => n !== m.name) : [...prev, m.name])}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95"
                        style={{
                          background: selected ? "hsl(var(--primary))" : "hsl(var(--muted))",
                          color: selected ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                        }}
                      >
                        {selected && <Check size={12} />}
                        <Users size={12} />
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">أضف أفراد العائلة أولاً من إدارة العائلة</p>
              )}
            </div>
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
