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
      const { data, error } = await supabase
        .from("tasbih_sessions")
        .select("id, count, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const saveSession = useMutation({
    mutationFn: async (count: number) => {
      if (!user || count <= 0) return;
      const { error } = await supabase
        .from("tasbih_sessions")
        .insert({ user_id: user.id, count });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasbih-sessions", user?.id] });
    },
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("tasbih_sessions")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasbih-sessions", user?.id] });
    },
  });

  return {
    sessions: sessionsQuery.data || [],
    isLoading: sessionsQuery.isLoading,
    saveSession,
    clearAll,
  };
}
