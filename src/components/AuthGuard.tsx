import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

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

  // Profile completion check — synchronous localStorage only
  const profileComplete = localStorage.getItem("profile_complete");
  const cachedName = localStorage.getItem(`profile_name_${session.user.id}`);
  if (!profileComplete && !cachedName) {
    return <Navigate to="/complete-profile" replace />;
  }

  // Family onboarding check — synchronous localStorage only (no hooks/queries)
  const joinDone = localStorage.getItem("join_or_create_done");
  const cachedFamilyId = localStorage.getItem("cached_family_id");
  if (!joinDone) {
    if (cachedFamilyId) {
      localStorage.setItem("join_or_create_done", "true");
    } else {
      return <Navigate to="/join-or-create" replace />;
    }
  }

  return <>{children}</>;
};

export default AuthGuard;
