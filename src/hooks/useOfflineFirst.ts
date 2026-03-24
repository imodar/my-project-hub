/**
 * useOfflineFirst — Hook للقراءة مع أولوية البيانات المحلية
 *
 * يقرأ البيانات من IndexedDB فوراً (0ms) ثم يُحدّث في الخلفية من API.
 * إذا وُجدت بيانات محلية: isLoading = false فوراً (تجربة سلسة بدون انتظار).
 *
 * @example
 * const { data, isLoading, isSyncing } = useOfflineFirst({
 *   table: "medications",
 *   queryKey: ["medications", familyId],
 *   apiFn: () => supabase.from("medications").select("*").eq("family_id", familyId),
 *   staleTime: 5 * 60 * 1000,
 * });
 */
import { useQuery, type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/db";
import { syncTable } from "@/lib/syncManager";
import type { Table } from "dexie";

/* ────────────────────────────────────────────
 *  أنواع
 * ──────────────────────────────────────────── */

export interface UseOfflineFirstOptions<T> {
  /** اسم الجدول في Dexie (مثل "medications") */
  table: string;
  /** مفتاح React Query */
  queryKey: QueryKey;
  /** دالة جلب البيانات من API — تُرجع { data, error } */
  apiFn: () => Promise<{ data: T[] | null; error: string | null }>;
  /** مدة صلاحية الكاش (بالمللي ثانية) — افتراضي: 5 دقائق */
  staleTime?: number;
  /** فلترة إضافية على البيانات المحلية */
  filterFn?: (items: T[]) => T[];
  /** هل الـ Hook مُفعّل؟ (افتراضي: true) */
  enabled?: boolean;
}

export interface UseOfflineFirstReturn<T> {
  /** البيانات (محلية أو من API) */
  data: T[];
  /** true فقط إذا لا توجد بيانات محلية ولا API بعد */
  isLoading: boolean;
  /** true أثناء الجلب من API في الخلفية */
  isSyncing: boolean;
  /** رسالة الخطأ إن وُجدت */
  error: string | null;
  /** إعادة الجلب يدوياً */
  refetch: () => void;
}

/* ────────────────────────────────────────────
 *  Hook
 * ──────────────────────────────────────────── */

export function useOfflineFirst<T extends { id: string }>({
  table: tableName,
  queryKey,
  apiFn,
  staleTime = 5 * 60 * 1000,
  filterFn,
  enabled = true,
}: UseOfflineFirstOptions<T>): UseOfflineFirstReturn<T> {
  const qc = useQueryClient();
  const [localData, setLocalData] = useState<T[] | null>(null);

  /** قراءة البيانات من IndexedDB */
  const readLocal = useCallback(async () => {
    const table = (db as unknown as Record<string, unknown>)[tableName] as Table | undefined;
    if (!table) return;
    const items: T[] = await table.toArray();
    const filtered = filterFn ? filterFn(items) : items;
    setLocalData(filtered);
    return filtered;
  }, [tableName, filterFn]);

  // ── 1. قراءة IndexedDB فوراً عند التحميل ──
  useEffect(() => {
    if (!enabled) return;
    readLocal().then((items) => {
      if (items && items.length > 0) {
        qc.setQueryData(queryKey, items);
      }
    });
  }, [tableName, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. جلب من API في الخلفية ──
  const fetchAndSync = useCallback(async (): Promise<T[]> => {
    const result = await syncTable<T>(tableName, () => apiFn());
    const filtered = filterFn ? filterFn(result) : result;
    setLocalData(filtered);
    return filtered;
  }, [tableName, apiFn, filterFn]);

  const query = useQuery<T[]>({
    queryKey,
    queryFn: fetchAndSync,
    staleTime,
    enabled: enabled,
    // لا نُظهر loading إذا عندنا بيانات محلية
    placeholderData: localData ?? undefined,
  });

  // ── 3. حساب الحالات ──
  const hasLocalData = localData !== null && localData.length > 0;
  const isLoading = !hasLocalData && query.isLoading;
  const isSyncing = query.isFetching && hasLocalData;

  return {
    data: (query.data ?? localData ?? []) as T[],
    isLoading,
    isSyncing,
    error: query.error ? (query.error as Error).message : null,
    refetch: () => qc.invalidateQueries({ queryKey }),
  };
}
