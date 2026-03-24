import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";

export interface FamilyMemberInfo {
  id: string; // user_id
  name: string;
  role: string;
  isAdmin: boolean;
  isCreator: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  father: "أب",
  mother: "أم",
  son: "ابن",
  daughter: "ابنة",
  husband: "زوج",
  wife: "زوجة",
  worker: "عامل",
  maid: "خادمة",
  driver: "سائق",
};

export function useFamilyMembers({ excludeSelf = true } = {}) {
  const { user } = useAuth();
  const { familyId } = useFamilyId();

  const query = useQuery({
    queryKey: ["family-members-list", familyId, excludeSelf],
    queryFn: async (): Promise<FamilyMemberInfo[]> => {
      if (!familyId) return [];

      // Get family creator
      const { data: family } = await supabase
        .from("families")
        .select("created_by")
        .eq("id", familyId)
        .single();
      const creatorId = family?.created_by;

      const { data: members, error } = await supabase
        .from("family_members")
        .select("user_id, role, is_admin")
        .eq("family_id", familyId)
        .eq("status", "active");
      if (error) throw error;

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
        };
      });
    },
    enabled: !!familyId && !!user,
  });

  return { members: query.data || [], isLoading: query.isLoading, refetch: query.refetch };
}
