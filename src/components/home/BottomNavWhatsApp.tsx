import React, { useState, useRef, useCallback } from "react";
import { Home, Map, MessageCircle, Settings, ShieldAlert } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { haptic } from "@/lib/haptics";
import { useLanguage } from "@/contexts/LanguageContext";

const SOS_HOLD_DURATION = 3000;

const SOSNavButton = ({ label }: { label: string }) => {
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef(0);

  const cleanup = useCallback(() => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  }, []);

  const startHold = useCallback(() => {
    setIsHolding(true);
    setHoldProgress(0);
    startTime.current = Date.now();
    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      const progress = Math.min(elapsed / SOS_HOLD_DURATION, 1);
      setHoldProgress(progress);
      if (progress >= 1) {
        cleanup();
        haptic.heavy();
        window.dispatchEvent(new CustomEvent("trigger-sos"));
      }
    }, 30);
  }, [cleanup]);

  const cancelHold = useCallback(() => cleanup(), [cleanup]);

  return (
    <button
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 select-none touch-none relative"
    >
      <div className="relative w-10 h-10">
        <div
          className="absolute inset-0 rounded-full flex items-center justify-center transition-transform duration-100"
          style={{
            background: "linear-gradient(135deg, hsl(0, 72%, 51%), hsl(0, 84%, 60%))",
            boxShadow: isHolding
              ? "0 0 16px hsla(0, 72%, 51%, 0.5)"
              : "0 2px 8px hsla(0, 72%, 51%, 0.3)",
            transform: isHolding ? "scale(1.1)" : "scale(1)",
          }}
        >
          <ShieldAlert
            size={20}
            className="text-white transition-transform duration-100"
            style={{ transform: isHolding ? `rotate(${holdProgress * 360}deg)` : "rotate(0deg)" }}
          />
        </div>
        {isHolding && (
          <svg className="absolute inset-[-20px] w-[calc(100%+40px)] h-[calc(100%+40px)] pointer-events-none" viewBox="0 0 80 80" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="40" cy="40" r="36" fill="none" stroke="hsla(0, 72%, 51%, 0.12)" strokeWidth="2" />
            <circle cx="40" cy="40" r="36" fill="none" stroke="hsl(0, 72%, 51%)" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 36}
              strokeDashoffset={2 * Math.PI * 36 * (1 - holdProgress)}
              style={{ transition: "stroke-dashoffset 30ms linear" }}
            />
          </svg>
        )}
      </div>
      <span className="text-[10px] font-bold" style={{ color: isHolding ? "hsl(0, 84%, 50%)" : "hsl(0, 72%, 51%)" }}>
        {label}
      </span>
    </button>
  );
};

interface NavItem { icon: React.ElementType; label: string; path: string; isSOS?: boolean }

const BottomNavWhatsApp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const navItems: NavItem[] = [
    { icon: Home, label: t.nav.home, path: "/" },
    { icon: Map, label: t.nav.map, path: "/map" },
    { icon: ShieldAlert, label: t.nav.emergency, path: "", isSOS: true },
    { icon: MessageCircle, label: t.nav.chat, path: "/chat" },
    { icon: Settings, label: t.nav.settings, path: "/settings" },
  ];

  const hiddenRoutes = ["/auth", "/get-started", "/complete-profile", "/join-or-create"];
  if (hiddenRoutes.includes(location.pathname) || location.pathname.startsWith("/admin-panel")) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-[28px] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-end justify-around max-w-2xl mx-auto">
        {navItems.map((item) => {
          if (item.isSOS) {
            return <SOSNavButton key="sos" label={item.label} />;
          }

          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.path}
              onClick={() => {
                haptic.light();
                navigate(item.path);
              }}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              role="link"
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 transition-colors active:opacity-70 relative"
            >
              {/* Active indicator bar */}
              {isActive && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-b-full"
                  style={{
                    width: 32,
                    background: "hsl(var(--primary))",
                  }}
                />
              )}
              <item.icon
                size={24}
                className={isActive ? "text-primary" : "text-muted-foreground"}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[11px] font-semibold ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
BottomNavWhatsApp.displayName = "BottomNav";

export default React.memo(BottomNavWhatsApp);
