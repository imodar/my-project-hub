import React, { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { setSentryUser } from "@/lib/errorReporting";
import { getLocalBootstrap } from "@/lib/localBootstrap";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profileReady: boolean;
  profileName: string;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(() => {
    const hasSession = !!localStorage.getItem("sb-ptmhrfovbyvpewfdpejf-auth-token");
    const hasProfile = !!localStorage.getItem("profile_complete");
    return hasSession && hasProfile;
  });
  const [profileName, setProfileName] = useState("");
  const fetchingRef = useRef(false);
  const initialFetchDoneRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      // 1. localStorage (fastest)
      let cached = localStorage.getItem(`profile_name_${userId}`);

      // 2. Dexie fallback if no localStorage
      if (!cached) {
        try {
          const localProfile = await db.profiles.get(userId);
          if (localProfile?.name) {
            cached = localProfile.name as string;
            localStorage.setItem(`profile_name_${userId}`, cached);
          }
        } catch {}
      }

      if (cached) {
        setProfileName(cached);
        setProfileReady(true);
        localStorage.setItem("profile_complete", "true");
        initialFetchDoneRef.current = true;
      }

      // Background network update (non-blocking if cache exists)
      const networkFetch = async (): Promise<boolean> => {
        try {
          const { data, error } = await supabase.functions.invoke("auth-management", {
            body: { action: "get-profile" },
          });
          if (!error && data?.data?.name) {
            setProfileName(data.data.name);
            localStorage.setItem(`profile_name_${userId}`, data.data.name);
            localStorage.setItem("profile_complete", "true");
            // Write to Dexie for local-first bootstrap
            try {
              await db.profiles.put({
                id: userId,
                name: data.data.name,
                phone: data.data.phone || null,
                avatar_url: data.data.avatar_url || null,
              });
            } catch {}
            return true;
          }
        } catch {
          // offline — use cached value
        }
        return false;
      };

      if (cached) {
        // Update in background silently
        networkFetch();
      } else {
        // No cache — must wait for network
        const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000));
        let success = await Promise.race([networkFetch(), timeout]);

        // Retry once if failed (token may not have been ready)
        if (!success) {
          await new Promise((r) => setTimeout(r, 1200));
          const timeout2 = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000));
          await Promise.race([networkFetch(), timeout2]);
        }

        setProfileReady(true);
        initialFetchDoneRef.current = true;
      }
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    fetchingRef.current = false; // allow re-fetch
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  }, [session?.user?.id, fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setLoading(false);
        if (newSession?.user?.id) {
          setSentryUser({ id: newSession.user.id, email: newSession.user.email });
          if (event === "SIGNED_IN") {
            qc.clear();
            // Reset profile state for new session to prevent stale profileReady=true
            setProfileReady(false);
            initialFetchDoneRef.current = false;
            fetchingRef.current = false;
            // Clear sync_meta so all tables do a full sync instead of delta
            db.sync_meta.clear().catch(() => {});
            fetchProfile(newSession.user.id);
          }
        } else {
          qc.clear();
          setSentryUser(null);
          setProfileName("");
          setProfileReady(false);
          initialFetchDoneRef.current = false;
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setLoading(false);
      if (existingSession?.user?.id) {
        setProfileReady(false);
        fetchProfile(existingSession.user.id);
      } else {
        setProfileReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, qc]);

  const signOut = async () => {
    setProfileName("");
    setSentryUser(null);
    try {
      await Promise.all([
        db.medications.clear(),
        db.medication_logs.clear(),
        db.task_lists.clear(),
        db.task_items.clear(),
        db.market_lists.clear(),
        db.market_items.clear(),
        db.calendar_events.clear(),
        db.budgets.clear(),
        db.budget_expenses.clear(),
        db.debts.clear(),
        db.debt_payments.clear(),
        db.trips.clear(),
        db.trip_day_plans.clear(),
        db.trip_activities.clear(),
        db.trip_expenses.clear(),
        db.trip_packing.clear(),
        db.trip_documents.clear(),
        db.trip_suggestions.clear(),
        db.chat_messages.clear(),
        db.vehicles.clear(),
        db.albums.clear(),
        db.album_photos.clear(),
        db.document_lists.clear(),
        db.document_items.clear(),
        db.document_files.clear(),
        db.places.clear(),
        db.place_lists.clear(),
        db.vaccinations.clear(),
        db.zakat_assets.clear(),
        db.will_sections.clear(),
        db.tasbih_sessions.clear(),
        db.kids_worship_data.clear(),
        db.prayer_logs.clear(),
        db.emergency_contacts.clear(),
        db.family_members.clear(),
        db.families.clear(),
        db.profiles.clear(),
        db.sync_meta.clear(),
        db.sync_queue.clear(),
      ]);
    } catch {
      // silent — logout should always succeed
    }
    // Clear all cached profile names
    Object.keys(localStorage)
      .filter(k => k.startsWith('profile_name_'))
      .forEach(k => localStorage.removeItem(k));
    localStorage.removeItem("cached_family_id");
    localStorage.removeItem("first_sync_done");
    localStorage.removeItem("join_or_create_done");
    localStorage.removeItem("profile_complete");
    qc.clear();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        profileReady,
        profileName,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
