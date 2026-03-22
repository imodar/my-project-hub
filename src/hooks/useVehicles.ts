import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";

export function useVehicles() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["vehicles", familyId];

  const vehiclesQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!familyId) return [];
      const { data, error } = await supabase
        .from("vehicles")
        .select("*, vehicle_maintenance(*)")
        .eq("family_id", familyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!familyId,
  });

  const addVehicle = useMutation({
    mutationFn: async (input: {
      manufacturer: string; model: string; year?: string; mileage?: number;
      mileage_unit?: string; color?: string; plate_number?: string; shared_with?: string[];
    }) => {
      if (!user || !familyId) throw new Error("No user/family");
      const { error } = await supabase.from("vehicles").insert({
        ...input, created_by: user.id, family_id: familyId,
        mileage: input.mileage || 0, mileage_unit: input.mileage_unit || "km",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateVehicle = useMutation({
    mutationFn: async (input: { id: string; [k: string]: any }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("vehicles").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addMaintenance = useMutation({
    mutationFn: async (input: {
      vehicle_id: string; type: string; label: string; date?: string;
      mileage_at_service?: number; next_mileage?: number; next_date?: string; notes?: string;
    }) => {
      const { error } = await supabase.from("vehicle_maintenance").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateMaintenance = useMutation({
    mutationFn: async (input: { id: string; [k: string]: any }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("vehicle_maintenance").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteMaintenance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_maintenance").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    vehicles: vehiclesQuery.data || [],
    isLoading: vehiclesQuery.isLoading,
    addVehicle, updateVehicle, deleteVehicle,
    addMaintenance, updateMaintenance, deleteMaintenance,
  };
}
