import { useState } from "react";
import { ArrowRight, Plus, Check, Clock, AlertTriangle, CreditCard, ChevronDown, ChevronUp, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import BottomNav from "@/components/home/BottomNav";

type PaymentType = "cash" | "item" | "installment";

interface Payment {
  id: string;
  amount: number;
  date: string;
  type: PaymentType;
  itemDescription?: string;
  itemValue?: number;
}

interface Debt {
  id: string;
  personName: string;
  totalAmount: number;
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
    totalAmount: 5000,
    date: "2025-01-15",
    dueDate: "2025-03-28",
    note: "قرض شخصي",
    payments: [{ id: "p1", amount: 3000, date: "2025-02-20", type: "cash" }],
    isFullyPaid: false,
    isArchived: false,
    postponements: [],
  },
  {
    id: "2",
    personName: "محمد الغامدي",
    totalAmount: 2500,
    date: "2025-02-01",
    dueDate: "2025-03-10",
    note: "رجع عسل – قيمة 800 ر",
    payments: [{ id: "p2", amount: 800, date: "2025-03-01", type: "item", itemDescription: "عسل", itemValue: 800 }],
    isFullyPaid: false,
    isArchived: false,
    postponements: [],
  },
  {
    id: "3",
    personName: "عبدالله الشمري",
    totalAmount: 1000,
    date: "2025-01-10",
    dueDate: "2025-03-15",
    note: "مصاريف مشتركة",
    payments: [{ id: "p3", amount: 1000, date: "2025-03-15", type: "cash" }],
    isFullyPaid: true,
    isArchived: false,
    postponements: [],
  },
];

const initialTaken: Debt[] = [
  {
    id: "4",
    personName: "سعد الحربي",
    totalAmount: 3200,
    date: "2025-02-10",
    dueDate: "2025-04-15",
    note: "سلفة شخصية",
    payments: [{ id: "p4", amount: 1200, date: "2025-03-05", type: "cash" }],
    isFullyPaid: false,
    isArchived: false,
    postponements: [],
  },
];

const formatNumber = (n: number) => n.toLocaleString("ar-SA");
const formatDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
};

const isOverdue = (dueDate: string, isFullyPaid: boolean) => {
  if (isFullyPaid) return false;
  return new Date(dueDate) < new Date();
};

const getDaysUntilDue = (dueDate: string) => {
  const diff = new Date(dueDate).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
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

  // Add form state
  const [newDebt, setNewDebt] = useState({ personName: "", totalAmount: "", dueDate: "", note: "" });
  const [newPayment, setNewPayment] = useState({ amount: "", type: "cash" as PaymentType, itemDescription: "", itemValue: "" });
  const [postponeData, setPostponeData] = useState({ newDate: "", reason: "" });

  const debts = activeTab === "given" ? givenDebts : takenDebts;
  const setDebts = activeTab === "given" ? setGivenDebts : setTakenDebts;
  const activeDebts = debts.filter((d) => !d.isArchived);
  const archivedDebts = debts.filter((d) => d.isArchived);

  const totalGiven = givenDebts.filter(d => !d.isArchived).reduce((s, d) => s + d.totalAmount - d.payments.reduce((a, p) => a + (p.type === "item" ? (p.itemValue || 0) : p.amount), 0), 0);
  const totalTaken = takenDebts.filter(d => !d.isArchived).reduce((s, d) => s + d.totalAmount - d.payments.reduce((a, p) => a + (p.type === "item" ? (p.itemValue || 0) : p.amount), 0), 0);

  const getPaidAmount = (debt: Debt) => debt.payments.reduce((a, p) => a + (p.type === "item" ? (p.itemValue || 0) : p.amount), 0);
  const getRemaining = (debt: Debt) => debt.totalAmount - getPaidAmount(debt);
  const getProgress = (debt: Debt) => (getPaidAmount(debt) / debt.totalAmount) * 100;

  const handleMarkFullyPaid = (debtId: string) => {
    setDebts((prev) =>
      prev.map((d) =>
        d.id === debtId
          ? { ...d, isFullyPaid: true, isArchived: true, payments: [...d.payments, { id: Date.now().toString(), amount: getRemaining(d), date: new Date().toISOString().split("T")[0], type: "cash" }] }
          : d
      )
    );
  };

  const handleAddDebt = () => {
    if (!newDebt.personName || !newDebt.totalAmount || !newDebt.dueDate) return;
    const debt: Debt = {
      id: Date.now().toString(),
      personName: newDebt.personName,
      totalAmount: Number(newDebt.totalAmount),
      date: new Date().toISOString().split("T")[0],
      dueDate: newDebt.dueDate,
      note: newDebt.note,
      payments: [],
      isFullyPaid: false,
      isArchived: false,
      postponements: [],
    };
    setDebts((prev) => [debt, ...prev]);
    setNewDebt({ personName: "", totalAmount: "", dueDate: "", note: "" });
    setShowAddForm(false);
  };

  const handleAddPayment = (debtId: string) => {
    if (!newPayment.amount) return;
    const payment: Payment = {
      id: Date.now().toString(),
      amount: Number(newPayment.amount),
      date: new Date().toISOString().split("T")[0],
      type: newPayment.type,
      itemDescription: newPayment.itemDescription || undefined,
      itemValue: newPayment.itemValue ? Number(newPayment.itemValue) : undefined,
    };
    setDebts((prev) =>
      prev.map((d) => {
        if (d.id !== debtId) return d;
        const updated = { ...d, payments: [...d.payments, payment] };
        const remaining = getRemaining(updated);
        if (remaining <= 0) {
          updated.isFullyPaid = true;
          updated.isArchived = true;
        }
        return updated;
      })
    );
    setNewPayment({ amount: "", type: "cash", itemDescription: "", itemValue: "" });
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
            <p className="text-2xl font-black">{formatNumber(Math.max(totalGiven, 0))}</p>
            <p className="text-xs opacity-60">ريال</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center border border-white/10">
            <p className="text-xs opacity-80 mb-1">عليك للآخرين</p>
            <p className="text-2xl font-black">{formatNumber(Math.max(totalTaken, 0))}</p>
            <p className="text-xs opacity-60">ريال</p>
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
          const paid = getPaidAmount(debt);
          const remaining = getRemaining(debt);
          const progress = getProgress(debt);
          const isExpanded = expandedDebt === debt.id;

          return (
            <div key={debt.id} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
              <button className="w-full p-4 text-right" onClick={() => setExpandedDebt(isExpanded ? null : debt.id)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="text-left">
                    <p className="text-2xl font-black text-foreground">{formatNumber(debt.totalAmount)} ر</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground text-base">{debt.personName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{debt.note}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <Progress value={progress} className="h-2 bg-muted" />
                  <div className="flex items-center justify-between mt-2">
                    <div>{getStatusBadge(debt)}</div>
                    <p className="text-xs text-muted-foreground">
                      سُدد {formatNumber(paid)} – متبقي {formatNumber(Math.max(remaining, 0))} ر
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
                            <span className="font-bold text-foreground">
                              {p.type === "item" ? `${p.itemDescription} (${formatNumber(p.itemValue || 0)} ر)` : `${formatNumber(p.amount)} ر`}
                            </span>
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
                      <button onClick={() => handleMarkFullyPaid(debt.id)} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold">
                        ✅ مُسدَّد بالكامل
                      </button>
                      <button onClick={() => setShowPaymentForm(showPaymentForm === debt.id ? null : debt.id)} className="flex-1 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold">
                        💵 إضافة دفعة
                      </button>
                      <button onClick={() => setShowPostponeForm(showPostponeForm === debt.id ? null : debt.id)} className="flex-1 py-2 rounded-xl bg-accent/20 text-accent-foreground text-xs font-bold">
                        📅 تأجيل
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
                      <input
                        type="number"
                        placeholder="المبلغ"
                        value={newPayment.amount}
                        onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      />
                      {newPayment.type === "item" && (
                        <>
                          <input
                            type="text"
                            placeholder="وصف العرض (مثال: عسل)"
                            value={newPayment.itemDescription}
                            onChange={(e) => setNewPayment({ ...newPayment, itemDescription: e.target.value })}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                          />
                          <input
                            type="number"
                            placeholder="القيمة التقديرية"
                            value={newPayment.itemValue}
                            onChange={(e) => setNewPayment({ ...newPayment, itemValue: e.target.value })}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                          />
                        </>
                      )}
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
                  <span className="text-sm font-bold text-foreground">{formatNumber(debt.totalAmount)} ر</span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-foreground">{debt.personName}</span>
                    <span className="flex items-center gap-1 text-xs text-primary mr-2"><Check size={12} /> مُسدَّد</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Button */}
      <div className="fixed bottom-24 left-0 right-0 max-w-2xl mx-auto px-5 z-20">
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-card w-full max-w-2xl rounded-t-3xl p-6 space-y-4" dir="rtl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-foreground">إضافة دين جديد</h2>
              <button onClick={() => setShowAddForm(false)} className="p-1 rounded-full bg-muted">
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
            <input
              type="number"
              placeholder="المبلغ الإجمالي"
              value={newDebt.totalAmount}
              onChange={(e) => setNewDebt({ ...newDebt, totalAmount: e.target.value })}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
            />
            <input
              type="date"
              value={newDebt.dueDate}
              onChange={(e) => setNewDebt({ ...newDebt, dueDate: e.target.value })}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
            />
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
