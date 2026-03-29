import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export function useDocumentLists() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["document-lists", familyId];

  const apiFn = useCallback(async () => {
    if (!familyId) return { data: [], error: null };
    const { data: response, error } = await supabase.functions.invoke("documents-api", {
      body: { action: "get-lists", family_id: familyId },
    });
    if (error) return { data: [], error: error.message };
    if (response?.error) return { data: [], error: response.error };
    return { data: response?.data || [], error: null };
  }, [familyId]);

  const { data: lists, isLoading, refetch } = useOfflineFirst<any>({
    table: "document_lists",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
    scopeKey: familyId ?? undefined,
  });

  const invoke = async (action: string, payload: any) => {
    const { data: response, error } = await supabase.functions.invoke("documents-api", { body: { action, ...payload } });
    return { data: response?.data ?? null, error: response?.error || error?.message || null };
  };

  // Helper: optimistic update for sub-items inside a document list
  const optimisticListSub = useCallback(
    (listId: string, subKey: string, updater: (items: any[]) => any[]) => {
      qc.setQueryData<any[]>(key, (old) => {
        if (!old) return old;
        return old.map((l: any) =>
          l.id === listId ? { ...l, [subKey]: updater(l[subKey] || []) } : l
        );
      });
    },
    [qc, key]
  );

  // Helper: optimistic update for files inside a document item
  const optimisticFileSub = useCallback(
    (documentId: string, updater: (files: any[]) => any[]) => {
      qc.setQueryData<any[]>(key, (old) => {
        if (!old) return old;
        return old.map((l: any) => ({
          ...l,
          document_items: (l.document_items || []).map((item: any) =>
            item.id === documentId
              ? { ...item, document_files: updater(item.document_files || []) }
              : item
          ),
        }));
      });
    },
    [qc, key]
  );

  const createList = useOfflineMutation<any, any>({
    table: "document_lists", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("create-list", { family_id: familyId, name: rest.name, type: rest.type || "family" }); },
    queryKey: key, onSuccess: () => refetch(),
  });

  const deleteList = useOfflineMutation<any, any>({
    table: "document_lists", operation: "DELETE",
    apiFn: async (input) => invoke("delete-list", { id: input.id }),
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const addItem = useOfflineMutation<any, any>({
    table: "document_items", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-item", { list_id: rest.list_id, name: rest.name, category: rest.category || "other", expiry_date: rest.expiry_date, reminder_enabled: rest.reminder_enabled || false, note: rest.note || "" }); },
    onSuccess: () => refetch(),
  });

  const updateItem = useOfflineMutation<any, any>({
    table: "document_items", operation: "UPDATE",
    apiFn: async (input) => { const { id, ...updates } = input; return invoke("update-item", { id, ...updates }); },
    onSuccess: () => refetch(),
  });

  const deleteItem = useOfflineMutation<any, any>({
    table: "document_items", operation: "DELETE",
    apiFn: async (input) => invoke("delete-item", { id: input.id }),
    onSuccess: () => refetch(),
  });

  const addFile = useOfflineMutation<any, any>({
    table: "document_files", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-file", { document_id: rest.document_id, name: rest.name, file_url: rest.file_url, type: rest.type, size: rest.size }); },
    onSuccess: () => refetch(),
  });

  const deleteFile = useOfflineMutation<any, any>({
    table: "document_files", operation: "DELETE",
    apiFn: async (input) => invoke("delete-file", { id: input.id }),
    onSuccess: () => refetch(),
  });

  return {
    lists: lists || [], isLoading,
    createList: {
      ...createList,
      mutate: (input: any) => createList.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, document_items: [], ...input }),
      mutateAsync: async (input: any) => createList.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, document_items: [], ...input }),
    },
    deleteList: {
      ...deleteList,
      mutate: (id: string) => deleteList.mutate({ id }),
      mutateAsync: async (id: string) => deleteList.mutateAsync({ id }),
    },
    addItem: {
      ...addItem,
      mutate: (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), document_files: [], ...input };
        optimisticListSub(input.list_id, "document_items", (items) => [...items, item]);
        addItem.mutate(item);
      },
      mutateAsync: async (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), document_files: [], ...input };
        optimisticListSub(input.list_id, "document_items", (items) => [...items, item]);
        return addItem.mutateAsync(item);
      },
    },
    updateItem: {
      ...updateItem,
      mutate: (input: any) => {
        if (input.list_id) {
          optimisticListSub(input.list_id, "document_items", (items) =>
            items.map((i: any) => (i.id === input.id ? { ...i, ...input } : i))
          );
        }
        updateItem.mutate(input);
      },
    },
    deleteItem: {
      ...deleteItem,
      mutate: (id: string, listId?: string) => {
        if (listId) optimisticListSub(listId, "document_items", (items) => items.filter((i: any) => i.id !== id));
        deleteItem.mutate({ id });
      },
      mutateAsync: async (id: string, listId?: string) => {
        if (listId) optimisticListSub(listId, "document_items", (items) => items.filter((i: any) => i.id !== id));
        return deleteItem.mutateAsync({ id });
      },
    },
    addFile: {
      ...addFile,
      mutate: (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), added_at: new Date().toISOString(), ...input };
        optimisticFileSub(input.document_id, (files) => [...files, item]);
        addFile.mutate(item);
      },
      mutateAsync: async (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), added_at: new Date().toISOString(), ...input };
        optimisticFileSub(input.document_id, (files) => [...files, item]);
        return addFile.mutateAsync(item);
      },
    },
    deleteFile: {
      ...deleteFile,
      mutate: (id: string, documentId?: string) => {
        if (documentId) optimisticFileSub(documentId, (files) => files.filter((f: any) => f.id !== id));
        deleteFile.mutate({ id });
      },
      mutateAsync: async (id: string, documentId?: string) => {
        if (documentId) optimisticFileSub(documentId, (files) => files.filter((f: any) => f.id !== id));
        return deleteFile.mutateAsync({ id });
      },
    },
  };
}
