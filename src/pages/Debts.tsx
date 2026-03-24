import { useState, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Plus, Check, Clock, AlertTriangle, CreditCard, ChevronDown, ChevronUp, X, Coins, Trash2, Pencil, CircleCheckBig, HandCoins, CalendarClock, Bell, BellOff, History } from "lucide-react";
import { CardPageSkeleton } from "@/components/PageSkeletons";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import PageHeader from "@/components/PageHeader";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useDebts } from "@/hooks/useDebts";
import { toast } from "sonner";

type PaymentType = "cash" | "item" | "installment";

const CURRENCIES = [
  { code: "SAR", label: "ريال سعودي", symbol: "ر.س" },
  { code: "QAR", label: "ريال قطري", symbol: "ر.ق" },
  { code: "USD", label: "دولار أمريكي", symbol: "$" },
  { code: "EUR", label: "يورو", symbol: "€" },
  { code: "GBP", label: "جنيه إسترليني", symbol: "£" },
  { code: "AED", label: "درهم إماراتي", symbol: "د.إ" },
  { code: "KWD", label: "دينار كويتي", symbol: "د.ك" },
  { code: "GOLD_OZ", label: "أونصة ذهب", symbol: "أونصة" },
  { code: "GOLD_G", label: "غرام ذهب", symbol: "غرام" },
] as const;

type CurrencyCode = typeof CURRENCIES[number]["code"];

const getCurrencySymbol = (code: string) => CURRENCIES.find((c) => c.code === code)?.symbol || code;

interface DebtAmount {
  amount: number;
  currency: CurrencyCode;
}

interface Payment {
  id: string;
  amounts: DebtAmount[];
  date: string;
  type: PaymentType;
  itemDescription?: string;
}

interface Postponement {
  newDate: string;
  reason: string;
  date: string;
}

interface Debt {
  id: string;
  personName: string;
  amounts: DebtAmount[];
  direction: "given" | "taken";
  date: string;
  dueDate: string;
  note: string;
  payments: Payment[];
  isFullyPaid: boolean;
  isArchived: boolean;
  hasReminder: boolean;
  postponements: Postponement[];
}

/* ── Map Supabase row → UI Debt ── */
const mapRawToDebt = (raw: any): Debt => {
  const pd = raw.payment_details as any;
  const amounts: DebtAmount[] = pd?.amounts
    ? pd.amounts.map((a: any) => ({ amount: Number(a.amount), currency: a.currency as CurrencyCode }))
    : [{ amount: Number(raw.amount), currency: (raw.currency || "SAR") as CurrencyCode }];

  const payments: Payment[] = (raw.debt_payments || []).map((p: any) => {
    const ppd = p.payment_details as any;
    return {
      id: p.id,
      amounts: ppd?.amounts
        ? ppd.amounts.map((a: any) => ({ amount: Number(a.amount), currency: a.currency as CurrencyCode }))
        : [{ amount: Number(p.amount), currency: (p.currency || "SAR") as CurrencyCode }],
      date: p.date || p.created_at?.split("T")[0] || "",
      type: (p.type || "cash") as PaymentType,
      itemDescription: p.item_description,
    };
  });

  const postponements: Postponement[] = (raw.debt_postponements || []).map((pp: any) => ({
    newDate: pp.new_date || "",
    reason: pp.reason || "",
    date: pp.created_at?.split("T")[0] || "",
  }));

  return {
    id: raw.id,
    personName: raw.person_name,
    amounts,
    direction: raw.direction as "given" | "taken",
    date: raw.date || raw.created_at?.split("T")[0] || "",
    dueDate: raw.due_date || "",
    note: raw.note || "",
    payments,
    isFullyPaid: raw.is_fully_paid,
    isArchived: raw.is_archived,
    hasReminder: raw.has_reminder,
    postponements,
  };
};

// ── Swipeable card ──
const ACTION_WIDTH = 140;
const SwipeableDebtCard = ({
  children,
  onDelete,
  onEdit,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  onEdit: () => void;
}) => {
  const [swipeX, setSwipeX] = useState(0);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    isDraggingRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const diff = e.touches[0].clientX - startXRef.current;
    if (diff > 0) setSwipeX(Math.min(diff, ACTION_WIDTH));
    else setSwipeX(0);
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    setSwipeX((prev) => (prev > 60 ? ACTION_WIDTH : 0));
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div
        className="absolute inset-y-0 left-0 flex items-stretch gap-0.5 rounded-r-2xl overflow-hidden p-0.5"
        style={{ width: ACTION_WIDTH, opacity: swipeX > 0 ? 1 : 0, pointerEvents: swipeX > 0 ? "auto" : "none" }}
      >
        <button
          onClick={() => { onEdit(); setSwipeX(0); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl"
          style={{ background: "hsl(220, 60%, 50%)" }}
        >
          <Pencil size={16} className="text-white" />
          <span className="text-[10px] text-white font-bold">تعديل</span>
        </button>
        <button
          onClick={() => { onDelete(); setSwipeX(0); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-destructive rounded-xl"
        >
          <Trash2 size={16} className="text-destructive-foreground" />
          <span className="text-[10px] text-destructive-foreground font-bold">حذف</span>
        </button>
      </div>
      <div
        className="relative z-10 bg-background rounded-2xl"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isDraggingRef.current ? "none" : "transform 300ms ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (swipeX > 0) setSwipeX(0); }}
      >
        {children}
      </div>
    </div>
  );
};

const formatNumber = (n: number) => n.toLocaleString("ar-SA");
const formatDate = (d: string) => {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
};

const formatDebtAmount = (da: DebtAmount) => `${formatNumber(da.amount)} ${getCurrencySymbol(da.currency)}`;
const formatAmountsList = (amounts: DebtAmount[]) => amounts.map(formatDebtAmount).join(" + ");

const isOverdue = (dueDate: string, isFullyPaid: boolean) => {
  if (isFullyPaid || !dueDate) return false;
  return new Date(dueDate) < new Date();
};

const getDaysUntilDue = (dueDate: string) => {
  const diff = new Date(dueDate).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const getPaidByCurrency = (debt: Debt): Record<string, number> => {
  const paid: Record<string, number> = {};
  debt.payments.forEach((p) => {
    p.amounts.forEach((a) => {
      paid[a.currency] = (paid[a.currency] || 0) + a.amount;
    });
  });
  return paid;
};

const getRemainingAmounts = (debt: Debt): DebtAmount[] => {
  const paid = getPaidByCurrency(debt);
  return debt.amounts.map((a) => ({
    amount: Math.max(0, a.amount - (paid[a.currency] || 0)),
    currency: a.currency,
  })).filter((a) => a.amount > 0);
};

const getProgressForDebt = (debt: Debt): number => {
  const totalValue = debt.amounts.reduce((s, a) => s + a.amount, 0);
  if (totalValue === 0) return 100;
  const paid = getPaidByCurrency(debt);
  const paidValue = debt.amounts.reduce((s, a) => s + Math.min(a.amount, paid[a.currency] || 0), 0);
  return (paidValue / totalValue) * 100;
};

const getSummaryByCurrency = (debts: Debt[]): DebtAmount[] => {
  const totals: Record<string, number> = {};
  debts.filter((d) => !d.isArchived).forEach((d) => {
    const remaining = getRemainingAmounts(d);
    remaining.forEach((r) => {
      totals[r.currency] = (totals[r.currency] || 0) + r.amount;
    });
  });
  return Object.entries(totals).map(([currency, amount]) => ({ amount, currency: currency as CurrencyCode }));
};

const AmountEditor = ({
  amounts,
  setAmounts,
}: {
  amounts: { amount: string; currency: CurrencyCode }[];
  setAmounts: (a: { amount: string; currency: CurrencyCode }[]) => void;
}) => (
  <div className="space-y-2">
    {amounts.map((entry, i) => (
      <div key={i} className="flex gap-2 items-center">
        <input
          type="number"
          placeholder="المبلغ"
          value={entry.amount}
          onChange={(e) => {
            const updated = [...amounts];
            updated[i] = { ...updated[i], amount: e.target.value };
            setAmounts(updated);
          }}
          className="flex-1 min-w-0 rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
          inputMode="decimal"
        />
        <select
          value={entry.currency}
          onChange={(e) => {
            const updated = [...amounts];
            updated[i] = { ...updated[i], currency: e.target.value as CurrencyCode };
            setAmounts(updated);
          }}
          className="w-20 shrink-0 rounded-xl border border-input bg-background px-1.5 py-2.5 text-[11px]"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.symbol} {c.label}</option>
          ))}
        </select>
        {amounts.length > 1 && (
          <button
            onClick={() => setAmounts(amounts.filter((_, j) => j !== i))}
            className="p-1.5 rounded-lg bg-destructive/10 text-destructive"
          >
            <X size={14} />
          </button>
        )}
      </div>
    ))}
    <button
      onClick={() => setAmounts([...amounts, { amount: "", currency: "SAR" }])}
      className="flex items-center gap-1 text-xs font-bold text-primary py-1.5"
    >
      <Coins size={14} />
      + إضافة عملة أخرى
    </button>
  </div>
);

const Debts = () => {
  const navigate = useNavigate();
  const { debts: rawDebts, isLoading, addDebt, updateDebt, deleteDebt, addPayment, addPostponement } = useDebts();

  const [activeTab, setActiveTab] = useState<"given" | "taken">("given");
  const [expandedDebt, setExpandedDebt] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormType, setAddFormType] = useState<"given" | "taken">("given");
  const [showFabMenu, setShowFabMenu] = useState(false);

  // Payment drawer
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [paymentDebtId, setPaymentDebtId] = useState<string | null>(null);
  // Postpone drawer
  const [showPostponeDrawer, setShowPostponeDrawer] = useState(false);
  const [postponeDebtId, setPostponeDebtId] = useState<string | null>(null);
  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const [newDebt, setNewDebt] = useState({ personName: "", date: "", dueDate: "", note: "" });
  const [newDebtAmounts, setNewDebtAmounts] = useState<{ amount: string; currency: CurrencyCode }[]>([{ amount: "", currency: "SAR" }]);

  const [newPayment, setNewPayment] = useState({ type: "cash" as PaymentType, itemDescription: "" });
  const [newPaymentAmounts, setNewPaymentAmounts] = useState<{ amount: string; currency: CurrencyCode }[]>([{ amount: "", currency: "SAR" }]);

  const [postponeData, setPostponeData] = useState({ newDate: "", reason: "" });
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);

  // ── Map Supabase data to UI model ──
  const allDebts = useMemo(() => rawDebts.map(mapRawToDebt), [rawDebts]);
  const givenDebts = useMemo(() => allDebts.filter((d) => d.direction === "given"), [allDebts]);
  const takenDebts = useMemo(() => allDebts.filter((d) => d.direction === "taken"), [allDebts]);

  const debts = activeTab === "given" ? givenDebts : takenDebts;
  const activeDebts = debts.filter((d) => !d.isArchived);
  const archivedDebts = debts.filter((d) => d.isArchived);

  const givenSummary = getSummaryByCurrency(givenDebts);
  const takenSummary = getSummaryByCurrency(takenDebts);

  const handleMarkFullyPaid = async (debtId: string) => {
    const debt = allDebts.find((d) => d.id === debtId);
    if (!debt) return;
    const remaining = getRemainingAmounts(debt);
    // Add final payment
    if (remaining.length > 0) {
      await addPayment.mutateAsync({
        debt_id: debtId,
        amount: remaining[0].amount,
        currency: remaining[0].currency,
        type: "cash",
        date: new Date().toISOString().split("T")[0],
        ...(remaining.length > 1
          ? { payment_details: { amounts: remaining.map((r) => ({ amount: r.amount, currency: r.currency })) } }
          : {}),
      });
    }
    await updateDebt.mutateAsync({ id: debtId, is_fully_paid: true, is_archived: true });
    toast.success("تم تسجيل السداد الكامل");
  };

  const handleStartEdit = (debt: Debt) => {
    setEditingDebtId(debt.id);
    setNewDebt({ personName: debt.personName, date: debt.date, dueDate: debt.dueDate, note: debt.note });
    setNewDebtAmounts(debt.amounts.map((a) => ({ amount: String(a.amount), currency: a.currency })));
    setAddFormType(debt.direction);
    setShowAddForm(true);
  };

  const handleAddDebt = async () => {
    const validAmounts = newDebtAmounts.filter((a) => a.amount && Number(a.amount) > 0);
    if (!newDebt.personName || validAmounts.length === 0 || !newDebt.dueDate) return;

    const amountsData = validAmounts.map((a) => ({ amount: Number(a.amount), currency: a.currency }));
    const multiCurrency = amountsData.length > 1 ? { amounts: amountsData } : null;

    try {
      if (editingDebtId) {
        await updateDebt.mutateAsync({
          id: editingDebtId,
          person_name: newDebt.personName,
          amount: amountsData[0].amount,
          currency: amountsData[0].currency,
          payment_details: multiCurrency,
          date: newDebt.date || undefined,
          due_date: newDebt.dueDate,
          note: newDebt.note,
        });
        toast.success("تم تحديث الدين");
      } else {
        await addDebt.mutateAsync({
          person_name: newDebt.personName,
          amount: amountsData[0].amount,
          currency: amountsData[0].currency,
          direction: addFormType,
          date: newDebt.date || new Date().toISOString().split("T")[0],
          due_date: newDebt.dueDate,
          note: newDebt.note,
          payment_details: multiCurrency || undefined,
        });
        toast.success("تمت إضافة الدين");
      }
    } catch {
      toast.error("حدث خطأ");
      return;
    }

    setNewDebt({ personName: "", date: "", dueDate: "", note: "" });
    setNewDebtAmounts([{ amount: "", currency: "SAR" }]);
    setShowAddForm(false);
    setEditingDebtId(null);
  };

  const openPaymentDrawer = (debtId: string) => {
    const debt = allDebts.find((d) => d.id === debtId);
    if (!debt) return;
    const rem = getRemainingAmounts(debt);
    setNewPaymentAmounts(rem.map((r) => ({ amount: "", currency: r.currency })));
    setNewPayment({ type: "cash", itemDescription: "" });
    setPaymentDebtId(debtId);
    setShowPaymentDrawer(true);
  };

  const handleAddPayment = async () => {
    if (!paymentDebtId) return;
    const validAmounts = newPaymentAmounts.filter((a) => a.amount && Number(a.amount) > 0);
    if (validAmounts.length === 0) return;

    const amountsData = validAmounts.map((a) => ({ amount: Number(a.amount), currency: a.currency }));

    try {
      await addPayment.mutateAsync({
        debt_id: paymentDebtId,
        amount: amountsData[0].amount,
        currency: amountsData[0].currency,
        type: newPayment.type,
        item_description: newPayment.itemDescription || undefined,
        date: new Date().toISOString().split("T")[0],
        ...(amountsData.length > 1 ? { payment_details: { amounts: amountsData } } : {}),
      });

      // Check if fully paid after this payment
      const debt = allDebts.find((d) => d.id === paymentDebtId);
      if (debt) {
        const updatedPayments = [
          ...debt.payments,
          { id: "temp", amounts: amountsData as DebtAmount[], date: "", type: "cash" as PaymentType },
        ];
        const tempDebt = { ...debt, payments: updatedPayments };
        const remaining = getRemainingAmounts(tempDebt);
        if (remaining.length === 0) {
          await updateDebt.mutateAsync({ id: paymentDebtId, is_fully_paid: true, is_archived: true });
        }
      }

      toast.success("تم تسجيل الدفعة");
    } catch {
      toast.error("حدث خطأ في تسجيل الدفعة");
    }

    setShowPaymentDrawer(false);
    setPaymentDebtId(null);
  };

  const openPostponeDrawer = (debtId: string) => {
    setPostponeData({ newDate: "", reason: "" });
    setPostponeDebtId(debtId);
    setShowPostponeDrawer(true);
  };

  const handlePostpone = async () => {
    if (!postponeDebtId || !postponeData.newDate || !postponeData.reason) return;
    try {
      await addPostponement.mutateAsync({
        debt_id: postponeDebtId,
        new_date: postponeData.newDate,
        reason: postponeData.reason,
      });
      await updateDebt.mutateAsync({ id: postponeDebtId, due_date: postponeData.newDate });
      toast.success("تم تأجيل الدين");
    } catch {
      toast.error("حدث خطأ في التأجيل");
    }
    setShowPostponeDrawer(false);
    setPostponeDebtId(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDebt.mutateAsync(deleteTarget.id);
      toast.success("تم حذف الدين");
    } catch {
      toast.error("حدث خطأ في الحذف");
    }
    setDeleteTarget(null);
  };

  const getStatusBadge = (debt: Debt) => {
    if (debt.isFullyPaid) return <span className="flex items-center gap-1 text-xs font-bold text-primary"><Check size={14} /> مُسدَّد</span>;
    if (isOverdue(debt.dueDate, debt.isFullyPaid)) return <span className="flex items-center gap-1 text-xs font-bold text-destructive"><AlertTriangle size={14} /> متأخر!</span>;
    const days = getDaysUntilDue(debt.dueDate);
    if (days <= 3) return <span className="flex items-center gap-1 text-xs font-bold text-accent"><Clock size={14} /> قريب السداد</span>;
    return <span className="text-xs text-muted-foreground">{formatDate(debt.dueDate)}</span>;
  };

  const SummaryItem = ({ label, icon, summary, count, colorClass }: { label: string; icon: React.ReactNode; summary: DebtAmount[]; count: number; colorClass: string }) => (
    <div className="flex-1 text-center">
      <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold opacity-80 mb-2 ${colorClass}`}>
        {icon}
        {label}
      </div>
      {summary.length > 0 ? (
        <div className="space-y-1">
          {summary.map((s, i) => {
            const isGold = s.currency === "GOLD_OZ" || s.currency === "GOLD_G";
            return (
              <p key={i} className={`text-lg font-black tabular-nums ${isGold ? "text-[hsl(var(--gold))]" : "text-white"}`}>
                {formatNumber(s.amount)} <span className="text-[10px] font-medium opacity-60">{getCurrencySymbol(s.currency)}</span>
              </p>
            );
          })}
        </div>
      ) : (
        <p className="text-xl font-black opacity-30">—</p>
      )}
      <p className="text-[10px] opacity-40 mt-1">{count} دين نشط</p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto relative pb-32" dir="rtl">
      <PageHeader title="دفتر الديون" onBack={() => navigate("/")}>
        <div className="mt-4 flex items-stretch">
          <SummaryItem
            label="لك على الآخرين"
            icon={<HandCoins size={13} />}
            summary={givenSummary}
            count={givenDebts.filter(d => !d.isArchived).length}
            colorClass="text-emerald-300"
          />
          <div className="w-px bg-white/15 mx-3 self-stretch" />
          <SummaryItem
            label="عليك للآخرين"
            icon={<CreditCard size={13} />}
            summary={takenSummary}
            count={takenDebts.filter(d => !d.isArchived).length}
            colorClass="text-red-300"
          />
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="flex mx-5 mt-5 gap-2">
        <button
          onClick={() => setActiveTab("given")}
          className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 border-2 ${
            activeTab === "given"
              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 shadow-sm"
              : "bg-transparent border-border text-muted-foreground"
          }`}
        >
          <HandCoins size={16} />
          ديون لي
        </button>
        <button
          onClick={() => setActiveTab("taken")}
          className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 border-2 ${
            activeTab === "taken"
              ? "bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400 shadow-sm"
              : "bg-transparent border-border text-muted-foreground"
          }`}
        >
          <CreditCard size={16} />
          ديون عليّ
        </button>
      </div>

      {/* Debts List */}
      <div className="px-5 mt-4 space-y-3">
        {activeDebts.map((debt) => {
          const remaining = getRemainingAmounts(debt);
          const progress = getProgressForDebt(debt);
          const isExpanded = expandedDebt === debt.id;

          return (
            <SwipeableDebtCard
              key={debt.id}
              onDelete={() => setDeleteTarget({ id: debt.id, name: debt.personName })}
              onEdit={() => handleStartEdit(debt)}
            >
              <div className={`rounded-2xl border border-border overflow-hidden shadow-sm ${debt.isFullyPaid ? "bg-muted/40" : "bg-card"}`}>
                <button className="w-full p-4 text-right" onClick={() => setExpandedDebt(isExpanded ? null : debt.id)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-right flex items-center gap-2 flex-1 min-w-0">
                      {debt.hasReminder && <Bell size={14} className="text-amber-500 shrink-0" />}
                      <div className="min-w-0">
                        <p className={`font-bold text-base ${debt.isFullyPaid ? "line-through text-muted-foreground/50" : "text-foreground"}`}>{debt.personName}</p>
                        <p className={`text-xs mt-0.5 ${debt.isFullyPaid ? "line-through text-muted-foreground/40" : "text-muted-foreground"}`}>{debt.note}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {formatDate(debt.date)} → {formatDate(debt.dueDate)}
                        </p>
                      </div>
                    </div>
                    <div className="text-left space-y-0.5 shrink-0 mr-3">
                      {debt.amounts.map((a, i) => (
                        <p key={i} className={`text-xl font-black ${debt.isFullyPaid ? "line-through text-muted-foreground/50" : "text-foreground"}`}>{formatDebtAmount(a)}</p>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3">
                    <Progress value={progress} className="h-2 bg-muted" />
                    <div className="flex items-center justify-between mt-2">
                      <div>{getStatusBadge(debt)}</div>
                      <p className="text-[11px] text-muted-foreground">
                        {remaining.length > 0 ? `متبقي ${formatAmountsList(remaining)}` : "مُسدَّد"}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-center mt-2">
                    {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    {(debt.payments.length > 0 || debt.postponements.length > 0) && (
                      <div>
                        <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                          <History size={13} className="text-primary" />
                          سجل العمليات
                        </p>
                        <div className="space-y-1.5">
                          {[
                            ...debt.payments.map(p => ({ type: "payment" as const, date: p.date, data: p })),
                            ...debt.postponements.map(pp => ({ type: "postponement" as const, date: pp.date, data: pp })),
                          ]
                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                            .map((entry, i) => {
                              if (entry.type === "payment") {
                                const p = entry.data as Payment;
                                return (
                                  <div key={`p-${i}`} className="flex items-center justify-between text-xs bg-primary/5 rounded-xl px-3 py-2.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                        <HandCoins size={12} className="text-primary" />
                                      </div>
                                      <div>
                                        <span className="font-bold text-foreground">
                                          {p.type === "item" && p.itemDescription ? `${p.itemDescription}: ` : ""}
                                          {formatAmountsList(p.amounts)}
                                        </span>
                                        <p className="text-[10px] text-muted-foreground">
                                          {p.type === "cash" ? "نقدي" : p.type === "item" ? "عرض/بدل" : "دفعة"}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="text-muted-foreground">{formatDate(p.date)}</span>
                                  </div>
                                );
                              } else {
                                const pp = entry.data as Postponement;
                                return (
                                  <div key={`pp-${i}`} className="flex items-center justify-between text-xs bg-accent/10 rounded-xl px-3 py-2.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                                        <CalendarClock size={12} className="text-accent-foreground" />
                                      </div>
                                      <div>
                                        <span className="font-bold text-foreground">أُجّل إلى {formatDate(pp.newDate)}</span>
                                        <p className="text-[10px] text-muted-foreground">{pp.reason}</p>
                                      </div>
                                    </div>
                                    <span className="text-muted-foreground">{formatDate(pp.date)}</span>
                                  </div>
                                );
                              }
                            })}
                        </div>
                      </div>
                    )}

                    {!debt.isFullyPaid && (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleMarkFullyPaid(debt.id)} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5">
                          <CircleCheckBig size={15} />
                          مُسدَّد بالكامل
                        </button>
                        <button onClick={() => openPaymentDrawer(debt.id)} className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold flex items-center justify-center gap-1.5">
                          <HandCoins size={15} />
                          تسجيل دفعة
                        </button>
                        <button onClick={() => openPostponeDrawer(debt.id)} className="flex-1 py-2.5 rounded-xl bg-accent/20 text-accent-foreground text-xs font-bold flex items-center justify-center gap-1.5">
                          <CalendarClock size={15} />
                          تأجيل
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SwipeableDebtCard>
          );
        })}

        {activeDebts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد ديون حالياً</p>
          </div>
        )}

        {archivedDebts.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-bold text-muted-foreground mb-2">الأرشيف (المُسدَّدة)</p>
            {archivedDebts.map((debt) => (
              <div key={debt.id} className="bg-card/50 rounded-2xl border border-border p-4 mb-2 opacity-60">
                <div className="flex items-center justify-between">
                  <div className="text-right flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{debt.personName}</span>
                    <span className="flex items-center gap-1 text-xs text-primary"><Check size={12} /> مُسدَّد</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{formatAmountsList(debt.amounts)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB with menu */}
      {createPortal(
        <div className="fixed bottom-24 left-4 max-w-2xl mx-auto z-30 flex flex-col items-center gap-2">
          {showFabMenu && (
            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <button
                onClick={() => {
                  setAddFormType("given");
                  setEditingDebtId(null);
                  setNewDebt({ personName: "", date: "", dueDate: "", note: "" });
                  setNewDebtAmounts([{ amount: "", currency: "SAR" }]);
                  setShowAddForm(true);
                  setShowFabMenu(false);
                }}
                className="flex items-center gap-2 bg-emerald-500 text-white px-5 py-3 rounded-2xl shadow-lg text-sm font-bold whitespace-nowrap"
              >
                <HandCoins size={18} />
                دين لي
              </button>
              <button
                onClick={() => {
                  setAddFormType("taken");
                  setEditingDebtId(null);
                  setNewDebt({ personName: "", date: "", dueDate: "", note: "" });
                  setNewDebtAmounts([{ amount: "", currency: "SAR" }]);
                  setShowAddForm(true);
                  setShowFabMenu(false);
                }}
                className="flex items-center gap-2 bg-red-500 text-white px-5 py-3 rounded-2xl shadow-lg text-sm font-bold whitespace-nowrap"
              >
                <CreditCard size={18} />
                دين عليّ
              </button>
            </div>
          )}
          <button
            onClick={() => setShowFabMenu(!showFabMenu)}
            className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center transition-transform active:scale-95"
            style={{ boxShadow: "0 6px 24px hsla(209, 100%, 31%, 0.35)" }}
          >
            <Plus size={26} className={`transition-transform duration-200 ${showFabMenu ? "rotate-45" : ""}`} />
          </button>
        </div>,
        document.body
      )}

      {showFabMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setShowFabMenu(false)} />
      )}

      {/* Add/Edit Debt Drawer */}
      <Drawer open={showAddForm} onOpenChange={(open) => { setShowAddForm(open); if (!open) setEditingDebtId(null); }}>
        <DrawerContent dir="rtl">
          <DrawerHeader>
            <DrawerTitle>
              {editingDebtId ? "تعديل الدين" : addFormType === "given" ? "إضافة دين لي" : "إضافة دين عليّ"}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {!editingDebtId && (
              <div className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl ${
                addFormType === "given" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"
              }`}>
                {addFormType === "given" ? <HandCoins size={14} /> : <CreditCard size={14} />}
                {addFormType === "given" ? "دين لك على شخص آخر" : "دين عليك لشخص آخر"}
              </div>
            )}

            <input
              type="text"
              placeholder="اسم الشخص"
              value={newDebt.personName}
              onChange={(e) => setNewDebt({ ...newDebt, personName: e.target.value })}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
            />

            <div>
              <label className="text-xs font-bold text-foreground mb-2 block">المبالغ والعملات</label>
              <AmountEditor amounts={newDebtAmounts} setAmounts={setNewDebtAmounts} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">تاريخ أخذ الدين</label>
                <input
                  type="date"
                  value={newDebt.date}
                  onChange={(e) => setNewDebt({ ...newDebt, date: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">تاريخ السداد المتوقع</label>
                <input
                  type="date"
                  value={newDebt.dueDate}
                  onChange={(e) => setNewDebt({ ...newDebt, dueDate: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"
                />
              </div>
            </div>

            <input
              type="text"
              placeholder="ملاحظة (اختياري)"
              value={newDebt.note}
              onChange={(e) => setNewDebt({ ...newDebt, note: e.target.value })}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
            />
            <button
              onClick={handleAddDebt}
              disabled={addDebt.isPending || updateDebt.isPending}
              className={`w-full py-3.5 rounded-2xl font-bold text-base text-white disabled:opacity-50 ${
                addFormType === "given" ? "bg-emerald-500" : "bg-red-500"
              }`}
            >
              {(addDebt.isPending || updateDebt.isPending) ? "جارٍ الحفظ..." : editingDebtId ? "حفظ التعديلات" : "إضافة"}
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Payment Drawer */}
      <Drawer open={showPaymentDrawer} onOpenChange={setShowPaymentDrawer}>
        <DrawerContent dir="rtl">
          <DrawerHeader>
            <DrawerTitle>تسجيل دفعة</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <div className="flex gap-2">
              {(["cash", "item", "installment"] as PaymentType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setNewPayment({ ...newPayment, type: t })}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${newPayment.type === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {t === "cash" ? "نقدي" : t === "item" ? "عرض/بدل" : "دفعة"}
                </button>
              ))}
            </div>

            {newPayment.type === "item" && (
              <input
                type="text"
                placeholder="وصف العرض (مثال: عسل، فضة)"
                value={newPayment.itemDescription}
                onChange={(e) => setNewPayment({ ...newPayment, itemDescription: e.target.value })}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              />
            )}

            <AmountEditor amounts={newPaymentAmounts} setAmounts={setNewPaymentAmounts} />
          </div>
          <DrawerFooter className="flex-row gap-2">
            <Button onClick={handleAddPayment} disabled={addPayment.isPending} className="flex-1 rounded-xl">
              {addPayment.isPending ? "جارٍ..." : "تأكيد الدفعة"}
            </Button>
            <Button variant="outline" onClick={() => setShowPaymentDrawer(false)} className="flex-1 rounded-xl">إلغاء</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Postpone Drawer */}
      <Drawer open={showPostponeDrawer} onOpenChange={setShowPostponeDrawer}>
        <DrawerContent dir="rtl">
          <DrawerHeader>
            <DrawerTitle>تأجيل الدين</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">التاريخ الجديد</label>
              <input
                type="date"
                value={postponeData.newDate}
                onChange={(e) => setPostponeData({ ...postponeData, newDate: e.target.value })}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              />
            </div>
            <input
              type="text"
              placeholder="سبب التأجيل"
              value={postponeData.reason}
              onChange={(e) => setPostponeData({ ...postponeData, reason: e.target.value })}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            />
          </div>
          <DrawerFooter className="flex-row gap-2">
            <Button onClick={handlePostpone} disabled={addPostponement.isPending} className="flex-1 rounded-xl">
              {addPostponement.isPending ? "جارٍ..." : "تأكيد التأجيل"}
            </Button>
            <Button variant="outline" onClick={() => setShowPostponeDrawer(false)} className="flex-1 rounded-xl">إلغاء</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation Drawer */}
      <Drawer open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DrawerContent dir="rtl">
          <DrawerHeader>
            <DrawerTitle className="text-center">حذف الدين</DrawerTitle>
          </DrawerHeader>
          <div className="px-5 pb-6 space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              هل أنت متأكد من حذف دين "{deleteTarget?.name}"؟
            </p>
            <div className="flex gap-2">
              <button onClick={confirmDelete} disabled={deleteDebt.isPending} className="flex-1 py-3 rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50">
                {deleteDebt.isPending ? "جارٍ الحذف..." : "حذف"}
              </button>
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 rounded-xl font-bold bg-muted text-foreground hover:bg-muted/80 transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Debts;
