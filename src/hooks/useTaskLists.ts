import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";

export function useTaskLists() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["task-lists", familyId];

  const listsQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!familyId) return [];
      const { data, error } = await supabase
        .from("task_lists")
        .select("*, task_items(*)")
        .eq("family_id", familyId)
        .order("updated_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!familyId,
  });

  const createList = useMutation({
    mutationFn: async (input: { name: string; type?: string; shared_with?: string[] }) => {
      if (!familyId || !user) throw new Error("No family");
      const { error } = await supabase.from("task_lists").insert({
        name: input.name,
        type: input.type || "family",
        shared_with: input.shared_with || [],
        family_id: familyId,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteList = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase.from("task_lists").delete().eq("id", listId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addItem = useMutation({
    mutationFn: async (input: { list_id: string; name: string; note?: string; priority?: string; assigned_to?: string; repeat_enabled?: boolean; repeat_days?: number[]; repeat_count?: number }) => {
      const { error } = await supabase.from("task_items").insert({
        list_id: input.list_id,
        name: input.name,
        note: input.note || "",
        priority: input.priority || "none",
        assigned_to: input.assigned_to || null,
        repeat_enabled: input.repeat_enabled || false,
        repeat_days: input.repeat_days || [],
        repeat_count: input.repeat_count || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateItem = useMutation({
    mutationFn: async (input: { id: string; [key: string]: any }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("task_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("task_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { lists: listsQuery.data || [], isLoading: listsQuery.isLoading, createList, deleteList, addItem, updateItem, deleteItem };
}
