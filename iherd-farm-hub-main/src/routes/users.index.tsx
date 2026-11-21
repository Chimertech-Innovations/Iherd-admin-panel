import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { useFirebaseCollection } from "../hooks/useFirebaseData";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useVerifiedDirectory } from "../hooks/useVerifiedDirectory";
import { Phone, Mail, MapPin, Building, Store, Stethoscope, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/users/")({
  head: () => ({ meta: [{ title: "User Accounts — iHerd Admin" }] }),
  component: UsersPage,
});

function isSimilarUid(a?: string, b?: string) {
  if (!a || !b) return false;
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return true;
  return s1.replace(/[1li]/g, "x") === s2.replace(/[1li]/g, "x");
}

function UsersPage() {
  // 1. Fetch authenticated users from backend server with progressive loading
  const { data: authUsers = [], isLoading: authLoading, isFetchingBalance } = useAdminUsers();

  // 2. Fetch users collection from Firestore to merge live roles & profiles
  const { data: firestoreUsers = [], isLoading: firestoreLoading } = useFirebaseCollection<any>("users");

  // 3. Single Canonical Source of Truth for verified directories
  const {
    farmers,
    sellers,
    vets,
    farmerMap,
    farmerMapByPhone,
    sellerMap,
    sellerMapByPhone,
    vetMap,
    vetMapByPhone,
    farmerCount,
    sellerCount,
    vetCount,
    isLoading: dirLoading,
  } = useVerifiedDirectory();

  // Merge Auth users and Firestore user documents with instant O(1) matching
  const mergedUsers = useMemo(() => {
    const userMap = new Map<string, any>();

    // Build O(1) lookup map of Firestore profiles by id, uid, and clean phone
    const fsMap = new Map<string, any>();
    firestoreUsers.forEach((fu: any) => {
      if (fu.id) fsMap.set(fu.id, fu);
      if (fu.uid) fsMap.set(fu.uid, fu);
      const cleanPhone = (fu.phoneNumber || fu.phone || "").replace(/\D/g, "").slice(-10);
      if (cleanPhone) fsMap.set(cleanPhone, fu);
    });

    // 1. Index all Auth users
    authUsers.forEach((authUser: any) => {
      const uid = authUser.uid || authUser.id;
      if (!uid) return;
      const cleanAuthPhone = (authUser.phoneNumber || authUser.phone || "").replace(/\D/g, "").slice(-10);
      const fsUser = fsMap.get(uid) || (cleanAuthPhone ? fsMap.get(cleanAuthPhone) : null) || {};

      // Verified roles strictly matching the canonical directory
      const isFarmer = farmerMap.has(uid) || (cleanAuthPhone ? farmerMapByPhone.has(cleanAuthPhone) : false);
      const isSeller = sellerMap.has(uid) || (cleanAuthPhone ? sellerMapByPhone.has(cleanAuthPhone) : false);
      const isVet = vetMap.has(uid) || (cleanAuthPhone ? vetMapByPhone.has(cleanAuthPhone) : false);

      const roles: string[] = [];
      if (isFarmer) roles.push("Farmer");
      if (isSeller) roles.push("Seller");
      if (isVet) roles.push("Veterinarian");
      if (roles.length === 0) roles.push("User");

      let primaryRole = "User";
      if (isFarmer) primaryRole = "Farmer";
      else if (isSeller) primaryRole = "Seller";
      else if (isVet) primaryRole = "Veterinarian";

      const verifiedFarmer = farmerMap.get(uid) || (cleanAuthPhone ? farmerMapByPhone.get(cleanAuthPhone) : null);
      const verifiedSeller = sellerMap.get(uid) || (cleanAuthPhone ? sellerMapByPhone.get(cleanAuthPhone) : null);
      const verifiedVet = vetMap.get(uid) || (cleanAuthPhone ? vetMapByPhone.get(cleanAuthPhone) : null);

      const farmerProfile = verifiedFarmer || authUser.farmer || fsUser?.farmer || null;
      const farmProfile = verifiedFarmer?.registeredFarmName ? { name: verifiedFarmer.registeredFarmName } : (authUser.farms || fsUser?.farms || null);
      const sellerProfile = verifiedSeller || authUser.seller || fsUser?.seller || null;
      const vetProfile = verifiedVet || authUser.veterinarian || fsUser?.veterinarian || fsUser?.vet || null;

      const resolvedName =
        (verifiedFarmer?.name && !verifiedFarmer.name.startsWith("Farmer"))
          ? verifiedFarmer.name
          : (verifiedSeller?.name && !verifiedSeller.name.startsWith("Store"))
          ? verifiedSeller.name
          : (verifiedVet?.name && !verifiedVet.name.startsWith("Dr. #"))
          ? verifiedVet.name
          : (authUser.displayName && authUser.displayName !== "User" && !authUser.displayName.startsWith("Farmer"))
          ? authUser.displayName
          : (authUser.name && authUser.name !== "User" && !authUser.name.startsWith("Farmer"))
          ? authUser.name
          : (fsUser?.fullName && fsUser.fullName !== "User")
          ? fsUser.fullName
          : (fsUser?.name && fsUser.name !== "User")
          ? fsUser.name
          : (fsUser?.displayName && fsUser.displayName !== "User")
          ? fsUser.displayName
          : (authUser.phoneNumber ? `User (${authUser.phoneNumber})` : `User #${uid.slice(-6).toUpperCase()}`);

      const resolvedPhone =
        (authUser.phoneNumber && authUser.phoneNumber !== "—")
          ? authUser.phoneNumber
          : (fsUser?.phoneNumber && fsUser.phoneNumber !== "—")
          ? fsUser.phoneNumber
          : (verifiedFarmer?.phone && verifiedFarmer.phone !== "—")
          ? verifiedFarmer.phone
          : (verifiedSeller?.phone && verifiedSeller.phone !== "—")
          ? verifiedSeller.phone
          : (verifiedVet?.phone && verifiedVet.phone !== "—")
          ? verifiedVet.phone
          : (fsUser?.phone && fsUser.phone !== "—")
          ? fsUser.phone
          : "—";

      const village =
        verifiedFarmer?.village ||
        farmProfile?.village ||
        farmerProfile?.village ||
        sellerProfile?.village ||
        sellerProfile?.city ||
        sellerProfile?.town ||
        vetProfile?.village ||
        vetProfile?.city ||
        vetProfile?.town ||
        fsUser?.village ||
        fsUser?.city ||
        authUser?.village ||
        authUser?.city ||
        "—";

      const district =
        verifiedFarmer?.district ||
        farmProfile?.district ||
        farmerProfile?.district ||
        sellerProfile?.district ||
        sellerProfile?.districtName ||
        sellerProfile?.city ||
        vetProfile?.district ||
        vetProfile?.districtName ||
        vetProfile?.city ||
        fsUser?.district ||
        fsUser?.districtName ||
        authUser?.district ||
        "—";

      const state =
        verifiedFarmer?.state ||
        farmProfile?.state ||
        farmerProfile?.state ||
        sellerProfile?.state ||
        sellerProfile?.stateName ||
        sellerProfile?.stateCode ||
        vetProfile?.state ||
        vetProfile?.stateName ||
        vetProfile?.stateCode ||
        fsUser?.state ||
        fsUser?.stateName ||
        fsUser?.stateCode ||
        authUser?.state ||
        authUser?.stateName ||
        "—";

      const address =
        farmProfile?.address ||
        farmerProfile?.address ||
        sellerProfile?.address ||
        sellerProfile?.fullAddress ||
        vetProfile?.address ||
        vetProfile?.clinicAddress ||
        fsUser?.address ||
        fsUser?.fullAddress ||
        authUser?.address ||
        "—";

      const locParts = [village, district, state].filter((v) => v && v !== "—");
      const location = locParts.length > 0 ? locParts.join(", ") : (address !== "—" ? address : "—");

      userMap.set(uid, {
        ...authUser,
        id: uid,
        uid,
        name: resolvedName,
        displayName: resolvedName,
        phoneNumber: resolvedPhone,
        email: authUser.email || fsUser?.email || fsUser?.emailAddress || fsUser?.mail || (authUser?.providerData && authUser.providerData[0]?.email) || null,
        roles: roles.length > 0 ? roles : [primaryRole],
        role: primaryRole,
        farmer: farmerProfile,
        farms: farmProfile,
        seller: sellerProfile,
        veterinarian: vetProfile,
        village,
        district,
        state,
        address,
        location,
        createdAt: authUser.createdAt || fsUser?.createdAt || null,
        lastLoginAt: authUser.lastLoginAt || fsUser?.updatedAt || null,
      });
    });

    // 2. Add any Firestore users that might not be in auth list
    firestoreUsers.forEach((fu: any) => {
      const uid = fu.id || fu.uid;
      if (!uid || userMap.has(uid)) return;
      const cleanPhone = (fu.phoneNumber || fu.phone || "").replace(/\D/g, "").slice(-10);

      const isFarmer = farmerMap.has(uid) || (cleanPhone ? farmerMapByPhone.has(cleanPhone) : false);
      const isSeller = sellerMap.has(uid) || (cleanPhone ? sellerMapByPhone.has(cleanPhone) : false);
      const isVet = vetMap.has(uid) || (cleanPhone ? vetMapByPhone.has(cleanPhone) : false);

      const roles: string[] = [];
      if (isFarmer) roles.push("Farmer");
      if (isSeller) roles.push("Seller");
      if (isVet) roles.push("Veterinarian");
      if (roles.length === 0) roles.push("User");

      let primaryRole = "User";
      if (isFarmer) primaryRole = "Farmer";
      else if (isSeller) primaryRole = "Seller";
      else if (isVet) primaryRole = "Veterinarian";

      const verifiedFarmer = farmerMap.get(uid) || (cleanPhone ? farmerMapByPhone.get(cleanPhone) : null);
      const verifiedSeller = sellerMap.get(uid) || (cleanPhone ? sellerMapByPhone.get(cleanPhone) : null);
      const verifiedVet = vetMap.get(uid) || (cleanPhone ? vetMapByPhone.get(cleanPhone) : null);

      const farmerProfile = verifiedFarmer || fu.farmer || null;
      const farmProfile = verifiedFarmer?.registeredFarmName ? { name: verifiedFarmer.registeredFarmName } : (fu.farms || null);
      const sellerProfile = verifiedSeller || fu.seller || null;
      const vetProfile = verifiedVet || fu.veterinarian || fu.vet || null;

      const village = verifiedFarmer?.village || fu.village || fu.city || "—";
      const district = verifiedFarmer?.district || fu.district || fu.districtName || "—";
      const state = verifiedFarmer?.state || fu.state || fu.stateName || "—";
      const address = fu.address || fu.fullAddress || "—";

      const locParts = [village, district, state].filter((v) => v && v !== "—");
      const location = locParts.length > 0 ? locParts.join(", ") : (address !== "—" ? address : "—");

      userMap.set(uid, {
        id: uid,
        uid,
        name: fu.name || fu.fullName || fu.displayName || (fu.phoneNumber ? `User (${fu.phoneNumber})` : `User #${uid.slice(-6).toUpperCase()}`),
        displayName: fu.name || fu.fullName || fu.displayName || `User #${uid.slice(-6).toUpperCase()}`,
        phoneNumber: fu.phoneNumber || fu.phone || "—",
        email: fu.email || fu.emailAddress || fu.mail || (fu.providerData && fu.providerData[0]?.email) || null,
        roles,
        role: primaryRole,
        farmer: farmerProfile,
        farms: farmProfile,
        seller: sellerProfile,
        veterinarian: vetProfile,
        village,
        district,
        state,
        address,
        location,
        createdAt: fu.createdAt ? (fu.createdAt.seconds ? fu.createdAt.seconds * 1000 : fu.createdAt) : null,
        lastLoginAt: fu.updatedAt ? (fu.updatedAt.seconds ? fu.updatedAt.seconds * 1000 : fu.updatedAt) : null,
      });
    });

    // 3. Ensure all verified farmers, sellers, and vets exist in the User Directory
    farmers.forEach((f) => {
      if (!userMap.has(f.uid)) {
        userMap.set(f.uid, {
          id: f.uid,
          uid: f.uid,
          name: f.name,
          displayName: f.displayName || f.name,
          phoneNumber: f.phone,
          email: null,
          roles: ["Farmer"],
          role: "Farmer",
          farmer: f,
          farms: f.hasFarm ? { name: f.registeredFarmName } : null,
          seller: null,
          veterinarian: null,
          village: f.village,
          district: f.district,
          state: f.state,
          address: "—",
          location: f.location,
          createdAt: f.rawTimestamp || null,
          lastLoginAt: f.rawTimestamp || null,
        });
      }
    });

    sellers.forEach((s) => {
      if (!userMap.has(s.uid)) {
        userMap.set(s.uid, {
          id: s.uid,
          uid: s.uid,
          name: s.name,
          displayName: s.shopName || s.name,
          phoneNumber: s.phone,
          email: s.email,
          roles: ["Seller"],
          role: "Seller",
          farmer: null,
          farms: null,
          seller: s,
          veterinarian: null,
          village: "—",
          district: s.city,
          state: s.state,
          address: "—",
          location: s.location,
          createdAt: s.rawTimestamp || null,
          lastLoginAt: s.rawTimestamp || null,
        });
      }
    });

    vets.forEach((v) => {
      if (!userMap.has(v.uid)) {
        userMap.set(v.uid, {
          id: v.uid,
          uid: v.uid,
          name: v.name,
          displayName: v.doctorName || v.name,
          phoneNumber: v.phone,
          email: v.email,
          roles: ["Veterinarian"],
          role: "Veterinarian",
          farmer: null,
          farms: null,
          seller: null,
          veterinarian: v,
          village: "—",
          district: v.city,
          state: v.state,
          address: "—",
          location: v.location,
          createdAt: v.rawTimestamp || null,
          lastLoginAt: v.rawTimestamp || null,
        });
      }
    });

    // Sort by registration/created time descending (latest registered first)
    return Array.from(userMap.values()).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [authUsers, firestoreUsers, farmers, sellers, vets, farmerMap, farmerMapByPhone, sellerMap, sellerMapByPhone, vetMap, vetMapByPhone]);

  const isLoading = (authLoading || firestoreLoading || dirLoading) && mergedUsers.length === 0;

  const totalUsers = mergedUsers.length;

  return (
    <div className="space-y-6">
      <DataPage
        title="User Accounts Directory"
        description="All registered Firebase Authentication users, verified farmer roles, store profiles, and contact details."
        isLoading={isLoading}
        isFetchingBalance={isFetchingBalance}
        filters={["Farmer", "Seller", "Veterinarian", "User"]}
        statusKey="role"
        searchPlaceholder="Search by name, phone, UID, email, location..."
        searchKeys={["name", "displayName", "uid", "phoneNumber", "email", "village", "district", "state", "location", "address"]}
        rowHref={(r) => `/users/${r.uid}`}
        exportFilename="iherd_user_accounts"
        customExportColumns={[
          { header: "User Name", accessor: (r) => r.name || r.displayName || "User" },
          { header: "User UID", accessor: (r) => r.uid || r.id },
          { header: "Phone Number", accessor: (r) => r.phoneNumber || "—" },
          { header: "Email Address", accessor: (r) => r.email || "—" },
          { header: "Primary Role", accessor: (r) => r.role || "User" },
          { header: "All Roles", accessor: (r) => Array.isArray(r.roles) ? r.roles.join(", ") : r.role || "User" },
          { header: "Connected Farm Name", accessor: (r) => r.farms?.name || r.farmer?.farmName || "—" },
          { header: "Connected Store Name", accessor: (r) => r.seller?.name || r.seller?.shopName || "—" },
          { header: "Connected Clinic / Vet", accessor: (r) => r.veterinarian?.clinic || r.veterinarian?.hospital || "—" },
          { header: "Village / City", accessor: (r) => r.village || "—" },
          { header: "District", accessor: (r) => r.district || "—" },
          { header: "State", accessor: (r) => r.state || "—" },
          { header: "Full Location", accessor: (r) => r.location || "—" },
          { header: "Registration Date", accessor: (r) => r.createdAt ? new Date(r.createdAt).toLocaleString() : "—" },
          { header: "Last Activity / Login", accessor: (r) => r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString() : "—" },
        ]}
        kpis={[
          { label: "Total Accounts", value: isLoading ? "…" : totalUsers.toLocaleString(), change: "All registered users", up: true },
          { label: "Farmers", value: isLoading ? "…" : farmerCount.toLocaleString(), change: "Verified farmers", up: true },
          { label: "Sellers", value: isLoading ? "…" : sellerCount.toLocaleString(), change: "Registered vendors", up: true },
          { label: "Veterinarians", value: isLoading ? "…" : vetCount.toLocaleString(), change: "Verified doctors", up: true },
        ]}
        data={mergedUsers}
        columns={[
          {
            key: "displayName",
            label: "User / Account",
            render: (r) => (
              <Link
                to="/users/$userId"
                params={{ userId: r.uid }}
                className="flex items-center gap-3 min-w-0 group"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-primary-glow/10 border border-primary/20 text-primary font-bold text-xs shadow-sm group-hover:scale-105 transition-transform">
                  {(r.name || r.displayName || "U").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                    {r.name || r.displayName || "iHerd User"}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground truncate max-w-[180px]">
                    UID: {r.uid}
                  </div>
                </div>
              </Link>
            ),
          },
          {
            key: "phoneNumber",
            label: "Phone / Contact",
            render: (r) => (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{r.phoneNumber || "—"}</span>
                </div>
                {r.email && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-[170px]">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{r.email}</span>
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "role",
            label: "Role / Badge",
            render: (r) => {
              const role = r.role || "User";
              let badgeColor = "bg-blue-500/10 text-blue-600 border-blue-500/20";
              if (role === "Farmer") badgeColor = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
              if (role === "Seller") badgeColor = "bg-amber-500/10 text-amber-600 border-amber-500/20";
              if (role === "Veterinarian") badgeColor = "bg-purple-500/10 text-purple-600 border-purple-500/20";

              return (
                <div className="flex flex-wrap items-center gap-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}>
                    {role}
                  </span>
                </div>
              );
            },
          },
          {
            key: "profileDetails",
            label: "Connected Details & Location",
            render: (r) => {
              const locStr = r.location && r.location !== "—"
                ? r.location
                : [r.village, r.district, r.state].filter((v) => v && v !== "—").join(", ");

              return (
                <div className="text-xs space-y-1">
                  {r.role === "Farmer" && (
                    <div className="font-medium text-emerald-600 flex items-center gap-1">
                      <Building className="h-3.5 w-3.5 shrink-0" />
                      <span>{r.farms?.name || r.farmer?.farmName || "Dairy Farm"}</span>
                    </div>
                  )}
                  {r.role === "Seller" && (
                    <div className="font-medium text-amber-600 flex items-center gap-1">
                      <Store className="h-3.5 w-3.5 shrink-0" />
                      <span>{r.seller?.name || r.seller?.shopName || "Marketplace Store"}</span>
                    </div>
                  )}
                  {r.role === "Veterinarian" && (
                    <div className="font-medium text-purple-600 flex items-center gap-1">
                      <Stethoscope className="h-3.5 w-3.5 shrink-0" />
                      <span>{r.veterinarian?.clinic || r.veterinarian?.hospital || "Veterinary Clinic"}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{locStr && locStr !== "—" ? locStr : "Location Not Mentioned"}</span>
                  </div>
                </div>
              );
            },
          },
          {
            key: "createdAt",
            label: "Registration Date",
            render: (r) => {
              if (!r.createdAt) return <span className="text-muted-foreground text-xs">—</span>;
              const date = new Date(r.createdAt);
              return (
                <div className="text-xs space-y-0.5">
                  <div className="font-medium text-foreground">{date.toLocaleDateString()}</div>
                  <div className="text-muted-foreground">{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              );
            },
          },
          {
            key: "actions",
            label: "Actions",
            className: "text-right",
            render: (r) => (
              <Link
                to="/users/$userId"
                params={{ userId: r.uid }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <span>View Full Profile</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
