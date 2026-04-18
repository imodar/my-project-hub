import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export function useTrips() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
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
    scopeKey: familyId ?? undefined,
    filterFn: useCallback(
      (items: any[]) => items.filter(i => !familyId || i.family_id === familyId),
      [familyId]
    ),
  });

  const invoke = async (action: string, payload: any) => {
    const { data: response, error } = await supabase.functions.invoke("trips-api", {
      body: { action, ...payload },
    });
    return { data: response?.data ?? null, error: response?.error || error?.message || null };
  };

  // Helper: optimistic update for sub-items inside a trip
  const optimisticTripSub = useCallback(
    (tripId: string, subKey: string, updater: (items: any[]) => any[]) => {
      qc.setQueryData<any[]>(key, (old) => {
        if (!old) return old;
        return old.map((t: any) =>
          t.id === tripId ? { ...t, [subKey]: updater(t[subKey] || []) } : t
        );
      });
    },
    [qc, key]
  );

  // Helper: optimistic update for activities inside day plans
  const optimisticActivitySub = useCallback(
    (dayPlanId: string, updater: (items: any[]) => any[]) => {
      qc.setQueryData<any[]>(key, (old) => {
        if (!old) return old;
        return old.map((t: any) => ({
          ...t,
          trip_day_plans: (t.trip_day_plans || []).map((dp: any) =>
            dp.id === dayPlanId
              ? { ...dp, trip_activities: updater(dp.trip_activities || []) }
              : dp
          ),
        }));
      });
    },
    [qc, key]
  );

  const createTrip = useOfflineMutation<any, any>({
    table: "trips", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      return invoke("create-trip", { family_id: familyId, name: rest.name, destination: rest.destination, start_date: rest.start_date, end_date: rest.end_date, budget: rest.budget || 0, status: rest.status || "planning", shared_with: rest.shared_with || [] });
    },
    queryKey: key,
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
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-day-plan", { id, trip_id: rest.trip_id, day_number: rest.day_number, city: rest.city }); },
  });

  const addActivity = useOfflineMutation<any, any>({
    table: "trip_activities", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-activity", { id, day_plan_id: rest.day_plan_id, name: rest.name, time: rest.time, location: rest.location, cost: rest.cost }); },
  });

  const updateActivity = useOfflineMutation<any, any>({
    table: "trip_activities", operation: "UPDATE",
    apiFn: async (input) => { const { id, day_plan_id, ...updates } = input; return invoke("update-activity", { id, ...updates }); },
  });

  const updateDayPlan = useOfflineMutation<any, any>({
    table: "trip_day_plans", operation: "UPDATE",
    apiFn: async (input) => { const { id, trip_id, ...updates } = input; return invoke("update-day-plan", { id, ...updates }); },
  });

  const deleteDayPlan = useOfflineMutation<any, any>({
    table: "trip_day_plans", operation: "DELETE",
    apiFn: async (input) => invoke("delete-day-plan", { id: input.id }),
  });

  const deleteActivity = useOfflineMutation<any, any>({
    table: "trip_activities", operation: "DELETE",
    apiFn: async (input) => invoke("delete-activity", { id: input.id }),
  });

  const addExpense = useOfflineMutation<any, any>({
    table: "trip_expenses", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-expense", { trip_id: rest.trip_id, name: rest.name, amount: rest.amount }); },
  });

  const deleteExpense = useOfflineMutation<any, any>({
    table: "trip_expenses", operation: "DELETE",
    apiFn: async (input) => invoke("delete-expense", { id: input.id }),
  });

  const addPackingItem = useOfflineMutation<any, any>({
    table: "trip_packing", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-packing", { trip_id: rest.trip_id, name: rest.name }); },
  });

  const updatePackingItem = useOfflineMutation<any, any>({
    table: "trip_packing", operation: "UPDATE",
    apiFn: async (input) => { const { id, ...updates } = input; return invoke("toggle-packing", { id, ...updates }); },
  });

  const addSuggestion = useOfflineMutation<any, any>({
    table: "trip_suggestions", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-suggestion", { trip_id: rest.trip_id, place_name: rest.place_name, type: rest.type, reason: rest.reason, location: rest.location }); },
  });

  const updateSuggestion = useOfflineMutation<any, any>({
    table: "trip_suggestions", operation: "UPDATE",
    apiFn: async (input) => { const { id, ...updates } = input; return invoke("update-suggestion-status", { id, ...updates }); },
  });

  const addDocument = useOfflineMutation<any, any>({
    table: "trip_documents", operation: "INSERT",
    apiFn: async (input) => { const { id, created_at, ...rest } = input; return invoke("add-document", { trip_id: rest.trip_id, name: rest.name, type: rest.type, file_url: rest.file_url, file_name: rest.file_name, notes: rest.notes }); },
  });

  const deleteDocument = useOfflineMutation<any, any>({
    table: "trip_documents", operation: "DELETE",
    apiFn: async (input) => invoke("delete-document", { id: input.id }),
  });

  return {
    trips: trips || [], isLoading,
    createTrip: {
      ...createTrip,
      mutate: (input: any) => createTrip.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, trip_day_plans: [], trip_expenses: [], trip_packing: [], trip_suggestions: [], trip_documents: [], ...input }),
      mutateAsync: async (input: any) => createTrip.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, trip_day_plans: [], trip_expenses: [], trip_packing: [], trip_suggestions: [], trip_documents: [], ...input }),
    },
    updateTrip, deleteTrip: {
      ...deleteTrip,
      mutate: (id: string) => deleteTrip.mutate({ id }),
      mutateAsync: async (id: string) => deleteTrip.mutateAsync({ id }),
    },
    addDayPlan: {
      ...addDayPlan,
      mutate: (input: any) => {
        const item = {
          id: input.id ?? crypto.randomUUID(),
          created_at: new Date().toISOString(),
          trip_activities: [],
          ...input,
        };
        optimisticTripSub(input.trip_id, "trip_day_plans", (dps) => [...dps, item]);
        addDayPlan.mutate(item);
      },
      mutateAsync: async (input: any) => {
        const item = {
          id: input.id ?? crypto.randomUUID(),
          created_at: new Date().toISOString(),
          trip_activities: [],
          ...input,
        };
        optimisticTripSub(input.trip_id, "trip_day_plans", (dps) => [...dps, item]);
        await addDayPlan.mutateAsync(item);
        return item;
      },
    },
    addActivity: {
      ...addActivity,
      mutate: (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), completed: false, ...input };
        optimisticActivitySub(input.day_plan_id, (acts) => [...acts, item]);
        addActivity.mutate(item);
      },
      mutateAsync: async (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), completed: false, ...input };
        optimisticActivitySub(input.day_plan_id, (acts) => [...acts, item]);
        return addActivity.mutateAsync(item);
      },
    },
    updateActivity: {
      ...updateActivity,
      mutate: (input: any) => {
        if (input.day_plan_id) {
          optimisticActivitySub(input.day_plan_id, (acts) =>
            acts.map((a: any) => (a.id === input.id ? { ...a, ...input } : a))
          );
        }
        updateActivity.mutate(input);
      },
    },
    addExpense: {
      ...addExpense,
      mutate: (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        optimisticTripSub(input.trip_id, "trip_expenses", (exps) => [...exps, item]);
        addExpense.mutate(item);
      },
      mutateAsync: async (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        optimisticTripSub(input.trip_id, "trip_expenses", (exps) => [...exps, item]);
        return addExpense.mutateAsync(item);
      },
    },
    deleteExpense: {
      ...deleteExpense,
      mutate: (id: string, tripId?: string) => {
        if (tripId) optimisticTripSub(tripId, "trip_expenses", (exps) => exps.filter((e: any) => e.id !== id));
        deleteExpense.mutate({ id });
      },
      mutateAsync: async (id: string, tripId?: string) => {
        if (tripId) optimisticTripSub(tripId, "trip_expenses", (exps) => exps.filter((e: any) => e.id !== id));
        return deleteExpense.mutateAsync({ id });
      },
    },
    deleteDayPlan: {
      ...deleteDayPlan,
      mutate: (id: string, tripId?: string) => {
        if (tripId) optimisticTripSub(tripId, "trip_day_plans", (dps) => dps.filter((d: any) => d.id !== id));
        deleteDayPlan.mutate({ id });
      },
      mutateAsync: async (id: string, tripId?: string) => {
        if (tripId) optimisticTripSub(tripId, "trip_day_plans", (dps) => dps.filter((d: any) => d.id !== id));
        return deleteDayPlan.mutateAsync({ id });
      },
    },
    updateDayPlan: {
      ...updateDayPlan,
      mutate: (input: any) => {
        if (input.trip_id) {
          optimisticTripSub(input.trip_id, "trip_day_plans", (dps) =>
            dps.map((d: any) => (d.id === input.id ? { ...d, ...input } : d))
          );
        }
        updateDayPlan.mutate(input);
      },
    },
    deleteActivity: {
      ...deleteActivity,
      mutate: (id: string, dayPlanId?: string) => {
        if (dayPlanId) optimisticActivitySub(dayPlanId, (acts) => acts.filter((a: any) => a.id !== id));
        deleteActivity.mutate({ id });
      },
      mutateAsync: async (id: string, dayPlanId?: string) => {
        if (dayPlanId) optimisticActivitySub(dayPlanId, (acts) => acts.filter((a: any) => a.id !== id));
        return deleteActivity.mutateAsync({ id });
      },
    },
    addPackingItem: {
      ...addPackingItem,
      mutate: (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), packed: false, ...input };
        optimisticTripSub(input.trip_id, "trip_packing", (items) => [...items, item]);
        addPackingItem.mutate(item);
      },
      mutateAsync: async (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), packed: false, ...input };
        optimisticTripSub(input.trip_id, "trip_packing", (items) => [...items, item]);
        return addPackingItem.mutateAsync(item);
      },
    },
    updatePackingItem: {
      ...updatePackingItem,
      mutate: (input: any) => {
        if (input.trip_id) {
          optimisticTripSub(input.trip_id, "trip_packing", (items) =>
            items.map((i: any) => (i.id === input.id ? { ...i, ...input } : i))
          );
        }
        updatePackingItem.mutate(input);
      },
    },
    addSuggestion: {
      ...addSuggestion,
      mutate: (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), status: "pending", ...input };
        optimisticTripSub(input.trip_id, "trip_suggestions", (sugs) => [...sugs, item]);
        addSuggestion.mutate(item);
      },
      mutateAsync: async (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), status: "pending", ...input };
        optimisticTripSub(input.trip_id, "trip_suggestions", (sugs) => [...sugs, item]);
        return addSuggestion.mutateAsync(item);
      },
    },
    updateSuggestion: {
      ...updateSuggestion,
      mutate: (input: any) => {
        if (input.trip_id) {
          optimisticTripSub(input.trip_id, "trip_suggestions", (sugs) =>
            sugs.map((s: any) => (s.id === input.id ? { ...s, ...input } : s))
          );
        }
        updateSuggestion.mutate(input);
      },
    },
    addDocument: {
      ...addDocument,
      mutate: (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), added_at: new Date().toISOString(), ...input };
        optimisticTripSub(input.trip_id, "trip_documents", (docs) => [...docs, item]);
        addDocument.mutate(item);
      },
      mutateAsync: async (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), added_at: new Date().toISOString(), ...input };
        optimisticTripSub(input.trip_id, "trip_documents", (docs) => [...docs, item]);
        return addDocument.mutateAsync(item);
      },
    },
    deleteDocument: {
      ...deleteDocument,
      mutate: (id: string, tripId?: string) => {
        if (tripId) optimisticTripSub(tripId, "trip_documents", (docs) => docs.filter((d: any) => d.id !== id));
        deleteDocument.mutate({ id });
      },
      mutateAsync: async (id: string, tripId?: string) => {
        if (tripId) optimisticTripSub(tripId, "trip_documents", (docs) => docs.filter((d: any) => d.id !== id));
        return deleteDocument.mutateAsync({ id });
      },
    },
  };
}
