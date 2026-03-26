import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";

export function usePlaceLists() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["place-lists", familyId];

  const listsQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!familyId) return [];
      const { data: response, error } = await supabase.functions.invoke("places-api", {
        body: { action: "get-lists", family_id: familyId },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      return response?.data || [];
    },
    enabled: !!familyId,
  });

  const createList = useMutation({
    mutationFn: async (input: { name: string; type?: string; shared_with?: string[] }) => {
      if (!familyId || !user) throw new Error("No family");
      const { data: response, error } = await supabase.functions.invoke("places-api", {
        body: { action: "create-list", family_id: familyId, name: input.name, type: input.type || "family" },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteList = useMutation({
    mutationFn: async (listId: string) => {
      const { data: response, error } = await supabase.functions.invoke("places-api", {
        body: { action: "delete-list", id: listId },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addPlace = useMutation({
    mutationFn: async (input: {
      list_id: string; name: string; category?: string; description?: string;
      lat?: number; lng?: number; address?: string; social_link?: string;
      phone?: string; price_range?: string; rating?: number;
      kid_friendly?: string; must_visit?: boolean; note?: string; suggested_by?: string;
    }) => {
      if (!user) throw new Error("No user");
      const { data: response, error } = await supabase.functions.invoke("places-api", {
        body: { action: "add-place", ...input, category: input.category || "أخرى", price_range: input.price_range || "$$", kid_friendly: input.kid_friendly || "no", must_visit: input.must_visit || false },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updatePlace = useMutation({
    mutationFn: async (input: { id: string; [key: string]: any }) => {
      const { id, ...updates } = input;
      const { data: response, error } = await supabase.functions.invoke("places-api", {
        body: { action: "update-place", id, ...updates },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deletePlace = useMutation({
    mutationFn: async (placeId: string) => {
      const { data: response, error } = await supabase.functions.invoke("places-api", {
        body: { action: "delete-place", id: placeId },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { lists: listsQuery.data || [], isLoading: listsQuery.isLoading, createList, deleteList, addPlace, updatePlace, deletePlace };
}
