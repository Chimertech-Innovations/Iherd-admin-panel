import { useMemo, useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Filter, Plus, Download, Calendar, MapPin, ArrowUpDown, Layers, RotateCcw, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "./PageHeader";
import { StatusBadge } from "./StatusBadge";

import { getLocalizedText } from "@/lib/utils";
import { toast } from "sonner";

import { exportToCsv, type CsvColumn } from "@/lib/csvExport";

export type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
  exportValue?: (row: T) => any;
};

export type KPI = {
  label: string;
  value: string | number;
  hint?: string;
  change?: string;
  up?: boolean;
};

function extractTime(val: any): number {
  if (!val) return 0;
  if (typeof val === "number") return val;
  if (val instanceof Date) return val.getTime();
  if (typeof val === "object" && (val._seconds || val.seconds)) {
    return (val._seconds || val.seconds) * 1000;
  }
  const d = new Date(val).getTime();
  return isNaN(d) ? 0 : d;
}

function getRowTimestamp(row: any): number {
  if (row.rawTimestamp) return extractTime(row.rawTimestamp);
  if (row.createdAt) return extractTime(row.createdAt);
  if (row.created_at) return extractTime(row.created_at);
  if (row.timestamp) return extractTime(row.timestamp);
  if (row.joined) return extractTime(row.joined);
  if (row.date) return extractTime(row.date);
  return 0;
}

function getRowLocation(row: any): string {
  if (row.location && typeof row.location === "string" && row.location !== "—") return row.location;
  
  const parts: string[] = [];
  if (row.village && row.village !== "—") parts.push(getLocalizedText(row.village));
  if (row.district && row.district !== "—") parts.push(getLocalizedText(row.district));
  if (row.city && row.city !== "—" && !parts.includes(getLocalizedText(row.city))) parts.push(getLocalizedText(row.city));
  if (row.state && row.state !== "—" && !parts.includes(getLocalizedText(row.state))) parts.push(getLocalizedText(row.state));
  if (row.clinicState && row.clinicState !== "—") parts.push(getLocalizedText(row.clinicState));
  if (row.address && typeof row.address === "string" && row.address !== "—") parts.push(getLocalizedText(row.address));

  return parts.length > 0 ? parts.join(", ") : "—";
}

function extractRowState(row: any): string {
  if (!row) return "";
  const s =
    row.state ||
    row.stateName ||
    row.stateCode ||
    row.shippingAddress?.state ||
    row.shippingAddress?.stateCode ||
    row.rawOrder?.shippingAddress?.state ||
    row.rawOrder?.shippingAddress?.stateCode ||
    row.deliveryAddress?.state ||
    row.address?.state ||
    row.clinicState ||
    row.farmerState ||
    row.farms?.state ||
    row.farmer?.state ||
    row.seller?.state ||
    row.veterinarian?.state ||
    row.raw?.state ||
    (row.buyerAddress && typeof row.buyerAddress === "string" ? row.buyerAddress : "") ||
    (row.location && typeof row.location === "string" ? row.location.split(",").pop() : "") ||
    "";
  const clean = getLocalizedText(s).trim();
  return clean === "—" ? "" : clean;
}

function extractRowName(row: any): string {
  if (!row) return "";
  const n =
    row.name ||
    row.displayName ||
    row.title ||
    row.fullName ||
    row.farmerName ||
    row.shopName ||
    row.doctorName ||
    row.buyerName ||
    row.sellerName ||
    row.breed ||
    "";
  const clean = getLocalizedText(n).trim();
  return clean === "—" ? "" : clean;
}

const MONTHS = [
  { value: "all", label: "All Months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export function DataPage<T extends Record<string, any>>({
  title,
  description,
  data,
  columns,
  statusKey = "status",
  filters = [],
  statusOptions,
  kpis,
  stats,
  searchPlaceholder = "Search...",
  searchKeys,
  primaryAction,
  onPrimaryAction,
  rowHref,
  isLoading = false,
  isFetchingBalance = false,
  exportFilename,
  onExport,
  customExportColumns,
  locationOptions,
  hideStatusFilter = false,
}: {
  title: string;
  description?: string;
  data: T[];
  columns: Column<T>[];
  statusKey?: string;
  filters?: string[];
  statusOptions?: string[];
  kpis?: KPI[];
  stats?: KPI[];
  searchPlaceholder?: string;
  searchKeys?: string[];
  primaryAction?: ReactNode;
  onPrimaryAction?: () => void;
  rowHref?: (row: T) => string | undefined;
  isLoading?: boolean;
  isFetchingBalance?: boolean;
  exportFilename?: string;
  onExport?: (exportData: T[]) => void;
  customExportColumns?: CsvColumn<T>[];
  locationOptions?: string[];
  hideStatusFilter?: boolean;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedState, setSelectedState] = useState("all");
  const [stateSearch, setStateSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "state-asc" | "state-desc" | "loc-asc" | "loc-desc" | "name-asc" | "name-desc">("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(100);

  useEffect(() => {
    setCurrentPage(1);
  }, [q, filter, selectedYear, selectedMonth, startDate, endDate, selectedState, locationFilter, sortBy]);

  const effectiveKpis = kpis || stats;
  const effectiveFilters = (statusOptions && statusOptions.length > 0) ? statusOptions : filters;

  const MONTHS = [
    { value: "all", label: "All Months" },
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  // Dynamic Year options
  const detectedYears = useMemo(() => {
    const set = new Set<string>();
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 3; y--) {
      set.add(String(y));
    }
    data.forEach((row) => {
      const ts = getRowTimestamp(row);
      if (ts > 0) {
        const y = new Date(ts).getFullYear();
        if (!isNaN(y)) set.add(String(y));
      }
    });
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [data]);

  // Compute min & max bounds for Date Picker based on selected Year & Month
  const dateMinMax = useMemo(() => {
    let min: string | undefined = undefined;
    let max: string | undefined = undefined;

    const yr = selectedYear !== "all" ? Number(selectedYear) : new Date().getFullYear();

    if (selectedYear !== "all" && selectedMonth !== "all") {
      const mo = Number(selectedMonth);
      const mStr = mo < 10 ? `0${mo}` : `${mo}`;
      const lastDay = new Date(yr, mo, 0).getDate();
      const lStr = lastDay < 10 ? `0${lastDay}` : `${lastDay}`;
      min = `${yr}-${mStr}-01`;
      max = `${yr}-${mStr}-${lStr}`;
    } else if (selectedYear !== "all") {
      min = `${yr}-01-01`;
      max = `${yr}-12-31`;
    } else if (selectedMonth !== "all") {
      const mo = Number(selectedMonth);
      const mStr = mo < 10 ? `0${mo}` : `${mo}`;
      const lastDay = new Date(yr, mo, 0).getDate();
      const lStr = lastDay < 10 ? `0${lastDay}` : `${lastDay}`;
      min = `${yr}-${mStr}-01`;
      max = `${yr}-${mStr}-${lStr}`;
    }

    return { min, max };
  }, [selectedYear, selectedMonth]);

  // Reset date range if it lies outside the newly selected Year/Month range
  useEffect(() => {
    if (startDate && (dateMinMax.min || dateMinMax.max)) {
      if (dateMinMax.min && startDate < dateMinMax.min) {
        setStartDate("");
      } else if (dateMinMax.max && startDate > dateMinMax.max) {
        setStartDate("");
      }
    }
    if (endDate && (dateMinMax.min || dateMinMax.max)) {
      if (dateMinMax.min && endDate < dateMinMax.min) {
        setEndDate("");
      } else if (dateMinMax.max && endDate > dateMinMax.max) {
        setEndDate("");
      }
    }
  }, [selectedYear, selectedMonth, dateMinMax, startDate, endDate]);

  const ALL_INDIAN_STATES = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Delhi",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
  ];

  // Dedicated States list (Indian States + any states in data)
  const detectedStates = useMemo(() => {
    const set = new Set<string>();
    data.forEach((row) => {
      const s = extractRowState(row);
      if (s && s !== "—") set.add(s);
      if (row.state && row.state !== "—") set.add(getLocalizedText(row.state));
      if (row.clinicState && row.clinicState !== "—") set.add(getLocalizedText(row.clinicState));
    });
    ALL_INDIAN_STATES.forEach((st) => set.add(st));
    return Array.from(set).sort();
  }, [data]);

  // Search filtered states for State Select Dropdown
  const filteredStateOptions = useMemo(() => {
    if (!stateSearch.trim()) return detectedStates;
    const clean = stateSearch.toLowerCase().trim();
    return detectedStates.filter((st) => st.toLowerCase().includes(clean));
  }, [detectedStates, stateSearch]);

  // Extract unique city/district locations from data
  const detectedLocations = useMemo(() => {
    if (locationOptions && locationOptions.length > 0) return locationOptions;
    const set = new Set<string>();
    
    data.forEach((row) => {
      if (row.district && row.district !== "—") set.add(getLocalizedText(row.district));
      if (row.city && row.city !== "—") set.add(getLocalizedText(row.city));
      if (row.village && row.village !== "—") set.add(getLocalizedText(row.village));
      const loc = getRowLocation(row);
      if (loc && loc !== "—") set.add(loc);
    });

    return Array.from(set).sort();
  }, [data, locationOptions]);

  // Filter city options based on locationSearch input
  const filteredLocationOptions = useMemo(() => {
    if (!locationSearch.trim()) return detectedLocations;
    const clean = locationSearch.toLowerCase().trim();
    return detectedLocations.filter((loc) =>
      loc.toLowerCase().includes(clean)
    );
  }, [detectedLocations, locationSearch]);

  const filteredAndSorted = useMemo(() => {
    let res = data.filter((row) => {
      // 1. Text Search across Email, Phone Number, UID, Auth details, Name, Location
      let matchQ = true;
      if (q) {
        const queryClean = q.toLowerCase().trim();
        const queryDigits = q.replace(/[^0-9]/g, "");

        const searchFields = [
          "email", "userEmail", "authEmail", "farmerEmail", "sellerEmail", "vetEmail", "emailAddress", "mail",
          "phone", "phoneNumber", "userPhone", "authPhone", "farmerPhone", "sellerPhone", "vetPhone", "buyerPhone",
          "uid", "id", "userId", "farmerId", "sellerId", "vetId", "orderId", "trackingId", "carrierName", "courierPartner", "invoiceNumber",
          "tagNo", "rfid", "cattleId", "breed", "species", "cattleName", "title",
          "sku", "sellerName", "shopName", "storeName", "productName",
          "name", "fullName", "ownerName", "doctorName", "displayName", "buyerName",
          "role", "roles", "status", "paymentStatus", "category",
          "village", "district", "city", "state", "location", "address", "buyerAddress"
        ];

        const isEmailQuery = queryClean.includes("@");
        const isPurePhoneQuery = !isEmailQuery && queryDigits.length >= 3 && queryClean.replace(/[^0-9+ -]/g, "").length === queryClean.length;

        if (isEmailQuery) {
          // Dedicated email search: ONLY search email properties to avoid false-positive matches
          const emailFields = [
            "email", "userEmail", "authEmail", "farmerEmail", "sellerEmail", "vetEmail", "emailAddress", "mail"
          ];
          matchQ = emailFields.some((field) => {
            const val = row[field];
            if (!val) return false;
            return String(val).toLowerCase().trim().includes(queryClean);
          });
        } else {
          matchQ = searchFields.some((field) => {
            const val = row[field];
            if (val === undefined || val === null) return false;
            const strVal = getLocalizedText(val).toLowerCase();
            if (strVal.includes(queryClean)) return true;

            // Digit matching for phone numbers only when searching numeric/phone strings
            if (isPurePhoneQuery && (field.toLowerCase().includes("phone") || field === "tagNo" || field === "rfid")) {
              const valDigits = strVal.replace(/[^0-9]/g, "");
              if (valDigits.includes(queryDigits)) return true;
            }
            return false;
          });

          // Check inside items array (e.g. for product orders)
          if (!matchQ && Array.isArray(row.items)) {
            matchQ = row.items.some((it: any) => {
              const itName = String(it.name || it.title || it.productName || it.id || "").toLowerCase();
              return itName.includes(queryClean);
            });
          }

          // Also check explicit searchKeys if provided
          if (!matchQ && searchKeys && searchKeys.length > 0) {
            matchQ = searchKeys.some((k) => {
              const val = row[k];
              if (!val) return false;
              const strVal = getLocalizedText(val).toLowerCase();
              if (strVal.includes(queryClean)) return true;
              if (isPurePhoneQuery && (k.toLowerCase().includes("phone") || k === "tagNo" || k === "rfid")) {
                const valDigits = strVal.replace(/[^0-9]/g, "");
                if (valDigits.includes(queryDigits)) return true;
              }
              return false;
            });
          }
        }
      }

      // 2. Status Filter
      const rowStatus = getLocalizedText(row[statusKey]).toLowerCase();
      const matchF = filter === "all" ? true : rowStatus === filter.toLowerCase();

      // 3. Cascading Date Filter (Year -> Month -> Date Range)
      const ts = getRowTimestamp(row);
      let matchDate = true;

      if (ts > 0) {
        const d = new Date(ts);
        const y = String(d.getFullYear());
        const m = String(d.getMonth() + 1);
        const mTwoDigit = d.getMonth() + 1 < 10 ? `0${d.getMonth() + 1}` : `${d.getMonth() + 1}`;
        const dTwoDigit = d.getDate() < 10 ? `0${d.getDate()}` : `${d.getDate()}`;
        const dateStr = `${y}-${mTwoDigit}-${dTwoDigit}`;

        if (startDate && dateStr < startDate) {
          matchDate = false;
        }
        if (endDate && dateStr > endDate) {
          matchDate = false;
        }

        if (selectedYear !== "all" && y !== selectedYear) {
          matchDate = false;
        }
        if (selectedMonth !== "all" && m !== selectedMonth) {
          matchDate = false;
        }
      } else {
        if (selectedYear !== "all" || selectedMonth !== "all" || startDate !== "" || endDate !== "") {
          matchDate = false;
        }
      }

      // 4. Dedicated State Filter
      const extractedState = extractRowState(row).toLowerCase();
      const rowState = getLocalizedText(row.state || row.clinicState || row.farmerState || "").toLowerCase();
      const rowLoc = getRowLocation(row).toLowerCase();
      const cleanSelectedState = selectedState.toLowerCase().trim();
      const matchState = selectedState === "all"
        ? true
        : (
            extractedState.includes(cleanSelectedState) ||
            rowState.includes(cleanSelectedState) ||
            rowLoc.includes(cleanSelectedState) ||
            (typeof row.buyerAddress === "string" && row.buyerAddress.toLowerCase().includes(cleanSelectedState)) ||
            (row.shippingAddress && JSON.stringify(row.shippingAddress).toLowerCase().includes(cleanSelectedState))
          );

      // 5. City / District Location Filter
      const matchLoc = locationFilter === "all"
        ? true
        : rowLoc.includes(locationFilter.toLowerCase());

      return matchQ && matchF && matchDate && matchState && matchLoc;
    });

    // Apply Sorting
    return res.sort((a, b) => {
      if (sortBy === "newest") {
        return getRowTimestamp(b) - getRowTimestamp(a);
      }
      if (sortBy === "oldest") {
        return getRowTimestamp(a) - getRowTimestamp(b);
      }
      if (sortBy === "state-asc") {
        const stateA = extractRowState(a);
        const stateB = extractRowState(b);
        if (!stateA && !stateB) return 0;
        if (!stateA) return 1;
        if (!stateB) return -1;
        return stateA.localeCompare(stateB);
      }
      if (sortBy === "state-desc") {
        const stateA = extractRowState(a);
        const stateB = extractRowState(b);
        if (!stateA && !stateB) return 0;
        if (!stateA) return 1;
        if (!stateB) return -1;
        return stateB.localeCompare(stateA);
      }
      if (sortBy === "loc-asc") {
        const locA = getRowLocation(a);
        const locB = getRowLocation(b);
        if ((!locA || locA === "—") && (!locB || locB === "—")) return 0;
        if (!locA || locA === "—") return 1;
        if (!locB || locB === "—") return -1;
        return locA.localeCompare(locB);
      }
      if (sortBy === "loc-desc") {
        const locA = getRowLocation(a);
        const locB = getRowLocation(b);
        if ((!locA || locA === "—") && (!locB || locB === "—")) return 0;
        if (!locA || locA === "—") return 1;
        if (!locB || locB === "—") return -1;
        return locB.localeCompare(locA);
      }
      if (sortBy === "name-asc") {
        const nameA = extractRowName(a);
        const nameB = extractRowName(b);
        if (!nameA && !nameB) return 0;
        if (!nameA) return 1;
        if (!nameB) return -1;
        return nameA.localeCompare(nameB);
      }
      if (sortBy === "name-desc") {
        const nameA = extractRowName(a);
        const nameB = extractRowName(b);
        if (!nameA && !nameB) return 0;
        if (!nameA) return 1;
        if (!nameB) return -1;
        return nameB.localeCompare(nameA);
      }
      return 0;
    });
  }, [data, q, filter, selectedYear, selectedMonth, startDate, endDate, selectedState, locationFilter, sortBy, statusKey, searchKeys]);

  const filtered = filteredAndSorted;
  const totalRecords = filtered.length;
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalRecords / (pageSize || 1)));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const displayedRows = useMemo(() => {
    if (pageSize === -1) return filtered;
    const start = (validCurrentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, validCurrentPage, pageSize]);

  const isAnyFilterActive =
    q !== "" ||
    filter !== "all" ||
    selectedYear !== "all" ||
    selectedMonth !== "all" ||
    startDate !== "" ||
    endDate !== "" ||
    selectedState !== "all" ||
    locationFilter !== "all";

  const handleResetFilters = () => {
    setQ("");
    setFilter("all");
    setSelectedYear("all");
    setSelectedMonth("all");
    setStartDate("");
    setEndDate("");
    setSelectedState("all");
    setStateSearch("");
    setLocationFilter("all");
    setLocationSearch("");
    setSortBy("newest");
    setCurrentPage(1);
  };

  const handleExport = () => {
    const exportData = filtered; // Strictly export filtered dataset

    if (onExport) {
      onExport(exportData);
      return;
    }

    const filename = exportFilename || title.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const exportCols: CsvColumn<T>[] = customExportColumns || columns
      .filter((c) => c.key !== "actions" && c.label !== "Actions")
      .map((c) => ({
        header: c.label,
        key: String(c.key),
        accessor: c.exportValue || ((row: T) => {
          if (c.key in row) return row[c.key as keyof T];
          return "";
        }),
      }));

    exportToCsv({
      filename: `${filename}_filtered_${new Date().toISOString().slice(0, 10)}`,
      data: exportData,
      columns: exportCols,
    });
    toast.success(`Successfully exported ${exportData.length} records to CSV!`);
  };

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 font-semibold text-xs bg-card hover:bg-muted"
              onClick={handleExport}
              disabled={isLoading || data.length === 0}
              title={`Download CSV containing ${filtered.length} filtered rows`}
            >
              <Download className="h-4 w-4 text-emerald-600" /> Export CSV ({filtered.length})
            </Button>
            {typeof primaryAction === "string" ? (
              primaryAction && onPrimaryAction ? (
                <Button size="sm" onClick={onPrimaryAction} className="gap-1.5 bg-gradient-to-br from-primary to-primary-glow">
                  <Plus className="h-4 w-4" /> {primaryAction}
                </Button>
              ) : null
            ) : (
              primaryAction
            )}
          </>
        }
      />

      {effectiveKpis && effectiveKpis.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {effectiveKpis.map((k) => (
            <Card key={k.label} className="p-4 rounded-2xl relative overflow-hidden">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {k.label}
              </div>
              {isLoading ? (
                <div className="h-8 w-24 bg-muted/70 rounded-lg mt-2 animate-pulse" />
              ) : (
                <div className="mt-1 text-2xl font-bold text-foreground">{k.value}</div>
              )}
              {(k.hint || k.change) && (
                <div className={`text-xs mt-1 ${k.change ? (k.up ? 'text-emerald-500 font-medium' : 'text-muted-foreground') : 'text-muted-foreground'}`}>
                  {k.change || k.hint}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card className="rounded-2xl overflow-hidden relative shadow-sm">
        {/* Animated Loading Bar Indicator */}
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary/20 overflow-hidden z-20">
            <div className="h-full bg-primary animate-pulse w-full" />
          </div>
        )}

        <div className="flex flex-col gap-3 p-4 border-b space-y-2 md:space-y-0">
          {/* Top Row: Search input + Live Filtered Count Badge + Clear Filters */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative min-w-0 md:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 text-xs"
                disabled={isLoading}
              />
            </div>

            {/* Live Filter Count Indicator Badge */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary font-semibold text-xs border border-primary/20 shadow-xs">
                <Layers className="h-3.5 w-3.5" />
                <span>Showing <b>{filtered.length}</b> of {data.length} records</span>
              </span>

              {isFetchingBalance && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium text-[11px] border border-amber-500/20 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                  Fetching remaining balance...
                </span>
              )}

              {isAnyFilterActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1 rounded-xl"
                  title="Clear all active filters"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Bottom Row: Filter Dropdowns (Date Presets, Year, Month, Specific Date, Location, Status, Sort) */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* 1. Year Selector */}
            <Select value={selectedYear} onValueChange={setSelectedYear} disabled={isLoading}>
              <SelectTrigger className="w-28 text-xs h-9">
                <CalendarDays className="h-3.5 w-3.5 mr-1 text-primary shrink-0" />
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {detectedYears.map((yr) => (
                  <SelectItem key={yr} value={yr}>
                    {yr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 2. Month Selector */}
            <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={isLoading}>
              <SelectTrigger className="w-32 text-xs h-9">
                <Calendar className="h-3.5 w-3.5 mr-1 text-indigo-500 shrink-0" />
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 3. Bounded Date Range Selector (From -> To, e.g. Day 1 to 13) */}
            <div className="relative flex items-center bg-background rounded-xl border border-input shadow-xs h-9 px-2 text-xs">
              <CalendarDays className="h-3.5 w-3.5 mr-1 text-primary shrink-0" />
              <span className="text-[10px] text-muted-foreground font-semibold mr-1">From:</span>
              <input
                type="date"
                min={dateMinMax.min}
                max={dateMinMax.max}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value && !endDate) setEndDate(e.target.value);
                }}
                className="bg-transparent text-xs font-medium border-0 focus:outline-none focus:ring-0 text-foreground cursor-pointer w-28"
                title={dateMinMax.min && dateMinMax.max ? `Select start date between ${dateMinMax.min} and ${dateMinMax.max}` : "Select start date"}
                disabled={isLoading}
              />
              <span className="text-[10px] text-muted-foreground font-semibold mx-1">To:</span>
              <input
                type="date"
                min={startDate || dateMinMax.min}
                max={dateMinMax.max}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-medium border-0 focus:outline-none focus:ring-0 text-foreground cursor-pointer w-28"
                title={dateMinMax.min && dateMinMax.max ? `Select end date between ${dateMinMax.min} and ${dateMinMax.max}` : "Select end date"}
                disabled={isLoading}
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="ml-1 text-muted-foreground hover:text-foreground text-xs font-bold p-0.5"
                  title="Clear date range"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 4. Dedicated Searchable State Filter Dropdown */}
            <Select value={selectedState} onValueChange={setSelectedState} disabled={isLoading}>
              <SelectTrigger className="w-36 text-xs h-9 font-medium">
                <MapPin className="h-3.5 w-3.5 mr-1 text-emerald-500 shrink-0" />
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent className="max-h-64 overflow-y-auto min-w-[200px]">
                <div className="p-2 border-b sticky top-0 bg-popover z-10">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search state..."
                      value={stateSearch}
                      onChange={(e) => setStateSearch(e.target.value)}
                      className="h-8 text-xs pl-8 pr-2"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                <SelectItem value="all">All States</SelectItem>
                {filteredStateOptions.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st}
                  </SelectItem>
                ))}
                {filteredStateOptions.length === 0 && (
                  <div className="p-3 text-xs text-muted-foreground text-center">
                    No matching state found
                  </div>
                )}
              </SelectContent>
            </Select>

            {/* 5. Searchable District / City Location Filter Dropdown */}
            {detectedLocations.length > 0 && (
              <Select value={locationFilter} onValueChange={setLocationFilter} disabled={isLoading}>
                <SelectTrigger className="w-40 text-xs h-9 font-medium">
                  <MapPin className="h-3.5 w-3.5 mr-1 text-teal-500 shrink-0" />
                  <SelectValue placeholder="City / District" />
                </SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto min-w-[220px]">
                  <div className="p-2 border-b sticky top-0 bg-popover z-10">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search city/district..."
                        value={locationSearch}
                        onChange={(e) => setLocationSearch(e.target.value)}
                        className="h-8 text-xs pl-8 pr-2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <SelectItem value="all">All Cities & Districts</SelectItem>
                  {filteredLocationOptions.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                  {filteredLocationOptions.length === 0 && (
                    <div className="p-3 text-xs text-muted-foreground text-center">
                      No matching city or district found
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}

            {/* 6. Status Filter */}
            {!hideStatusFilter && effectiveFilters.length > 0 && (
              <Select value={filter} onValueChange={setFilter} disabled={isLoading}>
                <SelectTrigger className="w-32 text-xs h-9">
                  <Filter className="h-3.5 w-3.5 mr-1 text-amber-500 shrink-0" />
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {effectiveFilters
                    .filter((f) => f.toLowerCase() !== "all" && f.toLowerCase() !== "all status")
                    .map((f) => (
                      <SelectItem key={f} value={f.toLowerCase()}>
                        {f}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            {/* 7. Sort By Dropdown */}
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)} disabled={isLoading}>
              <SelectTrigger className="w-40 text-xs h-9 font-medium ml-auto">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1 text-sky-500 shrink-0" />
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Sort: Newest First</SelectItem>
                <SelectItem value="oldest">Sort: Oldest First</SelectItem>
                <SelectItem value="state-asc">Sort: State (A to Z)</SelectItem>
                <SelectItem value="state-desc">Sort: State (Z to A)</SelectItem>
                <SelectItem value="loc-asc">Sort: City / District (A-Z)</SelectItem>
                <SelectItem value="loc-desc">Sort: City / District (Z-A)</SelectItem>
                <SelectItem value="name-asc">Sort: Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Sort: Name (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {columns.map((c) => (
                  <TableHead key={String(c.key)} className={c.className}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // 5 Shimmer Skeleton Rows
                Array.from({ length: 6 }).map((_, rIdx) => (
                  <TableRow key={rIdx} className="animate-pulse">
                    {columns.map((c, cIdx) => (
                      <TableCell key={cIdx} className={c.className}>
                        <div
                          className="h-5 bg-muted/60 rounded-md animate-pulse"
                          style={{
                            width: `${Math.max(40, 85 - (cIdx * 12 + rIdx * 7) % 45)}%`,
                          }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : displayedRows.length > 0 ? (
                displayedRows.map((row, i) => {
                  const href = rowHref?.(row);
                  return (
                    <TableRow
                      key={i}
                      className={href ? "cursor-pointer" : ""}
                      onClick={
                        href
                          ? (e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest("a,button,input,select,[role=button]")) return;
                              navigate({ to: href });
                            }
                          : undefined
                      }
                    >
                      {columns.map((c) => (
                        <TableCell key={String(c.key)} className={c.className}>
                          {c.render
                            ? c.render(row)
                            : c.key === statusKey
                            ? <StatusBadge status={getLocalizedText(row[c.key])} />
                            : getLocalizedText(row[c.key as keyof T])}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center text-muted-foreground py-12"
                  >
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <span className="text-sm font-medium">No results found</span>
                      <span className="text-xs text-muted-foreground">Try adjusting your search or filters</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* High Performance Batching & Pagination Footer Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t p-3.5 bg-muted/20 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {isLoading ? (
              <span className="inline-flex items-center gap-2 text-xs font-medium text-primary">
                <span className="h-2 w-2 rounded-full bg-primary animate-ping" /> Loading records...
              </span>
            ) : (
              <span>
                Showing{" "}
                <b className="text-foreground font-semibold">
                  {displayedRows.length === 0 ? 0 : pageSize === -1 ? 1 : (validCurrentPage - 1) * pageSize + 1}
                </b>{" "}
                to{" "}
                <b className="text-foreground font-semibold">
                  {pageSize === -1 ? totalRecords : Math.min(validCurrentPage * pageSize, totalRecords)}
                </b>{" "}
                of <b className="text-foreground font-semibold">{totalRecords.toLocaleString()}</b> filtered ({data.length.toLocaleString()} total)
              </span>
            )}

            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-muted-foreground font-medium hidden md:inline">Rows per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setCurrentPage(1);
                }}
                disabled={isLoading}
              >
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="250">250</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1000</SelectItem>
                  <SelectItem value="-1">All ({totalRecords})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Page Navigation Controls */}
          {pageSize !== -1 && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setCurrentPage(1)}
                disabled={isLoading || validCurrentPage === 1}
                title="First Page"
              >
                «
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={isLoading || validCurrentPage === 1}
              >
                Previous
              </Button>

              <span className="px-2 font-medium text-foreground text-xs">
                Page {validCurrentPage} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={isLoading || validCurrentPage >= totalPages}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setCurrentPage(totalPages)}
                disabled={isLoading || validCurrentPage >= totalPages}
                title="Last Page"
              >
                »
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
