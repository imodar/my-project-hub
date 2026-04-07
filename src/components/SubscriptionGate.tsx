import React, { useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import UpgradePromptSheet from "./UpgradePromptSheet";

interface SubscriptionGateProps {
  children: React.ReactNode;
  /** A descriptive feature name shown in the upgrade prompt */
  feature?: string;
  /** If true, renders children but overlays an upgrade prompt instead of hiding them */
  overlay?: boolean;
}

/**
 * Wraps any feature that requires a paid subscription.
 * - If the user is subscribed, renders children normally.
 * - If not subscribed, shows the upgrade prompt when children are interacted with.
 *
 * Usage:
 *   <SubscriptionGate feature="add_member">
 *     <AddMemberButton />
 *   </SubscriptionGate>
 */
export default function SubscriptionGate({ children, feature, overlay = false }: SubscriptionGateProps) {
  const { isSubscribed, isLoading } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);

  // While loading, render children normally (optimistic — avoids flicker)
  if (isLoading || isSubscribed) {
    return <>{children}</>;
  }

  if (overlay) {
    return (
      <>
        <div className="relative">
          <div className="pointer-events-none opacity-50 select-none">{children}</div>
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={() => setShowUpgrade(true)}
          >
            <div className="bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span>🔒</span>
              <span>يتطلب اشتراكاً</span>
            </div>
          </div>
        </div>
        <UpgradePromptSheet open={showUpgrade} onClose={() => setShowUpgrade(false)} feature={feature} />
      </>
    );
  }

  // Intercept clicks on children — wrap them in a clickable div
  return (
    <>
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowUpgrade(true);
        }}
        className="contents"
      >
        {children}
      </div>
      <UpgradePromptSheet open={showUpgrade} onClose={() => setShowUpgrade(false)} feature={feature} />
    </>
  );
}
