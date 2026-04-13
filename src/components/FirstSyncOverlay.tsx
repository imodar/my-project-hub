import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useInitialSync } from "@/hooks/useInitialSync";
import { useFamilyId } from "@/hooks/useFamilyId";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { getMeaningfulLocalDataState } from "@/lib/meaningfulLocalData";
import PermissionsScreen from "@/components/PermissionsScreen";

interface FirstSyncOverlayProps {
  onInitialSyncReady?: () => void;
}

const FirstSyncOverlay = React.forwardRef<HTMLDivElement, FirstSyncOverlayProps>(({ onInitialSyncReady }, fwdRef) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { familyId, isLoading: familyLoading } = useFamilyId();
  const { state, run, progress } = useInitialSync();
  const startedRef = useRef(false);
  const [isEmptyDevice, setIsEmptyDevice] = useState<boolean | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);

  useEffect(() => {
    startedRef.current = false;
    setIsEmptyDevice(null);
  }, [user?.id, familyId]);

  // Check if device actually has meaningful data before showing overlay
  useEffect(() => {
    if (!user || !familyId) return;
    getMeaningfulLocalDataState()
      .then(({ hasMeaningfulLocalData }) => {
        setIsEmptyDevice(!hasMeaningfulLocalData);
      })
      .catch(() => setIsEmptyDevice(true));
  }, [user, familyId]);

  useEffect(() => {
    if (!user || !familyId || startedRef.current) return;
    if (isEmptyDevice === null) return; // still checking
    startedRef.current = true;
    run(user.id, familyId);
  }, [user, familyId, run, isEmptyDevice]);

  useEffect(() => {
    if (user && state === "done") {
      // After sync, check if permissions were already requested
      const permissionsRequested = !!localStorage.getItem("permissions_requested");
      if (!permissionsRequested && isEmptyDevice === true) {
        // First time on new device — show permissions screen
        setShowPermissions(true);
      } else {
        onInitialSyncReady?.();
      }
    }
  }, [user, state, onInitialSyncReady, isEmptyDevice]);

  const handlePermissionsComplete = () => {
    setShowPermissions(false);
    onInitialSyncReady?.();
  };

  const firstSyncDone = !!localStorage.getItem("first_sync_done");
  const waitingForInitialCheck = !!user && !firstSyncDone && (familyLoading || (!!familyId && isEmptyDevice === null));
  const visible = waitingForInitialCheck || (isEmptyDevice === true && state !== "done");

  const message = state === "syncing"
    ? t.sync.syncingData
    : t.sync.preparingDevice;

  return (
    <div ref={fwdRef}>
      <AnimatePresence>
        {showPermissions && (
          <PermissionsScreen onComplete={handlePermissionsComplete} />
        )}
        {visible && !showPermissions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-background"
          >
            <div className="flex flex-col items-center gap-6 px-8 max-w-sm text-center">
              <span className="text-5xl">🏠</span>
              <h2 className="text-xl font-bold text-foreground">
                {t.sync.welcomeFamily}
              </h2>
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={18} className="animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {message}
                </p>
                {state === "new_user" && (
                  <>
                    <Progress value={progress.current} className="w-48 h-2" />
                    <p className="text-xs text-muted-foreground">
                      {progress.label} — {progress.current}%
                    </p>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

FirstSyncOverlay.displayName = "FirstSyncOverlay";

export default FirstSyncOverlay;
