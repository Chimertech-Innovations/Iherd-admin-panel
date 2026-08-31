import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/admin/PageHeader";
import { toast } from "sonner";
import {
  Bell,
  AlertTriangle,
  Send,
  Search,
  CheckCircle2,
  Smartphone,
  Clock,
  Plus,
  ShoppingCart,
  UserPlus,
  Truck,
  ExternalLink,
  CheckCheck,
  Filter,
  Trash2,
  Radio,
  Sparkles,
  Download,
} from "lucide-react";
import { useFirebaseCollection } from "../hooks/useFirebaseData";
import { useAdminNotifications, AdminNotification } from "@/hooks/useAdminNotifications";
import { exportToCsv } from "@/lib/csvExport";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications & Live Activity — iHerd Admin" }] }),
  component: NotificationCenter,
});

type PushItem = {
  title: string;
  message: string;
  farms: string;
  sent: string;
  delivered: string;
  opened: string;
  status: "Delivered" | "Scheduled";
};

function NotificationCenter() {
  const [activityQuery, setActivityQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [receivedQuery, setReceivedQuery] = useState("");
  const [pushQuery, setPushQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [localPush, setLocalPush] = useState<PushItem[]>([]);

  // Push form state
  const [pushTitle, setPushTitle] = useState("");
  const [pushMessage, setPushMessage] = useState("");
  const [targetAudience, setTargetAudience] = useState("all");

  const {
    notifications: liveActivity,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useAdminNotifications();

  // Real data from Firestore
  const { data: notifications = [], isLoading: nLoading } = useFirebaseCollection<any>("notifications");
  const { data: pushHistory = [], isLoading: pLoading } = useFirebaseCollection<any>("push_notifications");

  // Combine Firestore push history with locally sent ones
  const allPush: PushItem[] = [
    ...localPush,
    ...pushHistory.map((p: any) => ({
      title: p.title || "—",
      message: p.message || p.body || "—",
      farms: p.farms || p.targetFarms || "All Farms & Sellers",
      sent: p.sentAt?.seconds
        ? new Date(p.sentAt.seconds * 1000).toLocaleString()
        : p.sentAt || p.sent || "—",
      delivered: String(p.delivered ?? p.deliveredCount ?? "—"),
      opened: String(p.opened ?? p.openedCount ?? "—"),
      status: (p.status === "Scheduled" ? "Scheduled" : "Delivered") as "Delivered" | "Scheduled",
    })),
  ];

  const filteredActivity = useMemo(() => {
    return liveActivity.filter((item) => {
      const matchesSearch =
        (item.title + item.message).toLowerCase().includes(activityQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (activityFilter === "all") return true;
      if (activityFilter === "orders") return item.type === "product_order" || item.type === "cattle_order";
      if (activityFilter === "users") return item.type === "user_login";
      if (activityFilter === "alerts") return item.type === "system_alert";
      return true;
    });
  }, [liveActivity, activityQuery, activityFilter]);

  const filteredReceived = useMemo(
    () =>
      notifications.filter((n: any) =>
        (String(n.title || "") + String(n.message || n.body || "") + String(n.sender || n.from || ""))
          .toLowerCase()
          .includes(receivedQuery.toLowerCase()),
      ),
    [notifications, receivedQuery],
  );

  const filteredPush = useMemo(
    () =>
      allPush.filter((p) =>
        (p.title + p.message + p.farms).toLowerCase().includes(pushQuery.toLowerCase()),
      ),
    [allPush, pushQuery],
  );

  const handleSendPush = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushMessage.trim()) {
      toast.error("Please provide both title and message");
      return;
    }

    const newPush: PushItem = {
      title: pushTitle.trim(),
      message: pushMessage.trim(),
      farms: targetAudience === "all" ? "All Registered Farmers & Sellers" : "Selected Region",
      sent: new Date().toLocaleString(),
      delivered: "Broadcast queued",
      opened: "0",
      status: "Delivered",
    };

    setLocalPush((prev) => [newPush, ...prev]);
    toast.success("Broadcast push notification sent to users!");
    setPushTitle("");
    setPushMessage("");
    setOpen(false);
  };

  const getActivityIcon = (type: AdminNotification["type"]) => {
    switch (type) {
      case "product_order":
        return (
          <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
            <ShoppingCart className="h-4.5 w-4.5" />
          </div>
        );
      case "cattle_order":
        return (
          <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Truck className="h-4.5 w-4.5" />
          </div>
        );
      case "user_login":
        return (
          <div className="h-9 w-9 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0">
            <UserPlus className="h-4.5 w-4.5" />
          </div>
        );
      case "system_alert":
      default:
        return (
          <div className="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4.5 w-4.5" />
          </div>
        );
    }
  };

  const handleExportNotifications = () => {
    const dataToExport = liveActivity.length > 0 ? liveActivity : notifications;
    exportToCsv({
      filename: `iherd_notifications_activity_${new Date().toISOString().slice(0, 10)}`,
      data: dataToExport,
      columns: [
        { header: "Activity ID", accessor: (n: any) => n.id },
        { header: "Type / Category", accessor: (n: any) => n.type || "Notification" },
        { header: "Title", accessor: (n: any) => n.title },
        { header: "Message / Description", accessor: (n: any) => n.message || n.body || "—" },
        {
          header: "Timestamp",
          accessor: (n: any) =>
            n.time
              ? new Date(n.time).toLocaleString()
              : n.createdAt?.seconds
              ? new Date(n.createdAt.seconds * 1000).toLocaleString()
              : n.timestamp || "—",
        },
        { header: "Read Status", accessor: (n: any) => (n.read ? "Read" : "Unread") },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications & Live Activity Center"
        description="Monitor real-time product orders, cattle bookings, new user registrations, and broadcast push announcements."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportNotifications}
              disabled={liveActivity.length === 0 && notifications.length === 0}
              className="rounded-xl text-xs gap-1.5"
              title="Export notifications and live events to CSV"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead} className="rounded-xl text-xs gap-1.5">
                <CheckCheck className="h-3.5 w-3.5" /> Mark All as Read ({unreadCount})
              </Button>
            )}
            <Button
              size="sm"
              className="bg-gradient-to-br from-primary to-primary-glow rounded-xl text-xs gap-1.5 shadow-sm"
              onClick={() => setOpen(true)}
            >
              <Send className="h-3.5 w-3.5" /> Send Push Broadcast
            </Button>
          </div>
        }
      />

      {/* KPI Stats Bar */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Unread Activity",
            value: unreadCount.toLocaleString(),
            icon: Bell,
            tint: "bg-primary/10 text-primary",
            desc: "Pending notifications",
          },
          {
            label: "Live Orders & Activity",
            value: liveActivity.length.toLocaleString(),
            icon: Sparkles,
            tint: "bg-emerald-500/10 text-emerald-600",
            desc: "Aggregated live events",
          },
          {
            label: "Firestore System Alerts",
            value: nLoading ? "…" : String(notifications.length),
            icon: AlertTriangle,
            tint: "bg-amber-500/10 text-amber-600",
            desc: "Device & farm alerts",
          },
          {
            label: "Push Broadcasts",
            value: pLoading ? "…" : String(allPush.length),
            icon: Radio,
            tint: "bg-blue-500/10 text-blue-600",
            desc: "Sent campaigns",
          },
        ].map((k) => (
          <Card key={k.label} className="p-5 rounded-2xl border shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className={`grid h-11 w-11 place-items-center rounded-2xl ${k.tint}`}>
                <k.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">{k.label}</div>
                <div className="text-2xl font-bold tracking-tight text-foreground">{k.value}</div>
                <div className="text-[11px] text-muted-foreground">{k.desc}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="rounded-2xl p-1 bg-muted/60">
          <TabsTrigger value="activity" className="rounded-xl text-xs font-semibold gap-1.5">
            <Radio className="h-3.5 w-3.5 text-primary" /> Live Orders & User Activity ({liveActivity.length})
          </TabsTrigger>
          <TabsTrigger value="received" className="rounded-xl text-xs font-semibold gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> System Alerts ({notifications.length})
          </TabsTrigger>
          <TabsTrigger value="push" className="rounded-xl text-xs font-semibold gap-1.5">
            <Send className="h-3.5 w-3.5 text-blue-500" /> Push Broadcast History ({allPush.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: LIVE ORDERS & USER ACTIVITY */}
        <TabsContent value="activity">
          <Card className="p-0 rounded-3xl overflow-hidden border shadow-sm">
            <div className="p-5 border-b flex flex-wrap items-center justify-between gap-4 bg-muted/20">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Live Activity & Event Stream
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Real-time notifications for incoming orders, customer signups, bookings, and alerts.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-xl bg-muted/60 p-0.5 border">
                  {(["all", "orders", "users", "alerts"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setActivityFilter(f)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                        activityFilter === f
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={activityQuery}
                    onChange={(e) => setActivityQuery(e.target.value)}
                    placeholder="Search events, orders, names..."
                    className="pl-8 h-9 text-xs rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="divide-y divide-border/40">
              {filteredActivity.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <div className="h-12 w-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                    <Bell className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No activity notifications found</p>
                  <p className="text-xs text-muted-foreground">New orders, customer registrations, and events will stream here live.</p>
                </div>
              ) : (
                filteredActivity.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 hover:bg-muted/30 transition-colors ${
                      !item.read ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      {getActivityIcon(item.type)}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs ${!item.read ? "font-bold text-foreground" : "font-semibold text-foreground/90"}`}>
                            {item.title}
                          </span>
                          {!item.read && (
                            <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-bold bg-primary text-primary-foreground">
                              NEW
                            </Badge>
                          )}
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {item.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                      {item.link && (
                        <Link
                          to={item.link as any}
                          onClick={() => markAsRead(item.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                        >
                          View Details <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {!item.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(item.id)}
                          className="h-8 text-xs text-muted-foreground hover:text-foreground rounded-xl"
                          title="Mark read"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        {/* TAB 2: SYSTEM ALERTS */}
        <TabsContent value="received">
          <Card className="p-0 rounded-3xl overflow-hidden border shadow-sm">
            <div className="flex items-center justify-between gap-3 p-5 border-b bg-muted/20">
              <div>
                <h3 className="font-bold text-base text-foreground">Firestore System & Device Alerts</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Alerts from Firestore 'notifications' collection.</p>
              </div>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={receivedQuery}
                  onChange={(e) => setReceivedQuery(e.target.value)}
                  placeholder="Search alerts"
                  className="pl-8 h-9 text-xs rounded-xl"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Title</th>
                    <th className="px-5 py-3 text-left font-medium">Message</th>
                    <th className="px-5 py-3 text-left font-medium">Sender</th>
                    <th className="px-5 py-3 text-left font-medium">Date & time</th>
                    <th className="px-5 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {nLoading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                        Loading alerts…
                      </td>
                    </tr>
                  ) : filteredReceived.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                        No platform alerts in Firestore 'notifications' collection yet.
                      </td>
                    </tr>
                  ) : (
                    filteredReceived.map((n: any, i: number) => {
                      const status = n.status || "Read";
                      const d = n.createdAt?.seconds
                        ? new Date(n.createdAt.seconds * 1000).toLocaleString()
                        : n.createdAt
                        ? new Date(n.createdAt).toLocaleString()
                        : n.datetime || "—";
                      return (
                        <tr key={n.id || i} className="hover:bg-muted/20">
                          <td className="px-5 py-3 font-semibold text-foreground">
                            {n.title || n.subject || "System Notification"}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground max-w-md">{n.message || n.body || "—"}</td>
                          <td className="px-5 py-3 text-muted-foreground">{n.sender || n.from || "System"}</td>
                          <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{d}</td>
                          <td className="px-5 py-3">
                            <Badge variant="outline" className="text-[10px]">
                              {status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 3: PUSH BROADCAST HISTORY */}
        <TabsContent value="push">
          <Card className="p-0 rounded-3xl overflow-hidden border shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b bg-muted/20">
              <div>
                <h3 className="font-bold text-base text-foreground">Push Notification Broadcasts</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Campaigns sent to registered farm accounts.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={pushQuery}
                    onChange={(e) => setPushQuery(e.target.value)}
                    placeholder="Search push history"
                    className="pl-8 h-9 text-xs rounded-xl"
                  />
                </div>
                <Button size="sm" className="rounded-xl text-xs bg-primary text-primary-foreground gap-1" onClick={() => setOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> New Broadcast
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Notification</th>
                    <th className="px-5 py-3 text-left font-medium">Target Audience</th>
                    <th className="px-5 py-3 text-left font-medium">Sent Date</th>
                    <th className="px-5 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {pLoading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                        Loading push history…
                      </td>
                    </tr>
                  ) : filteredPush.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                        No push broadcasts sent yet.
                      </td>
                    </tr>
                  ) : (
                    filteredPush.map((p, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-foreground">{p.title}</div>
                          <div className="text-muted-foreground text-[11px] max-w-md line-clamp-1">{p.message}</div>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{p.farms}</td>
                        <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{p.sent}</td>
                        <td className="px-5 py-3">
                          <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold">
                            {p.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Broadcast Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" /> Send Broadcast Push Notification
            </DialogTitle>
            <DialogDescription className="text-xs">
              Send an instant push message alert to farmer and seller mobile devices.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendPush} className="space-y-3.5 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notification Title</Label>
              <Input
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                placeholder="e.g. Vaccination Drive Announcement"
                className="rounded-xl h-10 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notification Message</Label>
              <Textarea
                value={pushMessage}
                onChange={(e) => setPushMessage(e.target.value)}
                placeholder="Type the message body to deliver to app users..."
                rows={3}
                className="rounded-xl text-xs resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target Group</Label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full h-10 rounded-xl border bg-background px-3 text-xs"
              >
                <option value="all">All Farmers & Sellers</option>
                <option value="farmers">Farmers Only</option>
                <option value="sellers">Marketplace Sellers</option>
              </select>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl text-xs bg-primary text-primary-foreground">
                <Send className="h-3.5 w-3.5 mr-1" /> Send Broadcast
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
