import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef } from "react";

const CACHE_KEY = "cached_family_id";

export function useFamilyId() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const creatingRef = useRef(false);

  // Synchronous fallback from localStorage — available at 0ms
  const cachedId = user ? localStorage.getItem(CACHE_KEY) : null;

  const query = useQuery({
    queryKey: ["family-id", user?.id],
    queryFn: async (): Promise<string | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("family_members")
        .select("family_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const fid = data?.family_id || null;
      // Cache for instant access on next visit
      if (fid) {
        localStorage.setItem(CACHE_KEY, fid);
      } else {
        localStorage.removeItem(CACHE_KEY);
      }
      return fid;
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000, // 30 min
  });

  // Auto-create a personal family for solo users
  useEffect(() => {
    if (!user || query.isLoading || query.data || creatingRef.current) return;
    creatingRef.current = true;

    const userName = user.user_metadata?.name || "عائلتي";

    supabase.functions.invoke("family-management", {
      body: { action: "create", name: userName, role: "father" },
    }).then(({ error }) => {
      if (!error) {
        qc.invalidateQueries({ queryKey: ["family-id", user.id] });
      }
      creatingRef.current = false;
    });
  }, [user, query.isLoading, query.data]);

  return {
    familyId: query.data ?? cachedId ?? null,
    isLoading: !cachedId && query.isLoading && !!user,
  };
}
