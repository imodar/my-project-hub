import { Bell, Cloud, Sun, CloudRain, CloudSun, MapPin, Moon, Wind, Snowflake, Play } from "lucide-react";
import QiblaCompass from "./QiblaCompass";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useIslamicMode } from "@/contexts/IslamicModeContext";
import ProfileSheet from "./ProfileSheet";
import NotificationsSheet from "@/components/notifications/NotificationsSheet";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";

import NextPrayerBox from "./NextPrayerBox";

interface WeatherData {
  temp: number;
  description: string;
  city: string;
  icon: string;
  weatherCode: number;
  lastUpdated: Date;
}

const getGreeting = (hour: number) => {
  if (hour >= 5 && hour < 12) return "صباح الخير";
  if (hour >= 12 && hour < 17) return "مساء النور";
  if (hour >= 17 && hour < 21) return "مساء الخير";
  return "تصبح على خير";
};

const isNightTime = (hour: number) => hour >= 19 || hour < 5;

type WeatherTheme = {
  gradient: string;
  decorationIcon: React.ReactNode;
  glowColor: string;
  orbBg: string;
  label: string;
  particles?: React.ReactNode;
};

const DEMO_STATES: { code: number; hour: number; label: string; temp: number; description: string; icon: string; city: string }[] = [
  { code: 0, hour: 10, label: "☀️ صافي - نهار", temp: 34, description: "صافي", icon: "clear", city: "الرياض" },
  { code: 0, hour: 22, label: "🌙 صافي - ليل", temp: 22, description: "صافي", icon: "clear", city: "الرياض" },
  { code: 2, hour: 14, label: "⛅ غائم جزئياً", temp: 28, description: "غائم جزئياً", icon: "cloudsun", city: "جدة" },
  { code: 3, hour: 15, label: "☁️ غائم", temp: 24, description: "غائم", icon: "cloud", city: "أبها" },
  { code: 45, hour: 12, label: "🌫️ ضبابي", temp: 19, description: "ضبابي", icon: "fog", city: "الطائف" },
  { code: 61, hour: 16, label: "🌧️ ممطر", temp: 16, description: "ممطر", icon: "rain", city: "تبوك" },
  { code: 71, hour: 11, label: "❄️ ثلوج", temp: -2, description: "ثلوج", icon: "snow", city: "طريف" },
];

const getWeatherTheme = (weatherCode: number | null, hour: number): WeatherTheme => {
  const night = isNightTime(hour);

  if (weatherCode === null) {
    if (night) {
      return {
        gradient: "linear-gradient(135deg, hsl(230 40% 18%), hsl(250 35% 25%))",
        decorationIcon: <Moon size={28} className="text-yellow-100" />,
        glowColor: "rgba(200,200,255,0.25)",
        orbBg: "linear-gradient(135deg, hsl(230 40% 25%), hsl(250 35% 35%))",
        label: "ليل",
      };
    }
    return {
      gradient: "linear-gradient(135deg, hsl(205 80% 60%), hsl(185 90% 55%))",
      decorationIcon: <Sun size={28} className="text-yellow-200" />,
      glowColor: "rgba(255,245,158,0.4)",
      orbBg: "linear-gradient(135deg, hsl(48 100% 65%), hsl(30 100% 55%))",
      label: "نهار",
    };
  }

  if (weatherCode >= 71 && weatherCode <= 77) {
    return {
      gradient: night
        ? "linear-gradient(135deg, hsl(210 25% 22%), hsl(220 30% 32%))"
        : "linear-gradient(135deg, hsl(210 30% 75%), hsl(200 25% 85%))",
      decorationIcon: <Snowflake size={28} className="text-blue-100 animate-pulse" />,
      glowColor: "rgba(200,220,255,0.3)",
      orbBg: "linear-gradient(135deg, hsl(210 40% 80%), hsl(200 30% 90%))",
      label: "ثلوج",
      particles: (
        <>
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={`snow-${i}`}
              className="absolute rounded-full bg-white/30"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: [0, 0.6, 0], y: [0, 60] }}
              transition={{ duration: 2 + Math.random(), repeat: Infinity, delay: i * 0.3 }}
              style={{
                width: 4 + Math.random() * 4,
                height: 4 + Math.random() * 4,
                left: `${10 + Math.random() * 80}%`,
                top: `${5 + Math.random() * 30}%`,
              }}
            />
          ))}
        </>
      ),
    };
  }

  if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82) || weatherCode >= 95) {
    return {
      gradient: night
        ? "linear-gradient(135deg, hsl(215 35% 15%), hsl(220 40% 22%))"
        : "linear-gradient(135deg, hsl(215 50% 45%), hsl(210 45% 55%))",
      decorationIcon: <CloudRain size={28} className="text-blue-200" />,
      glowColor: "rgba(100,150,220,0.25)",
      orbBg: "linear-gradient(135deg, hsl(215 40% 50%), hsl(220 35% 60%))",
      label: "ممطر",
      particles: (
        <>
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={`rain-${i}`}
              className="absolute w-[2px] bg-white/25 rounded-full"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: [0, 0.5, 0], y: [0, 50] }}
              transition={{ duration: 0.7 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.12 }}
              style={{
                height: 10 + Math.random() * 10,
                left: `${5 + Math.random() * 90}%`,
                top: `${Math.random() * 40}%`,
                transform: "rotate(15deg)",
              }}
            />
          ))}
        </>
      ),
    };
  }

  if (weatherCode >= 45 && weatherCode <= 48) {
    return {
      gradient: night
        ? "linear-gradient(135deg, hsl(35 30% 18%), hsl(30 25% 25%))"
        : "linear-gradient(135deg, hsl(40 45% 65%), hsl(35 40% 55%))",
      decorationIcon: <Wind size={28} className="text-amber-200/80" />,
      glowColor: "rgba(220,190,120,0.3)",
      orbBg: "linear-gradient(135deg, hsl(40 50% 60%), hsl(35 45% 50%))",
      label: "ضبابي",
    };
  }

  if (weatherCode === 3) {
    return {
      gradient: night
        ? "linear-gradient(135deg, hsl(220 25% 20%), hsl(215 30% 28%))"
        : "linear-gradient(135deg, hsl(210 30% 60%), hsl(215 25% 70%))",
      decorationIcon: <Cloud size={28} className="text-white/80" />,
      glowColor: "rgba(180,200,220,0.25)",
      orbBg: "linear-gradient(135deg, hsl(210 30% 65%), hsl(215 25% 75%))",
      label: "غائم",
    };
  }

  if (weatherCode >= 1 && weatherCode <= 2) {
    if (night) {
      return {
        gradient: "linear-gradient(135deg, hsl(225 35% 20%), hsl(235 30% 28%))",
        decorationIcon: <CloudSun size={28} className="text-white/70" />,
        glowColor: "rgba(180,190,220,0.2)",
        orbBg: "linear-gradient(135deg, hsl(225 35% 30%), hsl(235 30% 38%))",
        label: "غائم جزئياً",
      };
    }
    return {
      gradient: "linear-gradient(135deg, hsl(205 70% 58%), hsl(195 60% 62%))",
      decorationIcon: <CloudSun size={28} className="text-white/90" />,
      glowColor: "rgba(255,245,180,0.3)",
      orbBg: "linear-gradient(135deg, hsl(48 80% 60%), hsl(40 70% 55%))",
      label: "غائم جزئياً",
    };
  }

  if (night) {
    return {
      gradient: "linear-gradient(135deg, hsl(230 45% 15%), hsl(250 40% 22%))",
      decorationIcon: <Moon size={28} className="text-yellow-100" />,
      glowColor: "rgba(255,255,200,0.3)",
      orbBg: "linear-gradient(135deg, hsl(230 40% 25%), hsl(250 35% 35%))",
      label: "صافي ليلاً",
      particles: (
        <>
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={`star-${i}`}
              className="absolute rounded-full bg-white/50"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 2 + Math.random(), repeat: Infinity, delay: i * 0.4 }}
              style={{
                width: 2,
                height: 2,
                top: `${15 + Math.random() * 50}%`,
                left: `${10 + Math.random() * 80}%`,
              }}
            />
          ))}
        </>
      ),
    };
  }
  return {
    gradient: "linear-gradient(135deg, hsl(205 80% 60%), hsl(185 90% 55%))",
    decorationIcon: <Sun size={28} className="text-yellow-200" />,
    glowColor: "rgba(255,245,158,0.5)",
    orbBg: "linear-gradient(135deg, hsl(48 100% 65%), hsl(30 100% 55%))",
    label: "صافي",
  };
};

const WeatherIcon = ({ icon }: { icon: string }) => {
  if (icon.includes("rain")) return <CloudRain size={16} className="text-blue-200" />;
  if (icon.includes("snow")) return <Snowflake size={16} className="text-blue-100" />;
  if (icon.includes("fog")) return <Wind size={16} className="text-amber-200" />;
  if (icon.includes("cloud")) return <Cloud size={16} className="text-white/80" />;
  if (icon.includes("sun") || icon.includes("clear")) return <Sun size={16} className="text-yellow-200" />;
  return <CloudSun size={16} className="text-white/80" />;
};

const formatLastUpdated = (date: Date): string => {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
};

const HeroSection = () => {
  const { islamicMode } = useIslamicMode();
  const { profileName } = useAuth();
  const { unreadCount } = useNotifications();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const hijriDate = "٤ شوّال ١٤٤٧";
  const gregorianDate = "٢٣ مارس ٢٠٢٦";

  const currentUser = { name: profileName, role: "parent" as const };

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [currentHour] = useState(() => new Date().getHours());
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const greeting = useMemo(() => getGreeting(currentHour), [currentHour]);

  const [demoActive, setDemoActive] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);

  const activeCode = demoActive ? DEMO_STATES[demoIndex].code : (weather?.weatherCode ?? null);
  const activeHour = demoActive ? DEMO_STATES[demoIndex].hour : currentHour;
  const theme = useMemo(() => getWeatherTheme(activeCode, activeHour), [activeCode, activeHour]);

  useEffect(() => {
    if (!demoActive) return;
    const timer = setInterval(() => {
      setDemoIndex((prev) => {
        if (prev >= DEMO_STATES.length - 1) {
          setDemoActive(false);
          return 0;
        }
        return prev + 1;
      });
    }, 2500);
    return () => clearInterval(timer);
  }, [demoActive]);

  const startDemo = useCallback(() => {
    setDemoIndex(0);
    setDemoActive(true);
  }, []);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        setHasLocationPermission(true);
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
          );
          const data = await res.json();

          let cityName = "موقعك";
          try {
            const reverseRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ar`
            );
            const reverseData = await reverseRes.json();
            cityName = reverseData.address?.city || reverseData.address?.town || reverseData.address?.suburb || reverseData.address?.state || "موقعك";
          } catch {}

          const weatherCode = data.current?.weather_code || 0;
          let description = "صافي";
          let icon = "clear";
          if (weatherCode >= 71) { description = "ثلوج"; icon = "snow"; }
          else if (weatherCode >= 61) { description = "ممطر"; icon = "rain"; }
          else if (weatherCode >= 51) { description = "رذاذ"; icon = "rain"; }
          else if (weatherCode >= 45) { description = "ضبابي"; icon = "fog"; }
          else if (weatherCode === 3) { description = "غائم"; icon = "cloud"; }
          else if (weatherCode >= 1) { description = "غائم جزئياً"; icon = "cloudsun"; }

          setWeather({
            temp: Math.round(data.current?.temperature_2m || 0),
            description,
            city: cityName,
            icon,
            weatherCode,
            lastUpdated: new Date(),
          });
        } catch (e) {
          console.error("Weather fetch failed:", e);
        }
      },
      () => {
        setHasLocationPermission(false);
      }
    );
  }, []);

  // Current display data
  const displayTemp = demoActive ? DEMO_STATES[demoIndex].temp : weather?.temp;
  const displayCity = demoActive ? DEMO_STATES[demoIndex].city : weather?.city;
  const displayIcon = demoActive ? DEMO_STATES[demoIndex].icon : weather?.icon;
  const displayDesc = demoActive ? DEMO_STATES[demoIndex].description : weather?.description;
  const showWeatherInfo = demoActive || (weather && hasLocationPermission);

  return (
    <>
      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-40 px-5 pt-4 pb-2 flex justify-between items-center bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setProfileOpen(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary/30"
            style={{ background: "hsl(var(--primary) / 0.1)" }}
          >
            <span className="text-sm font-bold text-primary">{currentUser.name.charAt(0)}</span>
          </button>
          <span className="text-xl font-bold text-primary tracking-tight">عائلتنا</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startDemo}
            disabled={demoActive}
            className="p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
            title="محاكاة حالات الطقس"
          >
            <Play size={18} />
          </button>
          <button
            onClick={() => setNotificationsOpen(true)}
            className="relative p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors"
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Hero Card */}
      <section className="px-5 pt-8 relative overflow-visible">
        {/* Temperature Orb */}
        <motion.div
          className="absolute top-0 left-2 w-16 h-16 z-10 pointer-events-none"
          key={theme.label}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <div className="absolute inset-0 rounded-full animate-pulse" style={{
            filter: "blur(12px)",
            background: `radial-gradient(circle, ${theme.glowColor} 0%, transparent 70%)`
          }} />
          <div className="relative w-full h-full rounded-full shadow-lg flex items-center justify-center"
            style={{
              background: theme.orbBg,
              border: "2px solid hsla(0,0%,100%,0.25)"
            }}
          >
            <AnimatePresence mode="wait">
              {showWeatherInfo && displayTemp !== undefined ? (
                <motion.span
                  key={`temp-${displayTemp}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-white font-bold text-lg"
                >
                  {displayTemp}°
                </motion.span>
              ) : (
                <motion.div
                  key={theme.label}
                  initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.4 }}
                >
                  {theme.decorationIcon}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Main Card */}
        <motion.div
          className="rounded-2xl p-5 relative overflow-hidden text-white shadow-xl"
          animate={{ background: theme.gradient }}
          transition={{ duration: 1, ease: "easeInOut" }}
          style={{ background: theme.gradient }}
        >
          {/* Animated particles */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`particles-${theme.label}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 z-0"
            >
              {theme.particles}
            </motion.div>
          </AnimatePresence>

          {/* Cloud decorations */}
          {(!weather || (weather && weather.weatherCode <= 3)) && !demoActive && (
            <>
              <div className="absolute top-3 right-10 opacity-20">
                <Cloud size={52} />
              </div>
              <div className="absolute bottom-3 left-16 opacity-15">
                <Cloud size={36} />
              </div>
            </>
          )}

          <div className="relative z-20 space-y-3">
            {/* Greeting */}
            <div>
              <h1 className="text-xl font-bold tracking-tight mb-1">
                {greeting}{currentUser.name ? `، ${currentUser.name}` : ""}
              </h1>
              <p className="text-white/75 font-medium text-xs whitespace-nowrap">
                {gregorianDate} {islamicMode && `• ${hijriDate}`}
              </p>
            </div>

            {/* Location + Weather row */}
            {showWeatherInfo && displayCity && displayIcon && displayDesc && (
              <motion.div
                key={`weather-row-${demoActive ? demoIndex : 'real'}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-1.5 text-white/70 text-xs"
              >
                <MapPin size={12} className="shrink-0" />
                <span className="font-medium">{displayCity}</span>
                <span className="text-white/30">•</span>
                <WeatherIcon icon={displayIcon} />
                <span>{displayDesc}</span>
              </motion.div>
            )}

            {/* Last updated */}
            {!demoActive && weather?.lastUpdated && (
              <p className="text-[10px] text-white/35">
                آخر تحديث {formatLastUpdated(weather.lastUpdated)}
              </p>
            )}

            {islamicMode && (
              <div className="grid grid-cols-2 gap-3 items-center">
                <QiblaCompass />
                <NextPrayerBox />
              </div>
            )}
          </div>
        </motion.div>
      </section>

      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} user={currentUser} />
      <NotificationsSheet open={notificationsOpen} onOpenChange={setNotificationsOpen} />
    </>
  );
};

export default HeroSection;
