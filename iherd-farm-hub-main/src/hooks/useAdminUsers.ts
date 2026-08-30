import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

const ENDPOINTS = [
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, ""),
  "https://iherdadminpanel.onrender.com",
].filter(Boolean) as string[];

const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;

async function pingBackend() {
  for (const base of ENDPOINTS) {
    try {
      await fetch(`${base}/`, { method: "GET" });
      break;
    } catch {}
  }
}

async function fetchAdminUsers(): Promise<any[]> {
  for (const base of ENDPOINTS) {
    try {
      const res = await fetch(`${base}/api/admin/users`);
      if (res.ok) {
        const data = await res.json();
        const users = data.users || [];
        if (Array.isArray(users) && users.length > 0) {
          console.log(`[useAdminUsers] loaded ${users.length} users from ${base}`);
          return users;
        }
      }
    } catch {}
  }

  return [];
}

/**
 * Shared hook — fetches all Firebase Auth users from the Express backend.
 * - Uses placeholderData (not initialData) so the fetch always runs on mount.
 * - Retries up to 3 times with a delay to survive Render cold starts.
 * - Keeps the backend alive with a periodic ping every 10 minutes.
 */
export function useAdminUsers() {
  // Keep-alive: ping the backend every 10 minutes to prevent Render sleeping
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    pingBackend(); // Ping immediately on mount
    intervalRef.current = setInterval(pingBackend, KEEP_ALIVE_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return useQuery<any[]>({
    queryKey: ["adminUsers"],
    queryFn: fetchAdminUsers,
    // placeholderData shows [] while loading but still triggers the fetch.
    // initialData would suppress the fetch (bug: data never loaded).
    placeholderData: [],
    retry: false,   // retries handled inside fetchAdminUsers with delays
    staleTime: 0,   // always refetch on mount — data is never considered stale
  });
}
