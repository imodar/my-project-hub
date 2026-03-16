import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, RotateCcw, MoreVertical, BarChart3 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

const Tasbih = () => {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

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
    setCount(0);
  };

  return (
    <div
      className="min-h-screen max-w-md mx-auto relative flex flex-col select-none cursor-pointer"
      style={{
        background: "linear-gradient(180deg, hsl(40, 20%, 97%) 0%, hsl(40, 20%, 97%) 60%, hsl(155, 30%, 85%) 100%)",
      }}
      onClick={handleTap}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 relative z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1 px-3 py-2 rounded-2xl"
              style={{
                background: "hsla(0,0%,0%,0.05)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical size={18} className="text-foreground" />
              <BarChart3 size={18} className="text-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56 max-w-[calc(100vw-2rem)]" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem className="flex items-center justify-between" onSelect={(e) => e.preventDefault()}>
              <span>صوت النقر</span>
              <Switch
                checked={soundEnabled}
                onCheckedChange={setSoundEnabled}
              />
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center justify-between" onSelect={(e) => e.preventDefault()}>
              <span>الاهتزاز عند النقر</span>
              <Switch
                checked={vibrationEnabled}
                onCheckedChange={setVibrationEnabled}
              />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          className="flex items-center gap-2 px-3 py-2 rounded-2xl"
          style={{
            background: "hsla(0,0%,0%,0.05)",
          }}
          onClick={(e) => {
            e.stopPropagation();
            navigate("/");
          }}
        >
          <span className="text-sm font-semibold text-foreground">العودة</span>
          <ChevronRight size={18} className="text-foreground" />
        </button>
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
