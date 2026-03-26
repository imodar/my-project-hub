import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/contexts/UserRoleContext";

interface MyRoleResult {
  dbRole: UserRole | null;
  isAdmin: boolean;
  isLoading: boolean;
}

export function useMyRole(): MyRoleResult {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["my-family-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "get-my-role" },
      });
      if (error) throw error;
      return data?.data || null;
    },
    enabled: !!user?.id,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  return {
    dbRole: (query.data?.role as UserRole) ?? null,
    isAdmin: query.data?.is_admin ?? false,
    isLoading: query.isLoading,
  };
}
