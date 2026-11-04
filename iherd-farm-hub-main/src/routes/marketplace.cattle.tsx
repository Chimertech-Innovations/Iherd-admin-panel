import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getApiBaseUrlSync } from "@/lib/apiClient";
import { DataPage } from "@/components/admin/DataPage";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Beef,
  Camera,
  ExternalLink,
  Eye,
  Info,
  Maximize2,
  RefreshCw,
  User,
  MapPin,
  Phone,
  ShieldCheck,
  Building,
  Tag,
  Clock,
  Sparkles,
  Milk,
  HeartPulse,
  Award,
  CheckCircle2,
  AlertCircle,
  FileText,
  BadgePercent,
  Calendar,
  Share2,
  Copy,
  Layers,
  Code2,
  HardDrive,
} from "lucide-react";
import { useFirebaseCollection } from "../hooks/useFirebaseData";
import { getLocalizedText, formatImageUrl } from "@/lib/utils";
import { toast } from "sonner";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";

export const Route = createFileRoute("/marketplace/cattle")({
  head: () => ({ meta: [{ title: "Cattle Marketplace & Live Listings — iHerd Admin" }] }),
  component: CattleMarketplacePage,
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
    item.minPrice,
    item.maxPrice,
    item.priceDetails?.price,
    item.priceDetails?.amount,
    item.priceDetails?.expectedPrice,
    item.details?.price,
    item.details?.amount,
    item.details?.expectedPrice,
    item.marketplaceData?.price,
    item.cattleDetails?.price,
    item.data?.price,
    item.raw?.price,
    item.raw?.expectedPrice,
    item.raw?.amount,
  ];
  for (const c of candidates) {
    const p = parseNumericPrice(c);
    if (p > 0) return p;
  }
  return 0;
}

function formatDisplayPrice(price: number, negotiable: boolean, rawDoc?: any): string {
  if (price > 0) {
    return `₹${Number(price).toLocaleString()}`;
  }
  
  // Check if there's any string value in rawDoc
  if (rawDoc) {
    const rawVal = extractVal(rawDoc, "price", "expectedPrice", "amount", "rate", "value", "cost");
    if (rawVal) {
      const str = getLocalizedText(rawVal, "").trim();
      if (str && str !== "—" && str !== "0") {
        return str.startsWith("₹") ? str : `₹${str}`;
      }
    }
  }

  if (negotiable) {
    return "Price on Request";
  }

  return "Contact for Price";
}

function CattleMarketplacePage() {
  const [backendCattle, setBackendCattle] = useState<any[]>([]);
  const [backendLoading, setBackendLoading] = useState(true);
  const [selectedCattleDetail, setSelectedCattleDetail] = useState<any | null>(null);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [discoveredCertUrl, setDiscoveredCertUrl] = useState<string | null>(null);

  // Auto-discover certificate URL from Firebase Storage if explicit link is missing in Firestore
  useEffect(() => {
    if (!selectedCattleDetail) {
      setDiscoveredCertUrl(null);
      return;
    }
    const explicitCert =
      selectedCattleDetail.pashuCertificatePath ||
      selectedCattleDetail.pashuCertificate ||
      selectedCattleDetail.raw?.pashuCertificatePath ||
      selectedCattleDetail.raw?.pashuCertificate ||
      selectedCattleDetail.raw?.certificateUrl ||
      selectedCattleDetail.raw?.certificatePath ||
      selectedCattleDetail.raw?.insuranceCertificate ||
      "";

    if (explicitCert && typeof explicitCert === "string" && (explicitCert.startsWith("http") || explicitCert.startsWith("gs://"))) {
      setDiscoveredCertUrl(explicitCert);
      return;
    }

    const ownerUid =
      selectedCattleDetail.ownerUid ||
      selectedCattleDetail.sellerId ||
      selectedCattleDetail.farmerId ||
      selectedCattleDetail.userId ||
      selectedCattleDetail.raw?.ownerUid ||
      selectedCattleDetail.raw?.userId;
    const cId = selectedCattleDetail.id || selectedCattleDetail.cattleId || selectedCattleDetail.docId;

    if (!ownerUid || !cId) {
      setDiscoveredCertUrl(null);
      return;
    }

    let isMounted = true;
    const certFolder = ref(storage, `cattle-marketplace/${ownerUid}/${cId}/certificates`);
    listAll(certFolder)
      .then(async (res) => {
        if (!isMounted) return;
        if (res.items.length > 0) {
          const u = await getDownloadURL(res.items[0]).catch(() => null);
          if (isMounted && u) setDiscoveredCertUrl(u);
        } else {
          if (isMounted) setDiscoveredCertUrl(null);
        }
      })
      .catch(() => {
        if (isMounted) setDiscoveredCertUrl(null);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCattleDetail]);

  // Client Firebase `/cattle-marketplace` collection (live real-time sync)
  const { data: cmList = [], isLoading: cmLoading, refetch: refetchFirebase } = useFirebaseCollection<any>("cattle-marketplace");

  const API_BASE = getApiBaseUrlSync();

  // Fetch enriched backend data from /api/admin/cattle-marketplace
  const fetchBackendListings = async () => {
    try {
      setBackendLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/cattle-marketplace`).catch(() =>
        fetch(`${API_BASE}/api/admin/cattle`)
      );
      if (res && res.ok) {
        const json = await res.json();
        if (Array.isArray(json.cattle)) {
          setBackendCattle(json.cattle);
        }
      }
    } catch (e) {
      console.warn("Could not fetch backend cattle listings:", e);
    } finally {
      setBackendLoading(false);
    }
  };

  useEffect(() => {
    fetchBackendListings();
  }, []);

  const handleRefresh = () => {
    refetchFirebase();
    fetchBackendListings();
    toast.success("Refreshed cattle marketplace records!");
  };

  // Merge Firestore `/cattle-marketplace` documents with enriched backend data
  const allCattle = useMemo(() => {
    const cattleMap = new Map<string, any>();

    // 1. Process client Firestore `cattle-marketplace` documents
    cmList.forEach((c: any) => {
      const docId = c.id || c.docId || c.cattleId || c.rfid || c.tagNo;
      if (!docId) return;

      const titleRaw = extractVal(c, "title", "cattleName", "name", "breed", "tagNo");
      const title = getLocalizedText(
        typeof titleRaw === "object" ? (titleRaw.en || titleRaw.key || titleRaw.name) : titleRaw,
        c.tagNo ? `Cattle #${c.tagNo}` : "Dairy Cattle"
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

      const rfid = getLocalizedText(extractVal(c, "rfid", "rfidTag", "rfidNo", "tagNo", "tagNumber"), docId);
      const tagNo = getLocalizedText(extractVal(c, "tagNo", "tagNumber", "earTagNo", "rfid"), docId);
      const gender = getLocalizedText(extractVal(c, "gender", "sex"), "Female");
      const color = getLocalizedText(extractVal(c, "color", "cattleColor"), "—");
      const age = getLocalizedText(extractVal(c, "age", "ageYears", "ageInMonths", "ageMonths"), "—");
      const weight = getLocalizedText(extractVal(c, "weight", "weightKg"), "—");
      const height = getLocalizedText(extractVal(c, "height", "heightCm", "heightFeet"), "—");
      const horns = getLocalizedText(extractVal(c, "horns", "hornType"), "—");
      const castrated = extractVal(c, "castrated", "isCastrated");

      // Production
      const milkYield = getLocalizedText(extractVal(c, "milkYield", "dailyYield", "milkCapacity", "yield", "currentMilk"), "—");
      const peakMilkYield = getLocalizedText(extractVal(c, "peakMilkYield", "maxYield", "highestYield"), "—");
      const parity = getLocalizedText(extractVal(c, "parity", "lactation", "lactationNumber", "calvings", "calvingCount"), "—");
      const pregnant = extractVal(c, "pregnant", "isPregnant", "pregnancyStatus");
      const pregnancyMonth = getLocalizedText(extractVal(c, "pregnancyMonth", "pregnancyMonths", "gestationMonth"), "—");
      const lastCalvingDate = extractVal(c, "lastCalvingDate", "calvingDate");

      // Health & Lineage
      const healthStatus = getLocalizedText(extractVal(c, "healthStatus", "condition", "health", "fitness"), "Healthy");
      const vaccinated = Boolean(extractVal(c, "vaccinated", "isVaccinated") || c.vaccinationStatus === "Vaccinated");
      const dewormed = Boolean(extractVal(c, "dewormed", "isDewormed") || c.dewormingStatus === "Dewormed");
      const insurance = Boolean(extractVal(c, "insurance", "isInsured"));
      const insuranceNumber = getLocalizedText(extractVal(c, "insuranceNumber", "policyNumber", "insurancePolicyNo"), "—");
      const fatherTagNo = getLocalizedText(extractVal(c, "fatherTagNo", "sireTag", "fatherId"), "—");
      const motherTagNo = getLocalizedText(extractVal(c, "motherTagNo", "damTag", "motherId"), "—");

      // Commercial / Price
      const price = extractPriceFromDoc(c);
      const negotiable = Boolean(extractVal(c, "negotiable", "isNegotiable", "is_negotiable"));
      const status = getLocalizedText(extractVal(c, "status", "listingStatus"), price > 0 ? "On Sale" : "Available");
      const description = getLocalizedText(extractVal(c, "description", "notes", "remarks", "about", "details"), "");

      // Seller / Owner
      const ownerName = getLocalizedText(extractVal(c, "sellerName", "ownerName", "farmerName", "postedBy", "userName", "name"), "Farmer / Seller");
      const ownerPhone = getLocalizedText(extractVal(c, "sellerPhone", "phone", "phoneNumber", "mobile", "contactNumber"), "—");
      const ownerUid = getLocalizedText(extractVal(c, "sellerId", "ownerUid", "farmerId", "userId", "uid", "postedByUid"), "");
      const farmName = getLocalizedText(extractVal(c, "farmName"), "—");
      const farmId = getLocalizedText(extractVal(c, "farmId"), "—");

      // Location
      const state = getLocalizedText(extractVal(c, "state"), "—");
      const district = getLocalizedText(extractVal(c, "district"), "—");
      const village = getLocalizedText(extractVal(c, "village", "location", "city", "address", "town"), "—");
      const pincode = getLocalizedText(extractVal(c, "pincode", "zipCode", "postalCode"), "—");

      // Multi-angle Camera Proofs & Raw Images
      const rawImgMap = (c.images && typeof c.images === "object" && !Array.isArray(c.images))
        ? c.images
        : (c.photos && typeof c.photos === "object" && !Array.isArray(c.photos))
        ? c.photos
        : {};

      const faceView = extractVal(c, "faceViewImagePath", "faceView", "face", "frontView", "front", "imageUrl", "image") || rawImgMap.frontView || rawImgMap.front || rawImgMap.faceView || rawImgMap.face || "";
      const leftView = extractVal(c, "leftViewImagePath", "leftView", "left") || rawImgMap.leftView || rawImgMap.left || "";
      const rightView = extractVal(c, "rightViewImagePath", "rightView", "right") || rawImgMap.rightView || rawImgMap.right || "";
      const muzzleView = extractVal(c, "muzzleViewImagePath", "muzzleView", "muzzle") || rawImgMap.muzzleView || rawImgMap.muzzle || "";
      const udderView = extractVal(c, "udderViewImagePath", "udderView", "udder") || rawImgMap.udderView || rawImgMap.udder || "";
      const bottomView = extractVal(c, "topViewImagePath", "bottomView", "topView", "topview", "rearView", "backView") || rawImgMap.bottomView || rawImgMap.topview || rawImgMap.topView || rawImgMap.rearView || "";
      const farmerView = extractVal(c, "farmerViewImagePath", "farmerView", "farmerWithCattle") || rawImgMap.farmerView || rawImgMap.farmerWithCattle || "";

      // Photos Array
      let images: string[] = [];
      if (Array.isArray(c.images)) {
        images = c.images.filter((x: any) => typeof x === "string" && x.trim().length > 0);
      } else if (c.images && typeof c.images === "object") {
        images = Object.values(c.images).filter((v): v is string => typeof v === "string" && v.trim().length > 0);
      }
      if (Array.isArray(c.photos)) {
        images = [...images, ...c.photos.filter((x: any) => typeof x === "string" && x.trim().length > 0)];
      }
      if (images.length === 0) {
        images = [faceView, leftView, rightView, muzzleView, udderView, bottomView, farmerView, c.imageUrl, c.image].filter(Boolean);
      }

      let resolvedOwnerUid = ownerUid;
      if (!resolvedOwnerUid && images.length > 0) {
        for (const imgUrl of images) {
          const match = String(imgUrl).match(/(?:UserImages|cattle-marketplace)(?:%2F|\/)([a-zA-Z0-9_-]{20,})/i);
          if (match && match[1]) {
            resolvedOwnerUid = match[1];
            break;
          }
        }
      }

      cattleMap.set(docId, {
        id: docId,
        docId,
        cattleId: docId,
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
        negotiable,
        status,
        description,
        ownerName,
        ownerPhone,
        ownerUid: resolvedOwnerUid,
        farmName,
        farmId,
        state,
        district,
        village,
        pincode,
        faceView,
        leftView,
        rightView,
        muzzleView,
        udderView,
        bottomView,
        farmerView,
        images,
        source: "cattle-marketplace",
        createdAt: c.createdAt || c.postedAt || c.timestamp || c.date || null,
        raw: c,
      });
    });

    // 2. Merge backend-enriched cattle listings
    backendCattle.forEach((bc: any) => {
      const docId = bc.docId || bc.id || bc.cattleId || bc.rfid || bc.tagNo;
      if (!docId) return;

      const bcPrice = extractPriceFromDoc(bc);

      const cleanBc = {
        ...bc,
        title: getLocalizedText(bc.title || bc.cattleName || bc.name, "Dairy Cattle"),
        breed: getLocalizedText(bc.breed, "—"),
        species: getLocalizedText(bc.species, "Cow"),
        rfid: getLocalizedText(bc.rfid, docId),
        tagNo: getLocalizedText(bc.tagNo, docId),
        gender: getLocalizedText(bc.gender, "Female"),
        color: getLocalizedText(bc.color, "—"),
        age: getLocalizedText(bc.age, "—"),
        weight: getLocalizedText(bc.weight, "—"),
        height: getLocalizedText(bc.height, "—"),
        milkYield: getLocalizedText(bc.milkYield, "—"),
        peakMilkYield: getLocalizedText(bc.peakMilkYield, "—"),
        parity: getLocalizedText(bc.parity, "—"),
        pregnancyMonth: getLocalizedText(bc.pregnancyMonth, "—"),
        healthStatus: getLocalizedText(bc.healthStatus, "Healthy"),
        insuranceNumber: getLocalizedText(bc.insuranceNumber, "—"),
        fatherTagNo: getLocalizedText(bc.fatherTagNo, "—"),
        motherTagNo: getLocalizedText(bc.motherTagNo, "—"),
        description: getLocalizedText(bc.description, ""),
        status: getLocalizedText(bc.status, "On Sale"),
        ownerName: getLocalizedText(bc.ownerName, "Farmer / Seller"),
        ownerPhone: getLocalizedText(bc.ownerPhone, "—"),
        ownerUid: getLocalizedText(bc.ownerUid, ""),
        village: getLocalizedText(bc.village, "—"),
        district: getLocalizedText(bc.district, "—"),
        state: getLocalizedText(bc.state, "—"),
        pincode: getLocalizedText(bc.pincode, "—"),
        price: bcPrice > 0 ? bcPrice : 0,
        negotiable: Boolean(bc.negotiable || bc.isNegotiable),
      };

      if (cattleMap.has(docId)) {
        const existing = cattleMap.get(docId);
        const mergedPrice = existing.price > 0 ? existing.price : (cleanBc.price > 0 ? cleanBc.price : 0);
        cattleMap.set(docId, {
          ...existing,
          ...cleanBc,
          price: mergedPrice,
          negotiable: existing.negotiable || cleanBc.negotiable,
          ownerName: existing.ownerName !== "Farmer / Seller" ? existing.ownerName : (cleanBc.ownerName || existing.ownerName),
          ownerPhone: existing.ownerPhone !== "—" ? existing.ownerPhone : (cleanBc.ownerPhone || existing.ownerPhone),
          ownerUid: existing.ownerUid || cleanBc.ownerUid || "",
          village: existing.village !== "—" ? existing.village : (cleanBc.village || existing.village),
          state: existing.state !== "—" ? existing.state : (cleanBc.state || existing.state),
          district: existing.district !== "—" ? existing.district : (cleanBc.district || existing.district),
          images: (existing.images && existing.images.length > 0) ? existing.images : (cleanBc.images || []),
          raw: existing.raw || bc.raw || bc,
        });
      } else {
        cattleMap.set(docId, {
          ...cleanBc,
          id: docId,
          docId,
          source: "cattle-marketplace",
        });
      }
    });

    return Array.from(cattleMap.values()).sort(
      (a, b) => parseTime(b.createdAt) - parseTime(a.createdAt)
    );
  }, [cmList, backendCattle]);

  const isLoading = (cmLoading || backendLoading) && allCattle.length === 0;

  // KPI Calculations
  const onSaleCount = allCattle.filter(c => (getLocalizedText(c.status) || "").toLowerCase().includes("sale") || (c.price && c.price > 0) || c.negotiable).length;
  const verifiedRfidCount = allCattle.filter(c => c.rfid && c.rfid !== "—" && !String(c.rfid).startsWith("cattle-")).length;
  const highYieldCount = allCattle.filter(c => {
    const yieldNum = parseFloat(String(c.milkYield).replace(/[^0-9.]/g, ""));
    return !isNaN(yieldNum) && yieldNum >= 12;
  }).length;
  const insuredCount = allCattle.filter(c => c.insurance).length;

  return (
    <div className="space-y-6">
      <DataPage
        title="Live Cattle Marketplace"
        description="Real-time livestock listings fetched directly from Firestore /cattle-marketplace, featuring multi-angle camera proofs, RFID verification, milk yields, and seller contacts."
        isLoading={isLoading}
        hideStatusFilter={true}
        hideStateFilter={true}
        searchKeys={[
          "title",
          "breed",
          "rfid",
          "tagNo",
          "sellerName",
          "sellerPhone",
          "ownerUid",
          "state",
          "city",
          "description",
        ]}
        filters={[]}
        statusKey="filterCategory"
        kpis={[
          { label: "Total Marketplace Listings", value: isLoading ? "…" : allCattle.length.toLocaleString() },
          { label: "Active On Sale", value: isLoading ? "…" : onSaleCount.toLocaleString() },
          { label: "Verified RFID / Tags", value: isLoading ? "…" : verifiedRfidCount.toLocaleString() },
          { label: "High Yield Dairy (>12L)", value: isLoading ? "…" : highYieldCount.toLocaleString() },
          { label: "Insured Cattle", value: isLoading ? "…" : insuredCount.toLocaleString() },
        ]}
        data={allCattle.map(c => {
          const rawMainImg = c.faceView ||
            c.leftView ||
            (c.images && typeof c.images === "object" && !Array.isArray(c.images) ? (c.images.frontView || c.images.faceView || Object.values(c.images)[0]) : null) ||
            (c.raw?.images && typeof c.raw.images === "object" ? (c.raw.images.frontView || c.raw.images.faceView || Object.values(c.raw.images)[0]) : null) ||
            (Array.isArray(c.images) && c.images[0]) ||
            (Array.isArray(c.raw?.photos) && c.raw.photos[0]) ||
            c.imageUrl ||
            c.image;
          const mainImg = formatImageUrl(rawMainImg);
          
          const yieldNum = parseFloat(String(c.milkYield).replace(/[^0-9.]/g, ""));
          const isHighYield = !isNaN(yieldNum) && yieldNum >= 12;

          let filterCategory = "All";
          if (c.rfid && c.rfid !== "—" && !String(c.rfid).startsWith("cattle-")) {
            filterCategory = "Verified RFID";
          } else if (isHighYield) {
            filterCategory = "High Milk Yield (>12L)";
          } else if (c.insurance) {
            filterCategory = "Insured";
          } else if ((getLocalizedText(c.status) || "").toLowerCase().includes("sale") || c.price > 0 || c.negotiable) {
            filterCategory = "On Sale";
          }

          const displayPrice = formatDisplayPrice(c.price, c.negotiable, c.raw);

          return {
            ...c,
            mainImg,
            filterCategory,
            formattedDate: formatDate(c.createdAt),
            displayPrice,
          };
        })}
        columns={[
          {
            key: "cattleName",
            label: "Cattle & Breed",
            render: (r) => (
              <div className="flex items-center gap-3">
                {r.mainImg ? (
                  <div
                    className="h-11 w-11 rounded-xl overflow-hidden ring-1 ring-border/60 shrink-0 cursor-pointer hover:scale-105 transition-transform bg-muted/40 relative group"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPreviewImage({ url: r.mainImg, title: `${r.title} - Front Camera View` });
                    }}
                  >
                    <img
                      src={r.mainImg}
                      alt={r.title}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
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
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{r.breed}</span>
                    <span>•</span>
                    <span>{r.species}</span>
                    {r.gender && (
                      <>
                        <span>•</span>
                        <span className="capitalize">{r.gender}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "rfid",
            label: "Tag No / RFID",
            render: (r) => (
              <div className="space-y-0.5">
                <span className="font-mono text-xs font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded-lg border border-border/50 select-all">
                  {r.tagNo || r.rfid || "—"}
                </span>
                <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]" title={r.id}>
                  Doc: {r.id}
                </div>
              </div>
            ),
          },
          {
            key: "ownerName",
            label: "Farmer / Seller & Location",
            render: (r) => (
              <div className="space-y-1">
                <div className="font-semibold text-xs text-foreground flex items-center gap-1">
                  <User className="h-3 w-3 text-primary shrink-0" />
                  <span>{r.ownerName}</span>
                </div>
                {r.ownerUid && (
                  <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground" title={`User ID: ${r.ownerUid}`}>
                    <span className="text-[9px] font-bold text-primary uppercase">UID:</span>
                    <span className="truncate max-w-[100px] select-all">{r.ownerUid}</span>
                  </div>
                )}
                {r.ownerUid && (
                  <div
                    className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 truncate max-w-[160px] cursor-pointer hover:underline select-all"
                    title={`Storage Path: /cattle-marketplace/${r.ownerUid}/`}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(`/cattle-marketplace/${r.ownerUid}/`);
                      toast.success("Storage path copied to clipboard");
                    }}
                  >
                    path: /{r.ownerUid.slice(0, 10)}…
                  </div>
                )}
                {r.ownerPhone !== "—" && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span>{r.ownerPhone}</span>
                  </div>
                )}
                {r.village !== "—" && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[140px]" title={`${r.village}, ${r.state}`}>
                      {r.village}{r.state !== "—" ? `, ${r.state}` : ""}
                    </span>
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "milkYield",
            label: "Milk Yield & Lactation",
            render: (r) => (
              <div>
                <div className="font-bold text-xs text-foreground flex items-center gap-1">
                  <Milk className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span>{r.milkYield !== "—" ? `${r.milkYield} L/day` : "—"}</span>
                </div>
                {r.parity && r.parity !== "—" && (
                  <div className="text-[10px] text-muted-foreground">Lactation: {r.parity}</div>
                )}
                {r.pregnant !== undefined && r.pregnant !== null && (
                  <div className="text-[10px] text-emerald-600 font-medium">
                    {r.pregnant ? `Pregnant (${r.pregnancyMonth !== "—" ? `${r.pregnancyMonth} mo` : "Yes"})` : "Not Pregnant"}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "price",
            label: "Price / Value",
            render: (r) => (
              <div>
                <div className={`font-bold text-sm ${r.price > 0 ? "text-primary" : "text-emerald-600"}`}>
                  {r.displayPrice}
                </div>
                {r.negotiable && (
                  <div className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">
                    Negotiable
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "createdAt",
            label: "Listed On",
            render: (r) => (
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span>{r.formattedDate}</span>
                </div>
                <div className="text-[10px] text-primary/80 font-mono font-semibold">/cattle-marketplace</div>
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
                  title="View full specifications & camera proofs"
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Full Data
                </Button>
                {r.ownerUid && (
                  <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl" title="Open Seller Profile">
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
                    Collection: <span className="font-mono text-primary font-semibold">/cattle-marketplace/{selectedCattleDetail?.id}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedCattleDetail?.tagNo && (
                  <span className="bg-muted text-foreground text-xs font-mono font-bold px-3 py-1 rounded-full border border-border/70">
                    Tag: {selectedCattleDetail.tagNo}
                  </span>
                )}
                <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full border border-primary/20">
                  {formatDisplayPrice(selectedCattleDetail?.price, selectedCattleDetail?.negotiable, selectedCattleDetail?.raw)}
                </span>
                <StatusBadge status={selectedCattleDetail?.status || "On Sale"} />
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedCattleDetail && (
            <div className="space-y-6 pt-2">
              {/* Photo Proofs & Multi-Angle Views Grid */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Camera className="h-4 w-4 text-primary" /> Multi-Angle Camera Proofs & Verification Photos
                  </span>
                  <span className="text-[11px] text-muted-foreground lowercase">Click any photo to enlarge</span>
                </h4>
                
                {(() => {
                  const rawImgMap = (selectedCattleDetail.images && typeof selectedCattleDetail.images === "object" && !Array.isArray(selectedCattleDetail.images))
                    ? selectedCattleDetail.images
                    : (selectedCattleDetail.raw?.images && typeof selectedCattleDetail.raw.images === "object" && !Array.isArray(selectedCattleDetail.raw.images))
                    ? selectedCattleDetail.raw.images
                    : {};

                  const proofList = [
                    { label: "Front / Face View", rawUrl: selectedCattleDetail.faceView || rawImgMap.frontView || rawImgMap.faceView || rawImgMap.face },
                    { label: "Left Side View", rawUrl: selectedCattleDetail.leftView || rawImgMap.leftView },
                    { label: "Right Side View", rawUrl: selectedCattleDetail.rightView || rawImgMap.rightView },
                    { label: "Muzzle View", rawUrl: selectedCattleDetail.muzzleView || rawImgMap.muzzleView },
                    { label: "Udder View", rawUrl: selectedCattleDetail.udderView || rawImgMap.udderView },
                    { label: "Top / Rear View", rawUrl: selectedCattleDetail.bottomView || rawImgMap.bottomView || rawImgMap.topview || rawImgMap.rearView },
                    { label: "Farmer with Cattle", rawUrl: selectedCattleDetail.farmerView || rawImgMap.farmerView || rawImgMap.farmerWithCattle },
                    ...(Array.isArray(selectedCattleDetail.images)
                      ? selectedCattleDetail.images.map((img: string, idx: number) => ({
                          label: `Gallery Photo #${idx + 1}`,
                          rawUrl: img,
                        }))
                      : []),
                    ...(Array.isArray(selectedCattleDetail.raw?.photos)
                      ? selectedCattleDetail.raw.photos.map((img: string, idx: number) => ({
                          label: `Listing Photo #${idx + 1}`,
                          rawUrl: img,
                        }))
                      : []),
                  ]
                    .filter((p, idx, self) => !!p.rawUrl && typeof p.rawUrl === "string" && self.findIndex((t) => t.rawUrl === p.rawUrl) === idx)
                    .map((p) => ({
                      label: p.label,
                      url: formatImageUrl(p.rawUrl),
                      rawUrl: p.rawUrl,
                    }));

                  if (proofList.length === 0) {
                    return (
                      <div className="p-6 rounded-2xl bg-muted/30 border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                        No photos or camera proofs attached to this cattle listing.
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
                              referrerPolicy="no-referrer"
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
                  <Beef className="h-4 w-4 text-primary" /> Livestock Physical & Technical Specifications
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
                      {selectedCattleDetail.age !== "—" ? `${selectedCattleDetail.age}` : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Weight & Height:</span>
                    <strong className="text-foreground">
                      {selectedCattleDetail.weight !== "—" ? `${selectedCattleDetail.weight} kg` : "—"} / {selectedCattleDetail.height !== "—" ? `${selectedCattleDetail.height}` : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Listing Price:</span>
                    <strong className="text-primary font-black text-sm">
                      {formatDisplayPrice(selectedCattleDetail.price, selectedCattleDetail.negotiable, selectedCattleDetail.raw)}
                    </strong>
                    {selectedCattleDetail.negotiable && (
                      <span className="text-[10px] text-amber-600 block font-semibold">(Negotiable)</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Listing Status:</span>
                    <strong className="text-foreground">{selectedCattleDetail.status || "On Sale"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Registered Date:</span>
                    <strong className="text-foreground">{formatDate(selectedCattleDetail.createdAt)}</strong>
                  </div>
                </div>
              </div>

              {/* Milking & Reproduction Records */}
              <div className="space-y-3 bg-muted/20 p-5 rounded-2xl border border-border/50">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Milk className="h-4 w-4 text-blue-500" /> Milking, Parity & Reproduction Records
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
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> Health, Lineage & Verification
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
                    <span className="text-muted-foreground block text-[11px]">Father & Mother Tag:</span>
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
                    Seller Description & Remarks
                  </span>
                  <p className="text-foreground whitespace-pre-line leading-relaxed">{selectedCattleDetail.description}</p>
                </div>
              )}

              {/* Storage & Ownership Verification Card with Direct Clickable Links */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <HardDrive className="h-4 w-4" /> User Storage, Profile & Certificate Links
                  </h4>
                  <span className="text-[10px] text-muted-foreground font-normal">Click any image to enlarge or view profile directly</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Owner User Profile Link */}
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-[11px] block font-medium">Owner / Seller Profile:</span>
                    <div className="bg-background/90 p-2.5 rounded-xl border flex items-center justify-between gap-2 hover:border-primary/50 transition-colors">
                      {(() => {
                        const sellerUid =
                          selectedCattleDetail.ownerUid ||
                          selectedCattleDetail.sellerId ||
                          selectedCattleDetail.farmerId ||
                          selectedCattleDetail.userId ||
                          selectedCattleDetail.raw?.sellerId ||
                          selectedCattleDetail.raw?.farmerId;
                        if (!sellerUid) {
                          return <span className="font-mono text-muted-foreground text-xs">—</span>;
                        }
                        return (
                          <>
                            <Link
                              to="/users/$userId"
                              params={{ userId: sellerUid }}
                              search={{ tab: "cattle" } as any}
                              className="font-mono font-bold text-primary hover:underline text-xs truncate flex items-center gap-1.5"
                              title="Click to open User Profile"
                            >
                              <User className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{sellerUid}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                            </Link>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-primary hover:text-primary">
                                <Link to="/users/$userId" params={{ userId: sellerUid }} search={{ tab: "cattle" } as any}>
                                  Open
                                </Link>
                              </Button>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground text-[11px] font-sans px-1 font-semibold"
                                onClick={() => {
                                  navigator.clipboard.writeText(sellerUid);
                                  toast.success("User ID copied");
                                }}
                                title="Copy User ID"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Cattle Media & Photos Directly Rendered */}
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-[11px] block font-medium">Cattle Media & Photos:</span>
                    <div className="bg-background/90 p-2 rounded-xl border hover:border-emerald-500/50 transition-colors">
                      {(() => {
                        const rawImgMap = (selectedCattleDetail.images && typeof selectedCattleDetail.images === "object" && !Array.isArray(selectedCattleDetail.images))
                          ? selectedCattleDetail.images
                          : (selectedCattleDetail.raw?.images && typeof selectedCattleDetail.raw.images === "object" && !Array.isArray(selectedCattleDetail.raw.images))
                          ? selectedCattleDetail.raw.images
                          : {};

                        const directPhotos = [
                          { label: "Front", rawUrl: selectedCattleDetail.faceView || rawImgMap.frontView || rawImgMap.front || rawImgMap.faceView || rawImgMap.face },
                          { label: "Left", rawUrl: selectedCattleDetail.leftView || rawImgMap.leftView || rawImgMap.left },
                          { label: "Right", rawUrl: selectedCattleDetail.rightView || rawImgMap.rightView || rawImgMap.right },
                          { label: "Muzzle", rawUrl: selectedCattleDetail.muzzleView || rawImgMap.muzzleView || rawImgMap.muzzle },
                          { label: "Udder", rawUrl: selectedCattleDetail.udderView || rawImgMap.udderView || rawImgMap.udder },
                          { label: "Top", rawUrl: selectedCattleDetail.bottomView || rawImgMap.bottomView || rawImgMap.topview || rawImgMap.topView || rawImgMap.rearView },
                          { label: "Farmer", rawUrl: selectedCattleDetail.farmerView || rawImgMap.farmerView || rawImgMap.farmerWithCattle },
                          ...(Array.isArray(selectedCattleDetail.images)
                            ? selectedCattleDetail.images.map((img: string, idx: number) => ({
                                label: `Photo ${idx + 1}`,
                                rawUrl: img,
                              }))
                            : []),
                          ...(Array.isArray(selectedCattleDetail.raw?.photos)
                            ? selectedCattleDetail.raw.photos.map((img: string, idx: number) => ({
                                label: `Photo ${idx + 1}`,
                                rawUrl: img,
                              }))
                            : []),
                        ]
                          .filter((p, idx, self) => !!p.rawUrl && typeof p.rawUrl === "string" && p.rawUrl.trim().length > 0 && self.findIndex((t) => t.rawUrl === p.rawUrl) === idx)
                          .map((p) => ({
                            label: p.label,
                            url: formatImageUrl(p.rawUrl),
                          }));

                        if (directPhotos.length === 0) {
                          return (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground p-1.5">
                              <Camera className="h-4 w-4 opacity-50" />
                              <span>No photos uploaded</span>
                            </div>
                          );
                        }

                        return (
                          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
                            {directPhotos.map((p, pIdx) => (
                              <div
                                key={pIdx}
                                className="relative group shrink-0 w-12 h-12 rounded-lg border overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all shadow-sm"
                                onClick={() =>
                                  setSelectedPreviewImage({
                                    url: p.url,
                                    title: `${selectedCattleDetail.title} — ${p.label} View`,
                                  })
                                }
                                title={`Click to view ${p.label} Photo`}
                              >
                                <img
                                  src={p.url}
                                  alt={p.label}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Eye className="h-3.5 w-3.5" />
                                </div>
                                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white font-medium text-center truncate px-0.5 leading-tight py-0.5">
                                  {p.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Verified Certificate & Document Directly Rendered */}
                  <div className="sm:col-span-2 space-y-1">
                    <span className="text-muted-foreground text-[11px] block font-medium">Verified Certificate & Document:</span>
                    <div className="bg-background/90 p-2.5 rounded-xl border hover:border-primary/50 transition-colors">
                      {(() => {
                        const rawCert =
                          discoveredCertUrl ||
                          selectedCattleDetail.pashuCertificatePath ||
                          selectedCattleDetail.pashuCertificate ||
                          selectedCattleDetail.raw?.pashuCertificatePath ||
                          selectedCattleDetail.raw?.pashuCertificate ||
                          selectedCattleDetail.raw?.certificateUrl ||
                          selectedCattleDetail.raw?.certificatePath ||
                          selectedCattleDetail.raw?.insuranceCertificate ||
                          "";

                        const certStr = typeof rawCert === "string" ? rawCert.trim() : "";
                        const hasRealCert = Boolean(
                          certStr &&
                          certStr !== "—" &&
                          !certStr.endsWith("/") &&
                          (certStr.startsWith("http") || certStr.startsWith("gs://") || /\.(pdf|jpg|jpeg|png|webp)/i.test(certStr))
                        );

                        if (!hasRealCert) {
                          return (
                            <div className="flex items-center justify-between gap-2 text-xs py-1">
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <FileText className="h-4 w-4 opacity-50 text-muted-foreground" />
                                <span>No Certificate Document Attached</span>
                              </span>
                              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded font-medium">
                                {selectedCattleDetail.insurance ? `Insured (#${selectedCattleDetail.insuranceNumber})` : "Standard Verified Listing"}
                              </span>
                            </div>
                          );
                        }

                        const certUrl = formatImageUrl(certStr);
                        const isPdf = certStr.toLowerCase().includes(".pdf");

                        if (isPdf) {
                          return (
                            <div className="flex items-center justify-between gap-3 py-0.5">
                              <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-foreground">Verified Pashu Medical / Insurance Certificate (PDF)</div>
                                  <div className="text-[10px] text-muted-foreground">Official veterinarian certified documentation</div>
                                </div>
                              </div>
                              <a
                                href={certUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm transition-all shrink-0"
                              >
                                <Eye className="h-3.5 w-3.5" /> View PDF
                              </a>
                            </div>
                          );
                        }

                        return (
                          <div className="flex items-center justify-between gap-3 py-0.5">
                            <div className="flex items-center gap-3">
                              <div
                                className="relative group h-12 w-12 rounded-lg overflow-hidden border bg-muted cursor-pointer shrink-0 shadow-sm hover:ring-2 hover:ring-primary transition-all"
                                onClick={() =>
                                  setSelectedPreviewImage({
                                    url: certUrl,
                                    title: "Verified Pashu Certificate",
                                  })
                                }
                                title="Click to enlarge certificate"
                              >
                                <img
                                  src={certUrl}
                                  alt="Verified Certificate"
                                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Eye className="h-3.5 w-3.5" />
                                </div>
                              </div>
                              <div>
                                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                  <ShieldCheck className="h-3.5 w-3.5" /> Official Verified Certificate Image
                                </div>
                                <span className="text-[10px] text-muted-foreground">Click thumbnail to enlarge or open full image</span>
                              </div>
                            </div>
                            <a
                              href={certUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-all shrink-0"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Open Image
                            </a>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Seller / Farmer Contact & Profile Card */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border/60 flex-wrap gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="h-11 w-11 rounded-full bg-primary/10 text-primary grid place-items-center text-base font-bold shrink-0">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-foreground flex items-center gap-2">
                      <span>{selectedCattleDetail.ownerName}</span>
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
                  {(() => {
                    const sellerUid =
                      selectedCattleDetail.ownerUid ||
                      selectedCattleDetail.sellerId ||
                      selectedCattleDetail.farmerId ||
                      selectedCattleDetail.userId ||
                      selectedCattleDetail.raw?.sellerId ||
                      selectedCattleDetail.raw?.farmerId ||
                      selectedCattleDetail.raw?.userId;
                    return sellerUid ? (
                      <Button asChild size="sm" className="gap-1.5 rounded-xl text-xs">
                        <Link
                          to="/users/$userId"
                          params={{ userId: sellerUid }}
                          search={{ tab: "cattle" } as any}
                        >
                          <User className="h-3.5 w-3.5" /> View Seller Profile
                        </Link>
                      </Button>
                    ) : null;
                  })()}
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
                    <span>Firestore Document Data</span>
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

      {/* Full Photo Zoom Modal */}
      <Dialog open={!!selectedPreviewImage} onOpenChange={(open) => !open && setSelectedPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold truncate flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary shrink-0" />
              <span>{selectedPreviewImage?.title}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedPreviewImage && (
            <div className="space-y-4">
              <div className="max-h-[70vh] rounded-2xl overflow-hidden bg-black/10 flex items-center justify-center">
                <img
                  src={formatImageUrl(selectedPreviewImage.url)}
                  alt={selectedPreviewImage.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl"
                />
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-muted-foreground font-mono truncate max-w-md">
                  {selectedPreviewImage.url}
                </span>
                <Button asChild size="sm" className="gap-1.5 rounded-xl text-xs">
                  <a href={selectedPreviewImage.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Open Full Resolution
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
