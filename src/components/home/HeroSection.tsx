import { Bell, Compass, Cloud, Sun, CloudRain, CloudSun, MapPin, Moon, CloudSnow, Wind, CloudDrizzle, Snowflake } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useIslamicMode } from "@/contexts/IslamicModeContext";
import ProfileSheet from "./ProfileSheet";

interface WeatherData {
  temp: number;
  description: string;
  city: string;
  icon: string;
  weatherCode: number;
}

const getGreeting = (hour: number) => {
  if (hour >= 5 && hour < 12) return "صباح الخير";
  if (hour >= 12 && hour < 17) return "مساء النور";
  if (hour >= 17 && hour < 21) return "مساء الخير";
  return "مساء الخير";
};

const isNightTime = (hour: number) => hour >= 19 || hour < 5;

type WeatherTheme = {
  gradient: string;
  decorationIcon: React.ReactNode;
  glowColor: string;
  particles?: React.ReactNode;
};

const getWeatherTheme = (weatherCode: number | null, hour: number): WeatherTheme => {
  const night = isNightTime(hour);

  // No weather data — just day/night
  if (weatherCode === null) {
    if (night) {
      return {
        gradient: "linear-gradient(135deg, hsl(230 40% 18%), hsl(250 35% 25%))",
        decorationIcon: <Moon size={28} className="text-yellow-100" />,
        glowColor: "rgba(200,200,255,0.25)",
      };
    }
    return {
      gradient: "linear-gradient(135deg, hsl(205 80% 60%), hsl(185 90% 55%))",
      decorationIcon: <Sun size={28} className="text-yellow-200" />,
      glowColor: "rgba(255,245,158,0.4)",
    };
  }

  // Snow (71-77)
  if (weatherCode >= 71 && weatherCode <= 77) {
    return {
      gradient: night
        ? "linear-gradient(135deg, hsl(210 25% 22%), hsl(220 30% 32%))"
        : "linear-gradient(135deg, hsl(210 30% 75%), hsl(200 25% 85%))",
      decorationIcon: <Snowflake size={28} className="text-blue-100 animate-pulse" />,
      glowColor: "rgba(200,220,255,0.3)",
      particles: (
        <>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white/30 animate-bounce" style={{
              width: 4 + Math.random() * 4,
              height: 4 + Math.random() * 4,
              top: `${10 + Math.random() * 70}%`,
              left: `${10 + Math.random() * 80}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${1.5 + Math.random()}s`,
            }} />
          ))}
        </>
      ),
    };
  }

  // Rain (51-67, 80-82, 95-99)
  if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82) || weatherCode >= 95) {
    return {
      gradient: night
        ? "linear-gradient(135deg, hsl(215 35% 15%), hsl(220 40% 22%))"
        : "linear-gradient(135deg, hsl(215 50% 45%), hsl(210 45% 55%))",
      decorationIcon: <CloudRain size={28} className="text-blue-200" />,
      glowColor: "rgba(100,150,220,0.25)",
      particles: (
        <>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="absolute w-[2px] bg-white/20 rounded-full" style={{
              height: 8 + Math.random() * 12,
              top: `${Math.random() * 60}%`,
              left: `${5 + Math.random() * 90}%`,
              transform: "rotate(15deg)",
              animation: `rainDrop ${0.6 + Math.random() * 0.4}s linear infinite`,
              animationDelay: `${i * 0.15}s`,
            }} />
          ))}
        </>
      ),
    };
  }

  // Foggy / Sandstorm (45-48)
  if (weatherCode >= 45 && weatherCode <= 48) {
    return {
      gradient: night
        ? "linear-gradient(135deg, hsl(35 30% 18%), hsl(30 25% 25%))"
        : "linear-gradient(135deg, hsl(40 45% 65%), hsl(35 40% 55%))",
      decorationIcon: <Wind size={28} className="text-amber-200/80" />,
      glowColor: "rgba(220,190,120,0.3)",
    };
  }

  // Overcast (3)
  if (weatherCode === 3) {
    return {
      gradient: night
        ? "linear-gradient(135deg, hsl(220 25% 20%), hsl(215 30% 28%))"
        : "linear-gradient(135deg, hsl(210 30% 60%), hsl(215 25% 70%))",
      decorationIcon: <Cloud size={28} className="text-white/80" />,
      glowColor: "rgba(180,200,220,0.25)",
    };
  }

  // Partly cloudy (1-2)
  if (weatherCode >= 1 && weatherCode <= 2) {
    if (night) {
      return {
        gradient: "linear-gradient(135deg, hsl(225 35% 20%), hsl(235 30% 28%))",
        decorationIcon: <CloudSun size={28} className="text-white/70" />,
        glowColor: "rgba(180,190,220,0.2)",
      };
    }
    return {
      gradient: "linear-gradient(135deg, hsl(205 70% 58%), hsl(195 60% 62%))",
      decorationIcon: <CloudSun size={28} className="text-white/90" />,
      glowColor: "rgba(255,245,180,0.3)",
    };
  }

  // Clear (0)
  if (night) {
    return {
      gradient: "linear-gradient(135deg, hsl(230 45% 15%), hsl(250 40% 22%))",
      decorationIcon: <Moon size={28} className="text-yellow-100" />,
      glowColor: "rgba(255,255,200,0.3)",
      particles: (
        <>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white/40" style={{
              width: 2,
              height: 2,
              top: `${15 + Math.random() * 50}%`,
              left: `${10 + Math.random() * 80}%`,
              animation: `twinkle ${1.5 + Math.random() * 2}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
            }} />
          ))}
        </>
      ),
    };
  }
  return {
    gradient: "linear-gradient(135deg, hsl(205 80% 60%), hsl(185 90% 55%))",
    decorationIcon: <Sun size={28} className="text-yellow-200" />,
    glowColor: "rgba(255,245,158,0.5)",
  };
};

const WeatherIcon = ({ icon }: { icon: string }) => {
  if (icon.includes("rain")) return <CloudRain size={22} className="text-blue-200" />;
  if (icon.includes("snow")) return <Snowflake size={22} className="text-blue-100" />;
  if (icon.includes("fog")) return <Wind size={22} className="text-amber-200" />;
  if (icon.includes("cloud")) return <Cloud size={22} className="text-white/80" />;
  if (icon.includes("sun") || icon.includes("clear")) return <Sun size={22} className="text-yellow-200" />;
  return <CloudSun size={22} className="text-white/80" />;
};

const HeroSection = () => {
  const { islamicMode } = useIslamicMode();
  const [profileOpen, setProfileOpen] = useState(false);
  const mockUser = { name: "أحمد", role: "parent" as const };
  const hijriDate = "٢١ رمضان ١٤٤٧";
  const gregorianDate = "١٩ مارس ٢٠٢٦";
  const nextPrayer = "المغرب";
  const nextPrayerTime = "بعد ٤٢ دقيقة";
  const qiblaDirection = "٢٥٤° غ";

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [currentHour] = useState(() => new Date().getHours());
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const greeting = useMemo(() => getGreeting(currentHour), [currentHour]);

  const theme = useMemo(() => {
    return getWeatherTheme(weather?.weatherCode ?? null, currentHour);
  }, [weather, currentHour, hasLocationPermission]);

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
            cityName = reverseData.address?.city || reverseData.address?.town || reverseData.address?.state || "موقعك";
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

  return (
    <>
      {/* Rain animation keyframes */}
      <style>{`
        @keyframes rainDrop {
          0% { opacity: 0; transform: translateY(-10px) rotate(15deg); }
          50% { opacity: 0.6; }
          100% { opacity: 0; transform: translateY(40px) rotate(15deg); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-40 px-5 pt-4 pb-2 flex justify-between items-center bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setProfileOpen(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary/30"
            style={{ background: "hsl(var(--primary) / 0.1)" }}
          >
            <span className="text-sm font-bold text-primary">{mockUser.name.charAt(0)}</span>
          </button>
          <span className="text-xl font-bold text-primary tracking-tight">عائلتنا</span>
        </div>
        <button className="relative p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors">
          <Bell size={22} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
        </button>
      </header>

      {/* Hero Card */}
      <section className="px-5 pt-8 relative overflow-visible">
        {/* Decoration Icon with Glow */}
        <div className="absolute top-0 left-2 w-16 h-16 z-10 pointer-events-none">
          <div className="absolute inset-0 rounded-full animate-pulse" style={{
            filter: "blur(12px)",
            background: `radial-gradient(circle, ${theme.glowColor} 0%, transparent 70%)`
          }} />
          <div className="relative w-full h-full rounded-full shadow-lg flex items-center justify-center"
            style={{
              background: isNightTime(currentHour)
                ? "linear-gradient(135deg, hsl(230 40% 25%), hsl(250 35% 35%))"
                : "linear-gradient(135deg, hsl(48 100% 65%), hsl(30 100% 55%))",
              border: "2px solid hsla(0,0%,100%,0.25)"
            }}
          >
            {theme.decorationIcon}
          </div>
        </div>

        <div className="rounded-2xl p-6 relative overflow-hidden text-white shadow-xl transition-all duration-700" style={{
          background: theme.gradient
        }}>
          {/* Weather particles */}
          {theme.particles}

          {/* Cloud decorations - only for cloudy/partly cloudy */}
          {weather && (weather.weatherCode <= 3 || !weather) && (
            <>
              <div className="absolute top-3 right-10 opacity-20">
                <Cloud size={52} />
              </div>
              <div className="absolute bottom-3 left-16 opacity-15">
                <Cloud size={36} />
              </div>
            </>
          )}

          <div className="relative z-20 space-y-5">
            {/* Greeting + Weather */}
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold tracking-tight mb-1">
                  {greeting}، {mockUser.name}
                </h1>
                <p className="text-white/75 font-medium text-sm">
                  {gregorianDate} {islamicMode && `• ${hijriDate}`}
                </p>
                {weather && (
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin size={12} className="text-white/50" />
                    <span className="text-white/50 text-xs">{weather.city}</span>
                  </div>
                )}
              </div>
              {weather && (
                <div className="bg-white/15 backdrop-blur-md rounded-xl px-3 py-2 border border-white/20">
                  <div className="flex items-center justify-end gap-2">
                    <WeatherIcon icon={weather.icon} />
                    <span className="text-2xl font-bold">{weather.temp}°</span>
                  </div>
                  <p className="text-[11px] font-semibold text-white/70 mt-0.5 text-center">{weather.description}</p>
                </div>
              )}
            </div>

            {/* Qibla + Prayer Cards - Islamic mode */}
            {islamicMode && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex items-center gap-3 border border-white/10">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Compass size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/60">القبلة</p>
                    <p className="text-sm font-bold">{qiblaDirection}</p>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex items-center gap-3 border border-white/10">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Sun size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/60">{nextPrayer}</p>
                    <p className="text-sm font-bold">{nextPrayerTime}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} user={mockUser} />
    </>
  );
};

export default HeroSection;
