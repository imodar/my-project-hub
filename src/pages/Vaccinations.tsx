import { useState } from "react";
import SwipeableCard from "@/components/SwipeableCard";
import { Plus, Baby, Check, Clock, AlertTriangle, Syringe, Bell, Pencil, MessageSquare, PersonStanding } from "lucide-react";
import { ListPageSkeleton } from "@/components/PageSkeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import PageHeader from "@/components/PageHeader";
import {
  Child,
  VaccineNote,
  ReminderSettings,
  vaccineSchedule,
  getTotalVaccines,
  getChildAge,
  getNextDueVaccines,
} from "@/data/vaccinationData";
import { useVaccinations } from "@/hooks/useVaccinations";
import { toast } from "sonner";

const Vaccinations = () => {
  const {
    children,
    isLoading,
    addChild,
    updateChild,
    toggleVaccine,
    updateReminderSettings,
    saveVaccineNote: saveVaccineNoteMutation,
  } = useVaccinations();

  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [showReminderSheet, setShowReminderSheet] = useState(false);
  const [reminderChild, setReminderChild] = useState<Child | null>(null);
  const [showNoteSheet, setShowNoteSheet] = useState(false);
  const [noteVaccineId, setNoteVaccineId] = useState("");
  const [noteText, setNoteText] = useState("");
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState<"male" | "female">("male");
  const [newBirthDate, setNewBirthDate] = useState("");

  const [openChildCardId, setOpenChildCardId] = useState<string | null>(null);

  // Keep selectedChild in sync with data
  const resolvedSelected = selectedChild ? children.find((c) => c.id === selectedChild.id) || selectedChild : null;

  const handleAddChild = async () => {
    if (!newName.trim()) { toast.error("يرجى إدخال اسم الطفل"); return; }
    if (!newBirthDate) { toast.error("يرجى إدخال تاريخ الميلاد"); return; }

    try {
      await addChild.mutateAsync({ name: newName.trim(), gender: newGender, birthDate: newBirthDate });
      setNewName("");
      setNewGender("male");
      setNewBirthDate("");
      setShowAddSheet(false);
      toast.success(`تمت إضافة ${newName.trim()}`);
    } catch {
      toast.error("حدث خطأ في الإضافة");
    }
  };

  const handleEditChild = async () => {
    if (!editingChild) return;
    if (!newName.trim()) { toast.error("يرجى إدخال اسم الطفل"); return; }
    if (!newBirthDate) { toast.error("يرجى إدخال تاريخ الميلاد"); return; }

    try {
      await updateChild.mutateAsync({
        id: editingChild.id,
        name: newName.trim(),
        gender: newGender,
        birthDate: newBirthDate,
      });
      setShowEditSheet(false);
      setEditingChild(null);
      setOpenChildCardId(null);
      toast.success("تم تحديث بيانات الطفل");
    } catch {
      toast.error("حدث خطأ");
    }
  };

  const openEditSheet = (child: Child) => {
    setEditingChild(child);
    setNewName(child.name);
    setNewGender(child.gender);
    setNewBirthDate(child.birthDate);
    setShowEditSheet(true);
  };

  const openReminderFromSwipe = (child: Child) => {
    setReminderChild(child);
    setShowReminderSheet(true);
    setSwipedChildId(null);
  };

  const handleToggleVaccine = (childId: string, vaccineId: string) => {
    const child = children.find((c) => c.id === childId);
    if (!child) return;
    toggleVaccine.mutate({ childId, vaccineId, completed: child.completedVaccines });
  };

  const handleUpdateReminderSettings = (childId: string, settings: ReminderSettings) => {
    updateReminderSettings.mutate({ childId, settings });
  };

  const handleSaveVaccineNote = () => {
    if (!resolvedSelected || !noteVaccineId) return;
    saveVaccineNoteMutation.mutate({
      childId: resolvedSelected.id,
      vaccineId: noteVaccineId,
      note: noteText,
    });
    setShowNoteSheet(false);
    toast.success("تم حفظ الملاحظة");
  };

  const getVaccineNote = (child: Child, vaccineId: string): string => {
    return child.vaccineNotes.find((n) => n.vaccineId === vaccineId)?.note || "";
  };

  const openNoteSheet = (vaccineId: string) => {
    if (!resolvedSelected) return;
    setNoteVaccineId(vaccineId);
    setNoteText(getVaccineNote(resolvedSelected, vaccineId));
    setShowNoteSheet(true);
  };

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent, childId: string) => {
    swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, swiping: false, childId };
  };

  const handleTouchMove = (e: React.TouchEvent, childId: string, cardEl: HTMLDivElement | null) => {
    if (!cardEl || swipeRef.current.childId !== childId) return;
    const diffX = e.touches[0].clientX - swipeRef.current.startX;
    const diffY = Math.abs(e.touches[0].clientY - swipeRef.current.startY);
    if (diffY > Math.abs(diffX) && !swipeRef.current.swiping) return;
    if (Math.abs(diffX) > 10) swipeRef.current.swiping = true;
    if (swipeRef.current.swiping) {
      e.preventDefault();
      const clampedX = Math.max(-112, Math.min(0, diffX));
      cardEl.style.transform = `translateX(${clampedX}px)`;
    }
  };

  const handleTouchEnd = (childId: string, cardEl: HTMLDivElement | null) => {
    if (!cardEl || swipeRef.current.childId !== childId) return;
    const wasSwiping = swipeRef.current.swiping;
    if (wasSwiping) {
      const currentTransform = cardEl.style.transform;
      const match = currentTransform.match(/translateX\((-?\d+)px\)/);
      const currentX = match ? parseInt(match[1]) : 0;
      cardEl.style.transition = "transform 200ms ease-out";
      if (currentX < -50) {
        cardEl.style.transform = "translateX(-112px)";
        setSwipedChildId(childId);
      } else {
        cardEl.style.transform = "translateX(0px)";
        setSwipedChildId(null);
      }
      setTimeout(() => { if (cardEl) cardEl.style.transition = ""; }, 200);
    }
    swipeRef.current.swiping = false;
  };

  const handleCardClick = (child: Child) => {
    if (swipeRef.current.swiping) return;
    if (swipedChildId === child.id) { setSwipedChildId(null); return; }
    if (swipedChildId) { setSwipedChildId(null); return; }
    setSelectedChild(child);
  };

  const totalVaccines = getTotalVaccines();

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto pb-24">
      <PageHeader
        title="لقاحات الأطفال"
        actions={[
          { icon: <Plus size={20} className="text-white" />, onClick: () => setShowAddSheet(true) },
        ]}
      />

      {isLoading ? (
        <ListPageSkeleton />
      ) : (
      <div className="px-5 mt-6 space-y-4">
        {children.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Syringe className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">لا يوجد أطفال</h3>
            <p className="text-sm text-muted-foreground mb-6">أضف طفلاً لمتابعة جدول اللقاحات</p>
            <Button onClick={() => setShowAddSheet(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              إضافة طفل
            </Button>
          </div>
        ) : (
          children.map((child) => {
            const completedCount = child.completedVaccines.length;
            const progress = Math.round((completedCount / totalVaccines) * 100);
            const dueVaccines = getNextDueVaccines(child.birthDate, child.completedVaccines);
            const isSwiped = swipedChildId === child.id;

            return (
              <div key={child.id} className="relative overflow-hidden rounded-2xl">
                <div className="absolute inset-y-0 left-0 flex items-center gap-2 px-3 z-0">
                  <button onClick={() => openEditSheet(child)} className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center">
                    <Pencil className="w-5 h-5 text-white" />
                  </button>
                  <button onClick={() => openReminderFromSwipe(child)} className="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-white" />
                  </button>
                </div>

                <div
                  ref={(el) => { if (el) el.dataset.childId = child.id; }}
                  onClick={() => handleCardClick(child)}
                  onTouchStart={(e) => handleTouchStart(e, child.id)}
                  onTouchMove={(e) => handleTouchMove(e, child.id, e.currentTarget as HTMLDivElement)}
                  onTouchEnd={(e) => handleTouchEnd(child.id, e.currentTarget as HTMLDivElement)}
                  className="w-full bg-card rounded-2xl p-4 border border-border/50 text-right relative z-10 cursor-pointer"
                  style={{ transform: isSwiped ? "translateX(-112px)" : "translateX(0)" }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${child.gender === "male" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-pink-100 dark:bg-pink-900/30"}`}>
                      <Baby className={`w-6 h-6 ${child.gender === "male" ? "text-blue-500" : "text-pink-500"}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-foreground">{child.name}</h3>
                      <p className="text-xs text-muted-foreground">{getChildAge(child.birthDate)}</p>
                    </div>
                    {dueVaccines.length > 0 && (
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <AlertTriangle className="w-3 h-3" />
                        {dueVaccines.length} مستحق
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{completedCount} من {totalVaccines} لقاح</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      )}

      {/* Add Child Drawer */}
      <Drawer open={showAddSheet} onOpenChange={setShowAddSheet}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="text-center">إضافة طفل جديد</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-5 px-5 pb-8">
            <div className="space-y-2">
              <Label className="text-right block">اسم الطفل</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="أدخل اسم الطفل" className="text-right" />
            </div>
            <div className="space-y-2">
              <Label className="text-right block">الجنس</Label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setNewGender("male")} className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition-colors ${newGender === "male" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600" : "border-border text-muted-foreground"}`}><PersonStanding className="w-5 h-5" /> ذكر</button>
                <button onClick={() => setNewGender("female")} className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition-colors ${newGender === "female" ? "border-pink-500 bg-pink-50 dark:bg-pink-900/20 text-pink-600" : "border-border text-muted-foreground"}`}><Baby className="w-5 h-5" /> أنثى</button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-right block">تاريخ الميلاد</Label>
              <Input type="date" value={newBirthDate} onChange={(e) => setNewBirthDate(e.target.value)} max={new Date().toISOString().split("T")[0]} dir="rtl" className="text-right" />
            </div>
            <Button onClick={handleAddChild} disabled={addChild.isPending} className="w-full h-12 text-base font-bold">
              {addChild.isPending ? "جارٍ الإضافة..." : "إضافة الطفل"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Edit Child Drawer */}
      <Drawer open={showEditSheet} onOpenChange={(open) => { setShowEditSheet(open); if (!open) setEditingChild(null); }}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="text-center">تعديل بيانات الطفل</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-5 px-5 pb-8">
            <div className="space-y-2">
              <Label className="text-right block">اسم الطفل</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="أدخل اسم الطفل" className="text-right" />
            </div>
            <div className="space-y-2">
              <Label className="text-right block">الجنس</Label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setNewGender("male")} className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition-colors ${newGender === "male" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600" : "border-border text-muted-foreground"}`}><PersonStanding className="w-5 h-5" /> ذكر</button>
                <button onClick={() => setNewGender("female")} className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition-colors ${newGender === "female" ? "border-pink-500 bg-pink-50 dark:bg-pink-900/20 text-pink-600" : "border-border text-muted-foreground"}`}><Baby className="w-5 h-5" /> أنثى</button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-right block">تاريخ الميلاد</Label>
              <Input type="date" value={newBirthDate} onChange={(e) => setNewBirthDate(e.target.value)} max={new Date().toISOString().split("T")[0]} dir="rtl" className="text-right" />
            </div>
            <Button onClick={handleEditChild} disabled={updateChild.isPending} className="w-full h-12 text-base font-bold">
              {updateChild.isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Reminder Settings Drawer */}
      <Drawer open={showReminderSheet} onOpenChange={(open) => { setShowReminderSheet(open); if (!open) setReminderChild(null); }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">
              إعدادات التنبيهات {reminderChild ? `- ${reminderChild.name}` : ""}
            </DrawerTitle>
          </DrawerHeader>
          {reminderChild && (
            <div className="space-y-4 px-5 pb-8">
              <p className="text-sm text-muted-foreground text-right">سيتم تذكيرك بجميع لقاحات {reminderChild.name} المستحقة</p>
              {[
                { key: "beforeDay" as const, label: "قبل يوم واحد" },
                { key: "beforeWeek" as const, label: "قبل أسبوع" },
                { key: "beforeMonth" as const, label: "قبل شهر" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between flex-row-reverse p-3 rounded-xl bg-card border border-border/50">
                  <Switch
                    checked={reminderChild.reminderSettings[item.key]}
                    onCheckedChange={(checked) => {
                      const newSettings = { ...reminderChild.reminderSettings, [item.key]: checked };
                      handleUpdateReminderSettings(reminderChild.id, newSettings);
                      setReminderChild({ ...reminderChild, reminderSettings: newSettings });
                    }}
                  />
                  <span className="font-medium text-foreground">{item.label}</span>
                </div>
              ))}
              <Button
                onClick={() => {
                  setShowReminderSheet(false);
                  toast.success("تم حفظ إعدادات التنبيهات");
                }}
                className="w-full h-12 text-base font-bold"
              >
                حفظ
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Child Vaccine Detail Drawer */}
      <Drawer open={!!resolvedSelected} onOpenChange={(open) => !open && setSelectedChild(null)}>
        <DrawerContent className="max-h-[90vh]">
          {resolvedSelected && (
            <>
              <DrawerHeader>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      setReminderChild(resolvedSelected);
                      setShowReminderSheet(true);
                    }}
                    className="p-2 rounded-lg text-amber-500 hover:bg-amber-500/10"
                  >
                    <Bell className="w-5 h-5" />
                  </button>
                  <DrawerTitle className="text-center flex-1">
                    جدول لقاحات {resolvedSelected.name}
                  </DrawerTitle>
                  <div className="w-9" />
                </div>
              </DrawerHeader>

              <div className="overflow-y-auto flex-1">
                <div className="px-5">
                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        العمر: {getChildAge(resolvedSelected.birthDate)}
                      </span>
                      <span className="text-sm font-bold text-primary">
                        {resolvedSelected.completedVaccines.length}/{totalVaccines}
                      </span>
                    </div>
                    <Progress
                      value={Math.round((resolvedSelected.completedVaccines.length / totalVaccines) * 100)}
                      className="h-2.5"
                    />
                  </div>
                </div>

                <Accordion type="multiple" className="mt-4 px-5 pb-4">
                  {vaccineSchedule.map((group) => {
                    const childAgeDays = Math.floor(
                      (new Date().getTime() - new Date(resolvedSelected.birthDate).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    const isDue = childAgeDays >= group.vaccines[0].ageDays;
                    const allCompleted = group.vaccines.every((v) => resolvedSelected.completedVaccines.includes(v.id));
                    const someCompleted = !allCompleted && group.vaccines.some((v) => resolvedSelected.completedVaccines.includes(v.id));

                    return (
                      <AccordionItem key={group.id} value={group.id} className="border-b-0 mb-2">
                        <AccordionTrigger className="hover:no-underline p-3 rounded-xl bg-card border border-border/50">
                          <div className="flex items-center gap-3 flex-1 text-right">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${allCompleted ? "bg-green-100 dark:bg-green-900/30" : isDue && !allCompleted ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"}`}>
                              {allCompleted ? <Check className="w-4 h-4 text-green-600" /> : isDue ? <Clock className="w-4 h-4 text-amber-600" /> : <Clock className="w-4 h-4 text-muted-foreground" />}
                            </div>
                            <div className="flex-1">
                              <span className="font-bold text-sm">{group.title}</span>
                              {someCompleted && <span className="text-xs text-muted-foreground mr-2">(جزئي)</span>}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {group.vaccines.filter((v) => resolvedSelected.completedVaccines.includes(v.id)).length}/{group.vaccines.length}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-0">
                          <div className="space-y-2 pr-4">
                            {group.vaccines.map((vaccine) => {
                              const isCompleted = resolvedSelected.completedVaccines.includes(vaccine.id);
                              const isOverdue = isDue && !isCompleted;
                              const hasNote = !!getVaccineNote(resolvedSelected, vaccine.id);

                              return (
                                <div key={vaccine.id} className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-right ${
                                  isCompleted ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" : isOverdue ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800" : "bg-card border-border/50"
                                }`}>
                                  <button
                                    onClick={() => handleToggleVaccine(resolvedSelected.id, vaccine.id)}
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${isCompleted ? "bg-green-500 border-green-500" : "border-border"}`}
                                  >
                                    {isCompleted && <Check className="w-3.5 h-3.5 text-white" />}
                                  </button>
                                  <div className="flex-1 min-w-0" onClick={() => handleToggleVaccine(resolvedSelected.id, vaccine.id)}>
                                    <p className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>{vaccine.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{vaccine.description}</p>
                                    {hasNote && (
                                      <p className="text-xs text-primary mt-1 truncate">📝 {getVaccineNote(resolvedSelected, vaccine.id)}</p>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openNoteSheet(vaccine.id); }}
                                    className={`p-1.5 rounded-lg shrink-0 ${hasNote ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-accent"}`}
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </button>
                                  {isOverdue && (
                                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] shrink-0">مستحق</Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Note Drawer */}
      <Drawer open={showNoteSheet} onOpenChange={setShowNoteSheet}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">ملاحظة على اللقاح</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 px-5 pb-8">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="أضف ملاحظة (مثل: تم أخذ اللقاح في مستشفى ...)"
              className="text-right min-h-[100px]"
            />
            <div className="flex gap-3">
              <Button onClick={handleSaveVaccineNote} disabled={saveVaccineNoteMutation.isPending} className="flex-1 h-12 font-bold">
                {saveVaccineNoteMutation.isPending ? "جارٍ..." : "حفظ"}
              </Button>
              {noteText && (
                <Button
                  variant="outline"
                  onClick={() => { setNoteText(""); handleSaveVaccineNote(); }}
                  className="h-12 text-destructive border-destructive/30"
                >
                  حذف
                </Button>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Vaccinations;
