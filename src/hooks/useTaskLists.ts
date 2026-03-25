import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";
import { toast } from "sonner";

export function useTaskLists() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["task-lists", familyId];

  const [pendingItemIds, setPendingItemIds] = useState<string[]>([]);
  const addPending = useCallback((id: string) => setPendingItemIds(p => [...p, id]), []);
  const removePending = useCallback((id: string) => setPendingItemIds(p => p.filter(x => x !== id)), []);

  const apiFn = useCallback(async () => {
    if (!familyId) return { data: [], error: null };
    const { data, error } = await supabase
      .from("task_lists")
      .select("*, task_items(*)")
      .eq("family_id", familyId)
      .order("updated_at", { ascending: true });
    return { data: data || [], error: error?.message || null };
  }, [familyId]);

  const { data: lists, isLoading, refetch } = useOfflineFirst<any>({
    table: "task_lists",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
  });

  // --- Realtime subscription (kept alongside offline-first) ---
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!familyId) return;
    const channel = supabase
      .channel(`tasks-realtime-${familyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_items" }, () => {
        qc.invalidateQueries({ queryKey: key });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_lists", filter: `family_id=eq.${familyId}` }, () => {
        qc.invalidateQueries({ queryKey: key });
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [familyId, qc, key]);

  // --- Mutations ---

  const createList = useOfflineMutation<any, any>({
    table: "task_lists",
    operation: "INSERT",
    apiFn: async (input) => {
      const { created_at, ...rest } = input;
      const { data, error } = await supabase.from("task_lists").insert({
        id: rest.id,
        name: rest.name,
        type: rest.type || "family",
        shared_with: rest.shared_with || [],
        family_id: familyId,
        created_by: user?.id,
      }).select().single();
      return { data, error: error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const deleteList = useOfflineMutation<any, any>({
    table: "task_lists",
    operation: "DELETE",
    apiFn: async (input) => {
      const { error } = await supabase.from("task_lists").delete().eq("id", input.id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const addItem = useOfflineMutation<any, any>({
    table: "task_items",
    operation: "INSERT",
    apiFn: async (input) => {
      const { created_at, ...rest } = input;
      const { data, error } = await supabase.from("task_items").insert({
        id: rest.id,
        list_id: rest.list_id,
        name: rest.name,
        note: rest.note || "",
        priority: rest.priority || "none",
        assigned_to: rest.assigned_to || null,
        repeat_enabled: rest.repeat_enabled || false,
        repeat_days: rest.repeat_days || [],
        repeat_count: rest.repeat_count || 0,
      }).select().single();
      return { data, error: error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const toggleItem = useOfflineMutation<any, any>({
    table: "task_items",
    operation: "UPDATE",
    apiFn: async (input) => {
      const { error } = await supabase.from("task_items").update({ done: input.done }).eq("id", input.id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
    onError: () => toast.error("فشل تحديث المهمة"),
  });

  const updateItem = useOfflineMutation<any, any>({
    table: "task_items",
    operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("task_items").update(updates).eq("id", id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const deleteItem = useOfflineMutation<any, any>({
    table: "task_items",
    operation: "DELETE",
    apiFn: async (input) => {
      const { error } = await supabase.from("task_items").delete().eq("id", input.id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  return {
    lists: lists || [],
    isLoading,
    createList: {
      ...createList,
      mutate: (input: any) => {
        createList.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, task_items: [], ...input });
      },
      mutateAsync: async (input: any) => createList.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, task_items: [], ...input }),
    },
    deleteList: {
      ...deleteList,
      mutate: (listId: string) => deleteList.mutate({ id: listId }),
      mutateAsync: async (listId: string) => deleteList.mutateAsync({ id: listId }),
    },
    addItem: {
      ...addItem,
      mutate: (input: any) => addItem.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), done: false, ...input }),
      mutateAsync: async (input: any) => addItem.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), done: false, ...input }),
    },
    toggleItem: {
      ...toggleItem,
      mutate: (input: { id: string; done: boolean }) => {
        addPending(input.id);
        toggleItem.mutate(input);
        setTimeout(() => removePending(input.id), 2000);
      },
    },
    updateItem: {
      ...updateItem,
      mutate: (input: any) => updateItem.mutate(input),
    },
    deleteItem: {
      ...deleteItem,
      mutate: (itemId: string) => deleteItem.mutate({ id: itemId }),
      mutateAsync: async (itemId: string) => deleteItem.mutateAsync({ id: itemId }),
    },
    pendingItemIds,
  };
}
