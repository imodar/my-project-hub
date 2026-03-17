import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface TrashItem {
  id: string;
  type: "event" | "debt" | "family_member";
  title: string;
  description?: string;
  deletedAt: Date;
  deletedBy: string;
  isShared: boolean; // family-shared items
  originalData: any;
}

interface TrashContextType {
  trashItems: TrashItem[];
  addToTrash: (item: Omit<TrashItem, "id" | "deletedAt">) => void;
  restoreItem: (id: string) => TrashItem | undefined;
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

  const restoreItem = useCallback((id: string) => {
    let restored: TrashItem | undefined;
    setTrashItems((prev) => {
      restored = prev.find((i) => i.id === id);
      return prev.filter((i) => i.id !== id);
    });
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
