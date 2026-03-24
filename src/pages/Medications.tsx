import { useState, useEffect, useRef, useCallback } from "react";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useMedications } from "@/hooks/useMedications";
import {
  Plus, Pill, Check, Clock, Bell, BellRing, Pencil, Trash2,
  AlertTriangle, User, ChevronDown, Calendar, Hash, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import PageHeader from "@/components/PageHeader";
import {
  Medication,
  FrequencyType,
  MEDICATION_COLORS,
  WEEKDAYS,
  calculateNextDue,
  isMedicationDue,
  formatFrequency,
  getTimeUntilNext,
} from "@/data/medicationData";
import { toast } from "sonner";

/* ─── Swipeable Card ─── */
const SwipeableMedCard = ({
  children,
  onEdit,
  onDelete,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const isSwiping = useRef(false);
  const [offset, setOffset] = useState(0);
  const [locked, setLocked] = useState(false);
  const actionWidth = 120;
  const threshold = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    isSwiping.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping.current) return;
    currentX.current = e.touches[0].clientX;
    let diff = currentX.current - startX.current;
    if (locked) diff += actionWidth;
    const clamped = Math.max(0, Math.min(actionWidth + 20, diff));
    setOffset(clamped);
  };

  const handleTouchEnd = () => {
    isSwiping.current = false;
    if (offset > threshold && !locked) {
      setOffset(actionWidth);
      setLocked(true);
    } else if (offset < threshold && locked) {
      setOffset(0);
      setLocked(false);
    } else if (locked) {
      setOffset(actionWidth);
    } else {
      setOffset(0);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Action buttons behind card */}
      <div
        className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2 rounded-2xl"
        style={{ width: `${actionWidth}px` }}
      >
        <button
          onClick={() => { setOffset(0); setLocked(false); onEdit(); }}
          className="flex-1 h-full flex items-center justify-center bg-primary rounded-xl"
        >
          <Pencil className="w-4 h-4 text-primary-foreground" />
        </button>
        <button
          onClick={() => { setOffset(0); setLocked(false); onDelete(); }}
          className="flex-1 h-full flex items-center justify-center bg-destructive rounded-xl"
        >
          <Trash2 className="w-4 h-4 text-destructive-foreground" />
        </button>
      </div>
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (locked) { setOffset(0); setLocked(false); } }}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isSwiping.current ? "none" : "transform 0.3s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const Medications = () => {
  const { members: familyMembers } = useFamilyMembers();
  const { medications: dbMeds, isLoading: medsLoading, addMedication: addMedMut, updateMedication: updateMedMut, deleteMedication: deleteMedMut, addLog: addLogMut } = useMedications();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [showDueAlert, setShowDueAlert] = useState<Medication | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Medication | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState<Medication | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDosage, setFormDosage] = useState("");
  const [formMemberId, setFormMemberId] = useState("me");
  const [formMemberName, setFormMemberName] = useState("أنا");
  const [formFreqType, setFormFreqType] = useState<FrequencyType>("daily");
  const [formFreqValue, setFormFreqValue] = useState(1);
  const [formSelectedDays, setFormSelectedDays] = useState<number[]>([]);
  const [formTimesPerDay, setFormTimesPerDay] = useState(1);
  const [formTimes, setFormTimes] = useState<string[]>(["08:00"]);
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [formEndDate, setFormEndDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formColor, setFormColor] = useState(MEDICATION_COLORS[0]);
  const [formReminderEnabled, setFormReminderEnabled] = useState(true);

  useEffect(() => {
    const checkDue = () => {
      const dueMed = medications.find((m) => isMedicationDue(m));
      if (dueMed && !showDueAlert) setShowDueAlert(dueMed);
    };
    checkDue();
    const interval = setInterval(checkDue, 60000);
    return () => clearInterval(interval);
  }, [showDueAlert, medications]);

  useEffect(() => {
    const updated = medications.map((med) => ({
      ...med,
      reminder: { ...med.reminder, nextDueAt: calculateNextDue(med) },
    }));
    const hasChanges = updated.some((m, i) => m.reminder.nextDueAt !== medications[i].reminder.nextDueAt);
    if (hasChanges) setMedications(updated);
  }, []);

  useEffect(() => {
    if (dbMeds && dbMeds.length > 0) {
      const mapped: Medication[] = dbMeds.map((m: any) => {
        const takenLog = Array.isArray(m.medication_logs)
          ? m.medication_logs
              .filter((log: any) => !log.skipped)
              .map((log: any) => log.taken_at || log.created_at)
              .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())
          : [];

        const mappedMedication: Medication = {
          id: m.id,
          name: m.name,
          dosage: m.dosage || "",
          memberId: m.member_id || "me",
          memberName: m.member_name || "أنا",
          frequencyType: (m.frequency_type || "daily") as FrequencyType,
          frequencyValue: m.frequency_value || 1,
          selectedDays: m.selected_days || [],
          timesPerDay: m.times_per_day || 1,
          specificTimes: m.specific_times || ["08:00"],
          startDate: m.start_date || "",
          endDate: m.end_date || "",
          notes: m.notes || "",
          color: m.color || MEDICATION_COLORS[0],
          reminder: {
            id: m.id,
            enabled: m.reminder_enabled || false,
            lastConfirmedAt: takenLog[0],
            nextDueAt: "",
          },
          takenLog,
          createdAt: m.created_at,
        };

        mappedMedication.reminder.nextDueAt = calculateNextDue(mappedMedication);
        return mappedMedication;
      });
      setMedications(mapped);
    }
  }, [dbMeds]);

  useEffect(() => {
    if (!showDetailSheet) return;
    const latestMedication = medications.find((m) => m.id === showDetailSheet.id);
    if (!latestMedication) return;

    const hasChanged =
      latestMedication.reminder.nextDueAt !== showDetailSheet.reminder.nextDueAt ||
      latestMedication.reminder.lastConfirmedAt !== showDetailSheet.reminder.lastConfirmedAt ||
      latestMedication.takenLog.length !== showDetailSheet.takenLog.length;

    if (hasChanged) {
      setShowDetailSheet(latestMedication);
    }
  }, [medications, showDetailSheet]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!showDueAlert) return;
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`💊 وقت الدواء!`, {
        body: `حان وقت تناول ${showDueAlert.name} - ${showDueAlert.memberName}`,
        icon: "/favicon.ico",
      });
    }
  }, [showDueAlert]);

  const resetForm = () => {
    setFormName(""); setFormDosage(""); setFormMemberId("me"); setFormMemberName("أنا");
    setFormFreqType("daily"); setFormFreqValue(1); setFormSelectedDays([]);
    setFormTimesPerDay(1); setFormTimes(["08:00"]);
    setFormStartDate(new Date().toISOString().split("T")[0]); setFormEndDate("");
    setFormNotes(""); setFormColor(MEDICATION_COLORS[0]); setFormReminderEnabled(true);
    setEditingMed(null);
  };

  const openAddDrawer = () => { resetForm(); setShowAddDrawer(true); };

  const openEditDrawer = (med: Medication) => {
    setEditingMed(med);
    setFormName(med.name); setFormDosage(med.dosage); setFormMemberId(med.memberId);
    setFormMemberName(med.memberName);
    setFormFreqType(med.frequencyType === "daily" || med.frequencyType === "specific_days" ? med.frequencyType : "daily");
    setFormFreqValue(med.frequencyValue); setFormSelectedDays(med.selectedDays || []);
    setFormTimesPerDay(med.timesPerDay || 1); setFormTimes(med.specificTimes || ["08:00"]);
    setFormStartDate(med.startDate); setFormEndDate(med.endDate || "");
    setFormNotes(med.notes || ""); setFormColor(med.color);
    setFormReminderEnabled(med.reminder.enabled);
    setShowAddDrawer(true);
  };

  const handleSave = () => {
    if (!formName.trim()) { toast.error("يرجى إدخال اسم الدواء"); return; }
    if (!formDosage.trim()) { toast.error("يرجى إدخال الجرعة"); return; }

    const baseMed = {
      name: formName.trim(), dosage: formDosage.trim(), memberId: formMemberId,
      memberName: formMemberName, frequencyType: formFreqType, frequencyValue: 1,
      selectedDays: formFreqType === "specific_days" ? formSelectedDays : undefined,
      timesPerDay: formTimesPerDay, specificTimes: formTimes.filter(Boolean),
      startDate: formStartDate, endDate: formEndDate || undefined,
      notes: formNotes.trim() || undefined, color: formColor,
    };

    if (editingMed) {
      updateMedMut.mutate({
        id: editingMed.id, name: baseMed.name, dosage: baseMed.dosage,
        member_id: baseMed.memberId, member_name: baseMed.memberName,
        frequency_type: baseMed.frequencyType, frequency_value: baseMed.frequencyValue,
        selected_days: baseMed.selectedDays, times_per_day: baseMed.timesPerDay,
        specific_times: baseMed.specificTimes, start_date: baseMed.startDate,
        end_date: baseMed.endDate, notes: baseMed.notes, color: baseMed.color,
        reminder_enabled: formReminderEnabled,
      });
      setMedications((prev) =>
        prev.map((m) => {
          if (m.id !== editingMed.id) return m;
          const updated = { ...m, ...baseMed, reminder: { ...m.reminder, enabled: formReminderEnabled } };
          updated.reminder.nextDueAt = calculateNextDue(updated);
          return updated;
        })
      );
      toast.success("تم تحديث الدواء");
    } else {
      addMedMut.mutate({
        name: baseMed.name, dosage: baseMed.dosage, member_id: baseMed.memberId,
        member_name: baseMed.memberName, frequency_type: baseMed.frequencyType,
        frequency_value: baseMed.frequencyValue, selected_days: baseMed.selectedDays as number[],
        times_per_day: baseMed.timesPerDay, specific_times: baseMed.specificTimes,
        start_date: baseMed.startDate, end_date: baseMed.endDate,
        notes: baseMed.notes, color: baseMed.color, reminder_enabled: formReminderEnabled,
      });
      const newMed: Medication = {
        id: crypto.randomUUID(), ...baseMed,
        reminder: { id: crypto.randomUUID(), enabled: formReminderEnabled, nextDueAt: "" },
        takenLog: [], createdAt: new Date().toISOString(),
      };
      newMed.reminder.nextDueAt = calculateNextDue(newMed);
      setMedications((prev) => [...prev, newMed]);
      toast.success(`تمت إضافة ${newMed.name}`);
    }
    setShowAddDrawer(false); resetForm();
  };

  const markAsTaken = (medId: string) => {
    const now = new Date().toISOString();
    addLogMut.mutate({ medication_id: medId });

    setMedications((prev) =>
      prev.map((m) => {
        if (m.id !== medId) return m;
        const updated = {
          ...m,
          takenLog: [...m.takenLog, now],
          reminder: { ...m.reminder, lastConfirmedAt: now },
        };
        updated.reminder.nextDueAt = calculateNextDue(updated);
        return updated;
      })
    );
    setShowDueAlert((prev) => (prev?.id === medId ? null : prev));
    toast.success("تم تسجيل تناول الدواء ✅");
  };

  const skipMedication = (medId: string) => {
    setMedications((prev) =>
      prev.map((m) => {
        if (m.id !== medId) return m;
        const updated = { ...m };
        updated.reminder.nextDueAt = calculateNextDue(updated);
        const next = new Date(updated.reminder.nextDueAt);
        next.setDate(next.getDate() + 1);
        updated.reminder.nextDueAt = next.toISOString();
        return updated;
      })
    );
    setShowDueAlert(null);
    toast("تم تخطي الجرعة", { icon: "⏭️" });
  };

  const handleDeleteMedication = (medId: string) => {
    deleteMedMut.mutate(medId);
    setMedications((prev) => prev.filter((m) => m.id !== medId));
    setShowDeleteConfirm(null);
    setShowDetailSheet(null);
    toast.success("تم حذف الدواء");
  };

  const handleTimesPerDayChange = (count: number) => {
    setFormTimesPerDay(count);
    const times: string[] = [];
    const interval = Math.floor(24 / count);
    for (let i = 0; i < count; i++) {
      const hour = (8 + i * interval) % 24;
      times.push(`${hour.toString().padStart(2, "0")}:00`);
    }
    setFormTimes(times);
  };

  const dueMedications = medications.filter(isMedicationDue);
  const activeMedications = medications.filter((m) => {
    if (m.endDate && new Date(m.endDate) < new Date()) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto pb-24">
      <PageHeader
        title="الأدوية والتذكيرات"
        actions={[
          { icon: <Plus size={20} className="text-white" />, onClick: openAddDrawer },
        ]}
      />

      {/* Due Alert Banner */}
      {dueMedications.length > 0 && (
        <div className="px-5 mt-4">
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-right">
              <BellRing className="w-5 h-5 text-destructive animate-pulse" />
              <span className="font-bold text-destructive text-sm">
                لديك {dueMedications.length} {dueMedications.length === 1 ? "دواء مستحق" : "أدوية مستحقة"}!
              </span>
            </div>
            {dueMedications.map((med) => (
              <div key={med.id} className="flex items-center gap-3 bg-background rounded-xl p-3 border border-border/50">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: med.color + "20" }}>
                  <Pill className="w-5 h-5" style={{ color: med.color }} />
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="font-bold text-sm text-foreground">{med.name}</p>
                  <p className="text-xs text-muted-foreground">{med.dosage} - {med.memberName}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => skipMedication(med.id)} className="text-xs h-8">لاحقاً</Button>
                  <Button size="sm" onClick={() => markAsTaken(med.id)} className="text-xs h-8 gap-1">
                    <Check className="w-3 h-3" />أخذته
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medications List */}
      <div className="px-5 mt-6 space-y-3">
        {activeMedications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Pill className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">لا يوجد أدوية</h3>
            <p className="text-sm text-muted-foreground mb-6">أضف دواء لمتابعة مواعيده وتلقي التذكيرات</p>
            <Button onClick={openAddDrawer} className="gap-2">
              <Plus className="w-4 h-4" />إضافة دواء
            </Button>
          </div>
        ) : (
          activeMedications.map((med) => {
            const isDue = isMedicationDue(med);
            const takenToday = med.takenLog.some((t) => new Date(t).toDateString() === new Date().toDateString());

            return (
              <SwipeableMedCard
                key={med.id}
                onEdit={() => { setShowDetailSheet(null); openEditDrawer(med); }}
                onDelete={() => setShowDeleteConfirm(med)}
              >
                <div
                  className={`bg-card rounded-2xl p-4 border transition-colors cursor-pointer ${
                    isDue ? "border-destructive/50 bg-destructive/5" : "border-border/50"
                  }`}
                  onClick={() => setShowDetailSheet(med)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: med.color + "20" }}>
                      <Pill className="w-6 h-6" style={{ color: med.color }} />
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground">{med.name}</h3>
                        {isDue && (
                          <Badge variant="destructive" className="text-[10px] gap-0.5">
                            <AlertTriangle className="w-3 h-3" />مستحق
                          </Badge>
                        )}
                        {takenToday && !isDue && (
                          <Badge className="text-[10px] gap-0.5 bg-green-500">
                            <Check className="w-3 h-3" />تم
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{med.dosage} • {formatFrequency(med)}</p>
                    </div>
                    <div className="text-left shrink-0">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{med.memberName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{getTimeUntilNext(med.reminder.nextDueAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {med.reminder.enabled ? (
                        <Bell className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      {med.specificTimes && med.specificTimes.length > 0 && (
                        <span className="text-muted-foreground">{med.specificTimes.join(" • ")}</span>
                      )}
                    </div>
                  </div>

                  {med.frequencyType === "daily" && med.timesPerDay && med.timesPerDay > 1 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>اليوم</span>
                        <span>{med.takenLog.filter((t) => new Date(t).toDateString() === new Date().toDateString()).length}/{med.timesPerDay}</span>
                      </div>
                      <Progress
                        value={(med.takenLog.filter((t) => new Date(t).toDateString() === new Date().toDateString()).length / med.timesPerDay) * 100}
                        className="h-1.5"
                      />
                    </div>
                  )}
                </div>
              </SwipeableMedCard>
            );
          })
        )}
      </div>

      {/* Detail Summary Bottom Sheet */}
      <Drawer open={!!showDetailSheet} onOpenChange={(open) => !open && setShowDetailSheet(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">تفاصيل الدواء</DrawerTitle>
          </DrawerHeader>
          {showDetailSheet && (
            <div className="px-5 pb-8 space-y-5">
              {/* Hero */}
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: showDetailSheet.color + "20" }}>
                  <Pill className="w-8 h-8" style={{ color: showDetailSheet.color }} />
                </div>
                <h3 className="text-xl font-bold text-foreground">{showDetailSheet.name}</h3>
                <p className="text-sm text-muted-foreground">{showDetailSheet.dosage}</p>
              </div>

              {/* Info rows */}
              <div className="space-y-3 bg-card rounded-2xl border border-border/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <User className="w-4 h-4" /> صاحب العلاقة
                  </span>
                  <span className="text-sm font-medium text-foreground">{showDetailSheet.memberName}</span>
                </div>
                <div className="h-px bg-border/50" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" /> التكرار
                  </span>
                  <span className="text-sm font-medium text-foreground">{formatFrequency(showDetailSheet)}</span>
                </div>
                <div className="h-px bg-border/50" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Hash className="w-4 h-4" /> عدد الجرعات
                  </span>
                  <span className="text-sm font-medium text-foreground">{showDetailSheet.timesPerDay || 1} يومياً</span>
                </div>
                {showDetailSheet.specificTimes && showDetailSheet.specificTimes.length > 0 && (
                  <>
                    <div className="h-px bg-border/50" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Clock className="w-4 h-4" /> الأوقات
                      </span>
                      <span className="text-sm font-medium text-foreground">{showDetailSheet.specificTimes.join(" • ")}</span>
                    </div>
                  </>
                )}
                <div className="h-px bg-border/50" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> تاريخ البدء
                  </span>
                  <span className="text-sm font-medium text-foreground">{showDetailSheet.startDate || "—"}</span>
                </div>
                {showDetailSheet.endDate && (
                  <>
                    <div className="h-px bg-border/50" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> تاريخ الانتهاء
                      </span>
                      <span className="text-sm font-medium text-foreground">{showDetailSheet.endDate}</span>
                    </div>
                  </>
                )}
                <div className="h-px bg-border/50" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Bell className="w-4 h-4" /> التنبيهات
                  </span>
                  <Badge variant={showDetailSheet.reminder.enabled ? "default" : "secondary"} className="text-xs">
                    {showDetailSheet.reminder.enabled ? "مفعّلة" : "معطّلة"}
                  </Badge>
                </div>
                <div className="h-px bg-border/50" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" /> الجرعة القادمة
                  </span>
                  <span className="text-sm font-medium text-foreground">{getTimeUntilNext(showDetailSheet.reminder.nextDueAt)}</span>
                </div>
                {showDetailSheet.notes && (
                  <>
                    <div className="h-px bg-border/50" />
                    <div className="flex items-start justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <FileText className="w-4 h-4" /> ملاحظات
                      </span>
                      <span className="text-sm font-medium text-foreground max-w-[60%] text-left">{showDetailSheet.notes}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-12 gap-2"
                  onClick={() => { setShowDetailSheet(null); openEditDrawer(showDetailSheet); }}
                >
                  <Pencil className="w-4 h-4" /> تعديل
                </Button>
                <Button
                  className="h-12 gap-2"
                  onClick={() => { markAsTaken(showDetailSheet.id); }}
                >
                  <Check className="w-4 h-4" /> أخذته
                </Button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Add/Edit Medication Drawer */}
      <Drawer open={showAddDrawer} onOpenChange={(open) => { setShowAddDrawer(open); if (!open) resetForm(); }}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <div className="flex items-center justify-between">
              {editingMed && (
                <button
                  onClick={() => { setShowAddDrawer(false); setShowDeleteConfirm(editingMed); }}
                  className="p-2 rounded-lg text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <DrawerTitle className="text-center flex-1">
                {editingMed ? "تعديل الدواء" : "إضافة دواء جديد"}
              </DrawerTitle>
              {editingMed && <div className="w-9" />}
            </div>
          </DrawerHeader>

          <div className="overflow-y-auto flex-1 px-5 pb-8 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-right block">اسم الدواء</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="مثل: بنادول" className="text-right" />
              </div>
              <div className="space-y-2">
                <Label className="text-right block">الجرعة</Label>
                <Input value={formDosage} onChange={(e) => setFormDosage(e.target.value)} placeholder="مثل: 500mg" className="text-right" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-right block">صاحب العلاقة</Label>
              <Select
                value={formMemberId}
                onValueChange={(val) => {
                  setFormMemberId(val);
                  if (val === "me") setFormMemberName("أنا");
                  else {
                    const member = familyMembers.find((m) => m.id === val);
                    setFormMemberName(member?.name || "");
                  }
                }}
              >
                <SelectTrigger className="text-right"><SelectValue placeholder="اختر الشخص" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">أنا</SelectItem>
                  {familyMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-right block">تكرار الدواء</Label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setFormFreqType("daily")}
                  className={`p-2.5 rounded-xl border-2 text-center text-sm font-medium transition-colors ${formFreqType === "daily" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  يومياً
                </button>
                <button onClick={() => setFormFreqType("specific_days")}
                  className={`p-2.5 rounded-xl border-2 text-center text-sm font-medium transition-colors ${formFreqType === "specific_days" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  أيام محددة
                </button>
              </div>
            </div>

            {formFreqType === "specific_days" && (
              <div className="space-y-2">
                <Label className="text-right block">اختر الأيام</Label>
                <div className="flex justify-between gap-1">
                  {WEEKDAYS.map((day) => {
                    const isSelected = formSelectedDays.includes(day.value);
                    return (
                      <button key={day.value}
                        onClick={() => setFormSelectedDays((prev) => isSelected ? prev.filter((d) => d !== day.value) : [...prev, day.value])}
                        className={`w-10 h-10 rounded-full border-2 text-xs font-bold transition-colors ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-right block">عدد الجرعات</Label>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => { if (formTimesPerDay > 1) handleTimesPerDayChange(formTimesPerDay - 1); }}
                  className="w-10 h-10 rounded-xl border-2 border-border text-muted-foreground flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors disabled:opacity-30" disabled={formTimesPerDay <= 1}>−</button>
                <div className="w-16 h-10 rounded-xl border-2 border-primary bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">{formTimesPerDay}</div>
                <button onClick={() => { if (formTimesPerDay < 10) handleTimesPerDayChange(formTimesPerDay + 1); }}
                  className="w-10 h-10 rounded-xl border-2 border-border text-muted-foreground flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors disabled:opacity-30" disabled={formTimesPerDay >= 10}>+</button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-right block">أوقات التناول</Label>
              <div className="space-y-2">
                {formTimes.map((time, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input type="time" value={time} onChange={(e) => { const newTimes = [...formTimes]; newTimes[i] = e.target.value; setFormTimes(newTimes); }} className="text-center flex-1" />
                    <span className="text-xs text-muted-foreground shrink-0">الجرعة {i + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-right block">تاريخ البدء</Label>
                <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} dir="rtl" className="text-right" />
              </div>
              <div className="space-y-2">
                <Label className="text-right block">تاريخ الانتهاء</Label>
                <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} dir="rtl" className="text-right" placeholder="اختياري" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-right block">لون الدواء</Label>
              <div className="flex gap-2 flex-wrap">
                {MEDICATION_COLORS.map((c) => (
                  <button key={c} onClick={() => setFormColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform shrink-0 ${formColor === c ? "border-foreground scale-110" : c === "hsl(0, 0%, 100%)" ? "border-border" : "border-transparent"}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-right block">ملاحظات</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="ملاحظات إضافية (اختياري)" className="text-right min-h-[60px]" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50">
              <span className="font-medium text-foreground flex items-center gap-2">
                <Bell className="w-4 h-4" />تفعيل التنبيهات
              </span>
              <Switch checked={formReminderEnabled} onCheckedChange={setFormReminderEnabled} />
            </div>

            <Button onClick={handleSave} className="w-full h-12 text-base font-bold">
              {editingMed ? "حفظ التعديلات" : "إضافة الدواء"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Due Medication Alert Drawer */}
      <Drawer open={!!showDueAlert} onOpenChange={(open) => !open && setShowDueAlert(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">💊 وقت الدواء!</DrawerTitle>
          </DrawerHeader>
          {showDueAlert && (
            <div className="px-5 pb-8 space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-20 h-20 rounded-full flex items-center justify-center animate-pulse" style={{ background: showDueAlert.color + "20" }}>
                  <Pill className="w-10 h-10" style={{ color: showDueAlert.color }} />
                </div>
                <h3 className="text-xl font-bold text-foreground">{showDueAlert.name}</h3>
                <p className="text-muted-foreground">{showDueAlert.dosage}</p>
                <Badge variant="secondary" className="gap-1"><User className="w-3 h-3" />{showDueAlert.memberName}</Badge>
              </div>
              <p className="text-center text-sm text-muted-foreground">هل تم تناول هذا الدواء؟</p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => skipMedication(showDueAlert.id)} className="h-12 text-base">لا، لاحقاً</Button>
                <Button onClick={() => markAsTaken(showDueAlert.id)} className="h-12 text-base gap-2"><Check className="w-5 h-5" />نعم، أخذته</Button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation Drawer */}
      <Drawer open={!!showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">حذف الدواء</DrawerTitle>
          </DrawerHeader>
          {showDeleteConfirm && (
            <div className="px-5 pb-8 space-y-4">
              <p className="text-center text-muted-foreground">هل أنت متأكد من حذف <strong>{showDeleteConfirm.name}</strong>؟</p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(null)} className="h-12">إلغاء</Button>
                <Button variant="destructive" onClick={() => handleDeleteMedication(showDeleteConfirm.id)} className="h-12">حذف</Button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Medications;
