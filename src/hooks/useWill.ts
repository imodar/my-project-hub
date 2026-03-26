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
      const { data, error } = await supabase.functions.invoke("will-api", {
        body: { action: "get-will" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.data ?? null;
    },
    enabled: !!user,
  });

  const upsertWill = useMutation({
    mutationFn: async (input: { sections: any; is_locked?: boolean; password_hash?: string }) => {
      const { data, error } = await supabase.functions.invoke("will-api", {
        body: {
          action: "save-will",
          sections: input.sections,
          is_locked: input.is_locked,
          password_hash: input.password_hash,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteWill = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("will-api", {
        body: { action: "delete-will" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const createOpenRequest = useMutation({
    mutationFn: async (input: { reason?: string }) => {
      const { data, error } = await supabase.functions.invoke("will-api", {
        body: {
          action: "request-open",
          will_id: willQuery.data?.id,
          reason: input.reason,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    will: willQuery.data,
    isLoading: willQuery.isLoading,
    upsertWill, deleteWill, createOpenRequest,
  };
}
