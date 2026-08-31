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
  Search,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { useFirebaseCollection, useFirebaseCollectionGroup } from "../hooks/useFirebaseData";
import { getLocalizedText } from "@/lib/utils";

export const Route = createFileRoute("/farms")({
  head: () => ({ meta: [{ title: "Registered Farms & Cattle — iHerd Admin" }] }),
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
  const [activeTab, setActiveTab] = useState<"farms" | "cattle">("farms");
  const [timeFilter, setTimeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [backendFarms, setBackendFarms] = useState<any[]>([]);
  const [backendCattle, setBackendCattle] = useState<any[]>([]);
  const [backendLoading, setBackendLoading] = useState(true);

  const [selectedFarmDetail, setSelectedFarmDetail] = useState<any | null>(null);
  const [selectedCattleDetail, setSelectedCattleDetail] = useState<any | null>(null);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Client Firebase collections (including collectionGroup for subcollection farms)
  const { data: groupFarms = [] } = useFirebaseCollectionGroup<any>("farms");
  const { data: directFarmers = [] } = useFirebaseCollection<any>("farmers");
  const { data: topFarms = [] } = useFirebaseCollection<any>("farms");
  const { data: cdList = [] } = useFirebaseCollection<any>("cattle_details");
  const { data: cmList = [] } = useFirebaseCollection<any>("cattle-marketplace");

  const API_BASE =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
    "http://localhost:5000";

  // Fetch backend data with multi-endpoint fallback
  const fetchData = async () => {
    try {
      setBackendLoading(true);
      const endpoints = [
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, ""),
        "https://iherdadminpanel.onrender.com",
      ].filter(Boolean) as string[];

      for (const base of endpoints) {
        try {
          const res = await fetch(`${base}/api/admin/farms`);
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.farms) && json.farms.length > 0) {
              setBackendFarms(json.farms);
              break;
            }
          }
        } catch {}
      }

      for (const base of endpoints) {
        try {
          const res = await fetch(`${base}/api/admin/cattle`);
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.cattle) && json.cattle.length > 0) {
              setBackendCattle(json.cattle);
              break;
            }
          }
        } catch {}
      }
    } catch (e) {
      console.warn("Could not fetch backend APIs, using client Firestore data:", e);
    } finally {
      setBackendLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 1. Map all Cattle from Firestore cattle_details and cattle-marketplace
  const allCattle = useMemo(() => {
    const cattleMap = new Map<string, any>();

    // Process Firestore `cattle_details`
    cdList.forEach((c: any) => {
      const key = c.cattleId || c.rfid || c.tagNo || c.id;
      if (!key) return;
      const faceImg = c.faceViewImagePath || c.faceView || (Array.isArray(c.images) && c.images[0]) || c.imageUrl || null;
      const leftImg = c.leftViewImagePath || c.leftView || (Array.isArray(c.images) && c.images[1]) || null;
      const rightImg = c.rightViewImagePath || c.rightView || (Array.isArray(c.images) && c.images[2]) || null;
      const muzzleImg = c.muzzleViewImagePath || c.muzzleView || null;
      const udderImg = c.udderViewImagePath || c.udderView || null;
      const topImg = c.topViewImagePath || c.bottomView || c.topview || null;
      const farmerImg = c.farmerViewImagePath || c.farmerView || null;

      const imgs = [faceImg, leftImg, rightImg, muzzleImg, udderImg, topImg, farmerImg].filter(Boolean);

      cattleMap.set(key, {
        ...c,
        id: key,
        cattleId: key,
        title: getLocalizedText(c.cattleName || c.name || c.title || (c.tagNo ? `Cattle #${c.tagNo}` : "Dairy Cattle")),
        breed: getLocalizedText(c.breed?.key || c.breed || "—"),
        species: getLocalizedText(c.species?.key || c.species || "Cow"),
        rfid: getLocalizedText(c.rfid || c.tagNo, key),
        tagNo: getLocalizedText(c.tagNo || c.rfid, key),
        gender: getLocalizedText(c.gender, "Female"),
        color: getLocalizedText(c.color, "—"),
        age: getLocalizedText(c.age, "—"),
        weight: getLocalizedText(c.weight, "—"),
        height: getLocalizedText(c.height, "—"),
        milkYield: getLocalizedText(c.milkYield || c.dailyYield, "—"),
        parity: getLocalizedText(c.parity || c.lactation, "—"),
        status: getLocalizedText(c.status, "Active"),
        price: Number(c.price || c.value || c.marketValue || 0),
        value: getLocalizedText(c.value || c.price, "—"),
        fatherTagNo: getLocalizedText(c.fatherTagNo, "—"),
        motherTagNo: getLocalizedText(c.motherTagNo, "—"),
        insurance: Boolean(c.insurance),
        ownerName: getLocalizedText(c.ownerName || c.farmerName || c.sellerName, "Farmer"),
        ownerPhone: getLocalizedText(c.phone || c.sellerPhone || c.phoneNumber, "—"),
        ownerUid: getLocalizedText(c.ownerUid || c.userId || c.farmerId, ""),
        farmId: getLocalizedText(c.farmId, "—"),
        farmName: getLocalizedText(c.farmName, "—"),
        village: getLocalizedText(c.village || c.district || c.location, "—"),
        state: getLocalizedText(c.state, "—"),
        faceView: faceImg,
        leftView: leftImg,
        rightView: rightImg,
        muzzleView: muzzleImg,
        udderView: udderImg,
        topView: topImg,
        farmerView: farmerImg,
        images: imgs,
        source: "cattle_details",
        createdAt: c.createdAt || c.registeredAt || c.date || null,
      });
    });

    // Merge `cattle-marketplace`
    cmList.forEach((c: any) => {
      const key = c.cattleId || c.rfid || c.tagNo || c.id;
      if (!key) return;
      const existing = cattleMap.get(key) || {};
      cattleMap.set(key, {
        ...existing,
        ...c,
        id: key,
        cattleId: key,
        title: getLocalizedText(c.title || c.cattleName || existing.title || (c.tagNo ? `Cattle #${c.tagNo}` : "Dairy Cattle")),
        breed: getLocalizedText(c.breed?.key || c.breed || existing.breed || "—"),
        species: getLocalizedText(c.species?.key || c.species || existing.species || "Cow"),
        rfid: getLocalizedText(c.rfid || c.tagNo || existing.rfid, key),
        tagNo: getLocalizedText(c.tagNo || existing.tagNo, key),
        gender: getLocalizedText(c.gender || existing.gender, "Female"),
        color: getLocalizedText(c.color || existing.color, "—"),
        age: getLocalizedText(c.age || existing.age, "—"),
        weight: getLocalizedText(c.weight || existing.weight, "—"),
        height: getLocalizedText(c.height || existing.height, "—"),
        status: getLocalizedText(c.status || existing.status, "Active"),
        price: Number(c.price || c.value || existing.price || 0),
        milkYield: getLocalizedText(c.milkYield || c.dailyYield || existing.milkYield, "—"),
        ownerName: getLocalizedText(c.sellerName || c.ownerName || existing.ownerName, "Farmer"),
        ownerPhone: getLocalizedText(c.phone || c.sellerPhone || existing.ownerPhone, "—"),
        ownerUid: getLocalizedText(c.sellerId || c.ownerUid || existing.ownerUid, ""),
        state: getLocalizedText(c.state || existing.state, "—"),
        village: getLocalizedText(c.village || existing.village, "—"),
        images: (c.images && Array.isArray(c.images) && c.images.length > 0) ? c.images : existing.images || [],
        createdAt: c.createdAt || existing.createdAt || null,
      });
    });

    // Merge backend cattle
    backendCattle.forEach((bc: any) => {
      const key = bc.id || bc.cattleId;
      if (!key) return;
      const existing = cattleMap.get(key) || {};
      cattleMap.set(key, {
        ...existing,
        ...bc,
        images: (bc.images && Array.isArray(bc.images) && bc.images.length > 0) ? bc.images : existing.images || [],
        createdAt: bc.createdAt || existing.createdAt || null,
      });
    });

    return Array.from(cattleMap.values());
  }, [cdList, cmList, backendCattle]);

  // Group cattle by owner and farm
  const cattleByOwner = useMemo(() => {
    const map = new Map<string, any[]>();
    allCattle.forEach((c) => {
      if (c.ownerUid) {
        if (!map.has(c.ownerUid)) map.set(c.ownerUid, []);
        map.get(c.ownerUid)!.push(c);
      }
      if (c.farmId && c.farmId !== "—") {
        if (!map.has(c.farmId)) map.set(c.farmId, []);
        map.get(c.farmId)!.push(c);
      }
    });
    return map;
  }, [allCattle]);

  // 2. Aggregate ONLY REAL Registered Farms
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

      const cattleList = cattleByOwner.get(key) || (ownerUid ? cattleByOwner.get(ownerUid) : []) || [];
      const calculatedCount = cattleList.length || Number(gf.numberOfAnimals || gf.cattleCount || 0);

      farmMap.set(key, {
        ...gf,
        id: key,
        farmId: key,
        name: getLocalizedText(gf.name || gf.farmName, "Registered Dairy Farm"),
        ownerName: getLocalizedText(gf.ownerName || gf.farmerName, "Registered Farmer"),
        ownerUid,
        farmPhoneNumber: getLocalizedText(gf.farmPhoneNumber || gf.phone, "—"),
        animal: getLocalizedText(gf.animal, "Cow / Cattle"),
        farmTechnique: getLocalizedText(gf.farmTechnique, "Modern Dairy Management"),
        numberOfEmployees: getLocalizedText(gf.numberOfEmployees, "1 - 2 Workers"),
        farmEquipmentList: Array.isArray(gf.farmEquipmentList) ? gf.farmEquipmentList : [],
        village: getLocalizedText(gf.village, "—"),
        taluk: getLocalizedText(gf.taluk, "—"),
        district: getLocalizedText(gf.district, "—"),
        state: getLocalizedText(gf.state, "—"),
        pincode: getLocalizedText(gf.pincode, "—"),
        address: getLocalizedText(gf.address, "—"),
        latitude: gf.latitude || null,
        longitude: gf.longitude || null,
        veterinaryName: getLocalizedText(gf.veterinaryName, null as any),
        veterinarianPhoneNumber: getLocalizedText(gf.veterinarianPhoneNumber, null as any),
        imagePath: gf.imagePath || gf.imageUrl || null,
        cattleCount: calculatedCount,
        cattleItems: cattleList,
        sourcePath: path || "/farms",
        status: gf.status || "Active",
        createdAt: gf.createdAt || null,
      });
    });

    // 2. Process client Firestore `farms`
    topFarms.forEach((f: any) => {
      const key = f.farmId || f.id;
      if (!key || farmMap.has(key)) return;
      const ownerUid = f.ownerUid || f.userId || "";
      const cattleList = cattleByOwner.get(key) || cattleByOwner.get(ownerUid) || [];
      const calculatedCount = cattleList.length || Number(f.numberOfAnimals || f.cattleCount || 0);

      farmMap.set(key, {
        ...f,
        id: key,
        farmId: key,
        name: getLocalizedText(f.name || f.farmName, "Registered Dairy Farm"),
        ownerName: getLocalizedText(f.ownerName || f.farmerName, "Registered Farmer"),
        ownerUid,
        farmPhoneNumber: getLocalizedText(f.farmPhoneNumber || f.phone, "—"),
        animal: getLocalizedText(f.animal, "Cow / Cattle"),
        farmTechnique: getLocalizedText(f.farmTechnique, "Modern Dairy Management"),
        numberOfEmployees: getLocalizedText(f.numberOfEmployees, "1 - 2 Workers"),
        farmEquipmentList: Array.isArray(f.farmEquipmentList) ? f.farmEquipmentList : [],
        village: getLocalizedText(f.village, "—"),
        taluk: getLocalizedText(f.taluk, "—"),
        district: getLocalizedText(f.district, "—"),
        state: getLocalizedText(f.state, "—"),
        pincode: getLocalizedText(f.pincode, "—"),
        address: getLocalizedText(f.address, "—"),
        latitude: f.latitude || null,
        longitude: f.longitude || null,
        veterinaryName: getLocalizedText(f.veterinaryName, null as any),
        veterinarianPhoneNumber: getLocalizedText(f.veterinarianPhoneNumber, null as any),
        imagePath: f.imagePath || f.imageUrl || null,
        cattleCount: calculatedCount,
        cattleItems: cattleList,
        sourcePath: "/farms",
        status: f.status || "Active",
        createdAt: f.createdAt || null,
      });
    });

    // 2. Process real farm objects in `directFarmers` collection
    directFarmers.forEach((df: any) => {
      const key = df.id || df.uid;
      if (!key) return;
      const farmObj = typeof df.farms === "object" && !Array.isArray(df.farms) ? df.farms : {};
      const hasFarm = Boolean(df.farmName || farmObj.name || farmObj.farmName || df.farmTechnique || farmObj.farmTechnique || (df.cattle && Number(df.cattle) > 0));

      if (hasFarm) {
        const farmId = `farmer-${key}`;
        const cattleList = cattleByOwner.get(key) || [];
        const calculatedCount = cattleList.length || Number(df.cattle || farmObj.cattle || 0);

        if (!farmMap.has(farmId)) {
          farmMap.set(farmId, {
            ...df,
            id: farmId,
            farmId: key,
            name: getLocalizedText(farmObj.name || df.farmName || `${df.name || "Farmer"}'s Dairy Farm`),
            ownerName: getLocalizedText(df.name, "Registered Farmer"),
            ownerUid: key,
            farmPhoneNumber: getLocalizedText(df.farmerPhoneNumber || df.phone, "—"),
            animal: getLocalizedText(farmObj.animal || df.animal, "Cow / Cattle"),
            farmTechnique: getLocalizedText(farmObj.farmTechnique || df.farmTechnique, "Modern Dairy Management"),
            numberOfEmployees: getLocalizedText(farmObj.numberOfEmployees, "1 - 2 Workers"),
            farmEquipmentList: Array.isArray(farmObj.farmEquipmentList) ? farmObj.farmEquipmentList : [],
            village: getLocalizedText(df.village || farmObj.village, "—"),
            taluk: getLocalizedText(df.taluk || farmObj.taluk, "—"),
            district: getLocalizedText(df.district || farmObj.district, "—"),
            state: getLocalizedText(df.state || farmObj.state, "—"),
            pincode: getLocalizedText(df.pincode || farmObj.pincode, "—"),
            address: getLocalizedText(df.address || farmObj.address, "—"),
            latitude: df.latitude || farmObj.latitude || null,
            longitude: df.longitude || farmObj.longitude || null,
            veterinaryName: getLocalizedText(df.veterinaryName || farmObj.veterinaryName, null as any),
            veterinarianPhoneNumber: getLocalizedText(df.veterinarianPhoneNumber || farmObj.veterinarianPhoneNumber, null as any),
            imagePath: df.imagePath || farmObj.imagePath || null,
            cattleCount: calculatedCount,
            cattleItems: cattleList,
            sourcePath: `/farmers/${key}`,
            status: df.status || "Active",
            createdAt: df.createdAt || null,
          });
        }
      }
    });

    // 3. Process backend farms (collectionGroup)
    backendFarms.forEach((bf: any) => {
      const key = bf.id || bf.farmId;
      if (!key) return;
      const ownerUid = bf.ownerUid || "";
      const cattleList = cattleByOwner.get(key) || cattleByOwner.get(ownerUid) || [];
      const existing = farmMap.get(key) || {};

      farmMap.set(key, {
        ...existing,
        ...bf,
        id: key,
        farmId: key,
        name: getLocalizedText(bf.name || existing.name, "Registered Dairy Farm"),
        ownerName: getLocalizedText(bf.ownerName || existing.ownerName, "Registered Farmer"),
        animal: getLocalizedText(bf.animal || existing.animal, "Cow / Cattle"),
        village: getLocalizedText(bf.village || existing.village, "—"),
        state: getLocalizedText(bf.state || existing.state, "—"),
        district: getLocalizedText(bf.district || existing.district, "—"),
        farmPhoneNumber: getLocalizedText(bf.farmPhoneNumber || existing.farmPhoneNumber, "—"),
        cattleCount: cattleList.length || bf.cattleCount || existing.cattleCount || 0,
        cattleItems: cattleList,
        createdAt: bf.createdAt || existing.createdAt || null,
      });
    });

    return Array.from(farmMap.values());
  }, [groupFarms, topFarms, directFarmers, backendFarms, cattleByOwner]);

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

  // Stats
  const totalFarmsCount = allFarms.length;
  const activeFarmsCount = allFarms.filter((f) => (getLocalizedText(f.status) || "").toLowerCase() === "active" || !f.status).length;
  const totalLivestockCount = allCattle.length;
  const highYieldCattleCount = allCattle.filter((c) => {
    const yieldNum = parseFloat(String(c.milkYield).replace(/[^0-9.]/g, ""));
    return !isNaN(yieldNum) && yieldNum >= 12;
  }).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-4 rounded-3xl border shadow-sm">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-2xl border w-fit">
          <Button
            size="sm"
            variant={activeTab === "farms" ? "default" : "ghost"}
            onClick={() => setActiveTab("farms")}
            className={`rounded-xl gap-2 text-xs font-semibold px-4 h-9 ${
              activeTab === "farms" ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building className="h-4 w-4" />
            <span>Registered Farms</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-primary-foreground/20 text-primary-foreground">
              {filteredFarms.length}
            </span>
          </Button>

          <Button
            size="sm"
            variant={activeTab === "cattle" ? "default" : "ghost"}
            onClick={() => setActiveTab("cattle")}
            className={`rounded-xl gap-2 text-xs font-semibold px-4 h-9 ${
              activeTab === "cattle" ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Beef className="h-4 w-4" />
            <span>Cattle & Livestock Details</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-primary-foreground/20 text-primary-foreground">
              {filteredCattle.length}
            </span>
          </Button>
        </div>

        {/* Filters & Sorting Controls */}
        <div className="flex items-center flex-wrap gap-2">
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

      {/* VIEW 1: REGISTERED FARMS DIRECTORY */}
      {activeTab === "farms" && (
        <DataPage
          title="Registered Farms"
          description="Verified dairy farms, equipment setups, facility locations, and livestock counts."
          exportFilename="iherd_registered_farms"
          customExportColumns={[
            { header: "Farm Name", accessor: (r) => r.name },
            { header: "Farm ID", accessor: (r) => r.farmId || r.id },
            { header: "Farmer / Owner Name", accessor: (r) => r.ownerName },
            { header: "Farmer UID", accessor: (r) => r.ownerUid },
            { header: "Farm Phone Number", accessor: (r) => r.farmPhoneNumber || "—" },
            { header: "Animal Type", accessor: (r) => r.animal || "Cow / Cattle" },
            { header: "Farm Management Technique", accessor: (r) => r.farmTechnique || "—" },
            { header: "Number of Employees", accessor: (r) => r.numberOfEmployees || "—" },
            { header: "Farm Equipment", accessor: (r) => Array.isArray(r.farmEquipmentList) ? r.farmEquipmentList.join("; ") : "—" },
            { header: "Village", accessor: (r) => r.village || "—" },
            { header: "Taluk", accessor: (r) => r.taluk || "—" },
            { header: "District", accessor: (r) => r.district || "—" },
            { header: "State", accessor: (r) => r.state || "—" },
            { header: "Pincode", accessor: (r) => r.pincode || "—" },
            { header: "Full Address", accessor: (r) => r.address || "—" },
            { header: "Latitude", accessor: (r) => r.latitude || "—" },
            { header: "Longitude", accessor: (r) => r.longitude || "—" },
            { header: "Livestock Cattle Count", accessor: (r) => r.cattleCount || 0 },
            { header: "Veterinarian Doctor Name", accessor: (r) => r.veterinaryName || "—" },
            { header: "Veterinarian Doctor Phone", accessor: (r) => r.veterinarianPhoneNumber || "—" },
            { header: "Registration Date", accessor: (r) => r.createdAt ? formatDate(r.createdAt) : "—" },
            { header: "Farm Status", accessor: (r) => r.status || "Active" },
          ]}
          stats={[
            {
              label: "Total Registered Farms",
              value: String(totalFarmsCount),
              change: `${activeFarmsCount} active locations`,
              up: true,
            },
            {
              label: "Tracked Livestock",
              value: String(totalLivestockCount),
              change: "Across all farms",
              up: true,
            },
            {
              label: "Equipped Facilities",
              value: String(allFarms.filter((f) => f.farmEquipmentList?.length > 0).length),
              change: "With modern tools",
              up: true,
            },
            {
              label: "Average Cattle / Farm",
              value: totalFarmsCount > 0 ? (totalLivestockCount / totalFarmsCount).toFixed(1) : "0",
              change: "Live average",
              up: true,
            },
          ]}
          searchKeys={["name", "ownerName", "village", "district", "state", "farmPhoneNumber", "animal"]}
          searchPlaceholder="Search farms by name, owner, location, or livestock..."
          statusOptions={["Active", "Pending", "Verified"]}
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
                    <div className="font-bold text-xs text-foreground truncate">{r.name}</div>
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
                  <Link
                    to="/users/$userId"
                    params={{ userId: r.ownerUid }}
                    search={{ tab: "farmer" } as any}
                    className="font-semibold text-xs text-foreground hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <User className="h-3 w-3 text-primary shrink-0" />
                    <span>{r.ownerName}</span>
                  </Link>
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
              key: "cattleCount",
              label: "Cattle Count",
              render: (r) => (
                <div className="space-y-0.5">
                  <div className="font-bold text-xs text-foreground flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono text-[11px]">
                      {r.cattleCount || (r.cattleItems ? r.cattleItems.length : 0)} Cattle
                    </span>
                  </div>
                  {r.cattleItems && r.cattleItems.length > 0 && (
                    <div className="text-[10px] text-emerald-600 font-medium">
                      ✓ {r.cattleItems.length} Linked from cattle_details
                    </div>
                  )}
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
                    className="h-8 text-xs gap-1 rounded-xl"
                    onClick={() => setSelectedFarmDetail(r)}
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
      )}

      {/* VIEW 2: CATTLE & LIVESTOCK DIRECTORY (FIRESTORE CATTLE_DETAILS) */}
      {activeTab === "cattle" && (
        <DataPage
          title="Cattle & Livestock Register"
          description="Live cattle records fetched directly from Firestore `cattle_details`, with tag numbers, milk yields, owner proofs, and photos."
          exportFilename="iherd_cattle_livestock"
          customExportColumns={[
            { header: "Tag No / RFID", accessor: (r) => r.tagNo || r.rfid || r.id },
            { header: "Cattle ID", accessor: (r) => r.cattleId || r.id },
            { header: "Cattle Title / Name", accessor: (r) => r.title },
            { header: "Breed", accessor: (r) => r.breed },
            { header: "Species", accessor: (r) => r.species },
            { header: "Gender", accessor: (r) => r.gender },
            { header: "Age (Years)", accessor: (r) => r.age },
            { header: "Color", accessor: (r) => r.color },
            { header: "Weight (kg)", accessor: (r) => r.weight },
            { header: "Height", accessor: (r) => r.height },
            { header: "Daily Milk Yield (L/day)", accessor: (r) => r.milkYield },
            { header: "Parity / Lactation", accessor: (r) => r.parity },
            { header: "Market Price / Value (INR)", accessor: (r) => r.price || r.value || 0 },
            { header: "Father Tag No", accessor: (r) => r.fatherTagNo || "—" },
            { header: "Mother Tag No", accessor: (r) => r.motherTagNo || "—" },
            { header: "Insured", accessor: (r) => r.insurance ? "Yes" : "No" },
            { header: "Owner Name", accessor: (r) => r.ownerName },
            { header: "Owner Phone", accessor: (r) => r.ownerPhone },
            { header: "Owner UID", accessor: (r) => r.ownerUid },
            { header: "Farm Name", accessor: (r) => r.farmName || "—" },
            { header: "Village / Location", accessor: (r) => r.village || "—" },
            { header: "State", accessor: (r) => r.state || "—" },
            { header: "Registration Date", accessor: (r) => r.createdAt ? formatDate(r.createdAt) : "—" },
            { header: "Status", accessor: (r) => r.status || "Active" },
          ]}
          stats={[
            {
              label: "Total Tracked Cattle",
              value: String(allCattle.length),
              change: "Live in cattle_details",
              up: true,
            },
            {
              label: "High Milk Yield (>12L)",
              value: String(highYieldCattleCount),
              change: "Peak dairy cows",
              up: true,
            },
            {
              label: "Insured Animals",
              value: String(allCattle.filter((c) => c.insurance).length),
              change: "With active cover",
              up: true,
            },
            {
              label: "Unique Owners",
              value: String(new Set(allCattle.map((c) => c.ownerUid).filter(Boolean)).size),
              change: "Registered farmers",
              up: true,
            },
          ]}
          searchKeys={["title", "breed", "rfid", "tagNo", "ownerName", "village", "state", "ownerPhone"]}
          searchPlaceholder="Search cattle by RFID, tag no, breed, owner name, or village..."
          statusOptions={["Active", "On Sale", "Verified", "Sold"]}
          data={filteredCattle}
          columns={[
            {
              key: "photo",
              label: "Photo & RFID",
              render: (r) => {
                const img = (r.images && r.images[0]) || r.faceView || r.imageUrl;
                return (
                  <div className="flex items-center gap-3">
                    {img ? (
                      <div
                        className="relative h-11 w-11 rounded-2xl overflow-hidden border shadow-sm cursor-pointer shrink-0 hover:opacity-90"
                        onClick={() => setSelectedPreviewImage({ url: img, title: `${r.title} (${r.rfid})` })}
                      >
                        <img src={img} alt={r.title} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Eye className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="h-11 w-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-base shrink-0 border border-amber-500/20">
                        🐄
                      </div>
                    )}
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-bold text-xs text-foreground truncate">{r.title}</div>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded border border-primary/20">
                          {r.rfid || r.tagNo || "TAG—"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              },
            },
            {
              key: "breed",
              label: "Breed & Species",
              render: (r) => (
                <div className="space-y-0.5 text-xs">
                  <div className="font-semibold text-foreground">{r.breed}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.species} • {r.gender} {r.age !== "—" ? `(${r.age} yrs)` : ""}
                  </div>
                </div>
              ),
            },
            {
              key: "milkYield",
              label: "Milk Yield & Specs",
              render: (r) => (
                <div className="space-y-0.5 text-xs">
                  <div className="font-bold text-primary flex items-center gap-1">
                    <span>{r.milkYield !== "—" ? `${r.milkYield} L/day` : "—"}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.weight !== "—" ? `${r.weight} kg` : ""} {r.parity !== "—" ? `• Lactation #${r.parity}` : ""}
                  </div>
                </div>
              ),
            },
            {
              key: "price",
              label: "Market Value",
              render: (r) => (
                <div className="space-y-0.5 text-xs">
                  <div className="font-bold text-foreground">
                    {r.price > 0 ? `₹${Number(r.price).toLocaleString()}` : "Market Listed"}
                  </div>
                  {r.insurance && (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Insured
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: "owner",
              label: "Farmer / Owner",
              render: (r) => (
                <div className="space-y-0.5 text-xs">
                  <Link
                    to="/users/$userId"
                    params={{ userId: r.ownerUid }}
                    search={{ tab: "cattle" } as any}
                    className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <User className="h-3 w-3 text-primary shrink-0" />
                    <span>{r.ownerName}</span>
                  </Link>
                  <div className="text-[11px] text-muted-foreground">
                    {r.ownerPhone} • {r.state !== "—" ? r.state : "India"}
                  </div>
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
                    className="h-8 text-xs gap-1 rounded-xl"
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
      )}

      {/* FULL FARM DETAIL MODAL */}
      <Dialog open={!!selectedFarmDetail} onOpenChange={(open) => !open && setSelectedFarmDetail(null)}>
        <DialogContent className="max-w-3xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Building className="h-6 w-6 text-primary" />
                <span>{selectedFarmDetail?.name || "Farm Details"}</span>
              </div>
              {selectedFarmDetail && (
                <StatusBadge status={selectedFarmDetail.status || "Active"} />
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedFarmDetail && (
            <div className="space-y-6 mt-4">
              {/* Photo Proof */}
              {selectedFarmDetail.imagePath && (
                <div className="relative rounded-2xl overflow-hidden border aspect-video max-h-56 bg-muted">
                  <img
                    src={selectedFarmDetail.imagePath}
                    alt={selectedFarmDetail.name}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setSelectedPreviewImage({ url: selectedFarmDetail.imagePath, title: selectedFarmDetail.name })}
                  />
                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1 rounded-lg flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" /> Click photo to inspect full size
                  </div>
                </div>
              )}

              {/* Grid 1: Basic Farm Details */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tractor className="h-4 w-4 text-primary" /> Farm Operations
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Animal Type</span>
                      <span className="font-semibold">{selectedFarmDetail.animal}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Technique</span>
                      <span className="font-semibold">{selectedFarmDetail.farmTechnique}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Workforce</span>
                      <span className="font-semibold">{selectedFarmDetail.numberOfEmployees}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Tracked Livestock</span>
                      <span className="font-bold text-primary">{selectedFarmDetail.cattleCount} Animals</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Registered Time</span>
                      <span className="font-medium">{formatDate(selectedFarmDetail.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary" /> Location & Coordinates
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Village</span>
                      <span className="font-semibold">{selectedFarmDetail.village}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Taluk / Post</span>
                      <span className="font-semibold">{selectedFarmDetail.taluk !== "—" ? selectedFarmDetail.taluk : selectedFarmDetail.postoffice}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">District & State</span>
                      <span className="font-semibold">{selectedFarmDetail.district}, {selectedFarmDetail.state}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Pincode</span>
                      <span className="font-semibold">{selectedFarmDetail.pincode}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Coordinates</span>
                      <span className="font-mono text-[11px]">{selectedFarmDetail.latitude ? `${selectedFarmDetail.latitude}, ${selectedFarmDetail.longitude}` : "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Farm Equipment Tags */}
              {Array.isArray(selectedFarmDetail.farmEquipmentList) && selectedFarmDetail.farmEquipmentList.length > 0 && (
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-2">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Wrench className="h-4 w-4 text-primary" /> Farm Facilities & Equipment
                  </h4>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedFarmDetail.farmEquipmentList.map((eq: string, i: number) => (
                      <span key={i} className="bg-background border text-xs px-2.5 py-1 rounded-xl font-medium shadow-2xs">
                        ✓ {eq}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Cattle from cattle_details */}
              <div className="p-4 rounded-2xl border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Beef className="h-4 w-4 text-primary" /> Cattle Registered in this Farm ({selectedFarmDetail.cattleItems?.length || 0})
                  </h4>
                  <span className="text-[11px] text-muted-foreground">Source: `cattle_details`</span>
                </div>

                {selectedFarmDetail.cattleItems && selectedFarmDetail.cattleItems.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                    {selectedFarmDetail.cattleItems.map((c: any, idx: number) => {
                      const img = (c.images && c.images[0]) || c.faceView || null;
                      return (
                        <div key={idx} className="p-2.5 rounded-xl border bg-muted/30 flex items-center justify-between gap-2.5 text-xs hover:bg-muted/60 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {img ? (
                              <img src={img} alt={c.title} className="h-9 w-9 rounded-lg object-cover border shrink-0" />
                            ) : (
                              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-xs shrink-0">
                                🐄
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-foreground truncate">{c.title || c.breed}</div>
                              <div className="text-[10px] text-muted-foreground font-mono truncate">RFID: {c.rfid || c.tagNo}</div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2 rounded-lg shrink-0"
                            onClick={() => setSelectedCattleDetail(c)}
                          >
                            Specs
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                    No individual cattle items found in `cattle_details` matching this farm's owner UID.
                  </div>
                )}
              </div>

              {/* Owner Profile Card */}
              {selectedFarmDetail.ownerUid && (
                <div className="flex items-center justify-between p-3.5 rounded-2xl border bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-foreground">{selectedFarmDetail.ownerName}</div>
                      <div className="text-xs text-muted-foreground">{selectedFarmDetail.farmPhoneNumber} • UID: {selectedFarmDetail.ownerUid}</div>
                    </div>
                  </div>
                  <Button asChild size="sm" className="gap-1.5 rounded-xl">
                    <Link to="/users/$userId" params={{ userId: selectedFarmDetail.ownerUid }} search={{ tab: "farmer" } as any}>
                      <User className="h-4 w-4" /> Open Full Profile
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* FULL CATTLE DETAIL MODAL */}
      <Dialog open={!!selectedCattleDetail} onOpenChange={(open) => !open && setSelectedCattleDetail(null)}>
        <DialogContent className="max-w-3xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Beef className="h-6 w-6 text-primary" />
                <span>{selectedCattleDetail?.title || "Cattle Details"}</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedCattleDetail?.rfid && (
                  <span className="bg-primary/10 text-primary text-xs font-mono font-bold px-3 py-1 rounded-full border border-primary/20">
                    RFID: {selectedCattleDetail.rfid}
                  </span>
                )}
                {selectedCattleDetail && <StatusBadge status={selectedCattleDetail.status || "Active"} />}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedCattleDetail && (
            <div className="space-y-6 mt-4">
              {/* Photo Views Carousel / Gallery */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-primary" /> Verified Camera Proofs & Perspectives
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Face View", url: selectedCattleDetail.faceView },
                    { label: "Left View", url: selectedCattleDetail.leftView },
                    { label: "Right View", url: selectedCattleDetail.rightView },
                    { label: "Muzzle View", url: selectedCattleDetail.muzzleView },
                    { label: "Udder View", url: selectedCattleDetail.udderView },
                    { label: "Top View", url: selectedCattleDetail.topView },
                    { label: "Farmer View", url: selectedCattleDetail.farmerView },
                  ]
                    .filter((v) => Boolean(v.url))
                    .map((view, i) => (
                      <div
                        key={i}
                        className="group relative rounded-2xl overflow-hidden border aspect-square bg-muted/30 cursor-pointer hover:border-primary transition-all"
                        onClick={() => setSelectedPreviewImage({ url: view.url, title: `${view.label} — ${selectedCattleDetail.title}` })}
                      >
                        <img src={view.url} alt={view.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-center">
                          <span className="text-[11px] font-semibold text-white">{view.label}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Animal Specifications */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Beef className="h-4 w-4 text-primary" /> Physical & Breed Specs
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Breed</span>
                      <span className="font-semibold">{selectedCattleDetail.breed}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Species & Gender</span>
                      <span className="font-semibold">{selectedCattleDetail.species} ({selectedCattleDetail.gender})</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Age & Color</span>
                      <span className="font-semibold">{selectedCattleDetail.age} yrs • {selectedCattleDetail.color}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Weight & Height</span>
                      <span className="font-semibold">{selectedCattleDetail.weight} kg • {selectedCattleDetail.height} cm</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Daily Milk Yield</span>
                      <span className="font-bold text-primary">{selectedCattleDetail.milkYield} L/day</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-primary" /> Registry & Value
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Estimated Value</span>
                      <span className="font-bold text-foreground">
                        {selectedCattleDetail.price > 0 ? `₹${Number(selectedCattleDetail.price).toLocaleString()}` : "Market Listed"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Insurance Status</span>
                      <span className={`font-semibold ${selectedCattleDetail.insurance ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {selectedCattleDetail.insurance ? "✓ Active Insurance" : "No Active Policy"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Sire / Father Tag</span>
                      <span className="font-mono">{selectedCattleDetail.fatherTagNo}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Dam / Mother Tag</span>
                      <span className="font-mono">{selectedCattleDetail.motherTagNo}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Registered Time</span>
                      <span className="font-medium">{formatDate(selectedCattleDetail.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Owner Info & Profile Link */}
              {selectedCattleDetail.ownerUid && (
                <div className="flex items-center justify-between p-3.5 rounded-2xl border bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-foreground">{selectedCattleDetail.ownerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedCattleDetail.ownerPhone} • {selectedCattleDetail.village}, {selectedCattleDetail.state}
                      </div>
                    </div>
                  </div>
                  <Button asChild size="sm" className="gap-1.5 rounded-xl">
                    <Link to="/users/$userId" params={{ userId: selectedCattleDetail.ownerUid }} search={{ tab: "cattle" } as any}>
                      <User className="h-4 w-4" /> Open Full Profile
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
