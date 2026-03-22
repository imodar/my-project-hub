import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useFamilyId() {
  const { user } = useAuth();

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
      return data?.family_id || null;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  return {
    familyId: query.data ?? null,
    isLoading: query.isLoading,
  };
}
