import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { haptic } from "@/lib/haptics";

interface FABAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: string;
}

interface FABProps {
  onClick?: () => void;
  actions?: FABAction[];
  icon?: React.ReactNode;
  show?: boolean;
}

const FAB = ({ onClick, actions, icon, show = true }: FABProps) => {
  const [open, setOpen] = useState(false);

  if (!show) return null;

  const handleClick = () => {
    haptic.medium();
    if (actions) {
      setOpen(!open);
    } else {
      onClick?.();
    }
  };

  return createPortal(
    <>
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="fixed z-50 flex flex-col items-center gap-2" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)", left: "16px" }}>
        {open && actions && (
          <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={() => {
                  haptic.medium();
                  action.onClick();
                  setOpen(false);
                }}
                aria-label={action.label}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-bold text-white whitespace-nowrap ${action.color ?? "bg-primary"}`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleClick}
          aria-label="إضافة جديد"
          className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-xl flex items-center justify-center transition-transform active:scale-95"
        >
          {actions ? (
            <Plus
              size={26}
              className={`transition-transform duration-200 ${open ? "rotate-45" : ""}`}
            />
          ) : (
            icon ?? <Plus size={24} />
          )}
        </button>
      </div>
    </>,
    document.body
  );
};

export default FAB;
