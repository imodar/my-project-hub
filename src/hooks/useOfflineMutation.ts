/**
 * useOfflineMutation — Hook للكتابة مع Optimistic Update
 *
 * يُحدّث IndexedDB والشاشة فوراً، ثم يُرسل للـ API في الخلفية.
 * إذا فشل الإرسال أو لم يكن هناك اتصال: يُضاف للـ Sync Queue تلقائياً.
 *
 * @example
 * const { mutate, isPending } = useOfflineMutation({
 *   table: "medications",
 *   operation: "INSERT",
 *   apiFn: (data) => supabase.from("medications").insert(data),
 *   queryKey: ["medications", familyId],
 * });
 *
 * mutate({ id: crypto.randomUUID(), name: "باراسيتامول", ... });
 */
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { addToQueue, type SyncOperation } from "@/lib/syncQueue";
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
  apiFn: (data: TVariables) => Promise<{ data: TData | null; error: string | null }>;
  /** مفتاح React Query لإعادة الجلب بعد النجاح */
  queryKey?: QueryKey;
  /** callback بعد النجاح */
  onSuccess?: (data: TData | null, variables: TVariables) => void;
  /** callback بعد الفشل */
  onError?: (error: Error, variables: TVariables) => void;
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

  return useMutation<TData | null, Error, TVariables>({
    mutationFn: async (variables) => {
      const table = (db as Record<string, unknown>)[tableName] as Table | undefined;

      // ── 1. Optimistic Update: تحديث IndexedDB فوراً ──
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

      // ── 2. إرسال للـ API ──
      if (!navigator.onLine) {
        // لا يوجد اتصال — إضافة للطابور
        await addToQueue(tableName, operation, variables as Record<string, unknown>);
        console.info(`[OfflineMutation] 📴 لا اتصال — أُضيفت ${operation} على ${tableName} للطابور`);
        return null;
      }

      try {
        const { data, error } = await apiFn(variables);

        if (error) {
          // فشل API — إضافة للطابور
          await addToQueue(tableName, operation, variables as Record<string, unknown>);
          console.warn(`[OfflineMutation] فشل API — أُضيفت للطابور: ${error}`);
          return null;
        }

        return data;
      } catch {
        // خطأ شبكة — إضافة للطابور
        await addToQueue(tableName, operation, variables as Record<string, unknown>);
        console.warn(`[OfflineMutation] خطأ شبكة — أُضيفت ${operation} على ${tableName} للطابور`);
        return null;
      }
    },

    onSuccess: (data, variables) => {
      // إعادة جلب البيانات لتحديث الشاشة
      if (queryKey) {
        qc.invalidateQueries({ queryKey });
      }
      onSuccess?.(data, variables);
    },

    onError: (error, variables) => {
      console.error(`[OfflineMutation] خطأ في ${operation} على ${tableName}:`, error);
      onError?.(error, variables);
    },
  });
}
