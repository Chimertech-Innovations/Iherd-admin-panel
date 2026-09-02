import { useMemo, useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Users,
  User,
  MapPin,
  Phone,
  Beef,
  Building,
  CheckCircle2,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useFirebaseCollection, useFirebaseCollectionGroup } from "../hooks/useFirebaseData";
import { getLocalizedText } from "@/lib/utils";
import { getApiBaseUrlSync, isLocalHostname } from "@/lib/apiClient";


export const Route = createFileRoute("/farmers/")({
  head: () => ({ meta: [{ title: "Farmers Directory — iHerd Admin" }] }),
  component: FarmersPage,
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

function formatDate(ms: number): string {
  if (!ms || isNaN(ms)) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FarmersPage() {
  const { data: authUsers = [], isLoading: authLoading, isFetchingBalance } = useAdminUsers();
  const { data: firestoreUsers = [], isLoading: fsLoading } = useFirebaseCollection<any>("users");
  const { data: directFarmers = [], isLoading: directLoading } = useFirebaseCollection<any>("farmers");
  const { data: cattleList = [] } = useFirebaseCollection<any>("cattle_details");
  const { data: topFarms = [] } = useFirebaseCollection<any>("farms");
  const { data: groupFarms = [] } = useFirebaseCollectionGroup<any>("farms");

  const [backendFarms, setBackendFarms] = useState<any[]>([]);

  // Fetch backend registered farms with multi-endpoint fallback
  useEffect(() => {
    let isMounted = true;
    const fetchBackendFarms = async () => {
      const primary = getApiBaseUrlSync();
      const endpoints = [
        primary,
        isLocalHostname() ? "http://localhost:5000" : null,
        isLocalHostname() ? "http://127.0.0.1:5000" : null,
        "https://iherdadminpanel.onrender.com",
      ].filter(Boolean) as string[];

      for (const base of endpoints) {
        try {
          const res = await fetch(`${base}/api/admin/farms`);
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.farms) && json.farms.length > 0 && isMounted) {
              setBackendFarms(json.farms);
              break;
            }
          }
        } catch {}
      }
    };

    fetchBackendFarms();
    return () => { isMounted = false; };
  }, []);

  // Build cattle count map by owner UID
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

  // Build consolidated metadata resolver for farmer name, phone, village, district, state from farms & cattle
  const farmerMetaMap = useMemo(() => {
    const map = new Map<string, {
      name?: string;
      phone?: string;
      village?: string;
      district?: string;
      state?: string;
      farmName?: string;
      farmId?: string;
    }>();

    // 1. Process backend farms
    backendFarms.forEach((f: any) => {
      const owner = f.ownerUid || f.userId || f.farmerUid;
      if (!owner) return;
      const ownerName = getLocalizedText(f.ownerName || f.farmerName, "");
      const phone = getLocalizedText(f.farmPhoneNumber || f.phone || f.phoneNumber || f.farmerPhoneNumber, "");
      const village = getLocalizedText(f.village, "");
      const district = getLocalizedText(f.district, "");
      const state = getLocalizedText(f.state, "");
      const farmName = getLocalizedText(f.name || f.farmName, "");

      const existing = map.get(owner) || {};
      map.set(owner, {
        name: (ownerName && ownerName !== "Farmer" && ownerName !== "User") ? ownerName : existing.name,
        phone: (phone && phone !== "—") ? phone : existing.phone,
        village: (village && village !== "—") ? village : existing.village,
        district: (district && district !== "—") ? district : existing.district,
        state: (state && state !== "—") ? state : existing.state,
        farmName: farmName || existing.farmName,
        farmId: f.farmId || f.id || existing.farmId,
      });
    });

    // 2. Traverse registered farm subcollections (/users/{uid}/roles/farmer/farms/{farmId})
    groupFarms.forEach((f: any) => {
      const path = f._path || "";
      const segments = path.split("/");
      let owner = f.ownerUid || f.userId;
      if (!owner && segments[0] === "users" && segments[1]) owner = segments[1];
      else if (!owner && segments[0] === "farmers" && segments[1]) owner = segments[1];
      if (!owner) return;

      const ownerName = getLocalizedText(f.ownerName || f.farmerName, "");
      const phone = getLocalizedText(f.farmPhoneNumber || f.phone || f.phoneNumber, "");
      const village = getLocalizedText(f.village, "");
      const district = getLocalizedText(f.district, "");
      const state = getLocalizedText(f.state, "");
      const farmName = getLocalizedText(f.name || f.farmName, "");

      const existing = map.get(owner) || {};
      map.set(owner, {
        name: (ownerName && ownerName !== "Farmer" && ownerName !== "User") ? ownerName : existing.name,
        phone: (phone && phone !== "—") ? phone : existing.phone,
        village: (village && village !== "—") ? village : existing.village,
        district: (district && district !== "—") ? district : existing.district,
        state: (state && state !== "—") ? state : existing.state,
        farmName: farmName || existing.farmName,
        farmId: f.farmId || f.id || existing.farmId,
      });
    });

    // 3. Traverse top-level farms collection
    topFarms.forEach((f: any) => {
      const owner = f.ownerUid || f.userId;
      if (!owner) return;
      const ownerName = getLocalizedText(f.ownerName || f.farmerName, "");
      const phone = getLocalizedText(f.farmPhoneNumber || f.phone || f.phoneNumber, "");
      const village = getLocalizedText(f.village, "");
      const district = getLocalizedText(f.district, "");
      const state = getLocalizedText(f.state, "");
      const farmName = getLocalizedText(f.name || f.farmName, "");

      const existing = map.get(owner) || {};
      map.set(owner, {
        name: (ownerName && ownerName !== "Farmer" && ownerName !== "User") ? ownerName : existing.name,
        phone: (phone && phone !== "—") ? phone : existing.phone,
        village: (village && village !== "—") ? village : existing.village,
        district: (district && district !== "—") ? district : existing.district,
        state: (state && state !== "—") ? state : existing.state,
        farmName: farmName || existing.farmName,
        farmId: f.farmId || f.id || existing.farmId,
      });
    });

    // 4. Traverse cattle_details
    cattleList.forEach((c: any) => {
      const owner = c.ownerUid || c.userId || c.farmerId || c.sellerId;
      if (!owner) return;
      const ownerName = getLocalizedText(c.ownerName || c.farmerName || c.sellerName, "");
      const phone = getLocalizedText(c.phone || c.sellerPhone || c.phoneNumber || c.ownerPhone, "");
      const village = getLocalizedText(c.village, "");
      const district = getLocalizedText(c.district, "");
      const state = getLocalizedText(c.state, "");

      const existing = map.get(owner) || {};
      map.set(owner, {
        name: (ownerName && ownerName !== "Farmer" && ownerName !== "User") ? ownerName : existing.name,
        phone: (phone && phone !== "—") ? phone : existing.phone,
        village: (village && village !== "—") ? village : existing.village,
        district: (district && district !== "—") ? district : existing.district,
        state: (state && state !== "—") ? state : existing.state,
        farmName: existing.farmName,
        farmId: existing.farmId,
      });
    });

    return map;
  }, [backendFarms, groupFarms, topFarms, cattleList]);

  const farmerMap = new Map<string, any>();

  // 1. Process Auth users merged with Firestore profiles
  authUsers.forEach((authUser: any) => {
    const uid = authUser.uid;
    const fsUser = firestoreUsers.find((fu: any) => fu.id === uid || fu.uid === uid);
    const directFarmer = directFarmers.find((df: any) => df.id === uid || df.uid === uid);
    const meta = farmerMetaMap.get(uid) || {};

    const fsRoles = fsUser?.roles || (fsUser?.role ? [fsUser.role] : []);
    const fsRolesList: string[] = Array.isArray(fsRoles) ? fsRoles : [String(fsRoles)];
    const hasFarmerRole = fsRolesList.some((r: any) => typeof r === "string" && r.toLowerCase().includes("farmer"));
    const hasDirectFarmerDoc = Boolean(directFarmer);
    const hasFarm = Boolean(
      meta.farmId ||
      meta.farmName ||
      (fsUser?.farms && typeof fsUser.farms === "object" && (fsUser.farms.name || fsUser.farms.farmName || (Array.isArray(fsUser.farms) && fsUser.farms.length > 0)))
    );
    const hasCattle = (cattleCountMap.get(uid) || 0) > 0;
    const hasGenuineFarmerProfile = Boolean(
      fsUser?.farmer &&
      typeof fsUser.farmer === "object" &&
      (fsUser.farmer.farmName ||
       fsUser.farmer.farmerName ||
       (fsUser.farmer.village && fsUser.farmer.village !== "—") ||
       (fsUser.farmer.name && fsUser.farmer.name !== "Farmer" && !fsUser.farmer.name.startsWith("Farmer (") && !fsUser.farmer.name.startsWith("Farmer #")))
    );

    const isFarmer = hasFarmerRole || hasDirectFarmerDoc || hasFarm || hasCattle || hasGenuineFarmerProfile || fsUser?.isFarmer === true;

    if (isFarmer) {
      const farmerProfile = fsUser?.farmer || authUser?.farmer || directFarmer || {};
      const rawTimestamp = parseTime(
        fsUser?.createdAt ||
        farmerProfile?.createdAt ||
        authUser?.createdAt ||
        directFarmer?.createdAt ||
        authUser?.metadata?.creationTime
      );

      const phone =
        (authUser?.phoneNumber && authUser.phoneNumber !== "—") ? authUser.phoneNumber :
        (fsUser?.phoneNumber && fsUser.phoneNumber !== "—") ? fsUser.phoneNumber :
        (meta.phone && meta.phone !== "—") ? meta.phone :
        (farmerProfile.farmerPhoneNumber && farmerProfile.farmerPhoneNumber !== "—") ? farmerProfile.farmerPhoneNumber :
        (fsUser?.phone && fsUser.phone !== "—") ? fsUser.phone :
        (authUser?.phone && authUser.phone !== "—") ? authUser.phone :
        "—";

      let resolvedName =
        (meta.name && meta.name !== "User" && meta.name !== "Farmer" && !meta.name.startsWith("Farmer (") && !meta.name.startsWith("Farmer #")) ? meta.name :
        (farmerProfile.name && farmerProfile.name !== "User" && farmerProfile.name !== "Farmer" && !farmerProfile.name.startsWith("Farmer (") && !farmerProfile.name.startsWith("Farmer #")) ? farmerProfile.name :
        (farmerProfile.farmerName && farmerProfile.farmerName !== "User" && !farmerProfile.farmerName.startsWith("Farmer")) ? farmerProfile.farmerName :
        (fsUser?.farmerName && fsUser?.farmerName !== "User" && !fsUser?.farmerName.startsWith("Farmer")) ? fsUser.farmerName :
        (fsUser?.fullName && fsUser?.fullName !== "User" && !fsUser?.fullName.startsWith("Farmer")) ? fsUser.fullName :
        (fsUser?.name && fsUser?.name !== "User" && !fsUser?.name.startsWith("Farmer")) ? fsUser.name :
        (fsUser?.displayName && fsUser?.displayName !== "User" && !fsUser?.displayName.startsWith("Farmer")) ? fsUser.displayName :
        (authUser?.displayName && authUser?.displayName !== "User" && !authUser?.displayName.startsWith("Farmer") && !authUser?.displayName.startsWith("User (")) ? authUser.displayName :
        (authUser?.name && authUser?.name !== "User" && !authUser?.name.startsWith("Farmer")) ? authUser.name :
        "";

      if (!resolvedName || resolvedName.toLowerCase() === "user" || resolvedName.toLowerCase() === "farmer") {
        if (phone && phone !== "—") {
          resolvedName = `Farmer (${phone})`;
        } else {
          resolvedName = `Farmer #${uid.slice(-6).toUpperCase()}`;
        }
      }

      const village = meta.village || farmerProfile.village || fsUser?.village || "—";
      const district = meta.district || farmerProfile.district || fsUser?.district || "—";
      const state = meta.state || farmerProfile.state || fsUser?.state || "—";

      const trackedCattle = cattleCountMap.get(uid) || Number(farmerProfile.cattle || fsUser?.cattle || 0);
      const registeredFarmName = meta.farmName || (fsUser?.farms?.name || farmerProfile?.farmName || null);

      farmerMap.set(uid, {
        id: uid,
        uid,
        name: getLocalizedText(resolvedName),
        phone,
        village: getLocalizedText(village),
        district: getLocalizedText(district),
        state: getLocalizedText(state),
        cattleCount: trackedCattle,
        registeredFarmName,
        hasFarm: Boolean(registeredFarmName),
        joined: formatDate(rawTimestamp),
        rawTimestamp,
        status: fsUser?.status || authUser?.status || farmerProfile.status || "Active",
      });
    }
  });

  // 2. Process standalone Firestore users with genuine farmer roles
  firestoreUsers.forEach((fsUser: any) => {
    const uid = fsUser.id || fsUser.uid;
    if (!uid || farmerMap.has(uid)) return;

    const meta = farmerMetaMap.get(uid) || {};
    const rawRoles = fsUser.roles || (fsUser.role ? [fsUser.role] : []);
    const roles: string[] = Array.isArray(rawRoles) ? rawRoles : [String(rawRoles)];
    const hasFarmerRole = roles.some((r: any) => typeof r === "string" && r.toLowerCase().includes("farmer"));
    const directFarmer = directFarmers.find((df: any) => df.id === uid || df.uid === uid);
    const hasDirectFarmerDoc = Boolean(directFarmer);
    const hasFarm = Boolean(meta.farmId || meta.farmName || (fsUser.farms && typeof fsUser.farms === "object" && (fsUser.farms.name || fsUser.farms.farmName || (Array.isArray(fsUser.farms) && fsUser.farms.length > 0))));
    const hasCattle = (cattleCountMap.get(uid) || 0) > 0;
    const hasGenuineFarmerProfile = Boolean(
      fsUser.farmer &&
      typeof fsUser.farmer === "object" &&
      (fsUser.farmer.farmName ||
       fsUser.farmer.farmerName ||
       (fsUser.farmer.village && fsUser.farmer.village !== "—") ||
       (fsUser.farmer.name && fsUser.farmer.name !== "Farmer" && !fsUser.farmer.name.startsWith("Farmer (") && !fsUser.farmer.name.startsWith("Farmer #")))
    );

    const isFarmer = hasFarmerRole || hasDirectFarmerDoc || hasFarm || hasCattle || hasGenuineFarmerProfile || fsUser.isFarmer === true;

    if (isFarmer) {
      const farmerProfile = fsUser.farmer || directFarmer || {};
      const rawTimestamp = parseTime(
        fsUser.createdAt ||
        farmerProfile?.createdAt ||
        directFarmer?.createdAt
      );

      const phone =
        (fsUser.phoneNumber && fsUser.phoneNumber !== "—") ? fsUser.phoneNumber :
        (meta.phone && meta.phone !== "—") ? meta.phone :
        (farmerProfile.farmerPhoneNumber && farmerProfile.farmerPhoneNumber !== "—") ? farmerProfile.farmerPhoneNumber :
        (fsUser.phone && fsUser.phone !== "—") ? fsUser.phone :
        "—";

      let resolvedName =
        (meta.name && meta.name !== "User" && meta.name !== "Farmer" && !meta.name.startsWith("Farmer (") && !meta.name.startsWith("Farmer #")) ? meta.name :
        (farmerProfile.name && farmerProfile.name !== "User" && farmerProfile.name !== "Farmer" && !farmerProfile.name.startsWith("Farmer (") && !farmerProfile.name.startsWith("Farmer #")) ? farmerProfile.name :
        (farmerProfile.farmerName && farmerProfile.farmerName !== "User" && !farmerProfile.farmerName.startsWith("Farmer")) ? farmerProfile.farmerName :
        (fsUser?.farmerName && fsUser?.farmerName !== "User" && !fsUser?.farmerName.startsWith("Farmer")) ? fsUser.farmerName :
        (fsUser?.fullName && fsUser?.fullName !== "User" && !fsUser?.fullName.startsWith("Farmer")) ? fsUser.fullName :
        (fsUser?.name && fsUser?.name !== "User" && !fsUser?.name.startsWith("Farmer")) ? fsUser.name :
        (fsUser?.displayName && fsUser?.displayName !== "User" && !fsUser?.displayName.startsWith("Farmer")) ? fsUser.displayName :
        "";

      if (!resolvedName || resolvedName.toLowerCase() === "user" || resolvedName.toLowerCase() === "farmer") {
        if (phone && phone !== "—") {
          resolvedName = `Farmer (${phone})`;
        } else {
          resolvedName = `Farmer #${uid.slice(-6).toUpperCase()}`;
        }
      }

      const village = meta.village || farmerProfile.village || fsUser.village || "—";
      const district = meta.district || farmerProfile.district || fsUser.district || "—";
      const state = meta.state || farmerProfile.state || fsUser.state || "—";

      const trackedCattle = cattleCountMap.get(uid) || Number(farmerProfile.cattle || fsUser.cattle || 0);
      const registeredFarmName = meta.farmName || (fsUser.farms?.name || farmerProfile?.farmName || null);

      farmerMap.set(uid, {
        id: uid,
        uid,
        name: getLocalizedText(resolvedName),
        phone,
        village: getLocalizedText(village),
        district: getLocalizedText(district),
        state: getLocalizedText(state),
        cattleCount: trackedCattle,
        registeredFarmName,
        hasFarm: Boolean(registeredFarmName),
        joined: formatDate(rawTimestamp),
        rawTimestamp,
        status: fsUser.status || farmerProfile.status || "Active",
      });
    }
  });

  // 3. Process standalone direct farmers collection
  directFarmers.forEach((df: any) => {
    const uid = df.id || df.uid;
    if (!uid || farmerMap.has(uid)) return;

    const meta = farmerMetaMap.get(uid) || {};
    const rawTimestamp = parseTime(df.createdAt || df.timestamp);
    const phone = df.phone || df.farmerPhoneNumber || df.phoneNumber || meta.phone || "—";
    const name = df.name || df.farmerName || meta.name || (phone !== "—" ? `Farmer (${phone})` : `Farmer #${uid.slice(-6).toUpperCase()}`);
    const village = df.village || meta.village || "—";
    const district = df.district || meta.district || "—";
    const state = df.state || meta.state || "—";
    const trackedCattle = cattleCountMap.get(uid) || Number(df.cattle || 0);
    const registeredFarmName = meta.farmName || df.farmName || null;

    farmerMap.set(uid, {
      id: uid,
      uid,
      name: getLocalizedText(name),
      phone,
      village: getLocalizedText(village),
      district: getLocalizedText(district),
      state: getLocalizedText(state),
      cattleCount: trackedCattle,
      registeredFarmName,
      hasFarm: Boolean(registeredFarmName),
      joined: formatDate(rawTimestamp),
      rawTimestamp,
      status: df.status || "Active",
    });
  });

  // Sort by newest registration first
  const allFarmers = Array.from(farmerMap.values()).sort(
    (a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0)
  );

  const isLoading = (authLoading || fsLoading || directLoading) && allFarmers.length === 0;

  const totalFarmers = allFarmers.length;
  const activeFarmers = allFarmers.filter((f) => f.status.toLowerCase() === "active" || !f.status).length;
  const farmersWithFarms = allFarmers.filter((f) => f.hasFarm).length;
  const farmersWithCattle = allFarmers.filter((f) => f.cattleCount > 0).length;

  return (
    <div className="space-y-6">
      <DataPage
        title="Farmers Directory"
        description="All registered farmers, contact info, locations, and linked farm and livestock records."
        exportFilename="iherd_farmers_directory"
        isLoading={isLoading}
        isFetchingBalance={isFetchingBalance}
        customExportColumns={[
          { header: "Farmer Name", accessor: "name" },
          { header: "Farmer UID", accessor: "uid" },
          { header: "Phone Number", accessor: "phone" },
          { header: "Village", accessor: "village" },
          { header: "District", accessor: "district" },
          { header: "State", accessor: "state" },
          { header: "Registered Farm Name", accessor: (r) => r.registeredFarmName || "None" },
          { header: "Tracked Cattle Count", accessor: "cattleCount" },
          { header: "Registration Date", accessor: "joined" },
          { header: "Status", accessor: "status" },
        ]}
        stats={[
          {
            label: "Total Registered Farmers",
            value: isLoading ? "…" : String(totalFarmers),
            change: `${activeFarmers} active farmers`,
            up: true,
          },
          {
            label: "Farmers with Registered Farms",
            value: isLoading ? "…" : String(farmersWithFarms),
            change: "Have active farms",
            up: true,
          },
          {
            label: "Farmers with Cattle",
            value: isLoading ? "…" : String(farmersWithCattle),
            change: "Have livestock tracked",
            up: true,
          },
          {
            label: "Active Verification Rate",
            value: isLoading ? "…" : (totalFarmers > 0 ? `${Math.round((activeFarmers / totalFarmers) * 100)}%` : "0%"),
            change: "Verified accounts",
            up: true,
          },
        ]}
        searchKeys={["name", "phone", "village", "district", "state", "registeredFarmName"]}
        searchPlaceholder="Search farmers by name, phone, village, or state..."
        data={allFarmers}
        columns={[
          {
            key: "name",
            label: "Farmer Profile",
            render: (r) => (
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                  <User className="h-4 w-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <Link
                    to="/users/$userId"
                    params={{ userId: r.uid }}
                    search={{ tab: "farmer" } as any}
                    className="font-bold text-xs text-foreground hover:text-primary transition-colors truncate block"
                  >
                    {r.name}
                  </Link>
                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                    UID: {r.uid}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "phone",
            label: "Contact",
            render: (r) => (
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1 font-medium text-foreground">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span>{r.phone}</span>
                </div>
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
                <div>{r.state !== "—" ? r.state : "India"}</div>
              </div>
            ),
          },
          {
            key: "farmStatus",
            label: "Registered Farm",
            render: (r) => (
              <div className="space-y-0.5 text-xs">
                {r.hasFarm ? (
                  <Link
                    to="/farms"
                    className="font-semibold text-primary flex items-center gap-1 hover:underline"
                  >
                    <Building className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[140px]">{r.registeredFarmName}</span>
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-[11px]">No Farm Registered</span>
                )}
              </div>
            ),
          },
          {
            key: "cattleCount",
            label: "Livestock Count",
            render: (r) => (
              <div className="space-y-0.5 text-xs">
                <span className="font-bold text-foreground">
                  {r.cattleCount > 0 ? `${r.cattleCount} Cattle` : "0 Tracked"}
                </span>
              </div>
            ),
          },
          {
            key: "joined",
            label: "Joined Date",
            render: (r) => (
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1 font-medium text-foreground">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span>{r.joined}</span>
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
                <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1 rounded-xl">
                  <Link to="/users/$userId" params={{ userId: r.uid }} search={{ tab: "farmer" } as any}>
                    <User className="h-3.5 w-3.5" /> View Profile
                  </Link>
                </Button>
              </div>
            ),
            className: "text-right",
          },
        ]}
      />
    </div>
  );
}
