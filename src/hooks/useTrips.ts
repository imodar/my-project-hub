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
    const { data: response, error } = await supabase.functions.invoke("trips-api", {
      body: { action: "get-trips", family_id: familyId },
    });
    if (error) return { data: [], error: error.message };
    if (response?.error) return { data: [], error: response.error };
    return { data: response?.data || [], error: null };
  }, [familyId]);

  const { data: trips, isLoading, refetch } = useOfflineFirst<any>({
    table: "trips",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
  });

  const invoke = async (action: string, payload: any) => {
    const { data: response, error } = await supabase.functions.invoke("trips-api", {
      body: { action, ...payload },
    });
    return { data: response?.data ?? null, error: response?.error || error?.message || null };
  };

  const createTrip = useOfflineMutation<any, any>({
    table: "trips", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      return invoke("create-trip", { family_id: familyId, name: rest.name, destination: rest.destination, start_date: rest.start_date, end_date: rest.end_date, budget: rest.budget || 0, status: rest.status || "planning" });
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updateTrip = useOfflineMutation<any, any>({
    table: "trips", operation: "UPDATE",
    apiFn: async (input) => { const { id, ...updates } = input; return invoke("update-trip", { id, ...updates }); },
    queryKey: key,
  });

  const deleteTrip = useOfflineMutation<any, any>({
    table: "trips", operation: "DELETE",
    apiFn: async (input) => invoke("delete-trip", { id: input.id }),
    queryKey: key,
  });

  const addDayPlan = useOfflineMutation<any, any>({
    table: "trip_day_plans", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-day-plan", { trip_id: rest.trip_id, day_number: rest.day_number, city: rest.city }); },
    queryKey: key, onSuccess: () => refetch(),
  });

  const addActivity = useOfflineMutation<any, any>({
    table: "trip_activities", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-activity", { day_plan_id: rest.day_plan_id, name: rest.name, time: rest.time, location: rest.location, cost: rest.cost }); },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updateActivity = useOfflineMutation<any, any>({
    table: "trip_activities", operation: "UPDATE",
    apiFn: async (input) => { const { id, ...updates } = input; return invoke("toggle-activity", { id, ...updates }); },
    queryKey: key,
  });

  const addExpense = useOfflineMutation<any, any>({
    table: "trip_expenses", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-expense", { trip_id: rest.trip_id, name: rest.name, amount: rest.amount }); },
    queryKey: key, onSuccess: () => refetch(),
  });

  const deleteExpense = useOfflineMutation<any, any>({
    table: "trip_expenses", operation: "DELETE",
    apiFn: async (input) => invoke("delete-expense", { id: input.id }),
    queryKey: key,
  });

  const addPackingItem = useOfflineMutation<any, any>({
    table: "trip_packing", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-packing", { trip_id: rest.trip_id, name: rest.name }); },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updatePackingItem = useOfflineMutation<any, any>({
    table: "trip_packing", operation: "UPDATE",
    apiFn: async (input) => { const { id, ...updates } = input; return invoke("toggle-packing", { id, ...updates }); },
    queryKey: key,
  });

  const addSuggestion = useOfflineMutation<any, any>({
    table: "trip_suggestions", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-suggestion", { trip_id: rest.trip_id, place_name: rest.place_name, type: rest.type, reason: rest.reason, location: rest.location }); },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updateSuggestion = useOfflineMutation<any, any>({
    table: "trip_packing", operation: "UPDATE",
    apiFn: async (input) => { const { id, ...updates } = input; return invoke("update-suggestion-status", { id, ...updates }); },
    queryKey: key,
  });

  const addDocument = useOfflineMutation<any, any>({
    table: "trip_documents", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-document", { trip_id: rest.trip_id, name: rest.name, type: rest.type, file_url: rest.file_url, file_name: rest.file_name, notes: rest.notes }); },
    queryKey: key, onSuccess: () => refetch(),
  });

  const deleteDocument = useOfflineMutation<any, any>({
    table: "trip_documents", operation: "DELETE",
    apiFn: async (input) => invoke("delete-document", { id: input.id }),
    queryKey: key,
  });

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
