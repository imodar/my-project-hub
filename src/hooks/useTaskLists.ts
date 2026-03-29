import { useState, useCallback } from "react";
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

  function sortListsAsc(items: any[]) {
    return [...items].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  }

  const apiFn = useCallback(async (since?: string | null) => {
    if (!familyId) return { data: [], error: null };
    const { data: response, error } = await supabase.functions.invoke("tasks-api", {
      body: { action: "get-lists", family_id: familyId, ...(since ? { since } : {}) },
    });
    if (error) return { data: [], error: error.message };
    if (response?.error) return { data: [], error: response.error };
    return { data: sortListsAsc(response?.data || []), error: null };
  }, [familyId]);

  const { data: lists, isLoading, refetch } = useOfflineFirst<any>({
    table: "task_lists",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
    filterFn: useCallback((items: any[]) => sortListsAsc(items), []),
    scopeKey: familyId ?? undefined,
  });

  // Realtime handled by useFamilyRealtime — no duplicate channel needed

  const invoke = async (action: string, payload: any) => {
    const { data: response, error } = await supabase.functions.invoke("tasks-api", { body: { action, ...payload } });
    return { data: response?.data ?? null, error: response?.error || error?.message || null };
  };

  const createList = useOfflineMutation<any, any>({
    table: "task_lists", operation: "INSERT",
    apiFn: async (input) => { const { created_at, ...rest } = input; return invoke("create-list", { family_id: familyId, name: rest.name, type: rest.type || "family", id: rest.id }); },
    onSuccess: () => refetch(),
  });

  const updateList = useOfflineMutation<any, any>({
    table: "task_lists", operation: "UPDATE",
    apiFn: async (input) => { const { id, ...updates } = input; return invoke("update-list", { id, ...updates }); },
    queryKey: key, onSuccess: () => refetch(),
  });

  const deleteList = useOfflineMutation<any, any>({
    table: "task_lists", operation: "DELETE",
    apiFn: async (input) => invoke("delete-list", { id: input.id }),
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const addItem = useOfflineMutation<any, any>({
    table: "task_items", operation: "INSERT",
    apiFn: async (input) => {
      const { created_at, ...rest } = input;
      return invoke("add-item", { list_id: rest.list_id, name: rest.name, note: rest.note || "", priority: rest.priority || "none", assigned_to: rest.assigned_to || null, repeat_enabled: rest.repeat_enabled || false, repeat_days: rest.repeat_days || [], id: rest.id });
    },
  });

  const toggleItem = useOfflineMutation<any, any>({
    table: "task_items", operation: "UPDATE",
    apiFn: async (input) => invoke("update-item", { id: input.id, done: input.done }),
    onError: () => toast.error("فشل تحديث المهمة"),
  });

  const updateItem = useOfflineMutation<any, any>({
    table: "task_items", operation: "UPDATE",
    apiFn: async (input) => { const { id, ...updates } = input; return invoke("update-item", { id, ...updates }); },
    onSuccess: () => refetch(),
  });

  const deleteItem = useOfflineMutation<any, any>({
    table: "task_items", operation: "DELETE",
    apiFn: async (input) => invoke("delete-item", { id: input.id }),
    onSuccess: () => refetch(),
  });

  return {
    lists: lists || [],
    isLoading,
    createList: {
      ...createList,
      mutate: (input: any, options?: any) => {
        const id = input.id || crypto.randomUUID();
        const payload = { created_at: new Date().toISOString(), family_id: familyId, task_items: [], ...input, id };
        if (options?.onSuccess || options?.onError) {
          createList.mutateAsync(payload).then((result) => options?.onSuccess?.(result?.data)).catch((err: any) => options?.onError?.(err));
        } else {
          createList.mutate(payload);
        }
      },
      mutateAsync: async (input: any) => {
        const id = input.id || crypto.randomUUID();
        return createList.mutateAsync({ created_at: new Date().toISOString(), family_id: familyId, task_items: [], ...input, id });
      },
    },
    deleteList: {
      ...deleteList,
      mutate: (listId: string) => deleteList.mutate({ id: listId }),
      mutateAsync: async (listId: string) => deleteList.mutateAsync({ id: listId }),
    },
    addItem: {
      ...addItem,
      mutate: (input: any) => {
        const newItem = { id: crypto.randomUUID(), created_at: new Date().toISOString(), done: false, ...input };
        qc.setQueryData<any[]>(key, (old) =>
          (old ?? []).map((list: any) =>
            list.id === newItem.list_id
              ? { ...list, task_items: [newItem, ...(list.task_items || [])] }
              : list
          )
        );
        addItem.mutate(newItem);
      },
      mutateAsync: async (input: any) => addItem.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), done: false, ...input }),
    },
    toggleItem: {
      ...toggleItem,
      mutate: (input: { id: string; done: boolean }) => {
        qc.setQueryData<any[]>(key, (old) =>
          (old ?? []).map((list: any) => ({
            ...list,
            task_items: (list.task_items || []).map((item: any) =>
              item.id === input.id ? { ...item, done: input.done } : item
            ),
          }))
        );
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
