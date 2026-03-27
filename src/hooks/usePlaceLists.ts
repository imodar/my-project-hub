import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export function usePlaceLists() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const key = ["place-lists", familyId];

  const apiFn = useCallback(async () => {
    if (!familyId) return { data: [], error: null };
    const { data: response, error } = await supabase.functions.invoke("places-api", {
      body: { action: "get-lists", family_id: familyId },
    });
    if (error) return { data: [], error: error.message };
    if (response?.error) return { data: [], error: response.error };
    return { data: response?.data || [], error: null };
  }, [familyId]);

  const { data: lists, isLoading, refetch } = useOfflineFirst<any>({
    table: "place_lists",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
  });

  const createList = useOfflineMutation<Record<string, unknown>, Record<string, unknown>>({
    table: "place_lists",
    operation: "INSERT",
    apiFn: async (input) => {
      if (!familyId || !user) return { data: null, error: "No family" };
      const { data: response, error } = await supabase.functions.invoke("places-api", {
        body: { action: "create-list", family_id: familyId, name: input.name, type: input.type || "family" },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const deleteList = useOfflineMutation<Record<string, unknown>, Record<string, unknown>>({
    table: "place_lists",
    operation: "DELETE",
    apiFn: async (input) => {
      const { data: response, error } = await supabase.functions.invoke("places-api", {
        body: { action: "delete-list", id: input.id },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const addPlace = useOfflineMutation<Record<string, unknown>, Record<string, unknown>>({
    table: "places",
    operation: "INSERT",
    apiFn: async (input) => {
      if (!user) return { data: null, error: "No user" };
      const { data: response, error } = await supabase.functions.invoke("places-api", {
        body: {
          action: "add-place",
          ...input,
          category: input.category || "أخرى",
          price_range: input.price_range || "$$",
          kid_friendly: input.kid_friendly || "no",
          must_visit: input.must_visit || false,
        },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const updatePlace = useOfflineMutation<Record<string, unknown>, Record<string, unknown>>({
    table: "places",
    operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { data: response, error } = await supabase.functions.invoke("places-api", {
        body: { action: "update-place", id, ...updates },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const deletePlace = useOfflineMutation<Record<string, unknown>, Record<string, unknown>>({
    table: "places",
    operation: "DELETE",
    apiFn: async (input) => {
      const { data: response, error } = await supabase.functions.invoke("places-api", {
        body: { action: "delete-place", id: input.id },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  return { lists: lists || [], isLoading, createList, deleteList, addPlace, updatePlace, deletePlace };
}
