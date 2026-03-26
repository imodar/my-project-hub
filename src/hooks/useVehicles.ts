import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export function useVehicles() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const key = ["vehicles", familyId];

  const apiFn = useCallback(async () => {
    if (!familyId) return { data: [], error: null };
    const { data: response, error } = await supabase.functions.invoke("vehicles-api", {
      body: { action: "get-vehicles", family_id: familyId },
    });
    if (error) return { data: [], error: error.message };
    if (response?.error) return { data: [], error: response.error };
    return { data: response?.data || [], error: null };
  }, [familyId]);

  const { data: vehicles, isLoading, refetch } = useOfflineFirst<any>({
    table: "vehicles",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
  });

  const addVehicle = useOfflineMutation<any, any>({
    table: "vehicles", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data: response, error } = await supabase.functions.invoke("vehicles-api", {
        body: { action: "create-vehicle", family_id: familyId, ...rest, mileage: rest.mileage || 0, mileage_unit: rest.mileage_unit || "km" },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updateVehicle = useOfflineMutation<any, any>({
    table: "vehicles", operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { data: response, error } = await supabase.functions.invoke("vehicles-api", {
        body: { action: "update-vehicle", id, ...updates },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key,
  });

  const deleteVehicle = useOfflineMutation<any, any>({
    table: "vehicles", operation: "DELETE",
    apiFn: async (input) => {
      const { data: response, error } = await supabase.functions.invoke("vehicles-api", {
        body: { action: "delete-vehicle", id: input.id },
      });
      return { data: null, error: response?.error || error?.message || null };
    },
    queryKey: key,
  });

  const addMaintenance = useOfflineMutation<any, any>({
    table: "vehicle_maintenance", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data: response, error } = await supabase.functions.invoke("vehicles-api", {
        body: { action: "add-maintenance", vehicle_id: rest.vehicle_id, type: rest.type, label: rest.label, date: rest.date, mileage_at_service: rest.mileage_at_service, next_mileage: rest.next_mileage, next_date: rest.next_date, notes: rest.notes },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const updateMaintenance = useOfflineMutation<any, any>({
    table: "vehicle_maintenance", operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { data: response, error } = await supabase.functions.invoke("vehicles-api", {
        body: { action: "update-maintenance", id, ...updates },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key,
  });

  const deleteMaintenance = useOfflineMutation<any, any>({
    table: "vehicle_maintenance", operation: "DELETE",
    apiFn: async (input) => {
      const { data: response, error } = await supabase.functions.invoke("vehicles-api", {
        body: { action: "delete-maintenance", id: input.id },
      });
      return { data: null, error: response?.error || error?.message || null };
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
    vehicles: vehicles || [], isLoading,
    addVehicle: wrap(addVehicle, { family_id: familyId, vehicle_maintenance: [] }),
    updateVehicle, deleteVehicle: wrapDel(deleteVehicle),
    addMaintenance: wrap(addMaintenance), updateMaintenance, deleteMaintenance: wrapDel(deleteMaintenance),
  };
}
