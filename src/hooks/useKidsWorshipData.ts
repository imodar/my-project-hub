import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { DayData, MonthData } from "@/components/kids-worship/worshipData";

export function useKidsWorshipData(childId: string, year: number, month: number) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["kids-worship", childId, year, month];

  const dataQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<MonthData> => {
      const { data: response, error } = await supabase.functions.invoke("worship-api", {
        body: { action: "get-worship-data", child_id: childId, year, month },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      const result: MonthData = {};
      (response?.data || []).forEach((row: any) => {
        result[row.day] = (row.items as Record<string, boolean>) || {};
      });
      return result;
    },
    enabled: !!user,
  });

  const saveDayData = useMutation({
    mutationFn: async ({ day, items }: { day: number; items: DayData }) => {
      const { data: response, error } = await supabase.functions.invoke("worship-api", {
        body: { action: "save-worship-data", child_id: childId, year, month, day, items },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
    },
    onMutate: async ({ day, items }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MonthData>(queryKey);
      queryClient.setQueryData<MonthData>(queryKey, (old) => ({ ...old, [day]: items }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const resetDay = useMutation({
    mutationFn: async (day: number) => {
      const { data: response, error } = await supabase.functions.invoke("worship-api", {
        body: { action: "delete-worship-data", child_id: childId, year, month, day },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
    },
    onMutate: async (day) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MonthData>(queryKey);
      queryClient.setQueryData<MonthData>(queryKey, (old) => {
        if (!old) return {};
        const copy = { ...old };
        delete copy[day];
        return copy;
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    data: dataQuery.data || {},
    isLoading: dataQuery.isLoading,
    saveDayData,
    resetDay,
  };
}
