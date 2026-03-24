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
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("family_id", familyId)
      .order("date", { ascending: true });
    return { data: data || [], error: error?.message || null };
  }, [familyId]);

  const { data: events, isLoading, refetch } = useOfflineFirst<any>({
    table: "calendar_events",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
  });

  const addEvent = useOfflineMutation<any, any>({
    table: "calendar_events",
    operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { error } = await supabase.from("calendar_events").insert({
        title: rest.title,
        date: rest.date,
        icon: rest.icon || "calendar",
        reminder_before: rest.reminder_before || [],
        personal_reminders: rest.personal_reminders || [],
        family_id: familyId,
        added_by: user?.id,
      });
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
    onSuccess: () => refetch(),
  });

  const updateEvent = useOfflineMutation<any, any>({
    table: "calendar_events",
    operation: "UPDATE",
    apiFn: async (input) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("calendar_events").update(updates).eq("id", id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
  });

  const deleteEvent = useOfflineMutation<any, any>({
    table: "calendar_events",
    operation: "DELETE",
    apiFn: async (input) => {
      const { error } = await supabase.from("calendar_events").delete().eq("id", input.id);
      return { data: null, error: error?.message || null };
    },
    queryKey: key,
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
