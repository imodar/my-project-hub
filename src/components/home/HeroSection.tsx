import { Bell, Compass, Cloud, Sun, CloudRain, CloudSun, MapPin } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useIslamicMode } from "@/contexts/IslamicModeContext";
import ProfileSheet from "./ProfileSheet";

interface WeatherData {
  temp: number;
  description: string;
  city: string;
  icon: string;
}

const getGreeting = (hour: number) => {
  if (hour >= 5 && hour < 12) return "صباح الخير";
  if (hour >= 12 && hour < 17) return "مساء النور";
  if (hour >= 17 && hour < 21) return "مساء الخير";
  return "مساء الخير";
};

const WeatherIcon = ({ icon }: { icon: string }) => {
  if (icon.includes("rain")) return <CloudRain size={22} className="text-blue-200" />;
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
  const greeting = useMemo(() => getGreeting(currentHour), [currentHour]);

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
    <>
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
      <section className="px-5 pt-2 relative">
        {/* Artistic Sun */}
        <div className="absolute -top-4 left-2 w-24 h-24 z-30 pointer-events-none">
          <div className="absolute inset-0 rounded-full animate-pulse" style={{
            filter: "blur(20px)",
            background: "radial-gradient(circle, rgba(255,245,158,1) 0%, rgba(255,164,0,0.4) 70%)"
          }} />
          <div className="relative w-full h-full rounded-full shadow-lg"
            style={{
              background: "linear-gradient(135deg, hsl(48 100% 65%), hsl(30 100% 55%))",
              border: "4px solid hsla(0,0%,100%,0.2)"
            }}
          />
        </div>

        <div className="rounded-2xl p-6 relative overflow-hidden text-white shadow-xl" style={{
          background: "linear-gradient(135deg, hsl(205 80% 60%), hsl(185 90% 55%))"
        }}>
          {/* Cloud decorations */}
          <div className="absolute top-3 right-10 opacity-20">
            <Cloud size={52} />
          </div>
          <div className="absolute bottom-3 left-16 opacity-15">
            <Cloud size={36} />
          </div>

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
                <div className="text-left pl-4">
                  <div className="flex items-center justify-end gap-2">
                    <WeatherIcon icon={weather.icon} />
                    <span className="text-2xl font-bold">{weather.temp}°</span>
                  </div>
                  <p className="text-[11px] font-semibold text-white/70 mt-0.5">{weather.description}</p>
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
