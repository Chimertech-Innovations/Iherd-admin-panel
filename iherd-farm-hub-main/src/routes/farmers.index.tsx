import { createFileRoute, Link } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useFirebaseCollection } from "../hooks/useFirebaseData";
import { getLocalizedText } from "@/lib/utils";

export const Route = createFileRoute("/farmers/")({
  head: () => ({ meta: [{ title: "Farmers — iHerd Admin" }] }),
  component: FarmersPage,
});

function FarmersPage() {
  const { data: authUsers = [], isLoading: authLoading } = useAdminUsers();
  const { data: firestoreUsers = [], isLoading: firestoreLoading } = useFirebaseCollection<any>("users");
  const { data: directFarmers = [], isLoading: directLoading } = useFirebaseCollection<any>("farmers");

  const isLoading = authLoading || firestoreLoading || directLoading;

  // Build full farmer list by merging Auth users and Firestore users
  const farmerMap = new Map<string, any>();

  // 1. Process Auth users merged with Firestore profiles
  authUsers.forEach((authUser: any) => {
    const fsUser = firestoreUsers.find((fu: any) => fu.id === authUser.uid || fu.uid === authUser.uid);
    const directFarmer = directFarmers.find((df: any) => df.id === authUser.uid || df.uid === authUser.uid);
    
    const roles: string[] = fsUser?.roles || (fsUser?.role ? [fsUser.role] : authUser?.roles || []);
    const isFarmer =
      roles.some((r: any) => typeof r === "string" && r.toLowerCase().includes("farmer")) ||
      Boolean(fsUser && (fsUser.farms || fsUser.farmer || fsUser.isFarmer)) ||
      Boolean(authUser && (authUser.farms || authUser.farmer)) ||
      Boolean(directFarmer);

    if (isFarmer) {
      const farmerProfile = fsUser?.farmer || authUser?.farmer || directFarmer || {};
      const farmDetails = (fsUser?.farms && !Array.isArray(fsUser.farms))
        ? fsUser.farms
        : (authUser?.farms && !Array.isArray(authUser.farms))
        ? authUser.farms
        : (directFarmer?.farms && !Array.isArray(directFarmer.farms))
        ? directFarmer.farms
        : {};

      const rawJoined = fsUser?.createdAt || authUser?.createdAt || directFarmer?.createdAt;
      let joined = "—";
      if (rawJoined) {
        const ms = rawJoined.seconds ? rawJoined.seconds * 1000 : new Date(rawJoined).getTime();
        if (!isNaN(ms)) {
          joined = new Date(ms).toLocaleDateString();
        }
      }

      const farmName = farmDetails.name || farmerProfile.farmName || farmerProfile.farm || farmerProfile.village || farmerProfile.address || fsUser?.village || "—";
      const stateName = farmerProfile.state || farmDetails.state || fsUser?.state || "—";
      const name = farmerProfile.name || farmDetails.name || fsUser?.name || fsUser?.displayName || authUser?.displayName || "Unknown Farmer";
      const cattle = farmDetails.cattle || farmerProfile.cattle || fsUser?.cattle || directFarmer?.cattle || 0;
      const status = farmerProfile.status || farmDetails.status || fsUser?.status || authUser?.status || "Active";

      const uid = authUser.uid;
      farmerMap.set(uid, {
        id: uid,
        name: getLocalizedText(name),
        farm: getLocalizedText(farmName),
        state: getLocalizedText(stateName),
        cattle: typeof cattle === "number" ? cattle : parseInt(cattle) || 0,
        joined,
        status,
        phoneNumber: fsUser?.phoneNumber || fsUser?.phone || authUser?.phoneNumber || directFarmer?.phone || "—",
      });
    }
  });

  // 2. Include any standalone Firestore user documents not present in authUsers
  firestoreUsers.forEach((fsUser: any) => {
    const uid = fsUser.id || fsUser.uid;
    if (!uid || farmerMap.has(uid)) return;

    const roles: string[] = fsUser.roles || (fsUser.role ? [fsUser.role] : []);
    const isFarmer =
      roles.some((r: any) => typeof r === "string" && r.toLowerCase().includes("farmer")) ||
      Boolean(fsUser.farms || fsUser.farmer || fsUser.isFarmer);

    if (isFarmer) {
      const directFarmer = directFarmers.find((df: any) => df.id === uid || df.uid === uid);
      const farmerProfile = fsUser.farmer || directFarmer || {};
      const farmDetails = (fsUser.farms && !Array.isArray(fsUser.farms))
        ? fsUser.farms
        : (directFarmer?.farms && !Array.isArray(directFarmer.farms))
        ? directFarmer.farms
        : {};

      const rawJoined = fsUser.createdAt || directFarmer?.createdAt;
      let joined = "—";
      if (rawJoined) {
        const ms = rawJoined.seconds ? rawJoined.seconds * 1000 : new Date(rawJoined).getTime();
        if (!isNaN(ms)) {
          joined = new Date(ms).toLocaleDateString();
        }
      }

      const farmName = farmDetails.name || farmerProfile.farmName || farmerProfile.farm || farmerProfile.village || farmerProfile.address || fsUser.village || "—";
      const stateName = farmerProfile.state || farmDetails.state || fsUser.state || "—";
      const name = farmerProfile.name || farmDetails.name || fsUser.name || fsUser.displayName || "Unknown Farmer";
      const cattle = farmDetails.cattle || farmerProfile.cattle || fsUser.cattle || directFarmer?.cattle || 0;
      const status = farmerProfile.status || farmDetails.status || fsUser.status || "Active";

      farmerMap.set(uid, {
        id: uid,
        name: getLocalizedText(name),
        farm: getLocalizedText(farmName),
        state: getLocalizedText(stateName),
        cattle: typeof cattle === "number" ? cattle : parseInt(cattle) || 0,
        joined,
        status,
        phoneNumber: fsUser.phoneNumber || fsUser.phone || directFarmer?.phone || "—",
      });
    }
  });

  // 3. Include any standalone direct farmers collection documents
  directFarmers.forEach((df: any) => {
    const id = df.id || df.uid;
    if (!id || farmerMap.has(id)) return;

    const farmDetails = (df.farms && !Array.isArray(df.farms)) ? df.farms : {};
    const rawJoined = df.createdAt;
    let joined = "—";
    if (rawJoined) {
      const ms = rawJoined.seconds ? rawJoined.seconds * 1000 : new Date(rawJoined).getTime();
      if (!isNaN(ms)) {
        joined = new Date(ms).toLocaleDateString();
      }
    }

    farmerMap.set(id, {
      id: id,
      name: getLocalizedText(df.name || farmDetails.name || "Unknown Farmer"),
      farm: getLocalizedText(farmDetails.name || df.farm || df.village || df.address || "—"),
      state: getLocalizedText(df.state || farmDetails.state || "—"),
      cattle: typeof df.cattle === "number" ? df.cattle : parseInt(df.cattle) || 0,
      joined,
      status: df.status || "Active",
      phoneNumber: df.phone || df.phoneNumber || "—",
    });
  });

  const farmers = Array.from(farmerMap.values());
  const totalFarmers = farmers.length;
  const activeFarmers = farmers.filter((f) => f.status === "Active" || !f.status).length;
  const pendingFarmers = farmers.filter((f) => f.status === "Pending" || f.status === "In Review").length;
  const suspendedFarmers = farmers.filter((f) => f.status === "Suspended" || f.status === "Rejected").length;

  return (
    <DataPage
      title="Farmer management"
      description="Onboard, verify and manage farmers on iHerd."
      primaryAction="Add farmer"
      isLoading={isLoading}
      filters={["Active", "Pending", "Suspended"]}
      rowHref={(r) => `/users/${r.id}`}
      kpis={[
        { label: "Total farmers", value: totalFarmers.toLocaleString(), hint: pendingFarmers > 0 ? `+${pendingFarmers} pending KYC` : undefined },
        { label: "Active", value: activeFarmers.toLocaleString() },
        { label: "Pending KYC", value: pendingFarmers.toLocaleString() },
        { label: "Suspended", value: suspendedFarmers.toLocaleString() },
      ]}
      data={farmers}
      columns={[
        {
          key: "name",
          label: "Farmer",
          render: (r) => (
            <Link
              to="/users/$userId"
              params={{ userId: r.id }}
              className="flex items-center gap-3 min-w-0 group"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {(r.name || "FM").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate group-hover:text-primary transition-colors">{r.name}</div>
                <div className="text-xs text-muted-foreground truncate">{r.id}</div>
              </div>
            </Link>
          ),
        },
        { key: "farm", label: "Farm" },
        { key: "state", label: "State" },
        { key: "cattle", label: "Cattle", render: (r) => <span className="font-medium">{r.cattle}</span> },
        { key: "joined", label: "Joined" },
        { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
