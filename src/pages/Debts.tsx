import { useState, useRef, useCallback } from "react";
import { Plus, Check, Clock, AlertTriangle, CreditCard, ChevronDown, ChevronUp, X, Coins, Trash2, Pencil, CircleCheckBig, HandCoins, CalendarClock, Bell, BellOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import PageHeader from "@/components/PageHeader";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

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

const getCurrencySymbol = (code: CurrencyCode) => CURRENCIES.find((c) => c.code === code)?.symbol || code;

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

interface Debt {
  id: string;
  personName: string;
  amounts: DebtAmount[];
  date: string;
  dueDate: string;
  note: string;
  payments: Payment[];
  isFullyPaid: boolean;
  isArchived: boolean;
  hasReminder: boolean;
  postponements: { newDate: string; reason: string }[];
}

const initialGiven: Debt[] = [
  {
    id: "1",
    personName: "خالد العمري",
    amounts: [{ amount: 5000, currency: "SAR" }],
    date: "2025-01-15",
    dueDate: "2025-03-28",
    note: "قرض شخصي",
    payments: [{ id: "p1", amounts: [{ amount: 3000, currency: "SAR" }], date: "2025-02-20", type: "cash" }],
    isFullyPaid: false,
    isArchived: false,
    hasReminder: false,
    postponements: [],
  },
  {
    id: "2",
    personName: "محمد الغامدي",
    amounts: [{ amount: 2500, currency: "SAR" }],
    date: "2025-02-01",
    dueDate: "2025-03-10",
    note: "رجع عسل – قيمة 800 ر",
    payments: [{ id: "p2", amounts: [{ amount: 800, currency: "SAR" }], date: "2025-03-01", type: "item", itemDescription: "عسل" }],
    isFullyPaid: false,
    isArchived: false,
    hasReminder: false,
    postponements: [],
  },
  {
    id: "3",
    personName: "عبدالله الشمري",
    amounts: [{ amount: 1000, currency: "SAR" }, { amount: 100, currency: "USD" }],
    date: "2025-01-10",
    dueDate: "2025-03-15",
    note: "مصاريف مشتركة",
    payments: [
      { id: "p3a", amounts: [{ amount: 1000, currency: "SAR" }], date: "2025-03-10", type: "cash" },
      { id: "p3b", amounts: [{ amount: 100, currency: "USD" }], date: "2025-03-15", type: "cash" },
    ],
    isFullyPaid: true,
    isArchived: false,
    postponements: [],
  },
];

const initialTaken: Debt[] = [
  {
    id: "4",
    personName: "سعد الحربي",
    amounts: [{ amount: 3200, currency: "SAR" }],
    date: "2025-02-10",
    dueDate: "2025-04-15",
    note: "سلفة شخصية",
    payments: [{ id: "p4", amounts: [{ amount: 1200, currency: "SAR" }], date: "2025-03-05", type: "cash" }],
    isFullyPaid: false,
    isArchived: false,
    postponements: [],
  },
  {
    id: "5",
    personName: "فهد الدوسري",
    amounts: [{ amount: 2, currency: "GOLD_OZ" }],
    date: "2025-01-20",
    dueDate: "2025-06-01",
    note: "أونصتين ذهب",
    payments: [],
    isFullyPaid: false,
    isArchived: false,
    postponements: [],
  },
];

// Swipeable card component
const SwipeableDebtCard = ({
  children,
  onDelete,
  onToggleReminder,
  hasReminder,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  onToggleReminder: () => void;
  hasReminder: boolean;
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
    if (diff > 0) {
      setSwipeX(Math.min(diff, 160));
    } else {
      setSwipeX(0);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    setSwipeX((prev) => (prev > 80 ? 160 : 0));
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div
        className="absolute inset-y-0 left-0 flex overflow-hidden rounded-r-2xl"
        style={{ width: 160, opacity: swipeX > 0 ? 1 : 0, pointerEvents: swipeX > 0 ? 'auto' : 'none' }}
      >
        <button
          onClick={() => { onToggleReminder(); setSwipeX(0); }}
          className={`flex-1 flex flex-col items-center justify-center gap-1 ${hasReminder ? 'bg-amber-500' : 'bg-primary'} text-white`}
        >
          {hasReminder ? <BellOff size={20} /> : <Bell size={20} />}
          <span className="text-[10px] font-bold">{hasReminder ? 'إلغاء تنبيه' : 'تنبيه'}</span>
        </button>
        <button
          onClick={onDelete}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground"
        >
          <Trash2 size={20} />
          <span className="text-[10px] font-bold">حذف</span>
        </button>
      </div>

      <div
        className="relative z-10 bg-background rounded-2xl"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 300ms ease-out',
          marginLeft: swipeX > 0 ? '4px' : '0',
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
  const date = new Date(d);
  return date.toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
};

const formatDebtAmount = (da: DebtAmount) => `${formatNumber(da.amount)} ${getCurrencySymbol(da.currency)}`;

const formatAmountsList = (amounts: DebtAmount[]) => amounts.map(formatDebtAmount).join(" + ");

const isOverdue = (dueDate: string, isFullyPaid: boolean) => {
  if (isFullyPaid) return false;
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
          className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
        />
        <select
          value={entry.currency}
          onChange={(e) => {
            const updated = [...amounts];
            updated[i] = { ...updated[i], currency: e.target.value as CurrencyCode };
            setAmounts(updated);
          }}
          className="w-32 rounded-xl border border-input bg-background px-2 py-2.5 text-xs"
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
  const [activeTab, setActiveTab] = useState<"given" | "taken">("given");
  const [givenDebts, setGivenDebts] = useState<Debt[]>(initialGiven);
  const [takenDebts, setTakenDebts] = useState<Debt[]>(initialTaken);
  const [expandedDebt, setExpandedDebt] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormType, setAddFormType] = useState<"given" | "taken">("given");
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState<string | null>(null);
  const [showPostponeForm, setShowPostponeForm] = useState<string | null>(null);

  const [newDebt, setNewDebt] = useState({ personName: "", dueDate: "", note: "" });
  const [newDebtAmounts, setNewDebtAmounts] = useState<{ amount: string; currency: CurrencyCode }[]>([{ amount: "", currency: "SAR" }]);

  const [newPayment, setNewPayment] = useState({ type: "cash" as PaymentType, itemDescription: "" });
  const [newPaymentAmounts, setNewPaymentAmounts] = useState<{ amount: string; currency: CurrencyCode }[]>([{ amount: "", currency: "SAR" }]);

  const [postponeData, setPostponeData] = useState({ newDate: "", reason: "" });
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);

  const debts = activeTab === "given" ? givenDebts : takenDebts;
  const setDebts = activeTab === "given" ? setGivenDebts : setTakenDebts;
  const activeDebts = debts.filter((d) => !d.isArchived);
  const archivedDebts = debts.filter((d) => d.isArchived);

  const givenSummary = getSummaryByCurrency(givenDebts);
  const takenSummary = getSummaryByCurrency(takenDebts);

  const handleMarkFullyPaid = (debtId: string) => {
    setDebts((prev) =>
      prev.map((d) => {
        if (d.id !== debtId) return d;
        const remaining = getRemainingAmounts(d);
        return {
          ...d,
          isFullyPaid: true,
          isArchived: true,
          payments: [...d.payments, { id: Date.now().toString(), amounts: remaining, date: new Date().toISOString().split("T")[0], type: "cash" as PaymentType }],
        };
      })
    );
  };

  const handleStartEdit = (debt: Debt) => {
    setEditingDebtId(debt.id);
    setNewDebt({ personName: debt.personName, dueDate: debt.dueDate, note: debt.note });
    setNewDebtAmounts(debt.amounts.map((a) => ({ amount: String(a.amount), currency: a.currency })));
    setAddFormType(activeTab);
    setShowAddForm(true);
  };

  const handleAddDebt = () => {
    const validAmounts = newDebtAmounts.filter((a) => a.amount && Number(a.amount) > 0);
    if (!newDebt.personName || validAmounts.length === 0 || !newDebt.dueDate) return;

    const targetSetDebts = addFormType === "given" ? setGivenDebts : setTakenDebts;

    if (editingDebtId) {
      targetSetDebts((prev) =>
        prev.map((d) =>
          d.id === editingDebtId
            ? { ...d, personName: newDebt.personName, amounts: validAmounts.map((a) => ({ amount: Number(a.amount), currency: a.currency })), dueDate: newDebt.dueDate, note: newDebt.note }
            : d
        )
      );
    } else {
      const debt: Debt = {
        id: Date.now().toString(),
        personName: newDebt.personName,
        amounts: validAmounts.map((a) => ({ amount: Number(a.amount), currency: a.currency })),
        date: new Date().toISOString().split("T")[0],
        dueDate: newDebt.dueDate,
        note: newDebt.note,
        payments: [],
        isFullyPaid: false,
        isArchived: false,
        postponements: [],
      };
      targetSetDebts((prev) => [debt, ...prev]);
    }
    setNewDebt({ personName: "", dueDate: "", note: "" });
    setNewDebtAmounts([{ amount: "", currency: "SAR" }]);
    setShowAddForm(false);
    setEditingDebtId(null);
  };

  const handleAddPayment = (debtId: string) => {
    const validAmounts = newPaymentAmounts.filter((a) => a.amount && Number(a.amount) > 0);
    if (validAmounts.length === 0) return;
    const payment: Payment = {
      id: Date.now().toString(),
      amounts: validAmounts.map((a) => ({ amount: Number(a.amount), currency: a.currency })),
      date: new Date().toISOString().split("T")[0],
      type: newPayment.type,
      itemDescription: newPayment.itemDescription || undefined,
    };
    setDebts((prev) =>
      prev.map((d) => {
        if (d.id !== debtId) return d;
        const updated = { ...d, payments: [...d.payments, payment] };
        const remaining = getRemainingAmounts(updated);
        if (remaining.length === 0) {
          updated.isFullyPaid = true;
          updated.isArchived = true;
        }
        return updated;
      })
    );
    setNewPayment({ type: "cash", itemDescription: "" });
    setNewPaymentAmounts([{ amount: "", currency: "SAR" }]);
    setShowPaymentForm(null);
  };

  const handlePostpone = (debtId: string) => {
    if (!postponeData.newDate || !postponeData.reason) return;
    setDebts((prev) =>
      prev.map((d) =>
        d.id === debtId
          ? { ...d, dueDate: postponeData.newDate, postponements: [...d.postponements, postponeData] }
          : d
      )
    );
    setPostponeData({ newDate: "", reason: "" });
    setShowPostponeForm(null);
  };

  const getStatusBadge = (debt: Debt) => {
    if (debt.isFullyPaid) return <span className="flex items-center gap-1 text-xs font-bold text-primary"><Check size={14} /> مُسدَّد بالكامل</span>;
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
              <p key={i} className={`text-lg font-black tabular-nums ${isGold ? 'text-[hsl(var(--gold))]' : 'text-white'}`}>
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

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto relative pb-32" dir="rtl">
      {/* Header with PageHeader */}
      <PageHeader title="دفتر الديون" onBack={() => navigate("/")}>
        {/* Integrated Summary */}
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

      {/* Tabs - improved design */}
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
              onDelete={() => setDebts((prev) => prev.filter((d) => d.id !== debt.id))}
              onEdit={() => handleStartEdit(debt)}
            >
              <div className={`rounded-2xl border border-border overflow-hidden shadow-sm ${debt.isFullyPaid ? "bg-muted/40" : "bg-card"}`}>
                <button className="w-full p-4 text-right" onClick={() => setExpandedDebt(isExpanded ? null : debt.id)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-left space-y-0.5">
                      {debt.amounts.map((a, i) => (
                        <p key={i} className={`text-xl font-black ${debt.isFullyPaid ? "line-through text-muted-foreground/50" : "text-foreground"}`}>{formatDebtAmount(a)}</p>
                      ))}
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-base ${debt.isFullyPaid ? "line-through text-muted-foreground/50" : "text-foreground"}`}>{debt.personName}</p>
                      <p className={`text-xs mt-0.5 ${debt.isFullyPaid ? "line-through text-muted-foreground/40" : "text-muted-foreground"}`}>{debt.note}</p>
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
                    {debt.payments.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-foreground mb-2">سجل الدفعات</p>
                        <div className="space-y-1.5">
                          {debt.payments.map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-xs bg-muted/50 rounded-lg px-3 py-2">
                              <span className="text-muted-foreground">{formatDate(p.date)}</span>
                              <div className="text-left">
                                <span className="font-bold text-foreground">
                                  {p.type === "item" && p.itemDescription ? `${p.itemDescription}: ` : ""}
                                  {formatAmountsList(p.amounts)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {debt.postponements.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-foreground mb-2">التأجيلات</p>
                        {debt.postponements.map((pp, i) => (
                          <div key={i} className="text-xs bg-accent/10 rounded-lg px-3 py-2 mb-1">
                            <span className="text-muted-foreground">أُجّل إلى {formatDate(pp.newDate)} — {pp.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!debt.isFullyPaid && (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleMarkFullyPaid(debt.id)} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5">
                          <CircleCheckBig size={15} />
                          مُسدَّد بالكامل
                        </button>
                        <button onClick={() => {
                          const rem = getRemainingAmounts(debt);
                          setNewPaymentAmounts(rem.map((r) => ({ amount: "", currency: r.currency })));
                          setShowPaymentForm(showPaymentForm === debt.id ? null : debt.id);
                        }} className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold flex items-center justify-center gap-1.5">
                          <HandCoins size={15} />
                          إضافة دفعة
                        </button>
                        <button onClick={() => setShowPostponeForm(showPostponeForm === debt.id ? null : debt.id)} className="flex-1 py-2.5 rounded-xl bg-accent/20 text-accent-foreground text-xs font-bold flex items-center justify-center gap-1.5">
                          <CalendarClock size={15} />
                          تأجيل
                        </button>
                      </div>
                    )}

                    {showPaymentForm === debt.id && (
                      <div className="bg-muted/50 rounded-xl p-3 space-y-2">
                        <div className="flex gap-2">
                          {(["cash", "item", "installment"] as PaymentType[]).map((t) => (
                            <button
                              key={t}
                              onClick={() => setNewPayment({ ...newPayment, type: t })}
                              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${newPayment.type === t ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
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
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                          />
                        )}

                        <AmountEditor amounts={newPaymentAmounts} setAmounts={setNewPaymentAmounts} />

                        <button onClick={() => handleAddPayment(debt.id)} className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold">
                          تأكيد الدفعة
                        </button>
                      </div>
                    )}

                    {showPostponeForm === debt.id && (
                      <div className="bg-muted/50 rounded-xl p-3 space-y-2">
                        <input
                          type="date"
                          value={postponeData.newDate}
                          onChange={(e) => setPostponeData({ ...postponeData, newDate: e.target.value })}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="سبب التأجيل"
                          value={postponeData.reason}
                          onChange={(e) => setPostponeData({ ...postponeData, reason: e.target.value })}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        />
                        <button onClick={() => handlePostpone(debt.id)} className="w-full py-2 rounded-xl bg-accent text-accent-foreground text-sm font-bold">
                          تأكيد التأجيل
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
                  <span className="text-sm font-bold text-foreground">{formatAmountsList(debt.amounts)}</span>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{debt.personName}</span>
                    <span className="flex items-center gap-1 text-xs text-primary"><Check size={12} /> مُسدَّد</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB with menu */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
        {/* FAB sub-buttons */}
        {showFabMenu && (
          <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={() => {
                setAddFormType("given");
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
          style={{ boxShadow: '0 6px 24px hsla(209, 100%, 31%, 0.35)' }}
        >
          <Plus size={26} className={`transition-transform duration-200 ${showFabMenu ? 'rotate-45' : ''}`} />
        </button>
      </div>

      {/* Click outside to close FAB menu */}
      {showFabMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setShowFabMenu(false)} />
      )}

      {/* Add Debt Bottom Sheet */}
      <Drawer open={showAddForm} onOpenChange={(open) => { setShowAddForm(open); if (!open) setEditingDebtId(null); }}>
        <DrawerContent dir="rtl">
          <DrawerHeader>
            <DrawerTitle>
              {editingDebtId ? "تعديل الدين" : addFormType === "given" ? "إضافة دين لي" : "إضافة دين عليّ"}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Type indicator */}
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

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">تاريخ السداد المتوقع</label>
              <input
                type="date"
                value={newDebt.dueDate}
                onChange={(e) => setNewDebt({ ...newDebt, dueDate: e.target.value })}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
              />
            </div>
            <input
              type="text"
              placeholder="ملاحظة (اختياري)"
              value={newDebt.note}
              onChange={(e) => setNewDebt({ ...newDebt, note: e.target.value })}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
            />
            <button onClick={handleAddDebt} className={`w-full py-3.5 rounded-2xl font-bold text-base text-white ${
              addFormType === "given" ? "bg-emerald-500" : "bg-red-500"
            }`}>
              {editingDebtId ? "حفظ التعديلات" : "إضافة"}
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Debts;
