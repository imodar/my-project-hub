export interface Vaccine {
  id: string;
  name: string;
  nameEn: string;
  ageLabel: string;
  ageDays: number; // age in days when due
  description: string;
  dose?: string;
}

export interface VaccineGroup {
  id: string;
  title: string;
  ageRange: string;
  vaccines: Vaccine[];
}

export interface VaccineNote {
  vaccineId: string;
  note: string;
}

export interface ReminderSettings {
  beforeDay: boolean;
  beforeWeek: boolean;
  beforeMonth: boolean;
}

export interface Child {
  id: string;
  name: string;
  gender: "male" | "female";
  birthDate: string; // ISO date
  completedVaccines: string[]; // vaccine IDs
  vaccineNotes: VaccineNote[];
  reminderSettings: ReminderSettings;
}

// Standard WHO childhood vaccination schedule
export const vaccineSchedule: VaccineGroup[] = [
  {
    id: "birth",
    title: "عند الولادة",
    ageRange: "0 يوم",
    vaccines: [
      {
        id: "bcg",
        name: "لقاح السل (BCG)",
        nameEn: "BCG",
        ageLabel: "عند الولادة",
        ageDays: 0,
        description: "الحماية من مرض السل",
      },
      {
        id: "hepb-0",
        name: "التهاب الكبد ب - الجرعة الأولى",
        nameEn: "Hepatitis B - Birth dose",
        ageLabel: "عند الولادة",
        ageDays: 0,
        description: "الجرعة الأولى للحماية من التهاب الكبد الوبائي ب",
      },
      {
        id: "opv-0",
        name: "شلل الأطفال الفموي - الجرعة الصفرية",
        nameEn: "OPV - Birth dose",
        ageLabel: "عند الولادة",
        ageDays: 0,
        description: "الجرعة الأولى للحماية من شلل الأطفال",
      },
    ],
  },
  {
    id: "6weeks",
    title: "6 أسابيع (شهر ونصف)",
    ageRange: "42 يوم",
    vaccines: [
      {
        id: "dtap-1",
        name: "الثلاثي البكتيري - الجرعة الأولى",
        nameEn: "DTaP - 1st dose",
        ageLabel: "6 أسابيع",
        ageDays: 42,
        description: "الحماية من الدفتيريا والتيتانوس والسعال الديكي",
        dose: "الجرعة 1",
      },
      {
        id: "ipv-1",
        name: "شلل الأطفال المعطّل - الجرعة الأولى",
        nameEn: "IPV - 1st dose",
        ageLabel: "6 أسابيع",
        ageDays: 42,
        description: "الحماية من شلل الأطفال",
        dose: "الجرعة 1",
      },
      {
        id: "hib-1",
        name: "المستدمية النزلية ب - الجرعة الأولى",
        nameEn: "Hib - 1st dose",
        ageLabel: "6 أسابيع",
        ageDays: 42,
        description: "الحماية من بكتيريا المستدمية النزلية",
        dose: "الجرعة 1",
      },
      {
        id: "hepb-1",
        name: "التهاب الكبد ب - الجرعة الثانية",
        nameEn: "Hepatitis B - 2nd dose",
        ageLabel: "6 أسابيع",
        ageDays: 42,
        description: "الجرعة الثانية للحماية من التهاب الكبد الوبائي ب",
        dose: "الجرعة 2",
      },
      {
        id: "pcv-1",
        name: "المكورات الرئوية - الجرعة الأولى",
        nameEn: "PCV - 1st dose",
        ageLabel: "6 أسابيع",
        ageDays: 42,
        description: "الحماية من التهابات المكورات الرئوية",
        dose: "الجرعة 1",
      },
      {
        id: "rota-1",
        name: "الفيروس العجلي (الروتا) - الجرعة الأولى",
        nameEn: "Rotavirus - 1st dose",
        ageLabel: "6 أسابيع",
        ageDays: 42,
        description: "الحماية من الإسهال الشديد",
        dose: "الجرعة 1",
      },
    ],
  },
  {
    id: "10weeks",
    title: "10 أسابيع (شهرين ونصف)",
    ageRange: "70 يوم",
    vaccines: [
      {
        id: "dtap-2",
        name: "الثلاثي البكتيري - الجرعة الثانية",
        nameEn: "DTaP - 2nd dose",
        ageLabel: "10 أسابيع",
        ageDays: 70,
        description: "الحماية من الدفتيريا والتيتانوس والسعال الديكي",
        dose: "الجرعة 2",
      },
      {
        id: "ipv-2",
        name: "شلل الأطفال المعطّل - الجرعة الثانية",
        nameEn: "IPV - 2nd dose",
        ageLabel: "10 أسابيع",
        ageDays: 70,
        description: "الحماية من شلل الأطفال",
        dose: "الجرعة 2",
      },
      {
        id: "hib-2",
        name: "المستدمية النزلية ب - الجرعة الثانية",
        nameEn: "Hib - 2nd dose",
        ageLabel: "10 أسابيع",
        ageDays: 70,
        description: "الحماية من بكتيريا المستدمية النزلية",
        dose: "الجرعة 2",
      },
      {
        id: "pcv-2",
        name: "المكورات الرئوية - الجرعة الثانية",
        nameEn: "PCV - 2nd dose",
        ageLabel: "10 أسابيع",
        ageDays: 70,
        description: "الحماية من التهابات المكورات الرئوية",
        dose: "الجرعة 2",
      },
      {
        id: "rota-2",
        name: "الفيروس العجلي (الروتا) - الجرعة الثانية",
        nameEn: "Rotavirus - 2nd dose",
        ageLabel: "10 أسابيع",
        ageDays: 70,
        description: "الحماية من الإسهال الشديد",
        dose: "الجرعة 2",
      },
    ],
  },
  {
    id: "14weeks",
    title: "14 أسبوع (3 أشهر ونصف)",
    ageRange: "98 يوم",
    vaccines: [
      {
        id: "dtap-3",
        name: "الثلاثي البكتيري - الجرعة الثالثة",
        nameEn: "DTaP - 3rd dose",
        ageLabel: "14 أسبوع",
        ageDays: 98,
        description: "الحماية من الدفتيريا والتيتانوس والسعال الديكي",
        dose: "الجرعة 3",
      },
      {
        id: "ipv-3",
        name: "شلل الأطفال المعطّل - الجرعة الثالثة",
        nameEn: "IPV - 3rd dose",
        ageLabel: "14 أسبوع",
        ageDays: 98,
        description: "الحماية من شلل الأطفال",
        dose: "الجرعة 3",
      },
      {
        id: "hib-3",
        name: "المستدمية النزلية ب - الجرعة الثالثة",
        nameEn: "Hib - 3rd dose",
        ageLabel: "14 أسبوع",
        ageDays: 98,
        description: "الحماية من بكتيريا المستدمية النزلية",
        dose: "الجرعة 3",
      },
      {
        id: "hepb-2",
        name: "التهاب الكبد ب - الجرعة الثالثة",
        nameEn: "Hepatitis B - 3rd dose",
        ageLabel: "14 أسبوع",
        ageDays: 98,
        description: "الجرعة الثالثة للحماية من التهاب الكبد الوبائي ب",
        dose: "الجرعة 3",
      },
      {
        id: "pcv-3",
        name: "المكورات الرئوية - الجرعة الثالثة",
        nameEn: "PCV - 3rd dose",
        ageLabel: "14 أسبوع",
        ageDays: 98,
        description: "الحماية من التهابات المكورات الرئوية",
        dose: "الجرعة 3",
      },
    ],
  },
  {
    id: "9months",
    title: "9 أشهر",
    ageRange: "270 يوم",
    vaccines: [
      {
        id: "measles-1",
        name: "الحصبة - الجرعة الأولى",
        nameEn: "Measles - 1st dose",
        ageLabel: "9 أشهر",
        ageDays: 270,
        description: "الحماية من مرض الحصبة",
        dose: "الجرعة 1",
      },
      {
        id: "opv-1",
        name: "شلل الأطفال الفموي - الجرعة الأولى",
        nameEn: "OPV - 1st dose",
        ageLabel: "9 أشهر",
        ageDays: 270,
        description: "جرعة تنشيطية لشلل الأطفال",
        dose: "الجرعة 1",
      },
    ],
  },
  {
    id: "12months",
    title: "12 شهر (سنة)",
    ageRange: "365 يوم",
    vaccines: [
      {
        id: "mmr-1",
        name: "الثلاثي الفيروسي (MMR) - الجرعة الأولى",
        nameEn: "MMR - 1st dose",
        ageLabel: "12 شهر",
        ageDays: 365,
        description: "الحماية من الحصبة والنكاف والحصبة الألمانية",
        dose: "الجرعة 1",
      },
      {
        id: "varicella-1",
        name: "الجديري المائي - الجرعة الأولى",
        nameEn: "Varicella - 1st dose",
        ageLabel: "12 شهر",
        ageDays: 365,
        description: "الحماية من مرض الجديري المائي",
        dose: "الجرعة 1",
      },
      {
        id: "hepa-1",
        name: "التهاب الكبد أ - الجرعة الأولى",
        nameEn: "Hepatitis A - 1st dose",
        ageLabel: "12 شهر",
        ageDays: 365,
        description: "الحماية من التهاب الكبد الوبائي أ",
        dose: "الجرعة 1",
      },
    ],
  },
  {
    id: "18months",
    title: "18 شهر (سنة ونصف)",
    ageRange: "540 يوم",
    vaccines: [
      {
        id: "dtap-booster1",
        name: "الثلاثي البكتيري - جرعة تنشيطية",
        nameEn: "DTaP - Booster",
        ageLabel: "18 شهر",
        ageDays: 540,
        description: "جرعة تنشيطية للدفتيريا والتيتانوس والسعال الديكي",
        dose: "تنشيطية 1",
      },
      {
        id: "opv-booster1",
        name: "شلل الأطفال - جرعة تنشيطية",
        nameEn: "OPV - Booster",
        ageLabel: "18 شهر",
        ageDays: 540,
        description: "جرعة تنشيطية لشلل الأطفال",
        dose: "تنشيطية",
      },
      {
        id: "hepa-2",
        name: "التهاب الكبد أ - الجرعة الثانية",
        nameEn: "Hepatitis A - 2nd dose",
        ageLabel: "18 شهر",
        ageDays: 540,
        description: "الجرعة الثانية للحماية من التهاب الكبد الوبائي أ",
        dose: "الجرعة 2",
      },
    ],
  },
  {
    id: "4-6years",
    title: "4 - 6 سنوات",
    ageRange: "1460 يوم",
    vaccines: [
      {
        id: "dtap-booster2",
        name: "الثلاثي البكتيري - الجرعة التنشيطية الثانية",
        nameEn: "DTaP - 2nd Booster",
        ageLabel: "4-6 سنوات",
        ageDays: 1460,
        description: "جرعة تنشيطية قبل دخول المدرسة",
        dose: "تنشيطية 2",
      },
      {
        id: "opv-booster2",
        name: "شلل الأطفال - الجرعة التنشيطية الثانية",
        nameEn: "OPV - 2nd Booster",
        ageLabel: "4-6 سنوات",
        ageDays: 1460,
        description: "جرعة تنشيطية لشلل الأطفال قبل المدرسة",
        dose: "تنشيطية 2",
      },
      {
        id: "mmr-2",
        name: "الثلاثي الفيروسي (MMR) - الجرعة الثانية",
        nameEn: "MMR - 2nd dose",
        ageLabel: "4-6 سنوات",
        ageDays: 1460,
        description: "الجرعة الثانية للحصبة والنكاف والحصبة الألمانية",
        dose: "الجرعة 2",
      },
      {
        id: "varicella-2",
        name: "الجديري المائي - الجرعة الثانية",
        nameEn: "Varicella - 2nd dose",
        ageLabel: "4-6 سنوات",
        ageDays: 1460,
        description: "الجرعة الثانية للجديري المائي",
        dose: "الجرعة 2",
      },
    ],
  },
];

export const getTotalVaccines = (): number => {
  return vaccineSchedule.reduce((sum, group) => sum + group.vaccines.length, 0);
};

export const getChildAge = (birthDate: string): string => {
  const birth = new Date(birthDate);
  const now = new Date();
  const diffMs = now.getTime() - birth.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 30) return `${diffDays} يوم`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? "شهر" : months <= 10 ? "أشهر" : "شهر"}`;
  }
  const years = Math.floor(diffDays / 365);
  const remainingMonths = Math.floor((diffDays % 365) / 30);
  if (remainingMonths === 0) return `${years} ${years === 1 ? "سنة" : years === 2 ? "سنتين" : "سنوات"}`;
  return `${years} ${years === 1 ? "سنة" : years === 2 ? "سنتين" : "سنوات"} و ${remainingMonths} ${remainingMonths === 1 ? "شهر" : "أشهر"}`;
};

export const getNextDueVaccines = (birthDate: string, completedVaccines: string[]): string[] => {
  const birth = new Date(birthDate);
  const now = new Date();
  const ageDays = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));

  const due: string[] = [];
  for (const group of vaccineSchedule) {
    for (const vaccine of group.vaccines) {
      if (!completedVaccines.includes(vaccine.id) && ageDays >= vaccine.ageDays) {
        due.push(vaccine.id);
      }
    }
  }
  return due;
};
