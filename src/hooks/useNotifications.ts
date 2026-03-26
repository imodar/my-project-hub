import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo } from "react";

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

const PAGE_SIZE = 30;

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

  const infiniteQuery = useInfiniteQuery({
    queryKey: key,
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!user) return { items: [], hasMore: false };
      const body: Record<string, unknown> = { action: "get-notifications", limit: PAGE_SIZE };
      if (pageParam) body.before = pageParam;
      const { data, error } = await supabase.functions.invoke("notifications-api", { body });
      if (error) throw error;
      const items = (data?.data || []).map(mapRow);
      return { items, hasMore: data?.hasMore ?? false };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || !lastPage.items.length) return undefined;
      return lastPage.items[lastPage.items.length - 1].createdAt;
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
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const markAsUnread = useMutation({
    mutationFn: async (notifId: string) => {
      const { data, error } = await supabase.functions.invoke("notifications-api", {
        body: { action: "mark-unread", id: notifId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { data, error } = await supabase.functions.invoke("notifications-api", {
        body: { action: "mark-all-read" },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteNotification = useMutation({
    mutationFn: async (notifId: string) => {
      const { data, error } = await supabase.functions.invoke("notifications-api", {
        body: { action: "delete-notification", id: notifId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const notifications = useMemo(
    () => infiniteQuery.data?.pages.flatMap((p) => p.items) || [],
    [infiniteQuery.data]
  );
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return {
    notifications,
    unreadCount,
    isLoading: infiniteQuery.isLoading,
    hasMore: infiniteQuery.hasNextPage ?? false,
    isFetchingMore: infiniteQuery.isFetchingNextPage,
    loadMore: () => infiniteQuery.fetchNextPage(),
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
  };
}
