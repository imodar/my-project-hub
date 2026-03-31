import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, profileReady, profileName } = useAuth();
  const location = useLocation();
  const [familyChecked, setFamilyChecked] = useState(false);
  const [familyExists, setFamilyExists] = useState(false);
  const [offlineEmpty, setOfflineEmpty] = useState(false);

  // Check family membership: localStorage → Dexie → API
  useEffect(() => {
    const cachedFamilyId = localStorage.getItem("cached_family_id");
    const joinDone = localStorage.getItem("join_or_create_done");

    if (cachedFamilyId || joinDone) {
      setFamilyExists(true);
      setFamilyChecked(true);
      return;
    }

    if (!session) {
      setFamilyChecked(true);
      return;
    }

    let cancelled = false;

    const checkFamily = async () => {
      // Step 1: Check Dexie first (local, no network)
      try {
        const localMember = await db.family_members
          .where("user_id")
          .equals(session.user.id)
          .first();
        if (localMember?.family_id) {
          localStorage.setItem("cached_family_id", localMember.family_id as string);
          localStorage.setItem("join_or_create_done", "true");
          if (!cancelled) {
            setFamilyExists(true);
            setFamilyChecked(true);
          }
          return;
        }
      } catch {}

      // Step 2: No local data — check network
      if (!navigator.onLine) {
        // Offline + no local data = empty device
        if (!cancelled) {
          setOfflineEmpty(true);
          setFamilyChecked(true);
        }
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("family-management", {
          body: { action: "get-family-id" },
        });
        if (cancelled) return;
        if (!error && data?.data?.family_id) {
          localStorage.setItem("cached_family_id", data.data.family_id);
          localStorage.setItem("join_or_create_done", "true");
          // Write to Dexie
          try {
            await db.family_members.put({
              id: crypto.randomUUID(),
              family_id: data.data.family_id,
              user_id: session.user.id,
              status: "active",
            });
          } catch {}
          setFamilyExists(true);
        }
      } catch {
        // Network error — assume no family
      }
      if (!cancelled) setFamilyChecked(true);
    };

    // Timeout after 5 seconds
    const timeout = setTimeout(() => { cancelled = true; setFamilyChecked(true); }, 5000);
    checkFamily();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    const hasSeenOnboarding = localStorage.getItem("onboarding_seen") === "true";
    if (!hasSeenOnboarding) {
      return <Navigate to="/get-started" replace />;
    }
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Mark that user has logged in at least once (so onboarding won't show again)
  if (!localStorage.getItem("onboarding_seen")) {
    localStorage.setItem("onboarding_seen", "true");
  }

  // Wait for profile fetch from DB before deciding
  if (!profileReady) return null;

  // Profile completion check — use DB-backed profileName with localStorage fallback
  const effectiveProfileName =
    profileName || (session?.user?.id ? localStorage.getItem(`profile_name_${session.user.id}`) ?? "" : "");
  if (!effectiveProfileName) {
    return <Navigate to="/complete-profile" replace />;
  }

  // Family onboarding check — wait for check to complete
  if (!familyChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // Offline + empty device
  if (offlineEmpty) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6" dir="rtl">
        <div className="text-center space-y-4">
          <span className="text-5xl">📡</span>
          <h2 className="text-xl font-bold text-foreground">لا توجد بيانات على هذا الجهاز</h2>
          <p className="text-sm text-muted-foreground">
            يحتاج الجهاز اتصال بالإنترنت للمرة الأولى لتحميل بياناتك
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (!familyExists) {
    return <Navigate to="/join-or-create" replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
