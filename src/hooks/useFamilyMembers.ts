import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { ROLE_LABELS } from "@/contexts/UserRoleContext";

export interface FamilyMemberInfo {
  id: string; // user_id
  name: string;
  role: string;
  isAdmin: boolean;
  isCreator: boolean;
  roleConfirmed: boolean;
}

export function useFamilyMembers({ excludeSelf = true } = {}) {
  const { user } = useAuth();
  const { familyId } = useFamilyId();

  const query = useQuery({
    queryKey: ["family-members-list", familyId, excludeSelf],
    queryFn: async (): Promise<FamilyMemberInfo[]> => {
      if (!familyId) return [];

      const { data: members, error } = await supabase
        .from("family_members")
        .select("user_id, role, is_admin, role_confirmed, families!inner(created_by)")
        .eq("family_id", familyId)
        .eq("status", "active");
      if (error) throw error;

      const creatorId = (members?.[0] as any)?.families?.created_by;

      let filtered = members || [];
      if (excludeSelf && user) {
        filtered = filtered.filter((m) => m.user_id !== user.id);
      }

      if (filtered.length === 0) return [];

      const userIds = filtered.map((m) => m.user_id);
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);
      if (pErr) throw pErr;

      return filtered.map((m) => {
        const profile = (profiles || []).find((p) => p.id === m.user_id);
        return {
          id: m.user_id,
          name: profile?.name || ROLE_LABELS[m.role] || "عضو",
          role: m.role,
          isAdmin: m.is_admin || false,
          isCreator: m.user_id === creatorId,
          roleConfirmed: (m as any).role_confirmed ?? true,
        };
      });
    },
    enabled: !!familyId && !!user,
  });

  return { members: query.data || [], isLoading: query.isLoading, refetch: query.refetch };
}
