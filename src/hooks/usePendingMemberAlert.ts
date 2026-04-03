import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useUserRole } from "@/contexts/UserRoleContext";

/**
 * Global Realtime listener: when a new pending member joins,
 * navigate the admin to /family so the existing drawer auto-opens.
 */
export function usePendingMemberAlert() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user || !familyId || !isAdmin) return;

    channelRef.current = supabase
      .channel(`pending-alert-${familyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "family_members",
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          if (payload.new?.status !== "pending") return;

          // Refresh member list so the drawer picks up the new pending member
          qc.invalidateQueries({ queryKey: ["family-members-list", familyId] });

          // If admin is not already on /family, navigate there
          if (location.pathname !== "/family") {
            navigate("/family");
          }
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, familyId, isAdmin, qc, navigate, location.pathname]);
}
