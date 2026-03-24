/**
 * useOfflineFirst — Hook للقراءة مع أولوية البيانات المحلية
 *
 * يقرأ البيانات من IndexedDB فوراً (0ms) ثم يُحدّث في الخلفية من API.
 * إذا وُجدت بيانات محلية: isLoading = false فوراً (تجربة سلسة بدون انتظار).
 */
import { useQuery, type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/db";
import { syncTable } from "@/lib/syncManager";
import { projectPendingChanges } from "@/lib/syncQueue";
import type { Table } from "dexie";

/* ────────────────────────────────────────────
 *  أنواع
 * ──────────────────────────────────────────── */

export interface UseOfflineFirstOptions<T> {
  /** اسم الجدول في Dexie */
  table: string;
  /** مفتاح React Query */
  queryKey: QueryKey;
  /** دالة جلب البيانات من API */
  apiFn: () => Promise<{ data: T[] | null; error: string | null }>;
  /** مدة صلاحية الكاش — افتراضي: 5 دقائق */
  staleTime?: number;
  /** فلترة إضافية على البيانات المحلية */
  filterFn?: (items: T[]) => T[];
  /** هل الـ Hook مُفعّل؟ */
  enabled?: boolean;
}

export interface UseOfflineFirstReturn<T> {
  data: T[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  refetch: () => void;
}

/* ────────────────────────────────────────────
 *  Hook
 * ──────────────────────────────────────────── */

export function useOfflineFirst<T extends { id: string; created_at?: string }>({
  table: tableName,
  queryKey,
  apiFn,
  staleTime = 5 * 60 * 1000,
  filterFn,
  enabled = true,
}: UseOfflineFirstOptions<T>): UseOfflineFirstReturn<T> {
  const qc = useQueryClient();
  const [localData, setLocalData] = useState<T[] | null>(null);

  // تثبيت filterFn بـ useRef لمنع إعادة إنشاء readLocal كل render
  const filterFnRef = useRef(filterFn);
  filterFnRef.current = filterFn;

  /** قراءة البيانات من IndexedDB مع إسقاط التغييرات المعلقة */
  const readLocal = useCallback(async () => {
    const table = (db as unknown as Record<string, unknown>)[tableName] as Table | undefined;
    if (!table) return;
    const items: T[] = await table.toArray();
    const projected = await projectPendingChanges(tableName, items);
    const filtered = filterFnRef.current ? filterFnRef.current(projected) : projected;
    setLocalData(filtered);
    return filtered;
  }, [tableName]);

  // ── 1. قراءة IndexedDB فوراً عند التحميل ──
  useEffect(() => {
    if (!enabled) return;
    readLocal().then((items) => {
      if (items && items.length > 0) {
        qc.setQueryData(queryKey, items);
      }
    });
  }, [tableName, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. جلب من API في الخلفية — يدمج ولا يمسح البيانات المحلية ──
  const fetchAndSync = useCallback(async (): Promise<T[]> => {
    const result = await syncTable<T>(tableName, () => apiFn());
    // syncTable يُرجع projectPendingChanges تلقائياً
    const fn = filterFnRef.current;
    const filtered = fn ? fn(result) : result;
    setLocalData(filtered);
    return filtered;
  }, [tableName, apiFn]);

  const query = useQuery<T[]>({
    queryKey,
    queryFn: fetchAndSync,
    staleTime,
    enabled,
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
