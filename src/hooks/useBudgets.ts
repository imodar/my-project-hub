import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";

export function useBudgets() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["budgets", familyId];

  const budgetsQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!familyId) return [];
      const { data, error } = await supabase
        .from("budgets")
        .select("*, budget_expenses(*)")
        .eq("family_id", familyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!familyId,
  });

  const createBudget = useMutation({
    mutationFn: async (input: { type?: string; month?: string; label?: string; income?: number; shared_with?: string[]; trip_id?: string }) => {
      if (!familyId || !user) throw new Error("No family");
      const { error } = await supabase.from("budgets").insert({
        type: input.type || "month",
        month: input.month,
        label: input.label,
        income: input.income || 0,
        shared_with: input.shared_with || [],
        trip_id: input.trip_id || null,
        family_id: familyId,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateBudget = useMutation({
    mutationFn: async (input: { id: string; [key: string]: any }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("budgets").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteBudget = useMutation({
    mutationFn: async (budgetId: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", budgetId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addExpense = useMutation({
    mutationFn: async (input: { budget_id: string; name: string; amount: number; date?: string; currency?: string }) => {
      const { error } = await supabase.from("budget_expenses").insert({
        budget_id: input.budget_id,
        name: input.name,
        amount: input.amount,
        date: input.date || null,
        currency: input.currency || "SAR",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateExpense = useMutation({
    mutationFn: async (input: { id: string; [key: string]: any }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("budget_expenses").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteExpense = useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase.from("budget_expenses").delete().eq("id", expenseId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { budgets: budgetsQuery.data || [], isLoading: budgetsQuery.isLoading, createBudget, updateBudget, deleteBudget, addExpense, updateExpense, deleteExpense };
}
