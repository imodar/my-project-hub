import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { setSentryUser } from "@/lib/errorReporting";

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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [profileName, setProfileName] = useState("");

  const fetchProfile = useCallback(async (userId: string) => {
    // Try localStorage first (instant, works offline)
    const cached = localStorage.getItem(`profile_name_${userId}`);
    if (cached) {
      setProfileName(cached);
      localStorage.setItem("profile_complete", "true");
    }

    // Race network fetch against a 5s timeout so offline users aren't stuck
    const networkFetch = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("auth-management", {
          body: { action: "get-profile" },
        });
        if (!error && data?.data?.name) {
          setProfileName(data.data.name);
          localStorage.setItem(`profile_name_${userId}`, data.data.name);
          localStorage.setItem("profile_complete", "true");
        }
      } catch {
        // offline — use cached value already set above
      }
    };

    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));

    await Promise.race([networkFetch(), timeout]);
    setProfileReady(true);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  }, [session?.user?.id, fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setLoading(false);
        if (newSession?.user?.id) {
          setSentryUser({ id: newSession.user.id, email: newSession.user.email });
          fetchProfile(newSession.user.id);
        } else {
          setSentryUser(null);
          setProfileName("");
          setProfileReady(true);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setLoading(false);
      if (existingSession?.user?.id) {
        fetchProfile(existingSession.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

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
