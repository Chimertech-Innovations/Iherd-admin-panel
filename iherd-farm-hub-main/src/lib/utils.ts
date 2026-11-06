import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getApiBaseUrlSync } from "./apiClient";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely extracts a display string from any value (string, localized object {en, hi, mr, ...}, or number).
 * Prevents React child object crash: "Objects are not valid as a React child (found: object with keys {mr, hi, ...})"
 */
export function getLocalizedText(val: any, fallback = "—"): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    if (Array.isArray(val)) {
      const arr = val.map((v) => getLocalizedText(v, "")).filter(Boolean);
      return arr.length > 0 ? arr.join(", ") : fallback;
    }
    // Specific standard language keys
    if (typeof val.en === "string" && val.en.trim()) return val.en;
    if (typeof val.hi === "string" && val.hi.trim()) return val.hi;
    if (typeof val.mr === "string" && val.mr.trim()) return val.mr;
    if (typeof val.kn === "string" && val.kn.trim()) return val.kn;
    if (typeof val.pa === "string" && val.pa.trim()) return val.pa;
    if (typeof val.ta === "string" && val.ta.trim()) return val.ta;

    if (val.key !== undefined && val.key !== null) return getLocalizedText(val.key, fallback);
    if (val.name !== undefined && val.name !== null) return getLocalizedText(val.name, fallback);
    if (val.title !== undefined && val.title !== null) return getLocalizedText(val.title, fallback);
    if (val.label !== undefined && val.label !== null) return getLocalizedText(val.label, fallback);
    if (val.text !== undefined && val.text !== null) return getLocalizedText(val.text, fallback);
    if (val.value !== undefined && val.value !== null) return getLocalizedText(val.value, fallback);

    for (const key of Object.keys(val)) {
      if (typeof val[key] === "string" && val[key].trim()) {
        return val[key];
      }
      if (typeof val[key] === "number") {
        return String(val[key]);
      }
    }
    return fallback;
  }
  return typeof val === "object" ? fallback : String(val);
}

/**
 * Formats image URLs, converting Google Drive sharing/preview URLs to direct image streams
 * via the backend proxy or high-speed CDN.
 */
export function formatImageUrl(url: any): string {
  if (!url) return "";
  if (Array.isArray(url)) {
    const first = url.find((u) => typeof u === "string" && u.trim().length > 0);
    return formatImageUrl(first);
  }
  if (typeof url !== "string") return "";

  const trimmed = url.trim();
  if (!trimmed) return "";

  // Convert Google Drive Links via our backend proxy so browsers on localhost/production
  // are never blocked by Google Drive CORS, 429 hotlinking or third-party cookie restrictions
  if (trimmed.includes("drive.google.com") || trimmed.includes("docs.google.com")) {
    const base = getApiBaseUrlSync();
    return `${base}/api/admin/proxy-image?url=${encodeURIComponent(trimmed)}`;
  }

  // Also proxy lh3 CDN links if they originated from drive
  if (trimmed.includes("lh3.googleusercontent.com/d/")) {
    const base = getApiBaseUrlSync();
    return `${base}/api/admin/proxy-image?url=${encodeURIComponent(trimmed)}`;
  }

  return trimmed;
}

/**
 * Converts Google Drive sharing links into high-speed lh3 direct CDN stream URLs.
 */
export function convertToDirectImageUrl(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const driveMatch =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}=s800`;
  }
  return trimmed;
}


