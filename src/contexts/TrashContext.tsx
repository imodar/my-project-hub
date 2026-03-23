import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
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
  relatedRecords?: any; // e.g. market_items for a market_list
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

const TRASH_KEY = "family_trash";
const EXPIRY_DAYS = 30;

export const TrashProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [trashItems, setTrashItems] = useState<TrashItem[]>(() => {
    try {
      const saved = localStorage.getItem(TRASH_KEY);
      if (saved) {
        return JSON.parse(saved).map((item: any) => ({
          ...item,
          deletedAt: new Date(item.deletedAt),
        }));
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    localStorage.setItem(TRASH_KEY, JSON.stringify(trashItems));
  }, [trashItems]);

  // Auto-clear expired items
  useEffect(() => {
    const now = new Date();
    setTrashItems((prev) =>
      prev.filter((item) => {
        const diff = now.getTime() - new Date(item.deletedAt).getTime();
        return diff < EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      })
    );
  }, []);

  const addToTrash = useCallback((item: Omit<TrashItem, "id" | "deletedAt">) => {
    const newItem: TrashItem = {
      ...item,
      id: crypto.randomUUID(),
      deletedAt: new Date(),
    };
    setTrashItems((prev) => [newItem, ...prev]);
  }, []);

  const restoreItem = useCallback(async (id: string): Promise<TrashItem | undefined> => {
    let restored: TrashItem | undefined;
    setTrashItems((prev) => {
      restored = prev.find((i) => i.id === id);
      return prev.filter((i) => i.id !== id);
    });

    if (!restored) return undefined;

    try {
      // Handle restoration based on type
      if (restored.type === "market_list" && restored.originalData) {
        const listData = restored.originalData;
        const items = restored.relatedRecords || [];

        // Re-insert the list
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

        // Re-insert items if any
        if (items.length > 0) {
          const itemsToInsert = items.map((item: any) => ({
            id: item.id,
            list_id: listData.id,
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            checked: item.checked,
            checked_by: item.checked_by,
            added_by: item.added_by,
          }));
          const { error: itemsError } = await supabase.from("market_items").insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }

        toast.success(`تم استعادة قائمة "${listData.name}" بجميع منتجاتها`);
      } else if (restored.type === "task_list" && restored.originalData) {
        const listData = restored.originalData;
        const items = restored.relatedRecords || [];

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
          const itemsToInsert = items.map((item: any) => ({
            id: item.id,
            list_id: listData.id,
            name: item.name,
            note: item.note,
            priority: item.priority,
            assigned_to: item.assigned_to,
            done: item.done,
            repeat_enabled: item.repeat_enabled,
            repeat_days: item.repeat_days,
            repeat_count: item.repeat_count,
          }));
          const { error: itemsError } = await supabase.from("task_items").insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }

        toast.success(`تم استعادة قائمة "${listData.name}" بجميع مهامها`);
      } else {
        toast.success(`تم استعادة "${restored.title}"`);
      }
    } catch (err: any) {
      // Re-add to trash on failure
      setTrashItems((prev) => [restored!, ...prev]);
      toast.error("فشل في استعادة العنصر");
      return undefined;
    }

    return restored;
  }, []);

  const permanentlyDelete = useCallback((id: string) => {
    setTrashItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearExpired = useCallback(() => {
    const now = new Date();
    setTrashItems((prev) =>
      prev.filter((item) => {
        const diff = now.getTime() - new Date(item.deletedAt).getTime();
        return diff < EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      })
    );
  }, []);

  return (
    <TrashContext.Provider value={{ trashItems, addToTrash, restoreItem, permanentlyDelete, clearExpired }}>
      {children}
    </TrashContext.Provider>
  );
};
