import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useZakatAssets() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["zakat_assets", user?.id];

  const assetsQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("zakat_assets")
        .select("*, zakat_history(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const addAsset = useMutation({
    mutationFn: async (input: {
      type: string; name: string; amount?: number; currency?: string;
      weight_grams?: number; purchase_date?: string; reminder?: boolean;
    }) => {
      if (!user) throw new Error("No user");
      const { error } = await supabase.from("zakat_assets").insert({
        ...input, user_id: user.id, amount: input.amount || 0,
        currency: input.currency || "SAR", reminder: input.reminder ?? true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateAsset = useMutation({
    mutationFn: async (input: { id: string; [k: string]: any }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("zakat_assets").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("zakat_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addZakatPayment = useMutation({
    mutationFn: async (input: { asset_id: string; amount_paid: number; notes?: string }) => {
      const { error } = await supabase.from("zakat_history").insert(input);
      if (error) throw error;
      // Also update zakat_paid_at on the asset
      await supabase.from("zakat_assets").update({ zakat_paid_at: new Date().toISOString() }).eq("id", input.asset_id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    assets: assetsQuery.data || [],
    isLoading: assetsQuery.isLoading,
    addAsset, updateAsset, deleteAsset, addZakatPayment,
  };
}
