// Budget Page
import { useState, useCallback } from "react";
import { Plus, Trash2, Wallet, TrendingDown, TrendingUp, DollarSign, CalendarDays, FolderOpen, Users, X, UserPlus } from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter,
} from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { haptic } from "@/lib/haptics";
import { Progress } from "@/components/ui/progress";

interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
}

type BudgetType = "month" | "project";

interface MonthBudget {
  id: string;
  type: BudgetType;
  month: string;
  label?: string;
  income: number;
  expenses: ExpenseItem[];
  sharedWith: string[]; // names of people shared with
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
  if (b.type === "project") return b.label || "مشروع";
  return formatMonth(b.month);
};

const getAvailableYears = () => {
  const now = new Date();
  const years: number[] = [];
  for (let i = 0; i < 5; i++) years.push(now.getFullYear() + i);
  return years;
};


const STORAGE_KEY = "budgets_data";

const loadBudgets = (): MonthBudget[] => {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    return d ? JSON.parse(d) : [];
  } catch { return []; }
};

const saveBudgets = (b: MonthBudget[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(b));

const Budget = () => {
  const [budgets, setBudgets] = useState<MonthBudget[]>(loadBudgets);
  const [selectedBudget, setSelectedBudget] = useState<MonthBudget | null>(null);
  const [showAddMonth, setShowAddMonth] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showEditIncome, setShowEditIncome] = useState(false);
  const [showDeleteBudget, setShowDeleteBudget] = useState<string | null>(null);
  const [showDeleteExpense, setShowDeleteExpense] = useState<{ budgetId: string; expenseId: string } | null>(null);

  const [budgetType, setBudgetType] = useState<BudgetType>("month");
  const [newMonthIdx, setNewMonthIdx] = useState(String(new Date().getMonth()));
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [projectLabel, setProjectLabel] = useState("");
  const [newIncome, setNewIncome] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [editIncomeVal, setEditIncomeVal] = useState("");
  const [shareNames, setShareNames] = useState<string[]>([]);
  const [newShareName, setNewShareName] = useState("");

  const update = useCallback((newBudgets: MonthBudget[]) => {
    const sorted = [...newBudgets].sort((a, b) => a.month.localeCompare(b.month));
    setBudgets(sorted);
    saveBudgets(sorted);
  }, []);

  const handleAddBudget = () => {
    if (!newIncome || parseFloat(newIncome) <= 0) return;
    haptic.light();

    if (budgetType === "month") {
      const monthStr = `${newYear}-${String(parseInt(newMonthIdx) + 1).padStart(2, "0")}`;
      if (budgets.some(b => b.month === monthStr && b.type === "month")) return;
      const b: MonthBudget = {
        id: Date.now().toString(),
        type: "month",
        month: monthStr,
        income: parseFloat(newIncome),
        expenses: [],
        sharedWith: [...shareNames],
      };
      update([...budgets, b]);
    } else {
      if (!projectLabel.trim()) return;
      const b: MonthBudget = {
        id: Date.now().toString(),
        type: "project",
        month: `project-${Date.now()}`,
        label: projectLabel.trim(),
        income: parseFloat(newIncome),
        expenses: [],
      };
      update([...budgets, b]);
    }

    setShowAddMonth(false);
    setNewIncome("");
    setProjectLabel("");
  };

  const handleAddExpense = () => {
    if (!selectedBudget || !expenseName.trim() || !expenseAmount || parseFloat(expenseAmount) <= 0) return;
    haptic.light();
    const expense: ExpenseItem = {
      id: Date.now().toString(),
      name: expenseName.trim(),
      amount: parseFloat(expenseAmount),
    };
    const updated = budgets.map(b =>
      b.id === selectedBudget.id ? { ...b, expenses: [...b.expenses, expense] } : b
    );
    update(updated);
    const updatedBudget = updated.find(b => b.id === selectedBudget.id)!;
    setSelectedBudget(updatedBudget);
    setShowAddExpense(false);
    setExpenseName("");
    setExpenseAmount("");
  };

  const handleEditIncome = () => {
    if (!selectedBudget || !editIncomeVal || parseFloat(editIncomeVal) <= 0) return;
    haptic.light();
    const updated = budgets.map(b =>
      b.id === selectedBudget.id ? { ...b, income: parseFloat(editIncomeVal) } : b
    );
    update(updated);
    setSelectedBudget(updated.find(b => b.id === selectedBudget.id)!);
    setShowEditIncome(false);
  };

  const handleDeleteExpense = () => {
    if (!showDeleteExpense) return;
    haptic.medium();
    const updated = budgets.map(b =>
      b.id === showDeleteExpense.budgetId
        ? { ...b, expenses: b.expenses.filter(e => e.id !== showDeleteExpense.expenseId) }
        : b
    );
    update(updated);
    if (selectedBudget?.id === showDeleteExpense.budgetId) {
      setSelectedBudget(updated.find(b => b.id === showDeleteExpense.budgetId)!);
    }
    setShowDeleteExpense(null);
  };

  const handleDeleteBudget = () => {
    if (!showDeleteBudget) return;
    haptic.medium();
    update(budgets.filter(b => b.id !== showDeleteBudget));
    if (selectedBudget?.id === showDeleteBudget) setSelectedBudget(null);
    setShowDeleteBudget(null);
  };

  const onRefresh = useCallback(() => new Promise<void>(r => setTimeout(r, 600)), []);

  const totalExpenses = (b: MonthBudget) => b.expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = (b: MonthBudget) => b.income - totalExpenses(b);
  const spentPercent = (b: MonthBudget) => b.income > 0 ? Math.min((totalExpenses(b) / b.income) * 100, 100) : 0;

  

  // Detail view
  if (selectedBudget) {
    const b = selectedBudget;
    const rem = remaining(b);
    const spent = totalExpenses(b);
    const pct = spentPercent(b);

    return (
      <div className="min-h-screen bg-background pb-28" dir="rtl">
        <PageHeader
          title={getBudgetTitle(b)}
          subtitle="تفاصيل الميزانية"
          onBack={() => setSelectedBudget(null)}
        />

        {/* FAB for adding expense */}
        <button
          onClick={() => { setExpenseName(""); setExpenseAmount(""); setShowAddExpense(true); }}
          className="fixed left-4 bottom-24 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
          style={{
            background: "linear-gradient(135deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)))",
            boxShadow: "0 8px 25px hsl(var(--hero-gradient-from) / 0.4)",
          }}
        >
          <Plus size={24} className="text-white" />
        </button>

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
                <div key={exp.id} className="rounded-2xl bg-card border border-border p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--destructive) / 0.1)" }}>
                    <TrendingDown size={16} className="text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{exp.name}</p>
                  </div>
                  <p className="text-sm font-bold text-destructive">{exp.amount.toLocaleString()}</p>
                  <button
                    onClick={() => setShowDeleteExpense({ budgetId: b.id, expenseId: exp.id })}
                    className="p-1.5 rounded-full active:scale-90 transition-transform"
                    style={{ background: "hsl(var(--destructive) / 0.1)" }}
                  >
                    <Trash2 size={14} className="text-destructive" />
                  </button>
                </div>
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

        {/* Delete Expense Dialog */}
        <AlertDialog open={!!showDeleteExpense} onOpenChange={() => setShowDeleteExpense(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف البند</AlertDialogTitle>
              <AlertDialogDescription>هل تريد حذف هذا البند من المصروفات؟</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteExpense}>حذف</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-background pb-28" dir="rtl">
      <PageHeader title="الميزانية" subtitle="تخطيط ميزانيتك الشهرية">
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
              <p className="text-sm text-muted-foreground mt-1">اضغط + لإضافة ميزانية شهر جديد</p>
            </div>
          ) : (
            budgets.map(b => {
              const rem = remaining(b);
              const pct = spentPercent(b);
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBudget(b)}
                  className="w-full rounded-2xl bg-card border border-border p-4 text-right active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: b.type === "project" ? "hsl(var(--accent) / 0.15)" : "hsl(var(--primary) / 0.12)" }}>
                      {b.type === "project" ? <FolderOpen size={20} className="text-accent-foreground" /> : <CalendarDays size={20} className="text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{getBudgetTitle(b)}</p>
                      <p className="text-[10px] text-muted-foreground">{b.expenses.length} بنود</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setShowDeleteBudget(b.id); }}
                      className="p-1.5 rounded-full"
                      style={{ background: "hsl(var(--destructive) / 0.1)" }}
                    >
                      <Trash2 size={14} className="text-destructive" />
                    </button>
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
            })
          )}
        </div>
      </PullToRefresh>

      {/* FAB */}
      <button
        onClick={() => {
          haptic.light();
          setBudgetType("month");
          setNewMonthIdx(String(new Date().getMonth()));
          setNewYear(String(new Date().getFullYear()));
          setProjectLabel("");
          setNewIncome("");
          setShowAddMonth(true);
        }}
        className="fixed left-4 bottom-24 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
        style={{
          background: "linear-gradient(135deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)))",
          boxShadow: "0 8px 25px hsl(var(--hero-gradient-from) / 0.4)",
        }}
      >
        <Plus size={24} className="text-white" />
      </button>

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

      {/* Delete Budget Dialog */}
      <AlertDialog open={!!showDeleteBudget} onOpenChange={() => setShowDeleteBudget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الميزانية</AlertDialogTitle>
            <AlertDialogDescription>هل تريد حذف ميزانية هذا الشهر بالكامل؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBudget}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Budget;
