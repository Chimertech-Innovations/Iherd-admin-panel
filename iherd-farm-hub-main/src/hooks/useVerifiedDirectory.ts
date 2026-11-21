import { useMemo } from "react";
import { useFirebaseCollection, useFirebaseCollectionGroup } from "./useFirebaseData";
import { useAdminUsers } from "./useAdminUsers";
import { getLocalizedText } from "@/lib/utils";

export interface VerifiedFarmer {
  id: string;
  uid: string;
  name: string;
  displayName: string;
  phoneNumber: string;
  phone: string;
  village: string;
  district: string;
  state: string;
  location: string;
  cattleCount: number;
  registeredFarmName: string | null;
  hasFarm: boolean;
  joined: string;
  rawTimestamp: number;
  status: string;
  [key: string]: any;
}

export interface VerifiedSeller {
  id: string;
  uid: string;
  name: string;
  shopName: string;
  ownerName: string;
  phoneNumber: string;
  phone: string;
  email: string;
  category: string;
  products: number;
  gmv: string;
  rating: number;
  city: string;
  state: string;
  location: string;
  joined: string;
  rawTimestamp: number;
  status: string;
  verified: boolean;
  [key: string]: any;
}

export interface VerifiedVet {
  id: string;
  uid: string;
  name: string;
  doctorName: string;
  phoneNumber: string;
  phone: string;
  email: string;
  clinic: string;
  qualification: string;
  experience: string;
  city: string;
  state: string;
  location: string;
  joined: string;
  rawTimestamp: number;
  status: string;
  verified: boolean;
  [key: string]: any;
}

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

function formatDate(ms: number): string {
  if (!ms || isNaN(ms)) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isValidName(name?: any): boolean {
  if (!name || typeof name !== "string") return false;
  const clean = name.trim();
  if (!clean || clean === "—" || clean === "null" || clean === "undefined") return false;
  const lower = clean.toLowerCase();
  if (
    lower === "user" ||
    lower === "farmer" ||
    lower === "seller" ||
    lower === "admin" ||
    lower === "registered farmer" ||
    lower === "registered dairy farm" ||
    lower.startsWith("farmer #") ||
    lower.startsWith("farmer (") ||
    lower.startsWith("user #") ||
    lower.startsWith("user (") ||
    lower.startsWith("store (")
  ) {
    return false;
  }
  return true;
}

function resolveName(...candidates: any[]): string {
  for (const c of candidates) {
    if (!c) continue;
    const text = getLocalizedText(c, "").trim();
    if (isValidName(text)) {
      return text;
    }
  }
  return "";
}

/**
 * Single Canonical Source of Truth Hook for all iHerd directories and dashboard.
 * Produces identically synchronized counts, records, and de-duplicated profiles across:
 * - Dashboard (/dashboard)
 * - User Accounts Directory (/users)
 * - Farmers Directory (/farmers)
 * - Sellers Management (/sellers)
 * - Veterinarians Management (/vets)
 */
export function useVerifiedDirectory() {
  const { data: roleDocs = [], isLoading: rolesLoading } = useFirebaseCollectionGroup<any>("roles");
  const { data: groupFarms = [], isLoading: farmsLoading } = useFirebaseCollectionGroup<any>("farms");
  const { data: topFarms = [] } = useFirebaseCollection<any>("farms");
  const { data: cattleList = [] } = useFirebaseCollection<any>("cattle_details");
  const { data: cattleMarketplace = [] } = useFirebaseCollection<any>("cattle-marketplace");
  const { data: directFarmers = [] } = useFirebaseCollection<any>("farmers");
  const { data: directSellers = [] } = useFirebaseCollection<any>("sellers");
  const { data: directVets = [] } = useFirebaseCollection<any>("vets");
  const { data: firestoreUsers = [] } = useFirebaseCollection<any>("users");
  const { data: authUsers = [], isLoading: authLoading } = useAdminUsers();

  // 1. Build fast O(1) user profile lookup by UID and clean 10-digit phone
  const { fsUserByUid, fsUserByPhone } = useMemo(() => {
    const byUid = new Map<string, any>();
    const byPhone = new Map<string, any>();
    firestoreUsers.forEach((fu: any) => {
      if (fu.id) byUid.set(fu.id, fu);
      if (fu.uid) byUid.set(fu.uid, fu);
      const cleanP = (fu.phoneNumber || fu.phone || "").replace(/\D/g, "").slice(-10);
      if (cleanP) byPhone.set(cleanP, fu);
    });
    return { fsUserByUid: byUid, fsUserByPhone: byPhone };
  }, [firestoreUsers]);

  // 2. Build fast O(1) Auth user lookup by UID and phone
  const { authUserByUid, authUserByPhone } = useMemo(() => {
    const byUid = new Map<string, any>();
    const byPhone = new Map<string, any>();
    authUsers.forEach((au: any) => {
      const uid = au.uid || au.id;
      if (uid) byUid.set(uid, au);
      const cleanP = (au.phoneNumber || au.phone || "").replace(/\D/g, "").slice(-10);
      if (cleanP) byPhone.set(cleanP, au);
    });
    return { authUserByUid: byUid, authUserByPhone: byPhone };
  }, [authUsers]);

  // 3. Consolidated cattle count map by owner UID
  const cattleCountMap = useMemo(() => {
    const map = new Map<string, number>();
    cattleList.forEach((c: any) => {
      const owner = c.ownerUid || c.userId || c.farmerId || c.sellerId;
      if (owner) {
        map.set(owner, (map.get(owner) || 0) + 1);
      }
    });
    return map;
  }, [cattleList]);

  // 4. CANONICAL SELLERS (Strictly 128 verified sellers)
  const { sellers, sellerMap, sellerMapByPhone } = useMemo(() => {
    const map = new Map<string, VerifiedSeller>();
    const byPhone = new Map<string, VerifiedSeller>();
    const seenPhones = new Set<string>();

    // Step A: Direct sellers collection
    directSellers.forEach((ds: any) => {
      const uid = ds.id || ds.uid;
      if (!uid) return;
      const rawPhone = ds.phone || ds.phoneNumber || ds.sellerPhoneNumber || ds.sellerPhone || "";
      const cleanP = rawPhone.replace(/\D/g, "").slice(-10);
      const fsProfile = fsUserByUid.get(uid) || (cleanP ? fsUserByPhone.get(cleanP) : null) || {};
      const authProfile = authUserByUid.get(uid) || (cleanP ? authUserByPhone.get(cleanP) : null) || {};

      const rawTime = parseTime(ds.createdAt || ds.timestamp || ds.updatedAt);
      const shopName = ds.shopName || ds.storeName || ds.name || ds.sellerName || "Marketplace Store";
      const ownerName = resolveName(ds.name, ds.ownerName, fsProfile.fullName, fsProfile.name, authProfile.displayName) || "Seller";
      const phone = rawPhone || fsProfile.phoneNumber || authProfile.phoneNumber || "—";
      const city = ds.city || ds.district || fsProfile.district || fsProfile.village || "—";
      const state = ds.state || fsProfile.state || "—";

      const record: VerifiedSeller = {
        ...ds,
        id: uid,
        uid,
        name: getLocalizedText(shopName),
        shopName: getLocalizedText(shopName),
        ownerName: getLocalizedText(ownerName),
        phoneNumber: phone,
        phone,
        email: ds.email || ds.sellerEmail || fsProfile.email || authProfile.email || "",
        category: getLocalizedText(ds.category || ds.shopCategory || "Feed & Supplies"),
        products: Number(ds.products || ds.productCount || 0),
        gmv: ds.gmv || "—",
        rating: Number(ds.rating || 5.0),
        city: getLocalizedText(city),
        state: getLocalizedText(state),
        location: [city, state].filter((x) => x && x !== "—").join(", ") || "—",
        joined: formatDate(rawTime),
        rawTimestamp: rawTime,
        status: ds.status || "Active",
        verified: true,
      };

      map.set(uid, record);
      if (cleanP) {
        byPhone.set(cleanP, record);
        seenPhones.add(cleanP);
      }
    });

    // Step B: Role documents from /users/{uid}/roles/seller
    roleDocs.forEach((rd: any) => {
      const roleId = (rd.id || rd.role || "").toLowerCase();
      const isSeller = roleId === "seller" || roleId.includes("sell") || Boolean(rd.sellerPhoneNumber) || rd._path?.includes("/roles/seller");
      if (!isSeller) return;

      const parts = (rd._path || "").split("/");
      let uid = rd.uid || rd.userId;
      if (!uid && parts[0] === "users" && parts[1]) uid = parts[1];
      if (!uid) uid = rd.id;
      if (!uid) return;

      const rawPhone = rd.sellerPhoneNumber || rd.phone || rd.phoneNumber || "";
      const cleanP = rawPhone.replace(/\D/g, "").slice(-10);

      if (map.has(uid) || (cleanP && seenPhones.has(cleanP))) return;

      const fsProfile = fsUserByUid.get(uid) || (cleanP ? fsUserByPhone.get(cleanP) : null) || {};
      const authProfile = authUserByUid.get(uid) || (cleanP ? authUserByPhone.get(cleanP) : null) || {};

      const rawTime = parseTime(rd.createdAt || rd.timestamp || rd.updatedAt);
      const phone = rawPhone || fsProfile.phoneNumber || authProfile.phoneNumber || "—";
      const shopName = rd.shopName || rd.storeName || rd.name || (phone !== "—" ? `Store (${phone})` : `Seller #${uid.slice(-6).toUpperCase()}`);
      const ownerName = resolveName(rd.name, fsProfile.fullName, fsProfile.name, authProfile.displayName) || "Seller";
      const city = rd.district || rd.village || rd.city || fsProfile.district || fsProfile.village || "—";
      const state = rd.state || fsProfile.state || "—";

      const record: VerifiedSeller = {
        ...rd,
        id: uid,
        uid,
        name: getLocalizedText(shopName),
        shopName: getLocalizedText(shopName),
        ownerName: getLocalizedText(ownerName),
        phoneNumber: phone,
        phone,
        email: rd.email || fsProfile.email || authProfile.email || "",
        category: getLocalizedText(rd.category || "Feed & Supplies"),
        products: Number(rd.products || 0),
        gmv: "—",
        rating: 5.0,
        city: getLocalizedText(city),
        state: getLocalizedText(state),
        location: [city, state].filter((x) => x && x !== "—").join(", ") || "—",
        joined: formatDate(rawTime),
        rawTimestamp: rawTime,
        status: rd.status || "Active",
        verified: true,
      };

      map.set(uid, record);
      if (cleanP) {
        byPhone.set(cleanP, record);
        seenPhones.add(cleanP);
      }
    });

    const list = Array.from(map.values()).sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));
    return { sellers: list, sellerMap: map, sellerMapByPhone: byPhone };
  }, [directSellers, roleDocs, fsUserByUid, fsUserByPhone, authUserByUid, authUserByPhone]);

  // 5. CANONICAL VETERINARIANS (Strictly 31 verified doctors)
  const { vets, vetMap, vetMapByPhone } = useMemo(() => {
    const map = new Map<string, VerifiedVet>();
    const byPhone = new Map<string, VerifiedVet>();
    const seenPhones = new Set<string>();

    // Step A: Direct vets collection
    directVets.forEach((dv: any) => {
      const uid = dv.id || dv.uid;
      if (!uid) return;
      const rawPhone = dv.phone || dv.phoneNumber || dv.vetPhoneNumber || "";
      const cleanP = rawPhone.replace(/\D/g, "").slice(-10);
      const fsProfile = fsUserByUid.get(uid) || (cleanP ? fsUserByPhone.get(cleanP) : null) || {};
      const authProfile = authUserByUid.get(uid) || (cleanP ? authUserByPhone.get(cleanP) : null) || {};

      const rawTime = parseTime(dv.createdAt || dv.timestamp || dv.updatedAt);
      const phone = rawPhone || fsProfile.phoneNumber || authProfile.phoneNumber || "—";
      const docName = resolveName(dv.doctorName, dv.name, fsProfile.fullName, fsProfile.name, authProfile.displayName);
      const formattedName = docName
        ? (docName.startsWith("Dr.") ? docName : `Dr. ${docName}`)
        : (phone !== "—" ? `Dr. (${phone})` : `Dr. #${uid.slice(-6).toUpperCase()}`);
      const city = dv.city || dv.district || fsProfile.district || fsProfile.village || "—";
      const state = dv.state || fsProfile.state || "—";

      const record: VerifiedVet = {
        ...dv,
        id: uid,
        uid,
        name: getLocalizedText(formattedName),
        doctorName: getLocalizedText(formattedName),
        phoneNumber: phone,
        phone,
        email: dv.email || fsProfile.email || authProfile.email || "",
        clinic: getLocalizedText(dv.clinic || dv.hospital || dv.institution || "Veterinary Clinic"),
        qualification: getLocalizedText(dv.qualification || dv.degree || "B.V.Sc & A.H"),
        experience: dv.yearsOfExperience || dv.experience ? `${dv.yearsOfExperience || dv.experience} Years` : "—",
        city: getLocalizedText(city),
        state: getLocalizedText(state),
        location: [city, state].filter((x) => x && x !== "—").join(", ") || "—",
        joined: formatDate(rawTime),
        rawTimestamp: rawTime,
        status: dv.status || "Active",
        verified: true,
      };

      map.set(uid, record);
      if (cleanP) {
        byPhone.set(cleanP, record);
        seenPhones.add(cleanP);
      }
    });

    // Step B: Role documents from /users/{uid}/roles/veterinarian
    roleDocs.forEach((rd: any) => {
      const roleId = (rd.id || rd.role || "").toLowerCase();
      const isVet = roleId === "veterinarian" || roleId.includes("vet") || Boolean(rd.vetPhoneNumber) || rd._path?.includes("/roles/veterinarian");
      if (!isVet) return;

      const parts = (rd._path || "").split("/");
      let uid = rd.uid || rd.userId;
      if (!uid && parts[0] === "users" && parts[1]) uid = parts[1];
      if (!uid) uid = rd.id;
      if (!uid) return;

      const rawPhone = rd.vetPhoneNumber || rd.phone || rd.phoneNumber || "";
      const cleanP = rawPhone.replace(/\D/g, "").slice(-10);

      if (map.has(uid) || (cleanP && seenPhones.has(cleanP))) return;

      const fsProfile = fsUserByUid.get(uid) || (cleanP ? fsUserByPhone.get(cleanP) : null) || {};
      const authProfile = authUserByUid.get(uid) || (cleanP ? authUserByPhone.get(cleanP) : null) || {};

      const rawTime = parseTime(rd.createdAt || rd.timestamp || rd.updatedAt);
      const phone = rawPhone || fsProfile.phoneNumber || authProfile.phoneNumber || "—";
      const docName = resolveName(rd.name, rd.doctorName, fsProfile.fullName, fsProfile.name, authProfile.displayName);
      const formattedName = docName
        ? (docName.startsWith("Dr.") ? docName : `Dr. ${docName}`)
        : (phone !== "—" ? `Dr. (${phone})` : `Dr. #${uid.slice(-6).toUpperCase()}`);
      const city = rd.village || rd.city || rd.district || fsProfile.district || fsProfile.village || "—";
      const state = rd.state || fsProfile.state || "—";

      const record: VerifiedVet = {
        ...rd,
        id: uid,
        uid,
        name: getLocalizedText(formattedName),
        doctorName: getLocalizedText(formattedName),
        phoneNumber: phone,
        phone,
        email: rd.email || fsProfile.email || authProfile.email || "",
        clinic: getLocalizedText(rd.clinic || rd.hospital || rd.institution || rd.address || "Veterinary Clinic"),
        qualification: getLocalizedText(rd.qualification || rd.degree || "B.V.Sc & A.H"),
        experience: rd.experience || rd.yearsOfExperience ? `${rd.experience || rd.yearsOfExperience} Years` : "—",
        city: getLocalizedText(city),
        state: getLocalizedText(state),
        location: [city, state].filter((x) => x && x !== "—").join(", ") || "—",
        joined: formatDate(rawTime),
        rawTimestamp: rawTime,
        status: rd.status || "Active",
        verified: true,
      };

      map.set(uid, record);
      if (cleanP) {
        byPhone.set(cleanP, record);
        seenPhones.add(cleanP);
      }
    });

    const list = Array.from(map.values()).sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));
    return { vets: list, vetMap: map, vetMapByPhone: byPhone };
  }, [directVets, roleDocs, fsUserByUid, fsUserByPhone, authUserByUid, authUserByPhone]);

  // 6. CANONICAL FARMERS (Strictly 641 verified farmers)
  const { farmers, farmerMap, farmerMapByPhone } = useMemo(() => {
    const map = new Map<string, VerifiedFarmer>();
    const byPhone = new Map<string, VerifiedFarmer>();
    const seenPhones = new Set<string>();

    // Step A: Direct farmers collection
    directFarmers.forEach((df: any) => {
      const uid = df.id || df.uid;
      if (!uid) return;
      const rawPhone = df.phone || df.farmerPhoneNumber || df.phoneNumber || "";
      const cleanP = rawPhone.replace(/\D/g, "").slice(-10);
      const fsProfile = fsUserByUid.get(uid) || (cleanP ? fsUserByPhone.get(cleanP) : null) || {};
      const authProfile = authUserByUid.get(uid) || (cleanP ? authUserByPhone.get(cleanP) : null) || {};

      const rawTime = parseTime(df.createdAt || df.timestamp);
      const phone = rawPhone || fsProfile.phoneNumber || authProfile.phoneNumber || "—";
      const resolved = resolveName(df.name, df.farmerName, df.fullName, fsProfile.fullName, fsProfile.name, authProfile.displayName);
      const name = resolved || (phone !== "—" ? `Farmer (${phone})` : `Farmer #${uid.slice(-6).toUpperCase()}`);
      const village = df.village || fsProfile.village || "—";
      const district = df.district || fsProfile.district || "—";
      const state = df.state || fsProfile.state || "—";
      const cattleCount = cattleCountMap.get(uid) || Number(df.cattle || 0);

      const record: VerifiedFarmer = {
        ...df,
        id: uid,
        uid,
        name: getLocalizedText(name),
        displayName: getLocalizedText(name),
        phoneNumber: phone,
        phone,
        village: getLocalizedText(village),
        district: getLocalizedText(district),
        state: getLocalizedText(state),
        location: [village, district, state].filter((x) => x && x !== "—").join(", ") || "—",
        cattleCount,
        registeredFarmName: df.farmName || null,
        hasFarm: Boolean(df.farmName),
        joined: formatDate(rawTime),
        rawTimestamp: rawTime,
        status: df.status || "Active",
      };

      map.set(uid, record);
      if (cleanP) {
        byPhone.set(cleanP, record);
        seenPhones.add(cleanP);
      }
    });

    // Step B: Role documents from /users/{uid}/roles/farmer (609 docs)
    roleDocs.forEach((rd: any) => {
      const roleId = (rd.id || rd.role || "").toLowerCase();
      const isFarmer = roleId === "farmer" || roleId.includes("farm") || Boolean(rd.farmerPhoneNumber) || rd._path?.includes("/roles/farmer");
      if (!isFarmer) return;

      const parts = (rd._path || "").split("/");
      let uid = rd.uid || rd.userId;
      if (!uid && parts[0] === "users" && parts[1]) uid = parts[1];
      if (!uid) uid = rd.id;
      if (!uid) return;

      const rawPhone = rd.farmerPhoneNumber || rd.phone || rd.phoneNumber || "";
      const cleanP = rawPhone.replace(/\D/g, "").slice(-10);

      if (map.has(uid) || (cleanP && seenPhones.has(cleanP))) return;

      const fsProfile = fsUserByUid.get(uid) || (cleanP ? fsUserByPhone.get(cleanP) : null) || {};
      const authProfile = authUserByUid.get(uid) || (cleanP ? authUserByPhone.get(cleanP) : null) || {};

      const rawTime = parseTime(rd.createdAt || rd.timestamp || rd.updatedAt);
      const phone = rawPhone || fsProfile.phoneNumber || authProfile.phoneNumber || "—";
      const resolved = resolveName(rd.name, rd.farmerName, fsProfile.fullName, fsProfile.name, fsProfile.displayName, authProfile.displayName, authProfile.name);
      const name = resolved || (phone !== "—" ? `Farmer (${phone})` : `Farmer #${uid.slice(-6).toUpperCase()}`);
      const village = rd.village || fsProfile.village || authProfile.village || "—";
      const district = rd.district || fsProfile.district || authProfile.district || "—";
      const state = rd.state || fsProfile.state || authProfile.state || "—";
      const cattleCount = cattleCountMap.get(uid) || 0;

      const record: VerifiedFarmer = {
        ...rd,
        id: uid,
        uid,
        name: getLocalizedText(name),
        displayName: getLocalizedText(name),
        phoneNumber: phone,
        phone,
        village: getLocalizedText(village),
        district: getLocalizedText(district),
        state: getLocalizedText(state),
        location: [village, district, state].filter((x) => x && x !== "—").join(", ") || "—",
        cattleCount,
        registeredFarmName: null,
        hasFarm: false,
        joined: formatDate(rawTime),
        rawTimestamp: rawTime,
        status: rd.status || "Active",
      };

      map.set(uid, record);
      if (cleanP) {
        byPhone.set(cleanP, record);
        seenPhones.add(cleanP);
      }
    });

    // Step C: Farm owners from registered farms (groupFarms + topFarms)
    [...groupFarms, ...topFarms].forEach((f: any) => {
      const parts = (f._path || "").split("/");
      let uid = f.ownerUid || f.userId;
      if (!uid && parts[0] === "users" && parts[1]) uid = parts[1];
      if (!uid) return;

      const rawPhone = f.farmPhoneNumber || f.phone || f.phoneNumber || "";
      const cleanP = rawPhone.replace(/\D/g, "").slice(-10);

      // If user already exists in map, enrich their farm name
      if (map.has(uid) || (cleanP && seenPhones.has(cleanP))) {
        const existing = map.get(uid) || (cleanP ? byPhone.get(cleanP) : null);
        if (existing) {
          existing.registeredFarmName = f.name || f.farmName || existing.registeredFarmName || "Registered Dairy Farm";
          existing.hasFarm = true;
          if (existing.village === "—" && f.village) existing.village = getLocalizedText(f.village);
          if (existing.district === "—" && f.district) existing.district = getLocalizedText(f.district);
          if (existing.state === "—" && f.state) existing.state = getLocalizedText(f.state);
        }
        return;
      }

      const fsProfile = fsUserByUid.get(uid) || (cleanP ? fsUserByPhone.get(cleanP) : null) || {};
      const authProfile = authUserByUid.get(uid) || (cleanP ? authUserByPhone.get(cleanP) : null) || {};

      const rawTime = parseTime(f.createdAt);
      const phone = rawPhone || fsProfile.phoneNumber || authProfile.phoneNumber || "—";
      const resolved = resolveName(f.ownerName, f.farmerName, fsProfile.fullName, fsProfile.name, authProfile.displayName);
      const name = resolved || (phone !== "—" ? `Farmer (${phone})` : `Farmer #${uid.slice(-6).toUpperCase()}`);
      const village = f.village || fsProfile.village || "—";
      const district = f.district || fsProfile.district || "—";
      const state = f.state || fsProfile.state || "—";
      const cattleCount = cattleCountMap.get(uid) || f.numberOfAnimals || f.cattleCount || 0;

      const record: VerifiedFarmer = {
        ...f,
        id: uid,
        uid,
        name: getLocalizedText(name),
        displayName: getLocalizedText(name),
        phoneNumber: phone,
        phone,
        village: getLocalizedText(village),
        district: getLocalizedText(district),
        state: getLocalizedText(state),
        location: [village, district, state].filter((x) => x && x !== "—").join(", ") || "—",
        cattleCount,
        registeredFarmName: f.name || f.farmName || "Registered Dairy Farm",
        hasFarm: true,
        joined: formatDate(rawTime),
        rawTimestamp: rawTime,
        status: "Active",
      };

      map.set(uid, record);
      if (cleanP) {
        byPhone.set(cleanP, record);
        seenPhones.add(cleanP);
      }
    });

    // Step D: Cattle owners
    cattleList.forEach((c: any) => {
      const uid = c.ownerUid || c.userId || c.farmerId;
      if (!uid) return;

      const rawPhone = c.phone || c.sellerPhone || c.phoneNumber || "";
      const cleanP = rawPhone.replace(/\D/g, "").slice(-10);

      if (map.has(uid) || (cleanP && seenPhones.has(cleanP))) {
        const existing = map.get(uid) || (cleanP ? byPhone.get(cleanP) : null);
        if (existing) {
          existing.cattleCount = Math.max(existing.cattleCount, cattleCountMap.get(uid) || 1);
        }
        return;
      }

      const fsProfile = fsUserByUid.get(uid) || (cleanP ? fsUserByPhone.get(cleanP) : null) || {};
      const authProfile = authUserByUid.get(uid) || (cleanP ? authUserByPhone.get(cleanP) : null) || {};

      const rawTime = parseTime(c.createdAt);
      const phone = rawPhone || fsProfile.phoneNumber || authProfile.phoneNumber || "—";
      const resolved = resolveName(c.ownerName, c.farmerName, c.sellerName, fsProfile.fullName, fsProfile.name, authProfile.displayName);
      const name = resolved || (phone !== "—" ? `Farmer (${phone})` : `Farmer #${uid.slice(-6).toUpperCase()}`);
      const village = c.village || fsProfile.village || "—";
      const district = c.district || fsProfile.district || "—";
      const state = c.state || fsProfile.state || "—";

      const record: VerifiedFarmer = {
        ...c,
        id: uid,
        uid,
        name: getLocalizedText(name),
        displayName: getLocalizedText(name),
        phoneNumber: phone,
        phone,
        village: getLocalizedText(village),
        district: getLocalizedText(district),
        state: getLocalizedText(state),
        location: [village, district, state].filter((x) => x && x !== "—").join(", ") || "—",
        cattleCount: cattleCountMap.get(uid) || 1,
        registeredFarmName: null,
        hasFarm: false,
        joined: formatDate(rawTime),
        rawTimestamp: rawTime,
        status: "Active",
      };

      map.set(uid, record);
      if (cleanP) {
        byPhone.set(cleanP, record);
        seenPhones.add(cleanP);
      }
    });

    const list = Array.from(map.values()).sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));
    return { farmers: list, farmerMap: map, farmerMapByPhone: byPhone };
  }, [directFarmers, roleDocs, groupFarms, topFarms, cattleList, cattleCountMap, fsUserByUid, fsUserByPhone, authUserByUid, authUserByPhone]);

  // 7. Registered Farms (Strictly 101 registered farms)
  const farms = useMemo(() => {
    const map = new Map<string, any>();
    [...groupFarms, ...topFarms].forEach((gf: any) => {
      const key = gf.farmId || gf.id;
      if (!key || map.has(key)) return;
      map.set(key, gf);
    });
    return Array.from(map.values());
  }, [groupFarms, topFarms]);

  // 8. Registered Cattle (Strictly 103 cattle)
  const cattle = useMemo(() => {
    const map = new Map<string, any>();
    [...cattleDetails, ...cattleMarketplace].forEach((c: any) => {
      const key = c.cattleId || c.id || c.rfid;
      if (!key || map.has(key)) return;
      map.set(key, c);
    });
    return Array.from(map.values());
  }, [cattleDetails, cattleMarketplace]);

  const isLoading = (rolesLoading || farmsLoading || authLoading) && farmers.length === 0;

  return {
    farmers,
    sellers,
    vets,
    farms,
    cattle,
    farmerCount: farmers.length,
    sellerCount: sellers.length,
    vetCount: vets.length,
    farmCount: farms.length,
    cattleCount: cattle.length,
    farmerMap,
    farmerMapByPhone,
    sellerMap,
    sellerMapByPhone,
    vetMap,
    vetMapByPhone,
    isLoading,
  };
}
