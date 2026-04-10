import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";
import { db } from "@/lib/db";

/**
 * الزكاة محلية 100% — لا اتصال بالسيرفر للقراءة.
 * عند أول تشغيل (Dexie فارغ) يتم استيراد البيانات من السيرفر مرة واحدة فقط.
 */
export function useZakatAssets() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["zakat-assets", familyId];
  const migratedRef = useRef(false);

  // استيراد أولي من السيرفر إذا كان Dexie فارغاً
  useEffect(() => {
    if (!user || migratedRef.current) return;
    migratedRef.current = true;

    (async () => {
      const existing = await db.zakat_assets.count();
      if (existing > 0) return;

      try {
        const { data, error } = await supabase.functions.invoke("zakat-api", {
          body: { action: "get-assets" },
        });
        if (error || data?.error) return;
        const records: any[] = data?.data || [];
        if (records.length > 0) {
          await db.zakat_assets.bulkPut(records);
          qc.invalidateQueries({ queryKey: key });
        }
      } catch {
        // فشل الاستيراد — سيُعاد عند الفتح التالي
      }
    })();
  }, [user]);

  // قراءة من Dexie فقط — بدون apiFn
  const { data: assets, isLoading } = useOfflineFirst<any>({
    table: "zakat_assets",
    queryKey: key,
    enabled: !!user,
    filterFn: useCallback(
      (items: any[]) => items.filter((a: any) => !a.user_id || a.user_id === user?.id),
      [user?.id]
    ),
  });

  // Helper: optimistic update for zakat_history inside an asset
  const optimisticAssetSub = useCallback(
    (assetId: string, updater: (history: any[]) => any[]) => {
      qc.setQueryData<any[]>(key, (old) => {
        if (!old) return old;
        return old.map((a: any) =>
          a.id === assetId ? { ...a, zakat_history: updater(a.zakat_history || []) } : a
        );
      });
    },
    [qc, key]
  );

  // كل mutation تكتب في Dexie فقط — بدون apiFn
  const addAsset = useOfflineMutation<any, any>({
    table: "zakat_assets", operation: "INSERT",
    queryKey: key,
  });

  const updateAsset = useOfflineMutation<any, any>({
    table: "zakat_assets", operation: "UPDATE",
    queryKey: key,
  });

  const deleteAsset = useOfflineMutation<any, any>({
    table: "zakat_assets", operation: "DELETE",
    queryKey: key,
  });

  const addZakatPayment = useOfflineMutation<any, any>({
    table: "zakat_history", operation: "INSERT",
    queryKey: key,
  });

  return {
    assets: assets || [], isLoading,
    addAsset: {
      ...addAsset,
      mutate: (input: any) => addAsset.mutate({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        user_id: user?.id,
        zakat_history: [],
        ...input,
      }),
      mutateAsync: async (input: any) => addAsset.mutateAsync({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        user_id: user?.id,
        zakat_history: [],
        ...input,
      }),
    },
    updateAsset,
    deleteAsset: {
      ...deleteAsset,
      mutate: (id: string) => deleteAsset.mutate({ id }),
      mutateAsync: async (id: string) => deleteAsset.mutateAsync({ id }),
    },
    addZakatPayment: {
      ...addZakatPayment,
      mutate: (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        optimisticAssetSub(input.asset_id, (history) => [
          ...history,
          { amount_paid: input.amount_paid, notes: input.notes, paid_at: new Date().toISOString() },
        ]);
        addZakatPayment.mutate(item);
      },
      mutateAsync: async (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        optimisticAssetSub(input.asset_id, (history) => [
          ...history,
          { amount_paid: input.amount_paid, notes: input.notes, paid_at: new Date().toISOString() },
        ]);
        return addZakatPayment.mutateAsync(item);
      },
    },
  };
}
