import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";
import type { Child, ReminderSettings } from "@/data/vaccinationData";

export function useVaccinations() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["vaccinations", familyId];

  const apiFn = useCallback(async () => {
    if (!familyId) return { data: [], error: null };
    const { data: response, error } = await supabase.functions.invoke("health-api", {
      body: { action: "get-children", family_id: familyId },
    });
    if (error) return { data: [], error: error.message };
    if (response?.error) return { data: [], error: response.error };

    const childrenData = response?.data || [];
    const children: Child[] = childrenData.map((c: any): Child => ({
      id: c.id,
      name: c.name,
      gender: (c.gender || "male") as "male" | "female",
      birthDate: c.birth_date || "",
      completedVaccines: c.completed_vaccines || [],
      vaccineNotes: (c.vaccine_notes || []).map((n: any) => ({ vaccineId: n.vaccine_id, note: n.note })),
      reminderSettings: (c.reminder_settings as any) || { beforeDay: true, beforeWeek: true, beforeMonth: true },
    }));

    return { data: children, error: null };
  }, [familyId]);

  const { data: children, isLoading, refetch } = useOfflineFirst<any>({
    table: "vaccinations",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
    filterFn: useCallback(
      (items: any[]) => items.filter((c: any) => !familyId || !c.family_id || c.family_id === familyId),
      [familyId],
    ),
    scopeKey: familyId ?? undefined,
  });

  // Helper: optimistic update for a specific child
  const optimisticChildUpdate = useCallback(
    (childId: string, updater: (child: any) => any) => {
      qc.setQueryData<any[]>(key, (old) => {
        if (!old) return old;
        return old.map((c: any) => (c.id === childId ? updater(c) : c));
      });
    },
    [qc, key]
  );

  const addChild = useOfflineMutation<any, any>({
    table: "vaccinations", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data: response, error } = await supabase.functions.invoke("health-api", {
        body: { action: "add-child", family_id: familyId, name: rest.name, gender: rest.gender, birth_date: rest.birthDate },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updateChild = useOfflineMutation<any, any>({
    table: "vaccinations", operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...rest } = input;
      const updates: any = {};
      if (rest.name !== undefined) updates.name = rest.name;
      if (rest.gender !== undefined) updates.gender = rest.gender;
      if (rest.birthDate !== undefined) updates.birth_date = rest.birthDate;
      const { data: response, error } = await supabase.functions.invoke("health-api", {
        body: { action: "update-child", id, ...updates },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const toggleVaccine = useOfflineMutation<any, any>({
    table: "vaccinations", operation: "UPDATE",
    apiFn: async (input) => {
      const { childId, vaccineId, completed } = input;
      const isCompleted = completed.includes(vaccineId);
      const { data: response, error } = await supabase.functions.invoke("health-api", {
        body: { action: "toggle-vaccine", child_id: childId, vaccine_id: vaccineId, completed: !isCompleted },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updateReminderSettings = useOfflineMutation<any, any>({
    table: "vaccinations", operation: "UPDATE",
    apiFn: async (input) => {
      const { childId, settings } = input;
      const { data: response, error } = await supabase.functions.invoke("health-api", {
        body: { action: "update-reminder-settings", child_id: childId, settings },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const saveVaccineNote = useOfflineMutation<any, any>({
    table: "vaccinations", operation: "UPDATE",
    apiFn: async (input) => {
      const { childId, vaccineId, note } = input;
      const { data: response, error } = await supabase.functions.invoke("health-api", {
        body: { action: "add-vaccine-note", child_id: childId, vaccine_id: vaccineId, note: note.trim() },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  return {
    children: children || [],
    isLoading,
    addChild: {
      ...addChild,
      mutate: (input: { name: string; gender: string; birthDate: string }) =>
        addChild.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), completedVaccines: [], vaccineNotes: [], reminderSettings: { beforeDay: true, beforeWeek: true, beforeMonth: true }, ...input }),
      mutateAsync: async (input: { name: string; gender: string; birthDate: string }) =>
        addChild.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), completedVaccines: [], vaccineNotes: [], reminderSettings: { beforeDay: true, beforeWeek: true, beforeMonth: true }, ...input }),
    },
    updateChild: {
      ...updateChild,
      mutate: (input: { id: string; name?: string; gender?: string; birthDate?: string }) => {
        optimisticChildUpdate(input.id, (c) => ({ ...c, ...input }));
        updateChild.mutate(input);
      },
    },
    toggleVaccine: {
      ...toggleVaccine,
      mutate: (input: { childId: string; vaccineId: string; completed: string[] }) => {
        const isCompleted = input.completed.includes(input.vaccineId);
        optimisticChildUpdate(input.childId, (c) => ({
          ...c,
          completedVaccines: isCompleted
            ? c.completedVaccines.filter((v: string) => v !== input.vaccineId)
            : [...(c.completedVaccines || []), input.vaccineId],
        }));
        toggleVaccine.mutate({ id: input.childId, ...input });
      },
    },
    updateReminderSettings: {
      ...updateReminderSettings,
      mutate: (input: { childId: string; settings: ReminderSettings }) => {
        optimisticChildUpdate(input.childId, (c) => ({ ...c, reminderSettings: input.settings }));
        updateReminderSettings.mutate({ id: input.childId, ...input });
      },
    },
    saveVaccineNote: {
      ...saveVaccineNote,
      mutate: (input: { childId: string; vaccineId: string; note: string }) => {
        optimisticChildUpdate(input.childId, (c) => {
          const existing = (c.vaccineNotes || []).filter((n: any) => n.vaccineId !== input.vaccineId);
          return { ...c, vaccineNotes: [...existing, { vaccineId: input.vaccineId, note: input.note.trim() }] };
        });
        saveVaccineNote.mutate({ id: input.childId, ...input });
      },
    },
  };
}
