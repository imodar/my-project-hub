import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Download, ChevronLeft, ChevronRight, Sparkles, Trophy, RotateCcw } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

// ─── Category Definitions ───────────────────────────────────────

interface WorshipItem {
  id: string;
  label: string;
}

interface WorshipCategory {
  id: string;
  label: string;
  color: string;
  bg: string;
  items: WorshipItem[];
}

const categories: WorshipCategory[] = [
  {
    id: "salah",
    label: "الصلاة",
    color: "hsl(270 55% 50%)",
    bg: "hsl(270 55% 94%)",
    items: [
      { id: "fajr", label: "الفجر" },
      { id: "dhuhr", label: "الظهر" },
      { id: "asr", label: "العصر" },
      { id: "maghrib", label: "المغرب" },
      { id: "isha", label: "العشاء" },
    ],
  },
  {
    id: "nawafil",
    label: "النوافل",
    color: "hsl(200 60% 45%)",
    bg: "hsl(200 60% 93%)",
    items: [
      { id: "siyam", label: "صيام" },
      { id: "duha", label: "الضحى" },
      { id: "witr", label: "الوتر" },
      { id: "tarawih", label: "التراويح" },
    ],
  },
  {
    id: "athkar",
    label: "الأذكار",
    color: "hsl(160 50% 38%)",
    bg: "hsl(160 45% 92%)",
    items: [
      { id: "morning", label: "الصباح" },
      { id: "evening", label: "المساء" },
      { id: "istighfar", label: "استغفار" },
      { id: "tahlil", label: "لا إله إلا الله" },
    ],
  },
  {
    id: "quran",
    label: "القرآن",
    color: "hsl(35 70% 45%)",
    bg: "hsl(35 65% 92%)",
    items: [
      { id: "hifz", label: "ورد حفظ" },
      { id: "tilawa", label: "ورد تلاوة" },
    ],
  },
  {
    id: "good_deeds",
    label: "أعمال صالحة",
    color: "hsl(340 55% 50%)",
    bg: "hsl(340 50% 93%)",
    items: [
      { id: "sadaqa", label: "الصدقة" },
      { id: "parents", label: "بر الوالدين" },
      { id: "no_tv", label: "مقاطعة الشاشات" },
      { id: "tongue", label: "إمساك اللسان" },
    ],
  },
];

const allItems = categories.flatMap((c) => c.items);
const TOTAL_ITEMS = allItems.length;

// ─── Helpers ────────────────────────────────────────────────────

const getDaysInCurrentMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
};

const getCurrentMonthName = () => {
  return new Date().toLocaleDateString("ar-SA", { month: "long", year: "numeric" });
};

const getStorageKey = () => {
  const now = new Date();
  return `kids-worship-${now.getFullYear()}-${now.getMonth()}`;
};

type DayData = Record<string, boolean>;
type MonthData = Record<number, DayData>;

const loadData = (): MonthData => {
  try {
    const raw = localStorage.getItem(getStorageKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveData = (data: MonthData) => {
  localStorage.setItem(getStorageKey(), JSON.stringify(data));
};

// ─── Component ──────────────────────────────────────────────────

const KidsWorship = () => {
  const [data, setData] = useState<MonthData>(loadData);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [showConfetti, setShowConfetti] = useState(false);

  const totalDays = getDaysInCurrentMonth();
  const today = new Date().getDate();

  useEffect(() => {
    saveData(data);
  }, [data]);

  const dayData = data[selectedDay] || {};

  const toggleItem = (itemId: string) => {
    const newDayData = { ...dayData, [itemId]: !dayData[itemId] };
    const newData = { ...data, [selectedDay]: newDayData };
    setData(newData);

    // Check if all items are done
    const doneCount = Object.values(newDayData).filter(Boolean).length;
    if (doneCount === TOTAL_ITEMS && !dayData[itemId]) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
      toast({
        title: "🎉 ما شاء الله!",
        description: "أكملت جميع العبادات اليوم! بارك الله فيك",
      });
    }
  };

  const doneCount = Object.values(dayData).filter(Boolean).length;
  const progress = TOTAL_ITEMS > 0 ? (doneCount / TOTAL_ITEMS) * 100 : 0;

  // Stars: count days where all items completed
  const totalStars = useMemo(() => {
    let stars = 0;
    for (let d = 1; d <= totalDays; d++) {
      const dd = data[d] || {};
      if (Object.values(dd).filter(Boolean).length === TOTAL_ITEMS) stars++;
    }
    return stars;
  }, [data, totalDays]);

  // Incomplete items for motivation
  const incompleteItems = allItems.filter((item) => !dayData[item.id]);

  const navigateDay = (dir: number) => {
    const next = selectedDay + dir;
    if (next >= 1 && next <= totalDays) setSelectedDay(next);
  };

  const resetDay = () => {
    const newData = { ...data };
    delete newData[selectedDay];
    setData(newData);
    toast({ title: "تم إعادة تعيين اليوم" });
  };

  const handleExport = () => {
    // Build CSV
    const headers = ["اليوم", ...allItems.map((i) => i.label)];
    const rows = [headers.join(",")];
    for (let d = 1; d <= totalDays; d++) {
      const dd = data[d] || {};
      const row = [
        `يوم ${d}`,
        ...allItems.map((i) => (dd[i.id] ? "✓" : "")),
      ];
      rows.push(row.join(","));
    }
    const bom = "\uFEFF";
    const blob = new Blob([bom + rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `عبادات-${getCurrentMonthName()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "تم تصدير الجدول بنجاح ✅" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-amber-50 pb-28" dir="rtl">
      {/* Confetti */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-2xl"
                initial={{
                  x: 0, y: 0, scale: 0, rotate: 0,
                }}
                animate={{
                  x: (Math.random() - 0.5) * 300,
                  y: (Math.random() - 0.5) * 400,
                  scale: [0, 1.2, 0.8],
                  rotate: Math.random() * 360,
                }}
                transition={{ duration: 2, ease: "easeOut" }}
              >
                {["⭐", "🌙", "🎉", "✨", "💫"][i % 5]}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <PageHeader
        title="عبادات الأطفال"
        subtitle={getCurrentMonthName()}
        actions={[
          {
            icon: <Download size={18} className="text-white" />,
            onClick: handleExport,
          },
          {
            icon: <RotateCcw size={18} className="text-white" />,
            onClick: resetDay,
          },
        ]}
      />

      {/* Stars & Progress Summary */}
      <div className="px-4 -mt-1">
        <div className="bg-white rounded-2xl p-4 shadow-md border border-purple-100/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy size={20} style={{ color: "hsl(40 90% 50%)" }} />
              <span className="text-sm font-bold text-foreground">
                نجومي: <span style={{ color: "hsl(40 90% 50%)" }}>{totalStars}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles size={16} style={{ color: "hsl(270 55% 50%)" }} />
              <span className="text-xs font-semibold text-muted-foreground">
                {doneCount}/{TOTAL_ITEMS}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-3 rounded-full bg-purple-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: progress === 100
                  ? "linear-gradient(90deg, hsl(40 90% 50%), hsl(35 95% 55%))"
                  : "linear-gradient(90deg, hsl(270 55% 55%), hsl(340 55% 55%))",
              }}
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          {progress === 100 && (
            <motion.p
              className="text-center text-xs font-bold mt-2"
              style={{ color: "hsl(40 90% 45%)" }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              ⭐ ما شاء الله! أكملت كل شيء اليوم ⭐
            </motion.p>
          )}
        </div>
      </div>

      {/* Day Selector */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-purple-100/40">
          <button
            onClick={() => navigateDay(1)}
            disabled={selectedDay >= totalDays}
            className="p-2 rounded-xl active:scale-95 transition-transform disabled:opacity-30"
            style={{ background: "hsl(270 55% 94%)" }}
          >
            <ChevronRight size={18} style={{ color: "hsl(270 55% 50%)" }} />
          </button>

          <div className="text-center">
            <p className="text-lg font-extrabold text-foreground">يوم {selectedDay}</p>
            <p className="text-[11px] text-muted-foreground">
              {selectedDay === today ? "اليوم" : `${Math.abs(selectedDay - today)} ${selectedDay < today ? "أيام مضت" : "أيام قادمة"}`}
            </p>
          </div>

          <button
            onClick={() => navigateDay(-1)}
            disabled={selectedDay <= 1}
            className="p-2 rounded-xl active:scale-95 transition-transform disabled:opacity-30"
            style={{ background: "hsl(270 55% 94%)" }}
          >
            <ChevronLeft size={18} style={{ color: "hsl(270 55% 50%)" }} />
          </button>
        </div>
      </div>

      {/* Quick Day Dots */}
      <div className="px-4 mt-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1.5 justify-center flex-wrap">
          {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
            const dd = data[d] || {};
            const done = Object.values(dd).filter(Boolean).length;
            const full = done === TOTAL_ITEMS;
            const partial = done > 0 && !full;
            return (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={`w-8 h-8 rounded-full text-[10px] font-bold transition-all active:scale-90 ${
                  d === selectedDay ? "ring-2 ring-offset-1" : ""
                }`}
                style={{
                  background: full
                    ? "hsl(40 90% 50%)"
                    : partial
                    ? "hsl(270 55% 88%)"
                    : d === today
                    ? "hsl(270 55% 94%)"
                    : "hsl(0 0% 95%)",
                  color: full
                    ? "white"
                    : d === selectedDay
                    ? "hsl(270 55% 40%)"
                    : "hsl(0 0% 45%)",
                  ringColor: "hsl(270 55% 50%)",
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Worship Grid by Category */}
      <div className="px-4 mt-5 space-y-4">
        {categories.map((cat) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-white rounded-2xl overflow-hidden shadow-sm border"
            style={{ borderColor: `${cat.color}22` }}
          >
            {/* Category Header */}
            <div
              className="px-4 py-2.5 flex items-center gap-2"
              style={{ background: cat.bg }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: cat.color }}
              />
              <h3
                className="text-sm font-extrabold"
                style={{ color: cat.color }}
              >
                {cat.label}
              </h3>
              <span
                className="text-[10px] font-semibold mr-auto px-2 py-0.5 rounded-full"
                style={{
                  background: `${cat.color}18`,
                  color: cat.color,
                }}
              >
                {cat.items.filter((i) => dayData[i.id]).length}/{cat.items.length}
              </span>
            </div>

            {/* Items */}
            <div className="p-3 flex flex-wrap gap-2">
              {cat.items.map((item) => {
                const done = !!dayData[item.id];
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    whileTap={{ scale: 0.92 }}
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl transition-all"
                    style={{
                      background: done ? cat.bg : "hsl(0 0% 97%)",
                      border: `1.5px solid ${done ? cat.color : "hsl(0 0% 90%)"}`,
                    }}
                  >
                    <motion.div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: done ? cat.color : "transparent",
                        border: `2px solid ${done ? cat.color : "hsl(0 0% 78%)"}`,
                      }}
                      animate={done ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.3 }}
                    >
                      {done && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-white text-[10px]"
                        >
                          ✓
                        </motion.span>
                      )}
                    </motion.div>
                    <span
                      className="text-xs font-bold"
                      style={{
                        color: done ? cat.color : "hsl(0 0% 40%)",
                        textDecoration: done ? "none" : "none",
                      }}
                    >
                      {item.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Incomplete Items Motivation */}
      {incompleteItems.length > 0 && incompleteItems.length < TOTAL_ITEMS && (
        <div className="px-4 mt-5">
          <div
            className="rounded-2xl p-4 border"
            style={{
              background: "hsl(35 80% 96%)",
              borderColor: "hsl(35 60% 85%)",
            }}
          >
            <p className="text-xs font-bold mb-2" style={{ color: "hsl(35 70% 40%)" }}>
              💪 باقيلك شوي! ما عملت:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {incompleteItems.map((item) => (
                <span
                  key={item.id}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: "hsl(35 70% 90%)",
                    color: "hsl(35 60% 35%)",
                  }}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Monthly Summary */}
      <div className="px-4 mt-5 mb-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100/40">
          <div className="flex items-center gap-2 mb-3">
            <Star size={18} style={{ color: "hsl(40 90% 50%)" }} />
            <h3 className="text-sm font-extrabold text-foreground">ملخص الشهر</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl" style={{ background: "hsl(270 55% 95%)" }}>
              <p className="text-xl font-black" style={{ color: "hsl(270 55% 50%)" }}>{totalStars}</p>
              <p className="text-[10px] font-semibold text-muted-foreground">أيام كاملة</p>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: "hsl(160 45% 93%)" }}>
              <p className="text-xl font-black" style={{ color: "hsl(160 50% 38%)" }}>
                {Object.keys(data).length}
              </p>
              <p className="text-[10px] font-semibold text-muted-foreground">أيام نشطة</p>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: "hsl(35 65% 93%)" }}>
              <p className="text-xl font-black" style={{ color: "hsl(35 70% 45%)" }}>
                {totalDays - Object.keys(data).length}
              </p>
              <p className="text-[10px] font-semibold text-muted-foreground">أيام متبقية</p>
            </div>
          </div>
        </div>
      </div>

      {/* Export Button */}
      <div className="px-4 mb-8">
        <Button
          onClick={handleExport}
          className="w-full h-12 rounded-2xl text-sm font-bold gap-2"
          style={{
            background: "linear-gradient(135deg, hsl(270 55% 50%), hsl(340 55% 50%))",
          }}
        >
          <Download size={18} />
          تصدير الجدول
        </Button>
      </div>
    </div>
  );
};

export default KidsWorship;
