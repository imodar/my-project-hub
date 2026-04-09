/**
 * useDraftPersistence — حفظ مسودات النماذج تلقائياً
 *
 * يحفظ بيانات النماذج الطويلة في localStorage بشكل تلقائي،
 * مما يمنع فقدان البيانات عند إغلاق التطبيق أو انقطاع الاتصال.
 *
 * @example
 * const { hasDraft, loadDraft, saveDraft, clearDraft } = useDraftPersistence('trip-form')
 *
 * // في onSubmit:
 * clearDraft()
 *
 * // في onChange:
 * saveDraft(formValues)
 */
import { useCallback, useEffect, useRef } from "react";

const DRAFT_PREFIX = "draft:v1:";
const DEBOUNCE_MS = 600;

export interface UseDraftPersistenceReturn<T> {
  /** هل توجد مسودة محفوظة؟ */
  hasDraft: boolean;
  /** تحميل المسودة المحفوظة — تُرجع null إذا لم تكن موجودة */
  loadDraft: () => T | null;
  /** حفظ المسودة (مع debounce تلقائي) */
  saveDraft: (data: T) => void;
  /** حذف المسودة بعد الحفظ الناجح */
  clearDraft: () => void;
}

export function useDraftPersistence<T>(key: string): UseDraftPersistenceReturn<T> {
  const storageKey = `${DRAFT_PREFIX}${key}`;
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // تنظيف عند unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const hasDraft = useCallback((): boolean => {
    try {
      return localStorage.getItem(storageKey) !== null;
    } catch {
      return false;
    }
  }, [storageKey]);

  const loadDraft = useCallback((): T | null => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return null;
      return JSON.parse(saved) as T;
    } catch {
      // المسودة تالفة — احذفها
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      return null;
    }
  }, [storageKey]);

  const saveDraft = useCallback((data: T): void => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch (err) {
        // localStorage ممتلئ — تجاهل بصمت
        console.warn("[DraftPersistence] فشل حفظ المسودة:", err);
      }
    }, DEBOUNCE_MS);
  }, [storageKey]);

  const clearDraft = useCallback((): void => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    try {
      localStorage.removeItem(storageKey);
    } catch { /* ignore */ }
  }, [storageKey]);

  return {
    hasDraft: hasDraft(),
    loadDraft,
    saveDraft,
    clearDraft,
  };
}
