import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export function useVehicles() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
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

  const filterByFamily = useCallback(
    (items: any[]) => familyId ? items.filter((v: any) => v.family_id === familyId) : [],
    [familyId]
  );

  const { data: vehicles, isLoading, refetch } = useOfflineFirst<any>({
    table: "vehicles",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
    scopeKey: familyId ?? undefined,
    filterFn: filterByFamily,
  });

  // Helper: optimistic update for maintenance inside a vehicle
  const optimisticVehicleSub = useCallback(
    (vehicleId: string, updater: (items: any[]) => any[]) => {
      qc.setQueryData<any[]>(key, (old) => {
        if (!old) return old;
        return old.map((v: any) =>
          v.id === vehicleId ? { ...v, vehicle_maintenance: updater(v.vehicle_maintenance || []) } : v
        );
      });
    },
    [qc, key]
  );

  const addVehicle = useOfflineMutation<any, any>({
    table: "vehicles", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data: response, error } = await supabase.functions.invoke("vehicles-api", {
        body: { action: "create-vehicle", family_id: familyId, ...rest, mileage: rest.mileage || 0, mileage_unit: rest.mileage_unit || "km" },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key,
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
    onSuccess: () => refetch(),
  });

  const deleteMaintenance = useOfflineMutation<any, any>({
    table: "vehicle_maintenance", operation: "DELETE",
    apiFn: async (input) => {
      const { data: response, error } = await supabase.functions.invoke("vehicles-api", {
        body: { action: "delete-maintenance", id: input.id },
      });
      return { data: null, error: response?.error || error?.message || null };
    },
    onSuccess: () => refetch(),
  });

  return {
    vehicles: vehicles || [], isLoading,
    addVehicle: {
      ...addVehicle,
      mutate: (input: any) => addVehicle.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, vehicle_maintenance: [], ...input }),
      mutateAsync: async (input: any) => addVehicle.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, vehicle_maintenance: [], ...input }),
    },
    updateVehicle,
    deleteVehicle: {
      ...deleteVehicle,
      mutate: (id: string) => deleteVehicle.mutate({ id }),
      mutateAsync: async (id: string) => deleteVehicle.mutateAsync({ id }),
    },
    addMaintenance: {
      ...addMaintenance,
      mutate: (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        optimisticVehicleSub(input.vehicle_id, (items) => [...items, item]);
        addMaintenance.mutate(item);
      },
      mutateAsync: async (input: any) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
        optimisticVehicleSub(input.vehicle_id, (items) => [...items, item]);
        return addMaintenance.mutateAsync(item);
      },
    },
    updateMaintenance: {
      ...updateMaintenance,
      mutate: (input: any) => {
        if (input.vehicle_id) {
          optimisticVehicleSub(input.vehicle_id, (items) =>
            items.map((i: any) => (i.id === input.id ? { ...i, ...input } : i))
          );
        }
        updateMaintenance.mutate(input);
      },
    },
    deleteMaintenance: {
      ...deleteMaintenance,
      mutate: (id: string, vehicleId?: string) => {
        if (vehicleId) optimisticVehicleSub(vehicleId, (items) => items.filter((i: any) => i.id !== id));
        deleteMaintenance.mutate({ id });
      },
      mutateAsync: async (id: string, vehicleId?: string) => {
        if (vehicleId) optimisticVehicleSub(vehicleId, (items) => items.filter((i: any) => i.id !== id));
        return deleteMaintenance.mutateAsync({ id });
      },
    },
  };
}
