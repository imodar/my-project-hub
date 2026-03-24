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
    const { data, error } = await supabase
      .from("document_lists")
      .select("*, document_items(*, document_files(*))")
      .eq("family_id", familyId)
      .order("updated_at", { ascending: false });
    return { data: data || [], error: error?.message || null };
  }, [familyId]);

  const { data: lists, isLoading, refetch } = useOfflineFirst<any>({
    table: "document_lists",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
  });

  const createList = useOfflineMutation<any, any>({
    table: "document_lists", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { error } = await supabase.from("document_lists").insert({
        name: rest.name, type: rest.type || "family", shared_with: rest.shared_with || [],
        family_id: familyId, created_by: user?.id,
      });
      return { data: null, error: error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const deleteList = useOfflineMutation<any, any>({
    table: "document_lists", operation: "DELETE",
    apiFn: async (input) => {
      const { error } = await supabase.from("document_lists").delete().eq("id", input.id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const addItem = useOfflineMutation<any, any>({
    table: "document_items", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { error } = await supabase.from("document_items").insert({
        list_id: rest.list_id, name: rest.name, category: rest.category || "other",
        expiry_date: rest.expiry_date, reminder_enabled: rest.reminder_enabled || false,
        note: rest.note || "", added_by: user?.id,
      });
      return { data: null, error: error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updateItem = useOfflineMutation<any, any>({
    table: "document_items", operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("document_items").update(updates).eq("id", id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const deleteItem = useOfflineMutation<any, any>({
    table: "document_items", operation: "DELETE",
    apiFn: async (input) => {
      const { error } = await supabase.from("document_items").delete().eq("id", input.id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const addFile = useOfflineMutation<any, any>({
    table: "document_files", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { error } = await supabase.from("document_files").insert({
        document_id: rest.document_id, name: rest.name,
        file_url: rest.file_url, type: rest.type, size: rest.size,
      });
      return { data: null, error: error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const deleteFile = useOfflineMutation<any, any>({
    table: "document_files", operation: "DELETE",
    apiFn: async (input) => {
      const { error } = await supabase.from("document_files").delete().eq("id", input.id);
      return { data: null, error: error?.message || null };
    },
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
