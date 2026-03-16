import { Compass, Bell, Settings, CloudSun, CloudRain, Sun, Cloud, MapPin } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useIslamicMode } from "@/contexts/IslamicModeContext";

interface WeatherData {
  temp: number;
  description: string;
  city: string;
  icon: string;
}

const getGreeting = (hour: number) => {
  if (hour >= 5 && hour < 12) return "صباح الخير ☀️";
  if (hour >= 12 && hour < 17) return "مساء النور 🌤";
  if (hour >= 17 && hour < 21) return "مساء الخير 🌅";
  return "مساء الخير 🌙";
};

const isNightTime = (hour: number) => hour >= 18 || hour < 6;

const WeatherIcon = ({ icon }: { icon: string }) => {
  if (icon.includes("rain")) return <CloudRain size={18} className="text-white/80" />;
  if (icon.includes("cloud")) return <Cloud size={18} className="text-white/80" />;
  if (icon.includes("sun") || icon.includes("clear")) return <Sun size={18} className="text-white/80" />;
  return <CloudSun size={18} className="text-white/80" />;
};

const HeroSection = () => {
  const { islamicMode } = useIslamicMode();
  const hijriDate = "٢١ رمضان ١٤٤٧";
  const gregorianDate = "١٦ مارس ٢٠٢٦";
  const nextPrayer = "المغرب";
  const nextPrayerTime = "٦:١٢ م";
  const qiblaDirection = "١٣٦°";

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [currentHour] = useState(() => new Date().getHours());

  const isNight = useMemo(() => isNightTime(currentHour), [currentHour]);
  const greeting = useMemo(() => getGreeting(currentHour), [currentHour]);

  const gradientStyle = useMemo(() => {
    if (isNight) {
      return "linear-gradient(135deg, hsl(240 40% 16%), hsl(270 30% 25%))";
    }
    return "linear-gradient(135deg, hsl(205 65% 38%), hsl(195 55% 52%))";
  }, [isNight]);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
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
          if (weatherCode >= 61) { description = "ممطر"; icon = "rain"; }
          else if (weatherCode >= 45) { description = "غائم"; icon = "cloud"; }
          else if (weatherCode >= 1) { description = "غائم جزئياً"; icon = "cloudsun"; }

          setWeather({
            temp: Math.round(data.current?.temperature_2m || 0),
            description,
            city: cityName,
            icon,
          });
        } catch (e) {
          console.error("Weather fetch failed:", e);
        }
      },
      () => console.log("Location permission denied")
    );
  }, []);

  return (
    <div className="relative overflow-hidden rounded-b-[2.5rem]" style={{ background: gradientStyle }}>
      {/* Decorative circles */}
      <div className="absolute top-[-60px] left-[-40px] w-40 h-40 rounded-full opacity-10" style={{ background: "hsl(var(--gold))" }} />
      <div className="absolute bottom-[-30px] right-[-20px] w-32 h-32 rounded-full opacity-[0.07]" style={{ background: "hsl(var(--gold))" }} />

      <div className="relative z-10 px-5 pt-12 pb-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-white/90">منظم العائلة</h1>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-full" style={{ background: "hsla(0,0%,100%,0.12)" }}>
              <Bell size={20} className="text-white/80" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-400" />
            </button>
            <button className="p-2 rounded-full" style={{ background: "hsla(0,0%,100%,0.12)" }}>
              <Settings size={20} className="text-white/80" />
            </button>
          </div>
        </div>

        {/* Greeting + Weather */}
        <div className={`flex items-start justify-between ${islamicMode ? "mb-6" : "mb-4"}`}>
          <div>
            {islamicMode && (
              <p className="text-white/60 text-sm mb-1">{hijriDate} • {gregorianDate}</p>
            )}
            <h2 className="text-2xl font-bold text-white">{greeting}</h2>
          </div>
          {weather && (
            <div className="flex flex-col items-center gap-1 rounded-2xl px-3 py-2" style={{
              background: "hsla(0,0%,100%,0.1)",
              backdropFilter: "blur(8px)",
            }}>
              <WeatherIcon icon={weather.icon} />
              <span className="text-white font-bold text-lg leading-none">{weather.temp}°</span>
              <span className="text-white/60 text-[10px]">{weather.description}</span>
              <div className="flex items-center gap-0.5">
                <MapPin size={10} className="text-white/40" />
                <span className="text-white/40 text-[9px]">{weather.city}</span>
              </div>
            </div>
          )}
        </div>

        {/* Qibla Compass - Islamic mode only */}
        {islamicMode && (
          <div className="flex flex-col items-center mb-6">
            <div className="relative w-28 h-28 rounded-full flex items-center justify-center" style={{
              background: "hsla(0,0%,100%,0.08)",
              border: "2px solid hsla(0,0%,100%,0.15)"
            }}>
              <div className="absolute inset-2 rounded-full flex items-center justify-center" style={{
                background: "hsla(0,0%,100%,0.06)",
                border: "1px solid hsla(0,0%,100%,0.1)"
              }}>
                <Compass size={40} className="animate-pulse-glow" style={{ color: "hsl(var(--gold))" }} />
              </div>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45" style={{
                background: "hsl(var(--gold))"
              }} />
            </div>
            <p className="text-white/50 text-xs mt-2">اتجاه القبلة</p>
            <p className="text-white font-bold text-lg" style={{ color: "hsl(var(--gold))" }}>{qiblaDirection}</p>
          </div>
        )}

        {/* Next Prayer - Islamic mode only */}
        {islamicMode && (
          <div className="rounded-2xl p-4 text-center" style={{
            background: "hsla(0,0%,100%,0.1)",
            backdropFilter: "blur(12px)",
            border: "1px solid hsla(0,0%,100%,0.15)"
          }}>
            <p className="text-white/50 text-xs mb-1">الصلاة القادمة</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-bold text-white">{nextPrayer}</span>
              <span className="text-xl font-semibold" style={{ color: "hsl(var(--gold))" }}>{nextPrayerTime}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeroSection;
