import { trpc } from "@/lib/trpc";
import { Bell, Check, CheckCheck, Trash2, Filter, ExternalLink } from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const typeLabels: Record<string, string> = {
  authentication: "Authentication",
  certificate: "Certificate",
  payment: "Payment",
  subscription: "Subscription",
  nft: "NFT",
  referral: "Referral",
  system: "System",
  alert: "Alert",
  supply_chain: "Supply Chain",
  autopilot: "Autopilot",
};

const typeColors: Record<string, string> = {
  authentication: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  certificate: "bg-green-500/10 text-green-400 border-green-500/20",
  payment: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  subscription: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  nft: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  referral: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  system: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  alert: "bg-red-500/10 text-red-400 border-red-500/20",
  supply_chain: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  autopilot: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

function formatDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Notifications() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("all");

  const { data: notifications = [], refetch, isLoading } = trpc.notifications.list.useQuery({ limit: 50 });
  const { data: unreadData } = trpc.notifications.unreadCount.useQuery();

  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => refetch() });
  const markAllRead = trpc.notifications.markAllRead.useMutation({ onSuccess: () => refetch() });
  const deleteNotification = trpc.notifications.delete.useMutation({ onSuccess: () => refetch() });

  const unreadCount = unreadData?.count || 0;

  const filteredNotifications = useMemo(() => {
    if (activeTab === "all") return notifications;
    if (activeTab === "unread") return notifications.filter((n: any) => !n.isRead);
    return notifications.filter((n: any) => n.type === activeTab);
  }, [notifications, activeTab]);

  // Get unique types from notifications for filter tabs
  const notificationTypes = useMemo(() => {
    const types = new Set(notifications.map((n: any) => n.type));
    return Array.from(types);
  }, [notifications]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stay updated on authentications, payments, and platform activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read ({unreadCount})
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold">{notifications.length}</div>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-primary">{unreadCount}</div>
            <p className="text-xs text-muted-foreground">Unread</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-green-400">
              {notifications.filter((n: any) => n.type === "payment" || n.type === "subscription").length}
            </div>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-red-400">
              {notifications.filter((n: any) => n.type === "alert").length}
            </div>
            <p className="text-xs text-muted-foreground">Alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="all" className="text-xs">
            All
          </TabsTrigger>
          <TabsTrigger value="unread" className="text-xs">
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </TabsTrigger>
          {notificationTypes.map((type) => (
            <TabsTrigger key={type} value={type} className="text-xs">
              {typeIcons[type]} {typeLabels[type] || type}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Bell className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  {activeTab === "unread" ? "All caught up!" : "No notifications"}
                </h3>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  {activeTab === "unread"
                    ? "You have no unread notifications."
                    : "Notifications will appear here when there's activity on your account."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                {filteredNotifications.map((notification: any, index: number) => (
                  <div
                    key={notification.id}
                    className={`flex gap-4 p-4 hover:bg-accent/30 transition-colors cursor-pointer ${
                      !notification.isRead ? "bg-primary/5 border-l-2 border-l-primary" : ""
                    } ${index > 0 ? "border-t" : ""}`}
                    onClick={() => {
                      if (!notification.isRead) markRead.mutate({ id: notification.id });
                      if (notification.actionUrl) {
                        setLocation(notification.actionUrl);
                      }
                    }}
                  >
                    {/* Type Badge */}
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-base border ${typeColors[notification.type] || "bg-gray-500/10 border-gray-500/20"}`}>
                      {typeIcons[notification.type] || "📌"}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`text-sm ${!notification.isRead ? "font-semibold" : "font-medium text-muted-foreground"}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {notification.message}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline" className={`text-[10px] ${typeColors[notification.type] || ""}`}>
                            {typeLabels[notification.type] || notification.type}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-muted-foreground/60">
                          {formatDate(notification.createdAt)}
                        </span>
                        {notification.actionUrl && (
                          <span className="flex items-center gap-1 text-xs text-primary/60">
                            <ExternalLink className="h-3 w-3" />
                            View details
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            markRead.mutate({ id: notification.id });
                          }}
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification.mutate({ id: notification.id });
                        }}
                        title="Delete notification"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
