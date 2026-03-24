import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

const AuthGuard = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(({ children }, _ref) => {
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

  return <>{children}</>;
};

export default AuthGuard;
