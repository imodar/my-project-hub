import React, { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SyncStatus from "@/components/SyncStatus";

interface HeaderAction {
  icon: ReactNode;
  onClick: () => void;
  style?: React.CSSProperties;
  className?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: HeaderAction[];
  children?: ReactNode;
  onBack?: () => void;
  showSyncStatus?: boolean;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, subtitle, actions, children, onBack, showSyncStatus = true }, ref) => {
    const navigate = useNavigate();

    return (
      <div
        ref={ref}
        className="sticky top-0 z-50 px-4 pt-12 pb-3 rounded-b-3xl"
      style={{
        background: "linear-gradient(135deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)))",
      }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onBack ?? (() => navigate(-1))}
          className="p-1.5 rounded-full shrink-0"
          style={{ background: "hsla(0,0%,100%,0.12)" }}
        >
          <ArrowRight size={20} className="text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white">{title}</h1>
          {subtitle && <p className="text-xs text-white/70">{subtitle}</p>}
        </div>
        {showSyncStatus && <SyncStatus className="opacity-80" />}
        {actions?.map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            className={`p-1.5 rounded-full shrink-0 ${action.className ?? ""}`}
            style={{ background: "hsla(0,0%,100%,0.12)", ...action.style }}
          >
            {action.icon}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
};

export default PageHeader;
