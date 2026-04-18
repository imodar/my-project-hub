import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, RotateCcw, MoreVertical, BarChart3, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useTasbihSessions } from "@/hooks/useTasbihSessions";

const Tasbih = () => {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const { sessions, isLoading, saveSession, clearAll } = useTasbihSessions();

  const handleTap = useCallback(() => {
    setCount((prev) => prev + 1);

    if (vibrationEnabled && navigator.vibrate) {
      navigator.vibrate(30);
    }

    if (soundEnabled) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.1;
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    }
  }, [soundEnabled, vibrationEnabled]);

  const handleReset = () => {
    if (count > 0) {
      saveSession.mutate(count);
    }
    setCount(0);
  };

  const handleClearAll = () => {
    clearAll.mutate();
  };

  const totalAllTime = sessions.reduce((sum, s) => sum + s.count, 0) + count;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("ar-SA", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div
      className="min-h-screen relative flex flex-col select-none cursor-pointer"
      style={{
        background: "linear-gradient(180deg, hsl(40, 20%, 97%) 0%, hsl(40, 20%, 97%) 60%, hsl(155, 30%, 85%) 100%)",
      }}
      onClick={handleTap}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 relative z-10" style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}>
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-2xl"
          style={{ background: "hsla(0,0%,0%,0.05)" }}
          onClick={(e) => {
            e.stopPropagation();
            navigate("/");
          }}
        >
          <span className="text-sm font-semibold text-foreground">العودة</span>
          <ChevronRight size={18} className="text-foreground" />
        </button>

        <div className="flex items-center gap-2">
          {/* Stats button */}
          <Drawer open={statsOpen} onOpenChange={setStatsOpen}>
            <DrawerTrigger asChild>
              <button
                className="flex items-center justify-center w-10 h-10 rounded-2xl"
                style={{ background: "hsla(0,0%,0%,0.05)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <BarChart3 size={18} className="text-foreground" />
              </button>
            </DrawerTrigger>
            <DrawerContent onClick={(e) => e.stopPropagation()}>
              <DrawerHeader>
                <DrawerTitle className="text-center">إحصائيات التسبيح</DrawerTitle>
              </DrawerHeader>
              <div className="px-5 max-h-[60vh] overflow-y-auto" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }} dir="rtl">
                {/* Summary */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/10 mb-4">
                  <div className="text-center flex-1">
                    <p className="text-2xl font-bold text-primary">{totalAllTime}</p>
                    <p className="text-xs text-muted-foreground mt-1">إجمالي التسبيحات</p>
                  </div>
                  <div className="w-px h-10 bg-border" />
                  <div className="text-center flex-1">
                    <p className="text-2xl font-bold text-primary">{sessions.length + (count > 0 ? 1 : 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">عدد الجلسات</p>
                  </div>
                </div>

                {/* Current session */}
                {count > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-accent/50 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm font-semibold text-foreground">الجلسة الحالية</span>
                    </div>
                    <span className="text-sm font-bold text-primary">{count}</span>
                  </div>
                )}

                {/* Loading */}
                {isLoading && (
                  <p className="text-center text-sm text-muted-foreground py-4">جاري التحميل...</p>
                )}

                {/* Past sessions */}
                {sessions.length > 0 ? (
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                        <span className="text-xs text-muted-foreground">{formatDate(session.created_at)}</span>
                        <span className="text-sm font-bold text-foreground">{session.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  !count && !isLoading && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      لا توجد إحصائيات بعد
                    </p>
                  )
                )}

                {/* Clear all */}
                {sessions.length > 0 && (
                  <button
                    className="w-full mt-4 flex items-center justify-center gap-2 p-3 rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={handleClearAll}
                  >
                    <Trash2 size={16} />
                    <span className="text-sm font-semibold">مسح كافة الإحصائيات</span>
                  </button>
                )}
              </div>
            </DrawerContent>
          </Drawer>

          {/* Settings button */}
          <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DrawerTrigger asChild>
              <button
                className="flex items-center justify-center w-10 h-10 rounded-2xl"
                style={{ background: "hsla(0,0%,0%,0.05)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical size={18} className="text-foreground" />
              </button>
            </DrawerTrigger>
            <DrawerContent onClick={(e) => e.stopPropagation()}>
              <DrawerHeader>
                <DrawerTitle className="text-center">الإعدادات</DrawerTitle>
              </DrawerHeader>
              <div className="px-5 space-y-4" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }} dir="rtl">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-sm font-medium text-foreground">صوت النقر</span>
                  <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-sm font-medium text-foreground">الاهتزاز عند النقر</span>
                  <Switch checked={vibrationEnabled} onCheckedChange={setVibrationEnabled} />
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>

      {/* Bead icon */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="text-6xl">📿</div>

        {/* Counter */}
        <span
          className="text-8xl font-bold text-foreground tabular-nums"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          {count}
        </span>

        {/* Reset button */}
        <button
          className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleReset();
          }}
        >
          <RotateCcw size={20} />
        </button>
      </div>

      {/* Bottom verse */}
      <div className="p-6 text-center">
        <p className="text-sm text-primary leading-relaxed">
          "اذكروني أذكركم واشكروا لي ولا تكفرون" سورة البقرة، 152
        </p>
      </div>
    </div>
  );
};

export default Tasbih;
