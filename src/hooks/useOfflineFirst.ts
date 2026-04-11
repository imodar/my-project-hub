/**
 * useOfflineFirst — Hook للقراءة مع أولوية البيانات المحلية
 *
 * يعتمد على React Query cache كمصدر وحيد (يتم تعبئته بواسطة warmCache عند الإقلاع).
 * لا يقرأ من IndexedDB بشكل مباشر — useQuery يجلب من API عند الحاجة.
 */
import { useQuery, type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { syncTable } from "@/lib/syncManager";

/* ────────────────────────────────────────────
 *  أنواع
 * ──────────────────────────────────────────── */

export interface UseOfflineFirstOptions<T> {
  /** اسم الجدول في Dexie */
  table: string;
  /** مفتاح React Query */
  queryKey: QueryKey;
  /** دالة جلب البيانات من API — تستقبل اختيارياً lastSyncedAt لدعم Delta Sync */
  apiFn?: (since?: string | null) => Promise<{ data: T[] | null; error: string | null }>;
  /** مدة صلاحية الكاش — افتراضي: 10 دقائق */
  staleTime?: number;
  /** فلترة إضافية على البيانات المحلية */
  filterFn?: (items: T[]) => T[];
  /** هل الـ Hook مُفعّل؟ */
  enabled?: boolean;
  /** مفتاح نطاق لعزل sync_meta بين العائلات (مثل familyId) */
  scopeKey?: string;
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
  scopeKey,
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

  // Check React Query cache synchronously (0ms — populated by warmCache)
  const cachedData = qc.getQueryData<T[]>(queryKey);

  // ── جلب من API في الخلفية ──
  const fetchAndSync = useCallback(async (): Promise<T[]> => {
    if (!apiFn) {
      // Local-only mode: read from Dexie directly
      const { db } = await import("@/lib/db");
      const tableObj = (db as any)[tableName];
      if (!tableObj) return [];
      const all = await tableObj.toArray();
      return applyFilter(all);
    }
    const result = await syncTable<T>(
      tableName,
      (lastSyncedAt) => apiFn(lastSyncedAt),
      filterFnRef.current || undefined,
      scopeKey
    );
    return applyFilter(result);
  }, [tableName, apiFn, applyFilter, scopeKey]);

  const query = useQuery<T[]>({
    queryKey,
    queryFn: fetchAndSync,
    staleTime,
    enabled,
  });

  // ── مصدر وحيد: React Query cache ──
  const data = query.data ?? cachedData ?? [];
  const isLoading = enabled && query.isLoading && !cachedData;
  const isSyncing = query.isFetching && !!cachedData;

  return {
    data,
    isLoading,
    isSyncing,
    error: query.error ? (query.error as Error).message : null,
    refetch: () => qc.invalidateQueries({ queryKey }),
  };
}
