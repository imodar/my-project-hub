import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export function useBudgets() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const key = ["budgets", familyId];

  const apiFn = useCallback(async () => {
    if (!familyId) return { data: [], error: null };
    const { data, error } = await supabase.functions.invoke("budget-api", {
      body: { action: "get-budgets", family_id: familyId },
    });
    if (error) return { data: [], error: error.message };
    if (data?.error) return { data: [], error: data.error };
    return { data: data?.data || [], error: null };
  }, [familyId]);

  const { data: budgets, isLoading, refetch } = useOfflineFirst<any>({
    table: "budgets",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
  });

  const createBudget = useOfflineMutation<any, any>({
    table: "budgets",
    operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data, error } = await supabase.functions.invoke("budget-api", {
        body: {
          action: "create-budget",
          family_id: familyId,
          type: rest.type || "month",
          month: rest.month,
          label: rest.label,
          income: rest.income || 0,
          trip_id: rest.trip_id || null,
        },
      });
      return { data: data?.data ?? null, error: data?.error || error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const updateBudget = useOfflineMutation<any, any>({
    table: "budgets",
    operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase.functions.invoke("budget-api", {
        body: { action: "update-budget", id, ...updates },
      });
      return { data: data?.data ?? null, error: data?.error || error?.message || null };
    },
    queryKey: key,
  });

  const deleteBudget = useOfflineMutation<any, any>({
    table: "budgets",
    operation: "DELETE",
    apiFn: async (input) => {
      const { data, error } = await supabase.functions.invoke("budget-api", {
        body: { action: "delete-budget", id: input.id },
      });
      return { data: null, error: data?.error || error?.message || null };
    },
    queryKey: key,
  });

  const addExpense = useOfflineMutation<any, any>({
    table: "budget_expenses",
    operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data, error } = await supabase.functions.invoke("budget-api", {
        body: {
          action: "add-expense",
          budget_id: rest.budget_id,
          name: rest.name,
          amount: rest.amount,
          date: rest.date || null,
          currency: rest.currency || "SAR",
        },
      });
      return { data: data?.data ?? null, error: data?.error || error?.message || null };
    },
    onSuccess: () => refetch(),
  });

  const updateExpense = useOfflineMutation<any, any>({
    table: "budget_expenses",
    operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase.functions.invoke("budget-api", {
        body: { action: "update-expense", id, ...updates },
      });
      return { data: data?.data ?? null, error: data?.error || error?.message || null };
    },
    onSuccess: () => refetch(),
  });

  const deleteExpense = useOfflineMutation<any, any>({
    table: "budget_expenses",
    operation: "DELETE",
    apiFn: async (input) => {
      const { data, error } = await supabase.functions.invoke("budget-api", {
        body: { action: "delete-expense", id: input.id },
      });
      return { data: null, error: data?.error || error?.message || null };
    },
    queryKey: key,
  });

  return {
    budgets: budgets || [],
    isLoading,
    createBudget: {
      ...createBudget,
      mutate: (input: any) => createBudget.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, budget_expenses: [], ...input }),
      mutateAsync: async (input: any) => createBudget.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, budget_expenses: [], ...input }),
    },
    updateBudget,
    deleteBudget: {
      ...deleteBudget,
      mutate: (budgetId: string) => deleteBudget.mutate({ id: budgetId }),
      mutateAsync: async (budgetId: string) => deleteBudget.mutateAsync({ id: budgetId }),
    },
    addExpense: {
      ...addExpense,
      mutate: (input: any) => addExpense.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input }),
      mutateAsync: async (input: any) => addExpense.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input }),
    },
    updateExpense,
    deleteExpense: {
      ...deleteExpense,
      mutate: (expenseId: string) => deleteExpense.mutate({ id: expenseId }),
      mutateAsync: async (expenseId: string) => deleteExpense.mutateAsync({ id: expenseId }),
    },
  };
}
