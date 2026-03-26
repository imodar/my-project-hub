import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const CACHE_KEY = "cached_family_id";

export function useFamilyId() {
  const { user } = useAuth();

  // Synchronous fallback from localStorage — available at 0ms
  const cachedId = user ? localStorage.getItem(CACHE_KEY) : null;

  const query = useQuery({
    queryKey: ["family-id", user?.id],
    queryFn: async (): Promise<string | null> => {
      if (!user) return null;
      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "get-family-id" },
      });
      if (error) throw error;
      const fid = data?.data?.family_id || null;
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

  return {
    familyId: query.data ?? cachedId ?? null,
    isLoading: !cachedId && query.isLoading && !!user,
  };
}
