import React, { useState, useRef, useCallback } from "react";
import { Home, Map, MessageCircle, Settings, ShieldAlert } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { haptic } from "@/lib/haptics";

const navItems = [
  { icon: Home, label: "الرئيسية", path: "/" },
  { icon: Map, label: "الخريطة", path: "/map" },
  { icon: ShieldAlert, label: "طوارئ", path: "", isSOS: true },
  { icon: MessageCircle, label: "المحادثة", path: "/chat" },
  { icon: Settings, label: "الإعدادات", path: "/settings" },
];

const SOS_HOLD_DURATION = 3000;

const SOSNavButton = React.forwardRef<HTMLButtonElement>((_props, _ref) => {
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

  const cancelHold = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const circumference = 2 * Math.PI * 26;

  return (
    <button
      key="طوارئ"
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      className="flex flex-col items-center gap-1 px-3 py-1 -mt-6 select-none touch-none"
    >
      <div className="relative w-12 h-12">
        {/* Background circle */}
        <div
          className="absolute inset-0 rounded-full flex items-center justify-center transition-transform duration-100"
          style={{
            background: "linear-gradient(135deg, hsl(0, 72%, 51%), hsl(0, 84%, 60%))",
            boxShadow: isHolding
              ? "0 0 20px hsla(0, 72%, 51%, 0.6), 0 0 40px hsla(0, 72%, 51%, 0.3)"
              : "0 4px 15px hsla(0, 72%, 51%, 0.4)",
            transform: isHolding ? "scale(1.08)" : "scale(1)",
          }}
        >
          <ShieldAlert
            size={22}
            className="text-white transition-transform duration-100"
            style={{
              transform: isHolding ? `rotate(${holdProgress * 360}deg)` : "rotate(0deg)",
            }}
          />
        </div>

        {/* Progress ring */}
        {isHolding && (
          <svg
            className="absolute inset-[-32px] w-[calc(100%+64px)] h-[calc(100%+64px)] pointer-events-none"
            viewBox="0 0 112 112"
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx="56" cy="56" r="52"
              fill="none"
              stroke="hsla(0, 72%, 51%, 0.12)"
              strokeWidth="2.5"
            />
            <circle
              cx="56" cy="56" r="52"
              fill="none"
              stroke="hsl(0, 72%, 51%)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 52}
              strokeDashoffset={2 * Math.PI * 52 * (1 - holdProgress)}
              style={{ transition: "stroke-dashoffset 30ms linear" }}
            />
          </svg>
        )}
      </div>
      <span
        className="text-[10px] font-bold transition-colors"
        style={{ color: isHolding ? "hsl(0, 84%, 50%)" : "hsl(0, 72%, 51%)" }}
      >
        طوارئ
      </span>
    </button>
  );
});
SOSNavButton.displayName = "SOSNavButton";

const BottomNav = React.forwardRef<HTMLDivElement>((_props, _ref) => {
  const navigate = useNavigate();
  const location = useLocation();

  const hiddenRoutes = ["/auth", "/get-started", "/complete-profile", "/join-or-create"];
  if (hiddenRoutes.includes(location.pathname) || location.pathname.startsWith("/admin-panel")) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-around px-4 py-2 mx-4 mb-3 rounded-2xl bg-background/92 backdrop-blur-xl border border-border shadow-lg">
          {navItems.map((item) => {
            if ((item as any).isSOS) {
              return <SOSNavButton key={item.label} />;
            }

            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.label}
                onClick={() => {
                  haptic.light();
                  navigate(item.path);
                }}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                role="link"
                className="flex flex-col items-center gap-1 px-3 py-2 transition-transform active:scale-90"
              >
                {isActive ? (
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center -mt-5"
                    style={{
                      background: "linear-gradient(135deg, hsl(217, 100%, 21%), hsl(209, 100%, 31%))",
                      boxShadow: "0 4px 15px hsla(209, 100%, 31%, 0.4)",
                    }}
                  >
                    <item.icon size={22} className="text-white" />
                  </div>
                ) : (
                  <item.icon size={22} className="text-muted-foreground" />
                )}
                <span className={`text-[10px] font-semibold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
BottomNav.displayName = "BottomNav";

export default BottomNav;
