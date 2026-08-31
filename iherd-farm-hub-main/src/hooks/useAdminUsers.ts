import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

const LOCAL_STORAGE_KEY = "iherd_cached_admin_users";

const ENDPOINTS = [
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, ""),
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "https://iherdadminpanel.onrender.com",
].filter(Boolean) as string[];

const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;

function getLocalCachedUsers(): any[] {
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch {}
  return [];
}

async function pingBackend() {
  for (const base of ENDPOINTS) {
    try {
      await fetch(`${base}/ping`, { method: "GET" });
      break;
    } catch {}
  }
}

async function fetchAdminUsers(): Promise<any[]> {
  for (const base of ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${base}/api/admin/users`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const users = data.users || [];
        if (Array.isArray(users) && users.length > 0) {
          try {
            if (typeof window !== "undefined") {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(users));
            }
          } catch {}
          return users;
        }
      }
    } catch {}
  }

  return getLocalCachedUsers();
}

/**
 * Shared hook — fetches all Firebase Auth users from the Express backend.
 * - Instant 0ms load with localStorage bootstrap.
 * - Caches in React Query with 120s staleTime to make navigation instantaneous without flashing 0 or spinners.
 */
export function useAdminUsers() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    pingBackend();
    intervalRef.current = setInterval(pingBackend, KEEP_ALIVE_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return useQuery<any[]>({
    queryKey: ["adminUsers"],
    queryFn: fetchAdminUsers,
    placeholderData: (previousData) => (previousData && previousData.length > 0 ? previousData : getLocalCachedUsers()),
    staleTime: 120_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });
}

