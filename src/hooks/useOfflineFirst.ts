/**
 * useOfflineFirst — Hook للقراءة مع أولوية البيانات المحلية
 *
 * يقرأ البيانات من React Query cache أولاً (0ms)، ثم IndexedDB، ثم API.
 * React Query cache هو المصدر الوحيد للبيانات — لا يوجد state منفصل.
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
  /** مدة صلاحية الكاش — افتراضي: 10 دقائق */
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
  staleTime = 10 * 60 * 1000,
  filterFn,
  enabled = true,
}: UseOfflineFirstOptions<T>): UseOfflineFirstReturn<T> {
  const qc = useQueryClient();

  // تثبيت filterFn بـ useRef لمنع إعادة إنشاء الدوال كل render
  const filterFnRef = useRef(filterFn);
  filterFnRef.current = filterFn;

  /** تطبيق الفلتر */
  const applyFilter = useCallback((items: T[]) => {
    const fn = filterFnRef.current;
    return fn ? fn(items) : items;
  }, []);

  // Check if React Query cache already has data (synchronous — 0ms)
  const cachedData = qc.getQueryData<T[]>(queryKey);
  const [initialLoaded, setInitialLoaded] = useState(() => !!cachedData);

  // Serialize queryKey for stable dependency comparison
  const queryKeyStr = JSON.stringify(queryKey);

  // ── 1. قراءة IndexedDB فقط إذا لم يكن هناك كاش ──
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const table = (db as unknown as Record<string, unknown>)[tableName] as Table | undefined;
      if (!table) {
        if (!cancelled) setInitialLoaded(true);
        return;
      }
      const items: T[] = await table.toArray();
      const projected = await projectPendingChanges(tableName, items);
      const filtered = applyFilter(projected);
      if (!cancelled) {
        if (filtered.length > 0) {
          qc.setQueryData(queryKey, filtered);
        }
        setInitialLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [tableName, enabled, queryKeyStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. جلب من API في الخلفية ──
  const fetchAndSync = useCallback(async (): Promise<T[]> => {
    const result = await syncTable<T>(tableName, () => apiFn());
    return applyFilter(result);
  }, [tableName, apiFn, applyFilter]);

  const query = useQuery<T[]>({
    queryKey,
    queryFn: fetchAndSync,
    staleTime,
    enabled,
  });

  // ── 3. مصدر وحيد: React Query cache ──
  const data = query.data ?? [];
  const isLoading = !initialLoaded && query.isLoading;
  const isSyncing = query.isFetching && initialLoaded;

  return {
    data,
    isLoading,
    isSyncing,
    error: query.error ? (query.error as Error).message : null,
    refetch: () => qc.invalidateQueries({ queryKey }),
  };
}
