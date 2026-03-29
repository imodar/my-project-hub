import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export interface WorshipChild {
  id: string;
  family_id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export function useWorshipChildren() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const queryKey = ["worship-children", familyId];

  const apiFn = useCallback(async () => {
    if (!familyId) return { data: [], error: null };
    const { data: response, error } = await supabase.functions.invoke("worship-api", {
      body: { action: "get-children", family_id: familyId },
    });
    if (error) return { data: [], error: error.message };
    if (response?.error) return { data: [], error: response.error };
    return { data: response?.data || [], error: null };
  }, [familyId]);

  const { data: children, isLoading, refetch } = useOfflineFirst<WorshipChild>({
    table: "worship_children",
    queryKey,
    apiFn,
    enabled: !!user && !!familyId,
    filterFn: useCallback(
      (items: WorshipChild[]) => (!familyId ? items : items.filter(c => c.family_id === familyId)),
      [familyId],
    ),
    scopeKey: familyId ?? undefined,
  });

  const addChild = useOfflineMutation<any, any>({
    table: "worship_children",
    operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data: response, error } = await supabase.functions.invoke("worship-api", {
        body: { action: "add-child", family_id: familyId, name: rest.name },
      });
      if (error) return { data: null, error: error.message };
      if (response?.error) return { data: null, error: response.error };
      return { data: response?.data ?? null, error: null };
    },
    queryKey,
    onSuccess: () => refetch(),
  });

  const removeChild = useOfflineMutation<any, any>({
    table: "worship_children",
    operation: "DELETE",
    apiFn: async (input) => {
      const { data: response, error } = await supabase.functions.invoke("worship-api", {
        body: { action: "remove-child", id: input.id },
      });
      if (error) return { data: null, error: error.message };
      if (response?.error) return { data: null, error: response.error };
      return { data: null, error: null };
    },
    queryKey,
    onSuccess: () => refetch(),
  });

  return {
    children: children || [],
    isLoading,
    addChild: {
      ...addChild,
      mutate: (name: string, options?: { onSuccess?: () => void; onError?: (err: any) => void }) => {
        const payload = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          family_id: familyId,
          name,
          created_by: user?.id,
        };
        if (options?.onSuccess || options?.onError) {
          addChild.mutateAsync(payload).then(() => options?.onSuccess?.()).catch((err) => options?.onError?.(err));
        } else {
          addChild.mutate(payload);
        }
      },
      mutateAsync: async (name: string) =>
        addChild.mutateAsync({
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          family_id: familyId,
          name,
          created_by: user?.id,
        }),
    },
    removeChild: {
      ...removeChild,
      mutate: (id: string, options?: { onSuccess?: () => void; onError?: (err: any) => void }) => {
        if (options?.onSuccess || options?.onError) {
          removeChild.mutateAsync({ id }).then(() => options?.onSuccess?.()).catch((err) => options?.onError?.(err));
        } else {
          removeChild.mutate({ id });
        }
      },
      mutateAsync: async (id: string) => removeChild.mutateAsync({ id }),
    },
  };
}
