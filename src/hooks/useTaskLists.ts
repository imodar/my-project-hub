import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { toast } from "sonner";

export function useTaskLists() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["task-lists", familyId];

  // Track pending item IDs for spinner
  const [pendingItemIds, setPendingItemIds] = useState<string[]>([]);
  const addPending = useCallback((id: string) => setPendingItemIds(p => [...p, id]), []);
  const removePending = useCallback((id: string) => setPendingItemIds(p => p.filter(x => x !== id)), []);

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

  // --- Realtime subscription ---
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!familyId) return;

    const channel = supabase
      .channel(`tasks-realtime-${familyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_items" },
        () => {
          qc.invalidateQueries({ queryKey: key });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_lists", filter: `family_id=eq.${familyId}` },
        () => {
          qc.invalidateQueries({ queryKey: key });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [familyId, qc, key]);

  // --- Mutations ---

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

  // Optimistic toggle for task items
  const toggleItem = useMutation({
    mutationFn: async (input: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("task_items")
        .update({ done: input.done })
        .eq("id", input.id);
      if (error) throw error;
    },
    onMutate: async (input) => {
      addPending(input.id);
      // Cancel outgoing refetches
      await qc.cancelQueries({ queryKey: key });
      // Snapshot previous value
      const previous = qc.getQueryData(key);
      // Optimistically update
      qc.setQueryData(key, (old: any) => {
        if (!old) return old;
        return old.map((list: any) => ({
          ...list,
          task_items: (list.task_items || []).map((item: any) =>
            item.id === input.id ? { ...item, done: input.done } : item
          ),
        }));
      });
      return { previous };
    },
    onError: (_err, input, context) => {
      // Rollback
      if (context?.previous) {
        qc.setQueryData(key, context.previous);
      }
      toast.error("فشل تحديث المهمة");
    },
    onSettled: (_data, _err, input) => {
      removePending(input.id);
      qc.invalidateQueries({ queryKey: key });
    },
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

  return {
    lists: listsQuery.data || [],
    isLoading: listsQuery.isLoading,
    createList,
    deleteList,
    addItem,
    toggleItem,
    updateItem,
    deleteItem,
    pendingItemIds,
  };
}
