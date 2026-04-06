import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";
import type { MarketList, MarketItem } from "@/types/entities";

function normalizeMarketLists(items: any[], familyId: string | null) {
  if (!familyId) return [];
  return items
    .filter((item) => item.family_id === familyId)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
}

export function useMarketLists() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["market-lists", familyId];

  const apiFn = useCallback(async (since?: string | null) => {
    if (!familyId) return { data: [], error: null };
    const { data: response, error } = await supabase.functions.invoke("market-api", {
      body: { action: "get-lists", family_id: familyId, ...(since ? { since } : {}) },
    });
    if (error) return { data: [], error: error.message };
    if (response?.error) return { data: [], error: response.error };
    return { data: normalizeMarketLists(response?.data || [], familyId), error: null };
  }, [familyId]);

  const { data: lists, isLoading, isSyncing, refetch } = useOfflineFirst<MarketList>({
    table: "market_lists",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
    filterFn: useCallback(
      (items: any[]) => normalizeMarketLists(items, familyId),
      [familyId]
    ),
    scopeKey: familyId ?? undefined,
  });

  // normalizeMarketLists already applied in apiFn and filterFn — no need to re-apply
  const normalizedLists = lists || [];

  // Realtime: listen to market_lists changes only (market-api bumps updated_at on item changes)
  const lastOwnMutationRef = useRef(0);

  useEffect(() => {
    if (!familyId) return;
    const channel = supabase.channel(`market-rt-${familyId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "market_lists",
        filter: `family_id=eq.${familyId}`,
      }, () => {
        if (Date.now() - lastOwnMutationRef.current < 2000) return;
        qc.invalidateQueries({ queryKey: key });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [familyId]);

  const invoke = async (action: string, payload: any) => {
    const { data: response, error } = await supabase.functions.invoke("market-api", { body: { action, ...payload } });
    return { data: response?.data ?? null, error: response?.error || error?.message || null };
  };

  const createList = useOfflineMutation<any, any>({
    table: "market_lists", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("create-list", { family_id: familyId, name: rest.name, type: rest.type || "family", use_categories: rest.use_categories ?? true, id: input.id }); },
    onSuccess: (data, variables) => {
      if (!data) return;
      qc.setQueryData<any[]>(key, (old) =>
        (old ?? []).map(item =>
          item.id === variables.id ? { ...item, ...data } : item
        )
      );
    },
  });

  const updateList = useOfflineMutation<any, any>({
    table: "market_lists", operation: "UPDATE",
    apiFn: async (input) => { const { id, ...updates } = input; return invoke("update-list", { id, ...updates }); },
    queryKey: key,
  });

  const deleteList = useOfflineMutation<any, any>({
    table: "market_lists", operation: "DELETE",
    apiFn: async (input) => invoke("delete-list", { id: input.id }),
    queryKey: key,
  });

  const addItem = useOfflineMutation<any, any>({
    table: "market_items", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-item", { list_id: rest.list_id, name: rest.name, category: rest.category || "أخرى", quantity: rest.quantity || null }); },
  });

  const updateItem = useOfflineMutation<any, any>({
    table: "market_items", operation: "UPDATE",
    apiFn: async (input) => { const { id, ...updates } = input; return invoke("update-item", { id, ...updates }); },
  });

  const deleteItem = useOfflineMutation<any, any>({
    table: "market_items", operation: "DELETE",
    apiFn: async (input) => invoke("delete-item", { id: input.id }),
  });

  return {
    lists: normalizedLists,
    isLoading,
    isSyncing,
    updateList: {
      ...updateList,
      mutate: (input: any) => updateList.mutate(input),
    },
    createList: {
      ...createList,
      mutate: (input: any, options?: any) => {
        const id = input.id || crypto.randomUUID();
        const payload = { created_at: new Date().toISOString(), family_id: familyId, market_items: [], ...input, id };
        // Optimistic: inject into cache immediately
        qc.setQueryData<any[]>(key, (old) => {
          if (!old) return [payload];
          if (old.some((l: any) => l.id === id)) return old;
          return [...old, payload];
        });
        lastOwnMutationRef.current = Date.now();
        if (options?.onSuccess || options?.onError) {
          createList.mutateAsync(payload).then((result) => options?.onSuccess?.(result?.data)).catch((err: any) => options?.onError?.(err));
        } else {
          createList.mutate(payload);
        }
      },
      mutateAsync: async (input: any) => {
        const id = input.id || crypto.randomUUID();
        const payload = { created_at: new Date().toISOString(), family_id: familyId, market_items: [], ...input, id };
        qc.setQueryData<any[]>(key, (old) => {
          if (!old) return [payload];
          if (old.some((l: any) => l.id === id)) return old;
          return [...old, payload];
        });
        return createList.mutateAsync(payload);
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
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), checked: false, added_by: user?.id || null, ...input };
        // Optimistic: inject item into the list's market_items immediately
        qc.setQueryData(key, (old: any[] | undefined) => {
          if (!old) return old;
          return old.map((list: any) =>
            list.id === item.list_id
              ? { ...list, market_items: [...(list.market_items || []), item] }
              : list
          );
        });
        lastOwnMutationRef.current = Date.now();
        addItem.mutate(item);
      },
      mutateAsync: async (input: any) => addItem.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), checked: false, ...input }),
    },
    updateItem: {
      ...updateItem,
      mutate: (input: any) => {
        // Optimistic: update item in the list's market_items immediately
        qc.setQueryData(key, (old: any[] | undefined) => {
          if (!old) return old;
          return old.map((list: any) => ({
            ...list,
            market_items: (list.market_items || []).map((item: any) =>
              item.id === input.id ? { ...item, ...input } : item
            ),
          }));
        });
        lastOwnMutationRef.current = Date.now();
        updateItem.mutate(input);
      },
    },
    deleteItem: {
      ...deleteItem,
      mutate: (itemId: string) => {
        qc.setQueryData(key, (old: any[] | undefined) => {
          if (!old) return old;
          return old.map((list: any) => ({
            ...list,
            market_items: (list.market_items || []).filter((item: any) => item.id !== itemId),
          }));
        });
        lastOwnMutationRef.current = Date.now();
        deleteItem.mutate({ id: itemId });
      },
      mutateAsync: async (itemId: string) => deleteItem.mutateAsync({ id: itemId }),
    },
    pendingItemIds: updateItem.variables?.id && updateItem.isPending ? [updateItem.variables.id as string] : [],
  };
}
