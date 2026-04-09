/**
 * useOfflineFirst — Hook للقراءة مع أولوية البيانات المحلية
 *
 * يعتمد على React Query cache كمصدر وحيد (يتم تعبئته بواسطة warmCache عند الإقلاع).
 * لا يقرأ من IndexedDB بشكل مباشر — useQuery يجلب من API عند الحاجة.
 */
import { useQuery, type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { syncTable } from "@/lib/syncManager";
import { db } from "@/lib/db";

/* ────────────────────────────────────────────
 *  أنواع
 * ──────────────────────────────────────────── */

export interface UseOfflineFirstOptions<T> {
  /** اسم الجدول في Dexie */
  table: string;
  /** مفتاح React Query */
  queryKey: QueryKey;
  /** دالة جلب البيانات من API — تستقبل اختيارياً lastSyncedAt لدعم Delta Sync */
  apiFn: (since?: string | null) => Promise<{ data: T[] | null; error: string | null }>;
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

  // ── Dexie direct fallback — حارس لحالات edge case عندما يكون الـ cache فارغاً ──
  // يُقرأ مرة واحدة على mount فقط إذا كان الـ cache لا يزال فارغاً
  const [dexieFallback, setDexieFallback] = useState<T[] | undefined>(undefined);
  useEffect(() => {
    if (cachedData || !enabled) return;
    const tbl = (db as Record<string, unknown>)[tableName] as
      | { toArray: () => Promise<unknown[]> }
      | undefined;
    if (!tbl) return;
    tbl.toArray().then((rows) => {
      const filtered = filterFnRef.current
        ? filterFnRef.current(rows as T[])
        : (rows as T[]);
      if (filtered.length > 0) setDexieFallback(filtered);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- يعمل مرة واحدة على mount
  }, []);

  // ── جلب من API في الخلفية ──
  const fetchAndSync = useCallback(async (): Promise<T[]> => {
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

  // ── مصدر البيانات: cache → dexie fallback → فارغ ──
  const data = query.data ?? cachedData ?? dexieFallback ?? [];
  const isLoading = enabled && query.isLoading && !cachedData && !dexieFallback;
  const isSyncing = query.isFetching && !!(cachedData ?? dexieFallback);

  return {
    data,
    isLoading,
    isSyncing,
    error: query.error ? (query.error as Error).message : null,
    refetch: () => qc.invalidateQueries({ queryKey }),
  };
}
