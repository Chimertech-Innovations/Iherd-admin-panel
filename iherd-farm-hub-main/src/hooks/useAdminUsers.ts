import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getApiBaseUrlSync, isLocalHostname } from "@/lib/apiClient";
import { collection, getDocs, limit as fsLimit, query as fsQuery } from "firebase/firestore";
import { db } from "@/lib/firebase";

const LOCAL_STORAGE_KEY = "iherd_cached_admin_users";

function getEndpoints(): string[] {
  const primary = getApiBaseUrlSync();
  const endpoints: string[] = [];

  if (primary) endpoints.push(primary);

  if (isLocalHostname()) {
    if (!endpoints.includes("http://localhost:5000")) endpoints.push("http://localhost:5000");
    if (!endpoints.includes("http://127.0.0.1:5000")) endpoints.push("http://127.0.0.1:5000");
  }

  if (!endpoints.includes("https://iherdadminpanel.onrender.com")) {
    endpoints.push("https://iherdadminpanel.onrender.com");
  }

  return endpoints.filter(Boolean);
}

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

function saveTopCachedUsers(users: any[]) {
  try {
    if (typeof window !== "undefined" && Array.isArray(users)) {
      // Save top 1,500 lightweight records in localStorage for instant rendering on load
      const light = users.slice(0, 1500).map((u) => ({
        uid: u.uid || u.id,
        id: u.uid || u.id,
        displayName: u.displayName || u.name || "User",
        name: u.name || u.displayName || "User",
        phoneNumber: u.phoneNumber || u.phone || "—",
        phone: u.phoneNumber || u.phone || "—",
        email: u.email || "—",
        role: u.role || (Array.isArray(u.roles) ? u.roles[0] : "User"),
        roles: u.roles || [u.role || "User"],
        village: u.village || "—",
        district: u.district || "—",
        state: u.state || "—",
        location: u.location || "—",
        createdAt: u.createdAt || null,
      }));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(light));
    }
  } catch {}
}

async function pingBackend() {
  for (const base of getEndpoints()) {
    try {
      // Non-blocking ping allowing Render free-tier cold-start to wake up
      fetch(`${base}/ping`, { method: "GET" }).catch(() => {});
    } catch {}
  }
}

/**
 * High-Speed Progressive User Data Fetcher:
 * 1. Fast requests in large chunks (5,000 per chunk instead of 100) to eliminate 80+ network round-trips.
 * 2. 35-second cold-start allowance to wait for Render free-tier container boot.
 * 3. Direct Firestore client fallback if all backend endpoints fail.
 */
async function fetchProgressiveUsers(
  onProgress?: (currentUsers: any[], totalServerCount: number, isComplete: boolean) => void
): Promise<any[]> {
  for (const base of getEndpoints()) {
    try {
      // Step 1: Fetch initial large batch (up to 5,000 users in 1 request)
      const initialController = new AbortController();
      const initialTimer = setTimeout(() => initialController.abort(), 35000);
      const res = await fetch(`${base}/api/admin/users?limit=5000&offset=0`, {
        signal: initialController.signal,
      });
      clearTimeout(initialTimer);

      if (res.ok) {
        const data = await res.json();
        let loadedUsers: any[] = Array.isArray(data.users) ? data.users : [];
        const totalServerCount = Number(data.total) || loadedUsers.length;
        let hasMore = Boolean(data.hasMore) && loadedUsers.length < totalServerCount;

        saveTopCachedUsers(loadedUsers);
        if (onProgress) {
          onProgress(loadedUsers, totalServerCount, !hasMore);
        }

        // Step 2: Fetch remaining balance in large batches (5,000 per chunk)
        let currentOffset = loadedUsers.length;
        while (hasMore && currentOffset < totalServerCount) {
          try {
            const chunkController = new AbortController();
            const chunkTimer = setTimeout(() => chunkController.abort(), 10000);
            const chunkRes = await fetch(
              `${base}/api/admin/users?limit=5000&offset=${currentOffset}`,
              { signal: chunkController.signal }
            );
            clearTimeout(chunkTimer);

            if (chunkRes.ok) {
              const chunkData = await chunkRes.json();
              const chunkUsers = Array.isArray(chunkData.users) ? chunkData.users : [];
              if (chunkUsers.length === 0) break;

              // Append chunk users avoiding duplicate UIDs
              const existingUids = new Set(loadedUsers.map((u: any) => u.uid || u.id));
              const newUsers = chunkUsers.filter((u: any) => !existingUids.has(u.uid || u.id));
              loadedUsers = [...loadedUsers, ...newUsers];

              currentOffset += chunkUsers.length;
              hasMore = Boolean(chunkData.hasMore) && currentOffset < totalServerCount;

              if (onProgress) {
                onProgress(loadedUsers, totalServerCount, !hasMore);
              }
            } else {
              break;
            }
          } catch (chunkErr) {
            console.warn("Progressive user balance chunk fetch interrupted:", chunkErr);
            break;
          }
        }

        return loadedUsers;
      }
    } catch (err) {
      console.warn(`Failed fetching users from endpoint ${base}, trying fallback:`, err);
    }
  }

  // Fallback Step: Direct Firestore client query if backend is unavailable
  try {
    const snap = await getDocs(fsQuery(collection(db, "users"), fsLimit(2000)));
    if (snap && snap.docs.length > 0) {
      const fsUsers = snap.docs.map((d) => {
        const u = d.data();
        return {
          uid: d.id,
          id: d.id,
          displayName: u.fullName || u.displayName || u.name || "User",
          name: u.fullName || u.name || u.displayName || "User",
          phoneNumber: u.phoneNumber || u.phone || "—",
          email: u.email || "—",
          role: u.role || (Array.isArray(u.roles) ? u.roles[0] : "User"),
          roles: u.roles || [u.role || "User"],
          village: u.village || "—",
          district: u.district || "—",
          state: u.state || "—",
          location: u.location || "—",
          createdAt: u.createdAt || null,
        };
      });
      saveTopCachedUsers(fsUsers);
      if (onProgress) {
        onProgress(fsUsers, fsUsers.length, true);
      }
      return fsUsers;
    }
  } catch (fsErr) {
    console.warn("Direct Firestore fallback note:", fsErr);
  }

  // Final fallback from localStorage
  const fallback = getLocalCachedUsers();
  if (onProgress) {
    onProgress(fallback, fallback.length, true);
  }
  return fallback;
}

/**
 * Shared hook — fetches all Firebase Auth users from the Express backend with 2-stage progressive loading.
 * - Instant load of first 1,000 users.
 * - Progressive background loading of balance in chunks of 100 until complete.
 */
export function useAdminUsers() {
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => {
    pingBackend();
    intervalRef.current = setInterval(pingBackend, KEEP_ALIVE_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const query = useQuery<any[]>({
    queryKey: ["adminUsers"],
    queryFn: () =>
      fetchProgressiveUsers((currentUsers, totalServerCount, isComplete) => {
        setTotalCount(totalServerCount);
        setIsFetchingBalance(!isComplete);
        queryClient.setQueryData(["adminUsers"], currentUsers);
      }),
    placeholderData: (previousData) =>
      previousData && previousData.length > 0 ? previousData : getLocalCachedUsers(),
    staleTime: 600_000,
    gcTime: 1800_000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 2500, 7500),
  });

  return {
    ...query,
    data: query.data || [],
    isFetchingBalance,
    totalCount: totalCount || (query.data ? query.data.length : 0),
  };
}

