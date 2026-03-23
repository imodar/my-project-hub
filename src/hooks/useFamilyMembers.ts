import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";

export interface FamilyMemberInfo {
  id: string;
  name: string;
  role: string;
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
      const { data: members, error } = await supabase
        .from("family_members")
        .select("user_id, role")
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

      return (profiles || []).map((p) => {
        const memberRole = filtered.find((m) => m.user_id === p.id)?.role || "";
        return {
          id: p.id,
          name: p.name || ROLE_LABELS[memberRole] || "عضو",
          role: memberRole,
        };
      });
    },
    enabled: !!familyId && !!user,
  });

  return { members: query.data || [], isLoading: query.isLoading };
}
