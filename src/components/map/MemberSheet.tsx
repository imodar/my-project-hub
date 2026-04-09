import { useCallback } from "react";
import { ChevronUp, MapPin, EyeOff, Loader2 } from "lucide-react";
import { motion, useMotionValue, animate, PanInfo } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

interface MemberLocation {
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
  is_sharing: boolean;
  name: string;
  role: string;
  isMe: boolean;
}

interface MemberSheetProps {
  locations: MemberLocation[];
  selectedMemberId: string | null;
  onMemberSelect: (id: string) => void;
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  isTogglingSharing?: boolean;
  isLoadingLocations?: boolean;
}

const SHEET_PEEK = 264;
const SHEET_EXPANDED = 480;

function timeSince(dateStr: string, t: { map: { now: string; minutesAgo: string; hoursAgo: string; daysAgo: string } }): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t.map.now;
  if (mins < 60) return t.map.minutesAgo.replace("{0}", String(mins));
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t.map.hoursAgo.replace("{0}", String(hrs));
  return t.map.daysAgo.replace("{0}", String(Math.floor(hrs / 24)));
}

export default function MemberSheet({ locations, selectedMemberId, onMemberSelect, isExpanded, setIsExpanded, isTogglingSharing, isLoadingLocations }: MemberSheetProps) {
  const { t, isRTL } = useLanguage();
  const sheetY = useMotionValue(0);
  const maxDrag = -(SHEET_EXPANDED - SHEET_PEEK);

  const ROLE_LABELS = t.roles as Record<string, string>;

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y < -50) {
      animate(sheetY, maxDrag, { type: "spring", damping: 30, stiffness: 300 });
      setIsExpanded(true);
    } else {
      animate(sheetY, 0, { type: "spring", damping: 30, stiffness: 300 });
      setIsExpanded(false);
    }
  }, [maxDrag, sheetY, setIsExpanded]);

  const handleMemberClick = (id: string) => {
    onMemberSelect(id);
    animate(sheetY, 0, { type: "spring", damping: 30, stiffness: 300 });
    setIsExpanded(false);
  };

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 z-[1000] bg-background rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] max-w-2xl mx-auto"
      style={{ height: SHEET_EXPANDED, y: sheetY, bottom: -(SHEET_EXPANDED - SHEET_PEEK), paddingBottom: "64px" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.1, delay: 0.05 }}
      drag="y"
      dragConstraints={{ top: maxDrag, bottom: 0 }}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col items-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing" onTouchStart={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      <div className="flex items-center justify-between px-5 py-2">
        <div>
          <h2 className="text-base font-extrabold text-foreground">{t.map.familyMembers} ({locations.length})</h2>
          <p className="text-xs text-muted-foreground">{t.map.memberLocations}</p>
        </div>
        <ChevronUp size={20} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </div>

      <div className="overflow-y-auto px-3 pb-24" style={{ maxHeight: SHEET_EXPANDED - 80 }}>
        {locations.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <MapPin className="mx-auto mb-2 opacity-40" size={32} />
            <p>{t.map.noLocations}</p>
          </div>
        )}
        {locations.map((loc, idx) => {
          const hasNoLocation = loc.lat === 0 && loc.lng === 0 && !loc.updated_at;
          const isOnline = loc.is_sharing && loc.updated_at && (Date.now() - new Date(loc.updated_at).getTime()) < 10 * 60 * 1000;
          return (
            <button
              key={loc.user_id}
              onClick={() => handleMemberClick(loc.user_id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${isRTL ? "text-right" : "text-left"} ${
                selectedMemberId === loc.user_id ? "bg-primary/10" : "active:bg-muted"
              } ${idx < locations.length - 1 ? "mb-1" : ""}`}
            >
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold text-white"
                  style={{ background: loc.isMe ? "#ef4444" : "#2563eb" }}
                >
                  {loc.name.charAt(0) || "?"}
                </div>
                <span
                  className={`absolute -bottom-0.5 ${isRTL ? "-left-0.5" : "-right-0.5"} w-3.5 h-3.5 rounded-full border-2 border-background ${
                    !loc.is_sharing ? "bg-gray-400" : isOnline ? "bg-green-500" : "bg-yellow-500"
                  }`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">
                    {loc.name} {loc.isMe ? `(${t.map.me})` : ""}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {ROLE_LABELS[loc.role] || loc.role}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {loc.is_sharing ? timeSince(loc.updated_at, t) : t.map.locationHidden}
                </span>
              </div>

              <div className="flex flex-col items-center gap-1 shrink-0">
                {loc.isMe && isTogglingSharing ? (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                ) : hasNoLocation && isLoadingLocations ? (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                ) : !loc.is_sharing ? (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <EyeOff size={16} />
                    <span className="text-[10px]">{t.map.hidden}</span>
                  </div>
                ) : (
                  <div className={`flex items-center gap-1 ${isOnline ? "text-green-600" : "text-yellow-600"}`}>
                    <MapPin size={16} />
                    <span className="text-[10px]">{isOnline ? t.map.online : t.map.inactive}</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
