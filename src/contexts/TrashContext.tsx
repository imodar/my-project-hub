import React, { createContext, useContext, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "@/hooks/useFamilyId";
import { toast } from "sonner";

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

export const TrashProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const queryKey = ["trash-items", familyId];

  const { data: trashItems = [] } = useQuery({
    queryKey,
    queryFn: async (): Promise<TrashItem[]> => {
      if (!user || !familyId) return [];
      const { data, error } = await supabase.functions.invoke("trash-api", {
        body: { action: "get-trash", family_id: familyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.data || []).map(mapRow);
    },
    enabled: !!user && !!familyId,
    staleTime: 2 * 60 * 1000,
  });

  const addToTrash = useCallback(
    (item: Omit<TrashItem, "id" | "deletedAt">) => {
      if (!user || !familyId) return;
      const now = new Date();
      const permanentDeleteAt = new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

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
          toast.success(`تم استعادة قائمة "${restoredTitle}" بجميع عناصرها`);
        } else {
          toast.success(`تم استعادة "${restoredTitle}"`);
        }

        qc.invalidateQueries({ queryKey });
        return item;
      } catch (err: any) {
        toast.error("فشل في استعادة العنصر");
        return undefined;
      }
    },
    [trashItems, qc, queryKey]
  );

  const permanentlyDelete = useCallback(
    (id: string) => {
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
