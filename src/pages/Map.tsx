import { useState, Suspense, lazy } from "react";
import { MapPin, EyeOff, Settings2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
const FamilyMap = lazy(() => import("@/components/map/FamilyMap"));
import MemberSheet from "@/components/map/MemberSheet";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { useLanguage } from "@/contexts/LanguageContext";

const Map = () => {
  const navigate = useNavigate();
  const { t, dir, isRTL } = useLanguage();
  const [updateInterval, setUpdateInterval] = useState(5);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  const { locations, isSharing, setIsSharing } = useLocationTracking(updateInterval);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggleSharing = async () => {
    setIsToggling(true);
    try {
      await setIsSharing(!isSharing);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="min-h-screen max-w-2xl mx-auto flex flex-col bg-background relative" dir={dir}>
      <PageHeader
        title={t.map.title}
        subtitle={t.map.updateEvery.replace("{0}", String(updateInterval))}
        onBack={() => navigate("/")}
        actions={[
          {
            icon: isToggling
              ? <><Loader2 size={14} className="text-white/70 animate-spin" /><span className="text-[11px] text-white/70 font-bold">{t.map.updating || "..."}</span></>
              : isSharing
                ? <><MapPin size={14} className="text-green-300" /><span className="text-[11px] text-green-300 font-bold">{t.map.myLocationOn}</span></>
                : <><EyeOff size={14} className="text-white/60" /><span className="text-[11px] text-white/60 font-bold">{t.map.myLocationOff}</span></>,
            onClick: handleToggleSharing,
            className: "px-3 py-1.5 flex items-center gap-2",
            style: { background: isToggling ? "hsla(0,0%,100%,0.18)" : isSharing ? "hsla(145, 60%, 50%, 0.25)" : "hsla(0,0%,100%,0.12)" },
          },
          {
            icon: <Settings2 size={18} className="text-white" />,
            onClick: () => setShowSettings(!showSettings),
          },
        ]}
      >
        {showSettings && (
          <div className="mt-3 p-3 rounded-xl" style={{ background: "hsla(0,0%,100%,0.1)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/80">{t.map.updateInterval}</span>
              <span className="text-sm font-bold text-white">{updateInterval} {t.map.minutes}</span>
            </div>
            <input type="range" min={1} max={30} value={updateInterval}
              onChange={(e) => setUpdateInterval(Number(e.target.value))} className="w-full accent-accent" />
            <div className="flex justify-between text-[10px] text-white/50 mt-1">
              <span>{t.map.moreBattery}</span>
              <span>{t.map.lessBattery}</span>
            </div>
          </div>
        )}
        {!isSharing && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/15 flex items-center gap-2">
            <EyeOff size={14} className="text-red-300 shrink-0" />
            <p className="text-[11px] text-red-200 font-medium">{t.map.hiddenWarning}</p>
          </div>
        )}
      </PageHeader>

      <div className="relative flex-1 -mt-6 z-0" style={{ height: "calc(100vh - 80px)", minHeight: "400px" }}>
        <Suspense fallback={<div className="flex-1 bg-muted animate-pulse rounded-2xl" style={{ height: "100%" }} />}>
          <FamilyMap
            locations={locations}
            selectedMemberId={selectedMemberId}
            onMemberSelect={setSelectedMemberId}
            className="absolute inset-0"
          />
        </Suspense>
      </div>

      <MemberSheet
        locations={locations}
        selectedMemberId={selectedMemberId}
        onMemberSelect={setSelectedMemberId}
        isExpanded={isSheetExpanded}
        setIsExpanded={setIsSheetExpanded}
      />
    </div>
  );
};

export default Map;
