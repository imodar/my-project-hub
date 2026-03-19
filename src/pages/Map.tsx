import { useState, useRef, useCallback } from "react";
import { ArrowRight, MapPin, EyeOff, Shield, Settings2, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, useMotionValue, useTransform, animate, PanInfo } from "framer-motion";

interface FamilyMember {
  id: string;
  name: string;
  emoji: string;
  emojiColor: string;
  isOnline: boolean;
  lastSeen: string;
  location: string;
  locationIcon: string;
  isLocationHidden: boolean;
  isInSafeZone: boolean;
  safeZoneName?: string;
  x: number;
  y: number;
}

const mockMembers: FamilyMember[] = [
  {
    id: "1", name: "أبو فهد", emoji: "👨", emojiColor: "hsl(var(--primary))",
    isOnline: true, lastSeen: "الآن", location: "العمل - شارع الملك فهد",
    locationIcon: "🏢", isLocationHidden: false, isInSafeZone: false,
    x: 45, y: 55,
  },
  {
    id: "2", name: "أم فهد", emoji: "👩", emojiColor: "hsl(145, 30%, 80%)",
    isOnline: true, lastSeen: "الآن", location: "المنزل - حي النخيل",
    locationIcon: "🏡", isLocationHidden: false, isInSafeZone: true, safeZoneName: "المنزل",
    x: 72, y: 42,
  },
  {
    id: "3", name: "فهد", emoji: "👦", emojiColor: "hsl(200, 40%, 80%)",
    isOnline: true, lastSeen: "منذ 3 د", location: "مدرسة الأمل",
    locationIcon: "🏫", isLocationHidden: false, isInSafeZone: true, safeZoneName: "المدرسة",
    x: 60, y: 25,
  },
  {
    id: "4", name: "نورة", emoji: "👧", emojiColor: "hsl(50, 60%, 80%)",
    isOnline: false, lastSeen: "منذ 2 س", location: "آخر موقع: المنزل",
    locationIcon: "📍", isLocationHidden: false, isInSafeZone: false,
    x: 30, y: 70,
  },
  {
    id: "5", name: "سارة", emoji: "👶", emojiColor: "hsl(320, 40%, 85%)",
    isOnline: false, lastSeen: "منذ 1 س", location: "الموقع مخفي",
    locationIcon: "🔒", isLocationHidden: true, isInSafeZone: false,
    x: 0, y: 0,
  },
];

// Sheet positions (from top of map area)
const SHEET_PEEK = 220; // how much sheet peeks up from bottom
const SHEET_EXPANDED = 520; // expanded height

const Map = () => {
  const navigate = useNavigate();
  const [updateInterval, setUpdateInterval] = useState(5);
  const [showSettings, setShowSettings] = useState(false);
  const [members] = useState<FamilyMember[]>(mockMembers);
  const [myLocationEnabled, setMyLocationEnabled] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  const sheetY = useMotionValue(0);
  // 0 = peek position, negative = expanded (moved up)
  const maxDrag = -(SHEET_EXPANDED - SHEET_PEEK);

  const visibleMembers = members.filter((m) => !m.isLocationHidden);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.y < -threshold) {
      // Swiped up -> expand
      animate(sheetY, maxDrag, { type: "spring", damping: 30, stiffness: 300 });
      setIsSheetExpanded(true);
    } else {
      // Swiped down -> collapse
      animate(sheetY, 0, { type: "spring", damping: 30, stiffness: 300 });
      setIsSheetExpanded(false);
    }
  }, [maxDrag, sheetY]);

  const handleMemberClick = (memberId: string) => {
    setSelectedMemberId(memberId);
    // Collapse sheet to show map
    animate(sheetY, 0, { type: "spring", damping: 30, stiffness: 300 });
    setIsSheetExpanded(false);
  };

  const mapHeight = "calc(100vh - 80px)"; // full screen minus header approx

  return (
    <div className="min-h-screen max-w-2xl mx-auto flex flex-col bg-background relative overflow-hidden" dir="rtl">
      {/* Header */}
      <div
        className="sticky top-0 z-50 px-4 pt-12 pb-3 rounded-b-3xl"
        style={{
          background: "linear-gradient(135deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)))",
        }}
      >
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-1.5 rounded-full" style={{ background: "hsla(0,0%,100%,0.12)" }}>
            <ArrowRight size={20} className="text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">خريطة العائلة</h1>
            <p className="text-xs text-white/70">تحديث كل {updateInterval} دقائق</p>
          </div>
          <button
            onClick={() => setMyLocationEnabled(!myLocationEnabled)}
            className="px-3 py-1.5 rounded-full flex items-center gap-2"
            style={{ background: myLocationEnabled ? "hsla(145, 60%, 50%, 0.25)" : "hsla(0,0%,100%,0.12)" }}
          >
            <span className="text-[10px] text-white/50">موقعي</span>
            {myLocationEnabled ? (
              <MapPin size={14} className="text-green-300" />
            ) : (
              <EyeOff size={14} className="text-white/60" />
            )}
            <span className={`text-[11px] font-bold ${myLocationEnabled ? "text-green-300" : "text-white/60"}`}>
              {myLocationEnabled ? "مفعّل" : "مخفي"}
            </span>
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-full"
            style={{ background: "hsla(0,0%,100%,0.12)" }}
          >
            <Settings2 size={18} className="text-white" />
          </button>
        </div>

        {showSettings && (
          <div className="mt-3 p-3 rounded-xl" style={{ background: "hsla(0,0%,100%,0.1)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/80">فترة تحديث الموقع</span>
              <span className="text-sm font-bold text-white">{updateInterval} دقائق</span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              value={updateInterval}
              onChange={(e) => setUpdateInterval(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-[10px] text-white/50 mt-1">
              <span>1 دقيقة (بطارية أكثر)</span>
              <span>30 دقيقة (بطارية أقل)</span>
            </div>
          </div>
        )}
      </div>

      {/* Map area - full width, tucked under header */}
      <div className="relative flex-1 -mt-6" style={{ minHeight: mapHeight }}>
        {/* Grid background */}
        <div
          className="absolute inset-0"
          style={{
            background: "hsl(var(--secondary))",
            backgroundImage: `
              linear-gradient(hsl(var(--border)) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
          }}
        />

        {/* Members on map */}
        {visibleMembers.map((member) => (
          <div
            key={member.id}
            className="absolute z-10"
            style={{
              left: `${member.x}%`,
              top: `${member.y}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shadow-md mb-1 whitespace-nowrap transition-all ${
                selectedMemberId === member.id ? "ring-2 ring-white scale-110" : ""
              }`}
              style={{
                background: member.isOnline
                  ? "linear-gradient(135deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)))"
                  : "hsl(var(--muted))",
                color: member.isOnline ? "white" : "hsl(var(--foreground))",
              }}
            >
              <span className="text-xs font-bold">{member.name}</span>
            </div>
            <div className="flex justify-center -mt-1">
              <div
                className="w-0 h-0"
                style={{
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderTop: member.isOnline
                    ? "6px solid hsl(var(--hero-gradient-to))"
                    : "6px solid hsl(var(--muted))",
                }}
              />
            </div>
            {/* Selection pulse */}
            {selectedMemberId === member.id && (
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                <div className="w-4 h-4 rounded-full bg-primary/30 animate-ping" />
                <div className="w-3 h-3 rounded-full bg-primary absolute top-0.5 left-0.5" />
              </div>
            )}
          </div>
        ))}

        {/* Legend */}
        <div className="absolute top-8 left-3 bg-card/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-md border border-border text-xs space-y-1.5 z-20">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-foreground">متصل</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
            <span className="text-foreground">غير متصل</span>
          </div>
        </div>

        {/* Bottom sheet overlay */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 z-30 bg-background rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
          style={{
            height: SHEET_EXPANDED,
            y: sheetY,
            bottom: -(SHEET_EXPANDED - SHEET_PEEK),
          }}
          drag="y"
          dragConstraints={{ top: maxDrag, bottom: 0 }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
        >
          {/* Handle */}
          <div className="flex flex-col items-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-2">
            <div>
              <h2 className="text-base font-extrabold text-foreground">أفراد العائلة ({members.length})</h2>
              <p className="text-xs text-muted-foreground">تتبع جميع الأعضاء</p>
            </div>
            <ChevronUp
              size={20}
              className={`text-muted-foreground transition-transform ${isSheetExpanded ? "rotate-180" : ""}`}
            />
          </div>

          {/* Members list */}
          <div className="overflow-y-auto px-3 pb-24" style={{ maxHeight: SHEET_EXPANDED - 80 }}>
            {members.map((member, idx) => (
              <button
                key={member.id}
                onClick={() => handleMemberClick(member.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-right ${
                  selectedMemberId === member.id ? "bg-primary/10" : "active:bg-muted"
                } ${idx < members.length - 1 ? "mb-1" : ""}`}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0"
                  style={{ background: member.emojiColor + "33" }}
                >
                  {member.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{member.name}</span>
                    {member.isInSafeZone && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold flex items-center gap-0.5">
                        <Shield size={9} />
                        {member.safeZoneName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs">{member.locationIcon}</span>
                    <span className="text-xs text-muted-foreground truncate">{member.location}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={`w-2.5 h-2.5 rounded-full ${member.isOnline ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                  <span className="text-[10px] text-muted-foreground">{member.lastSeen}</span>
                  {member.isLocationHidden && (
                    <EyeOff size={12} className="text-muted-foreground" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Map;
