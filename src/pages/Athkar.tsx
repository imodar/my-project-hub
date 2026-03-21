import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowRight, Check, RotateCcw, ChevronLeft, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { athkarSections, AthkarSection, Thikr } from "@/data/athkarData";
import { haptic } from "@/lib/haptics";

/* ────────── Google Font (Amiri Quran) ────────── */
const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Amiri+Quran&display=swap";

const useFontLoader = () => {
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_URL;
      document.head.appendChild(link);
    }
  }, []);
};

/* ────────── Section Card ────────── */
const SectionCard = ({
  section,
  onOpen,
}: {
  section: AthkarSection;
  onOpen: () => void;
}) => {
  // Load saved progress
  const saved = JSON.parse(
    localStorage.getItem(`athkar-progress-${section.id}`) || "{}"
  );
  const total = section.athkar.reduce((s, t) => s + t.count, 0);
  const done = section.athkar.reduce(
    (s, t) => s + Math.min(saved[t.id] || 0, t.count),
    0
  );
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isComplete = pct === 100;

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      className="relative w-full rounded-3xl p-5 text-right overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${section.gradient[0]}, ${section.gradient[1]})`,
      }}
    >
      {/* decorative circles */}
      <div
        className="absolute -top-6 -left-6 w-24 h-24 rounded-full opacity-10"
        style={{ background: "white" }}
      />
      <div
        className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full opacity-10"
        style={{ background: "white" }}
      />

      <div className="relative z-10 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{section.icon}</span>
            <h3 className="text-lg font-bold text-white">{section.title}</h3>
          </div>
          <p className="text-xs text-white/70">{section.subtitle}</p>

          {/* progress bar */}
          <div className="mt-3 h-1.5 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "white" }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
          <p className="text-[10px] text-white/60 mt-1">
            {isComplete ? "✓ اكتمل" : `${pct}%`}
          </p>
        </div>

        <ChevronLeft size={20} className="text-white/50" />
      </div>
    </motion.button>
  );
};

/* ────────── Thikr Counter Card ────────── */
const ThikrCard = ({
  thikr,
  current,
  onTap,
}: {
  thikr: Thikr;
  current: number;
  onTap: () => void;
}) => {
  const remaining = Math.max(0, thikr.count - current);
  const isComplete = remaining === 0;

  return (
    <motion.div
      layout
      className={`rounded-2xl border transition-colors duration-300 ${
        isComplete
          ? "bg-primary/5 border-primary/20"
          : "bg-card border-border"
      }`}
    >
      {/* Arabic text */}
      <button
        onClick={onTap}
        disabled={isComplete}
        className="w-full p-5 pb-3 text-center active:bg-muted/30 transition-colors rounded-t-2xl"
      >
        <p
          className="leading-[2.4] text-foreground"
          style={{
            fontFamily: "'Amiri Quran', serif",
            fontSize: "1.35rem",
            direction: "rtl",
          }}
        >
          {thikr.text}
        </p>
      </button>

      {/* Footer */}
      <div className="px-5 pb-4 flex items-center justify-between border-t border-border/50 pt-3">
        {thikr.fadl && (
          <p className="text-[10px] text-muted-foreground leading-relaxed flex-1 ml-3">
            {thikr.fadl}
          </p>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {isComplete ? (
            <div className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-full">
              <Check size={14} />
              <span className="text-xs font-bold">تم</span>
            </div>
          ) : (
            <button
              onClick={onTap}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full transition-transform active:scale-95"
              style={{
                background: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
              }}
            >
              <span className="text-sm font-bold tabular-nums">
                {remaining}
              </span>
              <span className="text-xs">/{thikr.count}</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* ────────── Detail View ────────── */
const SectionDetail = ({
  section,
  onBack,
}: {
  section: AthkarSection;
  onBack: () => void;
}) => {
  const storageKey = `athkar-progress-${section.id}`;
  const [progress, setProgress] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  });

  const save = useCallback(
    (p: Record<string, number>) => {
      localStorage.setItem(storageKey, JSON.stringify(p));
    },
    [storageKey]
  );

  const handleTap = (thikr: Thikr) => {
    const cur = progress[thikr.id] || 0;
    if (cur >= thikr.count) return;
    haptic.light();
    const next = { ...progress, [thikr.id]: cur + 1 };
    setProgress(next);
    save(next);
  };

  const handleReset = () => {
    setProgress({});
    save({});
    haptic.medium();
  };

  const total = section.athkar.reduce((s, t) => s + t.count, 0);
  const done = section.athkar.reduce(
    (s, t) => s + Math.min(progress[t.id] || 0, t.count),
    0
  );
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div
        className="sticky top-0 z-50 px-4 pt-12 pb-4 rounded-b-3xl"
        style={{
          background: `linear-gradient(135deg, ${section.gradient[0]}, ${section.gradient[1]})`,
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-full shrink-0"
            style={{ background: "hsla(0,0%,100%,0.15)" }}
          >
            <ArrowRight size={20} className="text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span>{section.icon}</span>
              {section.title}
            </h1>
            <p className="text-xs text-white/70">{section.subtitle}</p>
          </div>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-full shrink-0"
            style={{ background: "hsla(0,0%,100%,0.15)" }}
          >
            <RotateCcw size={18} className="text-white" />
          </button>
        </div>

        {/* Progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-white/80 text-xs mb-1.5">
            <span>التقدم</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-white"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </div>

      {/* Athkar list */}
      <div className="px-4 mt-5 flex flex-col gap-4">
        {section.athkar.map((thikr) => (
          <ThikrCard
            key={thikr.id}
            thikr={thikr}
            current={progress[thikr.id] || 0}
            onTap={() => handleTap(thikr)}
          />
        ))}
      </div>
    </div>
  );
};

/* ────────── Main Page ────────── */
const Athkar = () => {
  useFontLoader();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<AthkarSection | null>(
    null
  );

  if (activeSection) {
    return (
      <SectionDetail
        section={activeSection}
        onBack={() => setActiveSection(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28" dir="rtl">
      {/* Header */}
      <div
        className="sticky top-0 z-50 px-4 pt-12 pb-4 rounded-b-3xl"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)))",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-full shrink-0"
            style={{ background: "hsla(0,0%,100%,0.12)" }}
          >
            <ArrowRight size={20} className="text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">الأذكار والأدعية</h1>
        </div>
        {/* Quranic verse */}
        <div className="mt-2 px-2 py-1.5 rounded-xl" style={{ background: "hsla(0,0%,100%,0.08)" }}>
          <p
            className="text-center text-white/85 leading-[2]"
            style={{ fontFamily: "'Amiri Quran', serif", fontSize: "0.85rem" }}
          >
            ﴿وَالذَّاكِرِينَ اللَّهَ كَثِيرًا وَالذَّاكِرَاتِ أَعَدَّ اللَّهُ لَهُم مَّغْفِرَةً وَأَجْرًا عَظِيمًا﴾
          </p>
          <p className="text-center text-white/45 text-[9px]">سورة الأحزاب - 35</p>
        </div>
      </div>

      {/* Sections */}
      <div className="px-4 mt-5 flex flex-col gap-4">
        <AnimatePresence>
          {athkarSections.map((section, i) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <SectionCard
                section={section}
                onOpen={() => setActiveSection(section)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Athkar;
