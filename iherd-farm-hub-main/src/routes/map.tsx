import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LeafletMap, TileLayerType, DEFAULT_INDIA_CENTER, DEFAULT_INDIA_ZOOM } from "@/components/admin/LeafletMap";
import { GeoEntity, resolveCoordinates, getHaversineDistanceKm } from "@/lib/geoUtils";
import { useFirebaseCollection, useFirebaseCollectionGroup } from "@/hooks/useFirebaseData";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { getApiBaseUrlSync, isLocalHostname } from "@/lib/apiClient";
import { getLocalizedText } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import {
  Users,
  User,
  Store,
  Stethoscope,
  Beef,
  Building,
  Tractor,
  Wrench,
  MapPin,
  Search,
  Navigation,
  Download,
  RefreshCw,
  Phone,
  ExternalLink,
  X,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Compass,
  Layers,
  Sparkles,
  Copy,
  ChevronDown,
  ChevronUp,
  FileJson,
} from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "Live Geo Map Explorer — iHerd Admin" }] }),
  component: LiveGeoMapPage,
});

type CategoryFilter = "all" | "farm" | "farmer" | "vet" | "seller" | "cattle";
type SortOption = "name_asc" | "name_desc" | "type" | "location" | "distance" | "gps_first";

function cleanLocationString(parts: any[]): string {
  return parts
    .filter(Boolean)
    .map((p) => getLocalizedText(p, ""))
    .filter((s) => s && s.trim() !== "" && s.trim() !== "—")
    .join(", ");
}

function LiveGeoMapPage() {
  // 1. Data Fetching Hooks
  const { data: authUsers = [], isLoading: authLoading } = useAdminUsers();
  const { data: firestoreUsers = [], isLoading: usersLoading } = useFirebaseCollection<any>("users");
  const { data: directFarmers = [], isLoading: farmersLoading } = useFirebaseCollection<any>("farmers");
  const { data: directVets = [], isLoading: vetsLoading } = useFirebaseCollection<any>("vets");
  const { data: directSellers = [], isLoading: sellersLoading } = useFirebaseCollection<any>("sellers");
  const { data: directCattle = [] } = useFirebaseCollection<any>("cattle_details");
  const { data: groupCattles = [] } = useFirebaseCollectionGroup<any>("cattles");
  const { data: groupFarms = [] } = useFirebaseCollectionGroup<any>("farms");
  const { data: topFarms = [] } = useFirebaseCollection<any>("farms");

  const [backendFarms, setBackendFarms] = useState<any[]>([]);
  const [backendCattle, setBackendCattle] = useState<any[]>([]);
  const [backendFarmers, setBackendFarmers] = useState<any[]>([]);
  const [backendVets, setBackendVets] = useState<any[]>([]);
  const [backendSellers, setBackendSellers] = useState<any[]>([]);
  const [backendUsers, setBackendUsers] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 2. Interactive Map & Filter States
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [sortOption, setSortOption] = useState<SortOption>("gps_first");
  const [tileLayer, setTileLayer] = useState<TileLayerType>("street");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Selection & Detail Modal States
  const [selectedEntity, setSelectedEntity] = useState<GeoEntity | null>(null);
  const [detailModalEntity, setDetailModalEntity] = useState<GeoEntity | null>(null);

  // Geolocation & Radius Filter
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [radiusFilterKm, setRadiusFilterKm] = useState<number>(0);
  const [isLocating, setIsLocating] = useState(false);

  // Fetch backend supplementary data
  const fetchBackendData = async () => {
    try {
      const primary = getApiBaseUrlSync();
      const endpoints = [
        primary,
        isLocalHostname() ? "http://localhost:5000" : null,
        isLocalHostname() ? "http://127.0.0.1:5000" : null,
        "https://iherdadminpanel.onrender.com",
      ].filter(Boolean) as string[];

      for (const base of endpoints) {
        try {
          const [fRes, cRes, farmerRes, vRes, sRes, uRes] = await Promise.all([
            fetch(`${base}/api/admin/farms`).catch(() => null),
            fetch(`${base}/api/admin/cattle`).catch(() => null),
            fetch(`${base}/api/admin/farmers`).catch(() => null),
            fetch(`${base}/api/admin/vets`).catch(() => null),
            fetch(`${base}/api/admin/sellers`).catch(() => null),
            fetch(`${base}/api/admin/users`).catch(() => null),
          ]);
          if (fRes && fRes.ok) {
            const fj = await fRes.json();
            if (Array.isArray(fj.farms)) setBackendFarms(fj.farms);
            else if (Array.isArray(fj)) setBackendFarms(fj);
          }
          if (cRes && cRes.ok) {
            const cj = await cRes.json();
            if (Array.isArray(cj.cattle)) setBackendCattle(cj.cattle);
            else if (Array.isArray(cj)) setBackendCattle(cj);
          }
          if (farmerRes && farmerRes.ok) {
            const farmerJson = await farmerRes.json();
            if (Array.isArray(farmerJson.farmers)) setBackendFarmers(farmerJson.farmers);
            else if (Array.isArray(farmerJson.data)) setBackendFarmers(farmerJson.data);
            else if (Array.isArray(farmerJson)) setBackendFarmers(farmerJson);
          }
          if (vRes && vRes.ok) {
            const vj = await vRes.json();
            if (Array.isArray(vj.vets)) setBackendVets(vj.vets);
            else if (Array.isArray(vj.data)) setBackendVets(vj.data);
            else if (Array.isArray(vj)) setBackendVets(vj);
          }
          if (sRes && sRes.ok) {
            const sj = await sRes.json();
            if (Array.isArray(sj.sellers)) setBackendSellers(sj.sellers);
            else if (Array.isArray(sj.data)) setBackendSellers(sj.data);
            else if (Array.isArray(sj)) setBackendSellers(sj);
          }
          if (uRes && uRes.ok) {
            const uj = await uRes.json();
            if (Array.isArray(uj.users)) setBackendUsers(uj.users);
            else if (Array.isArray(uj.data)) setBackendUsers(uj.data);
            else if (Array.isArray(uj)) setBackendUsers(uj);
          }
          break;
        } catch {}
      }
    } catch (e) {
      console.warn("Backend fetch failed in Map page:", e);
    }
  };

  useEffect(() => {
    fetchBackendData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchBackendData();
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Live geo coordinates & entity map refreshed!");
    }, 400);
  };

  // Get current user geolocation for proximity sorting and radius filtering
  const handleLocateMe = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        toast.success(`Position located: ${loc[0].toFixed(4)}, ${loc[1].toFixed(4)}`);
        setSortOption("distance");
      },
      (err) => {
        setIsLocating(false);
        console.warn("Geolocation error:", err);
        toast.error("Could not retrieve current location. Please grant browser permission.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 3. Consolidated GeoEntity Builder across Farms, Farmers, Vets, Sellers, and Cattle
  const allGeoEntities = useMemo<GeoEntity[]>(() => {
    const list: GeoEntity[] = [];
    const entityKeySet = new Set<string>();

    // Helper to safely add entity
    const addEntity = (entity: GeoEntity) => {
      const key = `${entity.type}_${entity.id}`;
      if (entityKeySet.has(key)) return;
      entityKeySet.add(key);
      list.push(entity);
    };

    // --- A. Process Registered Farms ---
    // 1. Backend Farms
    backendFarms.forEach((f: any) => {
      const id = f.farmId || f.id || f._id || `bfarm_${Math.random()}`;
      const name = getLocalizedText(f.name || f.farmName || f.ownerName || f.farmerName, "Registered Dairy Farm");
      const owner = getLocalizedText(f.ownerName || f.farmerName, "Farmer Owner");
      const phone = getLocalizedText(f.farmPhoneNumber || f.phone || f.phoneNumber, "");
      const locationText = cleanLocationString([f.village, f.taluk, f.district, f.state]);
      const coords = resolveCoordinates(f, `farm_${id}_${name}_${f.state || ""}`);
      const ownerUid = f.ownerUid || f.userId || "";

      if (coords) {
        addEntity({
          id: String(id),
          type: "farm",
          title: name,
          subtitle: `Owner: ${owner} • ${f.totalCattle || f.cattleCount || f.numberOfAnimals || 0} Cattle`,
          phone: phone || undefined,
          email: f.email || undefined,
          locationName: locationText || getLocalizedText(f.state, "India"),
          state: getLocalizedText(f.state, ""),
          district: getLocalizedText(f.district, ""),
          city: getLocalizedText(f.city || f.taluk, ""),
          village: getLocalizedText(f.village, ""),
          taluk: getLocalizedText(f.taluk, ""),
          latitude: coords.lat,
          longitude: coords.lng,
          isExactCoordinate: coords.isExact,
          badge: "Registered Farm",
          status: f.status || "Active",
          cattleCount: Number(f.totalCattle || f.cattleCount || 0),
          animal: getLocalizedText(f.animal, "Cow / Cattle"),
          farmTechnique: getLocalizedText(f.farmTechnique, "Modern Dairy Management"),
          numberOfEmployees: getLocalizedText(f.numberOfEmployees, "1 - 2 Workers"),
          numberOfAnimals: getLocalizedText(f.numberOfAnimals || f.cattleCount, "—"),
          farmEquipmentList: Array.isArray(f.farmEquipmentList) ? f.farmEquipmentList : [],
          veterinaryName: getLocalizedText(f.veterinaryName, undefined),
          veterinarianPhoneNumber: getLocalizedText(f.veterinarianPhoneNumber, undefined),
          ownerName: owner,
          ownerUid: ownerUid || undefined,
          userId: ownerUid || undefined,
          userLinkUrl: ownerUid ? `/users/${ownerUid}?tab=farmer` : undefined,
          image: f.imagePath || f.imageUrl,
          details: f,
          linkUrl: `/farms`,
          createdAt: f.createdAt ? new Date(f.createdAt).getTime() : undefined,
        });
      }
    });

    // 2. Group Farms & Top Farms
    [...groupFarms, ...topFarms].forEach((f: any) => {
      const id = f.id || f.farmId || f._path || `gfarm_${Math.random()}`;
      const name = getLocalizedText(f.name || f.farmName, "Registered Dairy Farm");
      const owner = getLocalizedText(f.ownerName || f.farmerName, "Registered Farmer");
      const phone = getLocalizedText(f.farmPhoneNumber || f.phone || f.phoneNumber, "");
      const locationText = cleanLocationString([f.village, f.taluk, f.district, f.state]);
      const coords = resolveCoordinates(f, `farm_${id}_${name}_${f.state || ""}`);
      const ownerUid = f.ownerUid || f.userId || "";

      if (coords) {
        addEntity({
          id: String(id),
          type: "farm",
          title: name,
          subtitle: `Owner: ${owner} • ${f.numberOfAnimals || f.cattleCount || "Dairy Farm"}`,
          phone: phone || undefined,
          email: f.email || undefined,
          locationName: locationText || getLocalizedText(f.state, "India"),
          state: getLocalizedText(f.state, ""),
          district: getLocalizedText(f.district, ""),
          city: getLocalizedText(f.city || f.taluk, ""),
          village: getLocalizedText(f.village, ""),
          taluk: getLocalizedText(f.taluk, ""),
          latitude: coords.lat,
          longitude: coords.lng,
          isExactCoordinate: coords.isExact,
          badge: "Dairy Facility",
          status: f.status || "Active",
          animal: getLocalizedText(f.animal, "Cow / Cattle"),
          farmTechnique: getLocalizedText(f.farmTechnique, "Modern Dairy Management"),
          numberOfEmployees: getLocalizedText(f.numberOfEmployees, "1 - 2 Workers"),
          numberOfAnimals: getLocalizedText(f.numberOfAnimals || f.cattleCount, "—"),
          farmEquipmentList: Array.isArray(f.farmEquipmentList) ? f.farmEquipmentList : [],
          veterinaryName: getLocalizedText(f.veterinaryName, undefined),
          veterinarianPhoneNumber: getLocalizedText(f.veterinarianPhoneNumber, undefined),
          ownerName: owner,
          ownerUid: ownerUid || undefined,
          userId: ownerUid || undefined,
          userLinkUrl: ownerUid ? `/users/${ownerUid}?tab=farmer` : undefined,
          image: f.imagePath || f.imageUrl,
          details: f,
          linkUrl: `/farms`,
        });
      }
    });

    // --- B. Process Farmers & Users with Farmer Profile ---
    [...backendFarmers, ...directFarmers, ...firestoreUsers.filter((u: any) => u.farmer || u.roles?.includes?.("farmer") || u.role === "farmer" || u.isFarmer), ...backendUsers.filter((u: any) => u.farmer || u.roles?.includes?.("farmer") || u.role === "farmer" || u.isFarmer), ...authUsers.filter((u: any) => u.farmer || u.roles?.includes?.("farmer") || u.role === "farmer" || u.isFarmer)].forEach((f: any) => {
      const id = f.id || f.uid || `farmer_${Math.random()}`;
      const fObj = f.farmer || f;
      const name = getLocalizedText(fObj.name || f.name || f.displayName || fObj.farmerName, "Dairy Farmer");
      const phone = getLocalizedText(fObj.farmerPhoneNumber || fObj.phone || f.phoneNumber || f.phone, "");
      const locationText = cleanLocationString([fObj.village, fObj.taluk, fObj.district, fObj.city, fObj.state]);
      const coords = resolveCoordinates(fObj, `farmer_${id}_${name}_${fObj.state || ""}`);
      const userId = f.uid || f.id || fObj.uid || fObj.id || "";

      if (coords) {
        addEntity({
          id: String(id),
          type: "farmer",
          title: name,
          subtitle: `Farmer • ${phone || "Verified"}`,
          phone: phone || undefined,
          email: f.email || fObj.email || undefined,
          locationName: locationText || getLocalizedText(fObj.state, "India"),
          state: getLocalizedText(fObj.state, ""),
          district: getLocalizedText(fObj.district || fObj.taluk, ""),
          city: getLocalizedText(fObj.city || fObj.taluk, ""),
          village: getLocalizedText(fObj.village, ""),
          latitude: coords.lat,
          longitude: coords.lng,
          isExactCoordinate: coords.isExact,
          badge: "Farmer",
          status: f.status || "Active",
          userId: userId || undefined,
          userLinkUrl: userId ? `/users/${userId}?tab=farmer` : undefined,
          details: f,
          linkUrl: `/farmers`,
        });
      }
    });

    // --- C. Process Veterinarians ---
    [...backendVets, ...directVets, ...firestoreUsers.filter((u: any) => u.vet || u.veterinarian || u.roles?.includes?.("veterinarian") || u.role === "veterinarian" || u.isVet), ...backendUsers.filter((u: any) => u.vet || u.veterinarian || u.roles?.includes?.("veterinarian") || u.role === "veterinarian" || u.isVet), ...authUsers.filter((u: any) => u.vet || u.veterinarian || u.roles?.includes?.("veterinarian") || u.role === "veterinarian" || u.isVet)].forEach((v: any) => {
      const id = v.id || v.uid || `vet_${Math.random()}`;
      const vObj = v.vet || v.veterinarian || v;
      const rawName = getLocalizedText(vObj.doctorName || vObj.name || v.name || v.displayName, "Licensed Veterinarian");
      const cleanName = rawName.trim().startsWith("Dr.") ? rawName.trim() : `Dr. ${rawName.trim()}`;
      const clinic = getLocalizedText(vObj.clinic || vObj.hospital || vObj.clinicName || vObj.addInstitution, "Veterinary Clinic");
      const phone = getLocalizedText(vObj.vetPhoneNumber || vObj.phone || v.phoneNumber || v.phone, "");
      const locationText = cleanLocationString([vObj.village, vObj.city, vObj.district, vObj.state]);
      const coords = resolveCoordinates(vObj, `vet_${id}_${cleanName}_${vObj.state || ""}_${vObj.city || ""}`);
      const userId = v.uid || v.id || vObj.uid || vObj.id || "";

      if (coords) {
        addEntity({
          id: String(id),
          type: "vet",
          title: cleanName,
          subtitle: `${clinic} • ${vObj.yearsOfExperience ? `${vObj.yearsOfExperience} Yrs Exp` : vObj.qualification || "Licensed"}`,
          phone: phone || undefined,
          email: v.email || vObj.email || undefined,
          locationName: locationText || getLocalizedText(vObj.state, "India"),
          state: getLocalizedText(vObj.state, ""),
          district: getLocalizedText(vObj.district || vObj.city, ""),
          city: getLocalizedText(vObj.city, ""),
          village: getLocalizedText(vObj.village, ""),
          latitude: coords.lat,
          longitude: coords.lng,
          isExactCoordinate: coords.isExact,
          badge: "Veterinarian",
          status: v.status || "Active",
          rating: Number(vObj.rating || 4.9),
          userId: userId || undefined,
          userLinkUrl: userId ? `/users/${userId}?tab=veterinarian` : undefined,
          details: v,
          linkUrl: `/vets`,
        });
      }
    });

    // --- D. Process Sellers ---
    [...backendSellers, ...directSellers, ...firestoreUsers.filter((u: any) => u.seller || u.roles?.includes?.("seller") || u.role === "seller" || u.isSeller), ...backendUsers.filter((u: any) => u.seller || u.roles?.includes?.("seller") || u.role === "seller" || u.isSeller), ...authUsers.filter((u: any) => u.seller || u.roles?.includes?.("seller") || u.role === "seller" || u.isSeller)].forEach((s: any) => {
      const id = s.id || s.uid || `seller_${Math.random()}`;
      const sObj = s.seller || s;
      const shopName = getLocalizedText(sObj.shopName || sObj.storeName || sObj.name || s.name || s.displayName, "Agri Supplies Store");
      const owner = getLocalizedText(sObj.name || sObj.ownerName || s.name, "Seller");
      const phone = getLocalizedText(sObj.sellerPhoneNumber || sObj.phone || s.phoneNumber || s.phone, "");
      const category = getLocalizedText(sObj.category || sObj.address, "Feed & Farm Equipment");
      const locationText = cleanLocationString([sObj.village, sObj.taluk, sObj.district, sObj.city, sObj.state]);
      const coords = resolveCoordinates(sObj, `seller_${id}_${shopName}_${sObj.state || ""}_${sObj.district || ""}_${sObj.taluk || ""}`);
      const userId = s.uid || s.id || sObj.uid || sObj.id || "";

      if (coords) {
        addEntity({
          id: String(id),
          type: "seller",
          title: shopName,
          subtitle: `${category} • Owner: ${owner}`,
          phone: phone || undefined,
          email: s.email || sObj.email || undefined,
          locationName: locationText || getLocalizedText(sObj.state, "India"),
          state: getLocalizedText(sObj.state, ""),
          district: getLocalizedText(sObj.district || sObj.taluk, ""),
          city: getLocalizedText(sObj.city || sObj.taluk, ""),
          village: getLocalizedText(sObj.village, ""),
          latitude: coords.lat,
          longitude: coords.lng,
          isExactCoordinate: coords.isExact,
          badge: "Seller",
          status: s.status || "Active",
          rating: Number(sObj.rating || 4.8),
          userId: userId || undefined,
          userLinkUrl: userId ? `/users/${userId}?tab=seller` : undefined,
          details: s,
          linkUrl: `/sellers`,
        });
      }
    });

    // --- E. Process Cattle & Livestock ---
    [...backendCattle, ...directCattle, ...groupCattles].forEach((c: any) => {
      const tagNo = getLocalizedText(c.tagNo || c.tagNumber || c.earTagNo || c.rfid, "");
      const id = tagNo || c.cattleId || c.id || c._path || `cattle_${Math.random()}`;
      const breed = getLocalizedText(c.breed || c.breedType, "Indigenous Cattle");
      const category = getLocalizedText(c.category || c.gender || c.cattleType, "Dairy Cattle");
      const owner = getLocalizedText(c.ownerName || c.farmerName || c.sellerName, "Farmer");
      const phone = getLocalizedText(c.phone || c.sellerPhone || c.ownerPhone || c.phoneNumber, "");
      const locationText = cleanLocationString([c.village, c.taluk, c.district, c.state, c.city]);
      const coords = resolveCoordinates(c, `cattle_${id}_${breed}_${c.state || ""}_${c.district || ""}`);
      const userId = c.ownerUid || c.farmerUid || c.sellerUid || c.userId || "";

      if (coords) {
        addEntity({
          id: String(id),
          type: "cattle",
          title: tagNo ? `Tag #${tagNo} • ${breed}` : `${breed} (${category})`,
          subtitle: `Farmer: ${owner} • ${c.dailyMilkYield ? `${c.dailyMilkYield} L/day` : "Livestock"}`,
          phone: phone || undefined,
          locationName: locationText || getLocalizedText(c.state, "India"),
          state: getLocalizedText(c.state, ""),
          district: getLocalizedText(c.district || c.taluk, ""),
          city: getLocalizedText(c.city || c.taluk, ""),
          village: getLocalizedText(c.village, ""),
          latitude: coords.lat,
          longitude: coords.lng,
          isExactCoordinate: coords.isExact,
          badge: tagNo ? `Tag #${tagNo}` : "Cattle",
          status: c.status || "Healthy",
          price: typeof c.price === "number" ? c.price : undefined,
          ownerName: owner,
          ownerUid: userId || undefined,
          userId: userId || undefined,
          userLinkUrl: userId ? `/users/${userId}` : undefined,
          details: c,
          linkUrl: `/cattle`,
        });
      }
    });

    return list;
  }, [backendFarms, groupFarms, topFarms, backendFarmers, directFarmers, firestoreUsers, backendUsers, authUsers, backendVets, directVets, backendSellers, directSellers, backendCattle, directCattle, groupCattles]);

  // Extract unique states for dropdown
  const uniqueStates = useMemo(() => {
    const states = new Set<string>();
    allGeoEntities.forEach((e) => {
      if (e.state && e.state !== "—" && e.state.trim().length > 1) {
        states.add(e.state.trim());
      }
    });
    return Array.from(states).sort();
  }, [allGeoEntities]);

  // 4. Counts by Entity Type
  const counts = useMemo(() => {
    let farms = 0;
    let farmers = 0;
    let vets = 0;
    let sellers = 0;
    let cattle = 0;
    let exactGps = 0;

    allGeoEntities.forEach((e) => {
      if (e.type === "farm") farms++;
      if (e.type === "farmer") farmers++;
      if (e.type === "vet") vets++;
      if (e.type === "seller") sellers++;
      if (e.type === "cattle") cattle++;
      if (e.isExactCoordinate) exactGps++;
    });

    return { total: allGeoEntities.length, farms, farmers, vets, sellers, cattle, exactGps };
  }, [allGeoEntities]);

  // 5. Filtering & Sorting Logic
  const filteredAndSortedEntities = useMemo(() => {
    let result = allGeoEntities;

    // Filter by Category
    if (activeCategory !== "all") {
      result = result.filter((e) => e.type === activeCategory);
    }

    // Filter by State
    if (stateFilter !== "all") {
      const qState = stateFilter.toLowerCase();
      result = result.filter(
        (e) => (e.state && e.state.toLowerCase() === qState) || (e.locationName && e.locationName.toLowerCase().includes(qState))
      );
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.subtitle.toLowerCase().includes(q) ||
          (e.phone && e.phone.toLowerCase().includes(q)) ||
          (e.locationName && e.locationName.toLowerCase().includes(q)) ||
          (e.state && e.state.toLowerCase().includes(q)) ||
          (e.district && e.district.toLowerCase().includes(q)) ||
          (e.badge && e.badge.toLowerCase().includes(q))
      );
    }

    // Filter by User Geolocation Radius
    if (userLocation && radiusFilterKm > 0) {
      result = result.filter((e) => {
        const dist = getHaversineDistanceKm(userLocation[0], userLocation[1], e.latitude, e.longitude);
        return dist <= radiusFilterKm;
      });
    }

    // Sorting
    result = [...result].sort((a, b) => {
      if (sortOption === "name_asc") {
        return a.title.localeCompare(b.title);
      }
      if (sortOption === "name_desc") {
        return b.title.localeCompare(a.title);
      }
      if (sortOption === "type") {
        return a.type.localeCompare(b.type);
      }
      if (sortOption === "location") {
        return (a.state || "").localeCompare(b.state || "");
      }
      if (sortOption === "distance" && userLocation) {
        const distA = getHaversineDistanceKm(userLocation[0], userLocation[1], a.latitude, a.longitude);
        const distB = getHaversineDistanceKm(userLocation[0], userLocation[1], b.latitude, b.longitude);
        return distA - distB;
      }
      if (sortOption === "gps_first") {
        if (a.isExactCoordinate && !b.isExactCoordinate) return -1;
        if (!a.isExactCoordinate && b.isExactCoordinate) return 1;
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

    return result;
  }, [allGeoEntities, activeCategory, stateFilter, searchQuery, userLocation, radiusFilterKm, sortOption]);

  // Export Map Data to CSV
  const handleExportCsv = () => {
    if (filteredAndSortedEntities.length === 0) {
      toast.error("No entity records to export");
      return;
    }

    const dataToExport = filteredAndSortedEntities.map((e, idx) => ({
      Index: idx + 1,
      ID: e.id,
      Category: e.type.toUpperCase(),
      Title: e.title,
      Subtitle: e.subtitle,
      Phone: e.phone || "—",
      Email: e.email || "—",
      Location: e.locationName || "—",
      District: e.district || "—",
      State: e.state || "—",
      Latitude: e.latitude,
      Longitude: e.longitude,
      GPS_Accuracy: e.isExactCoordinate ? "Exact GPS" : "Regional Geocoded",
      Status: e.status || "Active",
    }));

    exportToCsv({
      filename: `iherd_map_entities_${activeCategory}_${new Date().toISOString().slice(0, 10)}.csv`,
      data: dataToExport,
    });
  };

  const [showRawData, setShowRawData] = useState(false);

  // Helper to copy user ID
  const handleCopy = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-3.6rem)] overflow-hidden bg-background">
      {/* 1. FULL VIEW LEAFLET MAP (Takes 100% of Viewport) */}
      <div className="absolute inset-0 w-full h-full z-0">
        <LeafletMap
          entities={filteredAndSortedEntities}
          selectedEntity={selectedEntity}
          onSelectEntity={(entity) => setSelectedEntity(entity)}
          onOpenDetails={(entity) => setDetailModalEntity(entity)}
          activeTileLayer={tileLayer}
          onChangeTileLayer={(layer) => setTileLayer(layer)}
          center={DEFAULT_INDIA_CENTER}
          zoom={DEFAULT_INDIA_ZOOM}
          userLocation={userLocation}
          radiusKm={radiusFilterKm}
        />
      </div>

      {/* 2. FLOATING TOP HORIZONTAL PILLS STRIP OVER MAP */}
      <div className="absolute top-3 left-3 sm:left-auto sm:right-64 z-[300] flex items-center gap-1.5 bg-background/90 backdrop-blur-md p-1.5 rounded-2xl border shadow-xl max-w-[calc(100vw-180px)] overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
            activeCategory === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "hover:bg-muted text-muted-foreground"
          }`}
        >
          <MapPin className="h-3.5 w-3.5" />
          <span>All India ({counts.total})</span>
        </button>

        <button
          onClick={() => setActiveCategory("farm")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
            activeCategory === "farm"
              ? "bg-teal-600 text-white shadow-sm"
              : "hover:bg-teal-500/10 text-teal-700 dark:text-teal-400"
          }`}
        >
          <Building className="h-3.5 w-3.5" />
          <span>Farms ({counts.farms})</span>
        </button>

        <button
          onClick={() => setActiveCategory("farmer")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
            activeCategory === "farmer"
              ? "bg-emerald-600 text-white shadow-sm"
              : "hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Farmers ({counts.farmers})</span>
        </button>

        <button
          onClick={() => setActiveCategory("vet")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
            activeCategory === "vet"
              ? "bg-blue-600 text-white shadow-sm"
              : "hover:bg-blue-500/10 text-blue-700 dark:text-blue-400"
          }`}
        >
          <Stethoscope className="h-3.5 w-3.5" />
          <span>Vets ({counts.vets})</span>
        </button>

        <button
          onClick={() => setActiveCategory("seller")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
            activeCategory === "seller"
              ? "bg-amber-600 text-white shadow-sm"
              : "hover:bg-amber-500/10 text-amber-700 dark:text-amber-400"
          }`}
        >
          <Store className="h-3.5 w-3.5" />
          <span>Sellers ({counts.sellers})</span>
        </button>

        <button
          onClick={() => setActiveCategory("cattle")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
            activeCategory === "cattle"
              ? "bg-purple-600 text-white shadow-sm"
              : "hover:bg-purple-500/10 text-purple-700 dark:text-purple-400"
          }`}
        >
          <Beef className="h-3.5 w-3.5" />
          <span>Cattle ({counts.cattle})</span>
        </button>
      </div>

      {/* 3. SLEEK FLOATING SIDEBAR ON THE LEFT SIDE WITH TOGGLE */}
      <div
        className={`absolute top-3 bottom-3 left-3 z-[350] transition-all duration-300 ease-in-out flex ${
          isSidebarOpen ? "w-[340px] sm:w-[380px]" : "w-11"
        }`}
      >
        {/* Main Side Panel Card */}
        {isSidebarOpen ? (
          <div className="w-full h-full flex flex-col bg-card/95 backdrop-blur-xl rounded-2xl border shadow-2xl overflow-hidden">
            {/* Header with Title and Collapse Toggle */}
            <div className="p-3.5 border-b flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2 min-w-0">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                  <MapPin className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold truncate leading-tight">Live Geo Explorer</h2>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Showing {filteredAndSortedEntities.length} of {counts.total} in India
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={handleRefresh}
                  title="Refresh Map Data"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={handleExportCsv}
                  title="Export Filtered CSV"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7 rounded-lg"
                  onClick={() => setIsSidebarOpen(false)}
                  title="Collapse Filter Panel"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Controls Strip (Search, State, Proximity, Sort) */}
            <div className="p-3 border-b space-y-2.5 bg-background/50">
              {/* Search Bar */}
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search name, phone, district, farm, tag, clinic..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs rounded-xl bg-background border-border/80"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* State & Sort Dropdowns Grid */}
              <div className="grid grid-cols-2 gap-2">
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="h-8 text-xs rounded-xl bg-background">
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-56">
                    <SelectItem value="all">All States ({uniqueStates.length})</SelectItem>
                    {uniqueStates.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortOption} onValueChange={(v: any) => setSortOption(v)}>
                  <SelectTrigger className="h-8 text-xs rounded-xl bg-background">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="gps_first">GPS Exact First</SelectItem>
                    <SelectItem value="name_asc">Name (A → Z)</SelectItem>
                    <SelectItem value="name_desc">Name (Z → A)</SelectItem>
                    <SelectItem value="type">By Entity Type</SelectItem>
                    <SelectItem value="location">By State</SelectItem>
                    {userLocation && <SelectItem value="distance">Nearest to Me</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              {/* Geolocation Button & Radius */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs rounded-xl gap-1 flex-1 font-medium bg-background"
                  onClick={handleLocateMe}
                  disabled={isLocating}
                >
                  <Navigation className={`h-3 w-3 ${isLocating ? "animate-spin text-blue-500" : "text-blue-600"}`} />
                  <span className="truncate">{userLocation ? "Located" : "Locate Me"}</span>
                </Button>

                {userLocation && (
                  <div className="w-28">
                    <Select
                      value={String(radiusFilterKm)}
                      onValueChange={(v) => setRadiusFilterKm(Number(v))}
                    >
                      <SelectTrigger className="h-8 text-xs rounded-xl bg-background text-blue-600 font-medium">
                        <SelectValue placeholder="Radius" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="0">All Dist</SelectItem>
                        <SelectItem value="25">25 km</SelectItem>
                        <SelectItem value="50">50 km</SelectItem>
                        <SelectItem value="100">100 km</SelectItem>
                        <SelectItem value="250">250 km</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable Entity Directory List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-border/20">
              {filteredAndSortedEntities.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground flex flex-col items-center justify-center h-48">
                  <MapPin className="h-7 w-7 text-muted-foreground/30 mb-2" />
                  <p className="text-xs font-semibold">No entities match your filter</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 text-xs text-primary h-7"
                    onClick={() => {
                      setActiveCategory("all");
                      setStateFilter("all");
                      setSearchQuery("");
                      setRadiusFilterKm(0);
                    }}
                  >
                    Reset Filters
                  </Button>
                </div>
              ) : (
                filteredAndSortedEntities.map((entity) => {
                  const isSelected = selectedEntity?.id === entity.id;

                  const typeColor =
                    entity.type === "farm"
                      ? "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20"
                      : entity.type === "farmer"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                      : entity.type === "vet"
                      ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                      : entity.type === "seller"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                      : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";

                  const TypeIcon =
                    entity.type === "farm"
                      ? Building
                      : entity.type === "farmer"
                      ? Users
                      : entity.type === "vet"
                      ? Stethoscope
                      : entity.type === "seller"
                      ? Store
                      : Beef;

                  return (
                    <div
                      key={`${entity.type}_${entity.id}`}
                      onClick={() => setSelectedEntity(entity)}
                      className={`p-2 rounded-xl cursor-pointer transition border text-left flex flex-col gap-1 ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-sm"
                          : "bg-background/80 hover:bg-muted/50 border-border/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`grid h-6 w-6 place-items-center rounded-lg shrink-0 border ${typeColor}`}>
                            <TypeIcon className="h-3 w-3" />
                          </span>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-xs truncate leading-snug">{entity.title}</h4>
                            <p className="text-[11px] text-muted-foreground truncate">{entity.subtitle}</p>
                          </div>
                        </div>

                        {entity.isExactCoordinate ? (
                          <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-500/20 shrink-0">
                            GPS
                          </span>
                        ) : (
                          <span className="text-[8px] text-muted-foreground bg-muted px-1 py-0.5 rounded shrink-0">
                            Reg
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5 border-t border-border/20">
                        <span className="truncate flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                          {entity.locationName || "India"}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 text-[10px] text-primary hover:text-primary gap-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailModalEntity(entity);
                          }}
                        >
                          View <ExternalLink className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* Minimized Expand Button */
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="h-11 w-11 rounded-2xl bg-card/95 backdrop-blur-md border shadow-2xl flex items-center justify-center text-foreground hover:bg-muted transition"
            title="Expand Filters & Explorer"
          >
            <ChevronRight className="h-5 w-5 text-primary" />
          </button>
        )}
      </div>

      {/* 4. FULL ENTITY & USER DETAILS MODAL DIALOG */}
      <Dialog open={!!detailModalEntity} onOpenChange={(o) => !o && setDetailModalEntity(null)}>
        {detailModalEntity && (
          <DialogContent className="sm:max-w-xl rounded-3xl max-h-[92vh] overflow-y-auto p-6">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge
                    variant="outline"
                    className={
                      detailModalEntity.type === "farm"
                        ? "bg-teal-500/10 text-teal-700 border-teal-500/20"
                        : detailModalEntity.type === "farmer"
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                        : detailModalEntity.type === "vet"
                        ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                        : detailModalEntity.type === "seller"
                        ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                        : "bg-purple-500/10 text-purple-700 border-purple-500/20"
                    }
                  >
                    {detailModalEntity.type === "farm" ? "REGISTERED FARM" : detailModalEntity.type.toUpperCase()}
                  </Badge>
                  {detailModalEntity.badge && (
                    <Badge variant="secondary" className="text-[10px]">
                      {detailModalEntity.badge}
                    </Badge>
                  )}
                  {detailModalEntity.isExactCoordinate && (
                    <Badge variant="secondary" className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> GPS Exact
                    </Badge>
                  )}
                </div>

                <StatusBadge status={detailModalEntity.status || "Active"} />
              </div>

              <DialogTitle className="text-lg sm:text-xl font-bold text-foreground pt-1">
                {detailModalEntity.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {detailModalEntity.subtitle}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Photo Banner if available */}
              {detailModalEntity.image && (
                <div className="h-48 w-full rounded-2xl overflow-hidden border bg-muted shadow-sm">
                  <img
                    src={detailModalEntity.image}
                    alt={detailModalEntity.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              {/* USER PROFILE CARD (Direct Access & UID) */}
              {(detailModalEntity.userId || detailModalEntity.ownerUid || detailModalEntity.userLinkUrl) && (
                <div className="p-4 rounded-2xl border bg-primary/5 border-primary/20 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">
                          {detailModalEntity.ownerName || detailModalEntity.title}
                        </h4>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <span>User ID:</span>
                          <span className="font-mono text-primary">
                            {(detailModalEntity.userId || detailModalEntity.ownerUid || "—").slice(0, 16)}...
                          </span>
                          <button
                            onClick={() =>
                              handleCopy(
                                detailModalEntity.userId || detailModalEntity.ownerUid || "",
                                "User ID"
                              )
                            }
                            className="text-muted-foreground hover:text-foreground p-0.5 ml-1"
                            title="Copy UID"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <Button asChild size="sm" className="rounded-xl text-xs gap-1.5 shadow-sm">
                      <Link
                        to={
                          (detailModalEntity.userLinkUrl as any) ||
                          `/users/${detailModalEntity.userId || detailModalEntity.ownerUid}`
                        }
                      >
                        <User className="h-3.5 w-3.5" />
                        <span>Open Full User Profile</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              {/* Farm specific Infrastructure and Specifications */}
              {detailModalEntity.type === "farm" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 bg-muted/20 rounded-2xl border">
                      <span className="text-[10px] text-muted-foreground block font-medium">Livestock / Animals</span>
                      <span className="font-bold text-xs text-foreground">
                        {detailModalEntity.numberOfAnimals && detailModalEntity.numberOfAnimals !== "—"
                          ? `${detailModalEntity.numberOfAnimals} Animals`
                          : detailModalEntity.cattleCount
                          ? `${detailModalEntity.cattleCount} Animals`
                          : "Dairy Facility"} ({detailModalEntity.animal || "Cattle"})
                      </span>
                    </div>
                    <div className="p-3 bg-muted/20 rounded-2xl border">
                      <span className="text-[10px] text-muted-foreground block font-medium">Management Technique</span>
                      <span className="font-bold text-xs text-foreground truncate">
                        {detailModalEntity.farmTechnique || "Modern Dairy Setup"}
                      </span>
                    </div>
                    <div className="p-3 bg-muted/20 rounded-2xl border">
                      <span className="text-[10px] text-muted-foreground block font-medium">Workers & Employees</span>
                      <span className="font-bold text-xs text-foreground">
                        {detailModalEntity.numberOfEmployees || "1 - 2 Staff"}
                      </span>
                    </div>
                    <div className="p-3 bg-muted/20 rounded-2xl border">
                      <span className="text-[10px] text-muted-foreground block font-medium">Owner / Farmer</span>
                      <span className="font-bold text-xs text-foreground truncate">
                        {detailModalEntity.ownerName || "Registered Farmer"}
                      </span>
                    </div>
                  </div>

                  {/* Equipment Tags */}
                  {Array.isArray(detailModalEntity.farmEquipmentList) && detailModalEntity.farmEquipmentList.length > 0 && (
                    <div className="p-3 bg-muted/20 rounded-2xl border space-y-1.5">
                      <span className="text-[10px] text-muted-foreground block font-semibold uppercase tracking-wider">
                        Equipped Facilities & Tools
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {detailModalEntity.farmEquipmentList.map((eq, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-xl bg-background border text-xs font-medium text-foreground flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            {String(eq).replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assigned Vet */}
                  {detailModalEntity.veterinaryName && (
                    <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-teal-700 dark:text-teal-300 block font-semibold uppercase tracking-wider">
                          Assigned Veterinarian Doctor
                        </span>
                        <span className="font-bold text-xs text-foreground">{detailModalEntity.veterinaryName}</span>
                      </div>
                      {detailModalEntity.veterinarianPhoneNumber && (
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 rounded-xl gap-1" asChild>
                          <a href={`tel:${detailModalEntity.veterinarianPhoneNumber}`}>
                            <Phone className="h-3 w-3" /> Call Doctor
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Location & Coordinates Card */}
              <div className="p-3.5 bg-muted/30 rounded-2xl border space-y-2">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>Geospatial Coordinates & Physical Address</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300 pt-1">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Location Name:</span>
                    <span className="font-medium text-foreground">{detailModalEntity.locationName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">District / State:</span>
                    <span className="font-medium text-foreground">
                      {detailModalEntity.district || detailModalEntity.city || "—"},{" "}
                      {detailModalEntity.state || "India"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Latitude:</span>
                    <span className="font-mono font-bold text-foreground">
                      {detailModalEntity.latitude.toFixed(6)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Longitude:</span>
                    <span className="font-mono font-bold text-foreground">
                      {detailModalEntity.longitude.toFixed(6)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Information Card */}
              {detailModalEntity.phone && detailModalEntity.phone !== "—" && (
                <div className="p-3 bg-muted/20 rounded-2xl border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Phone Contact</span>
                      <a href={`tel:${detailModalEntity.phone}`} className="font-medium text-primary hover:underline">
                        {detailModalEntity.phone}
                      </a>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs rounded-xl gap-1" asChild>
                    <a href={`tel:${detailModalEntity.phone}`}>
                      <Phone className="h-3 w-3" /> Call Now
                    </a>
                  </Button>
                </div>
              )}

              {/* Specific metadata based on entity type */}
              {detailModalEntity.type === "farmer" && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-muted/20 rounded-2xl border">
                    <span className="text-[10px] text-muted-foreground block font-medium">Livestock Tagged</span>
                    <span className="font-bold text-sm text-foreground">
                      {detailModalEntity.cattleCount || 0} Cattle
                    </span>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-2xl border">
                    <span className="text-[10px] text-muted-foreground block font-medium">Verification Status</span>
                    <span className="font-bold text-sm text-emerald-600">Active Verified</span>
                  </div>
                </div>
              )}

              {detailModalEntity.type === "vet" && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-muted/20 rounded-2xl border">
                    <span className="text-[10px] text-muted-foreground block font-medium">Doctor Rating</span>
                    <span className="font-bold text-sm text-foreground">
                      ⭐ {detailModalEntity.rating || 5.0} / 5.0
                    </span>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-2xl border">
                    <span className="text-[10px] text-muted-foreground block font-medium">Clinical Focus</span>
                    <span className="font-bold text-xs text-foreground">Bovine & Dairy Health</span>
                  </div>
                </div>
              )}

              {detailModalEntity.type === "seller" && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-muted/20 rounded-2xl border">
                    <span className="text-[10px] text-muted-foreground block font-medium">Store Rating</span>
                    <span className="font-bold text-sm text-foreground">
                      ⭐ {detailModalEntity.rating || 4.8} / 5.0
                    </span>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-2xl border">
                    <span className="text-[10px] text-muted-foreground block font-medium">Merchant Status</span>
                    <span className="font-bold text-sm text-emerald-600">Verified Seller</span>
                  </div>
                </div>
              )}

              {/* RAW JSON DATA EXPANDER */}
              <div className="border rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowRawData(!showRawData)}
                  className="w-full p-2.5 bg-muted/40 hover:bg-muted/60 text-xs font-semibold flex items-center justify-between transition text-muted-foreground hover:text-foreground"
                >
                  <div className="flex items-center gap-1.5">
                    <FileJson className="h-3.5 w-3.5 text-primary" />
                    <span>View Complete Database Record (JSON)</span>
                  </div>
                  {showRawData ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {showRawData && (
                  <div className="p-3 bg-slate-950 text-slate-100 font-mono text-[11px] max-h-52 overflow-y-auto rounded-b-2xl">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(detailModalEntity.details || detailModalEntity, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t mt-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs"
                onClick={() => setDetailModalEntity(null)}
              >
                Close
              </Button>

              <div className="flex items-center gap-2">
                {(detailModalEntity.userId || detailModalEntity.ownerUid) && (
                  <Button asChild size="sm" variant="outline" className="rounded-xl text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                    <Link
                      to={
                        (detailModalEntity.userLinkUrl as any) ||
                        `/users/${detailModalEntity.userId || detailModalEntity.ownerUid}`
                      }
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>User Profile</span>
                    </Link>
                  </Button>
                )}

                {detailModalEntity.linkUrl && (
                  <Button size="sm" className="rounded-xl text-xs gap-1.5" asChild>
                    <Link to={detailModalEntity.linkUrl}>
                      <span>Open Register</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
