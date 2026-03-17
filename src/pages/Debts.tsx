import { useState, useRef, useCallback } from "react";
import { ArrowRight, Plus, Check, Clock, AlertTriangle, CreditCard, ChevronDown, ChevronUp, X, Coins, Trash2, Pencil, CircleCheckBig, HandCoins, CalendarClock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import BottomNav from "@/components/home/BottomNav";

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
];

// Swipeable card component
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
      {/* Action buttons behind - on the left since card slides right in RTL */}
      <div
        className="absolute inset-y-0 left-0 flex overflow-hidden rounded-r-2xl"
        style={{ width: 160, opacity: swipeX > 0 ? 1 : 0, pointerEvents: swipeX > 0 ? 'auto' : 'none' }}
      >
        <button
          onClick={onEdit}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-blue-500 text-white"
        >
          <Pencil size={20} />
          <span className="text-[10px] font-bold">تعديل</span>
        </button>
        <button
          onClick={onDelete}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground"
        >
          <Trash2 size={20} />
          <span className="text-[10px] font-bold">حذف</span>
        </button>
      </div>

      {/* Card content */}
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

// Get paid and remaining per currency
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

// Summary by currency
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

const Debts = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"given" | "taken">("given");
  const [givenDebts, setGivenDebts] = useState<Debt[]>(initialGiven);
  const [takenDebts, setTakenDebts] = useState<Debt[]>(initialTaken);
  const [expandedDebt, setExpandedDebt] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState<string | null>(null);
  const [showPostponeForm, setShowPostponeForm] = useState<string | null>(null);

  // Add form state - multi-currency
  const [newDebt, setNewDebt] = useState({ personName: "", dueDate: "", note: "" });
  const [newDebtAmounts, setNewDebtAmounts] = useState<{ amount: string; currency: CurrencyCode }[]>([{ amount: "", currency: "SAR" }]);

  // Payment form state - multi-currency
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
    setShowAddForm(true);
  };

  const handleAddDebt = () => {
    const validAmounts = newDebtAmounts.filter((a) => a.amount && Number(a.amount) > 0);
    if (!newDebt.personName || validAmounts.length === 0 || !newDebt.dueDate) return;

    if (editingDebtId) {
      // Update existing debt
      setDebts((prev) =>
        prev.map((d) =>
          d.id === editingDebtId
            ? { ...d, personName: newDebt.personName, amounts: validAmounts.map((a) => ({ amount: Number(a.amount), currency: a.currency })), dueDate: newDebt.dueDate, note: newDebt.note }
            : d
        )
      );
    } else {
      // Add new debt
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
      setDebts((prev) => [debt, ...prev]);
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

  // Multi-currency amount editor component
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

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto relative pb-32" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-b from-[hsl(var(--hero-gradient-from))] to-[hsl(var(--hero-gradient-to))] text-[hsl(var(--hero-foreground))] px-5 pt-12 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate("/")} className="p-2 rounded-full bg-white/10">
            <ArrowRight size={20} />
          </button>
          <div className="flex items-center gap-2">
            <CreditCard size={22} />
            <h1 className="text-xl font-bold">دفتر الديون</h1>
          </div>
          <div className="w-10" />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center border border-white/10">
            <p className="text-xs opacity-80 mb-1">لك على الآخرين</p>
            {givenSummary.length > 0 ? (
              <div className="space-y-0.5">
                {givenSummary.map((s, i) => (
                  <p key={i} className="text-lg font-black">{formatNumber(s.amount)} <span className="text-xs opacity-70">{getCurrencySymbol(s.currency)}</span></p>
                ))}
              </div>
            ) : (
              <p className="text-2xl font-black">0</p>
            )}
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center border border-white/10">
            <p className="text-xs opacity-80 mb-1">عليك للآخرين</p>
            {takenSummary.length > 0 ? (
              <div className="space-y-0.5">
                {takenSummary.map((s, i) => (
                  <p key={i} className="text-lg font-black">{formatNumber(s.amount)} <span className="text-xs opacity-70">{getCurrencySymbol(s.currency)}</span></p>
                ))}
              </div>
            ) : (
              <p className="text-2xl font-black">0</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex mx-5 mt-6 bg-muted rounded-xl p-1">
        <button
          onClick={() => setActiveTab("given")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === "given" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
        >
          💰 أعطيت
        </button>
        <button
          onClick={() => setActiveTab("taken")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === "taken" ? "bg-card text-destructive shadow-sm" : "text-muted-foreground"}`}
        >
          📥 أخذت
        </button>
      </div>

      {/* Debts List */}
      <div className="px-5 mt-4 space-y-3">
        {activeDebts.map((debt) => {
          const remaining = getRemainingAmounts(debt);
          const paid = getPaidByCurrency(debt);
          const progress = getProgressForDebt(debt);
          const isExpanded = expandedDebt === debt.id;

          return (
            <SwipeableDebtCard
              key={debt.id}
              onDelete={() => setDebts((prev) => prev.filter((d) => d.id !== debt.id))}
              onEdit={() => {/* TODO: edit */}}
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
                    {/* Payment History */}
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

                    {/* Postponements */}
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

                    {/* Actions */}
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

                  {/* Payment Form */}
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

                  {/* Postpone Form */}
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

        {/* Archived */}
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

      {/* Add Button */}
      <div className="fixed bottom-28 left-0 right-0 max-w-2xl mx-auto px-5 z-20">
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-lg flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          + إضافة دين جديد
        </button>
      </div>

      {/* Add Debt Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-foreground">إضافة دين جديد</h2>
              <button onClick={() => setShowAddForm(false)} className="p-2 rounded-full bg-muted">
                <X size={18} />
              </button>
            </div>
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
            <button onClick={handleAddDebt} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-base">
              إضافة
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default Debts;
