import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getApiBaseUrlSync } from "@/lib/apiClient";
import { DataPage } from "@/components/admin/DataPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Beef,
  Activity,
  User,
  MapPin,
  Phone,
  Clock,
  Eye,
  Maximize2,
  CheckCircle2,
  Calendar,
  ArrowUpDown,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  Milk,
  Code2,
  Layers,
  Sparkles,
  Camera,
} from "lucide-react";
import {
  useFirebaseCollection,
  useFirebaseCollectionGroup,
} from "../hooks/useFirebaseData";
import { getLocalizedText } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/cattle")({
  head: () => ({ meta: [{ title: "Cattle Details & Livestock Register — iHerd Admin" }] }),
  component: CattleDetailsPage,
});

function parseTime(val: any): number {
  if (!val) return 0;
  if (typeof val === "number") return val;
  if (val instanceof Date) return val.getTime();
  if (typeof val === "object" && (val._seconds || val.seconds)) {
    return (val._seconds || val.seconds) * 1000;
  }
  const d = new Date(val).getTime();
  return isNaN(d) ? 0 : d;
}

function formatDate(val: any): string {
  const ms = parseTime(val);
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractVal(obj: any, ...keys: string[]): any {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") {
      return obj[k];
    }
  }
  return undefined;
}

function parseNumericPrice(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (typeof val === "object") {
    if (val.amount !== undefined) return parseNumericPrice(val.amount);
    if (val.value !== undefined) return parseNumericPrice(val.value);
    if (val.price !== undefined) return parseNumericPrice(val.price);
    if (val.en !== undefined) return parseNumericPrice(val.en);
    for (const k of Object.keys(val)) {
      const p = parseNumericPrice(val[k]);
      if (p > 0) return p;
    }
    return 0;
  }
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function extractPriceFromDoc(item: any): number {
  if (!item) return 0;
  const candidates = [
    item.price,
    item.expectedPrice,
    item.expected_price,
    item.amount,
    item.expectedAmount,
    item.expected_amount,
    item.cattlePrice,
    item.cattle_price,
    item.sellingPrice,
    item.selling_price,
    item.salePrice,
    item.sale_price,
    item.rate,
    item.cost,
    item.value,
    item.marketValue,
    item.market_value,
    item.basePrice,
    item.base_price,
    item.pricing,
    item.priceDetails?.price,
    item.priceDetails?.amount,
    item.details?.price,
    item.details?.amount,
    item.marketplaceData?.price,
    item.cattleDetails?.price,
    item.data?.price,
    item.raw?.price,
  ];
  for (const c of candidates) {
    const p = parseNumericPrice(c);
    if (p > 0) return p;
  }
  return 0;
}

const TIME_FILTERS = [
  { label: "All Time", value: "all" },
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "Last 30 Days", value: "30days" },
  { label: "This Year", value: "year" },
];

function isWithinTimeFilter(timestamp: any, filter: string): boolean {
  if (filter === "all") return true;
  const ms = parseTime(timestamp);
  if (!ms) return false;

  const now = Date.now();
  const date = new Date(ms);
  const nowDate = new Date(now);

  if (filter === "today") {
    return (
      date.getDate() === nowDate.getDate() &&
      date.getMonth() === nowDate.getMonth() &&
      date.getFullYear() === nowDate.getFullYear()
    );
  }

  if (filter === "week") {
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    return ms >= oneWeekAgo && ms <= now;
  }

  if (filter === "month") {
    return (
      date.getMonth() === nowDate.getMonth() &&
      date.getFullYear() === nowDate.getFullYear()
    );
  }

  if (filter === "30days") {
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    return ms >= thirtyDaysAgo && ms <= now;
  }

  if (filter === "year") {
    return date.getFullYear() === nowDate.getFullYear();
  }

  return true;
}

function CattleDetailsPage() {
  const [timeFilter, setTimeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [backendCattle, setBackendCattle] = useState<any[]>([]);
  const [backendLoading, setBackendLoading] = useState(true);

  const [selectedCattleDetail, setSelectedCattleDetail] = useState<any | null>(null);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  // 1. Client Firebase: Nested subcollection cattles & cattle strictly from /users/{userId}/roles/farmer/farms/{farmId}/cattles/{cattleId}
  const { data: groupCattles = [], isLoading: gcLoading, refetch: refetchGroupCattles } =
    useFirebaseCollectionGroup<any>("cattles");
  const { data: groupCattleSingular = [], refetch: refetchGroupCattleSingular } =
    useFirebaseCollectionGroup<any>("cattle");

  // 2. User & Farm lookups for owner details enrichment
  const { data: usersList = [] } = useFirebaseCollection<any>("users");
  const { data: groupFarms = [] } = useFirebaseCollectionGroup<any>("farms");

  const API_BASE = getApiBaseUrlSync();

  // Fetch backend cattle data with automatic fallback
  const fetchData = async () => {
    try {
      setBackendLoading(true);
      let res = await fetch(`${API_BASE}/api/admin/cattle`).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`/api/admin/cattle`).catch(() => null);
      }
      if (res && res.ok) {
        const json = await res.json();
        if (Array.isArray(json.cattle) && json.cattle.length > 0) {
          setBackendCattle(json.cattle);
          return;
        }
      }

      // Fallback to generic collection-group endpoint
      const cgRes = await fetch(`${API_BASE}/api/admin/collection-group/cattles`).catch(() =>
        fetch(`/api/admin/collection-group/cattles`).catch(() => null)
      );
      if (cgRes && cgRes.ok) {
        const cgJson = await cgRes.json();
        if (Array.isArray(cgJson.data) && cgJson.data.length > 0) {
          setBackendCattle(cgJson.data);
        }
      }
    } catch (e) {
      console.warn("Could not fetch cattle data from backend:", e);
    } finally {
      setBackendLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    refetchGroupCattles();
    refetchGroupCattleSingular();
    fetchData();
    toast.success("Refreshed livestock records!");
  };

  // Build lookups for Users and Farms
  const usersLookup = useMemo(() => {
    const map = new Map<string, any>();
    usersList.forEach((u: any) => {
      if (u.id) map.set(u.id, u);
      if (u.uid) map.set(u.uid, u);
    });
    return map;
  }, [usersList]);

  const farmsLookup = useMemo(() => {
    const map = new Map<string, any>();
    groupFarms.forEach((f: any) => {
      if (f.id) map.set(f.id, f);
    });
    return map;
  }, [groupFarms]);

  // Map and unify all Cattle from:
  // 1. /users/{uid}/roles/farmer/farms/{farmId}/cattles/{cattleId} (collectionGroup)
  // 2. /cattle_details
  // 3. /cattle-marketplace
  // 4. Backend /api/admin/cattle
  const allCattle = useMemo(() => {
    const cattleMap = new Map<string, any>();

    const processItem = (c: any, sourceName: string) => {
      if (!c) return;

      // Extract document ID and path
      const docPath = c._path || c.path || "";
      const pathParts = docPath ? docPath.split("/") : [];

      let pathOwnerUid = "";
      let pathFarmId = "";
      const uIdx = pathParts.indexOf("users");
      if (uIdx !== -1 && uIdx + 1 < pathParts.length) {
        pathOwnerUid = pathParts[uIdx + 1];
      }
      const fIdx = pathParts.indexOf("farms");
      if (fIdx !== -1 && fIdx + 1 < pathParts.length) {
        pathFarmId = pathParts[fIdx + 1];
      }

      const tag = getLocalizedText(extractVal(c, "tagNo", "tagNumber", "earTagNo", "rfid"), "");
      const key = (tag && tag !== "—") ? tag : String(c.cattleId || c.id || docPath || "");
      if (!key) return;

      const ownerUid = getLocalizedText(
        c.ownerUid || c.userId || c.farmerId || c.sellerId || c.postedBy || pathOwnerUid,
        ""
      );
      const ownerUser = usersLookup.get(ownerUid) || {};

      const farmId = getLocalizedText(c.farmId || pathFarmId, "—");
      const farmInfo = farmsLookup.get(farmId) || {};
      const farmName = getLocalizedText(c.farmName || farmInfo.name || farmInfo.farmName, "—");

      const ownerName = getLocalizedText(
        c.ownerName ||
        c.farmerName ||
        c.sellerName ||
        c.name ||
        ownerUser.name ||
        ownerUser.displayName ||
        (ownerUid ? `Farmer (${ownerUid.slice(0, 8)}...)` : "iHerd Farmer"),
        "iHerd Farmer"
      );

      const ownerPhone = getLocalizedText(
        c.phone ||
        c.sellerPhone ||
        c.phoneNumber ||
        c.mobile ||
        ownerUser.phoneNumber ||
        ownerUser.phone,
        "—"
      );

      const titleRaw = extractVal(c, "cattleName", "name", "title", "breed", "tagNo");
      const title = getLocalizedText(
        typeof titleRaw === "object" ? (titleRaw.en || titleRaw.key || titleRaw.name) : titleRaw,
        tag ? `Cattle #${tag}` : "Dairy Cattle"
      );

      const breedRaw = extractVal(c, "breed", "breedName");
      const breed = getLocalizedText(
        typeof breedRaw === "object" ? (breedRaw.key || breedRaw.en || breedRaw.name) : breedRaw,
        "—"
      );

      const speciesRaw = extractVal(c, "species", "animalType", "type", "category");
      const species = getLocalizedText(
        typeof speciesRaw === "object" ? (speciesRaw.key || speciesRaw.en) : speciesRaw,
        "Cow"
      );

      const rfid = getLocalizedText(extractVal(c, "rfid", "rfidTag", "rfidNo", "tagNo", "tagNumber"), tag || key);
      const tagNo = tag || rfid || key;
      const gender = getLocalizedText(extractVal(c, "gender", "sex"), "Female");
      const color = getLocalizedText(extractVal(c, "color", "cattleColor"), "—");
      const age = getLocalizedText(extractVal(c, "age", "ageYears", "ageInMonths", "ageMonths"), "—");
      const weight = getLocalizedText(extractVal(c, "weight", "weightKg"), "—");
      const height = getLocalizedText(extractVal(c, "height", "heightCm", "heightFeet"), "—");
      const horns = getLocalizedText(extractVal(c, "horns", "hornType"), "—");
      const castrated = extractVal(c, "castrated", "isCastrated");

      // Production & Lactation
      const milkYield = getLocalizedText(extractVal(c, "milkYield", "dailyYield", "milkCapacity", "yield", "currentMilk"), "—");
      const peakMilkYield = getLocalizedText(extractVal(c, "peakMilkYield", "maxYield", "highestYield"), "—");
      const parity = getLocalizedText(extractVal(c, "parity", "lactation", "lactationNumber", "calvings", "calvingCount"), "—");
      const pregnant = extractVal(c, "pregnant", "isPregnant", "pregnancyStatus");
      const pregnancyMonth = getLocalizedText(extractVal(c, "pregnancyMonth", "pregnancyMonths", "gestationMonth"), "—");
      const lastCalvingDate = extractVal(c, "lastCalvingDate", "calvingDate");

      // Health, Lineage & Certification
      const healthStatus = getLocalizedText(extractVal(c, "healthStatus", "condition", "health", "fitness"), "Healthy");
      const vaccinated = Boolean(extractVal(c, "vaccinated", "isVaccinated") || c.vaccinationStatus === "Vaccinated");
      const dewormed = Boolean(extractVal(c, "dewormed", "isDewormed") || c.dewormingStatus === "Dewormed");
      const insurance = Boolean(extractVal(c, "insurance", "isInsured"));
      const insuranceNumber = getLocalizedText(extractVal(c, "insuranceNumber", "policyNumber", "insurancePolicyNo"), "—");
      const fatherTagNo = getLocalizedText(extractVal(c, "fatherTagNo", "sireTag", "fatherId"), "—");
      const motherTagNo = getLocalizedText(extractVal(c, "motherTagNo", "damTag", "motherId"), "—");

      // Price & Status
      const price = extractPriceFromDoc(c);
      const status = getLocalizedText(extractVal(c, "status", "listingStatus"), "Active");
      const description = getLocalizedText(extractVal(c, "description", "notes", "remarks", "about", "details"), "");

      // Location
      const village = getLocalizedText(extractVal(c, "village", "location", "city", "address", farmInfo.village, ownerUser.village), "—");
      const district = getLocalizedText(extractVal(c, "district", farmInfo.district, ownerUser.district), "—");
      const state = getLocalizedText(extractVal(c, "state", farmInfo.state, ownerUser.state), "—");
      const pincode = getLocalizedText(extractVal(c, "pincode", "zipCode", farmInfo.pincode, ownerUser.pincode), "—");

      // Multi-angle Camera Proofs
      const faceView = extractVal(c, "faceViewImagePath", "faceView", "face", "frontView", "front", "imageUrl", "image");
      const leftView = extractVal(c, "leftViewImagePath", "leftView", "left");
      const rightView = extractVal(c, "rightViewImagePath", "rightView", "right");
      const muzzleView = extractVal(c, "muzzleViewImagePath", "muzzleView", "muzzle");
      const udderView = extractVal(c, "udderViewImagePath", "udderView", "udder");
      const topView = extractVal(c, "topViewImagePath", "bottomView", "topView", "topview", "rearView", "backView");
      const farmerView = extractVal(c, "farmerViewImagePath", "farmerView", "farmerWithCattle");

      const images: string[] = Array.isArray(c.images) && c.images.length > 0
        ? c.images
        : Array.isArray(c.photos) && c.photos.length > 0
        ? c.photos
        : [faceView, leftView, rightView, muzzleView, udderView, topView, farmerView, c.imageUrl, c.image].filter(Boolean);

      const entry = {
        id: c.id || key,
        docId: c.id || key,
        cattleId: c.id || key,
        title,
        breed,
        species,
        rfid,
        tagNo,
        gender,
        color,
        age,
        weight,
        height,
        horns,
        castrated,
        milkYield,
        peakMilkYield,
        parity,
        pregnant,
        pregnancyMonth,
        lastCalvingDate,
        healthStatus,
        vaccinated,
        dewormed,
        insurance,
        insuranceNumber,
        fatherTagNo,
        motherTagNo,
        price,
        value: price > 0 ? `₹${price.toLocaleString()}` : "—",
        status,
        description,
        ownerName,
        ownerPhone,
        ownerUid,
        farmId,
        farmName,
        village,
        district,
        state,
        pincode,
        faceView,
        leftView,
        rightView,
        muzzleView,
        udderView,
        topView,
        farmerView,
        images,
        source: sourceName,
        _path: docPath,
        createdAt: c.createdAt || c.registeredAt || c.date || c.timestamp || null,
        raw: c,
      };

      if (!cattleMap.has(key)) {
        cattleMap.set(key, entry);
      } else {
        const existing = cattleMap.get(key);
        cattleMap.set(key, {
          ...existing,
          ...entry,
          milkYield: (entry.milkYield && entry.milkYield !== "—") ? entry.milkYield : existing.milkYield,
          parity: (entry.parity && entry.parity !== "—") ? entry.parity : existing.parity,
          insurance: entry.insurance || existing.insurance,
          farmName: (entry.farmName && entry.farmName !== "—") ? entry.farmName : existing.farmName,
          ownerName: existing.ownerName !== "iHerd Farmer" ? existing.ownerName : entry.ownerName,
          ownerPhone: existing.ownerPhone !== "—" ? existing.ownerPhone : entry.ownerPhone,
          village: existing.village !== "—" ? existing.village : entry.village,
          images: (existing.images && existing.images.length > 0) ? existing.images : entry.images,
          _path: existing._path || entry._path,
          raw: existing.raw || entry.raw,
        });
      }
    };

    // 1. Process nested farm cattles strictly: /users/{uid}/roles/farmer/farms/{farmId}/cattles/{cattleId}
    groupCattles.forEach((c) => processItem(c, "nested_farm_cattle"));
    groupCattleSingular.forEach((c) => processItem(c, "nested_farm_cattle"));

    // 2. Merge backend-enriched cattle
    backendCattle.forEach((bc) => {
      const tag = getLocalizedText(bc.tagNo || bc.rfid || "", "");
      const key = tag && tag !== "—" ? tag : (bc.id || bc.cattleId || bc.docId);
      if (!key) return;
      processItem(bc, bc.source || "nested_farm_cattle");
    });

    return Array.from(cattleMap.values());
  }, [groupCattles, groupCattleSingular, backendCattle, usersLookup, farmsLookup]);

  // Filtered and Sorted Cattle
  const filteredCattle = useMemo(() => {
    return allCattle
      .filter((c) => isWithinTimeFilter(c.createdAt, timeFilter))
      .sort((a, b) => {
        const timeA = parseTime(a.createdAt);
        const timeB = parseTime(b.createdAt);
        return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
      });
  }, [allCattle, timeFilter, sortOrder]);

  const totalCattleCount = allCattle.length;
  const highYieldCattleCount = allCattle.filter((c) => {
    const yieldNum = parseFloat(String(c.milkYield).replace(/[^0-9.]/g, ""));
    return !isNaN(yieldNum) && yieldNum >= 12;
  }).length;
  const insuredCount = allCattle.filter((c) => c.insurance).length;
  const uniqueOwnersCount = new Set(allCattle.map((c) => c.ownerUid).filter(Boolean)).size;

  const isLoading = (gcLoading || backendLoading) && allCattle.length === 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Time / Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-4 rounded-3xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Beef className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Cattle Details & Livestock Registry</h2>
            <p className="text-xs text-muted-foreground">
              Synced directly from farm subcollections <code className="text-primary font-mono text-[11px]">/users/.../farms/.../cattles</code>
            </p>
          </div>
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex items-center flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="rounded-xl h-9 text-xs gap-1.5 border-dashed">
            <Link to="/marketplace/cattle">
              <ShoppingBag className="h-3.5 w-3.5 text-primary" />
              <span>Go to Cattle Marketplace</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>

          {/* Time Filter */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-2" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="bg-transparent text-xs font-medium border-0 focus:ring-0 focus:outline-none pr-2 cursor-pointer text-foreground"
            >
              {TIME_FILTERS.map((tf) => (
                <option key={tf.value} value={tf.value} className="bg-popover text-popover-foreground">
                  {tf.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <DataPage
        title="Cattle Details Directory"
        description="Comprehensive animal specifications, RFID ear tags, verified camera proofs, daily milk yield, and owner information."
        exportFilename="iherd_cattle_details"
        customExportColumns={[
          { header: "Tag No / RFID", accessor: (r) => r.tagNo || r.rfid || r.id },
          { header: "Cattle ID", accessor: (r) => r.cattleId || r.id },
          { header: "Cattle Name / Title", accessor: "title" },
          { header: "Breed", accessor: "breed" },
          { header: "Species", accessor: "species" },
          { header: "Gender", accessor: "gender" },
          { header: "Age (Years)", accessor: "age" },
          { header: "Color", accessor: "color" },
          { header: "Weight (kg)", accessor: "weight" },
          { header: "Height", accessor: "height" },
          { header: "Daily Milk Yield (L/day)", accessor: "milkYield" },
          { header: "Parity / Lactation", accessor: "parity" },
          { header: "Market Value (INR)", accessor: (r) => r.price || r.value || 0 },
          { header: "Father Tag No", accessor: "fatherTagNo" },
          { header: "Mother Tag No", accessor: "motherTagNo" },
          { header: "Insured", accessor: (r) => r.insurance ? "Yes" : "No" },
          { header: "Owner Name", accessor: "ownerName" },
          { header: "Owner Phone", accessor: "ownerPhone" },
          { header: "Owner UID", accessor: "ownerUid" },
          { header: "Farm Name", accessor: "farmName" },
          { header: "Village", accessor: "village" },
          { header: "State", accessor: "state" },
          { header: "Registration Date", accessor: (r) => r.createdAt ? formatDate(r.createdAt) : "—" },
        ]}
        searchKeys={[
          "title",
          "breed",
          "tagNo",
          "rfid",
          "cattleId",
          "species",
          "ownerName",
          "ownerPhone",
          "state",
          "village",
          "farmName",
        ]}
        filters={["Insured", "High Yield (>12L)"]}
        statusKey="statusFilter"
        isLoading={isLoading}
        kpis={[
          { label: "Total Cattle Registered", value: isLoading ? "…" : totalCattleCount.toLocaleString() },
          { label: "High Yield Cattle (>12L)", value: isLoading ? "…" : highYieldCattleCount.toLocaleString() },
          { label: "Insured Livestock", value: isLoading ? "…" : insuredCount.toLocaleString() },
          { label: "Registered Owners", value: isLoading ? "…" : uniqueOwnersCount.toLocaleString() },
        ]}
        data={filteredCattle.map((c) => {
          const mainImg = c.faceView || c.leftView || (Array.isArray(c.images) && c.images[0]) || c.imageUrl || null;
          const yieldNum = parseFloat(String(c.milkYield).replace(/[^0-9.]/g, ""));
          const isHighYield = !isNaN(yieldNum) && yieldNum >= 12;

          let statusFilter = "All";
          if (c.insurance) statusFilter = "Insured";
          else if (isHighYield) statusFilter = "High Yield (>12L)";
          else if (c.status === "Active" || c.status === "On Sale") statusFilter = "Active";

          return {
            ...c,
            mainImg,
            statusFilter,
            formattedDate: formatDate(c.createdAt),
          };
        })}
        columns={[
          {
            key: "cattleName",
            label: "Cattle & Tag",
            render: (r) => (
              <div className="flex items-center gap-3">
                {r.mainImg ? (
                  <img
                    src={r.mainImg}
                    alt={r.title}
                    className="h-10 w-10 rounded-xl object-cover ring-1 ring-border/60 shrink-0 cursor-pointer hover:scale-105 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPreviewImage({ url: r.mainImg, title: `${r.title} - Front View` });
                    }}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Beef className="h-5 w-5" />
                  </div>
                )}
                <div className="space-y-0.5">
                  <div
                    className="font-bold text-sm text-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5"
                    onClick={() => setSelectedCattleDetail(r)}
                  >
                    <span>{r.title}</span>
                    {r.insurance && (
                      <span title="Insured Livestock" className="inline-flex">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    Tag: <span className="text-foreground font-semibold">{r.tagNo || r.rfid || "—"}</span>
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "species",
            label: "Species & Breed",
            render: (r) => (
              <div className="space-y-0.5 text-xs">
                <div className="font-semibold text-foreground">{r.breed}</div>
                <div className="text-muted-foreground">
                  {r.species} • {r.gender} {r.age !== "—" ? `(${r.age} yrs)` : ""}
                </div>
              </div>
            ),
          },
          {
            key: "milkYield",
            label: "Daily Yield",
            render: (r) => (
              <div className="space-y-0.5 text-xs">
                <div className="font-bold text-foreground flex items-center gap-1">
                  <Milk className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span>{r.milkYield !== "—" ? `${r.milkYield} L/day` : "—"}</span>
                </div>
                {r.parity && r.parity !== "—" && (
                  <div className="text-[10px] text-muted-foreground">Lactation: {r.parity}</div>
                )}
              </div>
            ),
          },
          {
            key: "ownerName",
            label: "Farmer / Farm",
            render: (r) => (
              <div className="space-y-0.5 text-xs">
                <div className="font-medium text-foreground flex items-center gap-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span>{r.ownerName}</span>
                </div>
                {r.farmName !== "—" && (
                  <div className="text-[11px] text-muted-foreground">Farm: {r.farmName}</div>
                )}
                {r.village !== "—" && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span>{r.village}, {r.state}</span>
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "insurance",
            label: "Insurance",
            render: (r) => (
              <div>
                {r.insurance ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" /> Insured
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">No Policy</span>
                )}
              </div>
            ),
          },
          {
            key: "createdAt",
            label: "Registered",
            render: (r) => (
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span>{r.formattedDate}</span>
                </div>
                <div className="text-[10px] font-mono text-primary/80 truncate max-w-[130px]" title={r._path || r.source}>
                  {r.source === "farm_cattles" ? "Farm Cattle" : r.source}
                </div>
              </div>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            render: (r) => (
              <div className="flex items-center gap-1.5 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1 rounded-xl bg-background/50 hover:bg-primary/10 hover:text-primary transition-colors"
                  onClick={() => setSelectedCattleDetail(r)}
                  title="View full specs, RFID & camera proofs"
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Full Data
                </Button>
                {r.ownerUid && (
                  <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl" title="Open Farmer Profile">
                    <Link to="/users/$userId" params={{ userId: r.ownerUid }} search={{ tab: "cattle" } as any}>
                      <User className="h-4 w-4 text-muted-foreground hover:text-primary" />
                    </Link>
                  </Button>
                )}
              </div>
            ),
            className: "text-right",
          },
        ]}
      />

      {/* FULL CATTLE DETAIL MODAL */}
      <Dialog open={!!selectedCattleDetail} onOpenChange={(open) => !open && setSelectedCattleDetail(null)}>
        <DialogContent className="max-w-4xl p-6 rounded-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary grid place-items-center">
                  <Beef className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-extrabold text-foreground">{selectedCattleDetail?.title || "Cattle Details"}</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    Path: <span className="font-mono text-primary font-semibold">{selectedCattleDetail?._path || `cattle/${selectedCattleDetail?.id}`}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedCattleDetail?.tagNo && (
                  <span className="bg-muted text-foreground text-xs font-mono font-bold px-3 py-1 rounded-full border border-border/70">
                    Tag: {selectedCattleDetail.tagNo}
                  </span>
                )}
                {selectedCattleDetail?.rfid && selectedCattleDetail.rfid !== selectedCattleDetail.tagNo && (
                  <span className="bg-primary/10 text-primary text-xs font-mono font-bold px-3 py-1 rounded-full border border-primary/20">
                    RFID: {selectedCattleDetail.rfid}
                  </span>
                )}
                {selectedCattleDetail && <StatusBadge status={selectedCattleDetail.status || "Active"} />}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedCattleDetail && (
            <div className="space-y-6 pt-2">
              {/* Photo Proofs & Multi-Angle Views Grid */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Camera className="h-4 w-4 text-primary" /> Verified Camera Proofs & Perspectives
                  </span>
                  <span className="text-[11px] text-muted-foreground lowercase">Click any photo to enlarge</span>
                </h4>
                
                {(() => {
                  const proofList = [
                    { label: "Face View", url: selectedCattleDetail.faceView },
                    { label: "Left View", url: selectedCattleDetail.leftView },
                    { label: "Right View", url: selectedCattleDetail.rightView },
                    { label: "Muzzle View", url: selectedCattleDetail.muzzleView },
                    { label: "Udder View", url: selectedCattleDetail.udderView },
                    { label: "Top View", url: selectedCattleDetail.topView },
                    { label: "Farmer View", url: selectedCattleDetail.farmerView },
                    ...(Array.isArray(selectedCattleDetail.images)
                      ? selectedCattleDetail.images.map((img: string, idx: number) => ({
                          label: `Gallery Photo #${idx + 1}`,
                          url: img,
                        }))
                      : []),
                  ].filter(
                    (p, idx, self) => !!p.url && self.findIndex((t) => t.url === p.url) === idx
                  );

                  if (proofList.length === 0) {
                    return (
                      <div className="p-6 rounded-2xl bg-muted/30 border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                        No photos or camera proofs attached to this livestock profile.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {proofList.map((p, i) => (
                        <div
                          key={i}
                          className="group rounded-2xl overflow-hidden border border-border/60 bg-muted/40 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all flex flex-col"
                          onClick={() =>
                            setSelectedPreviewImage({
                              url: p.url,
                              title: `${selectedCattleDetail.title} — ${p.label}`,
                            })
                          }
                        >
                          <div className="h-28 bg-muted overflow-hidden relative">
                            <img
                              src={p.url}
                              alt={p.label}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1 text-xs font-semibold">
                              <Eye className="h-4 w-4" /> Zoom
                            </div>
                          </div>
                          <div className="p-2 text-center text-xs font-semibold bg-card border-t border-border/40 truncate">
                            {p.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Complete Specifications Grid */}
              <div className="space-y-3 bg-muted/20 p-5 rounded-2xl border border-border/50">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Beef className="h-4 w-4 text-primary" /> Physical & Breed Specifications
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Cattle Name / Breed:</span>
                    <strong className="text-foreground">{selectedCattleDetail.title}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Species / Animal Type:</span>
                    <strong className="text-foreground">{selectedCattleDetail.species || "Cow"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Breed:</span>
                    <strong className="text-foreground">{selectedCattleDetail.breed || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Tag / RFID Number:</span>
                    <strong className="font-mono text-foreground">{selectedCattleDetail.tagNo || selectedCattleDetail.rfid || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Gender:</span>
                    <strong className="text-foreground capitalize">{selectedCattleDetail.gender || "Female"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Color / Coat:</span>
                    <strong className="text-foreground">{selectedCattleDetail.color || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Age:</span>
                    <strong className="text-foreground">
                      {selectedCattleDetail.age !== "—" ? `${selectedCattleDetail.age} yrs` : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Weight & Height:</span>
                    <strong className="text-foreground">
                      {selectedCattleDetail.weight !== "—" ? `${selectedCattleDetail.weight} kg` : "—"} / {selectedCattleDetail.height !== "—" ? `${selectedCattleDetail.height} cm` : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Estimated Value:</span>
                    <strong className="text-primary font-black text-sm">
                      {selectedCattleDetail.price > 0 ? `₹${Number(selectedCattleDetail.price).toLocaleString()}` : "Market Listed"}
                    </strong>
                  </div>
                  {selectedCattleDetail.status && selectedCattleDetail.status.toLowerCase() !== "active" && (
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Registry Status:</span>
                      <strong className="text-foreground">{selectedCattleDetail.status}</strong>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Registration Date:</span>
                    <strong className="text-foreground">{formatDate(selectedCattleDetail.createdAt)}</strong>
                  </div>
                </div>
              </div>

              {/* Milking & Reproduction Records */}
              <div className="space-y-3 bg-muted/20 p-5 rounded-2xl border border-border/50">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Milk className="h-4 w-4 text-blue-500" /> Milking & Reproductive History
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Daily Milk Yield:</span>
                    <strong className="text-foreground font-bold text-sm text-blue-600">
                      {selectedCattleDetail.milkYield !== "—" ? `${selectedCattleDetail.milkYield} L/day` : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Parity:</span>
                    <strong className="text-foreground">{selectedCattleDetail.parity || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Pregnancy Status:</span>
                    <strong className="text-foreground">
                      {selectedCattleDetail.pregnant !== undefined && selectedCattleDetail.pregnant !== null
                        ? selectedCattleDetail.pregnant
                          ? `✅ Pregnant (${selectedCattleDetail.pregnancyMonth !== "—" ? `${selectedCattleDetail.pregnancyMonth} mo` : "Yes"})`
                          : "❌ Not Pregnant"
                        : "—"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Health, Insurance & Lineage */}
              <div className="space-y-3 bg-muted/20 p-5 rounded-2xl border border-border/50">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> Health, Pedigree & Insurance
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Health Condition:</span>
                    <strong className="text-foreground">{selectedCattleDetail.healthStatus || "Healthy"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Vaccinated & Dewormed:</span>
                    <strong className="text-foreground">
                      {selectedCattleDetail.vaccinated ? "✅ Vaccinated" : "No"} • {selectedCattleDetail.dewormed ? "✅ Dewormed" : "No"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Insurance Policy:</span>
                    <strong className="text-foreground">
                      {selectedCattleDetail.insurance ? `✅ Insured (${selectedCattleDetail.insuranceNumber})` : "Not Insured"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Sire & Dam Tags:</span>
                    <strong className="text-foreground">
                      Sire: {selectedCattleDetail.fatherTagNo} • Dam: {selectedCattleDetail.motherTagNo}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Description / Remarks */}
              {selectedCattleDetail.description && (
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 text-xs space-y-1">
                  <span className="text-muted-foreground font-semibold uppercase text-[11px] tracking-wider block">
                    Livestock Notes & Description
                  </span>
                  <p className="text-foreground whitespace-pre-line leading-relaxed">{selectedCattleDetail.description}</p>
                </div>
              )}

              {/* Farmer & Farm Location Card */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border/60 flex-wrap gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="h-11 w-11 rounded-full bg-primary/10 text-primary grid place-items-center text-base font-bold shrink-0">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-foreground flex items-center gap-2">
                      <span>{selectedCattleDetail.ownerName}</span>
                      {selectedCattleDetail.farmName !== "—" && (
                        <span className="text-xs text-muted-foreground font-medium">
                          ({selectedCattleDetail.farmName})
                        </span>
                      )}
                      {selectedCattleDetail.ownerUid && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">
                          UID: {selectedCattleDetail.ownerUid.slice(0, 10)}...
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5 flex-wrap">
                      {selectedCattleDetail.ownerPhone !== "—" && (
                        <a
                          href={`tel:${selectedCattleDetail.ownerPhone}`}
                          className="text-primary hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Phone className="h-3 w-3" /> {selectedCattleDetail.ownerPhone}
                        </a>
                      )}
                      {(selectedCattleDetail.village !== "—" || selectedCattleDetail.state !== "—") && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {selectedCattleDetail.village}, {selectedCattleDetail.state}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedCattleDetail.ownerUid && (
                    <Button asChild size="sm" className="gap-1.5 rounded-xl text-xs">
                      <Link
                        to="/users/$userId"
                        params={{ userId: selectedCattleDetail.ownerUid }}
                        search={{ tab: "cattle" } as any}
                      >
                        <User className="h-3.5 w-3.5" /> View Farmer Profile
                      </Link>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-xl text-xs"
                    onClick={() => setShowRawJson(!showRawJson)}
                  >
                    <Code2 className="h-3.5 w-3.5" /> {showRawJson ? "Hide JSON" : "Raw JSON"}
                  </Button>
                </div>
              </div>

              {/* Raw JSON viewer */}
              {showRawJson && (
                <div className="p-4 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-64 border border-border">
                  <div className="text-xs font-bold text-slate-300 mb-1 pb-1 border-b border-slate-800 flex items-center justify-between">
                    <span>Firestore Document Data ({selectedCattleDetail._path || selectedCattleDetail.id})</span>
                    <button
                      className="text-xs text-slate-400 hover:text-white"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(selectedCattleDetail.raw || selectedCattleDetail, null, 2));
                        toast.success("Copied raw JSON to clipboard!");
                      }}
                    >
                      Copy JSON
                    </button>
                  </div>
                  <pre>{JSON.stringify(selectedCattleDetail.raw || selectedCattleDetail, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* FULL PHOTO ZOOM MODAL */}
      <Dialog open={!!selectedPreviewImage} onOpenChange={(open) => !open && setSelectedPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-4 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold truncate">
              {selectedPreviewImage?.title || "Image Preview"}
            </DialogTitle>
          </DialogHeader>
          {selectedPreviewImage && (
            <div className="rounded-2xl overflow-hidden bg-black/90 flex items-center justify-center max-h-[75vh]">
              <img
                src={selectedPreviewImage.url}
                alt={selectedPreviewImage.title}
                className="max-h-[75vh] w-auto object-contain rounded-xl"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
