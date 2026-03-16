import { Compass, Bell, Settings } from "lucide-react";

const HeroSection = () => {
  const hijriDate = "٢١ رمضان ١٤٤٧";
  const gregorianDate = "١٦ مارس ٢٠٢٦";
  const nextPrayer = "المغرب";
  const nextPrayerTime = "٦:١٢ م";
  const qiblaDirection = "١٣٦°";

  return (
    <div className="relative overflow-hidden rounded-b-[2.5rem]" style={{
      background: "linear-gradient(135deg, hsl(240 40% 16%), hsl(270 30% 25%))"
    }}>
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

        {/* Greeting + Date */}
        <div className="mb-6">
          <p className="text-white/60 text-sm mb-1">{hijriDate} • {gregorianDate}</p>
          <h2 className="text-2xl font-bold text-white">مساء الخير 👋</h2>
        </div>

        {/* Qibla Compass */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-28 h-28 rounded-full flex items-center justify-center" style={{
            background: "hsla(0,0%,100%,0.08)",
            border: "2px solid hsla(0,0%,100%,0.15)"
          }}>
            <div className="absolute inset-2 rounded-full flex items-center justify-center" style={{
              background: "hsla(0,0%,100%,0.06)",
              border: "1px solid hsla(0,0%,100%,0.1)"
            }}>
              <Compass size={40} className="text-gold animate-pulse-glow" style={{ color: "hsl(var(--gold))" }} />
            </div>
            {/* Direction indicator */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45" style={{
              background: "hsl(var(--gold))"
            }} />
          </div>
          <p className="text-white/50 text-xs mt-2">اتجاه القبلة</p>
          <p className="text-white font-bold text-lg" style={{ color: "hsl(var(--gold))" }}>{qiblaDirection}</p>
        </div>

        {/* Next Prayer */}
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
      </div>
    </div>
  );
};

export default HeroSection;
