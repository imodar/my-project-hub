import React, { createContext, useContext, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

/* ── Map Supabase row → UI TrashItem ── */
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
      const { data, error } = await supabase
        .from("trash_items")
        .select("*")
        .eq("family_id", familyId)
        .eq("restored", false)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapRow);
    },
    enabled: !!user && !!familyId,
    staleTime: 2 * 60 * 1000,
  });

  const addToTrash = useCallback(
    (item: Omit<TrashItem, "id" | "deletedAt">) => {
      if (!user || !familyId) return;
      const now = new Date();
      const permanentDeleteAt = new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      supabase
        .from("trash_items")
        .insert({
          type: item.type,
          title: item.title,
          description: item.description || null,
          user_id: user.id,
          family_id: familyId,
          is_shared: item.isShared,
          original_data: item.originalData || null,
          related_records: item.relatedRecords || null,
          permanent_delete_at: permanentDeleteAt.toISOString(),
        } as never)
        .then(({ error }) => {
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
        // Handle restoration based on type
        if (item.type === "market_list" && item.originalData) {
          const listData = item.originalData;
          const items = item.relatedRecords || [];

          const { error: listError } = await supabase.from("market_lists").insert({
            id: listData.id,
            name: listData.name,
            type: listData.type,
            family_id: listData.family_id,
            created_by: listData.created_by,
            shared_with: listData.shared_with || [],
            use_categories: listData.use_categories ?? true,
          });
          if (listError) throw listError;

          if (items.length > 0) {
            const itemsToInsert = items.map((it: any) => ({
              id: it.id,
              list_id: listData.id,
              name: it.name,
              category: it.category,
              quantity: it.quantity,
              checked: it.checked,
              checked_by: it.checked_by,
              added_by: it.added_by,
            }));
            const { error: itemsError } = await supabase.from("market_items").insert(itemsToInsert);
            if (itemsError) throw itemsError;
          }
          toast.success(`تم استعادة قائمة "${listData.name}" بجميع منتجاتها`);
        } else if (item.type === "task_list" && item.originalData) {
          const listData = item.originalData;
          const items = item.relatedRecords || [];

          const { error: listError } = await supabase.from("task_lists").insert({
            id: listData.id,
            name: listData.name,
            type: listData.type,
            family_id: listData.family_id,
            created_by: listData.created_by,
            shared_with: listData.shared_with || [],
          });
          if (listError) throw listError;

          if (items.length > 0) {
            const itemsToInsert = items.map((it: any) => ({
              id: it.id,
              list_id: listData.id,
              name: it.name,
              note: it.note,
              priority: it.priority,
              assigned_to: it.assigned_to,
              done: it.done,
              repeat_enabled: it.repeat_enabled,
              repeat_days: it.repeat_days,
              repeat_count: it.repeat_count,
            }));
            const { error: itemsError } = await supabase.from("task_items").insert(itemsToInsert);
            if (itemsError) throw itemsError;
          }
          toast.success(`تم استعادة قائمة "${listData.name}" بجميع مهامها`);
        } else {
          toast.success(`تم استعادة "${item.title}"`);
        }

        // Mark as restored in Supabase
        await supabase.from("trash_items").update({ restored: true } as never).eq("id", id);
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
      supabase
        .from("trash_items")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (!error) qc.invalidateQueries({ queryKey });
        });
    },
    [qc, queryKey]
  );

  const clearExpired = useCallback(() => {
    // Server handles expiry via permanent_delete_at, but we can trigger cleanup
    qc.invalidateQueries({ queryKey });
  }, [qc, queryKey]);

  return (
    <TrashContext.Provider value={{ trashItems, addToTrash, restoreItem, permanentlyDelete, clearExpired }}>
      {children}
    </TrashContext.Provider>
  );
});
TrashProvider.displayName = "TrashProvider";
