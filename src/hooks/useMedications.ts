/**
 * useMedications — Hook لإدارة الأدوية بنظام Offline-First
 *
 * يستخدم useOfflineFirst للقراءة (IndexedDB أولاً ثم API)
 * ويستخدم useOfflineMutation للكتابة (optimistic + sync queue)
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

  /** جلب الأدوية مع سجلاتها من API */
  const apiFn = useCallback(async () => {
    if (!familyId) {
      console.warn("[useMedications] familyId فاضي - skip");
      return { data: [], error: null };
    }
    console.log("[useMedications] جاري الجلب، familyId:", familyId);
    const { data, error } = await supabase
      .from("medications")
      .select("*, medication_logs(*)")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false });
    console.log("[useMedications] النتيجة:", data?.length, error);
    return { data: data || [], error: error?.message || null };
  }, [familyId]);

  const { data: medications, isLoading, isSyncing, refetch } = useOfflineFirst<any>({
    table: "medications",
    queryKey,
    apiFn,
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
  });

  /** إضافة دواء */
  const addMedication = useOfflineMutation<any, any>({
    table: "medications",
    operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data, error } = await supabase.from("medications").insert({
        family_id: familyId,
        name: rest.name,
        dosage: rest.dosage,
        member_id: rest.member_id,
        member_name: rest.member_name,
        frequency_type: rest.frequency_type || "daily",
        frequency_value: rest.frequency_value || 1,
        selected_days: rest.selected_days || [],
        times_per_day: rest.times_per_day || 1,
        specific_times: rest.specific_times || [],
        start_date: rest.start_date,
        end_date: rest.end_date,
        notes: rest.notes,
        color: rest.color,
        reminder_enabled: rest.reminder_enabled ?? true,
      }).select().single();
      return { data, error: error?.message || null };
    },
    queryKey,
    onSuccess: () => refetch(),
  });

  /** تعديل دواء */
  const updateMedication = useOfflineMutation<any, any>({
    table: "medications",
    operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from("medications")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      return { data, error: error?.message || null };
    },
    queryKey,
  });

  /** حذف دواء */
  const deleteMedication = useOfflineMutation<any, any>({
    table: "medications",
    operation: "DELETE",
    apiFn: async (input) => {
      const { error } = await supabase
        .from("medications")
        .delete()
        .eq("id", input.id);
      return { data: null, error: error?.message || null };
    },
    queryKey,
  });

  /** تسجيل جرعة */
  const addLog = useOfflineMutation<any, any>({
    table: "medication_logs",
    operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data, error } = await supabase
        .from("medication_logs")
        .insert({
          medication_id: rest.medication_id,
          taken_by: user?.id,
          skipped: rest.skipped || false,
          notes: rest.notes,
          ...(rest.taken_at ? { taken_at: rest.taken_at } : {}),
        })
        .select()
        .single();
      return { data, error: error?.message || null };
    },
    queryKey,
    onSuccess: () => refetch(),
  });

  // واجهة متوافقة مع الاستخدام الحالي
  return {
    medications,
    isLoading,
    addMedication: {
      ...addMedication,
      mutateAsync: async (input: any) => {
        const payload = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          family_id: familyId,
          medication_logs: [],
          ...input,
        };
        return addMedication.mutateAsync(payload);
      },
      mutate: (input: any) => {
        const payload = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          family_id: familyId,
          medication_logs: [],
          ...input,
        };
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
        const payload = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...input,
        };
        return addLog.mutateAsync(payload);
      },
      mutate: (input: any) => {
        const payload = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...input,
        };
        addLog.mutate(payload);
      },
    },
  };
}
