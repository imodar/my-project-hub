import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";

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
  const qc = useQueryClient();
  const queryKey = ["worship-children", familyId];

  const childrenQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<WorshipChild[]> => {
      if (!familyId) return [];
      const { data: response, error } = await supabase.functions.invoke("worship-api", {
        body: { action: "get-children", family_id: familyId },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      return response?.data || [];
    },
    enabled: !!user && !!familyId,
  });

  const addChild = useMutation({
    mutationFn: async (name: string) => {
      const { data: response, error } = await supabase.functions.invoke("worship-api", {
        body: { action: "add-child", family_id: familyId, name },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      return response?.data as WorshipChild;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const removeChild = useMutation({
    mutationFn: async (id: string) => {
      const { data: response, error } = await supabase.functions.invoke("worship-api", {
        body: { action: "remove-child", id },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    children: childrenQuery.data || [],
    isLoading: childrenQuery.isLoading,
    addChild,
    removeChild,
  };
}
