import { useState, useEffect } from "react";

interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

interface NextPrayerInfo {
  name: string;
  time: string;
  remaining: string;
}

const PRAYER_NAMES: Record<string, string> = {
  Fajr: "الفجر",
  Sunrise: "الشروق",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};

const PRAYER_ORDER = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

const parseTime = (timeStr: string): Date => {
  const [time] = timeStr.split(" ");
  const [h, m] = time.split(":").map(Number);
  const now = new Date();
  now.setHours(h, m, 0, 0);
  return now;
};

const getRemaining = (target: Date): string => {
  const now = new Date();
  let diff = target.getTime() - now.getTime();
  if (diff < 0) diff += 24 * 60 * 60 * 1000;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours} س ${mins} د`;
  return `${mins} دقيقة`;
};

const getNextPrayer = (times: PrayerTimes): NextPrayerInfo => {
  const now = new Date();
  for (const key of PRAYER_ORDER) {
    const prayerTime = parseTime(times[key as keyof PrayerTimes]);
    if (prayerTime > now) {
      return {
        name: PRAYER_NAMES[key],
        time: times[key as keyof PrayerTimes].split(" ")[0],
        remaining: getRemaining(prayerTime),
      };
    }
  }
  // All prayers passed, next is Fajr tomorrow
  const fajrTomorrow = parseTime(times.Fajr);
  fajrTomorrow.setDate(fajrTomorrow.getDate() + 1);
  return {
    name: PRAYER_NAMES.Fajr,
    time: times.Fajr.split(" ")[0],
    remaining: getRemaining(fajrTomorrow),
  };
};

// Mosque/prayer icon as SVG
const PrayerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
    {/* Dome */}
    <path d="M12 3C9 3 6 6 6 9h12c0-3-3-6-6-6z" fill="white" fillOpacity="0.2" />
    {/* Minaret left */}
    <rect x="3" y="7" width="2" height="11" rx="0.5" fill="white" fillOpacity="0.3" />
    <circle cx="4" cy="6" r="1" fill="white" fillOpacity="0.4" />
    {/* Minaret right */}
    <rect x="19" y="7" width="2" height="11" rx="0.5" fill="white" fillOpacity="0.3" />
    <circle cx="20" cy="6" r="1" fill="white" fillOpacity="0.4" />
    {/* Building */}
    <rect x="6" y="9" width="12" height="9" fill="white" fillOpacity="0.15" />
    {/* Door */}
    <path d="M10 18h4v-4a2 2 0 0 0-4 0v4z" fill="white" fillOpacity="0.25" />
    {/* Base */}
    <line x1="2" y1="18" x2="22" y2="18" />
  </svg>
);

export const usePrayerTimes = () => {
  const [nextPrayer, setNextPrayer] = useState<NextPrayerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrayers = async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject)
        );
        const { latitude, longitude } = pos.coords;
        const res = await fetch(
          `https://api.aladhan.com/v1/timings?latitude=${latitude}&longitude=${longitude}&method=4`
        );
        const data = await res.json();
        if (data.code === 200) {
          const times: PrayerTimes = {
            Fajr: data.data.timings.Fajr,
            Sunrise: data.data.timings.Sunrise,
            Dhuhr: data.data.timings.Dhuhr,
            Asr: data.data.timings.Asr,
            Maghrib: data.data.timings.Maghrib,
            Isha: data.data.timings.Isha,
          };
          setNextPrayer(getNextPrayer(times));
        }
      } catch (e) {
        console.error("Prayer times fetch failed:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchPrayers();

    // Update remaining time every minute
    const interval = setInterval(() => {
      // Re-trigger to update remaining
      fetchPrayers();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return { nextPrayer, loading };
};

const NextPrayerBox = () => {
  const { nextPrayer, loading } = usePrayerTimes();

  if (loading || !nextPrayer) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex items-center gap-3 border border-white/10">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
          <PrayerIcon />
        </div>
        <div className="space-y-1">
          <div className="w-12 h-3 bg-white/20 rounded animate-pulse" />
          <div className="w-16 h-4 bg-white/20 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex items-center gap-3 border border-white/10">
      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
        <PrayerIcon />
      </div>
      <div>
        <p className="text-base font-bold">{nextPrayer.name}</p>
        <p className="text-[10px] font-semibold text-white/60">{nextPrayer.remaining}</p>
      </div>
    </div>
  );
};

export default NextPrayerBox;
