import { getLocalizedText } from "./utils";
import { toast } from "sonner";

export interface CsvColumn<T = any> {
  header: string;
  accessor?: keyof T | string | ((row: T) => any);
  render?: (row: T) => any;
  key?: string;
  label?: string;
}

/**
 * Cleanly formats any data value into a safe CSV text cell.
 * Handles nested objects, localized multi-language maps, Firestore timestamps, arrays, numbers, and dates.
 */
export function formatCsvValue(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return String(val);
  if (val instanceof Date) return val.toLocaleString();
  
  if (typeof val === "object") {
    // Firestore Timestamp check
    if (val._seconds !== undefined || val.seconds !== undefined) {
      const s = val.seconds ?? val._seconds;
      return new Date(s * 1000).toLocaleString();
    }
    
    // Check if it is an array
    if (Array.isArray(val)) {
      const items = val
        .map((v) => {
          if (typeof v === "object") {
            const loc = getLocalizedText(v, "");
            if (loc && loc !== "—") return loc;
            return v.name || v.title || v.id || JSON.stringify(v);
          }
          return String(v);
        })
        .filter(Boolean);
      return items.join("; ");
    }

    // Try localized string extraction
    const loc = getLocalizedText(val, "");
    if (loc && loc !== "—") return loc;

    // Check common object keys
    if (val.name) return getLocalizedText(val.name);
    if (val.title) return getLocalizedText(val.title);
    if (val.farmName) return getLocalizedText(val.farmName);
    if (val.shopName) return getLocalizedText(val.shopName);
    if (val.clinic) return getLocalizedText(val.clinic);

    return JSON.stringify(val);
  }

  return String(val);
}

/**
 * Escapes a cell value to prevent CSV injection and preserve quotes/commas/newlines.
 */
function escapeCsvCell(cell: string): string {
  if (cell.includes(",") || cell.includes('"') || cell.includes("\n") || cell.includes("\r")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/**
 * Universal CSV Export function.
 * Exports any dataset into a well-formed CSV file with UTF-8 BOM encoding for seamless Excel / Google Sheets support.
 */
export function exportToCsv<T = any>({
  filename,
  data,
  columns,
  showToast = true,
}: {
  filename: string;
  data: T[];
  columns?: (CsvColumn<T> | string)[];
  showToast?: boolean;
}) {
  if (!data || data.length === 0) {
    if (showToast) toast.info("No data available to export.");
    return;
  }

  try {
    let headers: string[] = [];
    let extractors: ((row: T) => string)[] = [];

    if (columns && columns.length > 0) {
      columns.forEach((col) => {
        if (typeof col === "string") {
          headers.push(col);
          extractors.push((row: any) => formatCsvValue(row[col]));
        } else {
          const header = col.header || col.label || String(col.key || col.accessor || "");
          headers.push(header);
          extractors.push((row: T) => {
            if (typeof col.accessor === "function") {
              return formatCsvValue(col.accessor(row));
            }
            if (typeof col.accessor === "string") {
              // support dot-notation like "farms.name"
              const parts = col.accessor.split(".");
              let cur: any = row;
              for (const part of parts) {
                if (cur === null || cur === undefined) break;
                cur = cur[part];
              }
              return formatCsvValue(cur);
            }
            if (col.key) {
              const k = col.key as string;
              if (k.includes(".")) {
                const parts = k.split(".");
                let cur: any = row;
                for (const part of parts) {
                  if (cur === null || cur === undefined) break;
                  cur = cur[part];
                }
                return formatCsvValue(cur);
              }
              return formatCsvValue((row as any)[k]);
            }
            return "";
          });
        }
      });
    } else {
      // Auto-extract keys from first object
      const first = data[0] as Record<string, any>;
      const keys = Object.keys(first).filter((k) => !k.startsWith("_"));
      headers = keys;
      extractors = keys.map((k) => (row: any) => formatCsvValue(row[k]));
    }

    const rows: string[][] = [];
    rows.push(headers.map(escapeCsvCell));

    data.forEach((item) => {
      const row = extractors.map((extractor) => escapeCsvCell(extractor(item)));
      rows.push(row);
    });

    const csvContent = rows.map((r) => r.join(",")).join("\r\n");

    // Add UTF-8 BOM (\uFEFF) so Excel correctly decodes special characters & regional text (e.g. Hindi, Marathi)
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const safeFilename = filename.toLowerCase().endsWith(".csv")
      ? filename
      : `${filename.toLowerCase().replace(/[^a-z0-9_ -]/g, "_")}.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", safeFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (showToast) {
      toast.success(`Exported ${data.length} records to ${safeFilename}`);
    }
  } catch (err: any) {
    console.error("CSV Export failed:", err);
    if (showToast) toast.error(`Export failed: ${err.message}`);
  }
}
