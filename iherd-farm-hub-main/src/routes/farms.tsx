import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
  Building,
  Tractor,
  User,
  MapPin,
  Phone,
  Beef,
  Activity,
  Wrench,
  Compass,
  Stethoscope,
  Clock,
  Eye,
  ExternalLink,
  Maximize2,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpDown,
} from "lucide-react";
import { useFirebaseCollection, useFirebaseCollectionGroup } from "../hooks/useFirebaseData";
import { getLocalizedText } from "@/lib/utils";

export const Route = createFileRoute("/farms")({
  head: () => ({ meta: [{ title: "Registered Farms — iHerd Admin" }] }),
  component: FarmsPage,
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

function FarmsPage() {
  const [timeFilter, setTimeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [backendFarms, setBackendFarms] = useState<any[]>([]);
  const [backendLoading, setBackendLoading] = useState(true);

  const [selectedFarmDetail, setSelectedFarmDetail] = useState<any | null>(null);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Client Firebase collections
  const { data: groupFarms = [], isLoading: gfLoading } = useFirebaseCollectionGroup<any>("farms");
  const { data: directFarmers = [] } = useFirebaseCollection<any>("farmers");
  const { data: topFarms = [] } = useFirebaseCollection<any>("farms");
  const { data: usersList = [] } = useFirebaseCollection<any>("users");

  const API_BASE =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
    "http://localhost:5000";

  // Fetch backend data with multi-endpoint fallback
  const fetchData = async () => {
    try {
      setBackendLoading(true);
      const endpoints = [
        `${API_BASE}/api/admin/farms`,
        "http://localhost:5000/api/admin/farms",
        "/api/admin/farms",
      ];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep);
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.farms) && json.farms.length > 0) {
              setBackendFarms(json.farms);
              break;
            }
          }
        } catch {}
      }
    } catch (e) {
      console.warn("Could not fetch backend farms API:", e);
    } finally {
      setBackendLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Users Lookup Map for Farmer Profiles
  const usersLookup = useMemo(() => {
    const map = new Map<string, any>();
    usersList.forEach((u: any) => {
      if (u.id) map.set(u.id, u);
      if (u.uid) map.set(u.uid, u);
    });
    return map;
  }, [usersList]);

  // Aggregate Registered Farms
  const allFarms = useMemo(() => {
    const farmMap = new Map<string, any>();

    // 1. Process client Firestore collectionGroup `farms` (includes /users/{uid}/roles/farmer/farms)
    groupFarms.forEach((gf: any) => {
      const key = gf.farmId || gf.id;
      if (!key) return;
      const path = gf._path || "";
      const segments = path.split("/");
      let ownerUid = gf.ownerUid || gf.userId || "";
      if (!ownerUid && segments[0] === "users" && segments[1]) ownerUid = segments[1];
      else if (!ownerUid && segments[0] === "farmers" && segments[1]) ownerUid = segments[1];

      const ownerUser = usersLookup.get(ownerUid) || {};
      const ownerName = getLocalizedText(
        gf.ownerName || gf.farmerName || ownerUser.name || ownerUser.displayName,
        "Registered Farmer"
      );

      farmMap.set(key, {
        ...gf,
        id: key,
        farmId: key,
        name: getLocalizedText(gf.name || gf.farmName, "Registered Dairy Farm"),
        ownerName,
        ownerUid,
        farmPhoneNumber: getLocalizedText(gf.farmPhoneNumber || gf.phone || ownerUser.phone, "—"),
        animal: getLocalizedText(gf.animal, "Cow / Cattle"),
        farmTechnique: getLocalizedText(gf.farmTechnique, "Modern Dairy Management"),
        numberOfEmployees: getLocalizedText(gf.numberOfEmployees, "1 - 2 Workers"),
        numberOfAnimals: getLocalizedText(gf.numberOfAnimals || gf.cattleCount, "—"),
        farmEquipmentList: Array.isArray(gf.farmEquipmentList) ? gf.farmEquipmentList : [],
        village: getLocalizedText(gf.village || ownerUser.village, "—"),
        taluk: getLocalizedText(gf.taluk, "—"),
        district: getLocalizedText(gf.district || ownerUser.district, "—"),
        state: getLocalizedText(gf.state || ownerUser.state, "—"),
        pincode: getLocalizedText(gf.pincode || ownerUser.pincode, "—"),
        address: getLocalizedText(gf.address, "—"),
        latitude: gf.latitude || null,
        longitude: gf.longitude || null,
        veterinaryName: getLocalizedText(gf.veterinaryName, null as any),
        veterinarianPhoneNumber: getLocalizedText(gf.veterinarianPhoneNumber, null as any),
        imagePath: gf.imagePath || gf.imageUrl || null,
        sourcePath: path || "/farms",
        status: gf.status || "Active",
        createdAt: gf.createdAt || null,
      });
    });

    // 2. Process top-level `farms`
    topFarms.forEach((f: any) => {
      const key = f.farmId || f.id;
      if (!key || farmMap.has(key)) return;
      const ownerUid = f.ownerUid || f.userId || "";
      const ownerUser = usersLookup.get(ownerUid) || {};

      farmMap.set(key, {
        ...f,
        id: key,
        farmId: key,
        name: getLocalizedText(f.name || f.farmName, "Registered Dairy Farm"),
        ownerName: getLocalizedText(f.ownerName || f.farmerName || ownerUser.name, "Registered Farmer"),
        ownerUid,
        farmPhoneNumber: getLocalizedText(f.farmPhoneNumber || f.phone || ownerUser.phone, "—"),
        animal: getLocalizedText(f.animal, "Cow / Cattle"),
        farmTechnique: getLocalizedText(f.farmTechnique, "Modern Dairy Management"),
        numberOfEmployees: getLocalizedText(f.numberOfEmployees, "1 - 2 Workers"),
        numberOfAnimals: getLocalizedText(f.numberOfAnimals || f.cattleCount, "—"),
        farmEquipmentList: Array.isArray(f.farmEquipmentList) ? f.farmEquipmentList : [],
        village: getLocalizedText(f.village || ownerUser.village, "—"),
        taluk: getLocalizedText(f.taluk, "—"),
        district: getLocalizedText(f.district || ownerUser.district, "—"),
        state: getLocalizedText(f.state || ownerUser.state, "—"),
        pincode: getLocalizedText(f.pincode || ownerUser.pincode, "—"),
        address: getLocalizedText(f.address, "—"),
        latitude: f.latitude || null,
        longitude: f.longitude || null,
        veterinaryName: getLocalizedText(f.veterinaryName, null as any),
        veterinarianPhoneNumber: getLocalizedText(f.veterinarianPhoneNumber, null as any),
        imagePath: f.imagePath || f.imageUrl || null,
        sourcePath: "/farms",
        status: f.status || "Active",
        createdAt: f.createdAt || null,
      });
    });

    // 3. Process backend farms
    backendFarms.forEach((bf: any) => {
      const key = bf.id || bf.farmId;
      if (!key) return;
      const existing = farmMap.get(key) || {};
      farmMap.set(key, {
        ...existing,
        ...bf,
        id: key,
        farmId: key,
        name: getLocalizedText(bf.name || bf.farmName || existing.name, "Registered Dairy Farm"),
        ownerName: getLocalizedText(bf.ownerName || existing.ownerName, "Registered Farmer"),
        farmPhoneNumber: getLocalizedText(bf.farmPhoneNumber || bf.phone || existing.farmPhoneNumber, "—"),
        village: getLocalizedText(bf.village || existing.village, "—"),
        district: getLocalizedText(bf.district || existing.district, "—"),
        state: getLocalizedText(bf.state || existing.state, "—"),
        imagePath: bf.imagePath || existing.imagePath || null,
        status: bf.status || existing.status || "Active",
        createdAt: bf.createdAt || existing.createdAt || null,
      });
    });

    return Array.from(farmMap.values());
  }, [groupFarms, topFarms, directFarmers, backendFarms, usersLookup]);

  // Filtered and Sorted Farms
  const filteredFarms = useMemo(() => {
    return allFarms
      .filter((f) => isWithinTimeFilter(f.createdAt, timeFilter))
      .sort((a, b) => {
        const timeA = parseTime(a.createdAt);
        const timeB = parseTime(b.createdAt);
        return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
      });
  }, [allFarms, timeFilter, sortOrder]);

  const totalFarmsCount = allFarms.length;
  const activeFarmsCount = allFarms.filter((f) => (getLocalizedText(f.status) || "").toLowerCase() === "active" || !f.status).length;
  const equippedFacilitiesCount = allFarms.filter((f) => Array.isArray(f.farmEquipmentList) && f.farmEquipmentList.length > 0).length;
  const uniqueOwnersCount = new Set(allFarms.map((f) => f.ownerUid).filter(Boolean)).size;

  const isLoading = (gfLoading || backendLoading) && allFarms.length === 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-4 rounded-3xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Registered Farms Registry</h2>
            <p className="text-xs text-muted-foreground">
              Directly fetched from <code className="text-primary font-mono text-[11px]">/users/.../roles/farmer/farms</code>
            </p>
          </div>
        </div>

        {/* Action Button & Filters */}
        <div className="flex items-center flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="rounded-xl h-9 text-xs gap-1.5 border-dashed">
            <Link to="/cattle">
              <Beef className="h-3.5 w-3.5 text-primary" />
              <span>Go to Cattle Register</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>

          {/* Time Filter Dropdown */}
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

          {/* Sort Order Toggle */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
            className="rounded-xl h-9 text-xs gap-1.5 border-dashed"
            title="Toggle Sort Order"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{sortOrder === "newest" ? "Latest First" : "Oldest First"}</span>
          </Button>
        </div>
      </div>

      {/* REGISTERED FARMS DIRECTORY */}
      <DataPage
        title="Registered Farms Directory"
        description="Comprehensive directory of registered dairy farms, equipment setups, facility locations, and farmer owner contacts."
        exportFilename="iherd_registered_farms"
        isLoading={isLoading}
        customExportColumns={[
          { header: "Farm Name", accessor: (r) => r.name },
          { header: "Farm ID", accessor: (r) => r.farmId || r.id },
          { header: "Farmer / Owner Name", accessor: (r) => r.ownerName },
          { header: "Farmer UID", accessor: (r) => r.ownerUid },
          { header: "Farm Phone Number", accessor: (r) => r.farmPhoneNumber || "—" },
          { header: "Animal Type", accessor: (r) => r.animal || "Cow / Cattle" },
          { header: "Farm Management Technique", accessor: (r) => r.farmTechnique || "—" },
          { header: "Number of Employees", accessor: (r) => r.numberOfEmployees || "—" },
          { header: "Number of Animals", accessor: (r) => r.numberOfAnimals || "—" },
          { header: "Farm Equipment", accessor: (r) => Array.isArray(r.farmEquipmentList) ? r.farmEquipmentList.join("; ") : "—" },
          { header: "Village", accessor: (r) => r.village || "—" },
          { header: "Taluk", accessor: (r) => r.taluk || "—" },
          { header: "District", accessor: (r) => r.district || "—" },
          { header: "State", accessor: (r) => r.state || "—" },
          { header: "Pincode", accessor: (r) => r.pincode || "—" },
          { header: "Full Address", accessor: (r) => r.address || "—" },
          { header: "Latitude", accessor: (r) => r.latitude || "—" },
          { header: "Longitude", accessor: (r) => r.longitude || "—" },
          { header: "Veterinarian Doctor Name", accessor: (r) => r.veterinaryName || "—" },
          { header: "Veterinarian Doctor Phone", accessor: (r) => r.veterinarianPhoneNumber || "—" },
          { header: "Registration Date", accessor: (r) => r.createdAt ? formatDate(r.createdAt) : "—" },
          { header: "Farm Status", accessor: (r) => r.status || "Active" },
        ]}
        stats={[
          {
            label: "Total Registered Farms",
            value: isLoading ? "…" : String(totalFarmsCount),
            change: `${activeFarmsCount} active locations`,
            up: true,
          },
          {
            label: "Registered Farmers",
            value: isLoading ? "…" : String(uniqueOwnersCount),
            change: "Farm owners registered",
            up: true,
          },
          {
            label: "Equipped Facilities",
            value: isLoading ? "…" : String(equippedFacilitiesCount),
            change: "With modern tools",
            up: true,
          },
          {
            label: "Active Operations",
            value: isLoading ? "…" : String(activeFarmsCount),
            change: "Verified active",
            up: true,
          },
        ]}
        searchKeys={["name", "ownerName", "village", "district", "state", "farmPhoneNumber", "animal"]}
        searchPlaceholder="Search farms by name, owner, location, or equipment..."
        data={filteredFarms}
        columns={[
          {
            key: "name",
            label: "Farm Name & Photo",
            render: (r) => (
              <div className="flex items-center gap-3">
                {r.imagePath ? (
                  <div
                    className="relative h-10 w-10 rounded-2xl overflow-hidden border border-border/60 shadow-sm cursor-pointer shrink-0 hover:opacity-90"
                    onClick={() => setSelectedPreviewImage({ url: r.imagePath, title: r.name })}
                  >
                    <img src={r.imagePath} alt={r.name} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <Eye className="h-3 w-3 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                    <Building className="h-5 w-5" />
                  </div>
                )}
                <div className="space-y-0.5 min-w-0">
                  <div
                    className="font-bold text-xs text-foreground hover:text-primary transition-colors cursor-pointer truncate"
                    onClick={() => setSelectedFarmDetail(r)}
                  >
                    {r.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                    {r.sourcePath || "Registered Dairy Farm"}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "ownerName",
            label: "Farmer / Owner",
            render: (r) => (
              <div className="space-y-0.5">
                {r.ownerUid ? (
                  <Link
                    to="/users/$userId"
                    params={{ userId: r.ownerUid }}
                    search={{ tab: "farmer" } as any}
                    className="font-semibold text-xs text-foreground hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <User className="h-3 w-3 text-primary shrink-0" />
                    <span>{r.ownerName}</span>
                  </Link>
                ) : (
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1">
                    <User className="h-3 w-3 text-primary shrink-0" />
                    <span>{r.ownerName}</span>
                  </div>
                )}
                {r.farmPhoneNumber !== "—" && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span>{r.farmPhoneNumber}</span>
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "location",
            label: "Location",
            render: (r) => (
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1 font-medium text-foreground">
                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                  <span>{r.village !== "—" ? r.village : r.district}</span>
                </div>
                <div>
                  {r.state !== "—" ? r.state : "India"} {r.pincode !== "—" ? `(${r.pincode})` : ""}
                </div>
              </div>
            ),
          },
          {
            key: "animal",
            label: "Livestock & Tech",
            render: (r) => (
              <div className="space-y-0.5 text-xs">
                <div className="font-semibold text-foreground flex items-center gap-1">
                  <Beef className="h-3 w-3 text-primary" />
                  <span>{r.animal}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">{r.farmTechnique}</div>
              </div>
            ),
          },
          {
            key: "numberOfAnimals",
            label: "Animals & Workers",
            render: (r) => (
              <div className="space-y-0.5 text-xs">
                <div className="font-bold text-foreground">
                  {r.numberOfAnimals !== "—" ? `${r.numberOfAnimals} Animals` : "—"}
                </div>
                <div className="text-[11px] text-muted-foreground">{r.numberOfEmployees}</div>
              </div>
            ),
          },
          {
            key: "createdAt",
            label: "Registered Time",
            render: (r) => (
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1 font-medium text-foreground">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>{formatDate(r.createdAt)}</span>
                </div>
              </div>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r) => <StatusBadge status={r.status} />,
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
                  onClick={() => setSelectedFarmDetail(r)}
                  title="View full farm infrastructure and details"
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Full Data
                </Button>
                {r.ownerUid && (
                  <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl" title="Open Farmer Profile">
                    <Link to="/users/$userId" params={{ userId: r.ownerUid }} search={{ tab: "farmer" } as any}>
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

      {/* FULL FARM DETAIL MODAL */}
      <Dialog open={!!selectedFarmDetail} onOpenChange={(open) => !open && setSelectedFarmDetail(null)}>
        <DialogContent className="max-w-3xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Building className="h-6 w-6 text-primary" />
                <span>{selectedFarmDetail?.name || "Farm Details"}</span>
              </div>
              {selectedFarmDetail && <StatusBadge status={selectedFarmDetail.status || "Active"} />}
            </DialogTitle>
          </DialogHeader>

          {selectedFarmDetail && (
            <div className="space-y-6 mt-4">
              {/* Farm Photo Banner if available */}
              {selectedFarmDetail.imagePath && (
                <div
                  className="relative h-48 w-full rounded-2xl overflow-hidden border bg-muted cursor-pointer shadow-sm"
                  onClick={() => setSelectedPreviewImage({ url: selectedFarmDetail.imagePath, title: selectedFarmDetail.name })}
                >
                  <img src={selectedFarmDetail.imagePath} alt={selectedFarmDetail.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-4">
                    <span className="text-white text-xs font-semibold flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> Click to view full image
                    </span>
                  </div>
                </div>
              )}

              {/* Farm Specifications Grid */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tractor className="h-4 w-4 text-primary" /> Farm & Technical Infrastructure
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Farm Name</span>
                      <span className="font-semibold">{selectedFarmDetail.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Farm ID</span>
                      <span className="font-mono text-[11px]">{selectedFarmDetail.farmId}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Animal Type</span>
                      <span className="font-semibold">{selectedFarmDetail.animal}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Management Technique</span>
                      <span className="font-semibold">{selectedFarmDetail.farmTechnique}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Number of Employees</span>
                      <span className="font-semibold">{selectedFarmDetail.numberOfEmployees}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary" /> Location & Contact
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Farm Phone Number</span>
                      <span className="font-semibold text-primary">{selectedFarmDetail.farmPhoneNumber}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Village / Taluk</span>
                      <span className="font-semibold">{selectedFarmDetail.village} / {selectedFarmDetail.taluk}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">District & State</span>
                      <span className="font-semibold">{selectedFarmDetail.district}, {selectedFarmDetail.state} ({selectedFarmDetail.pincode})</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Address</span>
                      <span className="font-medium text-right max-w-[200px] truncate">{selectedFarmDetail.address}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Registered Time</span>
                      <span className="font-medium">{formatDate(selectedFarmDetail.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Equipment List */}
              {Array.isArray(selectedFarmDetail.farmEquipmentList) && selectedFarmDetail.farmEquipmentList.length > 0 && (
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-2">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Wrench className="h-4 w-4 text-primary" /> Registered Farm Equipment
                  </h4>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedFarmDetail.farmEquipmentList.map((eq: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-xl bg-background border text-xs font-medium text-foreground flex items-center gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        {eq.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Veterinary Doctor Info if assigned */}
              {selectedFarmDetail.veterinaryName && (
                <div className="p-4 rounded-2xl border bg-primary/5 border-primary/20 space-y-2">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Stethoscope className="h-4 w-4" /> Assigned Veterinarian Doctor
                  </h4>
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-foreground">{selectedFarmDetail.veterinaryName}</div>
                      <div className="text-muted-foreground">{selectedFarmDetail.veterinarianPhoneNumber || "No direct phone"}</div>
                    </div>
                    {selectedFarmDetail.veterinarianPhoneNumber && (
                      <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1 rounded-xl">
                        <a href={`tel:${selectedFarmDetail.veterinarianPhoneNumber}`}>
                          <Phone className="h-3 w-3" /> Call Doctor
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Owner Info & Profile Link */}
              {selectedFarmDetail.ownerUid && (
                <div className="flex items-center justify-between p-3.5 rounded-2xl border bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-foreground">{selectedFarmDetail.ownerName}</div>
                      <div className="text-xs text-muted-foreground">
                        Farmer ID: <span className="font-mono">{selectedFarmDetail.ownerUid.slice(0, 12)}...</span>
                      </div>
                    </div>
                  </div>
                  <Button asChild size="sm" className="gap-1.5 rounded-xl">
                    <Link to="/users/$userId" params={{ userId: selectedFarmDetail.ownerUid }} search={{ tab: "farmer" } as any}>
                      <User className="h-4 w-4" /> Open Farmer Profile
                    </Link>
                  </Button>
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
              {selectedPreviewImage?.title || "Farm Image Preview"}
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
