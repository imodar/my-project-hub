import { supabase } from "@/integrations/supabase/client";
import { db } from "./db";
import { FULL_SYNC_STEPS } from "./resourceRegistry";
import type { ChildTableConfig } from "./resourceRegistry";

export interface SyncProgress {
  current: number; // 0-100
  label: string;
}

/**
 * استخراج وحفظ البيانات المتداخلة (children + grandchildren) في Dexie
 */
async function persistChildTables(
  items: any[],
  childTables: ChildTableConfig[]
): Promise<void> {
  for (const child of childTables) {
    const childItems = items.flatMap((item: any) => item[child.key] || []);
    if (childItems.length > 0) {
      const table = (db as any)[child.table];
      if (table) await table.bulkPut(childItems);
    }
    // مستوى ثانٍ (grandchildren)
    if (child.nested) {
      for (const grandChild of child.nested) {
        const gcItems = childItems.flatMap((c: any) => c[grandChild.key] || []);
        if (gcItems.length > 0) {
          const gcTable = (db as any)[grandChild.table];
          if (gcTable) await gcTable.bulkPut(gcItems);
        }
      }
    }
  }
}

const fetchWithTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);

/**
 * كتابة آمنة تتعامل مع QuotaExceededError
 */
async function safeBulkPut(table: any, items: any[], tableName: string): Promise<void> {
  try {
    await table.bulkPut(items);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      console.error(`[FullSync] ⚠️ مساحة التخزين ممتلئة أثناء كتابة "${tableName}"`);
      window.dispatchEvent(new CustomEvent("storage-quota-exceeded", { detail: { table: tableName } }));
    } else {
      throw err;
    }
  }
}

export async function fullSync(
  familyId: string,
  onProgress: (p: SyncProgress) => void
): Promise<void> {
  const total = FULL_SYNC_STEPS.length;
  let completed = 0;

  onProgress({ current: 0, label: "جاري التجهيز..." });

  const BATCH_SIZE = 5;
  for (let i = 0; i < FULL_SYNC_STEPS.length; i += BATCH_SIZE) {
    const batch = FULL_SYNC_STEPS.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (step) => {
        try {
          const { data: response } = await fetchWithTimeout(
            supabase.functions.invoke(step.fn, {
              body: { action: step.action, family_id: familyId },
            }),
            30_000
          );

          const items = response?.data || [];
          if (items.length > 0) {
            const table = (db as any)[step.table];
            if (table) await safeBulkPut(table, items, step.table);

            if (step.childTables && step.childTables.length > 0) {
              await persistChildTables(items, step.childTables);
            }
          }
        } catch {
          // فشل جدول واحد لا يوقف الباقي
        }

        completed++;
        onProgress({
          current: Math.round((completed / total) * 100),
          label: step.label,
        });
      })
    );
  }

  onProgress({ current: 100, label: "اكتمل" });
  localStorage.setItem("first_sync_done", "1");
  localStorage.setItem("last_sync_ts", new Date().toISOString());
}
