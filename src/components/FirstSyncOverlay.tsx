import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useInitialSync } from "@/hooks/useInitialSync";
import { useFamilyId } from "@/hooks/useFamilyId";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/db";

const FirstSyncOverlay = React.forwardRef<HTMLDivElement>((_props, fwdRef) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { familyId } = useFamilyId();
  const { state, run, progress } = useInitialSync();
  const startedRef = useRef(false);
  const [isEmptyDevice, setIsEmptyDevice] = useState<boolean | null>(null);

  // Check if device actually has data before showing overlay
  useEffect(() => {
    if (!user || !familyId) return;
    Promise.all([
      db.task_lists.count().catch(() => 0),
      db.market_lists.count().catch(() => 0),
      db.family_members.count().catch(() => 0),
    ]).then(([t, m, f]) => {
      setIsEmptyDevice((t + m + f) === 0);
    }).catch(() => setIsEmptyDevice(true));
  }, [user, familyId]);

  useEffect(() => {
    if (!user || !familyId || startedRef.current) return;
    if (isEmptyDevice === null) return; // still checking
    startedRef.current = true;
    run(user.id, familyId);
  }, [user, familyId, run, isEmptyDevice]);

  // Only show overlay if device is empty AND sync is happening
  const visible = isEmptyDevice === true && (state === "new_user" || state === "syncing");

  const message = state === "new_user"
    ? t.sync.preparingDevice
    : t.sync.syncingData;

  return (
    <div ref={fwdRef}>
      <AnimatePresence>
        {visible && (
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
