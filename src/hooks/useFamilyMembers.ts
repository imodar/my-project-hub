import { useQuery } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
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
  locked?: boolean; // true when subscription expired and member count > free limit
}

export function useFamilyMembers({ excludeSelf = true } = {}) {
  const { user } = useAuth();
  const { familyId } = useFamilyId();

  const localMembers = useLiveQuery(
    async () => {
      if (!familyId) return [];
      const members = await db.family_members
        .where("family_id").equals(familyId)
        .toArray();
      if (members.length === 0) return [];

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

      if (excludeSelf && user) {
        return enriched.filter((m) => m.id !== user.id);
      }
      return enriched;
    },
    [familyId, user?.id, excludeSelf],
    [] as FamilyMemberInfo[]
  );

  interface MembersResult {
    members: FamilyMemberInfo[];
    subscriptionLocked: boolean;
  }

  const query = useQuery({
    queryKey: ["family-members-list", familyId, excludeSelf],
    queryFn: async (): Promise<MembersResult> => {
      if (!familyId) return { members: [], subscriptionLocked: false };

      // Guard against stale calls after logout
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) return { members: [], subscriptionLocked: false };

      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "get-members", family_id: familyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const members = data?.data || [];
      const creatorId = data?.created_by;
      const subscriptionLocked: boolean = data?.subscription_locked ?? false;

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

        // Clean up stale Dexie records not in server response
        const serverUserIds = new Set(members.map((m: any) => m.user_id));
        const localRecords = await db.family_members
          .where("family_id").equals(familyId)
          .toArray();
        const staleIds = localRecords
          .filter((r: any) => !serverUserIds.has(r.user_id))
          .map((r: any) => r.id);
        if (staleIds.length > 0) {
          await db.family_members.bulkDelete(staleIds);
        }

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

      return {
        members: filtered.map((m: any) => ({
          id: m.user_id,
          name: m.profiles?.name || ROLE_LABELS[m.role] || "عضو",
          role: m.role,
          isAdmin: m.is_admin || false,
          isCreator: m.user_id === creatorId,
          roleConfirmed: m.role_confirmed ?? true,
          status: m.status || "active",
          locked: m.locked || false,
        })),
        subscriptionLocked,
      };
    },
    enabled: !!familyId && !!user,
    placeholderData: localMembers.length > 0
      ? { members: localMembers, subscriptionLocked: false }
      : undefined,
  });

  // اعتبر البيانات جاهزة إذا توفّرت من Dexie (localMembers) حتى لو السيرفر لم يرد بعد
  const effectiveMembers = query.data?.members || localMembers;
  const isLoading = query.isPending && localMembers.length === 0;

  return {
    members: effectiveMembers,
    isLoading,
    refetch: query.refetch,
    subscriptionLocked: query.data?.subscriptionLocked ?? false,
  };
}
