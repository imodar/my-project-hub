import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export interface AppNotification {
  id: string;
  userId: string;
  familyId: string | null;
  type: string;
  title: string;
  body: string | null;
  sourceType: string | null;
  sourceId: string | null;
  isRead: boolean;
  createdAt: string;
}

const mapRow = (row: any): AppNotification => ({
  id: row.id,
  userId: row.user_id,
  familyId: row.family_id,
  type: row.type,
  title: row.title,
  body: row.body,
  sourceType: row.source_type,
  sourceId: row.source_id,
  isRead: row.is_read,
  createdAt: row.created_at,
});

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["notifications", user?.id];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map(mapRow);
    },
    enabled: !!user,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: key });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const markAsRead = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase
        .from("user_notifications")
        .update({ is_read: true } as any)
        .eq("id", notifId);
      if (error) throw error;
    },
    onMutate: async (notifId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AppNotification[]>(key);
      qc.setQueryData<AppNotification[]>(key, (old) =>
        old?.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
  });

  const markAsUnread = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase
        .from("user_notifications")
        .update({ is_read: false } as any)
        .eq("id", notifId);
      if (error) throw error;
    },
    onMutate: async (notifId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AppNotification[]>(key);
      qc.setQueryData<AppNotification[]>(key, (old) =>
        old?.map((n) => (n.id === notifId ? { ...n, isRead: false } : n))
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("user_notifications")
        .update({ is_read: true } as any)
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AppNotification[]>(key);
      qc.setQueryData<AppNotification[]>(key, (old) =>
        old?.map((n) => ({ ...n, isRead: true }))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase
        .from("user_notifications")
        .delete()
        .eq("id", notifId);
      if (error) throw error;
    },
    onMutate: async (notifId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AppNotification[]>(key);
      qc.setQueryData<AppNotification[]>(key, (old) =>
        old?.filter((n) => n.id !== notifId)
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
  });

  const notifications = query.data || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
  };
}
