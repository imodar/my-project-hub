import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";

export function useTrips() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["trips", familyId];

  const tripsQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!familyId) return [];
      const { data, error } = await supabase
        .from("trips")
        .select("*, trip_day_plans(*, trip_activities(*)), trip_expenses(*), trip_packing(*), trip_suggestions(*), trip_documents(*)")
        .eq("family_id", familyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!familyId,
  });

  const createTrip = useMutation({
    mutationFn: async (input: { name: string; destination?: string; start_date?: string; end_date?: string; budget?: number; status?: string }) => {
      if (!familyId || !user) throw new Error("No family");
      const { error } = await supabase.from("trips").insert({
        name: input.name,
        destination: input.destination,
        start_date: input.start_date,
        end_date: input.end_date,
        budget: input.budget || 0,
        status: input.status || "planning",
        family_id: familyId,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateTrip = useMutation({
    mutationFn: async (input: { id: string; [key: string]: any }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("trips").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteTrip = useMutation({
    mutationFn: async (tripId: string) => {
      const { error } = await supabase.from("trips").delete().eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  // Day plans
  const addDayPlan = useMutation({
    mutationFn: async (input: { trip_id: string; day_number: number; city?: string }) => {
      const { error } = await supabase.from("trip_day_plans").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addActivity = useMutation({
    mutationFn: async (input: { day_plan_id: string; name: string; time?: string; location?: string; cost?: number }) => {
      const { error } = await supabase.from("trip_activities").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateActivity = useMutation({
    mutationFn: async (input: { id: string; [key: string]: any }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("trip_activities").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  // Expenses
  const addExpense = useMutation({
    mutationFn: async (input: { trip_id: string; name: string; amount: number }) => {
      const { error } = await supabase.from("trip_expenses").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteExpense = useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase.from("trip_expenses").delete().eq("id", expenseId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  // Packing
  const addPackingItem = useMutation({
    mutationFn: async (input: { trip_id: string; name: string }) => {
      const { error } = await supabase.from("trip_packing").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updatePackingItem = useMutation({
    mutationFn: async (input: { id: string; packed?: boolean; name?: string }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("trip_packing").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  // Suggestions
  const addSuggestion = useMutation({
    mutationFn: async (input: { trip_id: string; place_name: string; type?: string; reason?: string; location?: string; suggested_by?: string }) => {
      const { error } = await supabase.from("trip_suggestions").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateSuggestion = useMutation({
    mutationFn: async (input: { id: string; status?: string }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("trip_suggestions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  // Documents
  const addDocument = useMutation({
    mutationFn: async (input: { trip_id: string; name: string; type?: string; file_url?: string; file_name?: string; notes?: string }) => {
      const { error } = await supabase.from("trip_documents").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteDocument = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("trip_documents").delete().eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    trips: tripsQuery.data || [], isLoading: tripsQuery.isLoading,
    createTrip, updateTrip, deleteTrip,
    addDayPlan, addActivity, updateActivity,
    addExpense, deleteExpense,
    addPackingItem, updatePackingItem,
    addSuggestion, updateSuggestion,
    addDocument, deleteDocument,
  };
}
