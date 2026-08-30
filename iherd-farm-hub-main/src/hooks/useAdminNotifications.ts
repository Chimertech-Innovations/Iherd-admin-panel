import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

export type NotificationType =
  | "product_order"
  | "cattle_order"
  | "user_login"
  | "token_advance"
  | "system_alert"
  | "push_notification";

export interface AdminNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  rawDate: Date;
  link?: string;
  read: boolean;
  category: "orders" | "users" | "alerts" | "all";
  priority?: "high" | "medium" | "low";
  metadata?: Record<string, any>;
}

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://iherdadminpanel.onrender.com";
const FALLBACK_API_BASE = "https://iherdadminpanel.onrender.com";

const READ_STORAGE_KEY = "iherd_admin_read_notifications_v1";

function getStoredReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveStoredReadIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore storage quota issues
  }
}

function parseDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === "object" && (val._seconds || val.seconds)) {
    return new Date((val._seconds || val.seconds) * 1000);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHour / 24);

  if (diffSec < 45) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export function useAdminNotifications() {
  const [readIds, setReadIds] = useState<Set<string>>(() => getStoredReadIds());
  const [firestoreAlerts, setFirestoreAlerts] = useState<any[]>([]);
  const hasInitializedToasts = useRef(false);
  const previousItemIds = useRef<Set<string>>(new Set());

  // 1. Live Firestore 'notifications' collection subscription
  useEffect(() => {
    try {
      const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(25));
      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          const alerts: any[] = [];
          snap.forEach((doc) => {
            alerts.push({ id: doc.id, ...doc.data() });
          });
          setFirestoreAlerts(alerts);
        },
        (err) => {
          console.warn("Firestore notifications subscription notice:", err.message);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      // Ignore
    }
  }, []);

  // 2. Fetch live product orders
  const { data: productOrders = [] } = useQuery({
    queryKey: ["liveActivityProductOrders"],
    queryFn: async () => {
      const endpoints = [API_BASE, FALLBACK_API_BASE];
      for (const base of endpoints) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(`${base}/api/admin/product-orders`, { signal: controller.signal });
          clearTimeout(timer);
          if (res.ok) {
            const data = await res.json();
            return data.orders || [];
          }
        } catch {
          // try next
        }
      }
      return [];
    },
    refetchInterval: 25_000,
    staleTime: 15_000,
  });

  // 3. Fetch live cattle orders
  const { data: cattleOrders = [] } = useQuery({
    queryKey: ["liveActivityCattleOrders"],
    queryFn: async () => {
      const endpoints = [API_BASE, FALLBACK_API_BASE];
      for (const base of endpoints) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(`${base}/api/admin/cattle-orders`, { signal: controller.signal });
          clearTimeout(timer);
          if (res.ok) {
            const data = await res.json();
            return data.orders || [];
          }
        } catch {
          // try next
        }
      }
      return [];
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  // 4. Fetch live users / logins
  const { data: users = [] } = useQuery({
    queryKey: ["liveActivityUsers"],
    queryFn: async () => {
      const endpoints = [API_BASE, FALLBACK_API_BASE];
      for (const base of endpoints) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(`${base}/api/admin/users`, { signal: controller.signal });
          clearTimeout(timer);
          if (res.ok) {
            const data = await res.json();
            return data.users || [];
          }
        } catch {
          // try next
        }
      }
      return [];
    },
    refetchInterval: 35_000,
    staleTime: 25_000,
  });

  // Aggregate and normalize all notifications into a single feed
  const notifications: AdminNotification[] = useMemo(() => {
    const list: AdminNotification[] = [];

    // A. Add Product Orders
    productOrders.forEach((po: any) => {
      const ordId = po.orderId || po.id;
      const rawDate = parseDate(po.createdAt || po.date);
      const buyer = po.buyerName || "Customer";
      const total = Number(po.totalAmount || po.price || 0);
      const itemCount = Array.isArray(po.items) ? po.items.length : (po.itemCount || 1);
      const id = `po_${ordId}`;

      list.push({
        id,
        type: "product_order",
        title: `New Product Order #${ordId}`,
        message: `${buyer} placed an order for ${itemCount} item(s) • ₹${total.toLocaleString()}`,
        rawDate,
        timestamp: formatTimeAgo(rawDate),
        link: `/orders/products`,
        read: readIds.has(id),
        category: "orders",
        priority: "high",
        metadata: po,
      });
    });

    // B. Add Cattle Orders
    cattleOrders.forEach((co: any) => {
      const ordId = co.orderId || co.id;
      const rawDate = parseDate(co.createdAt || co.date);
      const buyer = co.buyerName || "Buyer";
      const price = Number(co.totalAmount || co.price || co.amount || 0);
      const breed = co.breed || co.cattleType || "Cattle";
      const id = `co_${ordId}`;

      list.push({
        id,
        type: "cattle_order",
        title: `Cattle Order & Deal #${ordId}`,
        message: `${buyer} booked ${breed} listing • Total: ₹${price.toLocaleString()}`,
        rawDate,
        timestamp: formatTimeAgo(rawDate),
        link: `/orders/cattle`,
        read: readIds.has(id),
        category: "orders",
        priority: "high",
        metadata: co,
      });
    });

    // C. Add Users (New Registrations & Logins)
    users.forEach((u: any) => {
      const uId = u.uid || u.id;
      const rawDate = parseDate(u.createdAt || u.lastLoginAt || u.metadata?.creationTime);
      const name = u.displayName || u.name || (u.phoneNumber ? `User ${u.phoneNumber}` : `User (${(uId || "").slice(0, 6)})`);
      const phoneOrEmail = u.phoneNumber || u.email || "Mobile App User";
      const id = `user_${uId}`;

      list.push({
        id,
        type: "user_login",
        title: `User Active / Registered: ${name}`,
        message: `${phoneOrEmail} joined the iHerd Farm Hub platform.`,
        rawDate,
        timestamp: formatTimeAgo(rawDate),
        link: `/users/${uId}`,
        read: readIds.has(id),
        category: "users",
        priority: "medium",
        metadata: u,
      });
    });

    // D. Add Firestore 'notifications' collection alerts
    firestoreAlerts.forEach((fa: any) => {
      const rawDate = parseDate(fa.createdAt || fa.timestamp || fa.date);
      const id = `alert_${fa.id}`;

      list.push({
        id,
        type: "system_alert",
        title: fa.title || "Platform Alert",
        message: fa.message || fa.body || fa.description || "System notification received.",
        rawDate,
        timestamp: formatTimeAgo(rawDate),
        link: fa.link || `/notifications`,
        read: readIds.has(id) || fa.status === "read",
        category: "alerts",
        priority: fa.priority || "medium",
        metadata: fa,
      });
    });

    // Sort chronologically (latest first)
    list.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

    return list;
  }, [productOrders, cattleOrders, users, firestoreAlerts, readIds]);

  // Live Toast Alerts when a new order or user arrives
  useEffect(() => {
    if (notifications.length === 0) return;

    const currentIds = new Set(notifications.map((n) => n.id));

    if (!hasInitializedToasts.current) {
      // First load: initialize seen IDs without spamming toasts
      previousItemIds.current = currentIds;
      hasInitializedToasts.current = true;
      return;
    }

    // Check for new items that weren't present previously
    notifications.forEach((item) => {
      if (!previousItemIds.current.has(item.id)) {
        // Fire live toast to alert the admin
        if (item.type === "product_order") {
          toast.success(`🛒 ${item.title}`, {
            description: item.message,
            duration: 6000,
          });
        } else if (item.type === "cattle_order") {
          toast.success(`🐄 ${item.title}`, {
            description: item.message,
            duration: 6000,
          });
        } else if (item.type === "user_login") {
          toast.info(`👤 ${item.title}`, {
            description: item.message,
            duration: 5000,
          });
        }
      }
    });

    previousItemIds.current = currentIds;
  }, [notifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveStoredReadIds(next);
      return next;
    });
  };

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    saveStoredReadIds(allIds);
    toast.success("All notifications marked as read");
  };

  const clearNotification = (id: string) => {
    markAsRead(id);
  };

  const clearAll = () => {
    markAllAsRead();
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
  };
}
