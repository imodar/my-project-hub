import React, { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

interface NextPrayerInfo {
  nameKey: string;
  name: string;
  time: string;
  remaining: string;
}

const PRAYER_ORDER = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

const parseTime = (timeStr: string): Date => {
  const [time] = timeStr.split(" ");
  const [h, m] = time.split(":").map(Number);
  const now = new Date();
  now.setHours(h, m, 0, 0);
  return now;
};

const getRemaining = (target: Date, lang: string): string => {
  const now = new Date();
  let diff = target.getTime() - now.getTime();
  if (diff < 0) diff += 24 * 60 * 60 * 1000;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (lang === "en") {
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins} min`;
  }
  if (hours > 0) return `${hours} س ${mins} د`;
  return `${mins} دقيقة`;
};

const getNextPrayer = (times: PrayerTimes, prayerNames: Record<string, string>, lang: string): NextPrayerInfo => {
  const now = new Date();
  for (const key of PRAYER_ORDER) {
    const prayerTime = parseTime(times[key as keyof PrayerTimes]);
    if (prayerTime > now) {
      return {
        nameKey: key,
        name: prayerNames[key] || key,
        time: times[key as keyof PrayerTimes].split(" ")[0],
        remaining: getRemaining(prayerTime, lang),
      };
    }
  }
  const fajrTomorrow = parseTime(times.Fajr);
  fajrTomorrow.setDate(fajrTomorrow.getDate() + 1);
  return {
    nameKey: "Fajr",
    name: prayerNames.Fajr || "Fajr",
    time: times.Fajr.split(" ")[0],
    remaining: getRemaining(fajrTomorrow, lang),
  };
};

const PrayerIcon = React.forwardRef<SVGSVGElement>((_, ref) => (
  <svg ref={ref} width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white">
    <path d="M12 3C9 3 6 6 6 9h12c0-3-3-6-6-6z" fill="currentColor" fillOpacity="0.5" />
    <rect x="3" y="7" width="2" height="11" rx="0.5" fill="currentColor" fillOpacity="0.4" />
    <circle cx="4" cy="6" r="1" fill="currentColor" fillOpacity="0.6" />
    <rect x="19" y="7" width="2" height="11" rx="0.5" fill="currentColor" fillOpacity="0.4" />
    <circle cx="20" cy="6" r="1" fill="currentColor" fillOpacity="0.6" />
    <rect x="6" y="9" width="12" height="9" fill="currentColor" fillOpacity="0.25" />
    <path d="M10 18h4v-4a2 2 0 0 0-4 0v4z" fill="currentColor" fillOpacity="0.4" />
    <line x1="2" y1="18" x2="22" y2="18" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
  </svg>
));
PrayerIcon.displayName = "PrayerIcon";

const CACHE_KEY = "prayer_times_cache";

const getCachedTimes = (): PrayerTimes | null => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    const cachedDate = new Date(cached._cachedAt);
    const now = new Date();
    if (cachedDate.toDateString() !== now.toDateString()) return null;
    return cached as PrayerTimes;
  } catch { return null; }
};

const setCachedTimes = (times: PrayerTimes) => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...times, _cachedAt: new Date().toISOString() }));
  } catch {}
};

export const usePrayerTimes = () => {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(getCachedTimes);
  const [nextPrayer, setNextPrayer] = useState<NextPrayerInfo | null>(null);
  const [loading, setLoading] = useState(!getCachedTimes());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { t, language } = useLanguage();

  useEffect(() => {
    const cached = getCachedTimes();
    if (cached) {
      setPrayerTimes(cached);
      setLoading(false);
      return;
    }

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
          setCachedTimes(times);
          setPrayerTimes(times);
          setLastUpdated(new Date());
        }
      } catch (e) {
        console.error("Prayer times fetch failed:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchPrayers();
  }, []);

  useEffect(() => {
    if (!prayerTimes) return;
    const update = () => setNextPrayer(getNextPrayer(prayerTimes, t.prayerNames, language));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [prayerTimes, t, language]);

  return { nextPrayer, loading, lastUpdated };
};

const NextPrayerBox = React.forwardRef<HTMLDivElement>((_props, ref) => {
  const { nextPrayer, loading } = usePrayerTimes();
  const { t } = useLanguage();

  if (loading || !nextPrayer) {
    return (
      <div ref={ref} className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
            <PrayerIcon />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="w-24 h-3 bg-white/20 rounded animate-pulse" />
            <div className="w-16 h-4 bg-white/20 rounded animate-pulse" />
            <div className="w-20 h-3 bg-white/20 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="bg-white/10 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/10 h-full flex items-center">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
          <PrayerIcon />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold text-white/70">{t.islamic.prayerRemaining} {nextPrayer.name}</p>
          <p className="text-sm font-bold leading-tight">{nextPrayer.remaining}</p>
          <p className="text-[10px] text-white/50">{t.islamic.adhan} {nextPrayer.time}</p>
        </div>
      </div>
    </div>
  );
});

NextPrayerBox.displayName = "NextPrayerBox";

export default NextPrayerBox;
