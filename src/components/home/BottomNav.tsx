import { Home, Map, MessageCircle, Settings, ShieldAlert } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { haptic } from "@/lib/haptics";

const navItems = [
  { icon: Home, label: "الرئيسية", path: "/" },
  { icon: Map, label: "الخريطة", path: "/map" },
  { icon: MessageCircle, label: "المحادثة", path: "/chat" },
  { icon: Settings, label: "الإعدادات", path: "/settings" },
  { icon: ShieldAlert, label: "طوارئ", path: "/sos", isSOS: true },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-around px-4 py-2 mx-4 mb-3 rounded-2xl" style={{
          background: "hsla(0,0%,100%,0.92)",
          backdropFilter: "blur(16px)",
          boxShadow: "0 4px 30px hsla(0,0%,0%,0.1)",
          border: "1px solid hsla(0,0%,0%,0.06)",
        }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.label}
                onClick={() => {
                  haptic.light();
                  navigate(item.path);
                }}
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
};

export default BottomNav;
