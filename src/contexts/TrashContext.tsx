import React, { createContext, useContext, useCallback, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "@/hooks/useFamilyId";
import { appToast } from "@/lib/toast";
import { db } from "@/lib/db";

export interface TrashItem {
  id: string;
  type: "event" | "debt" | "family_member" | "market_list" | "task_list" | "vehicle";
  title: string;
  description?: string;
  deletedAt: Date;
  deletedBy: string;
  isShared: boolean;
  originalData: any;
  relatedRecords?: any;
}

interface TrashContextType {
  trashItems: TrashItem[];
  addToTrash: (item: Omit<TrashItem, "id" | "deletedAt">) => void;
  restoreItem: (id: string) => Promise<TrashItem | undefined>;
  permanentlyDelete: (id: string) => void;
  clearExpired: () => void;
}

const TrashContext = createContext<TrashContextType>({} as TrashContextType);

export const useTrash = () => useContext(TrashContext);

const EXPIRY_DAYS = 30;

/* ── Map API row → UI TrashItem ── */
const mapRow = (row: any): TrashItem => ({
  id: row.id,
  type: row.type,
  title: row.title,
  description: row.description,
  deletedAt: new Date(row.deleted_at),
  deletedBy: row.user_id,
  isShared: row.is_shared,
  originalData: row.original_data,
  relatedRecords: row.related_records,
});

/* ── Map TrashItem → Dexie row ── */
const toDexieRow = (item: TrashItem, familyId: string) => ({
  id: item.id,
  family_id: familyId,
  type: item.type,
  title: item.title,
  description: item.description || null,
  deleted_at: item.deletedAt.toISOString(),
  user_id: item.deletedBy,
  is_shared: item.isShared,
  original_data: item.originalData,
  related_records: item.relatedRecords,
});

export const TrashProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const queryKey = ["trash-items", familyId];

  // Local placeholder from Dexie
  const [localTrash, setLocalTrash] = useState<TrashItem[]>([]);
  useEffect(() => {
    if (!familyId) return;
    let cancelled = false;
    db.trash_items
      .where("family_id").equals(familyId)
      .toArray()
      .then((rows: any[]) => {
        if (!cancelled && rows.length > 0) {
          setLocalTrash(rows.map((r: any) => mapRow(r)));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [familyId]);

  const { data: trashItems = [] } = useQuery({
    queryKey,
    queryFn: async (): Promise<TrashItem[]> => {
      if (!user || !familyId) return [];
      const { data, error } = await supabase.functions.invoke("trash-api", {
        body: { action: "get-trash", family_id: familyId },
      });
      if (error) {
        console.warn("trash-api fetch error:", error);
        return localTrash.length > 0 ? localTrash : [];
      }
      if (data?.error) {
        console.warn("trash-api data error:", data.error);
        return localTrash.length > 0 ? localTrash : [];
      }
      const items = (data?.data || []).map(mapRow);

      // Write to Dexie
      try {
        const dexieRows = items.map((i: TrashItem) => toDexieRow(i, familyId));
        await db.trash_items.where("family_id").equals(familyId).delete();
        if (dexieRows.length > 0) await db.trash_items.bulkPut(dexieRows);
      } catch { /* non-critical */ }

      return items;
    },
    enabled: !!user && !!familyId,
    staleTime: 2 * 60 * 1000,
    placeholderData: localTrash.length > 0 ? localTrash : undefined,
  });

  const addToTrash = useCallback(
    (item: Omit<TrashItem, "id" | "deletedAt">) => {
      if (!user || !familyId) return;
      const now = new Date();
      const permanentDeleteAt = new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const id = crypto.randomUUID();

      // Write to Dexie optimistically
      try {
        db.trash_items.put({
          id,
          family_id: familyId,
          type: item.type,
          title: item.title,
          description: item.description || null,
          deleted_at: now.toISOString(),
          user_id: item.deletedBy,
          is_shared: item.isShared,
          original_data: item.originalData || null,
          related_records: item.relatedRecords || null,
        });
      } catch { /* non-critical */ }

      supabase.functions.invoke("trash-api", {
        body: {
          action: "move-to-trash",
          family_id: familyId,
          type: item.type,
          title: item.title,
          description: item.description || null,
          original_data: item.originalData || null,
          related_records: item.relatedRecords || null,
          is_shared: item.isShared,
          permanent_delete_at: permanentDeleteAt.toISOString(),
        },
      }).then(({ error }) => {
        if (!error) qc.invalidateQueries({ queryKey });
      });
    },
    [user, familyId, qc, queryKey]
  );

  const restoreItem = useCallback(
    async (id: string): Promise<TrashItem | undefined> => {
      const item = trashItems.find((i) => i.id === id);
      if (!item) return undefined;

      try {
        const { data, error } = await supabase.functions.invoke("trash-api", {
          body: { action: "restore", id },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const restoredType = data?.data?.type;
        const restoredTitle = data?.data?.title || item.title;

        if (restoredType === "market_list" || restoredType === "task_list") {
          appToast.success(`تم استعادة قائمة "${restoredTitle}" بجميع عناصرها`);
        } else {
          appToast.success(`تم استعادة "${restoredTitle}"`);
        }

        // Remove from Dexie
        try { await db.trash_items.delete(id); } catch { /* non-critical */ }

        qc.invalidateQueries({ queryKey });
        return item;
      } catch (err: any) {
        appToast.error("فشل في استعادة العنصر");
        return undefined;
      }
    },
    [trashItems, qc, queryKey]
  );

  const permanentlyDelete = useCallback(
    (id: string) => {
      // Remove from Dexie
      try { db.trash_items.delete(id); } catch { /* non-critical */ }

      supabase.functions.invoke("trash-api", {
        body: { action: "permanent-delete", id },
      }).then(({ error }) => {
        if (!error) qc.invalidateQueries({ queryKey });
      });
    },
    [qc, queryKey]
  );

  const clearExpired = useCallback(() => {
    qc.invalidateQueries({ queryKey });
  }, [qc, queryKey]);

  return (
    <TrashContext.Provider value={{ trashItems, addToTrash, restoreItem, permanentlyDelete, clearExpired }}>
      {children}
    </TrashContext.Provider>
  );
};
