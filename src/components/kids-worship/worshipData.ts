// ─── Category Definitions ───────────────────────────────────────

export interface WorshipItem {
  id: string;
  label: string;
}

export interface WorshipCategory {
  id: string;
  label: string;
  color: string;
  bg: string;
  items: WorshipItem[];
}

export const categories: WorshipCategory[] = [
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

export const allItems = categories.flatMap((c) => c.items);
export const TOTAL_ITEMS = allItems.length;

// ─── Data Types & Helpers ───────────────────────────────────────

export type DayData = Record<string, boolean>;
export type MonthData = Record<number, DayData>;

export interface ChildProfile {
  id: string;
  name: string;
}

export const getStorageKey = (childId: string, year: number, month: number) => {
  return `kids-worship-${childId}-${year}-${month}`;
};

// Legacy key (no child ID) for migration
const getLegacyStorageKey = (year: number, month: number) => {
  return `kids-worship-${year}-${month}`;
};

export const loadData = (childId: string, year: number, month: number): MonthData => {
  try {
    // Try child-specific key first
    const raw = localStorage.getItem(getStorageKey(childId, year, month));
    if (raw) return JSON.parse(raw);
    // Fall back to legacy key for migration
    if (childId === "default") {
      const legacy = localStorage.getItem(getLegacyStorageKey(year, month));
      if (legacy) return JSON.parse(legacy);
    }
    return {};
  } catch {
    return {};
  }
};

export const saveData = (childId: string, year: number, month: number, data: MonthData) => {
  localStorage.setItem(getStorageKey(childId, year, month), JSON.stringify(data));
};

export const getMonthLabel = (year: number, month: number) => {
  const d = new Date(year, month, 1);
  const greg = d.toLocaleDateString("ar", { month: "long", year: "numeric" });
  let hijri = "";
  try {
    hijri = d.toLocaleDateString("ar-SA-u-ca-islamic", { month: "long", year: "numeric" });
  } catch { /* fallback */ }
  return hijri ? `${greg} - ${hijri}` : greg;
};

export const loadChildren = (): ChildProfile[] => {
  try {
    const raw = localStorage.getItem("kids-worship-children");
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  // Default: get children from family members
  try {
    const members = localStorage.getItem("family_members");
    if (members) {
      const parsed = JSON.parse(members);
      const kids = (parsed as { id: string; name: string; role: string }[]).filter((m) => m.role === "son" || m.role === "daughter");
      if (kids.length > 0) {
        return kids.map((k) => ({ id: k.id, name: k.name }));
      }
    }
  } catch { /* */ }
  return [{ id: "default", name: "طفلي" }];
};

export const saveChildren = (children: ChildProfile[]) => {
  localStorage.setItem("kids-worship-children", JSON.stringify(children));
};
