import { useState, useMemo } from "react";
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
  } catch {}
}

/**
 * Clean 0-background-read notifications hook.
 * Disables all onSnapshot subscriptions and background polling intervals
 * so leaving the admin panel tab open burns 0 Firestore reads.
 */
export function useAdminNotifications() {
  const [readIds, setReadIds] = useState<Set<string>>(() => getStoredReadIds());

  const notifications: AdminNotification[] = useMemo(() => [], []);

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
