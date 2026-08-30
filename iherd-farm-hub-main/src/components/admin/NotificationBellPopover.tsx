import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ShoppingCart,
  UserPlus,
  Truck,
  CheckCheck,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Clock,
  Trash2,
  Inbox,
  Filter,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminNotifications, AdminNotification } from "@/hooks/useAdminNotifications";

export function NotificationBellPopover() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<"all" | "orders" | "users" | "alerts">("all");
  const navigate = useNavigate();

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useAdminNotifications();

  const filteredNotifications = notifications.filter((n) => {
    if (category === "all") return true;
    return n.category === category;
  });

  const handleItemClick = (n: AdminNotification) => {
    markAsRead(n.id);
    setOpen(false);
    if (n.link) {
      navigate({ to: n.link as any });
    }
  };

  const getNotificationIcon = (type: AdminNotification["type"]) => {
    switch (type) {
      case "product_order":
        return (
          <div className="h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
            <ShoppingCart className="h-4 w-4" />
          </div>
        );
      case "cattle_order":
        return (
          <div className="h-8 w-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Truck className="h-4 w-4" />
          </div>
        );
      case "user_login":
        return (
          <div className="h-8 w-8 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0">
            <UserPlus className="h-4 w-4" />
          </div>
        );
      case "system_alert":
      default:
        return (
          <div className="h-8 w-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
            <AlertCircle className="h-4 w-4" />
          </div>
        );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-10 w-10 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Bell className="h-4.5 w-4.5 text-foreground/80" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold bg-destructive text-destructive-foreground shadow-sm animate-in zoom-in-50">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-96 sm:w-[420px] p-0 rounded-3xl shadow-2xl border bg-background overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 bg-muted/30 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                Notifications & Activity
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold bg-primary/15 text-primary">
                    {unreadCount} new
                  </Badge>
                )}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Read all
              </Button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-4 pt-3 pb-2 border-b bg-background">
          <Tabs value={category} onValueChange={(val: any) => setCategory(val)}>
            <TabsList className="w-full h-8 grid grid-cols-4 rounded-xl p-0.5 bg-muted/60">
              <TabsTrigger value="all" className="rounded-lg text-[11px] font-semibold py-1">
                All
              </TabsTrigger>
              <TabsTrigger value="orders" className="rounded-lg text-[11px] font-semibold py-1">
                Orders
              </TabsTrigger>
              <TabsTrigger value="users" className="rounded-lg text-[11px] font-semibold py-1">
                Users
              </TabsTrigger>
              <TabsTrigger value="alerts" className="rounded-lg text-[11px] font-semibold py-1">
                Alerts
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Notification Items List */}
        <ScrollArea className="max-h-[380px] overflow-y-auto divide-y divide-border/40">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                <Inbox className="h-6 w-6" />
              </div>
              <p className="text-xs font-semibold text-foreground">No notifications in this category</p>
              <p className="text-[11px] text-muted-foreground">New orders, user logins, and platform alerts will appear here live.</p>
            </div>
          ) : (
            filteredNotifications.slice(0, 30).map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`p-3.5 flex items-start gap-3 hover:bg-muted/40 transition-colors cursor-pointer relative ${
                  !item.read ? "bg-primary/5" : ""
                }`}
              >
                {getNotificationIcon(item.type)}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={`text-xs truncate ${!item.read ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                      {item.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                    {item.message}
                  </p>
                </div>

                {!item.read && (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0 self-center" />
                )}
              </div>
            ))
          )}
        </ScrollArea>

        {/* Footer Link */}
        <div className="p-3 bg-muted/30 border-t flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-7 text-[11px] text-muted-foreground hover:text-destructive px-2"
          >
            Clear all
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => {
              setOpen(false);
              navigate({ to: "/notifications" });
            }}
            className="h-7 text-xs font-semibold rounded-xl bg-primary text-primary-foreground gap-1 px-3"
          >
            View all alerts <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
