import { useState, Suspense, lazy } from "react";
import { MapPin, EyeOff, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
const FamilyMap = lazy(() => import("@/components/map/FamilyMap"));
import MemberSheet from "@/components/map/MemberSheet";
import { useLocationTracking } from "@/hooks/useLocationTracking";

const Map = () => {
  const navigate = useNavigate();
  const [updateInterval, setUpdateInterval] = useState(5);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  const { locations, isSharing, setIsSharing } = useLocationTracking(updateInterval);

  return (
    <div className="min-h-screen max-w-2xl mx-auto flex flex-col bg-background relative overflow-hidden" dir="rtl">
      <PageHeader
        title="خريطة العائلة"
        subtitle={`تحديث كل ${updateInterval} دقائق`}
        onBack={() => navigate("/")}
        actions={[
          {
            icon: isSharing
              ? <><MapPin size={14} className="text-green-300" /><span className="text-[11px] text-green-300 font-bold">موقعي مفعّل</span></>
              : <><EyeOff size={14} className="text-white/60" /><span className="text-[11px] text-white/60 font-bold">موقعي غير مفعّل</span></>,
            onClick: () => setIsSharing(!isSharing),
            className: "px-3 py-1.5 flex items-center gap-2",
            style: { background: isSharing ? "hsla(145, 60%, 50%, 0.25)" : "hsla(0,0%,100%,0.12)" },
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
              <span className="text-sm text-white/80">فترة تحديث الموقع</span>
              <span className="text-sm font-bold text-white">{updateInterval} دقائق</span>
            </div>
            <input type="range" min={1} max={30} value={updateInterval}
              onChange={(e) => setUpdateInterval(Number(e.target.value))} className="w-full accent-accent" />
            <div className="flex justify-between text-[10px] text-white/50 mt-1">
              <span>1 دقيقة (بطارية أكثر)</span>
              <span>30 دقيقة (بطارية أقل)</span>
            </div>
          </div>
        )}
        {!isSharing && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/15 flex items-center gap-2 text-right">
            <EyeOff size={14} className="text-red-300 shrink-0" />
            <p className="text-[11px] text-red-200 font-medium">سيتم إعلام الوالدين أنك قمت بإطفاء مشاركة الموقع الخاص بك</p>
          </div>
        )}
      </PageHeader>

      {/* Map area */}
      <div className="relative flex-1 -mt-6" style={{ height: "calc(100vh - 80px)", minHeight: "400px" }}>
        <Suspense fallback={<div className="flex-1 bg-muted animate-pulse rounded-2xl" style={{ height: "100%" }} />}>
          <FamilyMap
            locations={locations}
            selectedMemberId={selectedMemberId}
            onMemberSelect={setSelectedMemberId}
            className="absolute inset-0"
          />
        </Suspense>

        <MemberSheet
          locations={locations}
          selectedMemberId={selectedMemberId}
          onMemberSelect={setSelectedMemberId}
          isExpanded={isSheetExpanded}
          setIsExpanded={setIsSheetExpanded}
        />
      </div>
    </div>
  );
};

export default Map;
