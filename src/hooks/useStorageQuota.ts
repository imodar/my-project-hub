/**
 * useStorageQuota — مراقبة حصة التخزين المحلي
 *
 * يراقب حصة IndexedDB/localStorage ويُحذّر المستخدم
 * إذا اقترب من الحد الأقصى.
 *
 * @example
 * const { usagePercent, isLow, isWarning, usageMB, quotaMB } = useStorageQuota()
 */
import { useState, useEffect, useCallback } from "react";

interface StorageInfo {
  /** نسبة الاستخدام (0-100) */
  usagePercent: number;
  /** حجم المستخدم بالميجابايت */
  usageMB: number;
  /** الحصة الكاملة بالميجابايت */
  quotaMB: number;
  /** هل الحصة في مستوى تحذير (> 70%) */
  isWarning: boolean;
  /** هل الحصة حرجة (> 90%) */
  isCritical: boolean;
  /** هل API مدعومة */
  isSupported: boolean;
}

const DEFAULT_INFO: StorageInfo = {
  usagePercent: 0,
  usageMB: 0,
  quotaMB: 0,
  isWarning: false,
  isCritical: false,
  isSupported: false,
};

export function useStorageQuota(checkIntervalMs = 60_000): StorageInfo {
  const [info, setInfo] = useState<StorageInfo>(DEFAULT_INFO);

  const checkQuota = useCallback(async () => {
    if (!navigator.storage?.estimate) {
      return;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage ?? 0;
      const quota = estimate.quota ?? 0;

      if (quota === 0) return;

      const usagePercent = Math.round((usage / quota) * 100);
      const usageMB = Math.round(usage / (1024 * 1024) * 10) / 10;
      const quotaMB = Math.round(quota / (1024 * 1024));

      setInfo({
        usagePercent,
        usageMB,
        quotaMB,
        isWarning: usagePercent > 70,
        isCritical: usagePercent > 90,
        isSupported: true,
      });
    } catch {
      // silent — API غير مدعومة أو خطأ
    }
  }, []);

  useEffect(() => {
    checkQuota();
    const interval = setInterval(checkQuota, checkIntervalMs);
    return () => clearInterval(interval);
  }, [checkQuota, checkIntervalMs]);

  return info;
}
