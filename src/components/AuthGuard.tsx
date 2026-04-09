import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, profileReady, profileName } = useAuth();
  const location = useLocation();

  // ── Synchronous family check from localStorage ──
  const cachedFamilyId = localStorage.getItem("cached_family_id");
  const joinDone = localStorage.getItem("join_or_create_done");

  // Background fetch state — only for "joinDone but no cachedFamilyId" case
  const [bgFetchDone, setBgFetchDone] = useState(false);
  const [bgFamilyFound, setBgFamilyFound] = useState(false);

  // Background fetch: joinDone exists but cached_family_id is missing
  useEffect(() => {
    if (cachedFamilyId || !joinDone || !session) return;

    let cancelled = false;

    const fetchFamilyId = async () => {
      // Try Dexie first (fast, no network)
      try {
        const localMember = await db.family_members
          .where("user_id")
          .equals(session.user.id)
          .first();
        if (localMember?.family_id) {
          localStorage.setItem("cached_family_id", localMember.family_id as string);
          if (!cancelled) { setBgFamilyFound(true); setBgFetchDone(true); }
          return;
        }
      } catch { /* non-critical */ }

      // Try API
      if (navigator.onLine) {
        try {
          const { data, error } = await supabase.functions.invoke("family-management", {
            body: { action: "get-family-id" },
          });
          if (!cancelled && !error && data?.data?.family_id) {
            localStorage.setItem("cached_family_id", data.data.family_id);
            localStorage.setItem("join_or_create_done", "true");
            try {
              await db.family_members.put({
                id: crypto.randomUUID(),
                family_id: data.data.family_id,
                user_id: session.user.id,
                status: "active",
              });
            } catch { /* non-critical */ }
            setBgFamilyFound(true);
          }
        } catch { /* non-critical */ }
      }

      if (!cancelled) setBgFetchDone(true);
    };

    const timeout = setTimeout(() => { cancelled = true; setBgFetchDone(true); }, 5000);
    fetchFamilyId();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [cachedFamilyId, joinDone, session]);

  // ── Loading: wait for auth only ──
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

  // Mark that user has logged in at least once
  if (!localStorage.getItem("onboarding_seen")) {
    localStorage.setItem("onboarding_seen", "true");
  }

  // Wait for profile fetch from DB before deciding
  if (!profileReady) return null;

  // Profile completion check
  const effectiveProfileName =
    profileName || (session?.user?.id ? localStorage.getItem(`profile_name_${session.user.id}`) ?? "" : "");
  if (!effectiveProfileName) {
    return <Navigate to="/complete-profile" replace />;
  }

  // ── Family check — 3 tiers (all synchronous except tier 2 background) ──

  // Tier 1: cached_family_id exists → instant render
  if (cachedFamilyId) {
    return <>{children}</>;
  }

  // Tier 2: join_or_create_done exists but no cached_family_id → show children + background fetch
  if (joinDone) {
    // If background fetch found no family, redirect
    if (bgFetchDone && !bgFamilyFound) {
      return <Navigate to="/join-or-create" replace />;
    }
    // Show children while fetching (or after family found)
    return <>{children}</>;
  }

  // Tier 3: New user — immediate redirect, no flash
  return <Navigate to="/join-or-create" replace />;
};

export default AuthGuard;
