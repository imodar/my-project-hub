/**
 * useOfflineMutation — Hook للكتابة مع Optimistic Update
 *
 * يُحدّث React Query cache و IndexedDB فوراً، ثم يُرسل للـ API في الخلفية.
 * إذا فشل الإرسال أو لم يكن هناك اتصال: يُضاف للـ Sync Queue تلقائياً.
 * لا يستدعي invalidateQueries إذا كانت العملية queued فقط.
 */
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { addToQueue } from "@/lib/syncQueue";
import type { SyncOperation } from "@/lib/db";
import type { Table } from "dexie";

/* ────────────────────────────────────────────
 *  أنواع
 * ──────────────────────────────────────────── */

export interface UseOfflineMutationOptions<TData, TVariables> {
  /** اسم الجدول في Dexie */
  table: string;
  /** نوع العملية */
  operation: SyncOperation;
  /** دالة إرسال البيانات للـ API */
  apiFn?: (data: TVariables) => Promise<{ data: TData | null; error: string | null }>;
  /** مفتاح React Query لإعادة الجلب بعد النجاح */
  queryKey?: QueryKey;
  /** callback بعد النجاح */
  onSuccess?: (data: TData | null, variables: TVariables) => void;
  /** callback بعد الفشل */
  onError?: (error: Error, variables: TVariables) => void;
}

/** النتيجة الداخلية تُفرّق بين "نجح فعلاً" و "أُضيف للطابور" */
interface MutationResult<TData> {
  data: TData | null;
  queued: boolean;
}

/* ────────────────────────────────────────────
 *  Hook
 * ──────────────────────────────────────────── */

export function useOfflineMutation<
  TData = unknown,
  TVariables extends Record<string, unknown> = Record<string, unknown>,
>({
  table: tableName,
  operation,
  apiFn,
  queryKey,
  onSuccess,
  onError,
}: UseOfflineMutationOptions<TData, TVariables>) {
  const qc = useQueryClient();

  return useMutation<MutationResult<TData>, Error, TVariables>({
    /* ── Optimistic cache update قبل أي شيء ── */
    onMutate: async (variables) => {
      if (!queryKey) return;

      // إلغاء أي refetch جاري لمنع التعارض
      await qc.cancelQueries({ queryKey });

      // حفظ الحالة السابقة للـ rollback
      const previousData = qc.getQueryData<unknown[]>(queryKey);

      // تحديث React Query cache فوراً
      qc.setQueryData<Record<string, unknown>[]>(queryKey, (old) => {
        const items = old ?? [];
        switch (operation) {
          case "INSERT":
            return [...items, variables as Record<string, unknown>];
          case "UPDATE":
            return items.map((item) =>
              item?.id === variables.id ? { ...item, ...variables } : item
            );
          case "DELETE":
            return items.filter((item) => String(item?.id) !== String(variables.id));
          default:
            return items;
        }
      });

      return { previousData };
    },

    mutationFn: async (variables): Promise<MutationResult<TData>> => {
      const table = (db as unknown as Record<string, unknown>)[tableName] as Table | undefined;
      const isOffline = !navigator.onLine;

      // ── 1. إذا أوفلاين: أضف للـ queue أولاً (قبل تعديل IndexedDB) ──
      // هذا يضمن أن projectPendingChanges تشوف العملية حتى لو readLocal اشتغل بينهما
      if (isOffline) {
        await addToQueue(tableName, operation, variables as Record<string, unknown>);
      }

      // ── 2. تحديث IndexedDB ──
      if (table) {
        try {
          switch (operation) {
            case "INSERT":
              await table.put(variables);
              break;
            case "UPDATE":
              if (variables.id) {
                await table.update(variables.id as string, variables);
              }
              break;
            case "DELETE":
              if (variables.id) {
                await table.delete(variables.id as string);
              }
              break;
          }
        } catch (err) {
          console.warn(`[OfflineMutation] فشل تحديث IndexedDB لـ ${tableName}:`, err);
        }
      }

      // ── 3. إذا أوفلاين: انتهينا (Queue أُضيف في خطوة 1) ──
      if (isOffline) {
        console.info(`[OfflineMutation] 📴 لا اتصال — أُضيفت ${operation} على ${tableName} للطابور`);
        return { data: null, queued: true };
      }

      // ── 4. إرسال للـ API ──
      try {
        const { data, error } = await apiFn(variables);

        if (error) {
          await addToQueue(tableName, operation, variables as Record<string, unknown>);
          console.warn(`[OfflineMutation] فشل API — أُضيفت للطابور: ${error}`);
          return { data: null, queued: true };
        }

        return { data, queued: false };
      } catch {
        await addToQueue(tableName, operation, variables as Record<string, unknown>);
        console.warn(`[OfflineMutation] خطأ شبكة — أُضيفت ${operation} على ${tableName} للطابور`);
        return { data: null, queued: true };
      }
    },

    onSuccess: (result, variables) => {
      if (!result.queued && queryKey) {
        if (result.data && operation === "INSERT") {
          // استبدل الـ optimistic item (UUID مؤقت) بالحقيقي من API
          qc.setQueryData<Record<string, unknown>[]>(queryKey, (old) => {
            if (!old) return old;
            const realId = (result.data as any)?.id;
            if (old.some(item => item.id === realId)) return old;
            return old.map(item =>
              item.id === variables.id ? result.data as Record<string, unknown> : item
            );
          });
        } else {
          qc.invalidateQueries({ queryKey });
        }
      }
      onSuccess?.(result.data, variables);
    },

    onError: (error, variables, context) => {
      // Rollback عند فشل كامل
      if (queryKey && context && typeof context === "object" && "previousData" in context) {
        qc.setQueryData(queryKey, (context as { previousData: unknown }).previousData);
      }
      console.error(`[OfflineMutation] خطأ في ${operation} على ${tableName}:`, error);
      onError?.(error, variables);
    },
  });
}
