import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const EmptyState = ({ icon: Icon, title, description, action, className = "" }: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
  >
    <div className="w-20 h-20 rounded-full bg-muted/60 flex items-center justify-center mb-4">
      <Icon size={36} className="text-muted-foreground/35" />
    </div>
    <p className="text-base font-semibold text-foreground/70">{title}</p>
    {description && (
      <p className="text-sm text-muted-foreground mt-1.5 max-w-[240px] leading-relaxed">{description}</p>
    )}
    {action && (
      <button
        onClick={action.onClick}
        className="mt-5 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold active:scale-95 transition-transform shadow-sm"
      >
        {action.label}
      </button>
    )}
  </motion.div>
);

export default EmptyState;
