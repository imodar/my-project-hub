import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export function useWill() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["will", familyId];

  const apiFn = useCallback(async () => {
    if (!user) return { data: [], error: null };
    const { data, error } = await supabase.functions.invoke("will-api", {
      body: { action: "get-will" },
    });
    if (error) return { data: [], error: error.message };
    if (data?.error) return { data: [], error: data.error };
    // Wrap single will object in array for useOfflineFirst compatibility
    const willData = data?.data ? [data.data] : [];
    return { data: willData, error: null };
  }, [user]);

  const { data, isLoading, refetch } = useOfflineFirst<any>({
    table: "will_sections",
    queryKey: key,
    apiFn,
    enabled: !!user && !!familyId,
  });

  const upsertWill = useOfflineMutation<any, any>({
    table: "will_sections",
    operation: "UPDATE",
    apiFn: async (input) => {
      const { data, error } = await supabase.functions.invoke("will-api", {
        body: {
          action: "save-will",
          sections: input.sections,
          is_locked: input.is_locked,
          password_hash: input.password_hash,
        },
      });
      if (error) return { data: null, error: error.message };
      if (data?.error) return { data: null, error: data.error };
      return { data: data?.data ?? null, error: null };
    },
    onSuccess: () => refetch(),
  });

  const deleteWill = useOfflineMutation<any, any>({
    table: "will_sections",
    operation: "DELETE",
    apiFn: async (input) => {
      const { data, error } = await supabase.functions.invoke("will-api", {
        body: { action: "delete-will" },
      });
      if (error) return { data: null, error: error.message };
      if (data?.error) return { data: null, error: data.error };
      return { data: null, error: null };
    },
    onSuccess: () => refetch(),
  });

  const createOpenRequest = useMutation({
    mutationFn: async (input: { reason?: string }) => {
      const willData = data?.[0];
      const { data: res, error } = await supabase.functions.invoke("will-api", {
        body: {
          action: "request-open",
          will_id: willData?.id,
          reason: input.reason,
        },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    will: data?.[0] ?? null,
    isLoading,
    upsertWill, deleteWill, createOpenRequest,
  };
}
