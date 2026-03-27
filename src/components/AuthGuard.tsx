import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, profileReady, profileName } = useAuth();
  const location = useLocation();
  const [familyChecked, setFamilyChecked] = useState(false);
  const [familyExists, setFamilyExists] = useState(false);

  // Check family membership via API when localStorage is missing
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

    // No local data — check API
    let cancelled = false;
    const checkFamily = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("family-management", {
          body: { action: "get-family-id" },
        });
        if (cancelled) return;
        if (!error && data?.data?.family_id) {
          localStorage.setItem("cached_family_id", data.data.family_id);
          localStorage.setItem("join_or_create_done", "true");
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
  if (!profileReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // Profile completion check — use DB-backed profileName
  if (!profileName) {
    return <Navigate to="/complete-profile" replace />;
  }

  // Family onboarding check — wait for API check to complete
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

  if (!familyExists) {
    return <Navigate to="/join-or-create" replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
