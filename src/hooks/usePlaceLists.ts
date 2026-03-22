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
      const { data, error } = await supabase
        .from("place_lists")
        .select("*, places(*)")
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
      const { error } = await supabase.from("place_lists").insert({
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
      const { error } = await supabase.from("place_lists").delete().eq("id", listId);
      if (error) throw error;
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
      const { error } = await supabase.from("places").insert({
        list_id: input.list_id,
        name: input.name,
        category: input.category || "أخرى",
        description: input.description,
        lat: input.lat,
        lng: input.lng,
        address: input.address,
        social_link: input.social_link,
        phone: input.phone,
        price_range: input.price_range || "$$",
        rating: input.rating,
        kid_friendly: input.kid_friendly || "no",
        must_visit: input.must_visit || false,
        note: input.note,
        added_by: user.id,
        suggested_by: input.suggested_by,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updatePlace = useMutation({
    mutationFn: async (input: { id: string; [key: string]: any }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("places").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deletePlace = useMutation({
    mutationFn: async (placeId: string) => {
      const { error } = await supabase.from("places").delete().eq("id", placeId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { lists: listsQuery.data || [], isLoading: listsQuery.isLoading, createList, deleteList, addPlace, updatePlace, deletePlace };
}
