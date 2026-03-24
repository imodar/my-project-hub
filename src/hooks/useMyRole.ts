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
      const { data, error } = await supabase
        .from("family_members")
        .select("role, is_admin")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    dbRole: (query.data?.role as UserRole) ?? null,
    isAdmin: query.data?.is_admin ?? false,
    isLoading: query.isLoading,
  };
}
