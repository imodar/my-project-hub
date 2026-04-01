import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { ROLE_LABELS } from "@/contexts/UserRoleContext";
import { db } from "@/lib/db";

export interface FamilyMemberInfo {
  id: string; // user_id
  name: string;
  role: string;
  isAdmin: boolean;
  isCreator: boolean;
  roleConfirmed: boolean;
  status: string;
}

export function useFamilyMembers({ excludeSelf = true } = {}) {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const [localMembers, setLocalMembers] = useState<FamilyMemberInfo[]>([]);

  // Read from Dexie on mount for placeholder data
  useEffect(() => {
    if (!familyId) return;
    let cancelled = false;
    (async () => {
      try {
        const members = await db.family_members
          .where("family_id").equals(familyId)
          .toArray();
        if (cancelled || members.length === 0) return;

        const enriched = await Promise.all(
          members.map(async (m: any) => {
            const profile = await db.profiles.get(m.user_id).catch(() => null);
            return {
              id: m.user_id,
              name: profile?.name || ROLE_LABELS[m.role] || "عضو",
              role: m.role || "member",
              isAdmin: m.is_admin || false,
              isCreator: false,
              roleConfirmed: m.role_confirmed ?? true,
              status: m.status || "active",
            } as FamilyMemberInfo;
          })
        );

        let filtered = enriched;
        if (excludeSelf && user) {
          filtered = filtered.filter((m) => m.id !== user.id);
        }
        if (!cancelled) setLocalMembers(filtered);
      } catch {
        // Dexie read failed — no placeholder
      }
    })();
    return () => { cancelled = true; };
  }, [familyId, user?.id, excludeSelf]);

  const query = useQuery({
    queryKey: ["family-members-list", familyId, excludeSelf],
    queryFn: async (): Promise<FamilyMemberInfo[]> => {
      if (!familyId) return [];

      // Guard against stale calls after logout
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) return [];

      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "get-members", family_id: familyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const members = data?.data || [];
      const creatorId = data?.created_by;

      // Write to Dexie for offline use
      try {
        const dexieMembers = members.map((m: any) => ({
          id: m.id || m.user_id,
          family_id: familyId,
          user_id: m.user_id,
          role: m.role,
          is_admin: m.is_admin || false,
          role_confirmed: m.role_confirmed ?? true,
          status: m.status || "active",
          joined_at: m.joined_at || new Date().toISOString(),
        }));
        await db.family_members.bulkPut(dexieMembers);

        for (const m of members) {
          if (m.profiles?.name) {
            await db.profiles.put({ id: m.user_id, name: m.profiles.name, avatar_url: m.profiles.avatar_url || null });
          }
        }
      } catch {
        // Dexie write failed — non-critical
      }

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
        status: m.status || "active",
      }));
    },
    enabled: !!familyId && !!user,
    placeholderData: localMembers.length > 0 ? localMembers : undefined,
  });

  return { members: query.data || [], isLoading: query.isLoading, refetch: query.refetch };
}
