import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";

export function useMedications() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["medications", familyId];

  const medsQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!familyId) return [];
      const { data, error } = await supabase
        .from("medications")
        .select("*, medication_logs(*)")
        .eq("family_id", familyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!familyId,
  });

  const addMedication = useMutation({
    mutationFn: async (input: {
      name: string; dosage?: string; member_id?: string; member_name?: string;
      frequency_type?: string; frequency_value?: number; selected_days?: number[];
      times_per_day?: number; specific_times?: string[];
      start_date?: string; end_date?: string; notes?: string; color?: string;
      reminder_enabled?: boolean;
    }) => {
      if (!familyId) throw new Error("No family");
      const { error } = await supabase.from("medications").insert({
        family_id: familyId,
        name: input.name,
        dosage: input.dosage,
        member_id: input.member_id,
        member_name: input.member_name,
        frequency_type: input.frequency_type || "daily",
        frequency_value: input.frequency_value || 1,
        selected_days: input.selected_days || [],
        times_per_day: input.times_per_day || 1,
        specific_times: input.specific_times || [],
        start_date: input.start_date,
        end_date: input.end_date,
        notes: input.notes,
        color: input.color,
        reminder_enabled: input.reminder_enabled ?? true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateMedication = useMutation({
    mutationFn: async (input: { id: string; [key: string]: any }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("medications").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteMedication = useMutation({
    mutationFn: async (medId: string) => {
      const { error } = await supabase.from("medications").delete().eq("id", medId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addLog = useMutation({
    mutationFn: async (input: { medication_id: string; skipped?: boolean; notes?: string; taken_at?: string }) => {
      if (!user) throw new Error("No user");
      const payload = {
        medication_id: input.medication_id,
        taken_by: user.id,
        skipped: input.skipped || false,
        notes: input.notes,
        ...(input.taken_at ? { taken_at: input.taken_at } : {}),
      };
      const { error } = await supabase.from("medication_logs").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { medications: medsQuery.data || [], isLoading: medsQuery.isLoading, addMedication, updateMedication, deleteMedication, addLog };
}
