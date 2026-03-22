import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";

export function useDebts() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["debts", user?.id];

  const debtsQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("debts")
        .select("*, debt_payments(*), debt_postponements(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const addDebt = useMutation({
    mutationFn: async (input: { person_name: string; amount: number; currency?: string; direction: string; date?: string; due_date?: string; note?: string }) => {
      if (!user || !familyId) throw new Error("No user/family");
      const { error } = await supabase.from("debts").insert({
        person_name: input.person_name,
        amount: input.amount,
        currency: input.currency || "SAR",
        direction: input.direction,
        date: input.date,
        due_date: input.due_date,
        note: input.note || "",
        user_id: user.id,
        family_id: familyId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateDebt = useMutation({
    mutationFn: async (input: { id: string; [key: string]: any }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("debts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteDebt = useMutation({
    mutationFn: async (debtId: string) => {
      const { error } = await supabase.from("debts").delete().eq("id", debtId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addPayment = useMutation({
    mutationFn: async (input: { debt_id: string; amount: number; currency?: string; type?: string; item_description?: string; date?: string }) => {
      const { error } = await supabase.from("debt_payments").insert({
        debt_id: input.debt_id,
        amount: input.amount,
        currency: input.currency || "SAR",
        type: input.type || "cash",
        item_description: input.item_description,
        date: input.date,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addPostponement = useMutation({
    mutationFn: async (input: { debt_id: string; new_date?: string; reason?: string }) => {
      const { error } = await supabase.from("debt_postponements").insert({
        debt_id: input.debt_id,
        new_date: input.new_date,
        reason: input.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { debts: debtsQuery.data || [], isLoading: debtsQuery.isLoading, addDebt, updateDebt, deleteDebt, addPayment, addPostponement };
}
