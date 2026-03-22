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
      const { data, error } = await supabase
        .from("kids_worship_data")
        .select("day, items")
        .eq("child_id", childId)
        .eq("year", year)
        .eq("month", month);
      if (error) throw error;
      const result: MonthData = {};
      (data || []).forEach((row) => {
        result[row.day] = (row.items as Record<string, boolean>) || {};
      });
      return result;
    },
    enabled: !!user,
  });

  const saveDayData = useMutation({
    mutationFn: async ({ day, items }: { day: number; items: DayData }) => {
      const { error } = await supabase
        .from("kids_worship_data")
        .upsert(
          { child_id: childId, year, month, day, items: items as any },
          { onConflict: "child_id,year,month,day" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const resetDay = useMutation({
    mutationFn: async (day: number) => {
      const { error } = await supabase
        .from("kids_worship_data")
        .delete()
        .eq("child_id", childId)
        .eq("year", year)
        .eq("month", month)
        .eq("day", day);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    data: dataQuery.data || {},
    isLoading: dataQuery.isLoading,
    saveDayData,
    resetDay,
  };
}
