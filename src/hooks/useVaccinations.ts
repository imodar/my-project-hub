import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import type { Child, VaccineNote, ReminderSettings } from "@/data/vaccinationData";

export function useVaccinations() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["vaccinations", familyId];

  const childrenQuery = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Child[]> => {
      if (!familyId) return [];
      const { data: childrenData, error: childrenError } = await supabase
        .from("vaccination_children")
        .select("*")
        .eq("family_id", familyId);
      if (childrenError) throw childrenError;

      const childIds = (childrenData || []).map((c) => c.id);
      let notesData: any[] = [];
      if (childIds.length > 0) {
        const { data, error } = await supabase
          .from("vaccine_notes")
          .select("*")
          .in("child_id", childIds);
        if (!error) notesData = data || [];
      }

      return (childrenData || []).map((c): Child => ({
        id: c.id,
        name: c.name,
        gender: (c.gender || "male") as "male" | "female",
        birthDate: c.birth_date || "",
        completedVaccines: c.completed_vaccines || [],
        vaccineNotes: notesData
          .filter((n) => n.child_id === c.id)
          .map((n) => ({ vaccineId: n.vaccine_id, note: n.note })),
        reminderSettings: (c.reminder_settings as any) || {
          beforeDay: true,
          beforeWeek: true,
          beforeMonth: true,
        },
      }));
    },
    enabled: !!familyId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const addChild = useMutation({
    mutationFn: async (child: { name: string; gender: string; birthDate: string }) => {
      if (!familyId) throw new Error("No family");
      const { error } = await supabase.from("vaccination_children").insert({
        name: child.name,
        gender: child.gender,
        birth_date: child.birthDate,
        family_id: familyId,
        completed_vaccines: [],
        reminder_settings: { beforeDay: true, beforeWeek: true, beforeMonth: true },
      } as never);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateChild = useMutation({
    mutationFn: async (input: { id: string; name?: string; gender?: string; birthDate?: string }) => {
      const updates: any = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.gender !== undefined) updates.gender = input.gender;
      if (input.birthDate !== undefined) updates.birth_date = input.birthDate;
      const { error } = await supabase
        .from("vaccination_children")
        .update(updates)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleVaccine = useMutation({
    mutationFn: async (input: { childId: string; vaccineId: string; completed: string[] }) => {
      const isCompleted = input.completed.includes(input.vaccineId);
      const newCompleted = isCompleted
        ? input.completed.filter((v) => v !== input.vaccineId)
        : [...input.completed, input.vaccineId];
      const { error } = await supabase
        .from("vaccination_children")
        .update({ completed_vaccines: newCompleted })
        .eq("id", input.childId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateReminderSettings = useMutation({
    mutationFn: async (input: { childId: string; settings: ReminderSettings }) => {
      const { error } = await supabase
        .from("vaccination_children")
        .update({ reminder_settings: input.settings as any })
        .eq("id", input.childId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const saveVaccineNote = useMutation({
    mutationFn: async (input: { childId: string; vaccineId: string; note: string }) => {
      // Delete existing note first
      await supabase
        .from("vaccine_notes")
        .delete()
        .eq("child_id", input.childId)
        .eq("vaccine_id", input.vaccineId);

      if (input.note.trim()) {
        const { error } = await supabase.from("vaccine_notes").insert({
          child_id: input.childId,
          vaccine_id: input.vaccineId,
          note: input.note.trim(),
        } as never);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  return {
    children: childrenQuery.data || [],
    isLoading: childrenQuery.isLoading,
    addChild,
    updateChild,
    toggleVaccine,
    updateReminderSettings,
    saveVaccineNote,
  };
}
