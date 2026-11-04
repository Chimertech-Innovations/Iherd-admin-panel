import { createFileRoute, Link } from "@tanstack/react-router";
import { getApiBaseUrlSync } from "@/lib/apiClient";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useFirebaseCollection, useFirebaseCollectionGroup } from "../hooks/useFirebaseData";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { getLocalizedText, formatImageUrl } from "@/lib/utils";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  ShieldCheck,
  User,
  Clock,
  Store,
  Tractor,
  Stethoscope,
  Briefcase,
  GraduationCap,
  MapPin,
  Building,
  Activity,
  BadgeAlert,
  CheckCircle2,
  Image as ImageIcon,
  Beef,
  ShoppingCart,
  Coins,
  AlertCircle,
  Code2,
  ExternalLink,
  Copy,
  Check,
  Eye,
  Camera,
  Layers,
  Sparkles,
  Info,
  Maximize2,
  RefreshCw,
  FileCheck,
  Award,
  FileText,
  Package,
  Wrench,
  Compass,
  Users,
  Edit,
  Save,
  Download,
  Receipt,
  Truck,
  Tag,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csvExport";

export const Route = createFileRoute("/users/$userId")({
  head: () => ({ meta: [{ title: "User Details — iHerd Admin" }] }),
  component: UserDetail,
});

const API_BASE = getApiBaseUrlSync();

function isSimilarUid(a?: string, b?: string) {
  if (!a || !b) return false;
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return true;
  const n1 = s1.replace(/[1li]/g, "x");
  const n2 = s2.replace(/[1li]/g, "x");
  return n1 === n2;
}

function InfoRow({ icon: Icon, label, value, valueClass }: { icon: any; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-sm font-semibold truncate ${valueClass ?? "text-foreground"}`}>{value}</div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(val: any) {
  if (!val) return "—";
  try {
    let d: Date;
    if (typeof val === "object" && (val._seconds || val.seconds)) {
      d = new Date((val._seconds || val.seconds) * 1000);
    } else if (typeof val === "number") {
      d = new Date(val);
    } else {
      d = new Date(val);
    }
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(val);
  }
}

function UserDetail() {
  const { userId } = Route.useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [copiedId, setCopiedId] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [selectedCattleDetail, setSelectedCattleDetail] = useState<any | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
  const [isEditFarmOpen, setIsEditFarmOpen] = useState(false);
  const [isSavingFarm, setIsSavingFarm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isClient = typeof window !== "undefined";

  // 1. Fetch authenticated users
  const { data: authUsers = [] } = useAdminUsers();
  const authUser = authUsers.find((u: any) => isSimilarUid(u.uid, userId));

  // 2. Fetch Client Firestore Collections
  const { data: allUsers = [] } = useFirebaseCollection<any>("users");
  const { data: allFarmers = [] } = useFirebaseCollection<any>("farmers");
  const { data: allSellers = [] } = useFirebaseCollection<any>("sellers");
  const { data: allVets = [] } = useFirebaseCollection<any>("vets");
  const { data: allCattleDetails = [] } = useFirebaseCollection<any>("cattle_details");
  const { data: allCattleMarketplace = [] } = useFirebaseCollection<any>("cattle-marketplace");
  const { data: allGroupCattles = [] } = useFirebaseCollectionGroup<any>("cattles");

  // Find primary user in Firestore users list (fuzzy similarity)
  const firestoreUser = useMemo(() => {
    return allUsers.find((item: any) => {
      if (!item) return false;
      if (isSimilarUid(item.id, userId) || isSimilarUid(item.uid, userId) || isSimilarUid(item.userId, userId)) return true;
      if (authUser?.email && item.email && item.email.toLowerCase() === authUser.email.toLowerCase()) return true;
      return false;
    });
  }, [allUsers, userId, authUser]);

  const resolvedDocId = firestoreUser?.id || authUser?.uid || userId;

  // 3. Primary: Fetch Complete Connected Data from Backend Admin API
  const {
    data: backendFullData,
    isLoading: backendLoading,
    refetch: refetchFullData,
  } = useQuery({
    queryKey: ["userFullData", userId, resolvedDocId],
    queryFn: async () => {
      if (!isClient) return null;
      try {
        const url = `${API_BASE}/api/admin/user-full-data/${encodeURIComponent(resolvedDocId || userId)}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        return res.json();
      } catch (err) {
        console.warn("Backend user-full-data fetch error:", err);
        return null;
      }
    },
    enabled: isClient,
    staleTime: 10000,
  });

  // 4. Secondary: Direct Firestore Live Subcollection Fallback
  const { data: directFarmerDoc } = useQuery({
    queryKey: ["directFarmerRole", resolvedDocId, userId],
    queryFn: async () => {
      if (!isClient) return null;
      const candidates = Array.from(
        new Set([resolvedDocId, userId, authUser?.uid, firestoreUser?.id, firestoreUser?.uid])
      ).filter(Boolean) as string[];

      for (const uid of candidates) {
        try {
          const docRef = doc(db, "users", uid, "roles", "farmer");
          const snap = await getDoc(docRef);
          if (snap.exists()) return { id: snap.id, uid, ...snap.data() };

          const colRef = collection(db, "users", uid, "roles");
          const colSnap = await getDocs(colRef);
          if (!colSnap.empty) {
            const fDoc = colSnap.docs.find(
              (d) => d.id === "farmer" || d.data().name || d.data().farmerPhoneNumber
            );
            if (fDoc) return { id: fDoc.id, uid, ...fDoc.data() };
          }
        } catch (err) {}
      }
      return null;
    },
    enabled: isClient,
    staleTime: 10000,
  });

  const mergedUserDoc = backendFullData?.userDoc || firestoreUser || {};

  // Resolve Farmer Profile
  const farmerDoc =
    backendFullData?.farmerDoc ||
    directFarmerDoc ||
    (backendFullData?.subcollections?.roles?.find((r: any) => r.id === "farmer" || r.role === "farmer")) ||
    mergedUserDoc?.farmer ||
    mergedUserDoc?.farms ||
    {};

  // Resolve ALL Farm Profiles for this user
  const farmsList: any[] = useMemo(() => {
    const list: any[] = [];
    const seenIds = new Set<string>();

    const addFarm = (f: any, source: string) => {
      if (!f) return;
      const id = String(f.id || f.farmId || "");
      const name = String(f.name || f.farmName || "");
      const key = id || name || `farm_${list.length}`;
      if (seenIds.has(key)) return;
      seenIds.add(key);
      list.push({ ...f, id: id || key, farmId: f.farmId || id || key, sourcePath: f.sourcePath || source });
    };

    if (Array.isArray(backendFullData?.farmsList)) {
      backendFullData.farmsList.forEach((f: any) => addFarm(f, f.sourcePath || "api_farmsList"));
    }
    if (Array.isArray(backendFullData?.subcollections?.farms)) {
      backendFullData.subcollections.farms.forEach((f: any) => addFarm(f, "subcollections.farms"));
    }
    if (mergedUserDoc?.farms) {
      if (Array.isArray(mergedUserDoc.farms)) {
        mergedUserDoc.farms.forEach((f: any) => addFarm(f, "userDoc.farms"));
      } else if (typeof mergedUserDoc.farms === "object") {
        Object.values(mergedUserDoc.farms).forEach((f: any) => {
          if (f && typeof f === "object") addFarm(f, "userDoc.farms");
        });
      }
    }
    if (farmerDoc && (farmerDoc.farmName || farmerDoc.name) && list.length === 0) {
      addFarm({
        name: farmerDoc.farmName || (farmerDoc.name ? `${getLocalizedText(farmerDoc.name)}'s Dairy Farm` : "Registered Dairy Farm"),
        address: farmerDoc.address || farmerDoc.village || "—",
        village: farmerDoc.village || "—",
        taluk: farmerDoc.taluk || "—",
        postoffice: farmerDoc.postoffice || "—",
        district: farmerDoc.district || "—",
        state: farmerDoc.state || "—",
        pincode: farmerDoc.pincode || "—",
        country: farmerDoc.country || "🇮🇳 India",
        farmPhoneNumber: farmerDoc.farmerPhoneNumber || "—",
        farmTechnique: "Modern Dairy Management",
        numberOfAnimals: 1,
      }, "farmer_fallback");
    }
    return list;
  }, [backendFullData, mergedUserDoc, farmerDoc]);

  // Default / Primary farm
  const farmDoc = farmsList[0] || null;

  // Track specific farm selected for editing
  const [selectedFarmToEdit, setSelectedFarmToEdit] = useState<any>(null);

  // Edit Farm Form state
  const [editFarmForm, setEditFarmForm] = useState({
    name: "",
    farmId: "",
    village: "",
    taluk: "",
    postoffice: "",
    district: "",
    state: "",
    pincode: "",
    address: "",
    farmPhoneNumber: "",
    numberOfAnimals: "1",
    animal: "Cow / Cattle",
    farmTechnique: "Modern Dairy Management",
    numberOfEmployees: "1 - 2 Workers",
  });

  const handleOpenEditFarm = (farm?: any) => {
    const target = farm || farmDoc || {};
    setSelectedFarmToEdit(target);
    setEditFarmForm({
      name: target.name || target.farmName || "",
      farmId: target.farmId || target.id || "",
      village: target.village || farmerDoc?.village || "",
      taluk: target.taluk || farmerDoc?.taluk || "",
      postoffice: target.postoffice || farmerDoc?.postoffice || "",
      district: target.district || farmerDoc?.district || "",
      state: target.state || farmerDoc?.state || "",
      pincode: target.pincode || farmerDoc?.pincode || "",
      address: target.address || farmerDoc?.address || "",
      farmPhoneNumber: target.farmPhoneNumber || target.phone || farmerDoc?.farmerPhoneNumber || "",
      numberOfAnimals: String(target.numberOfAnimals || "1"),
      animal: target.animal || "Cow / Cattle",
      farmTechnique: target.farmTechnique || "Modern Dairy Management",
      numberOfEmployees: String(target.numberOfEmployees || "1 - 2 Workers"),
    });
    setIsEditFarmOpen(true);
  };

  useEffect(() => {
    if (farmDoc && !selectedFarmToEdit) {
      setEditFarmForm({
        name: farmDoc.name || (farmerDoc?.name ? `${getLocalizedText(farmerDoc.name)}'s Dairy Farm` : "Registered Dairy Farm"),
        farmId: farmDoc.farmId || farmDoc.id || "",
        village: farmDoc.village || farmerDoc?.village || "",
        taluk: farmDoc.taluk || farmerDoc?.taluk || "",
        postoffice: farmDoc.postoffice || farmerDoc?.postoffice || "",
        district: farmDoc.district || farmerDoc?.district || "",
        state: farmDoc.state || farmerDoc?.state || "",
        pincode: farmDoc.pincode || farmerDoc?.pincode || "",
        address: farmDoc.address || farmerDoc?.address || "",
        farmPhoneNumber: farmDoc.farmPhoneNumber || farmerDoc?.farmerPhoneNumber || "",
        numberOfAnimals: String(farmDoc.numberOfAnimals || "1"),
        animal: farmDoc.animal || "Cow / Cattle",
        farmTechnique: farmDoc.farmTechnique || "Modern Dairy Management",
        numberOfEmployees: String(farmDoc.numberOfEmployees || "1 - 2 Workers"),
      });
    }
  }, [farmDoc, farmerDoc, selectedFarmToEdit]);

  const handleSaveFarm = async () => {
    try {
      setIsSavingFarm(true);
      const targetFarmId = selectedFarmToEdit?.id || selectedFarmToEdit?.farmId || editFarmForm.farmId;
      const res = await fetch(`${API_BASE}/api/admin/user-farm-data/${encodeURIComponent(resolvedDocId || userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editFarmForm,
          farmId: targetFarmId,
        }),
      });
      if (!res.ok) throw new Error("Failed to save farm details");
      toast.success(`Farm "${editFarmForm.name || targetFarmId}" updated successfully!`);
      setIsEditFarmOpen(false);
      refetchFullData();
    } catch (err: any) {
      toast.error(err.message || "Error saving farm data");
    } finally {
      setIsSavingFarm(false);
    }
  };

  // Resolve Seller Profile
  const sellerDoc =
    backendFullData?.sellerDoc ||
    (backendFullData?.subcollections?.roles?.find((r: any) => r.id === "seller" || r.role === "seller")) ||
    mergedUserDoc?.seller ||
    allSellers.find((s: any) => isSimilarUid(s.id, userId) || isSimilarUid(s.uid, userId)) ||
    null;

  // Resolve Veterinarian Profile
  const vetDoc =
    backendFullData?.vetDoc ||
    (backendFullData?.subcollections?.roles?.find((r: any) => r.id === "veterinarian" || r.id === "vet" || r.role === "vet")) ||
    mergedUserDoc?.veterinarian ||
    mergedUserDoc?.vet ||
    allVets.find((v: any) => isSimilarUid(v.id, userId) || isSimilarUid(v.uid, userId)) ||
    null;

  // Orders, Token Advances & Issues connected from Backend API
  const allCattleOrders: any[] = useMemo(() => {
    return backendFullData?.cattleOrders || [];
  }, [backendFullData]);

  const allProductOrders: any[] = useMemo(() => {
    return backendFullData?.productOrders || [];
  }, [backendFullData]);

  const allTokenAdvances: any[] = useMemo(() => {
    return backendFullData?.tokenAdvances || [];
  }, [backendFullData]);

  const allIssues: any[] = useMemo(() => {
    return backendFullData?.issues || [];
  }, [backendFullData]);

  // Resolve Seller Products
  const sellerProducts = backendFullData?.sellerProducts || [];

  // Consolidate Cattle records
  const allUserCattle = useMemo(() => {
    const map = new Map<string, any>();

    if (Array.isArray(backendFullData?.cattleListings)) {
      backendFullData.cattleListings.forEach((c: any) => {
        const key = c.cattleId || c.rfid || c.id;
        map.set(key, c);
      });
    }

    const isOwner = (c: any) => {
      if (!c) return false;
      const docPath = c._path || c.path || "";
      if (docPath && (docPath.includes(`users/${userId}`) || (resolvedDocId && docPath.includes(`users/${resolvedDocId}`)))) {
        return true;
      }
      const owner = c.ownerUid || c.sellerId || c.farmerId || c.userId || c.uid || c.postedBy || "";
      if (isSimilarUid(owner, userId) || isSimilarUid(owner, resolvedDocId)) return true;
      return false;
    };

    allCattleDetails.filter(isOwner).forEach((c: any) => {
      const key = c.cattleId || c.rfid || c.id;
      if (map.has(key)) map.set(key, { ...map.get(key), ...c, source: "cattle_details" });
      else map.set(key, { ...c, source: "cattle_details" });
    });

    allCattleMarketplace.filter(isOwner).forEach((c: any) => {
      const key = c.cattleId || c.rfid || c.id;
      if (map.has(key)) map.set(key, { ...map.get(key), ...c, source: "cattle-marketplace" });
      else map.set(key, { ...c, source: "cattle-marketplace" });
    });

    allGroupCattles.filter(isOwner).forEach((c: any) => {
      const key = c.cattleId || c.rfid || c.id;
      if (map.has(key)) map.set(key, { ...map.get(key), ...c, source: "farm_cattles" });
      else map.set(key, { ...c, source: "farm_cattles" });
    });

    return Array.from(map.values());
  }, [backendFullData, allCattleDetails, allCattleMarketplace, allGroupCattles, userId, resolvedDocId]);

  // Helper: Get cattle for a specific farm
  const getCattleForFarm = (farm: any) => {
    if (!farm) return [];
    const fIds = [farm.id, farm.farmId].filter(Boolean).map(String);
    return allUserCattle.filter((c: any) => {
      const cFarmId = String(c.farmId || "");
      return cFarmId && fIds.includes(cFarmId);
    });
  };

  // Unassigned cattle that don't match any farm in farmsList
  const unassignedCattle = useMemo(() => {
    const allKnownFarmIds = new Set<string>();
    farmsList.forEach((f) => {
      if (f.id) allKnownFarmIds.add(String(f.id));
      if (f.farmId) allKnownFarmIds.add(String(f.farmId));
    });
    return allUserCattle.filter((c: any) => {
      const cFarmId = String(c.farmId || "");
      return !cFarmId || !allKnownFarmIds.has(cFarmId);
    });
  }, [allUserCattle, farmsList]);

  // Selected farm filter in Cattle tab
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>("all");

  const filteredCattleList = useMemo(() => {
    if (selectedFarmFilter === "all") return allUserCattle;
    if (selectedFarmFilter === "unassigned") return unassignedCattle;
    return allUserCattle.filter((c: any) => String(c.farmId || "") === selectedFarmFilter);
  }, [allUserCattle, unassignedCattle, selectedFarmFilter]);

  // Consolidate ONLY Valid Images for This User
  const allMediaImages = useMemo(() => {
    const imagesList: Array<{ url: string; title: string; source: string; date?: string; size?: string }> = [];
    const seenUrls = new Set<string>();

    const addImg = (url?: string, title?: string, source?: string, date?: string, size?: string) => {
      if (!url || typeof url !== "string" || !url.startsWith("http") || seenUrls.has(url)) return;
      seenUrls.add(url);
      imagesList.push({
        url,
        title: title || "Image",
        source: source || "Storage",
        date,
        size,
      });
    };

    // 1. Farmer Profile Image
    if (farmerDoc?.imagePath) addImg(farmerDoc.imagePath, "Farmer Profile Photo", "Farmer Profile");
    // 2. Farm Image
    if (farmDoc?.imagePath) addImg(farmDoc.imagePath, "Farm Facility Image", "Farm");
    // 3. Seller Image
    if (sellerDoc?.imagePath) addImg(sellerDoc.imagePath, "Seller Store Photo", "Seller Profile");
    // 4. Vet Image & Documents
    if (vetDoc?.imagePath) addImg(vetDoc.imagePath, "Veterinarian Doctor Photo", "Vet Profile");
    if (vetDoc?.educationProof) addImg(vetDoc.educationProof, "Veterinarian Education Proof", "Vet Document");
    if (vetDoc?.identityProof) addImg(vetDoc.identityProof, "Veterinarian Identity Proof", "Vet Document");
    if (vetDoc?.registrationProof) addImg(vetDoc.registrationProof, "Veterinarian Registration License", "Vet Document");

    if (mergedUserDoc?.photoURL) addImg(mergedUserDoc.photoURL, "Profile Photo", "User Profile");
    if (mergedUserDoc?.profileImage) addImg(mergedUserDoc.profileImage, "Profile Image", "User Profile");

    // 5. Cattle Camera Proofs (Face, Left, Right, Muzzle, Udder, Top, Farmer)
    allUserCattle.forEach((c: any) => {
      const name = getLocalizedText(c.cattleName || c.title || c.breed || "Cattle");
      if (c.faceView) addImg(c.faceView, `${name} (Face View)`, "Cattle - Face");
      if (c.leftView) addImg(c.leftView, `${name} (Left View)`, "Cattle - Left");
      if (c.rightView) addImg(c.rightView, `${name} (Right View)`, "Cattle - Right");
      if (c.muzzleView) addImg(c.muzzleView, `${name} (Muzzle View)`, "Cattle - Muzzle");
      if (c.udderView) addImg(c.udderView, `${name} (Udder View)`, "Cattle - Udder");
      if (c.bottomView || c.topview) addImg(c.bottomView || c.topview, `${name} (Top/Bottom View)`, "Cattle - Top/Bottom");
      if (c.farmerView) addImg(c.farmerView, `${name} (Farmer View)`, "Cattle - Farmer");
      if (Array.isArray(c.images)) {
        c.images.forEach((img: string, idx: number) => addImg(img, `${name} (Photo ${idx + 1})`, "Cattle Listing"));
      } else if (c.imageUrl) {
        addImg(c.imageUrl, name, "Cattle Listing");
      }
    });

    // 6. Seller Products
    sellerProducts.forEach((p: any) => {
      if (p.image || p.imageUrl) addImg(p.image || p.imageUrl, p.name || p.title || "Product", "Seller Product");
    });

    // 7. Backend Storage Files with valid URLs
    if (Array.isArray(backendFullData?.storageFiles)) {
      backendFullData.storageFiles.forEach((file: any) => {
        if (file.url && file.size > 0) {
          const fileName = file.name.split("/").pop() || file.name;
          const isFarmerImg = file.name.includes("FarmerImage");
          const isFarmImg = file.name.includes("FarmImage");
          const isCattle = file.name.includes("CattleImage") || file.name.includes("cattle");
          const isVet = file.name.includes("Vet");
          const isSeller = file.name.includes("Seller");
          let source = "Storage File";
          let title = fileName;
          if (isFarmerImg) { source = "Farmer Profile"; title = "Farmer Profile Photo"; }
          else if (isFarmImg) { source = "Farm"; title = "Farm Facility Photo"; }
          else if (isCattle) { source = "Cattle"; title = `Cattle Proof (${fileName})`; }
          else if (isVet) { source = "Veterinarian"; title = `Vet Proof (${fileName})`; }
          else if (isSeller) { source = "Seller"; title = `Seller Photo (${fileName})`; }
          addImg(file.url, title, source, file.updated ? new Date(file.updated).toLocaleDateString() : undefined, formatBytes(file.size));
        }
      });
    }

    return imagesList;
  }, [farmerDoc, farmDoc, sellerDoc, vetDoc, sellerProducts, mergedUserDoc, allUserCattle, backendFullData]);

  // Profile image URL
  const profilePhoto =
    farmerDoc?.imagePath ||
    sellerDoc?.imagePath ||
    vetDoc?.imagePath ||
    mergedUserDoc?.photoURL ||
    mergedUserDoc?.profileImage ||
    backendFullData?.profilePhotoUrl ||
    null;

  // Resolve Names and Contacts
  const userName =
    getLocalizedText(farmerDoc?.name) ||
    getLocalizedText(sellerDoc?.name) ||
    getLocalizedText(vetDoc?.name) ||
    getLocalizedText(mergedUserDoc?.name) ||
    getLocalizedText(mergedUserDoc?.displayName) ||
    authUser?.displayName ||
    "—";

  const displayEmail =
    mergedUserDoc?.email ||
    farmerDoc?.email ||
    sellerDoc?.email ||
    vetDoc?.email ||
    authUser?.email ||
    "No email provided";

  const displayPhone =
    farmerDoc?.farmerPhoneNumber ||
    farmerDoc?.phone ||
    farmerDoc?.phoneNumber ||
    sellerDoc?.sellerPhoneNumber ||
    sellerDoc?.phone ||
    vetDoc?.vetPhoneNumber ||
    vetDoc?.phone ||
    mergedUserDoc?.phoneNumber ||
    mergedUserDoc?.phone ||
    authUser?.phoneNumber ||
    "—";

  const rawJoined = mergedUserDoc?.createdAt || authUser?.createdAt || farmerDoc?.createdAt || sellerDoc?.createdAt || vetDoc?.createdAt;
  let joinedDate = "—";
  if (rawJoined) {
    const ms = rawJoined.seconds || rawJoined._seconds
      ? (rawJoined.seconds || rawJoined._seconds) * 1000
      : new Date(rawJoined).getTime();
    if (!isNaN(ms)) {
      joinedDate = new Date(ms).toLocaleDateString();
    }
  }

  // Active Role Flags
  const hasFarmerRole = Boolean(farmerDoc && (farmerDoc.name || farmerDoc.farmerPhoneNumber || farmerDoc.village || farmerDoc.state || farmerDoc.imagePath)) || allUserCattle.length > 0;
  const hasSellerRole = Boolean(sellerDoc && (sellerDoc.name || sellerDoc.sellerPhoneNumber || sellerDoc.village || sellerDoc.shopName || sellerDoc.imagePath)) || sellerProducts.length > 0;
  const hasVetRole = Boolean(vetDoc && (vetDoc.name || vetDoc.vetPhoneNumber || vetDoc.specialization || vetDoc.services || vetDoc.educationProof || vetDoc.identityProof));

  const activeRolesList: string[] = [];
  if (hasFarmerRole) activeRolesList.push("Farmer");
  if (hasSellerRole) activeRolesList.push("Seller");
  if (hasVetRole) activeRolesList.push("Veterinarian");
  if (activeRolesList.length === 0) activeRolesList.push("User");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const farmDisplayName = getLocalizedText(farmDoc?.name || (farmerDoc?.name ? `${farmerDoc.name}'s Dairy Farm` : "Registered Dairy Farm"));
  const farmName = farmDisplayName;
  const farmTechnique = getLocalizedText(farmDoc?.farmTechnique || "Modern Dairy Management");
  const farmLocation =
    [
      farmDoc?.village || farmerDoc?.village,
      farmDoc?.district || farmerDoc?.district,
      farmDoc?.state || farmerDoc?.state,
    ]
      .filter(Boolean)
      .map((v) => getLocalizedText(v))
      .join(", ") || "—";

  if (backendLoading && !backendFullData) {
    return (
      <div className="space-y-6 pb-12 animate-pulse">
        {/* Top bar skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-muted/60 rounded-xl" />
          <div className="flex gap-2">
            <div className="h-8 w-24 bg-muted/60 rounded-xl" />
            <div className="h-8 w-24 bg-muted/60 rounded-xl" />
          </div>
        </div>

        {/* Page title skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-72 bg-muted/70 rounded-xl" />
          <div className="h-4 w-96 bg-muted/40 rounded-lg" />
        </div>

        {/* Hero Card Skeleton */}
        <Card className="p-6 rounded-3xl border border-border/60 bg-card space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-6 items-center">
            <div className="h-24 w-24 rounded-full bg-muted/70 mx-auto md:mx-0" />
            <div className="space-y-2.5 text-center md:text-left">
              <div className="h-7 w-48 bg-muted/80 rounded-xl mx-auto md:mx-0" />
              <div className="h-4 w-64 bg-muted/50 rounded-lg mx-auto md:mx-0" />
              <div className="flex gap-2 justify-center md:justify-start">
                <div className="h-6 w-16 bg-muted/60 rounded-full" />
                <div className="h-6 w-20 bg-muted/60 rounded-full" />
              </div>
            </div>
            <div className="h-10 w-28 bg-muted/60 rounded-2xl mx-auto md:mx-0" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted/40 rounded-2xl" />
            ))}
          </div>
        </Card>

        {/* Tabs Skeleton */}
        <div className="space-y-4">
          <div className="h-12 w-full bg-muted/40 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-64 bg-muted/30 rounded-3xl" />
            <div className="h-64 bg-muted/30 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  const handleExportUserData = () => {
    if (allUserCattle.length > 0) {
      exportToCsv({
        filename: `user_${(userName !== "—" ? userName : userId).toLowerCase().replace(/[^a-z0-9]/g, "_")}_cattle_records`,
        data: allUserCattle,
        columns: [
          { header: "Tag No / RFID", accessor: (c: any) => c.tagNo || c.rfid || c.id },
          { header: "Cattle Name / Title", accessor: (c: any) => getLocalizedText(c.title || c.cattleName || c.name) },
          { header: "Breed", accessor: (c: any) => getLocalizedText(c.breed) },
          { header: "Species", accessor: (c: any) => getLocalizedText(c.species) },
          { header: "Gender", accessor: (c: any) => getLocalizedText(c.gender) },
          { header: "Age", accessor: (c: any) => getLocalizedText(c.age) },
          { header: "Milk Yield", accessor: (c: any) => getLocalizedText(c.milkYield || c.dailyYield) },
          { header: "Price (INR)", accessor: (c: any) => c.price || c.value || "—" },
          { header: "Status", accessor: (c: any) => getLocalizedText(c.status) },
          { header: "Owner Name", accessor: () => userName },
          { header: "Owner UID", accessor: () => userId },
          { header: "Owner Phone", accessor: () => displayPhone },
          { header: "Farm Name", accessor: () => farmName },
          { header: "Location", accessor: () => farmLocation !== "—" ? farmLocation : (farmerDoc?.state || "—") },
        ],
      });
    } else {
      exportToCsv({
        filename: `user_profile_${(userName !== "—" ? userName : userId).toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
        data: [
          {
            userName,
            userId,
            displayPhone,
            displayEmail,
            roles: activeRolesList.join(", "),
            status: mergedUserDoc?.status || authUser?.status || "Active",
            joinedDate,
            farmName: farmName !== "—" ? farmName : "None",
            farmTechnique: farmTechnique !== "—" ? farmTechnique : "None",
            farmLocation: farmLocation !== "—" ? farmLocation : "None",
            cattleCount: allUserCattle.length,
            sellerShop: sellerDoc?.shopName || sellerDoc?.name || "None",
            vetClinic: vetDoc?.clinic || vetDoc?.hospital || "None",
          },
        ],
        columns: [
          { header: "User Name", accessor: "userName" },
          { header: "User UID", accessor: "userId" },
          { header: "Phone Number", accessor: "displayPhone" },
          { header: "Email", accessor: "displayEmail" },
          { header: "Roles", accessor: "roles" },
          { header: "Account Status", accessor: "status" },
          { header: "Joined Date", accessor: "joinedDate" },
          { header: "Farm Name", accessor: "farmName" },
          { header: "Farm Technique", accessor: "farmTechnique" },
          { header: "Farm Location", accessor: "farmLocation" },
          { header: "Registered Cattle Count", accessor: "cattleCount" },
          { header: "Seller Shop", accessor: "sellerShop" },
          { header: "Vet Clinic", accessor: "vetClinic" },
        ],
      });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top back button & Actions */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <Link to="/users">
            <ArrowLeft className="h-4 w-4" /> Back to users
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleExportUserData}
            title="Export full user profile & cattle records to CSV"
          >
            <Download className="h-3.5 w-3.5" /> Export Data (CSV)
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={isRefreshing}
            onClick={async () => {
              try {
                setIsRefreshing(true);
                await fetch(`${API_BASE}/api/admin/user-full-data/${encodeURIComponent(resolvedDocId || userId)}?refresh=1`).catch(() => {});
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ["userFullData"] }),
                  queryClient.invalidateQueries({ queryKey: ["directFarmerRole"] }),
                  queryClient.invalidateQueries({ queryKey: ["admin_users"] }),
                ]);
                await refetchFullData();
                toast.success("User and farm data refreshed successfully!");
              } catch {
                toast.error("Failed to refresh data");
              } finally {
                setIsRefreshing(false);
              }
            }}
            title="Refresh connected data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh Data"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => copyToClipboard(userId)}
          >
            {copiedId ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedId ? "Copied UID" : "Copy UID"}
          </Button>
        </div>
      </div>

      <PageHeader
        title="Connected User, Farm, Cattle, Seller & Vet Profile"
        description={`All Firestore role documents, farm location data, cattle records, and verification proofs linked to ${userName !== "—" ? userName : userId}`}
      />

      {/* Hero card with Profile Photo */}
      <Card className="p-6 rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-6 items-center">
          <div className="flex justify-center md:justify-start">
            {profilePhoto ? (
              <div
                className="relative h-24 w-24 rounded-full overflow-hidden ring-4 ring-primary/20 shadow-md cursor-pointer group"
                onClick={() => setSelectedPreviewImage({ url: profilePhoto, title: `${userName} - Profile Photo` })}
              >
                <img
                  src={profilePhoto}
                  alt={userName}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Eye className="h-5 w-5" />
                </div>
              </div>
            ) : (
              <div className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-3xl font-bold ring-4 ring-primary/10 shadow-sm">
                {(userName !== "—" ? userName : "US").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
              </div>
            )}
          </div>

          <div className="text-center md:text-left space-y-1.5">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <h2 className="text-2xl font-bold text-foreground capitalize">{userName !== "—" ? userName : "User Account"}</h2>
              <StatusBadge status={mergedUserDoc?.status || authUser?.status || "Active"} />
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-muted-foreground">
              <span className="font-mono bg-muted/60 px-2 py-0.5 rounded select-all border border-border/40">
                UID: {resolvedDocId || userId}
              </span>
              <span>• Joined {joinedDate}</span>
              {displayPhone !== "—" && <span className="font-semibold text-foreground">• {displayPhone}</span>}
              {(farmerDoc?.state || sellerDoc?.state || vetDoc?.state) && (
                <span>• {farmerDoc?.state || sellerDoc?.state || vetDoc?.state}</span>
              )}
            </div>
            <div className="flex flex-wrap justify-center md:justify-start gap-1.5 pt-1">
              {activeRolesList.map((role: string) => (
                <span
                  key={role}
                  className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20"
                >
                  {role}
                </span>
              ))}
              {allUserCattle.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-500/20">
                  {allUserCattle.length} Cattle Registered
                </span>
              )}
              {allMediaImages.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 border border-blue-500/20">
                  {allMediaImages.length} Storage Images
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs list with dynamic counts */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-2xl flex flex-wrap h-auto gap-1 border border-border/50">
          <TabsTrigger value="overview" className="rounded-xl gap-2 text-xs md:text-sm">
            <User className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="farmer" className="rounded-xl gap-2 text-xs md:text-sm">
            <Tractor className="h-4 w-4" /> Farmer & Farm Profile
            {hasFarmerRole && <span className="h-2 w-2 rounded-full bg-success animate-pulse" />}
          </TabsTrigger>
          <TabsTrigger value="cattle" className="rounded-xl gap-2 text-xs md:text-sm">
            <Beef className="h-4 w-4" /> Cattle ({allUserCattle.length})
          </TabsTrigger>
          <TabsTrigger value="seller" className="rounded-xl gap-2 text-xs md:text-sm">
            <Store className="h-4 w-4" /> Seller Profile
            {hasSellerRole && <span className="h-2 w-2 rounded-full bg-success animate-pulse" />}
          </TabsTrigger>
          <TabsTrigger value="vet" className="rounded-xl gap-2 text-xs md:text-sm">
            <Stethoscope className="h-4 w-4" /> Veterinarian Profile
            {hasVetRole && <span className="h-2 w-2 rounded-full bg-success animate-pulse" />}
          </TabsTrigger>
          <TabsTrigger value="media" className="rounded-xl gap-2 text-xs md:text-sm">
            <ImageIcon className="h-4 w-4" /> Storage & Gallery ({allMediaImages.length})
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-xl gap-2 text-xs md:text-sm">
            <ShoppingCart className="h-4 w-4" /> Orders ({allCattleOrders.length + allProductOrders.length + allTokenAdvances.length})
          </TabsTrigger>
          <TabsTrigger value="issues" className="rounded-xl gap-2 text-xs md:text-sm">
            <AlertCircle className="h-4 w-4" /> Issues ({allIssues.length})
          </TabsTrigger>
          <TabsTrigger value="raw" className="rounded-xl gap-2 text-xs md:text-sm">
            <Code2 className="h-4 w-4" /> Raw Data Explorer
          </TabsTrigger>
        </TabsList>

        {/* 1. OVERVIEW TAB */}
        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-6 rounded-3xl border shadow-sm space-y-4">
              <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-5 w-5 text-primary" /> Firestore Document Summary
              </h3>
              <div className="space-y-1 divide-y divide-border/40">
                <InfoRow icon={User} label="User Name" value={userName} />
                <InfoRow
                  icon={Building}
                  label={farmsList.length > 1 ? `Registered Farms (${farmsList.length})` : "Registered Farm"}
                  value={
                    farmsList.length > 1
                      ? `${farmsList.length} Farms (${farmsList.map((f) => getLocalizedText(f.name || f.farmName)).join(", ")})`
                      : farmDisplayName
                  }
                />
                <InfoRow icon={Mail} label="Email Address" value={displayEmail} />
                <InfoRow icon={Phone} label="Phone Number" value={displayPhone} />
                <InfoRow icon={Clock} label="Registered Roles" value={activeRolesList.join(", ")} />
                <InfoRow icon={Calendar} label="Firestore Joined Date" value={joinedDate} />
                <InfoRow
                  icon={MapPin}
                  label="Location"
                  value={`${farmerDoc?.village || sellerDoc?.village || vetDoc?.village || "—"}, ${farmerDoc?.state || sellerDoc?.state || vetDoc?.state || "—"}`}
                />
              </div>
            </Card>

            <Card className="p-6 rounded-3xl border shadow-sm space-y-4">
              <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                <Clock className="h-5 w-5 text-primary" /> Firebase Authentication Record
              </h3>
              <div className="space-y-1 divide-y divide-border/40">
                <InfoRow icon={User} label="Auth UID" value={authUser?.uid || resolvedDocId || userId} />
                <InfoRow icon={Mail} label="Auth Email" value={authUser?.email || displayEmail} />
                <InfoRow icon={Phone} label="Auth Phone" value={authUser?.phoneNumber || displayPhone} />
                <InfoRow
                  icon={Calendar}
                  label="Auth Created At"
                  value={authUser?.createdAt ? new Date(authUser.createdAt).toLocaleString() : "—"}
                />
                <InfoRow
                  icon={Activity}
                  label="Last Login / Activity"
                  value={authUser?.lastLoginAt ? new Date(authUser.lastLoginAt).toLocaleString() : "—"}
                />
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* 2. FARMER & FARM PROFILE TAB */}
        <TabsContent value="farmer">
          {hasFarmerRole ? (
            <div className="space-y-6">
              {/* Header with summary stats */}
              <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-3xl bg-muted/30 border border-border/50">
                <div className="space-y-0.5">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                    <Building className="h-5 w-5 text-primary" />
                    Registered Farms ({farmsList.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    All {farmsList.length} dairy farm facilities registered by this farmer, along with all cattle belonging to each farm.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary border border-primary/20">
                    <Beef className="h-3.5 w-3.5" />
                    {allUserCattle.length} Total Livestock Across Farms
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-bold text-success border border-success/20">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified Farmer
                  </span>
                </div>
              </div>

              {/* Render Every Registered Farm with its Complete Data & Cattle */}
              {farmsList.map((farm: any, farmIdx: number) => {
                const farmCattles = getCattleForFarm(farm);
                const displayName = getLocalizedText(
                  farm.name || farm.farmName || (farmsList.length > 1 ? `Farm #${farmIdx + 1}` : "Registered Dairy Farm")
                );
                const farmFarmingTechnique = getLocalizedText(farm.farmTechnique || "Modern Dairy Management");
                const statedAnimals = farm.numberOfAnimals || "—";
                const farmPhone = farm.farmPhoneNumber || farm.phone || farmerDoc?.farmerPhoneNumber || displayPhone;

                return (
                  <Card key={farm.id || farmIdx} className="p-6 rounded-3xl border shadow-sm space-y-6 bg-gradient-to-br from-card to-primary/[0.02]">
                    {/* Farm Top Banner */}
                    <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-border/50">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary font-bold text-sm">
                            #{farmIdx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xl font-bold text-foreground capitalize">{displayName}</h3>
                              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-bold text-success border border-success/20">
                                <CheckCircle2 className="h-3 w-3" /> Registered
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">
                              Farm ID: <span className="font-bold text-foreground">{farm.farmId || farm.id || "—"}</span>
                              {farm.sourcePath && <span className="ml-2 text-[10px] text-muted-foreground/70 hidden sm:inline">({farm.sourcePath})</span>}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs rounded-xl h-8"
                          onClick={() => handleOpenEditFarm(farm)}
                        >
                          <Edit className="h-3.5 w-3.5 text-primary" /> Edit Farm #{farmIdx + 1}
                        </Button>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary border border-primary/20">
                          <Beef className="h-3.5 w-3.5" />
                          {farmCattles.length} Cattle in this Farm
                        </span>
                        {farm.animal && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground border border-border/60 capitalize">
                            {getLocalizedText(farm.animal)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Facility Photo if available */}
                    {farm.imagePath && (
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/40 border border-border/50">
                        <img
                          src={farm.imagePath}
                          alt={displayName}
                          className="h-20 w-24 rounded-xl object-cover ring-2 ring-primary/20 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedPreviewImage({ url: farm.imagePath, title: displayName })}
                        />
                        <div>
                          <h4 className="font-bold text-base text-foreground capitalize">{displayName}</h4>
                          <p className="text-xs text-muted-foreground">Farm Facility Photo stored in Firebase Storage</p>
                        </div>
                      </div>
                    )}

                    {/* 2-Column Details Grid */}
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-1 divide-y divide-border/40">
                        <InfoRow icon={Building} label="Farm Name" value={displayName} />
                        <InfoRow icon={Phone} label="Farm Contact Phone" value={farmPhone} />
                        <InfoRow icon={Beef} label="Primary Livestock / Animal" value={getLocalizedText(farm.animal || "Cow / Cattle")} />
                        <InfoRow icon={Activity} label="Farming Technique" value={farmFarmingTechnique} />
                        <InfoRow icon={Users} label="Farm Workers / Employees" value={String(farm.numberOfEmployees || "1 - 2 Workers")} />
                        <InfoRow icon={Layers} label="Stated Capacity / Animals" value={String(statedAnimals)} />
                      </div>
                      <div className="space-y-1 divide-y divide-border/40">
                        <InfoRow icon={MapPin} label="Village" value={getLocalizedText(farm.village || farmerDoc?.village || "—")} />
                        <InfoRow icon={Building} label="Taluk" value={getLocalizedText(farm.taluk || farmerDoc?.taluk || "—")} />
                        <InfoRow icon={MapPin} label="Post Office" value={getLocalizedText(farm.postoffice || farmerDoc?.postoffice || "—")} />
                        <InfoRow icon={MapPin} label="District" value={getLocalizedText(farm.district || farmerDoc?.district || "—")} />
                        <InfoRow icon={MapPin} label="State" value={getLocalizedText(farm.state || farmerDoc?.state || "—")} />
                        <InfoRow icon={MapPin} label="Pincode" value={getLocalizedText(farm.pincode || farmerDoc?.pincode || "—")} />
                      </div>
                    </div>

                    {/* Farm Equipment Badges */}
                    {Array.isArray(farm.farmEquipmentList) && farm.farmEquipmentList.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Wrench className="h-3.5 w-3.5 text-primary" /> Farm Equipment & Infrastructure ({farm.farmEquipmentList.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {farm.farmEquipmentList.map((eq: any, eIdx: number) => {
                            const eqStr = getLocalizedText(eq?.key || eq);
                            return (
                              <span key={eIdx} className="px-3 py-1 rounded-xl bg-muted text-foreground text-xs font-medium border border-border/60 capitalize">
                                {eqStr.replace(/_/g, " ")}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Geo Coordinates & Veterinarian */}
                    {(farm.latitude || farm.veterinaryName) && (
                      <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                        {farm.latitude && (
                          <div className="flex items-center gap-2">
                            <Compass className="h-4 w-4 text-primary" />
                            <span>Coordinates: <span className="font-mono font-bold text-foreground">{getLocalizedText(farm.latitude)}, {getLocalizedText(farm.longitude)}</span></span>
                          </div>
                        )}
                        {farm.veterinaryName && (
                          <div className="flex items-center gap-2">
                            <Stethoscope className="h-4 w-4 text-primary" />
                            <span>Assigned Vet: <span className="font-bold text-foreground">{getLocalizedText(farm.veterinaryName)}</span> ({getLocalizedText(farm.veterinarianPhoneNumber, "—")})</span>
                          </div>
                        )}
                      </div>
                    )}

                    {farm.address && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Registered Farm Address
                        </h4>
                        <p className="text-sm text-foreground bg-muted/40 p-4 rounded-2xl font-medium border border-border/40">
                          {getLocalizedText(farm.address)}
                        </p>
                      </div>
                    )}

                    {/* CATTLE SECTION UNDER THIS FARM */}
                    <div className="pt-5 border-t border-border/60 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Beef className="h-4 w-4 text-primary" />
                          <h4 className="font-bold text-sm text-foreground">
                            Livestock under "{displayName}" ({farmCattles.length} Registered)
                          </h4>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-2.5 py-0.5 rounded-lg border border-border/40">
                          Farm ID: {farm.farmId || farm.id}
                        </span>
                      </div>

                      {farmCattles.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-muted/20 border border-dashed border-border/60 text-center space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground">No cattle registered under this farm yet.</p>
                          <p className="text-[11px] text-muted-foreground">Animals tagged with Farm ID {farm.farmId || farm.id} will appear directly in this section.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {farmCattles.map((cattle: any, cIdx: number) => {
                            const cTitle = getLocalizedText(cattle.cattleName || cattle.name || cattle.title || cattle.breed || "Cattle");
                            const cBreed = getLocalizedText(cattle.breed?.key || cattle.breed || "—");
                            const cImg = cattle.faceView || cattle.leftView || cattle.rightView || (Array.isArray(cattle.images) && cattle.images[0]) || cattle.imageUrl;
                            return (
                              <Card key={cattle.id || cIdx} className="rounded-2xl border border-border/60 overflow-hidden bg-card/60 hover:shadow-md transition-all flex flex-col justify-between">
                                {cImg ? (
                                  <div className="h-36 bg-muted relative overflow-hidden group">
                                    <img
                                      src={cImg}
                                      alt={cTitle}
                                      className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                                      onClick={() => setSelectedPreviewImage({ url: cImg, title: `${cTitle} - ${displayName}` })}
                                    />
                                    {cattle.rfid && (
                                      <span className="absolute top-2 right-2 bg-black/75 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md backdrop-blur-md">
                                        {getLocalizedText(cattle.rfid)}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="h-28 bg-muted/50 flex flex-col items-center justify-center text-muted-foreground gap-1">
                                    <Beef className="h-6 w-6 text-primary/40" />
                                    <span className="text-[11px]">No Photo</span>
                                  </div>
                                )}
                                <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                                  <div>
                                    <div className="flex items-start justify-between gap-1.5">
                                      <h5 className="font-bold text-sm text-foreground capitalize truncate">{cTitle}</h5>
                                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-bold">
                                        {getLocalizedText(cattle.species, "Cow")}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">Breed: <span className="font-medium text-foreground">{cBreed}</span></p>
                                    <div className="grid grid-cols-2 gap-1.5 pt-2 text-[11px] text-muted-foreground">
                                      <div><span className="text-muted-foreground/70">Gender:</span> <span className="capitalize text-foreground font-medium">{getLocalizedText(cattle.gender, "Female")}</span></div>
                                      {cattle.milkYield && <div><span className="text-muted-foreground/70">Milk:</span> <span className="text-foreground font-medium">{getLocalizedText(cattle.milkYield)} L/d</span></div>}
                                      {cattle.age && <div><span className="text-muted-foreground/70">Age:</span> <span className="text-foreground font-medium">{getLocalizedText(cattle.age)}</span></div>}
                                      {cattle.value && <div><span className="text-muted-foreground/70">Val:</span> <span className="text-foreground font-medium">₹{getLocalizedText(cattle.value)}</span></div>}
                                    </div>
                                  </div>
                                  <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                                    <span className="text-[10px] text-muted-foreground font-mono">#{cattle.id?.slice(-6)}</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary font-semibold rounded-md"
                                      onClick={() => setSelectedCattleDetail(cattle)}
                                    >
                                      <Maximize2 className="h-3 w-3" /> View Data
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}

              {/* Unassigned Cattle Section if any */}
              {unassignedCattle.length > 0 && (
                <Card className="p-6 rounded-3xl border border-dashed shadow-sm space-y-4 bg-muted/10">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Beef className="h-5 w-5 text-primary" />
                      <h4 className="font-bold text-base text-foreground">
                        Additional Registered Livestock ({unassignedCattle.length})
                      </h4>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Livestock without a specific Farm ID or registered under primary profile
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {unassignedCattle.map((cattle: any, cIdx: number) => {
                      const cTitle = getLocalizedText(cattle.cattleName || cattle.name || cattle.title || cattle.breed || "Cattle");
                      const cBreed = getLocalizedText(cattle.breed?.key || cattle.breed || "—");
                      const cImg = cattle.faceView || cattle.leftView || cattle.rightView || (Array.isArray(cattle.images) && cattle.images[0]) || cattle.imageUrl;
                      return (
                        <Card key={cattle.id || cIdx} className="rounded-2xl border border-border/60 overflow-hidden bg-card/60 hover:shadow-md transition-all flex flex-col justify-between">
                          {cImg && (
                            <div className="h-36 bg-muted relative overflow-hidden group">
                              <img
                                src={cImg}
                                alt={cTitle}
                                className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                                onClick={() => setSelectedPreviewImage({ url: cImg, title: cTitle })}
                              />
                              {cattle.rfid && (
                                <span className="absolute top-2 right-2 bg-black/75 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md backdrop-blur-md">
                                  {getLocalizedText(cattle.rfid)}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between gap-1.5">
                                <h5 className="font-bold text-sm text-foreground capitalize truncate">{cTitle}</h5>
                                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-bold">
                                  {getLocalizedText(cattle.species, "Cow")}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">Breed: <span className="font-medium text-foreground">{cBreed}</span></p>
                            </div>
                            <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground font-mono">#{cattle.id?.slice(-6)}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary font-semibold rounded-md"
                                onClick={() => setSelectedCattleDetail(cattle)}
                              >
                                <Maximize2 className="h-3 w-3" /> View Data
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Farmer personal card */}
              <Card className="p-6 rounded-3xl border shadow-sm space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                      <Tractor className="h-5 w-5 text-primary" /> Farmer Personal Profile
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Loaded from path: <span className="font-mono text-foreground font-semibold">/users/{resolvedDocId}/roles/farmer</span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success border border-success/20">
                    <CheckCircle2 className="h-4 w-4" />
                    Verified Farmer
                  </span>
                </div>

                {farmerDoc?.imagePath && (
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/40 border border-border/50">
                    <img
                      src={farmerDoc.imagePath}
                      alt="Farmer"
                      className="h-16 w-16 rounded-xl object-cover ring-2 ring-primary/20 cursor-pointer"
                      onClick={() => setSelectedPreviewImage({ url: farmerDoc.imagePath, title: "Farmer Profile Image" })}
                    />
                    <div>
                      <h4 className="font-bold text-base text-foreground capitalize">{getLocalizedText(farmerDoc.name || userName)}</h4>
                      <p className="text-xs text-muted-foreground">Farmer Profile Image stored in Firebase Storage</p>
                      <a
                        href={farmerDoc.imagePath}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1 mt-1"
                      >
                        Open Full Image <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-1 divide-y divide-border/40">
                    <InfoRow icon={User} label="Farmer Name" value={getLocalizedText(farmerDoc.name || userName)} />
                    <InfoRow icon={Phone} label="Farmer Phone Number" value={farmerDoc.farmerPhoneNumber || farmerDoc.phone || displayPhone} />
                    <InfoRow icon={Building} label="Village" value={getLocalizedText(farmerDoc.village || "—")} />
                    <InfoRow icon={Building} label="Taluk" value={getLocalizedText(farmerDoc.taluk || "—")} />
                  </div>
                  <div className="space-y-1 divide-y divide-border/40">
                    <InfoRow icon={MapPin} label="Post Office" value={getLocalizedText(farmerDoc.postoffice || farmerDoc.postOffice || "—")} />
                    <InfoRow icon={MapPin} label="District" value={getLocalizedText(farmerDoc.district || "—")} />
                    <InfoRow icon={MapPin} label="State" value={getLocalizedText(farmerDoc.state || farmerDoc.stateCode || "—")} />
                    <InfoRow icon={MapPin} label="Pincode" value={farmerDoc.pincode || farmerDoc.pinCode || "—"} />
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <Card className="p-8 rounded-3xl border text-center space-y-4">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <BadgeAlert className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-foreground">Farmer Role Not Registered</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  This user has not completed the farmer registration in the iHerd app.
                </p>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* 3. CATTLE RECORDS TAB */}
        <TabsContent value="cattle">
          <Card className="p-6 rounded-3xl border shadow-sm space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Beef className="h-5 w-5 text-primary" /> Registered Cattle Records ({filteredCattleList.length}{filteredCattleList.length !== allUserCattle.length ? ` of ${allUserCattle.length}` : ""})
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All cattle registered by this user with multi-angle photo proofs, RFID tags, and assigned farm facility
                </p>
              </div>
            </div>

            {/* Farm Filter Pills Bar */}
            {farmsList.length > 1 && (
              <div className="flex items-center gap-2 p-2 rounded-2xl bg-muted/30 border border-border/50 overflow-x-auto">
                <Button
                  size="sm"
                  variant={selectedFarmFilter === "all" ? "default" : "outline"}
                  onClick={() => setSelectedFarmFilter("all")}
                  className="rounded-xl text-xs h-8 gap-1.5 shrink-0"
                >
                  <Beef className="h-3.5 w-3.5" />
                  All Farms ({allUserCattle.length})
                </Button>
                {farmsList.map((f: any, idx: number) => {
                  const count = getCattleForFarm(f).length;
                  const name = getLocalizedText(f.name || f.farmName || `Farm #${idx + 1}`);
                  const fKey = String(f.id || f.farmId);
                  return (
                    <Button
                      key={idx}
                      size="sm"
                      variant={selectedFarmFilter === fKey ? "default" : "outline"}
                      onClick={() => setSelectedFarmFilter(fKey)}
                      className="rounded-xl text-xs h-8 gap-1.5 shrink-0"
                    >
                      <Building className="h-3.5 w-3.5" />
                      {name} ({count})
                    </Button>
                  );
                })}
                {unassignedCattle.length > 0 && (
                  <Button
                    size="sm"
                    variant={selectedFarmFilter === "unassigned" ? "default" : "outline"}
                    onClick={() => setSelectedFarmFilter("unassigned")}
                    className="rounded-xl text-xs h-8 gap-1.5 shrink-0"
                  >
                    Unassigned ({unassignedCattle.length})
                  </Button>
                )}
              </div>
            )}

            {filteredCattleList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredCattleList.map((cattle: any, idx: number) => {
                  const title = getLocalizedText(cattle.cattleName || cattle.title || cattle.breed || "Cattle");
                  const breed = getLocalizedText(cattle.breed?.key || cattle.breed || "—");
                  const primaryImg = cattle.faceView || cattle.leftView || cattle.rightView || (Array.isArray(cattle.images) && cattle.images[0]) || cattle.imageUrl;
                  const assignedFarm = farmsList.find((f: any) => String(f.id || f.farmId) === String(cattle.farmId));
                  const assignedFarmName = assignedFarm ? getLocalizedText(assignedFarm.name || assignedFarm.farmName) : cattle.farmId;

                  const anglePhotos = [
                    { name: "Face", url: cattle.faceView },
                    { name: "Left", url: cattle.leftView },
                    { name: "Right", url: cattle.rightView },
                    { name: "Muzzle", url: cattle.muzzleView },
                    { name: "Udder", url: cattle.udderView },
                    { name: "Top/Bottom", url: cattle.bottomView || cattle.topview },
                    { name: "Farmer", url: cattle.farmerView },
                  ].filter(p => !!p.url);

                  const regDate = cattle.createdAt
                    ? (cattle.createdAt.seconds || cattle.createdAt._seconds
                      ? new Date((cattle.createdAt.seconds || cattle.createdAt._seconds) * 1000).toLocaleDateString()
                      : new Date(cattle.createdAt).toLocaleDateString())
                    : "—";

                  return (
                    <Card key={idx} className="rounded-3xl overflow-hidden border border-border/60 hover:shadow-lg transition-all bg-card flex flex-col">
                      {primaryImg && (
                        <div className="h-56 bg-muted overflow-hidden relative group">
                          <img
                            src={primaryImg}
                            alt={title}
                            className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-300"
                            onClick={() => setSelectedPreviewImage({ url: primaryImg, title: `${title} - Front View` })}
                          />
                          <div className="absolute top-3 right-3 flex items-center gap-2">
                            {cattle.rfid && (
                              <span className="bg-black/75 text-white text-xs font-mono font-bold px-3 py-1 rounded-full backdrop-blur-md border border-white/20 shadow-sm">
                                RFID: {getLocalizedText(cattle.rfid)}
                              </span>
                            )}
                            <StatusBadge status={cattle.status || "Active"} />
                          </div>
                        </div>
                      )}

                      <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-xl text-foreground capitalize">{title}</h4>
                              <p className="text-xs text-muted-foreground font-mono">ID: {getLocalizedText(cattle.cattleId || cattle.id)}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {assignedFarmName && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-muted text-foreground border border-border/60">
                                  <Building className="h-3 w-3 text-primary" />
                                  {assignedFarmName}
                                </span>
                              )}
                              {cattle.species && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                  {getLocalizedText(cattle.species, "Cow")}
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 rounded-lg"
                                onClick={() => setSelectedCattleDetail(cattle)}
                              >
                                <Maximize2 className="h-3 w-3" /> Full Data
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-border/40 text-muted-foreground bg-muted/20 p-3 rounded-2xl">
                            <div>
                              <span className="font-semibold text-foreground">Breed:</span> {breed}
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Species:</span> {getLocalizedText(cattle.species, "Cow")}
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">RFID Tag:</span> {getLocalizedText(cattle.rfid, "—")}
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Registered:</span> {regDate}
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Owner UID:</span> <span className="font-mono text-[11px] truncate block max-w-[130px]">{getLocalizedText(cattle.ownerUid || userId)}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Source:</span> {getLocalizedText(cattle.source, "cattle_details")}
                            </div>
                          </div>
                        </div>

                        {/* Angle photos strip */}
                        {anglePhotos.length > 0 && (
                          <div className="pt-3 border-t border-border/40">
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Camera className="h-3.5 w-3.5 text-primary" /> Multi-Angle Proofs ({anglePhotos.length})
                              </span>
                              <span className="text-[10px] text-primary">Click to zoom</span>
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {anglePhotos.map((angle, aIdx) => (
                                <div
                                  key={aIdx}
                                  className="relative h-16 w-16 shrink-0 rounded-2xl overflow-hidden border border-border/60 bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all group"
                                  onClick={() => setSelectedPreviewImage({ url: angle.url, title: `${title} - ${angle.name} View` })}
                                  title={`${angle.name} View`}
                                >
                                  <img src={angle.url} alt={angle.name} className="h-full w-full object-cover group-hover:scale-110 transition-transform" />
                                  <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] text-center font-bold truncate py-0.5">
                                    {angle.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center space-y-3 bg-muted/20 rounded-2xl border border-dashed">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Beef className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">No Cattle Records Found</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    No cattle have been registered under this user in Firestore `cattle_details` or `cattle-marketplace`.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* 4. SELLER PROFILE TAB */}
        <TabsContent value="seller">
          {hasSellerRole ? (
            <div className="space-y-6">
              <Card className="p-6 rounded-3xl border shadow-sm space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                      <Store className="h-5 w-5 text-primary" /> Seller Store & Profile
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Loaded from path: <span className="font-mono text-foreground font-semibold">/users/{resolvedDocId}/roles/seller</span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success border border-success/20">
                    <CheckCircle2 className="h-4 w-4" />
                    Verified Seller
                  </span>
                </div>

                {sellerDoc.imagePath && (
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/40 border border-border/50">
                    <img
                      src={sellerDoc.imagePath}
                      alt="Seller"
                      className="h-16 w-16 rounded-xl object-cover ring-2 ring-primary/20 cursor-pointer"
                      onClick={() => setSelectedPreviewImage({ url: sellerDoc.imagePath, title: "Seller Store Image" })}
                    />
                    <div>
                      <h4 className="font-bold text-base text-foreground capitalize">{getLocalizedText(sellerDoc.name || userName)}</h4>
                      <p className="text-xs text-muted-foreground">Seller Image stored in Firebase Storage</p>
                    </div>
                  </div>
                )}

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-1 divide-y divide-border/40">
                    <InfoRow icon={Store} label="Store / Business Name" value={getLocalizedText(sellerDoc.name || sellerDoc.shopName || "—")} />
                    <InfoRow icon={Phone} label="Seller Phone Number" value={sellerDoc.sellerPhoneNumber || sellerDoc.phone || displayPhone} />
                    <InfoRow icon={Building} label="Village / City / Town" value={getLocalizedText(sellerDoc.village || sellerDoc.city || sellerDoc.town || "—")} />
                    <InfoRow icon={Building} label="Taluk / Tehsil" value={getLocalizedText(sellerDoc.taluk || sellerDoc.tehsil || "—")} />
                  </div>
                  <div className="space-y-1 divide-y divide-border/40">
                    <InfoRow icon={MapPin} label="District" value={getLocalizedText(sellerDoc.district || sellerDoc.districtName || "—")} />
                    <InfoRow icon={MapPin} label="State" value={getLocalizedText(sellerDoc.state || sellerDoc.stateName || sellerDoc.stateCode || "—")} />
                    <InfoRow icon={MapPin} label="Pincode" value={sellerDoc.pincode || sellerDoc.pinCode || "—"} />
                    <InfoRow icon={MapPin} label="Country" value={sellerDoc.country || "🇮🇳 India"} />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    <MapPin className="h-4 w-4 shrink-0" /> Full Seller Store Location
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {sellerDoc.address
                      ? getLocalizedText(sellerDoc.address)
                      : [
                          getLocalizedText(sellerDoc.village || sellerDoc.city || sellerDoc.town),
                          getLocalizedText(sellerDoc.taluk || sellerDoc.tehsil),
                          getLocalizedText(sellerDoc.district || sellerDoc.districtName),
                          getLocalizedText(sellerDoc.state || sellerDoc.stateName),
                          sellerDoc.pincode || sellerDoc.pinCode,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Location details not specified"}
                  </p>
                </div>
              </Card>

              {/* Seller Listed Products */}
              <Card className="p-6 rounded-3xl border shadow-sm space-y-4">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Package className="h-5 w-5 text-primary" /> Products Listed by Seller ({sellerProducts.length})
                </h3>
                {sellerProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {sellerProducts.map((prod: any, pIdx: number) => (
                      <Card key={pIdx} className="rounded-2xl p-3 border bg-card flex flex-col justify-between">
                        {prod.image && (
                          <img src={prod.image} alt={prod.name} className="h-32 w-full object-cover rounded-xl mb-2" />
                        )}
                        <div>
                          <h5 className="font-bold text-sm text-foreground truncate">{prod.name || prod.title}</h5>
                          <p className="text-xs text-primary font-bold">₹{prod.price || "0"}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No marketplace products listed under this seller ID yet.</p>
                )}
              </Card>
            </div>
          ) : (
            <Card className="p-8 rounded-3xl border text-center space-y-4">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <Store className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-foreground">Seller Role Not Registered</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  This user has not registered as a product seller in the iHerd platform.
                </p>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* 5. VETERINARIAN PROFILE TAB */}
        <TabsContent value="vet">
          {hasVetRole ? (
            <div className="space-y-6">
              {/* Doctor Details Card */}
              <Card className="p-6 rounded-3xl border shadow-sm space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                      <Stethoscope className="h-5 w-5 text-primary" /> Veterinarian Doctor Profile
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Loaded from path: <span className="font-mono text-foreground font-semibold">/users/{resolvedDocId}/roles/veterinarian</span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success border border-success/20">
                    <CheckCircle2 className="h-4 w-4" />
                    Verified Veterinarian
                  </span>
                </div>

                {vetDoc.imagePath && (
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/40 border border-border/50">
                    <img
                      src={vetDoc.imagePath}
                      alt="Doctor"
                      className="h-16 w-16 rounded-xl object-cover ring-2 ring-primary/20 cursor-pointer"
                      onClick={() => setSelectedPreviewImage({ url: vetDoc.imagePath, title: "Doctor Profile Photo" })}
                    />
                    <div>
                      <h4 className="font-bold text-base text-foreground capitalize">Dr. {getLocalizedText(vetDoc.name || userName)}</h4>
                      <p className="text-xs text-muted-foreground">{vetDoc.yearsOfExperience ? `${vetDoc.yearsOfExperience} Years Experience` : "Registered Veterinarian"}</p>
                    </div>
                  </div>
                )}

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-1 divide-y divide-border/40">
                    <InfoRow icon={User} label="Doctor Name" value={`Dr. ${getLocalizedText(vetDoc.name || userName)}`} />
                    <InfoRow icon={Phone} label="Doctor Contact Phone" value={vetDoc.vetPhoneNumber || vetDoc.phone || displayPhone} />
                    <InfoRow icon={Briefcase} label="Years of Experience" value={vetDoc.yearsOfExperience ? `${vetDoc.yearsOfExperience} years` : "—"} />
                    <InfoRow icon={Building} label="Institution / Clinic" value={getLocalizedText(vetDoc.addInstitution || vetDoc.clinic || "—")} />
                  </div>
                  <div className="space-y-1 divide-y divide-border/40">
                    <InfoRow icon={Building} label="Clinic / Practice Location" value={getLocalizedText(vetDoc.village || vetDoc.city || vetDoc.town || "—")} />
                    <InfoRow icon={MapPin} label="District" value={getLocalizedText(vetDoc.district || vetDoc.districtName || "—")} />
                    <InfoRow icon={MapPin} label="State" value={getLocalizedText(vetDoc.state || vetDoc.stateName || vetDoc.stateCode || "—")} />
                    <InfoRow icon={MapPin} label="Pincode" value={vetDoc.pincode || vetDoc.pinCode || "—"} />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    <MapPin className="h-4 w-4 shrink-0" /> Full Clinic & Practice Location
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {vetDoc.address || vetDoc.clinicAddress
                      ? getLocalizedText(vetDoc.address || vetDoc.clinicAddress)
                      : [
                          getLocalizedText(vetDoc.clinic || vetDoc.hospital || vetDoc.addInstitution),
                          getLocalizedText(vetDoc.village || vetDoc.city || vetDoc.town),
                          getLocalizedText(vetDoc.taluk || vetDoc.tehsil),
                          getLocalizedText(vetDoc.district || vetDoc.districtName),
                          getLocalizedText(vetDoc.state || vetDoc.stateName),
                          vetDoc.pincode || vetDoc.pinCode,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Clinic location details not specified"}
                  </p>
                </div>

                {/* Specializations & Services */}
                {Array.isArray(vetDoc.specialization) && vetDoc.specialization.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Specializations
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {vetDoc.specialization.map((spec: any, sIdx: number) => {
                        const specStr = getLocalizedText(spec?.key || spec);
                        return (
                          <span key={sIdx} className="px-3 py-1 rounded-xl bg-primary/10 text-primary text-xs font-semibold border border-primary/20 capitalize">
                            {specStr.replace(/_/g, " ")}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {Array.isArray(vetDoc.services) && vetDoc.services.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Clinical & Healthcare Services Offered ({vetDoc.services.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {vetDoc.services.map((srv: any, sIdx: number) => {
                        const srvStr = getLocalizedText(srv?.key || srv);
                        return (
                          <span key={sIdx} className="px-2.5 py-1 rounded-lg bg-muted text-foreground text-xs font-medium border border-border/50">
                            {srvStr}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>

              {/* Official Verification Documents */}
              <Card className="p-6 rounded-3xl border shadow-sm space-y-4">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                  <FileCheck className="h-5 w-5 text-primary" /> Official Doctor Verification Documents
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { title: "Education Qualification Proof", url: vetDoc.educationProof, icon: GraduationCap },
                    { title: "Doctor Identity Proof", url: vetDoc.identityProof, icon: FileText },
                    { title: "Registration License Proof", url: vetDoc.registrationProof, icon: Award },
                  ].filter(doc => !!doc.url).map((vDoc, dIdx) => (
                    <Card
                      key={dIdx}
                      className="p-4 rounded-2xl border bg-card hover:shadow-md transition-all flex flex-col justify-between space-y-3 cursor-pointer group"
                      onClick={() => setSelectedPreviewImage({ url: vDoc.url, title: vDoc.title })}
                    >
                      <div className="h-32 bg-muted/40 rounded-xl overflow-hidden relative">
                        <img src={vDoc.url} alt={vDoc.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Eye className="h-5 w-5" />
                        </div>
                      </div>
                      <div>
                        <h5 className="font-bold text-xs text-foreground truncate">{vDoc.title}</h5>
                        <a
                          href={vDoc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open Document <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </Card>
                  ))}
                </div>
              </Card>
            </div>
          ) : (
            <Card className="p-8 rounded-3xl border text-center space-y-4">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <Stethoscope className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-foreground">Veterinarian Role Not Registered</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  This user has not registered as a doctor / veterinarian in the iHerd platform.
                </p>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* 6. STORAGE & MEDIA GALLERY TAB */}
        <TabsContent value="media">
          <Card className="p-6 rounded-3xl border shadow-sm space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <ImageIcon className="h-5 w-5 text-primary" /> Firebase Storage Files & Images ({allMediaImages.length})
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All storage images belonging to this user profile, farm facility, cattle proofs, and certificates
                </p>
              </div>
            </div>

            {allMediaImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {allMediaImages.map((media, index) => (
                  <Card
                    key={index}
                    className="group rounded-2xl overflow-hidden border border-border/60 hover:shadow-lg transition-all flex flex-col bg-card"
                  >
                    <div
                      className="relative h-36 bg-muted/60 flex items-center justify-center overflow-hidden cursor-pointer"
                      onClick={() => setSelectedPreviewImage({ url: media.url, title: media.title })}
                    >
                      <img
                        src={media.url}
                        alt={media.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://placehold.co/300x200?text=Image+Unavailable";
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8 rounded-full"
                          title="View Full Size"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <a
                          href={media.url}
                          target="_blank"
                          rel="noreferrer"
                          className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
                          title="Open Link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between space-y-1.5">
                      <div>
                        <div className="text-xs font-semibold text-foreground truncate" title={media.title}>
                          {media.title}
                        </div>
                        <span className="inline-block text-[10px] uppercase font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded mt-1">
                          {media.source}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                        <span>{media.size || "Image"}</span>
                        <a
                          href={media.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center space-y-3 bg-muted/20 rounded-2xl border border-dashed">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">No Storage Images Found</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    No images are currently stored in Firebase Storage under this user ID.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* 7. ORDERS & TRANSACTIONS TAB */}
        <TabsContent value="orders">
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 rounded-2xl border bg-card flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                  <Beef className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Cattle Orders</div>
                  <div className="text-lg font-bold text-foreground">{allCattleOrders.length}</div>
                </div>
              </Card>
              <Card className="p-4 rounded-2xl border bg-card flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-success/10 text-success grid place-items-center">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Product Orders</div>
                  <div className="text-lg font-bold text-foreground">{allProductOrders.length}</div>
                </div>
              </Card>
              <Card className="p-4 rounded-2xl border bg-card flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total Invoices</div>
                  <div className="text-lg font-bold text-foreground">
                    {allCattleOrders.filter(o => o.invoiceUrl).length + allProductOrders.filter(o => o.invoiceUrl).length} Ready
                  </div>
                </div>
              </Card>
            </div>

            {/* 1. Cattle Orders */}
            <Card className="p-6 rounded-3xl border shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Beef className="h-5 w-5 text-primary" /> Cattle Orders ({allCattleOrders.length})
                </h3>
                <span className="text-xs text-muted-foreground">Live transactions from Cattle Marketplace & Orders</span>
              </div>

              {allCattleOrders.length > 0 ? (
                <div className="space-y-4">
                  {allCattleOrders.map((ord: any, idx: number) => {
                    const orderId = ord.orderId || ord.id;
                    return (
                      <div key={idx} className="p-5 rounded-2xl border bg-muted/15 hover:bg-muted/30 transition-all space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/50">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-foreground bg-primary/10 text-primary px-2.5 py-1 rounded-lg">
                              #{orderId}
                            </span>
                            <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                              ord.isSale ? "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                            }`}>
                              {ord.type || "Cattle Order"}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{formatDateTime(ord.createdAt)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <StatusBadge status={ord.status || "Completed"} />
                            <div className="text-right ml-2">
                              <span className="text-base font-black text-primary">₹{Number(ord.totalAmount || ord.price || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Order Details Body */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          {/* Livestock Info */}
                          <div className="flex items-start gap-3">
                            {(() => {
                              const cattleImg = formatImageUrl(
                                ord.image ||
                                ord.imageUrl ||
                                ord.cattleImage ||
                                ord.faceViewImage ||
                                ord.faceView ||
                                ord.frontView ||
                                (Array.isArray(ord.images) ? ord.images[0] : (ord.images?.frontView || ord.images?.faceView)) ||
                                ord.cattleDetails?.image ||
                                ord.cattleDetails?.imageUrl ||
                                ""
                              );
                              if (cattleImg) {
                                return (
                                  <div
                                    className="h-14 w-14 rounded-xl overflow-hidden ring-1 ring-border/80 cursor-pointer shrink-0 bg-muted/30 relative group"
                                    onClick={() => setSelectedPreviewImage({ url: cattleImg, title: ord.cattleName || "Cattle Photo" })}
                                    title="Click to zoom photo"
                                  >
                                    <img
                                      src={cattleImg}
                                      alt={ord.cattleName || "Cattle"}
                                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                      <Maximize2 className="h-3.5 w-3.5" />
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div className="h-14 w-14 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                                  <Beef className="h-6 w-6" />
                                </div>
                              );
                            })()}
                            <div className="space-y-0.5 min-w-0">
                              <div className="font-bold text-foreground text-sm truncate">{ord.cattleName || "Livestock Cattle"}</div>
                              <div className="text-muted-foreground">Breed: <span className="text-foreground font-medium">{ord.breed || "—"}</span></div>
                              <div className="text-muted-foreground">Species: <span className="text-foreground font-medium">{ord.species || "Cow"}</span></div>
                            </div>
                          </div>

                          {/* Buyer/Seller Contact */}
                          <div className="space-y-1">
                            <div className="text-muted-foreground">
                              {ord.isSale ? "Buyer: " : "Seller: "}
                              <span className="text-foreground font-semibold">{ord.isSale ? ord.buyerName : ord.sellerName}</span>
                            </div>
                            <div className="text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <span>{ord.buyerPhone || "—"}</span>
                            </div>
                            <div className="text-muted-foreground truncate" title={ord.buyerLocation}>
                              <MapPin className="h-3 w-3 inline mr-1" />
                              {ord.buyerLocation || "—"}
                            </div>
                          </div>

                          {/* Invoice & Actions */}
                          <div className="flex flex-col justify-between items-start md:items-end gap-2">
                            <div className="space-y-1 text-right">
                              <div className="text-muted-foreground">
                                Invoice No: <span className="font-mono font-bold text-foreground">{ord.invoiceNumber || "—"}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {ord.invoiceUrl ? (
                                <a
                                  href={ord.invoiceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success text-success-foreground text-xs font-bold shadow-sm hover:opacity-90 transition-all"
                                >
                                  <FileText className="h-3.5 w-3.5" /> View Invoice PDF <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
                                  <FileCheck className="h-3.5 w-3.5" /> {ord.invoiceNumber ? `Invoice #${ord.invoiceNumber}` : "Invoice Pending"}
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs rounded-xl gap-1"
                                onClick={() => setSelectedOrderDetail(ord)}
                              >
                                <Info className="h-3.5 w-3.5" /> Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-muted/20 rounded-2xl border border-dashed text-xs text-muted-foreground">
                  No cattle marketplace orders recorded for this user.
                </div>
              )}
            </Card>

            {/* 2. Product Orders */}
            <Card className="p-6 rounded-3xl border shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                  <ShoppingCart className="h-5 w-5 text-primary" /> Product Marketplace Orders ({allProductOrders.length})
                </h3>
                <span className="text-xs text-muted-foreground">E-commerce farm supplies, kits & medicine orders</span>
              </div>

              {allProductOrders.length > 0 ? (
                <div className="space-y-4">
                  {allProductOrders.map((po: any, idx: number) => {
                    const poId = po.orderId || po.id;
                    const items = Array.isArray(po.items) ? po.items : [];
                    return (
                      <div key={idx} className="p-5 rounded-2xl border bg-muted/15 hover:bg-muted/30 transition-all space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/50">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-foreground bg-primary/10 text-primary px-2.5 py-1 rounded-lg">
                              #{poId}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{formatDateTime(po.createdAt)}</span>
                            </div>
                            {po.trackingId && po.trackingId !== "—" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-foreground bg-muted px-2 py-0.5 rounded">
                                <Truck className="h-3 w-3" /> Track: {po.trackingId}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <StatusBadge status={po.status || "Ordered"} />
                            <div className="text-right ml-2">
                              <span className="text-base font-black text-primary">₹{Number(po.totalAmount || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Items Breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          <div className="space-y-2">
                            <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                              Order Items ({items.length})
                            </div>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                              {items.map((it: any, iIdx: number) => {
                                const itemImg = formatImageUrl(
                                  it.image ||
                                  it.imageUrl ||
                                  it.thumbnailUrl ||
                                  (Array.isArray(it.images) ? it.images[0] : (it.images?.thumbnail || it.images?.primary)) ||
                                  ""
                                );
                                return (
                                  <div key={iIdx} className="flex items-center gap-2">
                                    {itemImg ? (
                                      <div
                                        className="h-7 w-7 rounded overflow-hidden ring-1 ring-border/80 shrink-0 cursor-pointer bg-muted/40 relative group"
                                        onClick={() => setSelectedPreviewImage({ url: itemImg, title: it.name || "Product Image" })}
                                        title="Click to zoom image"
                                      >
                                        <img
                                          src={itemImg}
                                          alt={it.name}
                                          className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                                          referrerPolicy="no-referrer"
                                          onError={(e) => {
                                            (e.target as HTMLElement).style.display = "none";
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <div className="h-7 w-7 rounded bg-muted grid place-items-center shrink-0 ring-1 ring-border text-muted-foreground">
                                        <Package className="h-3.5 w-3.5" />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="font-medium text-foreground truncate">{it.name}</div>
                                      <div className="text-[11px] text-muted-foreground">
                                        Qty: {it.quantity || 1} × ₹{it.price} {it.gstPercent ? `(${it.gstPercent}% GST)` : ""}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {items.length === 0 && <span className="text-muted-foreground">Product Items</span>}
                            </div>
                          </div>

                          {/* Shipping Destination */}
                          <div className="space-y-1">
                            <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                              Delivery Details
                            </div>
                            {po.shippingAddress ? (
                              <div className="space-y-0.5">
                                <div className="font-semibold text-foreground">{po.shippingAddress.name}</div>
                                <div className="text-muted-foreground">{po.shippingAddress.phone}</div>
                                <div className="text-muted-foreground">
                                  {[po.shippingAddress.line1, po.shippingAddress.line2, po.shippingAddress.district, po.shippingAddress.state, po.shippingAddress.pincode].filter(Boolean).join(", ")}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Standard Delivery</span>
                            )}
                          </div>

                          {/* Invoice & Actions */}
                          <div className="flex flex-col justify-between items-start md:items-end gap-2">
                            <div className="space-y-1 text-right">
                              <div className="text-muted-foreground">
                                Invoice No: <span className="font-mono font-bold text-foreground">{po.invoiceNumber || "—"}</span>
                              </div>
                              {po.shippingFee > 0 && (
                                <div className="text-[11px] text-muted-foreground">Shipping: ₹{po.shippingFee}</div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {po.invoiceUrl ? (
                                <a
                                  href={po.invoiceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success text-success-foreground text-xs font-bold shadow-sm hover:opacity-90 transition-all"
                                >
                                  <FileText className="h-3.5 w-3.5" /> View Invoice PDF <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
                                  <FileCheck className="h-3.5 w-3.5" /> {po.invoiceNumber ? `Invoice #${po.invoiceNumber}` : "Invoice Pending"}
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs rounded-xl gap-1"
                                onClick={() => setSelectedOrderDetail(po)}
                              >
                                <Info className="h-3.5 w-3.5" /> Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-muted/20 rounded-2xl border border-dashed text-xs text-muted-foreground">
                  No product marketplace orders found for this user.
                </div>
              )}
            </Card>

            {/* 3. Token Advance Records */}
            <Card className="p-6 rounded-3xl border shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Coins className="h-5 w-5 text-primary" /> Token Advance Records ({allTokenAdvances.length})
                </h3>
                <span className="text-xs text-muted-foreground">Advance payments for cattle reservations</span>
              </div>

              {allTokenAdvances.length > 0 ? (
                <div className="space-y-3">
                  {allTokenAdvances.map((tok: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-2xl border bg-muted/15 flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground bg-primary/10 text-primary px-2.5 py-1 rounded-lg">
                            #{tok.orderId || tok.id}
                          </span>
                          <span className="font-bold text-sm text-foreground">{tok.cattleType || "Livestock"} Advance</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatDateTime(tok.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-black text-primary text-base">₹{Number(tok.amount || 0).toLocaleString()}</div>
                          <StatusBadge status={tok.status || "Approved"} />
                        </div>
                        {tok.invoiceUrl && (
                          <a
                            href={tok.invoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-xl bg-success text-success-foreground hover:opacity-90"
                            title="Download Invoice PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-muted/20 rounded-2xl border border-dashed text-xs text-muted-foreground">
                  No token advance records found for this user.
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* 8. ISSUES TAB */}
        <TabsContent value="issues">
          <Card className="p-6 rounded-3xl border shadow-sm space-y-4">
            <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
              <AlertCircle className="h-5 w-5 text-primary" /> Support Tickets & Reported Issues ({allIssues.length})
            </h3>
            {allIssues.length > 0 ? (
              <div className="space-y-3">
                {allIssues.map((issue: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-2xl border bg-muted/20 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-sm text-foreground">{issue.subject || issue.title || "Support Issue"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{issue.description || issue.message || "No description"}</div>
                    </div>
                    <StatusBadge status={issue.status || "Open"} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No support issues or complaints submitted by this user.</p>
            )}
          </Card>
        </TabsContent>

        {/* 9. RAW DATA EXPLORER TAB */}
        <TabsContent value="raw">
          <Card className="p-6 rounded-3xl border shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Code2 className="h-5 w-5 text-primary" /> Full Firestore Document JSON
                </h3>
                <p className="text-xs text-muted-foreground">
                  Live inspection of all fields stored in Firestore under document ID: <span className="font-mono font-medium">{resolvedDocId || userId}</span>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => copyToClipboard(JSON.stringify({ firestoreUser: mergedUserDoc, farmerDoc, farmDoc, sellerDoc, vetDoc, allUserCattle }, null, 2))}
              >
                <Copy className="h-3.5 w-3.5" /> Copy JSON
              </Button>
            </div>
            <pre className="p-4 rounded-2xl bg-muted/60 font-mono text-xs overflow-x-auto max-h-[500px] border border-border/50 text-foreground">
              {JSON.stringify(
                {
                  firestoreUser: mergedUserDoc,
                  backendFullData,
                  farmDoc,
                  farmerDoc,
                  sellerDoc,
                  vetDoc,
                  cattleCount: allUserCattle.length,
                  cattleRecords: allUserCattle,
                  mediaImagesCount: allMediaImages.length,
                },
                null,
                2
              )}
            </pre>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Farm Details Modal */}
      <Dialog open={isEditFarmOpen} onOpenChange={setIsEditFarmOpen}>
        <DialogContent className="max-w-xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                <span>Edit Farm Details</span>
              </div>
              {editFarmForm.farmId && (
                <span className="text-xs font-mono font-normal text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-lg">
                  ID: {editFarmForm.farmId}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {farmsList.length > 1 && (
              <div className="flex items-center gap-1.5 p-2 rounded-2xl bg-muted/40 border border-border/50 overflow-x-auto">
                <span className="text-xs font-bold text-muted-foreground whitespace-nowrap pl-1">Select Farm:</span>
                {farmsList.map((f: any, idx: number) => {
                  const isSelected =
                    (selectedFarmToEdit?.id === f.id) ||
                    (selectedFarmToEdit?.farmId === f.farmId) ||
                    (editFarmForm.farmId === (f.farmId || f.id));
                  const fName = getLocalizedText(f.name || f.farmName || `Farm #${idx + 1}`);
                  return (
                    <Button
                      key={idx}
                      type="button"
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => handleOpenEditFarm(f)}
                      className="rounded-xl text-xs h-7 shrink-0"
                    >
                      {fName}
                    </Button>
                  );
                })}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Farm Name</label>
              <input
                type="text"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={editFarmForm.name}
                onChange={(e) => setEditFarmForm({ ...editFarmForm, name: e.target.value })}
                placeholder="e.g. Silambarsan Farm / Hosur Dairy"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Farm Contact Phone</label>
                <input
                  type="text"
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                  value={editFarmForm.farmPhoneNumber}
                  onChange={(e) => setEditFarmForm({ ...editFarmForm, farmPhoneNumber: e.target.value })}
                  placeholder="8667262585"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Farm Livestock</label>
                <input
                  type="text"
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                  value={editFarmForm.animal}
                  onChange={(e) => setEditFarmForm({ ...editFarmForm, animal: e.target.value })}
                  placeholder="Cow / Cattle / Buffalo"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Village / Town</label>
                <input
                  type="text"
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                  value={editFarmForm.village}
                  onChange={(e) => setEditFarmForm({ ...editFarmForm, village: e.target.value })}
                  placeholder="Hosur"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Taluk</label>
                <input
                  type="text"
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                  value={editFarmForm.taluk}
                  onChange={(e) => setEditFarmForm({ ...editFarmForm, taluk: e.target.value })}
                  placeholder="Hosur"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">District</label>
                <input
                  type="text"
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                  value={editFarmForm.district}
                  onChange={(e) => setEditFarmForm({ ...editFarmForm, district: e.target.value })}
                  placeholder="Krishnagiri"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">State</label>
                <input
                  type="text"
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                  value={editFarmForm.state}
                  onChange={(e) => setEditFarmForm({ ...editFarmForm, state: e.target.value })}
                  placeholder="Tamil Nadu"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Pincode</label>
                <input
                  type="text"
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                  value={editFarmForm.pincode}
                  onChange={(e) => setEditFarmForm({ ...editFarmForm, pincode: e.target.value })}
                  placeholder="635109"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Registered Farm Address</label>
              <textarea
                rows={2}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={editFarmForm.address}
                onChange={(e) => setEditFarmForm({ ...editFarmForm, address: e.target.value })}
                placeholder="Complete farm street / road address"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setIsEditFarmOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" className="gap-1.5" disabled={isSavingFarm} onClick={handleSaveFarm}>
                {isSavingFarm ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Farm Data
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      <Dialog open={!!selectedPreviewImage} onOpenChange={(open) => !open && setSelectedPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold truncate">{selectedPreviewImage?.title}</DialogTitle>
          </DialogHeader>
          {selectedPreviewImage && (
            <div className="space-y-4">
              <div className="max-h-[70vh] rounded-2xl overflow-hidden bg-black/5 flex items-center justify-center">
                <img
                  src={formatImageUrl(selectedPreviewImage.url)}
                  alt={selectedPreviewImage.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono truncate max-w-md">
                  {selectedPreviewImage.url}
                </span>
                <Button asChild size="sm" className="gap-1.5">
                  <a href={selectedPreviewImage.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" /> Open Full Image
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Cattle Detail Modal */}
      <Dialog open={!!selectedCattleDetail} onOpenChange={(open) => !open && setSelectedCattleDetail(null)}>
        <DialogContent className="max-w-2xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center justify-between">
              <span>{getLocalizedText(selectedCattleDetail?.cattleName || selectedCattleDetail?.title || "Cattle Details")}</span>
              {selectedCattleDetail?.rfid && (
                <span className="bg-primary/10 text-primary text-xs font-mono font-bold px-3 py-1 rounded-full border border-primary/20">
                  RFID: {selectedCattleDetail.rfid}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedCattleDetail && (
            <div className="space-y-6 pt-2">
              {/* Image grid */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-primary" /> Camera Proofs
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(() => {
                    const rawImgMap = (selectedCattleDetail.images && typeof selectedCattleDetail.images === "object" && !Array.isArray(selectedCattleDetail.images))
                      ? selectedCattleDetail.images
                      : (selectedCattleDetail.raw?.images && typeof selectedCattleDetail.raw.images === "object" && !Array.isArray(selectedCattleDetail.raw.images))
                      ? selectedCattleDetail.raw.images
                      : {};
                    const proofs = [
                      { label: "Face View", rawUrl: selectedCattleDetail.faceView || rawImgMap.frontView || rawImgMap.faceView || rawImgMap.face },
                      { label: "Left View", rawUrl: selectedCattleDetail.leftView || rawImgMap.leftView },
                      { label: "Right View", rawUrl: selectedCattleDetail.rightView || rawImgMap.rightView },
                      { label: "Muzzle View", rawUrl: selectedCattleDetail.muzzleView || rawImgMap.muzzleView },
                      { label: "Udder View", rawUrl: selectedCattleDetail.udderView || rawImgMap.udderView },
                      { label: "Top/Bottom View", rawUrl: selectedCattleDetail.bottomView || selectedCattleDetail.topview || rawImgMap.bottomView || rawImgMap.topview || rawImgMap.rearView },
                      { label: "Farmer View", rawUrl: selectedCattleDetail.farmerView || rawImgMap.farmerView || rawImgMap.farmerWithCattle },
                      ...(Array.isArray(selectedCattleDetail.images) ? selectedCattleDetail.images.map((img: string, idx: number) => ({ label: `Photo #${idx + 1}`, rawUrl: img })) : []),
                    ]
                      .filter((p, idx, self) => !!p.rawUrl && typeof p.rawUrl === "string" && self.findIndex((t) => t.rawUrl === p.rawUrl) === idx)
                      .map((p) => ({ label: p.label, url: formatImageUrl(p.rawUrl) }));

                    if (proofs.length === 0) {
                      return <div className="col-span-full text-xs text-muted-foreground p-3 bg-muted/20 rounded-xl text-center">No camera proofs attached</div>;
                    }

                    return proofs.map((p, i) => (
                      <div
                        key={i}
                        className="group rounded-2xl overflow-hidden border border-border/60 bg-muted/40 cursor-pointer hover:shadow-md transition-all"
                        onClick={() => setSelectedPreviewImage({ url: p.url, title: `${getLocalizedText(selectedCattleDetail.cattleName)} - ${p.label}` })}
                      >
                        <div className="h-28 bg-muted overflow-hidden relative">
                          <img
                            src={p.url}
                            alt={p.label}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="p-2 text-center text-xs font-semibold bg-card">{p.label}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Data Table */}
              <div className="space-y-2 bg-muted/20 p-4 rounded-2xl border border-border/40">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Complete Cattle Specifications
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-foreground">Cattle Name:</span> {getLocalizedText(selectedCattleDetail.cattleName || selectedCattleDetail.title || "—")}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Species:</span> {getLocalizedText(selectedCattleDetail.species, "Cow")}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Breed:</span> {getLocalizedText(selectedCattleDetail.breed?.key || selectedCattleDetail.breed || "—")}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">RFID / Tag No:</span> {getLocalizedText(selectedCattleDetail.rfid || selectedCattleDetail.tagNo || "—")}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Gender:</span> <span className="capitalize">{getLocalizedText(selectedCattleDetail.gender, "Female")}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Color:</span> {getLocalizedText(selectedCattleDetail.color, "—")}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Age:</span> {selectedCattleDetail.age ? `${getLocalizedText(selectedCattleDetail.age)} months / yrs` : "—"}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Milk Yield:</span> {selectedCattleDetail.milkYield ? `${getLocalizedText(selectedCattleDetail.milkYield)} L/day` : "—"}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Parity (Lactation):</span> {getLocalizedText(selectedCattleDetail.parity, "—")}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Weight:</span> {getLocalizedText(selectedCattleDetail.weight, "—")}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Height:</span> {getLocalizedText(selectedCattleDetail.height, "—")}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Market Value:</span> {getLocalizedText(selectedCattleDetail.value, "—")}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Father Tag:</span> {getLocalizedText(selectedCattleDetail.fatherTagNo, "—")}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Mother Tag:</span> {getLocalizedText(selectedCattleDetail.motherTagNo, "—")}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Insured:</span> {selectedCattleDetail.insurance ? "✅ Insured" : "No"}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Farm ID:</span> <span className="font-mono text-[11px]">{getLocalizedText(selectedCattleDetail.farmId || farmDoc?.farmId || farmDoc?.id || "—")}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Cattle ID:</span> <span className="font-mono text-[11px]">{getLocalizedText(selectedCattleDetail.cattleId || selectedCattleDetail.id)}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Owner UID:</span> <span className="font-mono text-[11px] truncate block">{selectedCattleDetail.ownerUid || userId}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 4. Order & Invoice Detail Modal */}
      <Dialog open={!!selectedOrderDetail} onOpenChange={() => setSelectedOrderDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 text-lg">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                <span>Order #{selectedOrderDetail?.orderId || selectedOrderDetail?.id}</span>
              </div>
              {selectedOrderDetail && <StatusBadge status={selectedOrderDetail.status || "Completed"} />}
            </DialogTitle>
          </DialogHeader>

          {selectedOrderDetail && (
            <div className="space-y-5 mt-2">
              {/* Order Header Card */}
              <div className="p-4 rounded-2xl bg-muted/30 border space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>Ordered on: <strong className="text-foreground">{formatDateTime(selectedOrderDetail.createdAt)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Receipt className="h-3.5 w-3.5 text-primary" />
                    <span>Invoice No: <strong className="font-mono text-foreground">{selectedOrderDetail.invoiceNumber || "—"}</strong></span>
                  </div>
                </div>

                {selectedOrderDetail.invoiceUrl && (
                  <div className="pt-2 border-t flex items-center justify-between gap-2">
                    <span className="text-xs text-success font-semibold flex items-center gap-1">
                      <FileCheck className="h-4 w-4" /> Official Invoice Available
                    </span>
                    <a
                      href={selectedOrderDetail.invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-success text-success-foreground text-xs font-bold shadow hover:opacity-90"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Invoice PDF
                    </a>
                  </div>
                )}
              </div>

              {/* Items List for Product Orders */}
              {Array.isArray(selectedOrderDetail.items) && selectedOrderDetail.items.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-primary" /> Purchased Items ({selectedOrderDetail.items.length})
                  </h4>
                  <div className="space-y-2.5 divide-y divide-border/40 bg-muted/20 p-4 rounded-2xl border">
                    {selectedOrderDetail.items.map((it: any, iIdx: number) => {
                      const itemImg = formatImageUrl(
                        it.image ||
                        it.imageUrl ||
                        it.thumbnailUrl ||
                        (Array.isArray(it.images) ? it.images[0] : (it.images?.thumbnail || it.images?.primary)) ||
                        ""
                      );
                      return (
                        <div key={iIdx} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {itemImg ? (
                              <div
                                className="h-12 w-12 rounded-xl overflow-hidden ring-1 ring-border shrink-0 cursor-pointer bg-muted relative group shadow-sm"
                                onClick={() => setSelectedPreviewImage({ url: itemImg, title: it.name || "Product Image" })}
                                title="Click to zoom image"
                              >
                                <img
                                  src={itemImg}
                                  alt={it.name}
                                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Maximize2 className="h-4 w-4" />
                                </div>
                              </div>
                            ) : (
                              <div className="h-12 w-12 rounded-xl bg-muted ring-1 ring-border grid place-items-center shrink-0 text-muted-foreground">
                                <Package className="h-5 w-5" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-foreground text-sm truncate">{it.name}</div>
                              <div className="text-muted-foreground mt-0.5">
                                Quantity: <span className="font-medium text-foreground">{it.quantity || 1}</span> × ₹{it.price}
                                {it.gstPercent ? ` • ${it.gstPercent}% GST` : ""}
                              </div>
                            </div>
                          </div>
                          <div className="font-black text-foreground text-base shrink-0">
                            ₹{Number((it.price || 0) * (it.quantity || 1)).toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cattle Details for Cattle Orders */}
              {selectedOrderDetail.cattleName && (
                <div className="p-4 rounded-2xl bg-card border space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Beef className="h-4 w-4 text-primary" /> Livestock & Animal Details
                  </h4>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {(() => {
                      const cImg = formatImageUrl(
                        selectedOrderDetail.image ||
                        selectedOrderDetail.imageUrl ||
                        selectedOrderDetail.cattleImage ||
                        selectedOrderDetail.faceViewImage ||
                        selectedOrderDetail.faceView ||
                        (Array.isArray(selectedOrderDetail.images) ? selectedOrderDetail.images[0] : (selectedOrderDetail.images?.frontView || selectedOrderDetail.images?.faceView)) ||
                        selectedOrderDetail.cattleDetails?.image ||
                        ""
                      );
                      if (cImg) {
                        return (
                          <div
                            className="h-20 w-20 rounded-2xl overflow-hidden ring-2 ring-primary/20 shrink-0 cursor-pointer bg-muted relative group shadow-sm"
                            onClick={() => setSelectedPreviewImage({ url: cImg, title: selectedOrderDetail.cattleName || "Livestock Cattle" })}
                            title="Click to zoom"
                          >
                            <img
                              src={cImg}
                              alt={selectedOrderDetail.cattleName || "Cattle"}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1">
                              <Maximize2 className="h-4 w-4" /> Zoom
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="h-20 w-20 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
                          <Beef className="h-8 w-8" />
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs flex-1">
                      <div><span className="text-muted-foreground block text-[11px]">Cattle Name:</span> <strong className="text-foreground text-sm font-bold">{selectedOrderDetail.cattleName}</strong></div>
                      <div><span className="text-muted-foreground block text-[11px]">Breed:</span> <strong className="text-foreground">{selectedOrderDetail.breed || "—"}</strong></div>
                      <div><span className="text-muted-foreground block text-[11px]">Species:</span> <strong className="text-foreground">{selectedOrderDetail.species || "Cow"}</strong></div>
                      <div><span className="text-muted-foreground block text-[11px]">Tag / RFID:</span> <strong className="font-mono text-foreground">{selectedOrderDetail.tagNo || selectedOrderDetail.rfid || "—"}</strong></div>
                      <div><span className="text-muted-foreground block text-[11px]">Milk Yield:</span> <strong className="text-blue-600 font-semibold">{selectedOrderDetail.milkYield ? `${selectedOrderDetail.milkYield} L/day` : "—"}</strong></div>
                      <div><span className="text-muted-foreground block text-[11px]">Agreed Price:</span> <strong className="text-primary font-black text-sm">₹{Number(selectedOrderDetail.price || selectedOrderDetail.totalAmount || 0).toLocaleString()}</strong></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Delivery & Contact Information */}
              {(selectedOrderDetail.shippingAddress || selectedOrderDetail.buyerLocation) && (
                <div className="p-4 rounded-2xl bg-muted/20 border space-y-2 text-xs">
                  <h4 className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> Delivery & Recipient Address
                  </h4>
                  {selectedOrderDetail.shippingAddress ? (
                    <div className="space-y-1">
                      <div className="font-bold text-foreground text-sm">{selectedOrderDetail.shippingAddress.name}</div>
                      <div className="text-muted-foreground">Phone: <span className="font-medium text-foreground">{selectedOrderDetail.shippingAddress.phone}</span></div>
                      <div className="text-foreground font-medium">
                        {[selectedOrderDetail.shippingAddress.line1, selectedOrderDetail.shippingAddress.line2, selectedOrderDetail.shippingAddress.district, selectedOrderDetail.shippingAddress.state, selectedOrderDetail.shippingAddress.pincode].filter(Boolean).join(", ")}
                      </div>
                    </div>
                  ) : (
                    <div className="text-foreground font-medium">{selectedOrderDetail.buyerLocation}</div>
                  )}
                </div>
              )}

              {/* Total Billing Breakdown */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Subtotal Amount</span>
                  <span>₹{Number(selectedOrderDetail.totalAmount || selectedOrderDetail.price || 0).toLocaleString()}</span>
                </div>
                {selectedOrderDetail.shippingFee > 0 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Shipping & Delivery Fee</span>
                    <span>₹{selectedOrderDetail.shippingFee}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-primary/20 flex items-center justify-between font-black text-base text-foreground">
                  <span>Grand Total</span>
                  <span className="text-primary text-lg">₹{Number(selectedOrderDetail.totalAmount || selectedOrderDetail.price || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
