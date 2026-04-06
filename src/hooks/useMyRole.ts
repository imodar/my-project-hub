import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { db } from "@/lib/db";
import type { UserRole } from "@/contexts/UserRoleContext";

interface MyRoleResult {
  dbRole: UserRole | null;
  isAdmin: boolean;
  isLoading: boolean;
}

export function useMyRole(): MyRoleResult {
  const { user } = useAuth();
  const { familyId } = useFamilyId();

  // Local Dexie placeholder
  const [localRole, setLocalRole] = useState<{ role: string; is_admin: boolean } | null>(null);
  useEffect(() => {
    if (!user?.id || !familyId) return;
    let cancelled = false;
    db.family_members
      .where("user_id").equals(user.id)
      .filter((m: any) => m.family_id === familyId)
      .first()
      .then((member: any) => {
        if (!cancelled && member) {
          setLocalRole({ role: member.role, is_admin: member.is_admin });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id, familyId]);

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
    staleTime: 60 * 60 * 1000, // Role rarely changes — 1 hour
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: localRole,
  });

  return {
    dbRole: (query.data?.role as UserRole) ?? null,
    isAdmin: query.data?.is_admin ?? false,
    isLoading: query.isLoading && !localRole,
  };
}
