import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Plus, Coins, Info, Trash2, Bell, BellOff, ChevronDown, ChevronUp,
  ShieldCheck, Scale, BookOpen, Calculator, X, Check, AlertTriangle, Clock, Pencil
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import PullToRefresh from "@/components/PullToRefresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { haptic } from "@/lib/haptics";

// ── Swipeable Card ──
const ACTION_WIDTH = 210;
function SwipeableAssetCard({ onEdit, onReminder, onDelete, children }: { onEdit: () => void; onReminder: () => void; onDelete: () => void; children: React.ReactNode }) {
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isOpenRef = useRef(false);
  const [transform, setTransform] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - startXRef.current;
    currentXRef.current = isOpenRef.current
      ? Math.max(0, Math.min(ACTION_WIDTH, ACTION_WIDTH + diff))
      : Math.max(0, Math.min(ACTION_WIDTH, diff));
    setTransform(currentXRef.current);
  };
  const handleTouchEnd = () => {
    const open = currentXRef.current > ACTION_WIDTH / 2;
    isOpenRef.current = open;
    setTransform(open ? ACTION_WIDTH : 0);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl" ref={containerRef}>
      <div className="absolute inset-y-0 left-0 flex items-stretch" style={{ width: ACTION_WIDTH }}>
        <button
          onClick={() => { haptic.light(); onEdit(); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-primary text-white"
        >
          <Pencil size={18} />
          <span className="text-[10px] font-bold">تعديل</span>
        </button>
        <button
          onClick={() => { haptic.light(); onReminder(); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-amber-500 text-white"
        >
          <Bell size={18} />
          <span className="text-[10px] font-bold">تذكير</span>
        </button>
        <button
          onClick={() => { haptic.light(); onDelete(); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-destructive text-white"
        >
          <Trash2 size={18} />
          <span className="text-[10px] font-bold">حذف</span>
        </button>
      </div>
      <div
        className="relative bg-background z-10 transition-transform duration-200"
        style={{ transform: `translateX(${transform}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

// ── Types ──
type AssetType = "cash" | "gold" | "silver" | "stocks" | "funds";

interface ZakatAsset {
  id: string;
  type: AssetType;
  label: string;
  amount: number; // cash amount or weight in grams
  karat?: number; // for gold: 18, 21, 24
  purchaseDate: string; // hijri-approx, stored as ISO
  marketValue?: number;
  reminder: boolean;
}

const ASSET_TYPE_META: Record<AssetType, { label: string; icon: string; color: string; bg: string }> = {
  cash: { label: "نقد", icon: "💵", color: "hsl(145 45% 35%)", bg: "hsl(145 40% 93%)" },
  gold: { label: "ذهب", icon: "🥇", color: "hsl(43 65% 40%)", bg: "hsl(43 60% 92%)" },
  silver: { label: "فضة", icon: "🥈", color: "hsl(215 15% 50%)", bg: "hsl(215 15% 92%)" },
  stocks: { label: "أسهم", icon: "📈", color: "hsl(215 70% 50%)", bg: "hsl(215 80% 93%)" },
  funds: { label: "صناديق استثمار", icon: "🏦", color: "hsl(270 50% 50%)", bg: "hsl(270 50% 93%)" },
};

const GOLD_KARATS = [24, 22, 21, 18];
const NISAB_GOLD_GRAMS = 85; // grams of 24k gold
const NISAB_SILVER_GRAMS = 595;
const ZAKAT_RATE = 0.025;

const STORAGE_KEY = "zakat_assets";

function loadAssets(): ZakatAsset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveAssets(assets: ZakatAsset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
}

// Days until hawl (1 hijri year ≈ 354 days)
function daysUntilHawl(purchaseDateISO: string): number {
  const purchase = new Date(purchaseDateISO);
  const hawlDate = new Date(purchase.getTime() + 354 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diff = Math.ceil((hawlDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function hawlProgress(purchaseDateISO: string): number {
  const purchase = new Date(purchaseDateISO);
  const now = new Date();
  const elapsed = (now.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24);
  return Math.min(100, (elapsed / 354) * 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

// ── Gold price hook ──
function useGoldPrice() {
  const [goldPricePerGram, setGoldPricePerGram] = useState<number | null>(null);
  const [silverPricePerGram, setSilverPricePerGram] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem("zakat_metal_prices");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < 3600_000) {
          setGoldPricePerGram(parsed.gold);
          setSilverPricePerGram(parsed.silver);
          setLastUpdated(parsed.ts);
          setLoading(false);
          return;
        }
      } catch {}
    }

    fetch("https://api.metals.dev/v1/latest?api_key=demo&currency=SAR&unit=gram")
      .then(r => r.json())
      .then(data => {
        const now = Date.now();
        if (data.metals) {
          const gold24 = data.metals.gold;
          const silver = data.metals.silver;
          setGoldPricePerGram(gold24);
          setSilverPricePerGram(silver);
          setLastUpdated(now);
          localStorage.setItem("zakat_metal_prices", JSON.stringify({ gold: gold24, silver, ts: now }));
        } else {
          setGoldPricePerGram(310);
          setSilverPricePerGram(3.5);
          setLastUpdated(now);
        }
      })
      .catch(() => {
        setGoldPricePerGram(310);
        setSilverPricePerGram(3.5);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  return { goldPricePerGram, silverPricePerGram, loading, error, lastUpdated };
}

// ── Component ──
const Zakat = () => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<ZakatAsset[]>(loadAssets);
  const [showAdd, setShowAdd] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [addType, setAddType] = useState<AssetType>("cash");
  const [addLabel, setAddLabel] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addKarat, setAddKarat] = useState(24);
  const [addDate, setAddDate] = useState(new Date().toISOString().split("T")[0]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [reminderAsset, setReminderAsset] = useState<string | null>(null);
  const [customReminderDays, setCustomReminderDays] = useState("");

  const { goldPricePerGram, silverPricePerGram, loading: priceLoading, lastUpdated } = useGoldPrice();

  const updateAssets = useCallback((newAssets: ZakatAsset[]) => {
    setAssets(newAssets);
    saveAssets(newAssets);
  }, []);

  const handleAdd = () => {
    if (!addAmount || Number(addAmount) <= 0) return;
    if (editingAssetId) {
      updateAssets(assets.map(a => a.id === editingAssetId ? {
        ...a,
        type: addType,
        label: addLabel || ASSET_TYPE_META[addType].label,
        amount: Number(addAmount),
        karat: addType === "gold" ? addKarat : undefined,
        purchaseDate: addDate,
      } : a));
    } else {
      const newAsset: ZakatAsset = {
        id: Date.now().toString(),
        type: addType,
        label: addLabel || ASSET_TYPE_META[addType].label,
        amount: Number(addAmount),
        karat: addType === "gold" ? addKarat : undefined,
        purchaseDate: addDate,
        reminder: true,
      };
      updateAssets([...assets, newAsset]);
    }
    setShowAdd(false);
    resetAddForm();
    haptic.medium();
  };

  const resetAddForm = () => {
    setAddType("cash");
    setAddLabel("");
    setAddAmount("");
    setAddKarat(24);
    setAddDate(new Date().toISOString().split("T")[0]);
    setEditingAssetId(null);
  };

  const handleDelete = (id: string) => {
    updateAssets(assets.filter(a => a.id !== id));
    setDeleteConfirm(null);
    haptic.medium();
  };


  // Calculate values
  const getAssetValue = (asset: ZakatAsset): number => {
    if (asset.type === "cash" || asset.type === "stocks" || asset.type === "funds") return asset.amount;
    if (asset.type === "gold" && goldPricePerGram) {
      const purity = (asset.karat || 24) / 24;
      return asset.amount * purity * goldPricePerGram;
    }
    if (asset.type === "silver" && silverPricePerGram) {
      return asset.amount * silverPricePerGram;
    }
    return asset.amount;
  };

  const getZakatAmount = (asset: ZakatAsset): number => {
    return getAssetValue(asset) * ZAKAT_RATE;
  };

  const getNisabValue = (): number => {
    if (goldPricePerGram) return NISAB_GOLD_GRAMS * goldPricePerGram;
    return NISAB_GOLD_GRAMS * 310; // fallback
  };

  const totalValue = assets.reduce((sum, a) => sum + getAssetValue(a), 0);
  const totalZakat = assets.reduce((sum, a) => sum + getZakatAmount(a), 0);
  const nisabValue = getNisabValue();
  const meetsNisab = totalValue >= nisabValue;

  // Assets due (hawl passed)
  const assetsDue = assets.filter(a => daysUntilHawl(a.purchaseDate) <= 0);
  const zakatDue = assetsDue.reduce((sum, a) => sum + getZakatAmount(a), 0);

  return (
    <div className="min-h-screen max-w-2xl mx-auto bg-background pb-28" dir="rtl">
      <PageHeader title="حاسبة الزكاة" subtitle="احسب زكاتك بدقة" onBack={() => navigate("/")}>
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={() => setShowRules(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: "hsla(0,0%,100%,0.15)", color: "white" }}
          >
            <BookOpen size={14} />
            أحكام الزكاة
          </button>
          {lastUpdated && (
            <span className="text-[10px] text-white/60">
              آخر تحديث: {new Date(lastUpdated).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </PageHeader>

      <PullToRefresh onRefresh={async () => { setAssets(loadAssets()); }}>
        <div className="px-4 mt-2 space-y-4">

          {/* Privacy notice */}
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-primary/5 border border-primary/10">
            <ShieldCheck size={18} className="text-primary shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">بياناتك خاصة تماماً</span> — لا يمكن لأي فرد من العائلة الاطلاع على تفاصيل زكاتك.
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4 bg-background border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Scale size={16} className="text-primary" />
                <span className="text-xs font-bold text-muted-foreground">إجمالي الأصول</span>
              </div>
              <p className="text-lg font-extrabold text-foreground">
                {totalValue.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} <span className="text-xs font-bold text-muted-foreground">ر.س</span>
              </p>
              <div className="flex items-center gap-1 mt-1.5">
                {meetsNisab ? (
                  <>
                    <Check size={12} className="text-primary" />
                    <span className="text-[10px] text-primary font-bold">بلغ النصاب</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={12} className="text-amber-500" />
                    <span className="text-[10px] text-amber-600 font-bold">لم يبلغ النصاب</span>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl p-4 bg-background border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Calculator size={16} className="text-emerald-600" />
                <span className="text-xs font-bold text-muted-foreground">الزكاة المستحقة</span>
              </div>
              <p className="text-lg font-extrabold text-emerald-600">
                {zakatDue.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} <span className="text-xs font-bold text-muted-foreground">ر.س</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {assetsDue.length > 0 ? `${assetsDue.length} أصول حال حولها` : "لا أصول مستحقة حالياً"}
              </p>
            </div>
          </div>

          {/* Nisab info */}
          <div className="rounded-2xl px-4 py-3 bg-background border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info size={14} className="text-muted-foreground" />
                <span className="text-xs font-bold text-foreground">النصاب الحالي</span>
              </div>
              <span className="text-xs font-bold text-primary">
                {nisabValue.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              يعادل {NISAB_GOLD_GRAMS} جرام ذهب عيار 24 {goldPricePerGram && !priceLoading ? `(${goldPricePerGram.toFixed(0)} ر.س/جرام)` : ""}
            </p>
          </div>

          {/* Assets list */}
          <div>
            <h3 className="text-sm font-extrabold text-foreground mb-3 px-1">
              الأصول ({assets.length})
            </h3>

            {assets.length === 0 ? (
              <div className="text-center py-12">
                <Coins size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm font-bold text-muted-foreground">لم تضف أي أصول بعد</p>
                <p className="text-xs text-muted-foreground/70 mt-1">أضف أصولك لحساب الزكاة المستحقة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {assets.map((asset) => {
                  const meta = ASSET_TYPE_META[asset.type];
                  const days = daysUntilHawl(asset.purchaseDate);
                  const progress = hawlProgress(asset.purchaseDate);
                  const isDue = days <= 0;
                  const value = getAssetValue(asset);
                  const zakat = getZakatAmount(asset);

                  return (
                    <SwipeableAssetCard
                      key={asset.id}
                      onEdit={() => {
                        setAddType(asset.type);
                        setAddLabel(asset.label);
                        setAddAmount(String(asset.amount));
                        if (asset.karat) setAddKarat(asset.karat);
                        setAddDate(asset.purchaseDate);
                        setEditingAssetId(asset.id);
                        setShowAdd(true);
                      }}
                      onReminder={() => { setReminderAsset(asset.id); }}
                      onDelete={() => setDeleteConfirm(asset.id)}
                    >
                      <div className="rounded-2xl bg-background border border-border p-4">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0"
                            style={{ background: meta.bg }}
                          >
                            {meta.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-bold text-foreground">{asset.label}</span>
                                <span className="text-[10px] text-muted-foreground mr-2">{meta.label}</span>
                              </div>
                              {asset.reminder && <Bell size={12} className="text-amber-500" />}
                            </div>

                            {/* Details */}
                            <div className="mt-2 space-y-1.5">
                              {(asset.type === "gold" || asset.type === "silver") && (
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>{asset.amount} جرام</span>
                                  {asset.karat && <span>عيار {asset.karat}</span>}
                                  <span className="font-bold text-foreground">{value.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س</span>
                                </div>
                              )}
                              {(asset.type === "cash" || asset.type === "stocks" || asset.type === "funds") && (
                                <p className="text-xs text-foreground font-bold">
                                  {value.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground">
                                تاريخ الاقتناء: {formatDate(asset.purchaseDate)}
                              </p>
                            </div>

                            {/* Hawl progress - SWAPPED: zakat on left, days on right */}
                            <div className="mt-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold" style={{ color: isDue ? meta.color : "hsl(var(--muted-foreground))" }}>
                                  زكاتها: {zakat.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {isDue ? "✅ حال الحول" : `متبقي ${days} يوم`}
                                </span>
                              </div>
                              <Progress value={progress} className="h-1.5" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </SwipeableAssetCard>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>

      {/* FAB */}
      {createPortal(
        <div className="fixed bottom-24 left-4 max-w-2xl mx-auto z-30">
          <Button
            onClick={() => { haptic.medium(); setShowAdd(true); }}
            className="w-14 h-14 rounded-full shadow-xl bg-primary text-primary-foreground hover:bg-primary/90 p-0"
            style={{ boxShadow: "0 6px 24px hsla(209, 100%, 31%, 0.35)" }}
          >
            <Plus size={26} />
          </Button>
        </div>,
        document.body
      )}

      {/* Add asset drawer */}
      <Drawer open={showAdd} onOpenChange={setShowAdd}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>إضافة أصل جديد</DrawerTitle>
            <DrawerDescription>أضف أصلاً لحساب زكاته تلقائياً</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4">
            {/* Type selector */}
            <div>
              <label className="text-xs font-bold text-foreground mb-2 block">نوع الأصل</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(ASSET_TYPE_META) as AssetType[]).map((type) => {
                  const m = ASSET_TYPE_META[type];
                  const selected = addType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setAddType(type)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-colors ${
                        selected ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <span className="text-lg">{m.icon}</span>
                      <span className="text-[11px] font-bold" style={{ color: selected ? m.color : undefined }}>
                        {m.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Label */}
            <div>
              <label className="text-xs font-bold text-foreground mb-1.5 block">الوصف (اختياري)</label>
              <Input
                value={addLabel}
                onChange={e => setAddLabel(e.target.value)}
                placeholder={`مثال: ${addType === "gold" ? "سوار ذهب" : addType === "cash" ? "حساب بنكي" : "وصف الأصل"}`}
                className="text-right"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-bold text-foreground mb-1.5 block">
                {addType === "gold" || addType === "silver" ? "الوزن (جرام)" : "المبلغ (ر.س)"}
              </label>
              <Input
                type="number"
                value={addAmount}
                onChange={e => setAddAmount(e.target.value)}
                placeholder={addType === "gold" ? "مثال: 100" : "مثال: 50000"}
                className="text-right"
                inputMode="decimal"
              />
            </div>

            {/* Karat for gold */}
            {addType === "gold" && (
              <div>
                <label className="text-xs font-bold text-foreground mb-2 block">العيار</label>
                <div className="flex gap-2">
                  {GOLD_KARATS.map(k => (
                    <button
                      key={k}
                      onClick={() => setAddKarat(k)}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-colors ${
                        addKarat === k ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Live price preview for gold */}
            {addType === "gold" && addAmount && goldPricePerGram && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-700 dark:text-amber-400">القيمة السوقية</span>
                  <span className="text-sm font-extrabold text-amber-700 dark:text-amber-300">
                    {(Number(addAmount) * (addKarat / 24) * goldPricePerGram).toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س
                  </span>
                </div>
                <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70 mt-1">
                  سعر جرام الذهب عيار 24: {goldPricePerGram.toFixed(0)} ر.س
                </p>
              </div>
            )}

            {/* Silver preview */}
            {addType === "silver" && addAmount && silverPricePerGram && (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400">القيمة السوقية</span>
                  <span className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
                    {(Number(addAmount) * silverPricePerGram).toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  سعر جرام الفضة: {silverPricePerGram.toFixed(2)} ر.س
                </p>
              </div>
            )}

            {/* Purchase date */}
            <div>
              <label className="text-xs font-bold text-foreground mb-1.5 block">تاريخ الاقتناء / الشراء</label>
              <Input
                type="date"
                value={addDate}
                onChange={e => setAddDate(e.target.value)}
                className="text-right"
              />
              <p className="text-[10px] text-muted-foreground mt-1">يُحسب الحول (354 يوم) من هذا التاريخ</p>
            </div>

            <Button onClick={handleAdd} className="w-full h-12 text-base font-bold rounded-xl" disabled={!addAmount || Number(addAmount) <= 0}>
              <Plus size={18} className="ml-2" />
              إضافة الأصل
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Rules drawer */}
      <Drawer open={showRules} onOpenChange={setShowRules}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>أحكام الزكاة</DrawerTitle>
            <DrawerDescription>شروط وأحكام احتساب الزكاة</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto max-h-[60vh] space-y-4 text-right">
            <RuleSection
              title="💵 زكاة النقد"
              text="تجب الزكاة عند بلوغ النصاب ومرور حول كامل (سنة هجرية). مقدارها 2.5% من الرصيد."
            />
            <RuleSection
              title="🥇 زكاة الذهب والفضة"
              text={`نصاب الذهب: ${NISAB_GOLD_GRAMS} جراماً من الذهب الخالص (عيار 24).\nنصاب الفضة: ${NISAB_SILVER_GRAMS} جراماً من الفضة الخالصة.\n\nطريقة الحساب: (الوزن × سعر الجرام اليوم) × 2.5%\n\nحلي النساء: الراجح وجوب الزكاة في الحلي المعدة للبس أو الادخار إذا بلغت النصاب.`}
            />
            <RuleSection
              title="📈 زكاة الأسهم"
              text="إذا كانت للاستثمار طويل الأجل، تُزكى الأرباح بنسبة 2.5%.\nإذا كانت للتداول (المضاربة)، تُزكى القيمة السوقية كاملة بنسبة 2.5%."
            />
            <RuleSection
              title="🏦 صناديق الاستثمار"
              text="تُزكى الحصة السوقية للصندوق بنسبة 2.5%، حسب نوع الأصول."
            />
            <RuleSection
              title="⚖️ شروط الزكاة"
              text="1. بلوغ النصاب (ما يعادل 85 جرام ذهب عيار 24)\n2. مرور الحول (عام قمري = 354 يوم)\n3. الملكية التامة للمال"
            />
            <div className="rounded-xl bg-primary/5 border border-primary/10 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <span className="font-bold text-foreground">مثال:</span> إذا امتلكت 100 جرام من الذهب عيار 21، يتم حساب قيمتها الحالية بضرب الوزن في سعر الجرام مع مراعاة العيار. إذا تجاوزت القيمة نصاب 85 جراماً من عيار 24، تخرج 2.5% من القيمة.
              </p>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete confirm drawer */}
      <Drawer open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>حذف الأصل</DrawerTitle>
            <DrawerDescription>هل أنت متأكد من حذف هذا الأصل؟</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setDeleteConfirm(null)}>
              إلغاء
            </Button>
            <Button variant="destructive" className="flex-1 h-12 rounded-xl" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              <Trash2 size={16} className="ml-2" />
              حذف
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
      {/* Reminder drawer */}
      <Drawer open={!!reminderAsset} onOpenChange={(open) => { if (!open) { setReminderAsset(null); setCustomReminderDays(""); } }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>إعداد التذكير</DrawerTitle>
            <DrawerDescription>اختر موعد التذكير قبل حلول الحول</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-2">
            {[
              { label: "قبل يوم واحد", days: 1 },
              { label: "قبل أسبوع", days: 7 },
              { label: "قبل شهر", days: 30 },
            ].map((opt) => (
              <button
                key={opt.days}
                onClick={() => {
                  if (reminderAsset) {
                    updateAssets(assets.map(a => a.id === reminderAsset ? { ...a, reminder: true } : a));
                    haptic.medium();
                    setReminderAsset(null);
                  }
                }}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-border bg-background hover:bg-muted/50 active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-amber-500" />
                  <span className="text-sm font-bold text-foreground">{opt.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">{opt.days} يوم</span>
              </button>
            ))}

            <div className="pt-2">
              <p className="text-xs font-bold text-foreground mb-2">أو اختر عدد الأيام</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={customReminderDays}
                  onChange={(e) => setCustomReminderDays(e.target.value)}
                  placeholder="عدد الأيام"
                  className="text-right flex-1"
                  inputMode="numeric"
                />
                <Button
                  onClick={() => {
                    if (reminderAsset && customReminderDays) {
                      updateAssets(assets.map(a => a.id === reminderAsset ? { ...a, reminder: true } : a));
                      haptic.medium();
                      setReminderAsset(null);
                      setCustomReminderDays("");
                    }
                  }}
                  disabled={!customReminderDays || Number(customReminderDays) <= 0}
                  className="rounded-xl px-6"
                >
                  تأكيد
                </Button>
              </div>
            </div>

            <Button
              variant="ghost"
              className="w-full mt-2 text-muted-foreground"
              onClick={() => {
                if (reminderAsset) {
                  updateAssets(assets.map(a => a.id === reminderAsset ? { ...a, reminder: false } : a));
                  haptic.light();
                  setReminderAsset(null);
                }
              }}
            >
              <BellOff size={14} className="ml-2" />
              إلغاء التذكير
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

// Rule section sub-component
const RuleSection = ({ title, text }: { title: string; text: string }) => (
  <div className="rounded-xl border border-border p-3">
    <h4 className="text-sm font-bold text-foreground mb-2">{title}</h4>
    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{text}</p>
  </div>
);

export default Zakat;
