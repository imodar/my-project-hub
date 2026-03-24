import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export function useMarketLists() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["market-lists", familyId];

  const apiFn = useCallback(async () => {
    if (!familyId) return { data: [], error: null };
    const { data, error } = await supabase
      .from("market_lists")
      .select("*, market_items(*)")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true });
    return { data: data || [], error: error?.message || null };
  }, [familyId]);

  const { data: lists, isLoading, refetch } = useOfflineFirst<any>({
    table: "market_lists",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
  });

  // Realtime subscription (kept alongside offline-first)
  useEffect(() => {
    if (!familyId) return;
    const channel = supabase
      .channel(`market-items-${familyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "market_items" }, () => {
        qc.invalidateQueries({ queryKey: key });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "market_lists", filter: `family_id=eq.${familyId}` }, () => {
        qc.invalidateQueries({ queryKey: key });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [familyId, qc]);

  const createList = useOfflineMutation<any, any>({
    table: "market_lists",
    operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data, error } = await supabase.from("market_lists").insert({
        name: rest.name,
        type: rest.type || "family",
        shared_with: rest.shared_with || [],
        family_id: familyId,
        created_by: user?.id,
        use_categories: rest.use_categories ?? true,
      }).select("id").single();
      return { data, error: error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const deleteList = useOfflineMutation<any, any>({
    table: "market_lists",
    operation: "DELETE",
    apiFn: async (input) => {
      const { error } = await supabase.from("market_lists").delete().eq("id", input.id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const addItem = useOfflineMutation<any, any>({
    table: "market_items",
    operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { error } = await supabase.from("market_items").insert({
        list_id: rest.list_id,
        name: rest.name,
        category: rest.category || "أخرى",
        quantity: rest.quantity || "1",
        added_by: user?.id,
      });
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const updateItem = useOfflineMutation<any, any>({
    table: "market_items",
    operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      if (updates.checked !== undefined) {
        (updates as any).checked_by = user?.id;
      }
      const { error } = await supabase.from("market_items").update(updates).eq("id", id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const deleteItem = useOfflineMutation<any, any>({
    table: "market_items",
    operation: "DELETE",
    apiFn: async (input) => {
      const { error } = await supabase.from("market_items").delete().eq("id", input.id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  return {
    lists: lists || [],
    isLoading,
    createList: {
      ...createList,
      mutate: (input: any) => createList.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, market_items: [], ...input }),
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
