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

      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "get-members", family_id: familyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const members = data?.data || [];
      const creatorId = data?.created_by;

      let filtered = members;
      if (excludeSelf && user) {
        filtered = filtered.filter((m: any) => m.user_id !== user.id);
      }

      return filtered.map((m: any) => ({
        id: m.user_id,
        name: m.profiles?.name || ROLE_LABELS[m.role] || "عضو",
        role: m.role,
        isAdmin: m.is_admin || false,
        isCreator: m.user_id === creatorId,
        roleConfirmed: m.role_confirmed ?? true,
      }));
    },
    enabled: !!familyId && !!user,
  });

  return { members: query.data || [], isLoading: query.isLoading, refetch: query.refetch };
}
