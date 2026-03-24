export type FrequencyType = "daily" | "specific_days";

export interface MedicationReminder {
  id: string;
  enabled: boolean;
  lastConfirmedAt?: string;
  nextDueAt: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  memberId: string;
  memberName: string;
  frequencyType: FrequencyType;
  frequencyValue: number; // kept for backward compat
  selectedDays?: number[]; // 0=Sat, 1=Sun, ..., 6=Fri
  timesPerDay?: number;
  specificTimes?: string[];
  startDate: string;
  endDate?: string;
  notes?: string;
  color: string;
  reminder: MedicationReminder;
  takenLog: string[];
  createdAt: string;
}

export const MEDICATION_COLORS = [
  "hsl(0, 0%, 100%)",
  "hsl(50, 90%, 55%)",
  "hsl(340, 80%, 75%)",
  "hsl(215, 70%, 50%)",
  "hsl(0, 75%, 50%)",
  "hsl(30, 90%, 55%)",
  "hsl(145, 55%, 45%)",
  "hsl(25, 50%, 35%)",
];

export const WEEKDAYS = [
  { value: 0, label: "سب", fullLabel: "السبت" },
  { value: 1, label: "أح", fullLabel: "الأحد" },
  { value: 2, label: "إث", fullLabel: "الإثنين" },
  { value: 3, label: "ثل", fullLabel: "الثلاثاء" },
  { value: 4, label: "أر", fullLabel: "الأربعاء" },
  { value: 5, label: "خم", fullLabel: "الخميس" },
  { value: 6, label: "جم", fullLabel: "الجمعة" },
];

export const calculateNextDue = (med: Medication): string => {
  const now = new Date();
  const lastTaken = med.reminder.lastConfirmedAt ? new Date(med.reminder.lastConfirmedAt) : null;
  const sortedTimes = med.specificTimes && med.specificTimes.length > 0
    ? [...med.specificTimes].sort()
    : ["09:00"];

  const searchAfter = lastTaken ?? now;

  const getDoseTimesForDay = (day: Date): Date[] => {
    return sortedTimes.map((time) => {
      const [h, m] = time.split(":").map(Number);
      const d = new Date(day);
      d.setHours(h, m, 0, 0);
      return d;
    });
  };

  const isSpecificDayEnabled = (day: Date): boolean => {
    if (med.frequencyType === "daily") return true;
    if (med.frequencyType === "specific_days" && med.selectedDays && med.selectedDays.length > 0) {
      const ourToJs = (d: number) => (d + 6) % 7;
      const jsDays = med.selectedDays.map(ourToJs);
      return jsDays.includes(day.getDay());
    }
    return false;
  };

  for (let offset = 0; offset <= 14; offset++) {
    const day = new Date(searchAfter);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + offset);

    if (!isSpecificDayEnabled(day)) continue;

    const doseTimes = getDoseTimesForDay(day);
    for (const candidate of doseTimes) {
      if (candidate.getTime() > searchAfter.getTime()) {
        return candidate.toISOString();
      }
    }
  }

  return searchAfter.toISOString();
};

export const isMedicationDue = (med: Medication): boolean => {
  const now = new Date();
  const nextDue = new Date(med.reminder.nextDueAt);
  return nextDue <= now && med.reminder.enabled;
};

export const formatFrequency = (med: Medication): string => {
  if (med.frequencyType === "daily") {
    if (med.timesPerDay && med.timesPerDay > 1) return `يومياً - ${med.timesPerDay} مرات`;
    return "يومياً";
  }
  if (med.frequencyType === "specific_days" && med.selectedDays) {
    if (med.selectedDays.length === 7) return "يومياً";
    const dayNames = med.selectedDays.map(d => WEEKDAYS[d]?.label).join("، ");
    return dayNames;
  }
  // backward compat
  if ((med as any).frequencyType === "every_x_days") {
    if (med.frequencyValue === 2) return "كل يومين";
    if (med.frequencyValue === 7) return "أسبوعياً";
    return `كل ${med.frequencyValue} أيام`;
  }
  if ((med as any).frequencyType === "every_x_hours") {
    if (med.frequencyValue === 1) return "كل ساعة";
    if (med.frequencyValue === 2) return "كل ساعتين";
    return `كل ${med.frequencyValue} ساعات`;
  }
  return "";
};

export const getTimeUntilNext = (nextDue: string): string => {
  const now = new Date();
  const due = new Date(nextDue);
  const diff = due.getTime() - now.getTime();

  if (diff <= 0) return "مستحق الآن!";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `بعد ${days} ${days === 1 ? "يوم" : days === 2 ? "يومين" : "أيام"}`;
  }
  if (hours > 0) return `بعد ${hours} ساعة و ${minutes} دقيقة`;
  return `بعد ${minutes} دقيقة`;
};
