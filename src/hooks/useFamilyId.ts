import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const CACHE_KEY = "cached_family_id";

interface FamilyIdData {
  family_id: string | null;
  pending_family_id: string | null;
}

export function useFamilyId() {
  const { user } = useAuth();

  // Synchronous fallback from localStorage — available at 0ms
  const cachedId = user ? localStorage.getItem(CACHE_KEY) : null;

  const query = useQuery({
    queryKey: ["family-id", user?.id],
    queryFn: async (): Promise<FamilyIdData> => {
      if (!user) return { family_id: null, pending_family_id: null };
      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "get-family-id" },
      });
      if (error) throw error;
      const fid = data?.data?.family_id || null;
      const pendingFid = data?.data?.pending_family_id || null;
      // Cache for instant access on next visit
      if (fid) {
        localStorage.setItem(CACHE_KEY, fid);
      } else {
        localStorage.removeItem(CACHE_KEY);
      }
      return { family_id: fid, pending_family_id: pendingFid };
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000, // 30 min
  });

  return {
    familyId: query.data?.family_id ?? cachedId ?? null,
    pendingFamilyId: query.data?.pending_family_id ?? null,
    isLoading: !cachedId && query.isLoading && !!user,
  };
}
