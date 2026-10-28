/**
 * Centralized High-Performance API Client for iHerd Admin Console
 * - Intelligent backend URL detection (avoids localhost connection errors in production)
 * - Ultra-fast in-memory caching and request deduplication
 */

const DEFAULT_RENDER_BACKEND = "https://iherdadminpanel.onrender.com";

let resolvedApiBase: string | null = null;
let resolvingPromise: Promise<string> | null = null;

export function isLocalHostname(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("192.168.") ||
    host.endsWith(".local")
  );
}

/**
 * Resolves the fastest working backend API Base URL.
 * Never attempts localhost in production / remote browser sessions.
 */
export async function getApiBaseUrl(): Promise<string> {
  if (resolvedApiBase) return resolvedApiBase;
  if (resolvingPromise) return resolvingPromise;

  resolvingPromise = (async () => {
    const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
    const isLocal = isLocalHostname();

    if (envUrl && (isLocal || (!envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")))) {
      resolvedApiBase = envUrl;
      return envUrl;
    }

    if (isLocal) {
      // Test if local backend on port 5000 is active with an adaptive probe
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch("http://localhost:5000/ping", {
          signal: controller.signal,
          method: "GET",
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          resolvedApiBase = "http://localhost:5000";
          return resolvedApiBase;
        }
      } catch {
        // Local server not ready yet, temporarily use Render without permanently locking out local
        resolvingPromise = null;
        return DEFAULT_RENDER_BACKEND;
      }
    }

    // Default production Render backend
    resolvedApiBase = DEFAULT_RENDER_BACKEND;
    return resolvedApiBase;
  })();

  return resolvingPromise;
}

/**
 * Synchronous getter for API base URL (returns cached if known, or fallback).
 */
export function getApiBaseUrlSync(): string {
  if (resolvedApiBase) return resolvedApiBase;
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
  const isLocal = isLocalHostname();

  if (envUrl && (isLocal || (!envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")))) {
    return envUrl;
  }

  return isLocal ? "http://localhost:5000" : DEFAULT_RENDER_BACKEND;
}

/**
 * High-speed JSON fetch helper with timeout
 */
export async function fetchApiJson<T = any>(
  path: string,
  options?: RequestInit,
  timeoutMs = 12000
): Promise<T> {
  const base = await getApiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${cleanPath}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: options?.signal || controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options?.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`API HTTP ${res.status}: ${errText || res.statusText}`);
    }

    return await res.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
}
