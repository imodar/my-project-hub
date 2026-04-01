import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export function useCalendarEvents() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const key = ["calendar-events", familyId];

  const apiFn = useCallback(async () => {
    if (!familyId) return { data: [], error: null };
    const { data: response, error } = await supabase.functions.invoke("calendar-api", {
      body: { action: "get-events", family_id: familyId },
    });
    if (error) return { data: [], error: error.message };
    if (response?.error) return { data: [], error: response.error };
    return { data: response?.data || [], error: null };
  }, [familyId]);

  const { data: events, isLoading, refetch } = useOfflineFirst<any>({
    table: "calendar_events",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
    scopeKey: familyId ?? undefined,
  });

  const addEvent = useOfflineMutation<any, any>({
    table: "calendar_events",
    operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data: response, error } = await supabase.functions.invoke("calendar-api", {
        body: { action: "create-event", family_id: familyId, title: rest.title, date: rest.date, icon: rest.icon || "calendar", reminder_before: rest.reminder_before || [] },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key,
  });

  const updateEvent = useOfflineMutation<any, any>({
    table: "calendar_events",
    operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { data: response, error } = await supabase.functions.invoke("calendar-api", {
        body: { action: "update-event", id, ...updates },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const deleteEvent = useOfflineMutation<any, any>({
    table: "calendar_events",
    operation: "DELETE",
    apiFn: async (input) => {
      const { data: response, error } = await supabase.functions.invoke("calendar-api", {
        body: { action: "delete-event", id: input.id },
      });
      return { data: null, error: response?.error || error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  return {
    events: events || [],
    isLoading,
    addEvent: {
      ...addEvent,
      mutate: (input: any) => addEvent.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, ...input }),
      mutateAsync: async (input: any) => addEvent.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, ...input }),
    },
    updateEvent,
    deleteEvent: {
      ...deleteEvent,
      mutate: (eventId: string) => deleteEvent.mutate({ id: eventId }),
      mutateAsync: async (eventId: string) => deleteEvent.mutateAsync({ id: eventId }),
    },
  };
}
