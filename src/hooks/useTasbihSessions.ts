import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TasbihSession {
  id: string;
  count: number;
  created_at: string;
}

export function useTasbihSessions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const sessionsQuery = useQuery({
    queryKey: ["tasbih-sessions", user?.id],
    queryFn: async (): Promise<TasbihSession[]> => {
      if (!user) return [];
      const { data: response, error } = await supabase.functions.invoke("worship-api", {
        body: { action: "get-tasbih-history" },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      return response?.data || [];
    },
    enabled: !!user,
  });

  const saveSession = useMutation({
    mutationFn: async (count: number) => {
      if (!user || count <= 0) return;
      const { data: response, error } = await supabase.functions.invoke("worship-api", {
        body: { action: "save-tasbih", count },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasbih-sessions", user?.id] }),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { data: response, error } = await supabase.functions.invoke("worship-api", {
        body: { action: "clear-tasbih" },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasbih-sessions", user?.id] }),
  });

  return {
    sessions: sessionsQuery.data || [],
    isLoading: sessionsQuery.isLoading,
    saveSession,
    clearAll,
  };
}
