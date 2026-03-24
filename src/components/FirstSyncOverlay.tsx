import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/db";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";

const CORE_TABLES = [
  "task_lists",
  "market_lists",
  "calendar_events",
  "budgets",
  "debts",
  "medications",
  "trips",
  "chat_messages",
] as const;

const TOTAL = CORE_TABLES.length;
const MAX_WAIT_MS = 8000;

const FirstSyncOverlay = () => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!user || checkedRef.current) return;
    checkedRef.current = true;

    if (localStorage.getItem("first_sync_done") === "true") return;

    // Brand new account (< 2 min old) → skip overlay forever
    const accountCreatedAt = user?.created_at
      ? new Date(user.created_at).getTime()
      : Date.now();
    const isNewAccount = Date.now() - accountCreatedAt < 2 * 60 * 1000;

    if (isNewAccount) {
      localStorage.setItem("first_sync_done", "true");
      return;
    }

    (async () => {
      try {
        const count = await db.task_lists.count();
        if (count > 0) {
          localStorage.setItem("first_sync_done", "true");
          return;
        }
      } catch {
        return;
      }

      setVisible(true);

      const timeout = setTimeout(() => {
        localStorage.setItem("first_sync_done", "true");
        setVisible(false);
      }, MAX_WAIT_MS);

      const poll = setInterval(async () => {
        let loaded = 0;
        for (const t of CORE_TABLES) {
          try {
            const c = await (db as any)[t].count();
            if (c > 0) loaded++;
          } catch { /* skip */ }
        }
        setSyncedCount(loaded);
        if (loaded >= TOTAL) {
          clearInterval(poll);
          clearTimeout(timeout);
          localStorage.setItem("first_sync_done", "true");
          setTimeout(() => setVisible(false), 600);
        }
      }, 800);

      return () => {
        clearInterval(poll);
        clearTimeout(timeout);
      };
    })();
  }, [user]);

  return (
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
              أهلاً بك في عائلتي
            </h2>
            <p className="text-sm text-muted-foreground">
              جاري جلب بيانات عائلتك لأول مرة...
            </p>
            <div className="w-full">
              <Progress value={(syncedCount / TOTAL) * 100} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground" dir="ltr">
              {syncedCount} من {TOTAL} قسم
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FirstSyncOverlay;
