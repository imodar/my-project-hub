import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useNavigate } from "react-router-dom";
import FAB from "@/components/FAB";
import SwipeableCard from "@/components/SwipeableCard";
import PageHeader from "@/components/PageHeader";
import PullToRefresh from "@/components/PullToRefresh";
import { CardContentSkeleton } from "@/components/PageSkeletons";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Plane, MapPin, Calendar, Clock, DollarSign, Users, ChevronLeft,
  Check, X, HelpCircle, GripVertical, List, Map as MapIcon,
  PackageCheck, Calculator, Lightbulb, Trash2, Pencil, Star, Camera, Image,
  FileText, Upload, Ticket, Building2, CreditCard, File, Eye
} from "lucide-react";
import { format, addDays, differenceInDays } from "date-fns";
import { ar } from "date-fns/locale";
import { appToast } from "@/lib/toast";
// tripBudgetSync removed — trips & budgets are synced via Supabase hooks
import { useTrips as useTripsHook } from "@/hooks/useTrips";
import { useAlbums } from "@/hooks/useAlbums";
import { useLanguage } from "@/contexts/LanguageContext";

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

interface TripDocument {
  id: string;
  name: string;
  type: "ticket" | "visa" | "hotel" | "insurance" | "passport" | "other";
  fileUrl: string;
  fileName: string;
  addedAt: string;
  notes?: string;
}

const DOC_TYPES: Record<TripDocument["type"], { label: string; icon: typeof FileText; color: string }> = {
  ticket: { label: "تذكرة سفر", icon: Ticket, color: "hsl(215 70% 50%)" },
  visa: { label: "تأشيرة / فيزا", icon: CreditCard, color: "hsl(145 45% 40%)" },
  hotel: { label: "حجز فندقي", icon: Building2, color: "hsl(280 50% 55%)" },
  insurance: { label: "تأمين سفر", icon: FileText, color: "hsl(40 80% 45%)" },
  passport: { label: "جواز سفر", icon: FileText, color: "hsl(350 60% 50%)" },
  other: { label: "مستند آخر", icon: File, color: "hsl(0 0% 45%)" },
};

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
  documents: TripDocument[];
}


const SUGGESTION_STATUS: Record<string, { label: string; icon: typeof Check; color: string }> = {
  pending: { label: "قيد الانتظار", icon: Clock, color: "hsl(43 65% 40%)" },
  accepted: { label: "مقبول", icon: Check, color: "hsl(145 45% 35%)" },
  rejected: { label: "مرفوض", icon: X, color: "hsl(0 60% 50%)" },
  reviewing: { label: "قيد الدراسة", icon: HelpCircle, color: "hsl(215 70% 50%)" },
};

const INITIAL_TRIPS: Trip[] = [];

// Swipeable card component
// Using shared SwipeableCard component

const Trips = () => {
  const navigate = useNavigate();
  const { language, isRTL } = useLanguage();
  const {
    trips: dbTrips, isLoading: tripsLoading,
    createTrip, updateTrip, deleteTrip: deleteTripMut,
    addDayPlan, addActivity, updateActivity,
    deleteDayPlan, deleteActivity, updateDayPlan,
    addExpense, deleteExpense,
    addPackingItem, updatePackingItem,
    addSuggestion, updateSuggestion,
    addDocument, deleteDocument,
  } = useTripsHook() as any;
  const { albums: tripAlbums } = useAlbums();

  // Map DB trips to UI format
  const trips: Trip[] = useMemo(() => {
    return dbTrips.map((t: any) => ({
      id: t.id,
      name: t.name,
      destination: t.destination || "",
      startDate: t.start_date || "",
      endDate: t.end_date || "",
      participants: Array.isArray(t.shared_with) ? t.shared_with : [],
      budget: t.budget || 0,
      status: t.status || "planning",
      type: (Array.isArray(t.shared_with) && t.shared_with.length > 0 ? "family" : "personal") as "family" | "personal",
      days: (t.trip_day_plans || []).map((d: any) => ({
        id: d.id,
        dayNumber: d.day_number,
        city: d.city || "",
        activities: (d.trip_activities || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          time: a.time || "",
          location: a.location || "",
          cost: a.cost || 0,
          completed: a.completed || false,
        })),
      })),
      suggestions: (t.trip_suggestions || []).map((s: any) => ({
        id: s.id,
        placeName: s.place_name,
        type: s.type || "",
        reason: s.reason || "",
        location: s.location || "",
        suggestedBy: s.suggested_by || "",
        status: s.status || "pending",
      })),
      packingList: (t.trip_packing || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        packed: p.packed || false,
      })),
      expenses: (t.trip_expenses || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        amount: e.amount || 0,
      })),
      documents: (t.trip_documents || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        type: d.type || "other",
        fileUrl: d.file_url || "",
        fileName: d.file_name || "",
        addedAt: d.added_at?.split("T")[0] || "",
        notes: d.notes,
      })),
    }));
  }, [dbTrips]);


  const [activeTab, setActiveTab] = useState("family");
  const [selectedTripId, setSelectedTripIdRaw] = useState<string | null>(null);
  const [selectedTripOverride, setSelectedTripOverride] = useState<Trip | null>(null);
  // Derive selectedTrip from latest trips list so optimistic updates (new days/activities) appear immediately
  const selectedTrip: Trip | null = useMemo(() => {
    if (!selectedTripId) return null;
    const fresh = trips.find((t) => t.id === selectedTripId);
    if (fresh) {
      // Merge with override (auto-generated synthetic days from autoGenerateDays)
      if (selectedTripOverride && selectedTripOverride.id === selectedTripId) {
        // Prefer real days from server; keep synthetic placeholders for missing day numbers
        const realDayNumbers = new Set(fresh.days.map((d) => d.dayNumber));
        const syntheticExtras = selectedTripOverride.days.filter(
          (d) => !realDayNumbers.has(d.dayNumber)
        );
        return { ...fresh, days: [...fresh.days, ...syntheticExtras].sort((a, b) => a.dayNumber - b.dayNumber) };
      }
      return fresh;
    }
    return selectedTripOverride;
  }, [selectedTripId, trips, selectedTripOverride]);
  const setSelectedTrip = useCallback((t: Trip | null) => {
    setSelectedTripIdRaw(t?.id ?? null);
    setSelectedTripOverride(t);
  }, []);
  const [tripView, setTripView] = useState<"itinerary" | "suggestions" | "packing" | "calculator" | "album" | "documents">("itinerary");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [openTripCardId, setOpenTripCardId] = useState<string | null>(null);

  const { members: familyMembers } = useFamilyMembers();

  // Drawers
  const [newExpenseDrawer, setNewExpenseDrawer] = useState(false);
  const [newTripDrawer, setNewTripDrawer] = useState(false);
  const [newActivityDrawer, setNewActivityDrawer] = useState(false);
  const [newSuggestionDrawer, setNewSuggestionDrawer] = useState(false);
  const [newPackingDrawer, setNewPackingDrawer] = useState(false);
  const [deleteDrawer, setDeleteDrawer] = useState(false);
  const [newDayDrawer, setNewDayDrawer] = useState(false);
  const [suggestionReviewDrawer, setSuggestionReviewDrawer] = useState(false);
  const [newDocDrawer, setNewDocDrawer] = useState(false);
  const [docViewDrawer, setDocViewDrawer] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<TripDocument | null>(null);

  // Document form states
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState<TripDocument["type"]>("ticket");
  const [docNotes, setDocNotes] = useState("");
  const [docFileInput, setDocFileInput] = useState<File | null>(null);

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

  // Edit state for day & activity
  const [editDayDrawer, setEditDayDrawer] = useState(false);
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [editDayCity, setEditDayCity] = useState("");

  const [editActivityDrawer, setEditActivityDrawer] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingActivityDayId, setEditingActivityDayId] = useState<string | null>(null);
  const [editActName, setEditActName] = useState("");
  const [editActTime, setEditActTime] = useState("");
  const [editActLocation, setEditActLocation] = useState("");
  const [editActCost, setEditActCost] = useState("");

  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [reviewingSuggestion, setReviewingSuggestion] = useState<Suggestion | null>(null);

  // Drag state
  const [draggedActivity, setDraggedActivity] = useState<string | null>(null);

  // Over-budget warning drawer (when adding an activity that pushes total over trip budget)
  const [budgetWarnDrawer, setBudgetWarnDrawer] = useState(false);
  const [pendingActivity, setPendingActivity] = useState<{ overBy: number } | null>(null);

  // Trip form errors
  const [tripErrors, setTripErrors] = useState<{ name?: boolean; budget?: boolean; start?: boolean; end?: boolean; dateOrder?: boolean }>({});

  const filteredTrips = trips.filter((t) => t.type === activeTab);

  const resetTripForm = () => {
    setTripName(""); setTripDest(""); setTripStart(""); setTripEnd(""); setTripBudget(""); setTripParticipants([]);
    setEditingTripId(null);
    setTripErrors({});
  };

  const handleSaveTrip = () => {
    const errors: typeof tripErrors = {};
    const messages: string[] = [];
    const ar_msgs = {
      name: "اسم الرحلة مطلوب",
      budget: "الميزانية يجب أن تكون رقمًا موجبًا",
      start: "تاريخ البداية مطلوب",
      end: "تاريخ النهاية مطلوب",
      dateOrder: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية",
    };
    const en_msgs = {
      name: "Trip name is required",
      budget: "Budget must be a positive number",
      start: "Start date is required",
      end: "End date is required",
      dateOrder: "End date must be after start date",
    };
    const m = language === "en" ? en_msgs : ar_msgs;

    if (!tripName.trim()) { errors.name = true; messages.push(m.name); }
    if (tripBudget.trim() !== "" && (isNaN(Number(tripBudget)) || Number(tripBudget) < 0)) {
      errors.budget = true; messages.push(m.budget);
    }
    if (tripStart && tripEnd && new Date(tripEnd) < new Date(tripStart)) {
      errors.dateOrder = true; errors.start = true; errors.end = true;
      messages.push(m.dateOrder);
    }

    if (Object.keys(errors).length > 0) {
      setTripErrors(errors);
      appToast.error(messages[0]);
      return;
    }

    setTripErrors({});
    if (editingTripId) {
      updateTrip.mutate({
        id: editingTripId,
        name: tripName,
        destination: tripDest,
        start_date: tripStart,
        end_date: tripEnd,
        budget: Number(tripBudget) || 0,
        shared_with: tripParticipants,
      });
      appToast.success(language === "en" ? "Trip updated" : "تم تعديل الرحلة");
    } else {
      createTrip.mutate({
        name: tripName,
        destination: tripDest,
        start_date: tripStart,
        end_date: tripEnd,
        budget: Number(tripBudget) || 0,
        status: "planning",
        shared_with: tripParticipants,
      });
      setActiveTab(tripParticipants.length > 0 ? "family" : "personal");
      appToast.success(language === "en" ? "Trip created" : "تم إنشاء الرحلة");
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
    deleteTripMut.mutate(deleteTarget);
    if (selectedTrip?.id === deleteTarget) setSelectedTrip(null);
    setDeleteTarget(null);
    setDeleteDrawer(false);
    appToast.success("تم حذف الرحلة");
  };

  const handleAddDay = () => {
    if (!selectedTrip || !dayCity.trim()) return;
    addDayPlan.mutate({
      trip_id: selectedTrip.id,
      day_number: selectedTrip.days.length + 1,
      city: dayCity,
    });
    setDayCity("");
    setNewDayDrawer(false);
    appToast.success("تم إضافة اليوم");
  };

  const openEditDay = (day: DayPlan) => {
    setEditingDayId(day.id);
    setEditDayCity(day.city || "");
    setEditDayDrawer(true);
  };

  const handleSaveDayEdit = () => {
    if (!selectedTrip || !editingDayId) return;
    updateDayPlan.mutate({ id: editingDayId, trip_id: selectedTrip.id, city: editDayCity });
    setEditDayDrawer(false);
    setEditingDayId(null);
    appToast.success("تم تعديل اليوم");
  };

  const openEditActivity = (act: Activity, dayId: string) => {
    setEditingActivityId(act.id);
    setEditingActivityDayId(dayId);
    setEditActName(act.name);
    setEditActTime(act.time || "");
    setEditActLocation(act.location || "");
    setEditActCost(act.cost ? String(act.cost) : "");
    setEditActivityDrawer(true);
  };

  const handleSaveActivityEdit = () => {
    if (!editingActivityId || !editActName.trim()) return;
    updateActivity.mutate({
      id: editingActivityId,
      day_plan_id: editingActivityDayId,
      name: editActName,
      time: editActTime || null,
      location: editActLocation || null,
      cost: Number(editActCost) || 0,
    });
    setEditActivityDrawer(false);
    setEditingActivityId(null);
    appToast.success("تم تعديل النشاط");
  };

  const persistActivity = async () => {
    if (!selectedTrip || !selectedDayId || !activityName.trim()) return;

    const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    let dayPlanId = selectedDayId;

    // If the chosen day is a synthetic placeholder, create the real day plan first
    if (!isUuid(selectedDayId)) {
      const selectedSyntheticDay = selectedTrip.days.find((d) => d.id === selectedDayId);
      const fallbackDayNumber = selectedDayId.startsWith("new-day-")
        ? parseInt(selectedDayId.replace("new-day-", ""), 10)
        : NaN;
      const dayNumber = selectedSyntheticDay?.dayNumber ?? fallbackDayNumber;
      if (!Number.isFinite(dayNumber)) return;

      const existing = selectedTrip.days.find((d) => d.dayNumber === dayNumber && isUuid(d.id));
      if (existing) {
        dayPlanId = existing.id;
      } else {
        const newDayId = crypto.randomUUID();
        try {
          await addDayPlan.mutateAsync({
            id: newDayId,
            trip_id: selectedTrip.id,
            day_number: dayNumber,
            city: selectedSyntheticDay?.city || "",
          });
        } catch {
          /* queued — sync queue will retry in order */
        }
        dayPlanId = newDayId;
      }
    }

    addActivity.mutate({
      day_plan_id: dayPlanId,
      name: activityName,
      time: activityTime || undefined,
      location: activityLocation || undefined,
      cost: Number(activityCost) || 0,
    });
    setActivityName(""); setActivityTime(""); setActivityLocation(""); setActivityCost("");
    setNewActivityDrawer(false);
    setBudgetWarnDrawer(false);
    setPendingActivity(null);
    appToast.success("تم إضافة النشاط");
  };

  const handleAddActivity = async () => {
    if (!selectedTrip || !selectedDayId || !activityName.trim()) return;

    // Check if adding this activity exceeds the trip budget
    const newCost = Number(activityCost) || 0;
    if (selectedTrip.budget > 0 && newCost > 0) {
      const currentActivitiesTotal = selectedTrip.days.reduce(
        (sum, d) => sum + d.activities.reduce((s, a) => s + (a.cost || 0), 0),
        0
      );
      const projectedTotal = currentActivitiesTotal + newCost;
      if (projectedTotal > selectedTrip.budget) {
        setPendingActivity({ overBy: projectedTotal - selectedTrip.budget });
        setBudgetWarnDrawer(true);
        return;
      }
    }

    await persistActivity();
  };

  const handleAddSuggestion = () => {
    if (!selectedTrip || !suggestionName.trim()) return;
    addSuggestion.mutate({
      trip_id: selectedTrip.id,
      place_name: suggestionName,
      type: suggestionType || undefined,
      reason: suggestionReason || undefined,
      location: suggestionLocation || undefined,
    });
    setSuggestionName(""); setSuggestionType(""); setSuggestionReason(""); setSuggestionLocation("");
    setNewSuggestionDrawer(false);
    appToast.success("تم إرسال المقترح");
  };

  const handleSuggestionDecision = (status: "accepted" | "rejected" | "reviewing") => {
    if (!selectedTrip || !reviewingSuggestion) return;
    updateSuggestion.mutate({ id: reviewingSuggestion.id, status });
    setReviewingSuggestion(null);
    setSuggestionReviewDrawer(false);
    appToast.success(status === "accepted" ? "تم قبول المقترح" : status === "rejected" ? "تم رفض المقترح" : "قيد الدراسة");
  };

  const handleAddPackingItem = () => {
    if (!selectedTrip || !packingItemName.trim()) return;
    addPackingItem.mutate({ trip_id: selectedTrip.id, name: packingItemName });
    setPackingItemName("");
    setNewPackingDrawer(false);
    appToast.success("تم إضافة العنصر");
  };

  const handleAddExpense = () => {
    if (!selectedTrip || !expenseName.trim()) return;
    addExpense.mutate({
      trip_id: selectedTrip.id,
      name: expenseName,
      amount: Number(expenseAmount) || 0,
    });
    setExpenseName("");
    setExpenseAmount("");
    setNewExpenseDrawer(false);
    appToast.success("تم إضافة المصروف");
  };

  const handleAddDocument = () => {
    if (!selectedTrip || !docName.trim()) return;
    addDocument.mutate({
      trip_id: selectedTrip.id,
      name: docName,
      type: docType,
      file_url: docFileInput ? URL.createObjectURL(docFileInput) : undefined,
      file_name: docFileInput?.name || "مستند",
      notes: docNotes || undefined,
    });
    setDocName(""); setDocType("ticket"); setDocNotes(""); setDocFileInput(null);
    setNewDocDrawer(false);
    appToast.success("تم إضافة المستند");
  };

  const handleDeleteDocument = (docId: string) => {
    if (!selectedTrip) return;
    deleteDocument.mutate(docId);
    setDocViewDrawer(false);
    setViewingDoc(null);
    appToast.success("تم حذف المستند");
  };

  const togglePackingItem = (itemId: string) => {
    if (!selectedTrip) return;
    const item = selectedTrip.packingList.find(p => p.id === itemId);
    if (item) {
      updatePackingItem.mutate({ id: itemId, packed: !item.packed });
    }
  };


  // Auto-generate days from dates if trip has no days
  const autoGenerateDays = (trip: Trip): Trip => {
    if (trip.days.length > 0 || !trip.startDate || !trip.endDate) return trip;
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const totalDays = differenceInDays(end, start) + 1;
    if (totalDays <= 0) return trip;
    const days: DayPlan[] = Array.from({ length: totalDays }, (_, i) => ({
      id: `auto-${Date.now()}-${i}`,
      dayNumber: i + 1,
      city: trip.destination,
      activities: [],
    }));
    return { ...trip, days };
  };

  const handleSelectTrip = (trip: Trip) => {
    const updated = autoGenerateDays(trip);
    setSelectedTrip(updated);
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
        </PageHeader>

        {/* Sub tabs */}
        <div className="px-4 mt-4">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {[
              { key: "itinerary", label: "خط السير", icon: List },
              ...(selectedTrip.type === "family" || selectedTrip.participants.length > 1
                ? [{ key: "suggestions", label: "المقترحات", icon: Lightbulb }]
                : []),
              { key: "documents", label: "المستندات", icon: FileText },
              { key: "packing", label: "التجهيزات", icon: PackageCheck },
              { key: "calculator", label: "التكاليف", icon: Calculator },
              ...((tripAlbums ?? []).some((a: any) => a.linked_trip_id === selectedTrip.id)
                ? [{ key: "album", label: "ألبوم الرحلة", icon: Camera }]
                : []),
            ].map((tab) => {
              const isActive = tripView === tab.key;
              const activeColors: Record<string, string> = {
                itinerary: "hsl(var(--primary))",
                suggestions: "hsl(40 90% 50%)",
                packing: "hsl(145 45% 40%)",
                calculator: "hsl(280 50% 55%)",
                documents: "hsl(200 65% 50%)",
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

            {selectedTrip.days.map((day) => {
              const isUuidDay = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(day.id);
              const dayCard = (
                <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
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
                    {day.activities.map((act, idx) => {
                      const activityRow = (
                        <div
                          draggable
                          onDragStart={() => handleDragStart(act.id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDrop(day.id, idx)}
                          className="flex items-center gap-3 p-3 bg-card hover:bg-muted/30 cursor-grab active:cursor-grabbing"
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
                      );
                      return (
                        <SwipeableCard
                          key={act.id}
                          actions={[
                            {
                              icon: <Pencil size={18} />,
                              label: "تعديل",
                              color: "bg-primary",
                              onClick: () => openEditActivity(act, day.id),
                            },
                            {
                              icon: <Trash2 size={18} />,
                              label: "حذف",
                              color: "bg-destructive",
                              onClick: () => {
                                deleteActivity.mutate(act.id, day.id);
                                appToast.success("تم حذف النشاط");
                              },
                            },
                          ]}
                        >
                          {activityRow}
                        </SwipeableCard>
                      );
                    })}
                    {day.activities.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-4">لا أنشطة</p>
                    )}
                  </div>
                </div>
              );

              // Only allow swipe-to-delete on real (persisted) days
              if (!isUuidDay) {
                return <div key={day.id}>{dayCard}</div>;
              }
              return (
                <SwipeableCard
                  key={day.id}
                  actions={[
                    {
                      icon: <Pencil size={18} />,
                      label: "تعديل",
                      color: "bg-primary",
                      onClick: () => openEditDay(day),
                    },
                    {
                      icon: <Trash2 size={18} />,
                      label: "حذف",
                      color: "bg-destructive",
                      onClick: () => {
                        deleteDayPlan.mutate(day.id, selectedTrip.id);
                        appToast.success("تم حذف اليوم");
                      },
                    },
                  ]}
                >
                  {dayCard}
                </SwipeableCard>
              );
            })}
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
                role="checkbox"
                aria-checked={item.packed}
                aria-label={`تحديد ${item.name}`}
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
                          deleteExpense.mutate(exp.id);
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

        <FAB
          onClick={() => {
            if (tripView === "itinerary") {
              setSelectedDayId(selectedTrip.days[selectedTrip.days.length - 1]?.id ?? "");
              setNewActivityDrawer(true);
            } else if (tripView === "suggestions") setNewSuggestionDrawer(true);
            else if (tripView === "packing") setNewPackingDrawer(true);
            else if (tripView === "calculator") setNewExpenseDrawer(true);
          }}
          show={
            ["itinerary", "suggestions", "packing", "calculator"].includes(tripView) &&
            !(tripView === "itinerary" && selectedTrip.days.length === 0)
          }
        />

        {/* Album view */}
        {tripView === "album" && (() => {
          const linkedAlbum = (tripAlbums ?? []).find((a: any) => a.linked_trip_id === selectedTrip.id);
          const albumPhotos = (linkedAlbum?.album_photos || []).map((p: any) => ({ id: p.id, url: p.url, date: p.date || "", caption: p.caption }));
          const albumName: string = linkedAlbum?.name || "";

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

        {/* Documents */}
        {tripView === "documents" && (
          <div className="px-5 mt-5 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-foreground">المستندات والوثائق</h3>
                {selectedTrip.documents.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {selectedTrip.documents.length} مستند
                  </p>
                )}
              </div>
              <button onClick={() => setNewDocDrawer(true)} className="p-1.5 rounded-lg bg-primary/10">
                <Plus size={16} className="text-primary" />
              </button>
            </div>

            {selectedTrip.documents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">لا مستندات بعد</p>
                <p className="text-xs mt-1 text-muted-foreground/70">أضف تذاكر السفر، الفيزا، حجوزات الفنادق</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setNewDocDrawer(true)}>
                  <Upload size={14} /> أضف مستند
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedTrip.documents.map((doc) => {
                  const docInfo = DOC_TYPES[doc.type];
                  const DocIcon = docInfo.icon;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => { setViewingDoc(doc); setDocViewDrawer(true); }}
                      className="w-full text-right bg-card rounded-2xl border border-border/50 p-4 shadow-sm active:scale-[0.98] transition-transform"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: docInfo.color.replace(")", " / 0.12)"), color: docInfo.color }}
                        >
                          <DocIcon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{doc.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: docInfo.color.replace(")", " / 0.1)"), color: docInfo.color }}
                            >
                              {docInfo.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{doc.addedAt}</span>
                          </div>
                        </div>
                        <Eye size={16} className="text-muted-foreground shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <FAB onClick={() => setNewDocDrawer(true)} show={tripView === "documents"} />

        {/* Add Document Drawer */}
        <Drawer open={newDocDrawer} onOpenChange={setNewDocDrawer}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>إضافة مستند</DrawerTitle></DrawerHeader>
            <div className="px-5 pb-8 space-y-4">
              <Input placeholder="اسم المستند (مثال: تذكرة الطيران)" value={docName} onChange={(e) => setDocName(e.target.value)} />
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">نوع المستند</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(DOC_TYPES) as [TripDocument["type"], typeof DOC_TYPES[TripDocument["type"]]][]).map(([key, info]) => {
                    const isSelected = docType === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setDocType(key)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                        style={{
                          background: isSelected ? info.color : "hsl(var(--muted))",
                          color: isSelected ? "white" : "hsl(var(--muted-foreground))",
                        }}
                      >
                        <info.icon size={14} />
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">إرفاق ملف (اختياري)</label>
                <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload size={20} className="text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    {docFileInput ? (
                      <p className="text-sm font-medium text-foreground truncate">{docFileInput.name}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">اضغط لاختيار ملف</p>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setDocFileInput(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
              <Input placeholder="ملاحظات (اختياري)" value={docNotes} onChange={(e) => setDocNotes(e.target.value)} />
              <Button className="w-full rounded-xl" onClick={handleAddDocument}>إضافة المستند</Button>
            </div>
          </DrawerContent>
        </Drawer>

        {/* View Document Drawer */}
        <Drawer open={docViewDrawer} onOpenChange={setDocViewDrawer}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>تفاصيل المستند</DrawerTitle></DrawerHeader>
            {viewingDoc && (() => {
              const docInfo = DOC_TYPES[viewingDoc.type];
              const DocIcon = docInfo.icon;
              return (
                <div className="px-5 pb-8 space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ background: docInfo.color.replace(")", " / 0.12)"), color: docInfo.color }}
                    >
                      <DocIcon size={28} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-foreground">{viewingDoc.name}</p>
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-full inline-block mt-1"
                        style={{ background: docInfo.color.replace(")", " / 0.1)"), color: docInfo.color }}
                      >
                        {docInfo.label}
                      </span>
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">اسم الملف</span>
                      <span className="text-xs font-medium text-foreground">{viewingDoc.fileName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">تاريخ الإضافة</span>
                      <span className="text-xs font-medium text-foreground">{viewingDoc.addedAt}</span>
                    </div>
                    {viewingDoc.notes && (
                      <div className="pt-2 border-t border-border/30">
                        <span className="text-xs text-muted-foreground">ملاحظات</span>
                        <p className="text-sm text-foreground mt-1">{viewingDoc.notes}</p>
                      </div>
                    )}
                  </div>
                  {viewingDoc.fileUrl && (
                    <Button className="w-full rounded-xl" variant="outline" onClick={() => window.open(viewingDoc.fileUrl, "_blank")}>
                      <Eye size={16} /> عرض الملف
                    </Button>
                  )}
                  <Button className="w-full rounded-xl" variant="destructive" onClick={() => handleDeleteDocument(viewingDoc.id)}>
                    <Trash2 size={16} /> حذف المستند
                  </Button>
                </div>
              );
            })()}
          </DrawerContent>
        </Drawer>


        {/* Edit Day Drawer */}
        <Drawer open={editDayDrawer} onOpenChange={setEditDayDrawer}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>تعديل اليوم</DrawerTitle></DrawerHeader>
            <div className="px-5 pb-8 space-y-4">
              <Input placeholder="المدينة / المنطقة" value={editDayCity} onChange={(e) => setEditDayCity(e.target.value)} />
              <Button className="w-full rounded-xl" onClick={handleSaveDayEdit}>حفظ</Button>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Edit Activity Drawer */}
        <Drawer open={editActivityDrawer} onOpenChange={setEditActivityDrawer}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>تعديل النشاط</DrawerTitle></DrawerHeader>
            <div className="px-5 pb-8 space-y-4">
              <Input placeholder="اسم النشاط" value={editActName} onChange={(e) => setEditActName(e.target.value)} />
              <Input type="time" placeholder="الوقت" value={editActTime} onChange={(e) => setEditActTime(e.target.value)} />
              <Input placeholder="الموقع" value={editActLocation} onChange={(e) => setEditActLocation(e.target.value)} />
              <Input type="number" inputMode="decimal" placeholder="التكلفة" value={editActCost} onChange={(e) => setEditActCost(e.target.value)} dir="ltr" />
              <Button className="w-full rounded-xl" onClick={handleSaveActivityEdit}>حفظ</Button>
            </div>
          </DrawerContent>
        </Drawer>

        <Drawer open={newDayDrawer} onOpenChange={setNewDayDrawer}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>إضافة يوم جديد</DrawerTitle></DrawerHeader>
            <div className="px-5 pb-8 space-y-4">
              {selectedTrip.startDate && selectedTrip.endDate && (() => {
                const start = new Date(selectedTrip.startDate);
                const end = new Date(selectedTrip.endDate);
                const totalDays = differenceInDays(end, start) + 1;
                const existingDayNumbers = selectedTrip.days.map(d => d.dayNumber);
                const availableDays = Array.from({ length: totalDays }, (_, i) => i + 1)
                  .filter(n => !existingDayNumbers.includes(n));
                if (availableDays.length > 0) {
                  return (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-2 block">اختر اليوم</label>
                      <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto scrollbar-hide">
                        {availableDays.map((dayNum) => {
                          const date = addDays(start, dayNum - 1);
                          return (
                            <button
                              key={dayNum}
                              onClick={() => setDayCity(prev => prev || selectedTrip.destination)}
                              className="py-2 rounded-lg text-xs font-bold transition-all bg-muted text-muted-foreground text-center"
                            >
                              <span className="block">{format(date, "EEEE", { locale: ar })}</span>
                              <span className="block text-[10px] opacity-75">{format(date, "d MMM", { locale: ar })}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return <p className="text-xs text-muted-foreground text-center">جميع أيام الرحلة مضافة بالفعل</p>;
              })()}
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
              <Input
                placeholder="اسم النشاط"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                className="h-[60px] border-0 border-b-2 border-border rounded-none bg-transparent text-lg font-bold pt-7 pb-2 px-0 outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary transition-colors placeholder:text-muted-foreground/50 placeholder:font-normal"
              />
              <Input
                type="time"
                placeholder="الوقت"
                value={activityTime}
                onChange={(e) => setActivityTime(e.target.value)}
                className="h-[60px] border-0 border-b-2 border-border rounded-none bg-transparent text-lg font-bold pt-7 pb-2 px-0 outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary transition-colors placeholder:text-muted-foreground/50 placeholder:font-normal"
              />
              <Input
                placeholder="الموقع"
                value={activityLocation}
                onChange={(e) => setActivityLocation(e.target.value)}
                className="h-[60px] border-0 border-b-2 border-border rounded-none bg-transparent text-lg font-bold pt-7 pb-2 px-0 outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary transition-colors placeholder:text-muted-foreground/50 placeholder:font-normal"
              />
              <Input
                type="number"
                inputMode="decimal"
                placeholder="التكلفة التقديرية"
                value={activityCost}
                onChange={(e) => setActivityCost(e.target.value)}
                dir="ltr"
                className="h-[60px] border-0 border-b-2 border-border rounded-none bg-transparent text-lg font-bold pt-7 pb-2 px-0 outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary transition-colors placeholder:text-muted-foreground/50 placeholder:font-normal"
              />
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
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">اختر اليوم</label>
                    <div className="grid grid-cols-4 gap-2 max-h-[240px] overflow-y-auto p-1 -m-1">
                      {allDays.map((d) => {
                        const dayId = d.dayPlan?.id || `new-day-${d.index + 1}`;
                        return (
                          <button
                            key={dayId}
                            onClick={() => setSelectedDayId(dayId)}
                            className={`px-2 py-2.5 rounded-xl text-sm font-bold transition-all text-center w-full ${
                              selectedDayId === dayId ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <span className="block text-xs truncate">{format(d.date, "EEEE", { locale: ar })}</span>
                            <span className="block text-[11px] opacity-75 mt-0.5 truncate">{format(d.date, "d MMM", { locale: ar })}</span>
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

        {/* Over-Budget Warning Drawer */}
        <Drawer open={budgetWarnDrawer} onOpenChange={(o) => { setBudgetWarnDrawer(o); if (!o) setPendingActivity(null); }}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-destructive">تنبيه: تجاوز الميزانية</DrawerTitle>
              <DrawerDescription>
                إضافة هذا النشاط ستجعل إجمالي تكاليف الأنشطة يتجاوز ميزانية الرحلة بمقدار{" "}
                <span className="font-bold text-destructive">{pendingActivity?.overBy.toLocaleString()}</span>.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter className="flex flex-col gap-2 px-5 pb-8">
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => { setBudgetWarnDrawer(false); setPendingActivity(null); }}
              >
                <ChevronLeft size={16} /> العودة والتعديل
              </Button>
              <Button
                variant="destructive"
                className="w-full rounded-xl"
                onClick={() => { void persistActivity(); }}
              >
                المتابعة على أي حال
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

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
              <Input type="number" inputMode="decimal" placeholder="المبلغ" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} dir="ltr" />
              <Button className="w-full rounded-xl" onClick={handleAddExpense}>إضافة</Button>
            </div>
          </DrawerContent>
        </Drawer>

        {/* New/Edit Trip Drawer */}
        <Drawer open={newTripDrawer} onOpenChange={(o) => { setNewTripDrawer(o); if (!o) resetTripForm(); }}>
          <DrawerContent dir="rtl">
            <DrawerHeader className="text-right pb-1">
              <DrawerTitle className="text-lg">{editingTripId ? "تعديل الرحلة" : "رحلة جديدة"}</DrawerTitle>
              <DrawerDescription className="text-xs">اكتب اسم الرحلة، الميزانية، التواريخ، واختر المشاركين</DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto space-y-5 px-4 pb-3">
              {/* اسم الرحلة — Underline */}
              <div className="space-y-2 px-1">
                <div className="relative">
                  <label className="absolute right-0 top-2 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">اسم الرحلة</label>
                  <Input
                    placeholder="مثال: رحلة إسطنبول"
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    className="h-[60px] border-0 border-b-2 border-border rounded-none bg-transparent text-lg font-bold pt-7 pb-2 px-0 outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary transition-colors placeholder:text-muted-foreground/50 placeholder:font-normal"
                  />
                </div>
              </div>

              {/* مصاريف الرحلة — Underline */}
              <div className="space-y-2 px-1">
                <div className="relative">
                  <label className="absolute right-0 top-2 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">مصاريف الرحلة</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={tripBudget}
                    onChange={(e) => setTripBudget(e.target.value)}
                    dir="ltr"
                    className="h-[60px] border-0 border-b-2 border-border rounded-none bg-transparent text-lg font-bold pt-7 pb-2 px-0 outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary transition-colors placeholder:text-muted-foreground/50 placeholder:font-normal text-right"
                  />
                </div>
              </div>

              {/* التواريخ — Underline */}
              <div className="grid grid-cols-2 gap-4 px-1">
                <div className="relative">
                  <label className="absolute right-0 top-2 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">من</label>
                  <Input
                    type="date"
                    value={tripStart}
                    onChange={(e) => setTripStart(e.target.value)}
                    dir="ltr"
                    className="h-[60px] border-0 border-b-2 border-border rounded-none bg-transparent text-sm font-bold pt-7 pb-2 px-0 outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary transition-colors"
                  />
                </div>
                <div className="relative">
                  <label className="absolute right-0 top-2 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">إلى</label>
                  <Input
                    type="date"
                    value={tripEnd}
                    onChange={(e) => setTripEnd(e.target.value)}
                    dir="ltr"
                    className="h-[60px] border-0 border-b-2 border-border rounded-none bg-transparent text-sm font-bold pt-7 pb-2 px-0 outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary transition-colors"
                  />
                </div>
              </div>

              {/* المشاركون — دوائر */}
              {familyMembers.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-sm font-bold text-foreground">مشاركة مع</p>
                    {tripParticipants.length > 0 && (
                      <button
                        onClick={() => setTripParticipants([])}
                        className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
                      >
                        إلغاء التحديد
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3 overflow-x-auto py-3 -mx-1 px-2 scrollbar-hide">
                    {familyMembers.map((member) => {
                      const isActive = tripParticipants.includes(member.id);
                      const initial = (member.name || "?").trim().charAt(0);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => setTripParticipants((prev) => isActive ? prev.filter((id) => id !== member.id) : [...prev, member.id])}
                          className={`shrink-0 flex flex-col items-center gap-1.5 transition-all duration-300 focus:outline-none ${
                            isActive ? "" : "opacity-60 hover:opacity-100"
                          }`}
                        >
                          <div
                            className={`relative w-12 h-12 rounded-full flex items-center justify-center text-base font-black bg-gradient-to-br from-primary/15 to-primary/5 text-primary transition-all duration-300 ${
                              isActive
                                ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md"
                                : "ring-0"
                            }`}
                          >
                            {initial}
                            {isActive && (
                              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md animate-in zoom-in duration-200">
                                <Check size={12} className="text-primary-foreground" strokeWidth={3} />
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] leading-tight text-center max-w-[60px] truncate ${
                            isActive ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                          }`}>
                            {member.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <DrawerFooter className="flex-row gap-2 pt-3">
              <Button onClick={handleSaveTrip} className="flex-[2] rounded-2xl h-12 font-bold text-base shadow-md">
                <Plus size={18} className="ml-1" />
                {editingTripId ? "حفظ التعديلات" : "إنشاء الرحلة"}
              </Button>
              <Button variant="outline" onClick={() => { setNewTripDrawer(false); resetTripForm(); }} className="flex-1 rounded-2xl h-12">إلغاء</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  // Trip list view
  return (
    <div className="min-h-screen bg-background pb-32" dir="rtl">
      <PageHeader title="الرحلات" subtitle="خطط لرحلاتك العائلية والشخصية" />

      {/* Sticky segmented tabs — Underline */}
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-md px-5 pt-2 border-b border-border/40">
        <div className="relative flex items-center h-12">
          {[
            { value: "family", icon: Users, label: "رحلات عائلية" },
            { value: "personal", icon: Plane, label: "رحلات شخصية" },
          ].map(({ value, icon: Icon, label }) => {
            const active = activeTab === value;
            return (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={`relative flex-1 h-full flex items-center justify-center gap-1.5 text-sm font-bold transition-colors duration-200 ${
                  active ? "text-primary" : "text-muted-foreground/70 hover:text-foreground"
                }`}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                {label}
                {active && (
                  <span className="absolute -bottom-px left-1/2 -translate-x-1/2 h-[3px] w-16 rounded-t-full bg-accent transition-all duration-300" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {tripsLoading ? (
        <CardContentSkeleton />
      ) : (
      <PullToRefresh onRefresh={async () => {}}>
        <div className="px-5 mt-4 space-y-3">
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
                actions={[
                  { icon: <Pencil size={16} />, label: "تعديل", color: "bg-primary", onClick: () => handleEditTrip(trip) },
                  { icon: <Trash2 size={16} />, label: "حذف", color: "bg-destructive", onClick: () => { setDeleteTarget(trip.id); setDeleteDrawer(true); } },
                ]}
                onSwipeOpen={() => setOpenTripCardId(trip.id)}
              >
                <button
                  onClick={() => {
                    if (openTripCardId === trip.id) {
                      setOpenTripCardId(null);
                      return;
                    }
                    handleSelectTrip(trip);
                  }}
                  className="w-full text-right p-4 bg-card hover:bg-card/80 active:bg-muted/60 rounded-2xl border border-border/60 shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-foreground truncate">{trip.name}</h3>
                      {trip.startDate && (
                        <p className="text-[13px] mt-1.5 flex items-center gap-1.5 font-medium" style={{ color: "hsl(145 45% 35%)" }}>
                          <Calendar size={13} />
                          {format(new Date(trip.startDate), "d MMM", { locale: ar })}
                          {trip.endDate && ` — ${format(new Date(trip.endDate), "d MMM", { locale: ar })}`}
                        </p>
                      )}
                    </div>
                    <div className="text-left shrink-0 flex flex-col items-end">
                      {trip.budget > 0 && (
                        <p className="text-base font-extrabold" style={{ color: "hsl(var(--accent))" }}>{trip.budget.toLocaleString()}</p>
                      )}
                      {(() => {
                        let daysCount = trip.days.length;
                        if (trip.startDate && trip.endDate) {
                          const start = new Date(trip.startDate);
                          const end = new Date(trip.endDate);
                          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                            const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
                            if (diff > 0) daysCount = diff;
                          }
                        } else if (trip.startDate && !trip.endDate) {
                          daysCount = Math.max(daysCount, 1);
                        }
                        return (
                          <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">{daysCount} {language === "en" ? "days" : "أيام"}</p>
                        );
                      })()}
                    </div>
                  </div>
                </button>

              </SwipeableCard>
            );
          })}
        </div>
      </PullToRefresh>
      )}

      <FAB onClick={() => { resetTripForm(); setNewTripDrawer(true); }} />

      {/* New/Edit Trip Drawer */}
      <Drawer open={newTripDrawer} onOpenChange={(o) => { setNewTripDrawer(o); if (!o) resetTripForm(); }}>
        <DrawerContent dir="rtl">
          <DrawerHeader className="text-right pb-1">
            <DrawerTitle className="text-lg">{editingTripId ? "تعديل الرحلة" : "رحلة جديدة"}</DrawerTitle>
            <DrawerDescription className="text-xs">اكتب اسم الرحلة، الميزانية، التواريخ، واختر المشاركين</DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto space-y-5 px-4 pb-3">
            {/* اسم الرحلة */}
            <div className="space-y-2 px-1">
              <div className="relative">
                <label className={`absolute right-0 top-2 text-[10px] font-bold uppercase tracking-wider ${tripErrors.name ? "text-destructive" : "text-muted-foreground/70"}`}>{language === "en" ? "Trip name" : "اسم الرحلة"}</label>
                <Input
                  placeholder={language === "en" ? "e.g. Istanbul trip" : "مثال: رحلة إسطنبول"}
                  value={tripName}
                  onChange={(e) => { setTripName(e.target.value); if (tripErrors.name) setTripErrors((p) => ({ ...p, name: false })); }}
                  className={`h-[60px] border-0 border-b-2 rounded-none bg-transparent text-lg font-bold pt-7 pb-2 px-0 outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors placeholder:text-muted-foreground/50 placeholder:font-normal ${tripErrors.name ? "border-destructive focus-visible:border-destructive" : "border-border focus-visible:border-primary"}`}
                />
              </div>
            </div>

            {/* مصاريف الرحلة */}
            <div className="space-y-2 px-1">
              <div className="relative">
                <label className={`absolute right-0 top-2 text-[10px] font-bold uppercase tracking-wider ${tripErrors.budget ? "text-destructive" : "text-muted-foreground/70"}`}>{language === "en" ? "Budget" : "مصاريف الرحلة"}</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={tripBudget}
                  onChange={(e) => { setTripBudget(e.target.value); if (tripErrors.budget) setTripErrors((p) => ({ ...p, budget: false })); }}
                  dir="ltr"
                  className={`h-[60px] border-0 border-b-2 rounded-none bg-transparent text-lg font-bold pt-7 pb-2 px-0 outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors placeholder:text-muted-foreground/50 placeholder:font-normal text-right ${tripErrors.budget ? "border-destructive focus-visible:border-destructive" : "border-border focus-visible:border-primary"}`}
                />
              </div>
            </div>

            {/* التواريخ */}
            <div className="grid grid-cols-2 gap-4 px-1">
              <div className="relative">
                <label className={`absolute right-0 top-2 text-[10px] font-bold uppercase tracking-wider ${tripErrors.start || tripErrors.dateOrder ? "text-destructive" : "text-muted-foreground/70"}`}>{language === "en" ? "From" : "من"}</label>
                <Input
                  type="date"
                  value={tripStart}
                  onChange={(e) => { setTripStart(e.target.value); if (tripErrors.start || tripErrors.dateOrder) setTripErrors((p) => ({ ...p, start: false, dateOrder: false })); }}
                  dir="ltr"
                  className={`h-[60px] border-0 border-b-2 rounded-none bg-transparent text-sm font-bold pt-7 pb-2 px-0 outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors ${tripErrors.start || tripErrors.dateOrder ? "border-destructive focus-visible:border-destructive" : "border-border focus-visible:border-primary"}`}
                />
              </div>
              <div className="relative">
                <label className={`absolute right-0 top-2 text-[10px] font-bold uppercase tracking-wider ${tripErrors.end || tripErrors.dateOrder ? "text-destructive" : "text-muted-foreground/70"}`}>{language === "en" ? "To" : "إلى"}</label>
                <Input
                  type="date"
                  value={tripEnd}
                  onChange={(e) => { setTripEnd(e.target.value); if (tripErrors.end || tripErrors.dateOrder) setTripErrors((p) => ({ ...p, end: false, dateOrder: false })); }}
                  dir="ltr"
                  className={`h-[60px] border-0 border-b-2 rounded-none bg-transparent text-sm font-bold pt-7 pb-2 px-0 outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors ${tripErrors.end || tripErrors.dateOrder ? "border-destructive focus-visible:border-destructive" : "border-border focus-visible:border-primary"}`}
                />
              </div>
            </div>

            {/* مشاركة مع — دوائر */}
            {familyMembers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className="text-sm font-bold text-foreground">مشاركة مع</p>
                  {tripParticipants.length > 0 && (
                    <button
                      onClick={() => setTripParticipants([])}
                      className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
                    >
                      إلغاء التحديد
                    </button>
                  )}
                </div>
                <div className="flex gap-3 overflow-x-auto py-3 -mx-1 px-2 scrollbar-hide">
                  {familyMembers.map((member) => {
                    const isActive = tripParticipants.includes(member.id);
                    const initial = (member.name || "?").trim().charAt(0);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setTripParticipants((prev) => isActive ? prev.filter((id) => id !== member.id) : [...prev, member.id])}
                        className={`shrink-0 flex flex-col items-center gap-1.5 transition-all duration-300 focus:outline-none ${
                          isActive ? "" : "opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div
                          className={`relative w-12 h-12 rounded-full flex items-center justify-center text-base font-black bg-gradient-to-br from-primary/15 to-primary/5 text-primary transition-all duration-300 ${
                            isActive
                              ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md"
                              : "ring-0"
                          }`}
                        >
                          {initial}
                          {isActive && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md animate-in zoom-in duration-200">
                              <Check size={12} className="text-primary-foreground" strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] leading-tight text-center max-w-[60px] truncate ${
                          isActive ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                        }`}>
                          {member.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DrawerFooter className="flex-row gap-2 pt-3">
            <Button onClick={handleSaveTrip} className="flex-[2] rounded-2xl h-12 font-bold text-base shadow-md">
              <Plus size={18} className="ml-1" />
              {editingTripId ? "حفظ التعديلات" : "إنشاء الرحلة"}
            </Button>
            <Button variant="outline" onClick={() => { setNewTripDrawer(false); resetTripForm(); }} className="flex-1 rounded-2xl h-12">إلغاء</Button>
          </DrawerFooter>
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

