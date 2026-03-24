// Budget Page
import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import FAB from "@/components/FAB";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { Plus, Trash2, Wallet, TrendingDown, TrendingUp, DollarSign, CalendarDays, FolderOpen, Users, Check, Pencil, Plane, CalendarIcon } from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";
import PageHeader from "@/components/PageHeader";
import { useUserRole } from "@/contexts/UserRoleContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter,
} from "@/components/ui/drawer";
import { haptic } from "@/lib/haptics";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useBudgets } from "@/hooks/useBudgets";

interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  date?: string;
}

type BudgetType = "month" | "project" | "trip";

interface MonthBudget {
  id: string;
  type: BudgetType;
  month: string;
  label?: string;
  income: number;
  expenses: ExpenseItem[];
  sharedWith: string[];
  tripId?: string;
}

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const formatMonth = (m: string) => {
  const parts = m.split("-");
  if (parts.length !== 2) return m;
  const [y, mo] = parts;
  const idx = parseInt(mo) - 1;
  if (idx < 0 || idx > 11) return m;
  return `${MONTH_NAMES[idx]} ${y}`;
};

const getBudgetTitle = (b: MonthBudget) => {
  if (b.type === "trip") return `✈️ ${b.label || "رحلة"}`;
  if (b.type === "project") return b.label || "مشروع";
  return formatMonth(b.month);
};

const getAvailableYears = () => {
  const now = new Date();
  const years: number[] = [];
  for (let i = 0; i < 5; i++) years.push(now.getFullYear() + i);
  return years;
};

// Swipeable card component
const SwipeableCard = ({ children, onEdit, onDelete }: {
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isSwipingRef = useRef(false);
  const isOpenRef = useRef(false);

  const SWIPE_THRESHOLD = 60;
  const ACTION_WIDTH = onEdit ? 120 : 60;

  const setTransform = (x: number) => {
    if (containerRef.current) {
      const content = containerRef.current.querySelector('[data-swipe-content]') as HTMLElement;
      if (content) content.style.transform = `translateX(${x}px)`;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = 0;
    isSwipingRef.current = false;
    const content = containerRef.current?.querySelector('[data-swipe-content]') as HTMLElement;
    if (content) content.style.transition = 'none';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - startXRef.current;
    // RTL: swipe right (positive diff) reveals actions on the left side
    if (Math.abs(diff) > 10) isSwipingRef.current = true;

    if (isOpenRef.current) {
      currentXRef.current = Math.max(0, Math.min(ACTION_WIDTH, ACTION_WIDTH + diff));
    } else {
      currentXRef.current = Math.max(0, Math.min(ACTION_WIDTH, diff));
    }
    setTransform(currentXRef.current);
  };

  const handleTouchEnd = () => {
    const content = containerRef.current?.querySelector('[data-swipe-content]') as HTMLElement;
    if (content) content.style.transition = 'transform 0.3s ease';

    if (currentXRef.current > SWIPE_THRESHOLD) {
      setTransform(ACTION_WIDTH);
      isOpenRef.current = true;
    } else {
      setTransform(0);
      isOpenRef.current = false;
    }
  };

  const closeSwipe = () => {
    const content = containerRef.current?.querySelector('[data-swipe-content]') as HTMLElement;
    if (content) content.style.transition = 'transform 0.3s ease';
    setTransform(0);
    isOpenRef.current = false;
  };

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-2xl">
      {/* Action buttons behind */}
      <div className="absolute inset-y-0 left-0 flex items-stretch" style={{ width: ACTION_WIDTH }}>
        {onEdit && (
          <button
            onClick={() => { closeSwipe(); onEdit(); }}
            className="flex-1 flex items-center justify-center"
            style={{ background: "hsl(var(--primary))" }}
          >
            <Pencil size={18} className="text-white" />
          </button>
        )}
        <button
          onClick={() => { closeSwipe(); onDelete(); }}
          className="flex-1 flex items-center justify-center"
          style={{ background: "hsl(var(--destructive))" }}
        >
          <Trash2 size={18} className="text-white" />
        </button>
      </div>
      {/* Swipeable content */}
      <div
        data-swipe-content
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative z-10"
      >
        {children}
      </div>
    </div>
  );
};

const BudgetCard = ({ b, onSelect, remaining, spentPercent }: {
  b: MonthBudget;
  onSelect: (b: MonthBudget) => void;
  remaining: (b: MonthBudget) => number;
  spentPercent: (b: MonthBudget) => number;
}) => {
  const rem = remaining(b);
  const pct = spentPercent(b);
  const shared = (b.sharedWith ?? []).length > 0;
  return (
    <button
      onClick={() => onSelect(b)}
      className="w-full rounded-2xl bg-card border border-border p-4 text-right active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: b.type === "trip" ? "hsl(215 70% 50% / 0.15)" : b.type === "project" ? "hsl(var(--accent) / 0.15)" : "hsl(var(--primary) / 0.12)" }}>
          {b.type === "trip" ? <Plane size={20} style={{ color: "hsl(215 70% 50%)" }} /> : b.type === "project" ? <FolderOpen size={20} className="text-accent-foreground" /> : <CalendarDays size={20} className="text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">{getBudgetTitle(b)}</p>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground">{b.expenses.length} بنود</p>
            {b.type === "trip" && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "hsl(215 70% 50% / 0.12)", color: "hsl(215 70% 50%)" }}>
                منشأة تلقائياً من الرحلة
              </span>
            )}
            {shared && (
              <span className="text-[9px] text-primary/70 flex items-center gap-0.5">
                <Users size={10} /> مع {b.sharedWith.join("، ")}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-muted-foreground">الوارد: <b className="text-foreground">{b.income.toLocaleString()}</b></span>
        <span className={rem >= 0 ? "text-primary" : "text-destructive"}>
          المتبقي: <b>{rem.toLocaleString()}</b>
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </button>
  );
};


const Budget = () => {
  const navigate = useNavigate();
  const { featureAccess } = useUserRole();
  const { members: FAMILY_MEMBERS } = useFamilyMembers();
  const { budgets: dbBudgets, isLoading, createBudget, updateBudget, deleteBudget: deleteBudgetMut, addExpense: addExpenseMut, updateExpense: updateExpenseMut, deleteExpense: deleteExpenseMut } = useBudgets();

  // Map DB data to UI format
  const budgets: MonthBudget[] = useMemo(() => {
    return dbBudgets.map((b: any) => ({
      id: b.id,
      type: b.type as BudgetType,
      month: b.month || "",
      label: b.label,
      income: Number(b.income) || 0,
      expenses: (b.budget_expenses || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        amount: Number(e.amount),
        date: e.date,
      })),
      sharedWith: b.shared_with || [],
      tripId: b.trip_id,
    })).sort((a: MonthBudget, b: MonthBudget) => (a.month || "").localeCompare(b.month || ""));
  }, [dbBudgets]);

  const [selectedBudget, setSelectedBudget] = useState<MonthBudget | null>(null);
  const [showAddMonth, setShowAddMonth] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showEditIncome, setShowEditIncome] = useState(false);
  const [showDeleteBudget, setShowDeleteBudget] = useState<string | null>(null);
  const [showDeleteExpense, setShowDeleteExpense] = useState<{ budgetId: string; expenseId: string } | null>(null);
  const [showEditBudget, setShowEditBudget] = useState<MonthBudget | null>(null);
  const [showEditExpense, setShowEditExpense] = useState<{ budgetId: string; expense: ExpenseItem } | null>(null);

  const [budgetType, setBudgetType] = useState<BudgetType>("month");
  const [newMonthIdx, setNewMonthIdx] = useState(String(new Date().getMonth()));
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [projectLabel, setProjectLabel] = useState("");
  const [newIncome, setNewIncome] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [editIncomeVal, setEditIncomeVal] = useState("");
  const [shareNames, setShareNames] = useState<string[]>([]);
  const [editExpenseName, setEditExpenseName] = useState("");
  const [editExpenseAmount, setEditExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState<Date | undefined>(undefined);
  const [editExpenseDate, setEditExpenseDate] = useState<Date | undefined>(undefined);

  // FAMILY_MEMBERS now comes from DB query above

  // Keep selectedBudget in sync with latest data
  const currentSelectedBudget = useMemo(() => {
    if (!selectedBudget) return null;
    return budgets.find(b => b.id === selectedBudget.id) || null;
  }, [budgets, selectedBudget]);

  const handleAddBudget = () => {
    if (!newIncome || parseFloat(newIncome) <= 0) return;
    haptic.light();

    if (budgetType === "month") {
      const monthStr = `${newYear}-${String(parseInt(newMonthIdx) + 1).padStart(2, "0")}`;
      if (budgets.some(b => b.month === monthStr && b.type === "month")) return;
      createBudget.mutate({
        type: "month",
        month: monthStr,
        income: parseFloat(newIncome),
        shared_with: [...shareNames],
      });
    } else {
      if (!projectLabel.trim()) return;
      createBudget.mutate({
        type: "project",
        month: `project-${Date.now()}`,
        label: projectLabel.trim(),
        income: parseFloat(newIncome),
        shared_with: [...shareNames],
      });
    }

    setShowAddMonth(false);
    setNewIncome("");
    setProjectLabel("");
    setShareNames([]);
  };

  const handleAddExpense = () => {
    if (!currentSelectedBudget || !expenseName.trim() || !expenseAmount || parseFloat(expenseAmount) <= 0) return;
    haptic.light();
    addExpenseMut.mutate({
      budget_id: currentSelectedBudget.id,
      name: expenseName.trim(),
      amount: parseFloat(expenseAmount),
      date: expenseDate ? expenseDate.toISOString().split("T")[0] : undefined,
    });
    setShowAddExpense(false);
    setExpenseName("");
    setExpenseAmount("");
    setExpenseDate(undefined);
  };

  const handleEditIncome = () => {
    if (!currentSelectedBudget || !editIncomeVal || parseFloat(editIncomeVal) <= 0) return;
    haptic.light();
    updateBudget.mutate({ id: currentSelectedBudget.id, income: parseFloat(editIncomeVal) });
    setShowEditIncome(false);
  };

  const handleDeleteExpense = () => {
    if (!showDeleteExpense) return;
    haptic.medium();
    deleteExpenseMut.mutate(showDeleteExpense.expenseId);
    setShowDeleteExpense(null);
  };

  const handleDeleteBudget = () => {
    if (!showDeleteBudget) return;
    haptic.medium();
    deleteBudgetMut.mutate(showDeleteBudget);
    if (selectedBudget?.id === showDeleteBudget) setSelectedBudget(null);
    setShowDeleteBudget(null);
  };

  const handleEditExpense = () => {
    if (!showEditExpense || !editExpenseName.trim() || !editExpenseAmount || parseFloat(editExpenseAmount) <= 0) return;
    haptic.light();
    updateExpenseMut.mutate({
      id: showEditExpense.expense.id,
      name: editExpenseName.trim(),
      amount: parseFloat(editExpenseAmount),
      date: editExpenseDate ? editExpenseDate.toISOString().split("T")[0] : undefined,
    });
    setShowEditExpense(null);
  };

  const handleEditBudgetSave = () => {
    if (!showEditBudget || !newIncome || parseFloat(newIncome) <= 0) return;
    haptic.light();
    updateBudget.mutate({
      id: showEditBudget.id,
      income: parseFloat(newIncome),
      label: showEditBudget.type === "project" ? projectLabel.trim() || showEditBudget.label : showEditBudget.label,
      shared_with: [...shareNames],
    });
    setShowEditBudget(null);
    setNewIncome("");
    setProjectLabel("");
    setShareNames([]);
  };

  const onRefresh = useCallback(() => new Promise<void>(r => setTimeout(r, 600)), []);

  const totalExpenses = (b: MonthBudget) => b.expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = (b: MonthBudget) => b.income - totalExpenses(b);
  const spentPercent = (b: MonthBudget) => b.income > 0 ? Math.min((totalExpenses(b) / b.income) * 100, 100) : 0;

  // Detail view
  if (currentSelectedBudget) {
    const b = currentSelectedBudget;
    const rem = remaining(b);
    const spent = totalExpenses(b);
    const pct = spentPercent(b);

    return (
      <div className="min-h-screen max-w-2xl mx-auto bg-background pb-28" dir="rtl">
        <PageHeader
          title={getBudgetTitle(b)}
          subtitle={b.type === "trip" ? "ميزانية رحلة — تُدار تلقائياً" : "تفاصيل الميزانية"}
          onBack={() => setSelectedBudget(null)}
        />

        <FAB onClick={() => { setExpenseName(""); setExpenseAmount(""); setShowAddExpense(true); }} />

        <div className="px-4 mt-4 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => { setEditIncomeVal(b.income.toString()); setShowEditIncome(true); }}
              className="rounded-2xl p-3 text-center active:scale-95 transition-transform"
              style={{ background: "hsl(var(--primary) / 0.1)" }}
            >
              <TrendingUp size={18} className="mx-auto mb-1 text-primary" />
              <p className="text-[10px] text-muted-foreground">الوارد</p>
              <p className="text-sm font-bold text-primary">{b.income.toLocaleString()}</p>
            </button>
            <div className="rounded-2xl p-3 text-center" style={{ background: "hsl(var(--destructive) / 0.1)" }}>
              <TrendingDown size={18} className="mx-auto mb-1 text-destructive" />
              <p className="text-[10px] text-muted-foreground">المصروفات</p>
              <p className="text-sm font-bold text-destructive">{spent.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ background: rem >= 0 ? "hsl(var(--primary) / 0.08)" : "hsl(var(--destructive) / 0.08)" }}>
              <Wallet size={18} className={`mx-auto mb-1 ${rem >= 0 ? "text-primary" : "text-destructive"}`} />
              <p className="text-[10px] text-muted-foreground">المتبقي</p>
              <p className={`text-sm font-bold ${rem >= 0 ? "text-primary" : "text-destructive"}`}>{rem.toLocaleString()}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="rounded-2xl bg-card p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">نسبة الإنفاق</span>
              <span className="text-xs font-bold" style={{ color: pct > 90 ? "hsl(var(--destructive))" : "hsl(var(--primary))" }}>
                {pct.toFixed(0)}%
              </span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>

          {/* Expense Items */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground px-1">بنود المصروفات</h3>
            {b.expenses.length === 0 ? (
              <div className="rounded-2xl bg-card border border-border p-8 text-center">
                <DollarSign size={32} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">لا توجد بنود بعد</p>
                <p className="text-xs text-muted-foreground/60 mt-1">اضغط + لإضافة بند</p>
              </div>
            ) : (
              b.expenses.map((exp) => (
                <SwipeableCard
                  key={exp.id}
                  onEdit={() => {
                    setEditExpenseName(exp.name);
                    setEditExpenseAmount(exp.amount.toString());
                    setEditExpenseDate(exp.date ? new Date(exp.date) : undefined);
                    setShowEditExpense({ budgetId: b.id, expense: exp });
                  }}
                  onDelete={() => setShowDeleteExpense({ budgetId: b.id, expenseId: exp.id })}
                >
                  <div className="rounded-2xl bg-card border border-border p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--destructive) / 0.1)" }}>
                      <TrendingDown size={16} className="text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{exp.name}</p>
                      {exp.date && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(exp.date), "d MMMM yyyy", { locale: ar })}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-bold text-destructive">{exp.amount.toLocaleString()}</p>
                  </div>
                </SwipeableCard>
              ))
            )}
          </div>
        </div>

        {/* Add Expense Drawer */}
        <Drawer open={showAddExpense} onOpenChange={setShowAddExpense}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>إضافة بند مصروف</DrawerTitle>
              <DrawerDescription>أضف بند جديد سيتم خصمه من الميزانية</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 space-y-3">
              <Input
                placeholder="اسم البند (مثال: إيجار، فواتير...)"
                value={expenseName}
                onChange={e => setExpenseName(e.target.value)}
                className="text-right"
              />
              <Input
                type="number"
                placeholder="المبلغ"
                value={expenseAmount}
                onChange={e => setExpenseAmount(e.target.value)}
                className="text-right"
                inputMode="decimal"
              />
              {/* Date picker (optional) */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">التاريخ (اختياري)</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-right font-normal",
                        !expenseDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                      {expenseDate ? format(expenseDate, "d MMMM yyyy", { locale: ar }) : <span>اختر تاريخ</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expenseDate}
                      onSelect={setExpenseDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DrawerFooter>
              <Button onClick={handleAddExpense} disabled={!expenseName.trim() || !expenseAmount}>
                إضافة
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Edit Income Drawer */}
        <Drawer open={showEditIncome} onOpenChange={setShowEditIncome}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>تعديل المبلغ الوارد</DrawerTitle>
              <DrawerDescription>عدّل المبلغ الإجمالي للميزانية</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <Input
                type="number"
                placeholder="المبلغ الوارد"
                value={editIncomeVal}
                onChange={e => setEditIncomeVal(e.target.value)}
                className="text-right"
                inputMode="decimal"
              />
            </div>
            <DrawerFooter>
              <Button onClick={handleEditIncome} disabled={!editIncomeVal}>
                حفظ
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Edit Expense Drawer */}
        <Drawer open={!!showEditExpense} onOpenChange={(open) => { if (!open) setShowEditExpense(null); }}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>تعديل البند</DrawerTitle>
              <DrawerDescription>عدّل اسم أو مبلغ البند</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 space-y-3">
              <Input
                placeholder="اسم البند"
                value={editExpenseName}
                onChange={e => setEditExpenseName(e.target.value)}
                className="text-right"
              />
              <Input
                type="number"
                placeholder="المبلغ"
                value={editExpenseAmount}
                onChange={e => setEditExpenseAmount(e.target.value)}
                className="text-right"
                inputMode="decimal"
              />
              {/* Date picker (optional) */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">التاريخ (اختياري)</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-right font-normal",
                        !editExpenseDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                      {editExpenseDate ? format(editExpenseDate, "d MMMM yyyy", { locale: ar }) : <span>اختر تاريخ</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editExpenseDate}
                      onSelect={setEditExpenseDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DrawerFooter>
              <Button onClick={handleEditExpense} disabled={!editExpenseName.trim() || !editExpenseAmount}>
                حفظ
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Delete Expense Drawer (bottom sheet) */}
        <Drawer open={!!showDeleteExpense} onOpenChange={(open) => { if (!open) setShowDeleteExpense(null); }}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>حذف البند</DrawerTitle>
              <DrawerDescription>هل تريد حذف هذا البند من المصروفات؟</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <Button variant="destructive" onClick={handleDeleteExpense}>
                حذف
              </Button>
              <Button variant="outline" onClick={() => setShowDeleteExpense(null)}>
                إلغاء
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen max-w-2xl mx-auto bg-background pb-28" dir="rtl">
      <PageHeader title="الميزانية" subtitle="تخطيط ميزانيتك الشهرية" onBack={() => navigate("/")}>
        <div className="flex items-center gap-1.5 mt-2 px-1 pb-1">
          <span className="text-[10px] text-white/60">🔒 ميزانيتك خاصة ولا يراها أفراد العائلة إلا إذا شاركتها معهم</span>
        </div>
      </PageHeader>

      <PullToRefresh onRefresh={onRefresh}>
        <div className="px-4 mt-4 space-y-3">
          {budgets.length === 0 ? (
            <div className="rounded-2xl bg-card border border-border p-12 text-center mt-8">
              <Wallet size={48} className="mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-base font-semibold text-foreground">لا توجد ميزانيات</p>
              <p className="text-sm text-muted-foreground mt-1">اضغط + لإضافة ميزانية جديدة</p>
            </div>
          ) : (
            <>
              {/* Trip Budgets */}
              {budgets.some(b => b.type === "trip") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Plane size={14} style={{ color: "hsl(215 70% 50%)" }} />
                    <h3 className="text-xs font-bold text-foreground">ميزانيات الرحلات</h3>
                    <span className="text-[9px] text-muted-foreground">(تُدار تلقائياً)</span>
                  </div>
                  {budgets.filter(b => b.type === "trip").map(b => (
                    <BudgetCard key={b.id} b={b} onSelect={setSelectedBudget} remaining={remaining} spentPercent={spentPercent} />
                  ))}
                </div>
              )}

              {/* Shared Budgets */}
              {budgets.some(b => b.type !== "trip" && (b.sharedWith ?? []).length > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Users size={14} className="text-primary" />
                    <h3 className="text-xs font-bold text-foreground">ميزانيات مشتركة</h3>
                  </div>
                  {budgets.filter(b => b.type !== "trip" && (b.sharedWith ?? []).length > 0).map(b => (
                    <SwipeableCard
                      key={b.id}
                      onEdit={() => {
                        setShowEditBudget(b);
                        setNewIncome(b.income.toString());
                        setProjectLabel(b.label || "");
                        setShareNames([...b.sharedWith]);
                      }}
                      onDelete={() => setShowDeleteBudget(b.id)}
                    >
                      <BudgetCard b={b} onSelect={setSelectedBudget} remaining={remaining} spentPercent={spentPercent} />
                    </SwipeableCard>
                  ))}
                </div>
              )}

              {/* Personal Budgets */}
              {budgets.some(b => b.type !== "trip" && (b.sharedWith ?? []).length === 0) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Wallet size={14} className="text-primary" />
                    <h3 className="text-xs font-bold text-foreground">ميزانيات شخصية</h3>
                  </div>
                  {budgets.filter(b => b.type !== "trip" && (b.sharedWith ?? []).length === 0).map(b => (
                    <SwipeableCard
                      key={b.id}
                      onEdit={() => {
                        setShowEditBudget(b);
                        setNewIncome(b.income.toString());
                        setProjectLabel(b.label || "");
                        setShareNames([...b.sharedWith]);
                      }}
                      onDelete={() => setShowDeleteBudget(b.id)}
                    >
                      <BudgetCard b={b} onSelect={setSelectedBudget} remaining={remaining} spentPercent={spentPercent} />
                    </SwipeableCard>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </PullToRefresh>

      <FAB onClick={() => {
        haptic.light();
        setBudgetType("month");
        setNewMonthIdx(String(new Date().getMonth()));
        setNewYear(String(new Date().getFullYear()));
        setProjectLabel("");
        setNewIncome("");
        setShareNames([]);
        setShowAddMonth(true);
      }} />

      {/* Add Budget Drawer */}
      <Drawer open={showAddMonth} onOpenChange={setShowAddMonth}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>إضافة ميزانية جديدة</DrawerTitle>
            <DrawerDescription>اختر نوع الميزانية وحدد المبلغ الوارد</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 space-y-4">
            {/* Type Selection */}
            <div className="flex gap-2">
              <button
                onClick={() => setBudgetType("month")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  budgetType === "month"
                    ? "text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
                style={budgetType === "month" ? { background: "hsl(var(--primary))" } : {}}
              >
                ميزانية شهرية
              </button>
              <button
                onClick={() => setBudgetType("project")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  budgetType === "project"
                    ? "text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
                style={budgetType === "project" ? { background: "hsl(var(--primary))" } : {}}
              >
                مبلغ / مشروع
              </button>
            </div>

            {budgetType === "month" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">الشهر</label>
                  <select
                    value={newMonthIdx}
                    onChange={e => setNewMonthIdx(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-right"
                  >
                    {MONTH_NAMES.map((name, i) => (
                      <option key={i} value={String(i)}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">السنة</label>
                  <select
                    value={newYear}
                    onChange={e => setNewYear(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-right"
                  >
                    {getAvailableYears().map(y => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">اسم المشروع أو الوصف</label>
                <Input
                  placeholder="مثال: تجهيز المنزل، رحلة..."
                  value={projectLabel}
                  onChange={e => setProjectLabel(e.target.value)}
                  className="text-right"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">المبلغ الوارد</label>
              <Input
                type="number"
                placeholder="مثال: 10000"
                value={newIncome}
                onChange={e => setNewIncome(e.target.value)}
                className="text-right"
                inputMode="decimal"
              />
            </div>

            {/* Sharing */}
            {!featureAccess.isStaff && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                <Users size={12} className="inline ml-1" />
                مشاركة مع (اختياري)
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {FAMILY_MEMBERS.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا يوجد أفراد عائلة للمشاركة معهم</p>
                ) : FAMILY_MEMBERS.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() =>
                      setShareNames((prev) =>
                        prev.includes(member.name) ? prev.filter((m) => m !== member.name) : [...prev, member.name]
                      )
                    }
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-sm transition-all ${
                      shareNames.includes(member.name)
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <span className="font-medium text-foreground">{member.name}</span>
                    {shareNames.includes(member.name) && <Check size={14} className="text-primary" />}
                  </button>
                ))}
              </div>
              {shareNames.length === 0 && (
                <p className="text-[10px] text-muted-foreground/60 mt-2">🔒 ستبقى خاصة بك فقط</p>
              )}
            </div>
            )}
          </div>
          <DrawerFooter>
            <Button
              onClick={handleAddBudget}
              disabled={!newIncome || (budgetType === "project" && !projectLabel.trim())}
            >
              إضافة
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Edit Budget Drawer */}
      <Drawer open={!!showEditBudget} onOpenChange={(open) => { if (!open) setShowEditBudget(null); }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>تعديل الميزانية</DrawerTitle>
            <DrawerDescription>عدّل تفاصيل الميزانية</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 space-y-4">
            {showEditBudget?.type === "project" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">اسم المشروع</label>
                <Input
                  placeholder="اسم المشروع"
                  value={projectLabel}
                  onChange={e => setProjectLabel(e.target.value)}
                  className="text-right"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">المبلغ الوارد</label>
              <Input
                type="number"
                placeholder="المبلغ الوارد"
                value={newIncome}
                onChange={e => setNewIncome(e.target.value)}
                className="text-right"
                inputMode="decimal"
              />
            </div>
            {!featureAccess.isStaff && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                <Users size={12} className="inline ml-1" />
                مشاركة مع
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {FAMILY_MEMBERS.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا يوجد أفراد عائلة للمشاركة معهم</p>
                ) : FAMILY_MEMBERS.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() =>
                      setShareNames((prev) =>
                        prev.includes(member.name) ? prev.filter((m) => m !== member.name) : [...prev, member.name]
                      )
                    }
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-sm transition-all ${
                      shareNames.includes(member.name)
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <span className="font-medium text-foreground">{member.name}</span>
                    {shareNames.includes(member.name) && <Check size={14} className="text-primary" />}
                  </button>
                ))}
              </div>
            </div>
            )}
          </div>
          <DrawerFooter>
            <Button onClick={handleEditBudgetSave} disabled={!newIncome}>
              حفظ
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Delete Budget Drawer (bottom sheet) */}
      <Drawer open={!!showDeleteBudget} onOpenChange={(open) => { if (!open) setShowDeleteBudget(null); }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>حذف الميزانية</DrawerTitle>
            <DrawerDescription>هل تريد حذف ميزانية هذا الشهر بالكامل؟</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button variant="destructive" onClick={handleDeleteBudget}>
              حذف
            </Button>
            <Button variant="outline" onClick={() => setShowDeleteBudget(null)}>
              إلغاء
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Budget;
