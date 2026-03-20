import { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

// ─── Hijri helpers (using Intl) ─────────────────────────────────

const getHijriMonth = (year: number, month: number): string => {
  try {
    const d = new Date(year, month, 15);
    return d.toLocaleDateString("ar-SA-u-ca-islamic", { month: "long", year: "numeric" });
  } catch {
    return "";
  }
};

const getGregorianLabel = (year: number, month: number): string => {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString("ar", { month: "long", year: "numeric" });
};

const getDayName = (year: number, month: number, day: number): string => {
  const d = new Date(year, month, day);
  return d.toLocaleDateString("ar", { weekday: "short" });
};

const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

// ─── Types ──────────────────────────────────────────────────────

interface MonthOption {
  year: number;
  month: number;
  gregorian: string;
  hijri: string;
}

interface DayInfo {
  day: number;
  name: string;
  isToday: boolean;
}

interface Props {
  selectedYear: number;
  selectedMonth: number;
  selectedDay: number;
  onMonthChange: (year: number, month: number) => void;
  onDayChange: (day: number) => void;
  dayStatus: (day: number) => "full" | "partial" | "empty";
}

// Generate months: 6 past + current + 6 future
const generateMonths = (): MonthOption[] => {
  const now = new Date();
  const months: MonthOption[] = [];
  for (let offset = -6; offset <= 6; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      gregorian: getGregorianLabel(d.getFullYear(), d.getMonth()),
      hijri: getHijriMonth(d.getFullYear(), d.getMonth()),
    });
  }
  return months;
};

export default function MonthDaySelector({
  selectedYear,
  selectedMonth,
  selectedDay,
  onMonthChange,
  onDayChange,
  dayStatus,
}: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedDayRef = useRef<HTMLButtonElement>(null);

  const months = useMemo(() => generateMonths(), []);

  const totalDays = getDaysInMonth(selectedYear, selectedMonth);
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === selectedYear && today.getMonth() === selectedMonth;

  const days: DayInfo[] = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => ({
      day: i + 1,
      name: getDayName(selectedYear, selectedMonth, i + 1),
      isToday: isCurrentMonth && i + 1 === today.getDate(),
    }));
  }, [selectedYear, selectedMonth, totalDays, isCurrentMonth]);

  // Scroll to selected day
  useEffect(() => {
    if (selectedDayRef.current) {
      selectedDayRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedDay, selectedMonth]);

  const currentGregorian = getGregorianLabel(selectedYear, selectedMonth);
  const currentHijri = getHijriMonth(selectedYear, selectedMonth);

  return (
    <div className="px-4 space-y-3">
      {/* Month Selector Dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full bg-white rounded-2xl px-4 py-3 shadow-sm border border-border/40 flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <div className="text-right">
            <p className="text-sm font-bold text-foreground">{currentGregorian}</p>
            <p className="text-[11px] text-muted-foreground">{currentHijri}</p>
          </div>
          <motion.div
            animate={{ rotate: dropdownOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={18} className="text-muted-foreground" />
          </motion.div>
        </button>

        {/* Dropdown list */}
        {dropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute z-50 top-full mt-1 w-full bg-white rounded-2xl shadow-lg border border-border/50 max-h-64 overflow-y-auto"
          >
            {months.map((m) => {
              const isSelected =
                m.year === selectedYear && m.month === selectedMonth;
              return (
                <button
                  key={`${m.year}-${m.month}`}
                  onClick={() => {
                    onMonthChange(m.year, m.month);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-right px-4 py-3 transition-colors ${
                    isSelected
                      ? "bg-primary/10"
                      : "hover:bg-muted/50 active:bg-muted"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      isSelected ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {m.gregorian}
                  </p>
                  <p
                    className={`text-[11px] ${
                      isSelected
                        ? "text-primary/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {m.hijri}
                  </p>
                </button>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Day Strip */}
      <div className="relative">
        {/* Scroll arrows */}
        <button
          onClick={() => {
            if (scrollRef.current)
              scrollRef.current.scrollBy({ left: 200, behavior: "smooth" });
          }}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/90 shadow-sm flex items-center justify-center border border-border/30"
        >
          <ChevronRight size={14} className="text-muted-foreground" />
        </button>
        <button
          onClick={() => {
            if (scrollRef.current)
              scrollRef.current.scrollBy({ left: -200, behavior: "smooth" });
          }}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/90 shadow-sm flex items-center justify-center border border-border/30"
        >
          <ChevronLeft size={14} className="text-muted-foreground" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide px-8 py-1"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {days.map((d) => {
            const isSelected = d.day === selectedDay;
            const status = dayStatus(d.day);

            return (
              <motion.button
                key={d.day}
                ref={isSelected ? selectedDayRef : undefined}
                onClick={() => onDayChange(d.day)}
                whileTap={{ scale: 0.92 }}
                className={`flex-shrink-0 w-14 rounded-2xl py-2 flex flex-col items-center gap-0.5 transition-all border ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : d.isToday
                    ? "bg-primary/10 border-primary/30"
                    : "bg-white border-border/30"
                }`}
                style={{ scrollSnapAlign: "center" }}
              >
                <span
                  className={`text-[10px] font-medium ${
                    isSelected
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground"
                  }`}
                >
                  {d.name}
                </span>
                <span
                  className={`text-base font-bold ${
                    isSelected ? "text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {d.day}
                </span>
                {/* Status dot */}
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected
                      ? status === "full"
                        ? "bg-yellow-300"
                        : status === "partial"
                        ? "bg-primary-foreground/50"
                        : "bg-primary-foreground/20"
                      : status === "full"
                      ? "bg-yellow-500"
                      : status === "partial"
                      ? "bg-primary/50"
                      : "bg-transparent"
                  }`}
                />
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
