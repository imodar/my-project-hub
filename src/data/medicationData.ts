export type FrequencyType = "daily" | "every_x_days" | "every_x_hours";

export interface MedicationReminder {
  id: string;
  enabled: boolean;
  lastConfirmedAt?: string; // ISO date-time
  nextDueAt: string; // ISO date-time
}

export interface Medication {
  id: string;
  name: string;
  dosage: string; // e.g. "500mg", "قرص واحد"
  memberId: string; // family member ID or "me"
  memberName: string;
  frequencyType: FrequencyType;
  frequencyValue: number; // days or hours depending on type
  timesPerDay?: number; // for daily: how many times per day
  specificTimes?: string[]; // e.g. ["08:00", "20:00"]
  startDate: string; // ISO date
  endDate?: string; // ISO date, optional
  notes?: string;
  color: string;
  reminder: MedicationReminder;
  takenLog: string[]; // ISO date-time strings of when taken
  createdAt: string;
}

export const MEDICATION_COLORS = [
  "hsl(215, 70%, 50%)",
  "hsl(145, 45%, 40%)",
  "hsl(350, 55%, 50%)",
  "hsl(30, 80%, 50%)",
  "hsl(270, 50%, 50%)",
  "hsl(185, 60%, 38%)",
  "hsl(320, 55%, 45%)",
  "hsl(43, 65%, 45%)",
];

export const FREQUENCY_OPTIONS: { value: FrequencyType; label: string }[] = [
  { value: "daily", label: "يومياً" },
  { value: "every_x_days", label: "كل عدد أيام" },
  { value: "every_x_hours", label: "كل عدد ساعات" },
];

export const DAY_INTERVALS = [
  { value: 2, label: "كل يومين" },
  { value: 3, label: "كل 3 أيام" },
  { value: 4, label: "كل 4 أيام" },
  { value: 5, label: "كل 5 أيام" },
  { value: 7, label: "كل أسبوع" },
  { value: 14, label: "كل أسبوعين" },
  { value: 30, label: "كل شهر" },
];

export const HOUR_INTERVALS = [
  { value: 1, label: "كل ساعة" },
  { value: 2, label: "كل ساعتين" },
  { value: 3, label: "كل 3 ساعات" },
  { value: 4, label: "كل 4 ساعات" },
  { value: 6, label: "كل 6 ساعات" },
  { value: 8, label: "كل 8 ساعات" },
  { value: 12, label: "كل 12 ساعة" },
];

export const calculateNextDue = (med: Medication): string => {
  const now = new Date();

  if (med.frequencyType === "daily") {
    // Next occurrence today or tomorrow
    if (med.specificTimes && med.specificTimes.length > 0) {
      for (const time of med.specificTimes.sort()) {
        const [h, m] = time.split(":").map(Number);
        const candidate = new Date(now);
        candidate.setHours(h, m, 0, 0);
        if (candidate > now) return candidate.toISOString();
      }
      // All times passed today, next is tomorrow first time
      const [h, m] = med.specificTimes.sort()[0].split(":").map(Number);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(h, m, 0, 0);
      return tomorrow.toISOString();
    }
    return now.toISOString();
  }

  if (med.frequencyType === "every_x_days") {
    const start = new Date(med.startDate);
    const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceLastDue = diffDays % med.frequencyValue;
    const daysUntilNext = daysSinceLastDue === 0 ? 0 : med.frequencyValue - daysSinceLastDue;
    const next = new Date(now);
    next.setDate(next.getDate() + daysUntilNext);
    next.setHours(9, 0, 0, 0); // default 9 AM
    if (next <= now && daysUntilNext === 0) return next.toISOString();
    if (next <= now) {
      next.setDate(next.getDate() + med.frequencyValue);
    }
    return next.toISOString();
  }

  if (med.frequencyType === "every_x_hours") {
    const lastTaken = med.takenLog.length > 0
      ? new Date(med.takenLog[med.takenLog.length - 1])
      : new Date(med.startDate);
    const next = new Date(lastTaken.getTime() + med.frequencyValue * 60 * 60 * 1000);
    if (next <= now) return now.toISOString(); // overdue
    return next.toISOString();
  }

  return now.toISOString();
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
  if (med.frequencyType === "every_x_days") {
    if (med.frequencyValue === 2) return "كل يومين";
    if (med.frequencyValue === 7) return "أسبوعياً";
    return `كل ${med.frequencyValue} أيام`;
  }
  if (med.frequencyType === "every_x_hours") {
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
