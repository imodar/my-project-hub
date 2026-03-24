/**
 * useOfflineFirst — Hook للقراءة مع أولوية البيانات المحلية
 *
 * يقرأ البيانات من IndexedDB فوراً (0ms) ثم يُحدّث في الخلفية من API.
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

  // تثبيت filterFn بـ useRef لمنع إعادة إنشاء الدوال كل render
  const filterFnRef = useRef(filterFn);
  filterFnRef.current = filterFn;

  const [initialLoaded, setInitialLoaded] = useState(false);

  /** تطبيق الفلتر */
  const applyFilter = useCallback((items: T[]) => {
    const fn = filterFnRef.current;
    return fn ? fn(items) : items;
  }, []);

  // ── 1. قراءة IndexedDB فوراً وكتابتها في React Query cache مباشرة ──
  useEffect(() => {
    if (!enabled) return;
    (async () => {
      const table = (db as unknown as Record<string, unknown>)[tableName] as Table | undefined;
      if (!table) {
        setInitialLoaded(true);
        return;
      }
      const items: T[] = await table.toArray();
      const projected = await projectPendingChanges(tableName, items);
      const filtered = applyFilter(projected);
      if (filtered.length > 0) {
        qc.setQueryData(queryKey, filtered);
      }
      setInitialLoaded(true);
    })();
  }, [tableName, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

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
