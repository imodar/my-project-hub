import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Plus, Baby, Check, Clock, AlertTriangle, User, Syringe, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Child,
  vaccineSchedule,
  getTotalVaccines,
  getChildAge,
  getNextDueVaccines,
} from "@/data/vaccinationData";
import { toast } from "sonner";

const STORAGE_KEY = "family-vaccinations-children";

const loadChildren = (): Child[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveChildren = (children: Child[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(children));
};

const Vaccinations = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>(loadChildren);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState<"male" | "female">("male");
  const [newBirthDate, setNewBirthDate] = useState("");

  useEffect(() => {
    saveChildren(children);
  }, [children]);

  useEffect(() => {
    if (selectedChild) {
      const updated = children.find((c) => c.id === selectedChild.id);
      if (updated) setSelectedChild(updated);
    }
  }, [children]);

  const handleAddChild = () => {
    if (!newName.trim()) {
      toast.error("يرجى إدخال اسم الطفل");
      return;
    }
    if (!newBirthDate) {
      toast.error("يرجى إدخال تاريخ الميلاد");
      return;
    }

    const child: Child = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      gender: newGender,
      birthDate: newBirthDate,
      completedVaccines: [],
    };

    setChildren((prev) => [...prev, child]);
    setNewName("");
    setNewGender("male");
    setNewBirthDate("");
    setShowAddSheet(false);
    toast.success(`تمت إضافة ${child.name}`);
  };

  const toggleVaccine = (childId: string, vaccineId: string) => {
    setChildren((prev) =>
      prev.map((child) => {
        if (child.id !== childId) return child;
        const completed = child.completedVaccines.includes(vaccineId)
          ? child.completedVaccines.filter((v) => v !== vaccineId)
          : [...child.completedVaccines, vaccineId];
        return { ...child, completedVaccines: completed };
      })
    );
  };

  const deleteChild = (childId: string) => {
    setChildren((prev) => prev.filter((c) => c.id !== childId));
    setSelectedChild(null);
    toast.success("تم حذف الطفل");
  };

  const totalVaccines = getTotalVaccines();

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center justify-between px-5 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -m-2 rounded-xl active:bg-accent">
            <ArrowRight className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">لقاحات الأطفال</h1>
          <button
            onClick={() => setShowAddSheet(true)}
            className="p-2 -m-2 rounded-xl active:bg-accent"
          >
            <Plus className="w-6 h-6 text-primary" />
          </button>
        </div>
      </div>

      {/* Children list */}
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

            return (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child)}
                className="w-full bg-card rounded-2xl p-4 border border-border/50 text-right active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      child.gender === "male"
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : "bg-pink-100 dark:bg-pink-900/30"
                    }`}
                  >
                    <Baby
                      className={`w-6 h-6 ${
                        child.gender === "male" ? "text-blue-500" : "text-pink-500"
                      }`}
                    />
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
              </button>
            );
          })
        )}
      </div>

      {/* Add Child Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh]">
          <SheetHeader>
            <SheetTitle className="text-center">إضافة طفل جديد</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 mt-6 px-1">
            <div className="space-y-2">
              <Label className="text-right block">اسم الطفل</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="أدخل اسم الطفل"
                className="text-right"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-right block">الجنس</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setNewGender("male")}
                  className={`p-3 rounded-xl border-2 text-center font-medium transition-colors ${
                    newGender === "male"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  👦 ذكر
                </button>
                <button
                  onClick={() => setNewGender("female")}
                  className={`p-3 rounded-xl border-2 text-center font-medium transition-colors ${
                    newGender === "female"
                      ? "border-pink-500 bg-pink-50 dark:bg-pink-900/20 text-pink-600"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  👧 أنثى
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-right block">تاريخ الميلاد</Label>
              <Input
                type="date"
                value={newBirthDate}
                onChange={(e) => setNewBirthDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="text-right"
              />
            </div>

            <Button onClick={handleAddChild} className="w-full h-12 text-base font-bold">
              إضافة الطفل
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Child Vaccine Detail Sheet */}
      <Sheet open={!!selectedChild} onOpenChange={(open) => !open && setSelectedChild(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
          {selectedChild && (
            <>
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => deleteChild(selectedChild.id)}
                    className="p-2 rounded-lg text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <SheetTitle className="text-center flex-1">
                    جدول لقاحات {selectedChild.name}
                  </SheetTitle>
                  <div className="w-9" />
                </div>
              </SheetHeader>

              {/* Summary */}
              <div className="mt-4 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    العمر: {getChildAge(selectedChild.birthDate)}
                  </span>
                  <span className="text-sm font-bold text-primary">
                    {selectedChild.completedVaccines.length}/{totalVaccines}
                  </span>
                </div>
                <Progress
                  value={Math.round(
                    (selectedChild.completedVaccines.length / totalVaccines) * 100
                  )}
                  className="h-2.5"
                />
              </div>

              {/* Vaccine schedule */}
              <Accordion type="multiple" className="mt-4">
                {vaccineSchedule.map((group) => {
                  const childAgeDays = Math.floor(
                    (new Date().getTime() - new Date(selectedChild.birthDate).getTime()) /
                      (1000 * 60 * 60 * 24)
                  );
                  const isDue = childAgeDays >= group.vaccines[0].ageDays;
                  const allCompleted = group.vaccines.every((v) =>
                    selectedChild.completedVaccines.includes(v.id)
                  );
                  const someCompleted =
                    !allCompleted &&
                    group.vaccines.some((v) =>
                      selectedChild.completedVaccines.includes(v.id)
                    );

                  return (
                    <AccordionItem key={group.id} value={group.id} className="border-b-0 mb-2">
                      <AccordionTrigger className="hover:no-underline p-3 rounded-xl bg-card border border-border/50">
                        <div className="flex items-center gap-3 flex-1 text-right">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              allCompleted
                                ? "bg-green-100 dark:bg-green-900/30"
                                : isDue && !allCompleted
                                ? "bg-amber-100 dark:bg-amber-900/30"
                                : "bg-muted"
                            }`}
                          >
                            {allCompleted ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : isDue ? (
                              <Clock className="w-4 h-4 text-amber-600" />
                            ) : (
                              <Clock className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1">
                            <span className="font-bold text-sm">{group.title}</span>
                            {someCompleted && (
                              <span className="text-xs text-muted-foreground mr-2">
                                (جزئي)
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {group.vaccines.filter((v) =>
                              selectedChild.completedVaccines.includes(v.id)
                            ).length}
                            /{group.vaccines.length}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-0">
                        <div className="space-y-2 pr-4">
                          {group.vaccines.map((vaccine) => {
                            const isCompleted =
                              selectedChild.completedVaccines.includes(vaccine.id);
                            const isOverdue =
                              isDue && !isCompleted;

                            return (
                              <button
                                key={vaccine.id}
                                onClick={() =>
                                  toggleVaccine(selectedChild.id, vaccine.id)
                                }
                                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-right ${
                                  isCompleted
                                    ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                                    : isOverdue
                                    ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                                    : "bg-card border-border/50"
                                }`}
                              >
                                <div
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                    isCompleted
                                      ? "bg-green-500 border-green-500"
                                      : "border-border"
                                  }`}
                                >
                                  {isCompleted && (
                                    <Check className="w-3.5 h-3.5 text-white" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p
                                    className={`text-sm font-medium ${
                                      isCompleted
                                        ? "line-through text-muted-foreground"
                                        : "text-foreground"
                                    }`}
                                  >
                                    {vaccine.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {vaccine.description}
                                  </p>
                                </div>
                                {isOverdue && (
                                  <Badge
                                    variant="outline"
                                    className="text-amber-600 border-amber-300 text-[10px] shrink-0"
                                  >
                                    مستحق
                                  </Badge>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Vaccinations;
