import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";

export function useMarketLists() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["market-lists", familyId];

  const listsQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!familyId) return [];
      const { data: lists, error } = await supabase
        .from("market_lists")
        .select("*, market_items(*)")
        .eq("family_id", familyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return lists || [];
    },
    enabled: !!familyId,
  });

  // Realtime subscription for market_items changes
  useEffect(() => {
    if (!familyId) return;
    const channel = supabase
      .channel(`market-items-${familyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "market_items" },
        () => {
          qc.invalidateQueries({ queryKey: key });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "market_lists", filter: `family_id=eq.${familyId}` },
        () => {
          qc.invalidateQueries({ queryKey: key });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [familyId, qc]);

  const createList = useMutation({
    mutationFn: async (input: { name: string; type?: string; shared_with?: string[]; use_categories?: boolean }) => {
      if (!familyId || !user) throw new Error("No family");
      const { error } = await supabase.from("market_lists").insert({
        name: input.name,
        type: input.type || "family",
        shared_with: input.shared_with || [],
        family_id: familyId,
        created_by: user.id,
        use_categories: input.use_categories ?? true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteList = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase.from("market_lists").delete().eq("id", listId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addItem = useMutation({
    mutationFn: async (input: { list_id: string; name: string; category?: string; quantity?: string }) => {
      if (!user) throw new Error("No user");
      const { error } = await supabase.from("market_items").insert({
        list_id: input.list_id,
        name: input.name,
        category: input.category || "أخرى",
        quantity: input.quantity || "1",
        added_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateItem = useMutation({
    mutationFn: async (input: { id: string; name?: string; category?: string; quantity?: string; checked?: boolean }) => {
      const { id, ...updates } = input;
      if (updates.checked !== undefined) {
        (updates as any).checked_by = user?.id;
      }
      const { error } = await supabase.from("market_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: any) => {
        if (!old) return old;
        return old.map((list: any) => ({
          ...list,
          market_items: list.market_items.map((item: any) =>
            item.id === input.id ? { ...item, ...input } : item
          ),
        }));
      });
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("market_items").delete().eq("id", itemId);
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
    updateItem,
    deleteItem,
    pendingItemIds: updateItem.variables?.id && updateItem.isPending ? [updateItem.variables.id] : [],
  };
}
