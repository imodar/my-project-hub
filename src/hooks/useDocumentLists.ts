import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export function useDocumentLists() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
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
  });

  const invoke = async (action: string, payload: any) => {
    const { data: response, error } = await supabase.functions.invoke("documents-api", { body: { action, ...payload } });
    return { data: response?.data ?? null, error: response?.error || error?.message || null };
  };

  const createList = useOfflineMutation<any, any>({
    table: "document_lists", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("create-list", { family_id: familyId, name: rest.name, type: rest.type || "family" }); },
    queryKey: key, onSuccess: () => refetch(),
  });

  const deleteList = useOfflineMutation<any, any>({
    table: "document_lists", operation: "DELETE",
    apiFn: async (input) => invoke("delete-list", { id: input.id }),
    queryKey: key,
  });

  const addItem = useOfflineMutation<any, any>({
    table: "document_items", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-item", { list_id: rest.list_id, name: rest.name, category: rest.category || "other", expiry_date: rest.expiry_date, reminder_enabled: rest.reminder_enabled || false, note: rest.note || "" }); },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updateItem = useOfflineMutation<any, any>({
    table: "document_items", operation: "UPDATE",
    apiFn: async (input) => { const { id, ...updates } = input; return invoke("update-item", { id, ...updates }); },
    queryKey: key,
  });

  const deleteItem = useOfflineMutation<any, any>({
    table: "document_items", operation: "DELETE",
    apiFn: async (input) => invoke("delete-item", { id: input.id }),
    queryKey: key,
  });

  const addFile = useOfflineMutation<any, any>({
    table: "document_files", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-file", { document_id: rest.document_id, name: rest.name, file_url: rest.file_url, type: rest.type, size: rest.size }); },
    queryKey: key, onSuccess: () => refetch(),
  });

  const deleteFile = useOfflineMutation<any, any>({
    table: "document_files", operation: "DELETE",
    apiFn: async (input) => invoke("delete-file", { id: input.id }),
    queryKey: key,
  });

  const wrap = (mut: any, defaults: any = {}) => ({
    ...mut,
    mutate: (input: any) => mut.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...defaults, ...input }),
    mutateAsync: async (input: any) => mut.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...defaults, ...input }),
  });
  const wrapDel = (mut: any) => ({
    ...mut,
    mutate: (id: string) => mut.mutate({ id }),
    mutateAsync: async (id: string) => mut.mutateAsync({ id }),
  });

  return {
    lists: lists || [], isLoading,
    createList: wrap(createList, { family_id: familyId, document_items: [] }),
    deleteList: wrapDel(deleteList),
    addItem: wrap(addItem, { document_files: [] }),
    updateItem, deleteItem: wrapDel(deleteItem),
    addFile: wrap(addFile), deleteFile: wrapDel(deleteFile),
  };
}
