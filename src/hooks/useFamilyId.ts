import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef } from "react";

export function useFamilyId() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const creatingRef = useRef(false);

  const query = useQuery({
    queryKey: ["family-id", user?.id],
    queryFn: async (): Promise<string | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("family_members")
        .select("family_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.family_id || null;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  // Auto-create a personal family for solo users
  useEffect(() => {
    if (!user || query.isLoading || query.data || creatingRef.current) return;
    creatingRef.current = true;

    const userName = user.user_metadata?.name || "عائلتي";

    supabase.functions.invoke("family-management", {
      body: { action: "create", name: userName, role: "father" },
    }).then(({ error }) => {
      if (!error) {
        qc.invalidateQueries({ queryKey: ["family-id", user.id] });
      }
      creatingRef.current = false;
    });
  }, [user, query.isLoading, query.data]);

  return {
    familyId: query.data ?? null,
    isLoading: query.isLoading || (!!user && !query.data && !query.isFetched),
  };
}
