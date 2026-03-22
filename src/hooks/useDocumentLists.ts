import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";

export function useDocumentLists() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["document-lists", familyId];

  const listsQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!familyId) return [];
      const { data, error } = await supabase
        .from("document_lists")
        .select("*, document_items(*, document_files(*))")
        .eq("family_id", familyId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!familyId,
  });

  const createList = useMutation({
    mutationFn: async (input: { name: string; type?: string; shared_with?: string[] }) => {
      if (!familyId || !user) throw new Error("No family");
      const { error } = await supabase.from("document_lists").insert({
        name: input.name,
        type: input.type || "family",
        shared_with: input.shared_with || [],
        family_id: familyId,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteList = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase.from("document_lists").delete().eq("id", listId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addItem = useMutation({
    mutationFn: async (input: { list_id: string; name: string; category?: string; expiry_date?: string; reminder_enabled?: boolean; note?: string }) => {
      if (!user) throw new Error("No user");
      const { error } = await supabase.from("document_items").insert({
        list_id: input.list_id,
        name: input.name,
        category: input.category || "other",
        expiry_date: input.expiry_date,
        reminder_enabled: input.reminder_enabled || false,
        note: input.note || "",
        added_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateItem = useMutation({
    mutationFn: async (input: { id: string; [key: string]: any }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("document_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("document_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addFile = useMutation({
    mutationFn: async (input: { document_id: string; name: string; file_url?: string; type?: string; size?: number }) => {
      const { error } = await supabase.from("document_files").insert({
        document_id: input.document_id,
        name: input.name,
        file_url: input.file_url,
        type: input.type,
        size: input.size,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase.from("document_files").delete().eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { lists: listsQuery.data || [], isLoading: listsQuery.isLoading, createList, deleteList, addItem, updateItem, deleteItem, addFile, deleteFile };
}
