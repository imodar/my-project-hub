import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";
import { db } from "@/lib/db";
import type { Debt } from "@/types/entities";

/**
 * الديون محلية 100% — لا اتصال بالسيرفر للقراءة.
 * عند أول تشغيل (Dexie فارغ) يتم استيراد البيانات من السيرفر مرة واحدة فقط.
 * البيانات تبقى في Supabase كـ backup ولا تُحذف.
 */
export function useDebts() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["debts", familyId];
  const migratedRef = useRef(false);

  // استيراد أولي من السيرفر إذا كان Dexie فارغاً
  useEffect(() => {
    if (!user || !familyId || migratedRef.current) return;
    migratedRef.current = true;

    (async () => {
      const existing = await db.debts.where("family_id").equals(familyId).count();
      if (existing > 0) return; // بيانات موجودة محلياً — لا حاجة للاستيراد

      try {
        const { data, error } = await supabase.functions.invoke("debts-api", {
          body: { action: "get-debts" },
        });
        if (error || data?.error) return;
        const records: any[] = data?.data || [];
        if (records.length > 0) {
          await db.debts.bulkPut(records);
          // استيراد المدفوعات والتأجيلات المرتبطة
          const payments = records.flatMap((d: any) => d.debt_payments || []);
          const postponements = records.flatMap((d: any) => d.debt_postponements || []);
          if (payments.length > 0) await db.debt_payments.bulkPut(payments);
          // debt_postponements مخزّنة داخل سجل الدين نفسه
          qc.invalidateQueries({ queryKey: key });
        }
      } catch {
        // فشل الاستيراد — سيُعاد عند الفتح التالي
      }
    })();
  }, [user, familyId]);

  // قراءة من Dexie فقط — بدون apiFn
  const { data: debts, isLoading } = useOfflineFirst<Debt>({
    table: "debts",
    queryKey: key,
    enabled: !!user && !!familyId,
    filterFn: useCallback(
      (items: any[]) => items.filter((d: any) => d.family_id === familyId || d.user_id === user?.id),
      [familyId, user?.id]
    ),
    scopeKey: familyId ?? undefined,
  });

  // Helper: optimistic update for sub-items inside a debt
  const optimisticDebtSub = useCallback(
    (debtId: string, subKey: string, updater: (items: any[]) => any[]) => {
      qc.setQueryData<any[]>(key, (old) => {
        if (!old) return old;
        return old.map((d: any) =>
          d.id === debtId ? { ...d, [subKey]: updater(d[subKey] || []) } : d
        );
      });
    },
    [qc, key]
  );

  // كل mutation تكتب في Dexie فقط — بدون apiFn
  const addDebt = useOfflineMutation<any, any>({
    table: "debts", operation: "INSERT",
    queryKey: key,
  });

  const updateDebt = useOfflineMutation<any, any>({
    table: "debts", operation: "UPDATE",
    queryKey: key,
  });

  const deleteDebt = useOfflineMutation<any, any>({
    table: "debts", operation: "DELETE",
    queryKey: key,
  });

  const addPayment = useOfflineMutation<any, any>({
    table: "debt_payments", operation: "INSERT",
  });

  const addPostponement = useOfflineMutation<any, any>({
    table: "debt_payments", operation: "INSERT",
  });

  return {
    debts: debts || [], isLoading,
    addDebt: {
      ...addDebt,
      mutate: (input: any) => addDebt.mutate({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        user_id: user?.id,
        family_id: familyId,
        debt_payments: [],
        debt_postponements: [],
        ...input,
      }),
      mutateAsync: async (input: any) => addDebt.mutateAsync({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        user_id: user?.id,
        family_id: familyId,
        debt_payments: [],
        debt_postponements: [],
        ...input,
      }),
    },
    updateDebt,
    deleteDebt: {
      ...deleteDebt,
      mutate: (debtId: string) => deleteDebt.mutate({ id: debtId }),
      mutateAsync: async (debtId: string) => deleteDebt.mutateAsync({ id: debtId }),
    },
    addPayment: {
      ...addPayment,
      mutate: (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        optimisticDebtSub(input.debt_id, "debt_payments", (payments) => [...payments, item]);
        addPayment.mutate(item);
      },
      mutateAsync: async (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        optimisticDebtSub(input.debt_id, "debt_payments", (payments) => [...payments, item]);
        return addPayment.mutateAsync(item);
      },
    },
    addPostponement: {
      ...addPostponement,
      mutate: (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        optimisticDebtSub(input.debt_id, "debt_postponements", (posts) => [...posts, item]);
        addPostponement.mutate(item);
      },
      mutateAsync: async (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        optimisticDebtSub(input.debt_id, "debt_postponements", (posts) => [...posts, item]);
        return addPostponement.mutateAsync(item);
      },
    },
  };
}
