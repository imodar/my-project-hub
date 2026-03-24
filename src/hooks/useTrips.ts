import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export function useTrips() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const key = ["trips", familyId];

  const apiFn = useCallback(async () => {
    if (!familyId) return { data: [], error: null };
    const { data, error } = await supabase
      .from("trips")
      .select("*, trip_day_plans(*, trip_activities(*)), trip_expenses(*), trip_packing(*), trip_suggestions(*), trip_documents(*)")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false });
    return { data: data || [], error: error?.message || null };
  }, [familyId]);

  const { data: trips, isLoading, refetch } = useOfflineFirst<any>({
    table: "trips",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
  });

  const createTrip = useOfflineMutation<any, any>({
    table: "trips",
    operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { error } = await supabase.from("trips").insert({
        name: rest.name, destination: rest.destination,
        start_date: rest.start_date, end_date: rest.end_date,
        budget: rest.budget || 0, status: rest.status || "planning",
        family_id: familyId, created_by: user?.id,
      });
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const updateTrip = useOfflineMutation<any, any>({
    table: "trips", operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("trips").update(updates).eq("id", id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const deleteTrip = useOfflineMutation<any, any>({
    table: "trips", operation: "DELETE",
    apiFn: async (input) => {
      const { error } = await supabase.from("trips").delete().eq("id", input.id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const addDayPlan = useOfflineMutation<any, any>({
    table: "trip_day_plans", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { error } = await supabase.from("trip_day_plans").insert({ trip_id: rest.trip_id, day_number: rest.day_number, city: rest.city });
      return { data: null, error: error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const addActivity = useOfflineMutation<any, any>({
    table: "trip_activities", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { error } = await supabase.from("trip_activities").insert({ day_plan_id: rest.day_plan_id, name: rest.name, time: rest.time, location: rest.location, cost: rest.cost });
      return { data: null, error: error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updateActivity = useOfflineMutation<any, any>({
    table: "trip_activities", operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("trip_activities").update(updates).eq("id", id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const addExpense = useOfflineMutation<any, any>({
    table: "trip_expenses", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { error } = await supabase.from("trip_expenses").insert({ trip_id: rest.trip_id, name: rest.name, amount: rest.amount });
      return { data: null, error: error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const deleteExpense = useOfflineMutation<any, any>({
    table: "trip_expenses", operation: "DELETE",
    apiFn: async (input) => {
      const { error } = await supabase.from("trip_expenses").delete().eq("id", input.id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const addPackingItem = useOfflineMutation<any, any>({
    table: "trip_packing", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { error } = await supabase.from("trip_packing").insert({ trip_id: rest.trip_id, name: rest.name });
      return { data: null, error: error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updatePackingItem = useOfflineMutation<any, any>({
    table: "trip_packing", operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("trip_packing").update(updates).eq("id", id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const addSuggestion = useOfflineMutation<any, any>({
    table: "trip_packing", operation: "INSERT", // trip_suggestions not in syncQueue, use closest
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { error } = await supabase.from("trip_suggestions").insert({ trip_id: rest.trip_id, place_name: rest.place_name, type: rest.type, reason: rest.reason, location: rest.location, suggested_by: rest.suggested_by });
      return { data: null, error: error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updateSuggestion = useOfflineMutation<any, any>({
    table: "trip_packing", operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("trip_suggestions").update(updates).eq("id", id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const addDocument = useOfflineMutation<any, any>({
    table: "trip_documents", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { error } = await supabase.from("trip_documents").insert({ trip_id: rest.trip_id, name: rest.name, type: rest.type, file_url: rest.file_url, file_name: rest.file_name, notes: rest.notes });
      return { data: null, error: error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const deleteDocument = useOfflineMutation<any, any>({
    table: "trip_documents", operation: "DELETE",
    apiFn: async (input) => {
      const { error } = await supabase.from("trip_documents").delete().eq("id", input.id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  // Wrapper helpers to match existing API signatures
  const wrapInsert = (mut: any, defaults: any = {}) => ({
    ...mut,
    mutate: (input: any) => mut.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...defaults, ...input }),
    mutateAsync: async (input: any) => mut.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...defaults, ...input }),
  });
  const wrapDelete = (mut: any) => ({
    ...mut,
    mutate: (id: string) => mut.mutate({ id }),
    mutateAsync: async (id: string) => mut.mutateAsync({ id }),
  });

  return {
    trips: trips || [], isLoading,
    createTrip: wrapInsert(createTrip, { family_id: familyId, trip_day_plans: [], trip_expenses: [], trip_packing: [], trip_suggestions: [], trip_documents: [] }),
    updateTrip, deleteTrip: wrapDelete(deleteTrip),
    addDayPlan: wrapInsert(addDayPlan),
    addActivity: wrapInsert(addActivity),
    updateActivity,
    addExpense: wrapInsert(addExpense),
    deleteExpense: wrapDelete(deleteExpense),
    addPackingItem: wrapInsert(addPackingItem),
    updatePackingItem,
    addSuggestion: wrapInsert(addSuggestion),
    updateSuggestion,
    addDocument: wrapInsert(addDocument),
    deleteDocument: wrapDelete(deleteDocument),
  };
}
