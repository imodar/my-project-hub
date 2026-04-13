import { useState, useMemo, useEffect, Suspense, lazy } from "react";
import { MapPin, EyeOff, Settings2, Loader2, MapPinOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
const FamilyMap = lazy(() => import("@/components/map/FamilyMap"));
import MemberSheet from "@/components/map/MemberSheet";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

const Map = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, dir, isRTL } = useLanguage();
  const [updateInterval, setUpdateInterval] = useState(5);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [locationPermission, setLocationPermission] = useState<"granted" | "denied" | "prompt" | "checking">("checking");

  // Check geolocation permission
  useEffect(() => {
    const checkPermission = async () => {
      try {
        // Try Capacitor Geolocation first
        const { Geolocation } = await import("@capacitor/geolocation").catch(() => ({ Geolocation: null }));
        if (Geolocation) {
          const status = await Geolocation.checkPermissions();
          setLocationPermission(status.location === "granted" ? "granted" : status.location === "denied" ? "denied" : "prompt");
          return;
        }
        // Fallback to web API
        if (navigator.permissions) {
          const result = await navigator.permissions.query({ name: "geolocation" });
          setLocationPermission(result.state);
          result.addEventListener("change", () => setLocationPermission(result.state));
        } else {
          setLocationPermission("prompt");
        }
      } catch {
        setLocationPermission("prompt");
      }
    };
    checkPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { Geolocation } = await import("@capacitor/geolocation").catch(() => ({ Geolocation: null }));
      if (Geolocation) {
        const status = await Geolocation.requestPermissions();
        setLocationPermission(status.location === "granted" ? "granted" : "denied");
        return;
      }
      // Web fallback — trigger the browser prompt
      navigator.geolocation.getCurrentPosition(
        () => setLocationPermission("granted"),
        (err) => setLocationPermission(err.code === 1 ? "denied" : "prompt")
      );
    } catch {
      setLocationPermission("denied");
    }
  };

  const { locations, isLoading: isLoadingLocations, isSharing, setIsSharing } = useLocationTracking(updateInterval);
  const { members } = useFamilyMembers({ excludeSelf: false });

  // Merge: members (primary, instant from Dexie) + locations (enrichment from server)
  const mergedLocations = useMemo(() => {
    const locationMap: Record<string, (typeof locations)[0]> = {};
    for (const l of locations) locationMap[l.user_id] = l;
    const seen = new Set<string>();
    const result: typeof locations = [];

    // 1. Start from members — stable count, dedup by user_id
    for (const m of members) {
      if (seen.has(m.id)) continue; // skip Dexie duplicates
      seen.add(m.id);
      const loc = locationMap[m.id];
      if (loc) {
        result.push({ ...loc, name: loc.name || m.name, role: loc.role || m.role });
      } else {
        result.push({
          user_id: m.id,
          lat: 0,
          lng: 0,
          accuracy: null,
          updated_at: "",
          is_sharing: false,
          name: m.name,
          avatar_url: null,
          role: m.role,
          isMe: m.id === user?.id,
        });
      }
    }

    // 2. Add any location not matched to a member (rare edge case)
    for (const l of locations) {
      if (!seen.has(l.user_id)) {
        seen.add(l.user_id);
        result.push(l);
      }
    }

    return result;
  }, [locations, members, user?.id]);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggleSharing = async () => {
    setIsToggling(true);
    try {
      await setIsSharing(!isSharing);
    } finally {
      setIsToggling(false);
    }
  };

  if (locationPermission === "checking") {
    return (
      <div className="min-h-screen flex flex-col bg-background" dir={dir}>
        <PageHeader title={t.map.title} onBack={() => navigate("/")} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (locationPermission !== "granted") {
    return (
      <div className="min-h-screen flex flex-col bg-background" dir={dir}>
        <PageHeader title={t.map.title} onBack={() => navigate("/")} />
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6">
          <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center">
            <MapPinOff size={36} className="text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">
              {isRTL ? "يجب تفعيل صلاحية الموقع" : "Location Permission Required"}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isRTL
                ? "لعرض مواقع أفراد العائلة على الخريطة، يجب تفعيل صلاحية الوصول إلى الموقع الجغرافي."
                : "To view family members on the map, location access must be enabled."}
            </p>
          </div>
          {locationPermission === "denied" ? (
            <p className="text-xs text-destructive">
              {isRTL
                ? "تم رفض صلاحية الموقع. يرجى تفعيلها من إعدادات الجهاز."
                : "Location permission was denied. Please enable it from device settings."}
            </p>
          ) : (
            <Button onClick={requestLocationPermission} className="gap-2">
              <MapPin size={16} />
              {isRTL ? "تفعيل الموقع" : "Enable Location"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background relative" dir={dir}>
      <PageHeader
        title={t.map.title}
        subtitle={t.map.updateEvery.replace("{0}", String(updateInterval))}
        onBack={() => navigate("/")}
        actions={[
          {
            icon: isToggling
              ? <><Loader2 size={14} className="text-white/70 animate-spin" /><span className="text-[11px] text-white/70 font-bold">...</span></>
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
            locations={mergedLocations}
            selectedMemberId={selectedMemberId}
            onMemberSelect={setSelectedMemberId}
            className="absolute inset-0"
          />
        </Suspense>
      </div>

      <MemberSheet
        locations={mergedLocations}
        selectedMemberId={selectedMemberId}
        onMemberSelect={setSelectedMemberId}
        isExpanded={isSheetExpanded}
        setIsExpanded={setIsSheetExpanded}
        isTogglingSharing={isToggling}
        isLoadingLocations={isLoadingLocations}
      />
    </div>
  );
};

export default Map;
