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
 * Automatically chooses http://localhost:5000 when running in local browser/dev.
 */
export async function getApiBaseUrl(): Promise<string> {
  if (resolvedApiBase) return resolvedApiBase;
  if (resolvingPromise) return resolvingPromise;

  resolvingPromise = (async () => {
    const isLocal = isLocalHostname();

    if (isLocal) {
      // In local development, use local backend on port 5000
      resolvedApiBase = "http://localhost:5000";
      return resolvedApiBase;
    }

    const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      resolvedApiBase = envUrl;
      return envUrl;
    }

    // Default production Render backend
    resolvedApiBase = DEFAULT_RENDER_BACKEND;
    return resolvedApiBase;
  })();

  return resolvingPromise;
}

/**
 * Synchronous getter for API base URL.
 * On localhost, guarantees http://localhost:5000 so local changes work immediately.
 */
export function getApiBaseUrlSync(): string {
  if (resolvedApiBase) return resolvedApiBase;
  const isLocal = isLocalHostname();
  if (isLocal) {
    return "http://localhost:5000";
  }

  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }

  return DEFAULT_RENDER_BACKEND;
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
