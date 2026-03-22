import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useWill() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["will", user?.id];

  const willQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("wills")
        .select("*, will_open_requests(*)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const upsertWill = useMutation({
    mutationFn: async (input: { sections: any; is_locked?: boolean; password_hash?: string }) => {
      if (!user) throw new Error("No user");
      const existing = willQuery.data;
      if (existing) {
        const { error } = await supabase.from("wills").update({
          sections: input.sections,
          is_locked: input.is_locked ?? existing.is_locked,
          password_hash: input.password_hash ?? existing.password_hash,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wills").insert({
          user_id: user.id,
          sections: input.sections,
          is_locked: input.is_locked ?? false,
          password_hash: input.password_hash || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteWill = useMutation({
    mutationFn: async () => {
      if (!willQuery.data) return;
      const { error } = await supabase.from("wills").delete().eq("id", willQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const createOpenRequest = useMutation({
    mutationFn: async (input: { reason?: string }) => {
      if (!user || !willQuery.data) throw new Error("No will");
      const { error } = await supabase.from("will_open_requests").insert({
        will_id: willQuery.data.id,
        requested_by: user.id,
        reason: input.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    will: willQuery.data,
    isLoading: willQuery.isLoading,
    upsertWill, deleteWill, createOpenRequest,
  };
}
