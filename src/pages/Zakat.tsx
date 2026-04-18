import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ListContentSkeleton } from "@/components/PageSkeletons";
import { useZakatAssets } from "@/hooks/useZakatAssets";
import FAB from "@/components/FAB";
import {
  Plus, Coins, Info, Trash2, Bell, BellOff, ChevronDown, ChevronUp,
  ShieldCheck, Scale, BookOpen, Calculator, X, Check, AlertTriangle, Clock, Pencil, CalendarIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import PageHeader from "@/components/PageHeader";
import PullToRefresh from "@/components/PullToRefresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { useFormValidation } from "@/hooks/useFormValidation";
import { numericPositive, validDate } from "@/lib/validators";

const CASH_CURRENCIES = [
  { code: "SAR", label: "ريال سعودي", symbol: "ر.س" },
  { code: "QAR", label: "ريال قطري", symbol: "ر.ق" },
  { code: "USD", label: "دولار أمريكي", symbol: "$" },
  { code: "EUR", label: "يورو", symbol: "€" },
  { code: "GBP", label: "جنيه إسترليني", symbol: "£" },
  { code: "AED", label: "درهم إماراتي", symbol: "د.إ" },
  { code: "KWD", label: "دينار كويتي", symbol: "د.ك" },
] as const;

function getCurrencySymbol(code: string): string {
  const found = CASH_CURRENCIES.find(c => c.code === code);
  return found ? found.symbol : code;
}

import SwipeableCard from "@/components/SwipeableCard";

// ── Types ──
type AssetType = "cash" | "gold" | "silver" | "stocks" | "funds";

interface ZakatAsset {
  id: string;
  type: AssetType;
  label: string;
  amount: number;
  karat?: number;
  purchaseDate: string;
  marketValue?: number;
  reminder: boolean;
  currency: string;
}

const ASSET_TYPE_META: Record<AssetType, { label: string; icon: string; color: string; bg: string }> = {
  cash: { label: "نقد", icon: "💵", color: "hsl(145 45% 35%)", bg: "hsl(145 40% 93%)" },
  gold: { label: "ذهب", icon: "🥇", color: "hsl(43 65% 40%)", bg: "hsl(43 60% 92%)" },
  silver: { label: "فضة", icon: "🥈", color: "hsl(215 15% 50%)", bg: "hsl(215 15% 92%)" },
  stocks: { label: "أسهم", icon: "📈", color: "hsl(215 70% 50%)", bg: "hsl(215 80% 93%)" },
  funds: { label: "صناديق استثمار", icon: "🏦", color: "hsl(270 50% 50%)", bg: "hsl(270 50% 93%)" },
};

const GOLD_KARATS = [24, 22, 21, 18];
const NISAB_GOLD_GRAMS = 85;
const NISAB_SILVER_GRAMS = 595;
const ZAKAT_RATE = 0.025;

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

// ── Gold price + exchange rates hook ──
const TROY_OZ_TO_GRAMS = 31.1035;
const USD_TO_SAR_FALLBACK = 3.75;

function useGoldPrice() {
  const [goldPricePerGram, setGoldPricePerGram] = useState<number | null>(null);
  const [silverPricePerGram, setSilverPricePerGram] = useState<number | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem("zakat_metal_prices_v2");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < 3600_000) {
          setGoldPricePerGram(parsed.gold);
          setSilverPricePerGram(parsed.silver);
          setRates(parsed.rates || {});
          setLastUpdated(parsed.ts);
          setLoading(false);
          return;
        }
      } catch {}
    }

    Promise.all([
      fetch("https://api.gold-api.com/price/XAU").then(r => r.json()),
      fetch("https://api.gold-api.com/price/XAG").then(r => r.json()),
      fetch("https://api.exchangerate-api.com/v4/latest/USD").then(r => r.json()).catch(() => null),
    ])
      .then(([goldData, silverData, fxData]) => {
        const now = Date.now();
        const fxRates = fxData?.rates || {};
        const sarRate = fxRates.SAR || USD_TO_SAR_FALLBACK;

        // gold/silver prices in SAR per gram
        const goldPerGram = (goldData.price / TROY_OZ_TO_GRAMS) * sarRate;
        const silverPerGram = (silverData.price / TROY_OZ_TO_GRAMS) * sarRate;

        // Build rates: currency → SAR (how many SAR per 1 unit of currency)
        const toSAR: Record<string, number> = { SAR: 1 };
        if (fxRates.SAR) {
          for (const [code, rate] of Object.entries(fxRates)) {
            if (typeof rate === "number" && rate > 0) {
              toSAR[code] = fxRates.SAR / rate;
            }
          }
        }

        setGoldPricePerGram(Math.round(goldPerGram * 100) / 100);
        setSilverPricePerGram(Math.round(silverPerGram * 100) / 100);
        setRates(toSAR);
        setLastUpdated(now);
        localStorage.setItem("zakat_metal_prices_v2", JSON.stringify({
          gold: Math.round(goldPerGram * 100) / 100,
          silver: Math.round(silverPerGram * 100) / 100,
          rates: toSAR,
          ts: now,
        }));
      })
      .catch(() => {
        setGoldPricePerGram(540);
        setSilverPricePerGram(8);
        setRates({ SAR: 1, USD: USD_TO_SAR_FALLBACK, EUR: 4.1, GBP: 4.7, AED: 1.02, QAR: 1.03, KWD: 12.2 });
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  return { goldPricePerGram, silverPricePerGram, rates, loading, error, lastUpdated };
}

// ── Component ──
const Zakat = () => {
  const navigate = useNavigate();
  const { assets: dbAssets, isLoading: assetsLoading, addAsset: addAssetMut, updateAsset: updateAssetMut, deleteAsset: deleteAssetMut, addZakatPayment } = useZakatAssets();

  const assets: ZakatAsset[] = useMemo(() => (dbAssets || []).map((a: any) => ({
    id: a.id,
    type: a.type as AssetType,
    label: a.name,
    amount: a.amount || a.weight_grams || 0,
    karat: a.karat ?? undefined,
    purchaseDate: a.purchase_date || "",
    marketValue: undefined,
    reminder: a.reminder || false,
    currency: a.currency || "SAR",
  })), [dbAssets]);

  const [showAdd, setShowAdd] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [addType, setAddType] = useState<AssetType>("cash");
  const [addLabel, setAddLabel] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addKarat, setAddKarat] = useState(24);
  const [addCurrency, setAddCurrency] = useState("SAR");
  const [addDate, setAddDate] = useState(new Date().toISOString().split("T")[0]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [reminderAsset, setReminderAsset] = useState<string | null>(null);
  const [customReminderDays, setCustomReminderDays] = useState("");
  const [zakatPaidAsset, setZakatPaidAsset] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const { goldPricePerGram, silverPricePerGram, rates, loading: priceLoading, lastUpdated } = useGoldPrice();

  const assetForm = useFormValidation<"amount" | "purchaseDate">(
    { amount: numericPositive, purchaseDate: validDate },
    { resetKey: showAdd }
  );

  const handleAdd = () => {
    if (!assetForm.validate({ amount: addAmount, purchaseDate: addDate })) return;
    const currencyToSave = (addType === "cash" || addType === "stocks" || addType === "funds") ? addCurrency : "SAR";
    if (editingAssetId) {
      updateAssetMut.mutate({
        id: editingAssetId,
        type: addType,
        name: addLabel || ASSET_TYPE_META[addType].label,
        amount: Number(addAmount),
        purchase_date: addDate,
        karat: addType === "gold" ? addKarat : null,
        currency: currencyToSave,
      });
    } else {
      addAssetMut.mutate({
        type: addType,
        name: addLabel || ASSET_TYPE_META[addType].label,
        amount: Number(addAmount),
        purchase_date: addDate,
        reminder: true,
        karat: addType === "gold" ? addKarat : null,
        currency: currencyToSave,
      });
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
    setAddCurrency("SAR");
    setAddDate(new Date().toISOString().split("T")[0]);
    setEditingAssetId(null);
  };

  const handleDelete = (id: string) => {
    deleteAssetMut.mutate(id);
    setDeleteConfirm(null);
    haptic.medium();
  };

  // Convert any currency to SAR
  const toSAR = useCallback((amount: number, currency: string): number => {
    if (currency === "SAR") return amount;
    const rate = rates[currency];
    if (rate) return amount * rate;
    return amount; // fallback: assume 1:1
  }, [rates]);

  // Get asset value in its own currency
  const getAssetValue = useCallback((asset: ZakatAsset): number => {
    if (asset.type === "cash" || asset.type === "stocks" || asset.type === "funds") return asset.amount;
    if (asset.type === "gold" && goldPricePerGram) {
      const purity = (asset.karat || 24) / 24;
      return asset.amount * purity * goldPricePerGram; // SAR
    }
    if (asset.type === "silver" && silverPricePerGram) {
      return asset.amount * silverPricePerGram; // SAR
    }
    return asset.amount;
  }, [goldPricePerGram, silverPricePerGram]);

  // Get asset value converted to SAR (for nisab comparison)
  const getAssetValueInSAR = useCallback((asset: ZakatAsset): number => {
    const value = getAssetValue(asset);
    // Gold/silver are already calculated in SAR
    if (asset.type === "gold" || asset.type === "silver") return value;
    return toSAR(value, asset.currency);
  }, [getAssetValue, toSAR]);

  // Zakat = 2.5% in asset's own currency
  const getZakatAmount = useCallback((asset: ZakatAsset): number => {
    return getAssetValue(asset) * ZAKAT_RATE;
  }, [getAssetValue]);

  // Currency for display
  const getAssetDisplayCurrency = (asset: ZakatAsset): string => {
    if (asset.type === "gold" || asset.type === "silver") return "SAR";
    return asset.currency;
  };

  const getNisabValue = (): number => {
    if (goldPricePerGram) return NISAB_GOLD_GRAMS * goldPricePerGram;
    return NISAB_GOLD_GRAMS * 310;
  };

  const totalValueInSAR = assets.reduce((sum, a) => sum + getAssetValueInSAR(a), 0);
  const nisabValue = getNisabValue();
  const meetsNisab = totalValueInSAR >= nisabValue;

  // Assets due (hawl passed)
  const assetsDue = assets.filter(a => daysUntilHawl(a.purchaseDate) <= 0);

  // Group totals by currency
  const totalsByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach(a => {
      const cur = getAssetDisplayCurrency(a);
      map[cur] = (map[cur] || 0) + getAssetValue(a);
    });
    return map;
  }, [assets, getAssetValue]);

  const zakatByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    assetsDue.forEach(a => {
      const cur = getAssetDisplayCurrency(a);
      map[cur] = (map[cur] || 0) + getZakatAmount(a);
    });
    return map;
  }, [assetsDue, getZakatAmount]);

  // Format multi-currency display
  const formatMultiCurrency = (byCurrency: Record<string, number>): string => {
    const entries = Object.entries(byCurrency).filter(([, v]) => v > 0);
    if (entries.length === 0) return "0";
    return entries
      .map(([cur, val]) => `${val.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ${getCurrencySymbol(cur)}`)
      .join(" + ");
  };

  return (
    <div className="min-h-screen bg-background pb-28" dir="rtl">
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

      {assetsLoading ? (
        <ListContentSkeleton />
      ) : (
      <PullToRefresh onRefresh={async () => { /* React Query auto-refetches */ }}>
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
              {Object.keys(totalsByCurrency).length <= 1 ? (
                <p className="text-lg font-extrabold text-foreground">
                  {totalValueInSAR.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} <span className="text-xs font-bold text-muted-foreground">{getCurrencySymbol(Object.keys(totalsByCurrency)[0] || "SAR")}</span>
                </p>
              ) : (
                <div className="space-y-0.5">
                  {Object.entries(totalsByCurrency).map(([cur, val]) => (
                    <p key={cur} className="text-sm font-extrabold text-foreground">
                      {val.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} <span className="text-[10px] font-bold text-muted-foreground">{getCurrencySymbol(cur)}</span>
                    </p>
                  ))}
                </div>
              )}
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
              {Object.keys(totalsByCurrency).length > 1 && (
                <p className="text-[9px] text-muted-foreground/70 mt-1">
                  ≈ {totalValueInSAR.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س (للمقارنة بالنصاب)
                </p>
              )}
            </div>

            <div className="rounded-2xl p-4 bg-background border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Calculator size={16} className="text-emerald-600" />
                <span className="text-xs font-bold text-muted-foreground">الزكاة المستحقة</span>
              </div>
              {Object.keys(zakatByCurrency).length <= 1 ? (
                <p className="text-lg font-extrabold text-emerald-600">
                  {(Object.values(zakatByCurrency)[0] || 0).toLocaleString("ar-SA", { maximumFractionDigits: 0 })} <span className="text-xs font-bold text-muted-foreground">{getCurrencySymbol(Object.keys(zakatByCurrency)[0] || "SAR")}</span>
                </p>
              ) : (
                <div className="space-y-0.5">
                  {Object.entries(zakatByCurrency).map(([cur, val]) => (
                    <p key={cur} className="text-sm font-extrabold text-emerald-600">
                      {val.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} <span className="text-[10px] font-bold text-muted-foreground">{getCurrencySymbol(cur)}</span>
                    </p>
                  ))}
                </div>
              )}
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
                  const displayCur = getAssetDisplayCurrency(asset);
                  const curSymbol = getCurrencySymbol(displayCur);

                  return (
                    <SwipeableCard
                      key={asset.id}
                      onSwipeOpen={() => setOpenCardId(asset.id)}
                      actions={[
                        { icon: <Check size={16} />, label: "زكّيت", color: "bg-emerald-600", onClick: () => setZakatPaidAsset(asset.id) },
                        { icon: <Bell size={16} />, label: "تذكير", color: "bg-amber-500", onClick: () => setReminderAsset(asset.id) },
                        { icon: <Pencil size={16} />, label: "تعديل", color: "bg-primary", onClick: () => {
                          setAddType(asset.type);
                          setAddLabel(asset.label);
                          setAddAmount(String(asset.amount));
                          if (asset.karat) setAddKarat(asset.karat);
                          setAddCurrency(asset.currency);
                          setAddDate(asset.purchaseDate);
                          setEditingAssetId(asset.id);
                          setShowAdd(true);
                        }},
                        { icon: <Trash2 size={16} />, label: "حذف", color: "bg-destructive", onClick: () => setDeleteConfirm(asset.id) },
                      ]}
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
                                  <span className="font-bold text-foreground">{value.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} {curSymbol}</span>
                                </div>
                              )}
                              {(asset.type === "cash" || asset.type === "stocks" || asset.type === "funds") && (
                                <p className="text-xs text-foreground font-bold">
                                  {value.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} {curSymbol}
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground">
                                تاريخ الاقتناء: {formatDate(asset.purchaseDate)}
                              </p>
                            </div>

                            {/* Hawl progress */}
                            <div className="mt-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold" style={{ color: isDue ? meta.color : "hsl(var(--muted-foreground))" }}>
                                  زكاتها: {zakat.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} {curSymbol}
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
                    </SwipeableCard>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>
      )}

      <FAB onClick={() => { haptic.medium(); setShowAdd(true); }} />

      {/* Add asset drawer */}
      <Drawer open={showAdd} onOpenChange={setShowAdd}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{editingAssetId ? "تعديل الأصل" : "إضافة أصل جديد"}</DrawerTitle>
            <DrawerDescription>{editingAssetId ? "عدّل بيانات الأصل" : "أضف أصلاً لحساب زكاته تلقائياً"}</DrawerDescription>
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

            {/* Amount + Currency */}
            <div>
              <label className="text-xs font-bold text-foreground mb-1.5 block">
                {addType === "gold" || addType === "silver" ? "الوزن (جرام)" : "المبلغ"}
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={addAmount}
                  onChange={e => { setAddAmount(e.target.value); assetForm.clearError("amount"); }}
                  placeholder={addType === "gold" ? "مثال: 100" : "مثال: 50000"}
                  className="flex-1 min-w-0 text-right"
                  inputMode="decimal"
                />
                {(addType === "cash" || addType === "stocks" || addType === "funds") && (
                  <select
                    value={addCurrency}
                    onChange={e => setAddCurrency(e.target.value)}
                    className="w-20 shrink-0 rounded-xl border border-input bg-background px-1.5 py-2.5 text-[11px]"
                  >
                    {CASH_CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.symbol} {c.label}</option>
                    ))}
                  </select>
                )}
              </div>
              {assetForm.errors.amount && <p className="text-xs text-destructive mt-1">{assetForm.errors.amount}</p>}
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
                onChange={(e) => { setAddDate(e.target.value); assetForm.clearError("purchaseDate"); }}
                className="w-full rounded-xl"
                dir="ltr"
              />
              {assetForm.errors.purchaseDate && <p className="text-xs text-destructive mt-1">{assetForm.errors.purchaseDate}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">يُحسب الحول (354 يوم) من هذا التاريخ</p>
            </div>

            <Button onClick={handleAdd} className="w-full h-12 text-base font-bold rounded-xl" disabled={!addAmount || Number(addAmount) <= 0}>
              {editingAssetId ? <Check size={18} className="ml-2" /> : <Plus size={18} className="ml-2" />}
              {editingAssetId ? "حفظ التعديلات" : "إضافة الأصل"}
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
            {/* Disclaimer */}
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-bold">
                    تنويه مهم
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                    الأفضل دائماً استقصاء الضوابط الشرعية والدينية من مصادرها الصحيحة. ما نذكره هنا هو من باب الاستدلال، وللمزكّي حرية الالتزام بذلك.
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                    الأرقام المعروضة هي أرقام <span className="font-bold">تقريبية بنسبة كبيرة جداً</span>، وننصح دائماً بأن يدفع المزكّي مبلغاً أكثر من المحسوب، فذلك أبرك وتجنباً لأي شبهة بنقص الزكاة.
                  </p>
                </div>
              </div>
            </div>

            <RuleSection
              title="💵 زكاة النقد"
              text="تجب الزكاة عند بلوغ النصاب ومرور حول كامل (سنة هجرية). مقدارها 2.5% من الرصيد."
            />
            <RuleSection
              title="🥇 زكاة الذهب والفضة"
              text={`نصاب الذهب: ${NISAB_GOLD_GRAMS} جراماً من الذهب الخالص (عيار 24).\nنصاب الفضة: ${NISAB_SILVER_GRAMS} جراماً من الفضة الخالصة.\n\nطريقة الحساب: (الوزن × سعر الجرام اليوم) × 2.5%\n\nحلي النساء: الراجح وجوب الزكاة في الحلي المعدة للبس أو الادخار إذا بلغت النصاب.`}
            />
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-3 py-3">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed font-bold">
                    تنويه بخصوص أسعار الذهب والفضة
                  </p>
                  <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
                    يتم جلب أسعار الذهب والفضة من مواقع عالمية متخصصة لحساب قيمة الجرام وتحديد مبلغ الزكاة بشكل <span className="font-bold">تقريبي وقريب من الدقة الكاملة</span>. قد تختلف الأسعار قليلاً عن السوق المحلي.
                  </p>
                </div>
              </div>
            </div>
            <RuleSection
              title="📈 زكاة الأسهم"
              text={"1. إن كان المساهم مضارباً (يبيع ويشتري في الأسهم): يجب عليه زكاتها بأن ينظر للقيمة السوقية لمحفظة الأسهم عند تمام الحول ويخرج ربع العشر (2.5%).\n\n2. إن كان المساهم مستثمراً (اكتتب في الأسهم أو اشتراها وتركها للإفادة من أرباحها): فلا زكاة فيها باعتبار أن الشركات المساهمة تخرج الزكاة لهيئة الزكاة.\n\n🌍 الأسهم الأمريكية والأجنبية:\nإذا كانت الأسهم في شركات خارج المملكة فيزكّيها، وذلك بأن يقوم بضرب مقدار الوعاء الزكوي للسهم في عدد الأسهم فيخرج له مقدار الزكاة."}
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

      {/* Zakat paid drawer */}
      <Drawer open={!!zakatPaidAsset} onOpenChange={(open) => !open && setZakatPaidAsset(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>تمت التزكية ✅</DrawerTitle>
            <DrawerDescription>
              الحمد لله، تم تسجيل أنك أخرجت زكاة هذا الأصل. هل تريد تذكيرك بالزكاة للحول القادم؟
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-3">
            {zakatPaidAsset && (() => {
              const asset = assets.find(a => a.id === zakatPaidAsset);
              if (!asset) return null;
              const zakat = getZakatAmount(asset);
              const curSymbol = getCurrencySymbol(getAssetDisplayCurrency(asset));
              return (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    {asset.label} — زكاتها: {zakat.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} {curSymbol}
                  </p>
                </div>
              );
            })()}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl"
                onClick={() => {
                  if (zakatPaidAsset) {
                    deleteAssetMut.mutate(zakatPaidAsset);
                    haptic.medium();
                    setZakatPaidAsset(null);
                  }
                }}
              >
                <BellOff size={16} className="ml-2" />
                لا، إزالة الأصل
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  if (zakatPaidAsset) {
                    const today = new Date().toISOString().split("T")[0];
                    updateAssetMut.mutate({ id: zakatPaidAsset, purchase_date: today, reminder: true });
                    haptic.medium();
                    setZakatPaidAsset(null);
                  }
                }}
              >
                <Bell size={16} className="ml-2" />
                نعم، ذكّرني للحول القادم
              </Button>
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
                    updateAssetMut.mutate({ id: reminderAsset, reminder: true });
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
                      updateAssetMut.mutate({ id: reminderAsset, reminder: true });
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
                  updateAssetMut.mutate({ id: reminderAsset, reminder: false });
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
