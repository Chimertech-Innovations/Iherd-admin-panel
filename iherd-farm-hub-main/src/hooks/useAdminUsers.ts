import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

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

function saveTopCachedUsers(users: any[]) {
  try {
    if (typeof window !== "undefined" && Array.isArray(users)) {
      // Save top 100 users to prevent localStorage memory quota freeze
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(users.slice(0, 100)));
    }
  } catch {}
}

async function pingBackend() {
  for (const base of ENDPOINTS) {
    try {
      await fetch(`${base}/ping`, { method: "GET" });
      break;
    } catch {}
  }
}

/**
 * 2-Stage Progressive User Data Fetcher:
 * 1. Requests initial 1,000 users fast so UI renders within ~500ms.
 * 2. Progressively fetches remaining balance in chunks of 100 until full dataset is loaded.
 */
async function fetchProgressiveUsers(
  onProgress?: (currentUsers: any[], totalServerCount: number, isComplete: boolean) => void
): Promise<any[]> {
  for (const base of ENDPOINTS) {
    try {
      // Step 1: Fetch first 1,000 users
      const initialController = new AbortController();
      const initialTimer = setTimeout(() => initialController.abort(), 15000);
      const res = await fetch(`${base}/api/admin/users?limit=1000&offset=0`, { signal: initialController.signal });
      clearTimeout(initialTimer);

      if (res.ok) {
        const data = await res.json();
        let loadedUsers: any[] = Array.isArray(data.users) ? data.users : [];
        const totalServerCount = Number(data.total) || loadedUsers.length;
        let hasMore = Boolean(data.hasMore) || loadedUsers.length < totalServerCount;

        saveTopCachedUsers(loadedUsers);
        if (onProgress) {
          onProgress(loadedUsers, totalServerCount, !hasMore);
        }

        // Step 2: Progressively fetch balance of users in chunks of 100
        let currentOffset = loadedUsers.length;
        while (hasMore && currentOffset < totalServerCount) {
          try {
            const chunkController = new AbortController();
            const chunkTimer = setTimeout(() => chunkController.abort(), 15000);
            const chunkRes = await fetch(`${base}/api/admin/users?limit=100&offset=${currentOffset}`, {
              signal: chunkController.signal,
            });
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

  // Fallback if all endpoints fail
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
    staleTime: 120_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    data: query.data || [],
    isFetchingBalance,
    totalCount: totalCount || (query.data ? query.data.length : 0),
  };
}

