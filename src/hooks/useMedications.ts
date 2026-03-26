/**
 * useMedications — Hook لإدارة الأدوية بنظام Offline-First
 * يستخدم Edge Function health-api لكل العمليات
 */
import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";
import { supabase } from "@/integrations/supabase/client";

export function useMedications() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const queryKey = ["medications", familyId];

  const apiFn = useCallback(async () => {
    if (!familyId) return { data: [], error: null };
    const { data: response, error } = await supabase.functions.invoke("health-api", {
      body: { action: "get-medications", family_id: familyId },
    });
    if (error) return { data: [], error: error.message };
    if (response?.error) return { data: [], error: response.error };
    return { data: response?.data || [], error: null };
  }, [familyId]);

  const filterByFamily = useCallback(
    (items: any[]) => familyId ? items.filter((m) => m.family_id === familyId) : [],
    [familyId]
  );

  const { data: medications, isLoading, isSyncing, refetch } = useOfflineFirst<any>({
    table: "medications",
    queryKey,
    apiFn,
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
    filterFn: filterByFamily,
  });

  const addMedication = useOfflineMutation<any, any>({
    table: "medications",
    operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data: response, error } = await supabase.functions.invoke("health-api", {
        body: {
          action: "create-medication",
          family_id: familyId,
          name: rest.name, dosage: rest.dosage, member_id: rest.member_id,
          member_name: rest.member_name, frequency_type: rest.frequency_type || "daily",
          frequency_value: rest.frequency_value || 1, selected_days: rest.selected_days || [],
          times_per_day: rest.times_per_day || 1, specific_times: rest.specific_times || [],
          start_date: rest.start_date, end_date: rest.end_date, notes: rest.notes,
          color: rest.color, reminder_enabled: rest.reminder_enabled ?? true,
        },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey,
    onSuccess: () => refetch(),
  });

  const updateMedication = useOfflineMutation<any, any>({
    table: "medications",
    operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { data: response, error } = await supabase.functions.invoke("health-api", {
        body: { action: "update-medication", id, ...updates },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey,
  });

  const deleteMedication = useOfflineMutation<any, any>({
    table: "medications",
    operation: "DELETE",
    apiFn: async (input) => {
      const { data: response, error } = await supabase.functions.invoke("health-api", {
        body: { action: "delete-medication", id: input.id },
      });
      return { data: null, error: response?.error || error?.message || null };
    },
    queryKey,
  });

  const addLog = useOfflineMutation<any, any>({
    table: "medication_logs",
    operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data: response, error } = await supabase.functions.invoke("health-api", {
        body: {
          action: "log-medication",
          medication_id: rest.medication_id,
          skipped: rest.skipped || false,
          notes: rest.notes,
        },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey,
    onSuccess: () => refetch(),
  });

  return {
    medications,
    isLoading,
    addMedication: {
      ...addMedication,
      mutateAsync: async (input: any) => {
        const payload = { id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, medication_logs: [], ...input };
        return addMedication.mutateAsync(payload);
      },
      mutate: (input: any) => {
        const payload = { id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, medication_logs: [], ...input };
        addMedication.mutate(payload);
      },
    },
    updateMedication,
    deleteMedication: {
      ...deleteMedication,
      mutateAsync: async (medId: string) => deleteMedication.mutateAsync({ id: medId }),
      mutate: (medId: string) => deleteMedication.mutate({ id: medId }),
    },
    addLog: {
      ...addLog,
      mutateAsync: async (input: any) => {
        const payload = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        return addLog.mutateAsync(payload);
      },
      mutate: (input: any) => {
        const payload = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        addLog.mutate(payload);
      },
    },
  };
}
