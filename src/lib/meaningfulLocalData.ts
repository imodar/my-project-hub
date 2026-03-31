import { db } from "./db";

const NON_MEANINGFUL_TABLES = new Set([
  "families",
  "family_members",
  "profiles",
  "sync_queue",
  "sync_meta",
]);

export interface MeaningfulLocalDataState {
  hasMeaningfulLocalData: boolean;
  totalMeaningfulRecords: number;
}

export async function getMeaningfulLocalDataState(): Promise<MeaningfulLocalDataState> {
  try {
    const tables = db.tables.filter((table) => !NON_MEANINGFUL_TABLES.has(table.name));

    const counts = await Promise.all(
      tables.map((table) => table.count().catch(() => 0))
    );

    const totalMeaningfulRecords = counts.reduce((sum, count) => sum + count, 0);

    return {
      hasMeaningfulLocalData: totalMeaningfulRecords > 0,
      totalMeaningfulRecords,
    };
  } catch {
    return {
      hasMeaningfulLocalData: false,
      totalMeaningfulRecords: 0,
    };
  }
}