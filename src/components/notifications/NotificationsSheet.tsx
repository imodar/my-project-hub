import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNotifications, AppNotification } from "@/hooks/useNotifications";
import SwipeableCard from "@/components/SwipeableCard";
import {
  Bell, BellOff, Calendar, CheckCircle2, CreditCard, FileText,
  ListTodo, MapPin, Pill, Car, BookOpen, ShoppingCart, Users,
  CheckCheck, Trash2, Clock, ChevronLeft, ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; route?: string }> = {
  calendar: { icon: <Calendar size={18} />, color: "hsl(210 70% 50%)", bg: "hsl(210 70% 95%)", route: "/calendar" },
  task: { icon: <ListTodo size={18} />, color: "hsl(160 55% 40%)", bg: "hsl(160 55% 94%)", route: "/tasks" },
  debt: { icon: <CreditCard size={18} />, color: "hsl(0 65% 50%)", bg: "hsl(0 55% 95%)", route: "/debts" },
  budget: { icon: <CreditCard size={18} />, color: "hsl(270 50% 50%)", bg: "hsl(270 50% 95%)", route: "/budget" },
  medication: { icon: <Pill size={18} />, color: "hsl(340 60% 50%)", bg: "hsl(340 50% 95%)", route: "/medications" },
  document: { icon: <FileText size={18} />, color: "hsl(30 60% 45%)", bg: "hsl(30 50% 94%)", route: "/documents" },
  vehicle: { icon: <Car size={18} />, color: "hsl(200 50% 45%)", bg: "hsl(200 50% 94%)", route: "/vehicle" },
  vaccination: { icon: <Pill size={18} />, color: "hsl(145 50% 40%)", bg: "hsl(145 50% 94%)", route: "/vaccinations" },
  market: { icon: <ShoppingCart size={18} />, color: "hsl(25 70% 50%)", bg: "hsl(25 60% 94%)", route: "/market" },
  place: { icon: <MapPin size={18} />, color: "hsl(350 60% 50%)", bg: "hsl(350 50% 95%)", route: "/places" },
  worship: { icon: <BookOpen size={18} />, color: "hsl(145 45% 38%)", bg: "hsl(145 40% 94%)", route: "/kids-worship" },
  family: { icon: <Users size={18} />, color: "hsl(220 55% 50%)", bg: "hsl(220 50% 94%)", route: "/family" },
  general: { icon: <Bell size={18} />, color: "hsl(0 0% 45%)", bg: "hsl(0 0% 94%)" },
};

const getConfig = (type: string) => typeConfig[type] || typeConfig.general;

const NotificationCard = ({
  notification,
  onToggleRead,
  onNavigate,
  onDelete,
  onSwipeOpen,
}: {
  notification: AppNotification;
  onToggleRead: () => void;
  onNavigate: () => void;
  onDelete: () => void;
  onSwipeOpen?: () => void;
}) => {
  const config = getConfig(notification.type);
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: ar,
  });

  return (
    <SwipeableCard
      actions={[
        {
          icon: notification.isRead ? <BellOff size={16} /> : <CheckCircle2 size={16} />,
          label: notification.isRead ? "غير مقروء" : "مقروء",
          color: "bg-primary",
          onClick: onToggleRead,
        },
        {
          icon: <Trash2 size={16} />,
          label: "حذف",
          color: "bg-destructive",
          onClick: onDelete,
        },
      ]}
      onSwipeOpen={onSwipeOpen}
    >
      <button
        onClick={onNavigate}
        className="w-full text-right p-3.5 flex gap-3 items-start rounded-2xl"
        style={{
          background: notification.isRead ? "hsl(var(--muted))" : "hsl(var(--card))",
          border: notification.isRead
            ? "1px solid hsl(var(--border))"
            : `1px solid ${config.color}20`,
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{
            background: notification.isRead ? "hsl(var(--muted))" : config.bg,
            color: notification.isRead ? "hsl(var(--muted-foreground))" : config.color,
          }}
        >
          {config.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-sm leading-snug ${
                notification.isRead
                  ? "text-muted-foreground font-medium"
                  : "text-foreground font-bold"
              }`}
            >
              {notification.title}
            </p>
            {!notification.isRead && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                style={{ background: config.color }}
              />
            )}
          </div>
          {notification.body && (
            <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {notification.body}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-2">
            <Clock size={11} className="text-muted-foreground/60" />
            <span className="text-[10px] text-muted-foreground/70">{timeAgo}</span>
          </div>
        </div>
      </button>
    </SwipeableCard>
  );
};

const NotificationsSheet = React.forwardRef<HTMLDivElement, Props>(
  ({ open, onOpenChange }, ref) => {
    const navigate = useNavigate();
    const [openCardId, setOpenCardId] = useState<string | null>(null);
    const {
      notifications,
      unreadCount,
      isLoading,
      hasMore,
      isFetchingMore,
      loadMore,
      markAsRead,
      markAsUnread,
      markAllAsRead,
      deleteNotification,
    } = useNotifications();

    const handleNavigate = (notif: AppNotification) => {
      if (openCardId === notif.id) {
        setOpenCardId(null);
        return;
      }
      if (!notif.isRead) markAsRead.mutate(notif.id);
      const config = getConfig(notif.type);
      if (config.route) {
        onOpenChange(false);
        setTimeout(() => navigate(config.route!), 200);
      }
    };

    const handleToggleRead = (notif: AppNotification) => {
      if (notif.isRead) {
        markAsUnread.mutate(notif.id);
      } else {
        markAsRead.mutate(notif.id);
      }
    };

    return (
      <div ref={ref}>
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            className="rounded-t-3xl max-h-[85vh] flex flex-col p-0 border-0"
            style={{ direction: "rtl" }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            <SheetHeader className="px-5 pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "hsl(var(--primary) / 0.1)" }}
                  >
                    <Bell size={18} className="text-primary" />
                  </div>
                  <div>
                    <SheetTitle className="text-base font-bold text-foreground">
                      التنبيهات
                    </SheetTitle>
                    {unreadCount > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        {unreadCount} تنبيه غير مقروء
                      </p>
                    )}
                  </div>
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead.mutate()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
                    style={{
                      background: "hsl(var(--primary) / 0.08)",
                      color: "hsl(var(--primary))",
                    }}
                  >
                    <CheckCheck size={14} />
                    قراءة الكل
                  </button>
                )}
              </div>

              <div className="flex items-center justify-center gap-4 pt-2 pb-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                  <ChevronRight size={10} />
                  <span>سحب لتحديد كمقروء</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                  <span>سحب للحذف</span>
                  <ChevronLeft size={10} />
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              {isLoading ? (
                <div className="space-y-3 py-4">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="h-20 rounded-2xl animate-pulse"
                      style={{ background: "hsl(var(--muted))" }}
                    />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div
                    className="w-20 h-20 rounded-3xl flex items-center justify-center"
                    style={{ background: "hsl(var(--muted))" }}
                  >
                    <BellOff size={32} className="text-muted-foreground/40" />
                  </div>
                  <div className="text-center space-y-1.5">
                    <p className="text-sm font-bold text-muted-foreground">
                      لا توجد تنبيهات
                    </p>
                    <p className="text-[12px] text-muted-foreground/60 max-w-[220px]">
                      ستظهر هنا تنبيهات المهام والمواعيد والتذكيرات
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {notifications.map((notif) => (
                    <NotificationCard
                      key={notif.id}
                      notification={notif}
                      onToggleRead={() => handleToggleRead(notif)}
                      onNavigate={() => handleNavigate(notif)}
                      onDelete={() => deleteNotification.mutate(notif.id)}
                      onSwipeOpen={() => setOpenCardId(notif.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }
);

NotificationsSheet.displayName = "NotificationsSheet";

export default NotificationsSheet;
