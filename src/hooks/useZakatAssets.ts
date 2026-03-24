import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export function useZakatAssets() {
  const { user } = useAuth();
  const key = ["zakat_assets", user?.id];

  const apiFn = useCallback(async () => {
    if (!user) return { data: [], error: null };
    const { data, error } = await supabase
      .from("zakat_assets")
      .select("*, zakat_history(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    return { data: data || [], error: error?.message || null };
  }, [user]);

  const { data: assets, isLoading, refetch } = useOfflineFirst<any>({
    table: "zakat_assets",
    queryKey: key,
    apiFn,
    enabled: !!user,
  });

  const addAsset = useOfflineMutation<any, any>({
    table: "zakat_assets", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { error } = await supabase.from("zakat_assets").insert({
        ...rest, user_id: user!.id, amount: rest.amount || 0,
        currency: rest.currency || "SAR", reminder: rest.reminder ?? true,
      });
      return { data: null, error: error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updateAsset = useOfflineMutation<any, any>({
    table: "zakat_assets", operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("zakat_assets").update(updates).eq("id", id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const deleteAsset = useOfflineMutation<any, any>({
    table: "zakat_assets", operation: "DELETE",
    apiFn: async (input) => {
      const { error } = await supabase.from("zakat_assets").delete().eq("id", input.id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const addZakatPayment = useOfflineMutation<any, any>({
    table: "zakat_assets", operation: "UPDATE", // payment updates asset's zakat_paid_at
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { error } = await supabase.from("zakat_history").insert({
        asset_id: rest.asset_id, amount_paid: rest.amount_paid, notes: rest.notes,
      });
      if (error) return { data: null, error: error.message };
      await supabase.from("zakat_assets").update({ zakat_paid_at: new Date().toISOString() }).eq("id", rest.asset_id);
      return { data: null, error: null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  return {
    assets: assets || [], isLoading,
    addAsset: {
      ...addAsset,
      mutate: (input: any) => addAsset.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), user_id: user?.id, zakat_history: [], ...input }),
      mutateAsync: async (input: any) => addAsset.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), user_id: user?.id, zakat_history: [], ...input }),
    },
    updateAsset, deleteAsset: {
      ...deleteAsset,
      mutate: (id: string) => deleteAsset.mutate({ id }),
      mutateAsync: async (id: string) => deleteAsset.mutateAsync({ id }),
    },
    addZakatPayment: {
      ...addZakatPayment,
      mutate: (input: any) => addZakatPayment.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input }),
      mutateAsync: async (input: any) => addZakatPayment.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input }),
    },
  };
}
