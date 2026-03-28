import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export function useZakatAssets() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const key = ["zakat-assets", familyId];

  const apiFn = useCallback(async () => {
    if (!user) return { data: [], error: null };
    const { data, error } = await supabase.functions.invoke("zakat-api", {
      body: { action: "get-assets" },
    });
    if (error) return { data: [], error: error.message };
    if (data?.error) return { data: [], error: data.error };
    return { data: data?.data || [], error: null };
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
      const { data, error } = await supabase.functions.invoke("zakat-api", {
        body: {
          action: "create-asset",
          type: rest.type, name: rest.name, amount: rest.amount || 0,
          currency: rest.currency || "SAR", weight_grams: rest.weight_grams,
          purchase_date: rest.purchase_date, reminder: rest.reminder ?? true,
        },
      });
      return { data: data?.data ?? null, error: data?.error || error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updateAsset = useOfflineMutation<any, any>({
    table: "zakat_assets", operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase.functions.invoke("zakat-api", {
        body: { action: "update-asset", id, ...updates },
      });
      return { data: data?.data ?? null, error: data?.error || error?.message || null };
    },
    queryKey: key,
  });

  const deleteAsset = useOfflineMutation<any, any>({
    table: "zakat_assets", operation: "DELETE",
    apiFn: async (input) => {
      const { data, error } = await supabase.functions.invoke("zakat-api", {
        body: { action: "delete-asset", id: input.id },
      });
      return { data: null, error: data?.error || error?.message || null };
    },
    queryKey: key,
  });

  const addZakatPayment = useOfflineMutation<any, any>({
    table: "zakat_assets", operation: "UPDATE",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data, error } = await supabase.functions.invoke("zakat-api", {
        body: {
          action: "pay-zakat",
          asset_id: rest.asset_id, amount_paid: rest.amount_paid, notes: rest.notes,
        },
      });
      return { data: data?.data ?? null, error: data?.error || error?.message || null };
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
