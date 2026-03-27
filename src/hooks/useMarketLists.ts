import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

function normalizeMarketLists(items: any[], familyId: string | null) {
  if (!familyId) return [];
  const familyScoped = items.filter((item) => item.family_id === familyId);
  const familyLists = familyScoped.filter((item) => (item.type || "family") === "family");
  if (familyLists.length <= 1) return familyScoped;
  const canonicalFamilyList = familyLists.slice().sort((a, b) => {
    const aItems = Array.isArray(a.market_items) ? a.market_items.length : 0;
    const bItems = Array.isArray(b.market_items) ? b.market_items.length : 0;
    if (bItems !== aItems) return bItems - aItems;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  })[0];
  const nonFamilyLists = familyScoped.filter((item) => (item.type || "family") !== "family");
  return [...nonFamilyLists, canonicalFamilyList].sort(
    (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
  );
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

  const { data: lists, isLoading, refetch } = useOfflineFirst<any>({
    table: "market_lists",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
    filterFn: useCallback(
      (items: any[]) => normalizeMarketLists(items, familyId),
      [familyId]
    ),
  });

  // normalizeMarketLists already applied in apiFn and filterFn — no need to re-apply
  const normalizedLists = lists || [];

  // Realtime handled by useFamilyRealtime — no duplicate channel needed

  const invoke = async (action: string, payload: any) => {
    const { data: response, error } = await supabase.functions.invoke("market-api", { body: { action, ...payload } });
    return { data: response?.data ?? null, error: response?.error || error?.message || null };
  };

  const createList = useOfflineMutation<any, any>({
    table: "market_lists", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("create-list", { family_id: familyId, name: rest.name, type: rest.type || "family", use_categories: rest.use_categories ?? true, id: input.id }); },
    queryKey: key, onSuccess: () => refetch(),
  });

  const deleteList = useOfflineMutation<any, any>({
    table: "market_lists", operation: "DELETE",
    apiFn: async (input) => invoke("delete-list", { id: input.id }),
    queryKey: key,
  });

  const addItem = useOfflineMutation<any, any>({
    table: "market_items", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-item", { list_id: rest.list_id, name: rest.name, category: rest.category || "أخرى", quantity: rest.quantity || "1" }); },
    onSuccess: () => refetch(),
  });

  const updateItem = useOfflineMutation<any, any>({
    table: "market_items", operation: "UPDATE",
    apiFn: async (input) => { const { id, ...updates } = input; return invoke("update-item", { id, ...updates }); },
    onSuccess: () => refetch(),
  });

  const deleteItem = useOfflineMutation<any, any>({
    table: "market_items", operation: "DELETE",
    apiFn: async (input) => invoke("delete-item", { id: input.id }),
    onSuccess: () => refetch(),
  });

  return {
    lists: normalizedLists,
    isLoading,
    createList: {
      ...createList,
      mutate: (input: any, options?: any) => {
        const payload = { id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, market_items: [], ...input };
        if (options?.onSuccess || options?.onError) {
          createList.mutateAsync(payload).then(async (result) => {
            // انتظر حتى تُحدّث البيانات في الكاش قبل اختيار القائمة الجديدة
            await qc.invalidateQueries({ queryKey: key });
            options?.onSuccess?.(result?.data);
          }).catch((err: any) => options?.onError?.(err));
        } else {
          createList.mutate(payload);
        }
      },
      mutateAsync: async (input: any) => createList.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, market_items: [], ...input }),
    },
    deleteList: {
      ...deleteList,
      mutate: (listId: string) => deleteList.mutate({ id: listId }),
      mutateAsync: async (listId: string) => deleteList.mutateAsync({ id: listId }),
    },
    addItem: {
      ...addItem,
      mutate: (input: any) => addItem.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), checked: false, ...input }),
      mutateAsync: async (input: any) => addItem.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), checked: false, ...input }),
    },
    updateItem,
    deleteItem: {
      ...deleteItem,
      mutate: (itemId: string) => deleteItem.mutate({ id: itemId }),
      mutateAsync: async (itemId: string) => deleteItem.mutateAsync({ id: itemId }),
    },
    pendingItemIds: updateItem.variables?.id && updateItem.isPending ? [updateItem.variables.id as string] : [],
  };
}
