import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

    if (val.name) return getLocalizedText(val.name, fallback);
    if (val.title) return getLocalizedText(val.title, fallback);
    if (val.label) return getLocalizedText(val.label, fallback);
    if (val.text) return getLocalizedText(val.text, fallback);
    if (val.value !== undefined) return getLocalizedText(val.value, fallback);

    for (const key of Object.keys(val)) {
      if (typeof val[key] === "string" && val[key].trim()) {
        return val[key];
      }
    }
    return fallback;
  }
  return String(val);
}

/**
 * Formats image URLs, converting Google Drive sharing/preview URLs to direct image stream URLs.
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

  // 1. Convert Google Drive Links
  const driveFileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch && driveFileMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${driveFileMatch[1]}&sz=w1000`;
  }
  const driveIdMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (trimmed.includes("drive.google.com") && driveIdMatch && driveIdMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${driveIdMatch[1]}&sz=w1000`;
  }

  return trimmed;
}


