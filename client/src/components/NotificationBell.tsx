import { trpc } from "@/lib/trpc";
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";

const typeIcons: Record<string, string> = {
  authentication: "🔒",
  certificate: "📜",
  payment: "💳",
  subscription: "⭐",
  nft: "💎",
  referral: "🔗",
  system: "⚙️",
  alert: "🚨",
  supply_chain: "🚚",
  autopilot: "🤖",
};

const typeColors: Record<string, string> = {
  authentication: "bg-blue-500/10 text-blue-400",
  certificate: "bg-green-500/10 text-green-400",
  payment: "bg-emerald-500/10 text-emerald-400",
  subscription: "bg-purple-500/10 text-purple-400",
  nft: "bg-pink-500/10 text-pink-400",
  referral: "bg-orange-500/10 text-orange-400",
  system: "bg-gray-500/10 text-gray-400",
  alert: "bg-red-500/10 text-red-400",
  supply_chain: "bg-cyan-500/10 text-cyan-400",
  autopilot: "bg-yellow-500/10 text-yellow-400",
};

function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const { data: unreadData } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const { data: notificationsData, refetch } = trpc.notifications.list.useQuery(
    { limit: 20 },
    { enabled: open }
  );

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetch(),
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => refetch(),
  });

  const deleteNotification = trpc.notifications.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const unreadCount = unreadData?.count || 0;
  const notifications = notificationsData || [];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] rounded-xl border bg-popover text-popover-foreground shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => markAllRead.mutate()}
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <ScrollArea className="max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  You'll see updates about authentications, payments, and more here.
                </p>
              </div>
            ) : (
              <div>
                {notifications.map((notification: any, index) => (
                  <div key={notification.id}>
                    <div
                      className={`flex gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer ${
                        !notification.isRead ? "bg-primary/5" : ""
                      }`}
                      onClick={() => {
                        if (!notification.isRead) {
                          markRead.mutate({ id: notification.id });
                        }
                        if (notification.actionUrl) {
                          setLocation(notification.actionUrl);
                          setOpen(false);
                        }
                      }}
                    >
                      {/* Type Icon */}
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-sm ${typeColors[notification.type] || "bg-gray-500/10"}`}>
                        {typeIcons[notification.type] || "📌"}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-tight ${!notification.isRead ? "font-medium" : "text-muted-foreground"}`}>
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-muted-foreground/60">
                            {timeAgo(notification.createdAt)}
                          </span>
                          {notification.actionUrl && (
                            <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/40" />
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1 shrink-0">
                        {!notification.isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markRead.mutate({ id: notification.id });
                            }}
                            className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors"
                            title="Mark as read"
                          >
                            <Check className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification.mutate({ id: notification.id });
                          }}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                    {index < notifications.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t px-4 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs h-7"
                onClick={() => {
                  setLocation("/notifications");
                  setOpen(false);
                }}
              >
                View all notifications
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
