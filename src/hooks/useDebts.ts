import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export function useDebts() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["debts", familyId];

  const apiFn = useCallback(async () => {
    if (!user) return { data: [], error: null };
    const { data, error } = await supabase.functions.invoke("debts-api", {
      body: { action: "get-debts" },
    });
    if (error) return { data: [], error: error.message };
    if (data?.error) return { data: [], error: data.error };
    return { data: data?.data || [], error: null };
  }, [user]);

  const { data: debts, isLoading, refetch } = useOfflineFirst<any>({
    table: "debts",
    queryKey: key,
    apiFn,
    enabled: !!user,
    scopeKey: familyId ?? undefined,
  });

  // Helper: optimistic update for sub-items inside a debt
  const optimisticDebtSub = useCallback(
    (debtId: string, subKey: string, updater: (items: any[]) => any[]) => {
      qc.setQueryData<any[]>(key, (old) => {
        if (!old) return old;
        return old.map((d: any) =>
          d.id === debtId ? { ...d, [subKey]: updater(d[subKey] || []) } : d
        );
      });
    },
    [qc, key]
  );

  const addDebt = useOfflineMutation<any, any>({
    table: "debts", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data, error } = await supabase.functions.invoke("debts-api", {
        body: {
          action: "create-debt", family_id: familyId,
          person_name: rest.person_name, amount: rest.amount, currency: rest.currency || "SAR",
          direction: rest.direction, date: rest.date, due_date: rest.due_date,
          note: rest.note || "", payment_details: rest.payment_details || null,
          has_reminder: rest.has_reminder || false,
        },
      });
      return { data: data?.data ?? null, error: data?.error || error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updateDebt = useOfflineMutation<any, any>({
    table: "debts", operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase.functions.invoke("debts-api", {
        body: { action: "update-debt", id, ...updates },
      });
      return { data: data?.data ?? null, error: data?.error || error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const deleteDebt = useOfflineMutation<any, any>({
    table: "debts", operation: "DELETE",
    apiFn: async (input) => {
      const { data, error } = await supabase.functions.invoke("debts-api", {
        body: { action: "delete-debt", id: input.id },
      });
      return { data: null, error: data?.error || error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const addPayment = useOfflineMutation<any, any>({
    table: "debt_payments", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data, error } = await supabase.functions.invoke("debts-api", {
        body: {
          action: "add-payment", debt_id: rest.debt_id, amount: rest.amount,
          currency: rest.currency || "SAR", type: rest.type || "cash",
          item_description: rest.item_description, date: rest.date,
          payment_details: rest.payment_details || null,
        },
      });
      return { data: data?.data ?? null, error: data?.error || error?.message || null };
    },
    onSuccess: () => refetch(),
  });

  const addPostponement = useOfflineMutation<any, any>({
    table: "debt_payments", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data, error } = await supabase.functions.invoke("debts-api", {
        body: { action: "add-postponement", debt_id: rest.debt_id, new_date: rest.new_date, reason: rest.reason },
      });
      return { data: data?.data ?? null, error: data?.error || error?.message || null };
    },
    onSuccess: () => refetch(),
  });

  return {
    debts: debts || [], isLoading,
    addDebt: {
      ...addDebt,
      mutate: (input: any) => addDebt.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), user_id: user?.id, family_id: familyId, debt_payments: [], debt_postponements: [], ...input }),
      mutateAsync: async (input: any) => addDebt.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), user_id: user?.id, family_id: familyId, debt_payments: [], debt_postponements: [], ...input }),
    },
    updateDebt,
    deleteDebt: {
      ...deleteDebt,
      mutate: (debtId: string) => deleteDebt.mutate({ id: debtId }),
      mutateAsync: async (debtId: string) => deleteDebt.mutateAsync({ id: debtId }),
    },
    addPayment: {
      ...addPayment,
      mutate: (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        optimisticDebtSub(input.debt_id, "debt_payments", (payments) => [...payments, item]);
        addPayment.mutate(item);
      },
      mutateAsync: async (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        optimisticDebtSub(input.debt_id, "debt_payments", (payments) => [...payments, item]);
        return addPayment.mutateAsync(item);
      },
    },
    addPostponement: {
      ...addPostponement,
      mutate: (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        optimisticDebtSub(input.debt_id, "debt_postponements", (posts) => [...posts, item]);
        addPostponement.mutate(item);
      },
      mutateAsync: async (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        optimisticDebtSub(input.debt_id, "debt_postponements", (posts) => [...posts, item]);
        return addPostponement.mutateAsync(item);
      },
    },
  };
}
