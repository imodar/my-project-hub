import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";

export function useCalendarEvents() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["calendar-events", familyId];

  const eventsQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!familyId) return [];
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("family_id", familyId)
        .order("date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!familyId,
  });

  const addEvent = useMutation({
    mutationFn: async (input: { title: string; date: string; icon?: string; reminder_before?: string[]; personal_reminders?: string[] }) => {
      if (!familyId || !user) throw new Error("No family");
      const { error } = await supabase.from("calendar_events").insert({
        title: input.title,
        date: input.date,
        icon: input.icon || "calendar",
        reminder_before: input.reminder_before || [],
        personal_reminders: input.personal_reminders || [],
        family_id: familyId,
        added_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateEvent = useMutation({
    mutationFn: async (input: { id: string; [key: string]: any }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("calendar_events").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from("calendar_events").delete().eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { events: eventsQuery.data || [], isLoading: eventsQuery.isLoading, addEvent, updateEvent, deleteEvent };
}
