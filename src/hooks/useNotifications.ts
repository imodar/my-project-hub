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
      const { data, error } = await supabase.functions.invoke("notifications-api", {
        body: { action: "get-notifications" },
      });
      if (error) throw error;
      return (data?.data || []).map(mapRow);
    },
    enabled: !!user,
  });

  // Real-time subscription (kept as-is — read-only listener)
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
      const { data, error } = await supabase.functions.invoke("notifications-api", {
        body: { action: "mark-read", id: notifId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
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
      const { data, error } = await supabase.functions.invoke("notifications-api", {
        body: { action: "mark-unread", id: notifId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
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
      const { data, error } = await supabase.functions.invoke("notifications-api", {
        body: { action: "mark-all-read" },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
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
      const { data, error } = await supabase.functions.invoke("notifications-api", {
        body: { action: "delete-notification", id: notifId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
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
