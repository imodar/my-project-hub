import { useState, useEffect, useMemo } from "react";
import {
  Plus, Pill, Check, Clock, Bell, BellRing, Pencil, Trash2,
  AlertTriangle, User, ChevronDown,
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

const STORAGE_KEY = "family-medications";

const loadMedications = (): Medication[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveMedications = (meds: Medication[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meds));
};

const loadFamilyMembers = (): { id: string; name: string; role: string }[] => {
  try {
    const saved = localStorage.getItem("family_members");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const Medications = () => {
  const [medications, setMedications] = useState<Medication[]>(loadMedications);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [showDueAlert, setShowDueAlert] = useState<Medication | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Medication | null>(null);

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

  const familyMembers = useMemo(loadFamilyMembers, []);

  // Check for due medications every minute
  useEffect(() => {
    const checkDue = () => {
      const meds = loadMedications();
      const dueMed = meds.find((m) => isMedicationDue(m));
      if (dueMed && !showDueAlert) {
        setShowDueAlert(dueMed);
      }
    };
    checkDue();
    const interval = setInterval(checkDue, 60000);
    return () => clearInterval(interval);
  }, [showDueAlert]);

  // Recalculate next due times
  useEffect(() => {
    const updated = medications.map((med) => ({
      ...med,
      reminder: { ...med.reminder, nextDueAt: calculateNextDue(med) },
    }));
    const hasChanges = updated.some((m, i) => m.reminder.nextDueAt !== medications[i].reminder.nextDueAt);
    if (hasChanges) {
      setMedications(updated);
    }
  }, []);

  useEffect(() => {
    saveMedications(medications);
  }, [medications]);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Send browser notification for due meds
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
    setFormName("");
    setFormDosage("");
    setFormMemberId("me");
    setFormMemberName("أنا");
    setFormFreqType("daily");
    setFormFreqValue(1);
    setFormSelectedDays([]);
    setFormTimesPerDay(1);
    setFormTimes(["08:00"]);
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormEndDate("");
    setFormNotes("");
    setFormColor(MEDICATION_COLORS[0]);
    setFormReminderEnabled(true);
    setEditingMed(null);
  };

  const openAddDrawer = () => {
    resetForm();
    setShowAddDrawer(true);
  };

  const openEditDrawer = (med: Medication) => {
    setEditingMed(med);
    setFormName(med.name);
    setFormDosage(med.dosage);
    setFormMemberId(med.memberId);
    setFormMemberName(med.memberName);
    setFormFreqType(med.frequencyType);
    setFormFreqValue(med.frequencyValue);
    setFormTimesPerDay(med.timesPerDay || 1);
    setFormTimes(med.specificTimes || ["08:00"]);
    setFormStartDate(med.startDate);
    setFormEndDate(med.endDate || "");
    setFormNotes(med.notes || "");
    setFormColor(med.color);
    setFormReminderEnabled(med.reminder.enabled);
    setShowAddDrawer(true);
  };

  const handleSave = () => {
    if (!formName.trim()) { toast.error("يرجى إدخال اسم الدواء"); return; }
    if (!formDosage.trim()) { toast.error("يرجى إدخال الجرعة"); return; }

    const baseMed = {
      name: formName.trim(),
      dosage: formDosage.trim(),
      memberId: formMemberId,
      memberName: formMemberName,
      frequencyType: formFreqType,
      frequencyValue: formFreqType === "daily" ? 1 : formFreqValue,
      timesPerDay: formFreqType === "daily" ? formTimesPerDay : undefined,
      specificTimes: formTimes.filter(Boolean),
      startDate: formStartDate,
      endDate: formEndDate || undefined,
      notes: formNotes.trim() || undefined,
      color: formColor,
    };

    if (editingMed) {
      setMedications((prev) =>
        prev.map((m) => {
          if (m.id !== editingMed.id) return m;
          const updated = {
            ...m,
            ...baseMed,
            reminder: { ...m.reminder, enabled: formReminderEnabled },
          };
          updated.reminder.nextDueAt = calculateNextDue(updated);
          return updated;
        })
      );
      toast.success("تم تحديث الدواء");
    } else {
      const newMed: Medication = {
        id: crypto.randomUUID(),
        ...baseMed,
        reminder: {
          id: crypto.randomUUID(),
          enabled: formReminderEnabled,
          nextDueAt: "",
        },
        takenLog: [],
        createdAt: new Date().toISOString(),
      };
      newMed.reminder.nextDueAt = calculateNextDue(newMed);
      setMedications((prev) => [...prev, newMed]);
      toast.success(`تمت إضافة ${newMed.name}`);
    }

    setShowAddDrawer(false);
    resetForm();
  };

  const markAsTaken = (medId: string) => {
    const now = new Date().toISOString();
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
    setShowDueAlert(null);
    toast.success("تم تسجيل تناول الدواء ✅");
  };

  const skipMedication = (medId: string) => {
    setMedications((prev) =>
      prev.map((m) => {
        if (m.id !== medId) return m;
        const updated = { ...m };
        updated.reminder.nextDueAt = calculateNextDue(updated);
        // Push next due forward
        const next = new Date(updated.reminder.nextDueAt);
        if (updated.frequencyType === "every_x_hours") {
          next.setHours(next.getHours() + updated.frequencyValue);
        } else {
          next.setDate(next.getDate() + (updated.frequencyType === "daily" ? 1 : updated.frequencyValue));
        }
        updated.reminder.nextDueAt = next.toISOString();
        return updated;
      })
    );
    setShowDueAlert(null);
    toast("تم تخطي الجرعة", { icon: "⏭️" });
  };

  const deleteMedication = (medId: string) => {
    setMedications((prev) => prev.filter((m) => m.id !== medId));
    setShowDeleteConfirm(null);
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
                  <Button size="sm" variant="outline" onClick={() => skipMedication(med.id)} className="text-xs h-8">
                    لاحقاً
                  </Button>
                  <Button size="sm" onClick={() => markAsTaken(med.id)} className="text-xs h-8 gap-1">
                    <Check className="w-3 h-3" />
                    أخذته
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
              <Plus className="w-4 h-4" />
              إضافة دواء
            </Button>
          </div>
        ) : (
          activeMedications.map((med) => {
            const isDue = isMedicationDue(med);
            const takenToday = med.takenLog.some((t) => {
              const d = new Date(t);
              const today = new Date();
              return d.toDateString() === today.toDateString();
            });

            return (
              <div
                key={med.id}
                className={`bg-card rounded-2xl p-4 border transition-colors cursor-pointer ${
                  isDue ? "border-destructive/50 bg-destructive/5" : "border-border/50"
                }`}
                onClick={() => openEditDrawer(med)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: med.color + "20" }}
                  >
                    <Pill className="w-6 h-6" style={{ color: med.color }} />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground">{med.name}</h3>
                      {isDue && (
                        <Badge variant="destructive" className="text-[10px] gap-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          مستحق
                        </Badge>
                      )}
                      {takenToday && !isDue && (
                        <Badge className="text-[10px] gap-0.5 bg-green-500">
                          <Check className="w-3 h-3" />
                          تم
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
                      <span className="text-muted-foreground">
                        {med.specificTimes.join(" • ")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Today's progress for daily meds */}
                {med.frequencyType === "daily" && med.timesPerDay && med.timesPerDay > 1 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>اليوم</span>
                      <span>
                        {med.takenLog.filter((t) => new Date(t).toDateString() === new Date().toDateString()).length}/{med.timesPerDay}
                      </span>
                    </div>
                    <Progress
                      value={
                        (med.takenLog.filter((t) => new Date(t).toDateString() === new Date().toDateString()).length / med.timesPerDay) * 100
                      }
                      className="h-1.5"
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

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
            {/* Name & Dosage */}
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

            {/* Member */}
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
                <SelectTrigger className="text-right">
                  <SelectValue placeholder="اختر الشخص" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">أنا</SelectItem>
                  {familyMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Frequency Type */}
            <div className="space-y-2">
              <Label className="text-right block">تكرار الدواء</Label>
              <div className="grid grid-cols-3 gap-2">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setFormFreqType(opt.value);
                      if (opt.value === "every_x_days") setFormFreqValue(2);
                      else if (opt.value === "every_x_hours") setFormFreqValue(4);
                      else setFormFreqValue(1);
                    }}
                    className={`p-2.5 rounded-xl border-2 text-center text-sm font-medium transition-colors ${
                      formFreqType === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency Value */}
            {formFreqType === "daily" && (
              <div className="space-y-2">
                <Label className="text-right block">عدد المرات يومياً</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => handleTimesPerDayChange(n)}
                      className={`p-2.5 rounded-xl border-2 text-center text-sm font-medium transition-colors ${
                        formTimesPerDay === n
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {n} {n === 1 ? "مرة" : "مرات"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formFreqType === "every_x_days" && (
              <div className="space-y-2">
                <Label className="text-right block">الفترة بين الجرعات</Label>
                <div className="grid grid-cols-3 gap-2">
                  {DAY_INTERVALS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFormFreqValue(opt.value)}
                      className={`p-2.5 rounded-xl border-2 text-center text-xs font-medium transition-colors ${
                        formFreqValue === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formFreqType === "every_x_hours" && (
              <div className="space-y-2">
                <Label className="text-right block">الفترة بين الجرعات</Label>
                <div className="grid grid-cols-4 gap-2">
                  {HOUR_INTERVALS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFormFreqValue(opt.value)}
                      className={`p-2.5 rounded-xl border-2 text-center text-xs font-medium transition-colors ${
                        formFreqValue === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Specific Times */}
            {(formFreqType === "daily") && (
              <div className="space-y-2">
                <Label className="text-right block">أوقات التناول</Label>
                <div className="space-y-2">
                  {formTimes.map((time, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={time}
                        onChange={(e) => {
                          const newTimes = [...formTimes];
                          newTimes[i] = e.target.value;
                          setFormTimes(newTimes);
                        }}
                        className="text-center flex-1"
                      />
                      <span className="text-xs text-muted-foreground shrink-0">الجرعة {i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Start / End Date */}
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

            {/* Color */}
            <div className="space-y-2">
              <Label className="text-right block">لون الدواء</Label>
              <div className="flex gap-3 flex-wrap">
                {MEDICATION_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFormColor(c)}
                    className={`w-9 h-9 rounded-full border-2 transition-transform ${
                      formColor === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-right block">ملاحظات</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="ملاحظات إضافية (اختياري)"
                className="text-right min-h-[60px]"
              />
            </div>

            {/* Reminder Toggle */}
            <div className="flex items-center justify-between flex-row-reverse p-3 rounded-xl bg-card border border-border/50">
              <span className="font-medium text-foreground flex items-center gap-2">
                <Bell className="w-4 h-4" />
                تفعيل التنبيهات
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
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center animate-pulse"
                  style={{ background: showDueAlert.color + "20" }}
                >
                  <Pill className="w-10 h-10" style={{ color: showDueAlert.color }} />
                </div>
                <h3 className="text-xl font-bold text-foreground">{showDueAlert.name}</h3>
                <p className="text-muted-foreground">{showDueAlert.dosage}</p>
                <Badge variant="secondary" className="gap-1">
                  <User className="w-3 h-3" />
                  {showDueAlert.memberName}
                </Badge>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                هل تم تناول هذا الدواء؟
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => skipMedication(showDueAlert.id)} className="h-12 text-base">
                  لا، لاحقاً
                </Button>
                <Button onClick={() => markAsTaken(showDueAlert.id)} className="h-12 text-base gap-2">
                  <Check className="w-5 h-5" />
                  نعم، أخذته
                </Button>
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
              <p className="text-center text-muted-foreground">
                هل أنت متأكد من حذف <strong>{showDeleteConfirm.name}</strong>؟
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(null)} className="h-12">
                  إلغاء
                </Button>
                <Button variant="destructive" onClick={() => deleteMedication(showDeleteConfirm.id)} className="h-12">
                  حذف
                </Button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Medications;
