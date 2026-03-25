import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";
import type { Child, ReminderSettings } from "@/data/vaccinationData";

export function useVaccinations() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const key = ["vaccinations", familyId];

  const apiFn = useCallback(async () => {
    if (!familyId) return { data: [], error: null };
    const { data: childrenData, error: childrenError } = await supabase
      .from("vaccination_children")
      .select("*")
      .eq("family_id", familyId);
    if (childrenError) return { data: [], error: childrenError.message };

    const childIds = (childrenData || []).map((c: any) => c.id);
    let notesData: any[] = [];
    if (childIds.length > 0) {
      const { data } = await supabase
        .from("vaccine_notes")
        .select("*")
        .in("child_id", childIds);
      notesData = data || [];
    }

    const children: Child[] = (childrenData || []).map((c: any): Child => ({
      id: c.id,
      name: c.name,
      gender: (c.gender || "male") as "male" | "female",
      birthDate: c.birth_date || "",
      completedVaccines: c.completed_vaccines || [],
      vaccineNotes: notesData
        .filter((n: any) => n.child_id === c.id)
        .map((n: any) => ({ vaccineId: n.vaccine_id, note: n.note })),
      reminderSettings: (c.reminder_settings as any) || {
        beforeDay: true,
        beforeWeek: true,
        beforeMonth: true,
      },
    }));

    return { data: children, error: null };
  }, [familyId]);

  const { data: children, isLoading, refetch } = useOfflineFirst<any>({
    table: "vaccinations",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
  });

  const addChild = useOfflineMutation<any, any>({
    table: "vaccinations",
    operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { error } = await supabase.from("vaccination_children").insert({
        name: rest.name,
        gender: rest.gender,
        birth_date: rest.birthDate,
        family_id: familyId,
        completed_vaccines: [],
        reminder_settings: { beforeDay: true, beforeWeek: true, beforeMonth: true },
      } as never);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const updateChild = useOfflineMutation<any, any>({
    table: "vaccinations",
    operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...rest } = input;
      const updates: any = {};
      if (rest.name !== undefined) updates.name = rest.name;
      if (rest.gender !== undefined) updates.gender = rest.gender;
      if (rest.birthDate !== undefined) updates.birth_date = rest.birthDate;
      const { error } = await supabase
        .from("vaccination_children")
        .update(updates)
        .eq("id", id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const toggleVaccine = useOfflineMutation<any, any>({
    table: "vaccinations",
    operation: "UPDATE",
    apiFn: async (input) => {
      const { childId, vaccineId, completed } = input;
      const isCompleted = completed.includes(vaccineId);
      const newCompleted = isCompleted
        ? completed.filter((v: string) => v !== vaccineId)
        : [...completed, vaccineId];
      const { error } = await supabase
        .from("vaccination_children")
        .update({ completed_vaccines: newCompleted })
        .eq("id", childId);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const updateReminderSettings = useOfflineMutation<any, any>({
    table: "vaccinations",
    operation: "UPDATE",
    apiFn: async (input) => {
      const { childId, settings } = input;
      const { error } = await supabase
        .from("vaccination_children")
        .update({ reminder_settings: settings as any })
        .eq("id", childId);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const saveVaccineNote = useOfflineMutation<any, any>({
    table: "vaccinations",
    operation: "UPDATE",
    apiFn: async (input) => {
      const { childId, vaccineId, note } = input;
      await supabase
        .from("vaccine_notes")
        .delete()
        .eq("child_id", childId)
        .eq("vaccine_id", vaccineId);

      if (note.trim()) {
        const { error } = await supabase.from("vaccine_notes").insert({
          child_id: childId,
          vaccine_id: vaccineId,
          note: note.trim(),
        } as never);
        if (error) return { data: null, error: error.message };
      }
      return { data: null, error: null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  return {
    children: children || [],
    isLoading,
    addChild: {
      ...addChild,
      mutate: (input: { name: string; gender: string; birthDate: string }) =>
        addChild.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input }),
      mutateAsync: async (input: { name: string; gender: string; birthDate: string }) =>
        addChild.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input }),
    },
    updateChild: {
      ...updateChild,
      mutate: (input: { id: string; name?: string; gender?: string; birthDate?: string }) =>
        updateChild.mutate(input),
    },
    toggleVaccine: {
      ...toggleVaccine,
      mutate: (input: { childId: string; vaccineId: string; completed: string[] }) =>
        toggleVaccine.mutate({ id: input.childId, ...input }),
    },
    updateReminderSettings: {
      ...updateReminderSettings,
      mutate: (input: { childId: string; settings: ReminderSettings }) =>
        updateReminderSettings.mutate({ id: input.childId, ...input }),
    },
    saveVaccineNote: {
      ...saveVaccineNote,
      mutate: (input: { childId: string; vaccineId: string; note: string }) =>
        saveVaccineNote.mutate({ id: input.childId, ...input }),
    },
  };
}
