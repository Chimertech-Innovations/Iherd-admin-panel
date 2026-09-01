import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { useFirebaseCollection } from "../hooks/useFirebaseData";
import { useAdminUsers } from "../hooks/useAdminUsers";
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

      // Accurate role resolution from backend and Firestore
      const rawRoles = authUser.roles || fsUser?.roles || (fsUser?.role ? [fsUser.role] : ["User"]);
      const roles = Array.isArray(rawRoles) ? rawRoles : [String(rawRoles)];

      let primaryRole = "User";
      if (roles.includes("Farmer") || authUser.isFarmer) {
        primaryRole = "Farmer";
      } else if (roles.includes("Seller") || authUser.seller) {
        primaryRole = "Seller";
      } else if (roles.includes("Veterinarian") || authUser.veterinarian) {
        primaryRole = "Veterinarian";
      }

      const farmerProfile = authUser.farmer || fsUser?.farmer || null;
      const farmProfile = authUser.farms || fsUser?.farms || null;
      const sellerProfile = authUser.seller || fsUser?.seller || null;
      const vetProfile = authUser.veterinarian || fsUser?.veterinarian || fsUser?.vet || null;

      const resolvedName =
        (authUser.displayName && authUser.displayName !== "User" && authUser.displayName !== "Farmer")
          ? authUser.displayName
          : (authUser.name && authUser.name !== "User")
          ? authUser.name
          : (fsUser?.fullName && fsUser.fullName !== "User")
          ? fsUser.fullName
          : (fsUser?.name && fsUser.name !== "User")
          ? fsUser.name
          : (fsUser?.displayName && fsUser.displayName !== "User")
          ? fsUser.displayName
          : (farmerProfile?.name && farmerProfile.name !== "User")
          ? farmerProfile.name
          : (authUser.phoneNumber ? `User (${authUser.phoneNumber})` : `User #${uid.slice(-6).toUpperCase()}`);

      const resolvedPhone =
        (authUser.phoneNumber && authUser.phoneNumber !== "—")
          ? authUser.phoneNumber
          : (fsUser?.phoneNumber && fsUser.phoneNumber !== "—")
          ? fsUser.phoneNumber
          : (fsUser?.phone && fsUser.phone !== "—")
          ? fsUser.phone
          : (farmerProfile?.farmerPhoneNumber && farmerProfile.farmerPhoneNumber !== "—")
          ? farmerProfile.farmerPhoneNumber
          : "—";

      const village =
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
        email: authUser.email || fsUser?.email || null,
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

      const rawRoles = fu.roles || (fu.role ? [fu.role] : ["User"]);
      const roles = Array.isArray(rawRoles) ? rawRoles : [String(rawRoles)];
      let primaryRole = "User";
      if (roles.some((r: any) => String(r).toLowerCase().includes("farmer")) || fu.farms || fu.farmer) {
        primaryRole = "Farmer";
      } else if (roles.some((r: any) => String(r).toLowerCase().includes("seller")) || fu.seller) {
        primaryRole = "Seller";
      } else if (roles.some((r: any) => String(r).toLowerCase().includes("vet")) || fu.veterinarian || fu.vet) {
        primaryRole = "Veterinarian";
      }

      const farmerProfile = fu.farmer || null;
      const farmProfile = fu.farms || null;
      const sellerProfile = fu.seller || null;
      const vetProfile = fu.veterinarian || fu.vet || null;

      const village =
        farmProfile?.village ||
        farmerProfile?.village ||
        sellerProfile?.village ||
        sellerProfile?.city ||
        sellerProfile?.town ||
        vetProfile?.village ||
        vetProfile?.city ||
        vetProfile?.town ||
        fu.village ||
        fu.city ||
        "—";

      const district =
        farmProfile?.district ||
        farmerProfile?.district ||
        sellerProfile?.district ||
        sellerProfile?.districtName ||
        sellerProfile?.city ||
        vetProfile?.district ||
        vetProfile?.districtName ||
        vetProfile?.city ||
        fu.district ||
        fu.districtName ||
        "—";

      const state =
        farmProfile?.state ||
        farmerProfile?.state ||
        sellerProfile?.state ||
        sellerProfile?.stateName ||
        sellerProfile?.stateCode ||
        vetProfile?.state ||
        vetProfile?.stateName ||
        vetProfile?.stateCode ||
        fu.state ||
        fu.stateName ||
        fu.stateCode ||
        "—";

      const address =
        farmProfile?.address ||
        farmerProfile?.address ||
        sellerProfile?.address ||
        sellerProfile?.fullAddress ||
        vetProfile?.address ||
        vetProfile?.clinicAddress ||
        fu.address ||
        fu.fullAddress ||
        "—";

      const locParts = [village, district, state].filter((v) => v && v !== "—");
      const location = locParts.length > 0 ? locParts.join(", ") : (address !== "—" ? address : "—");

      userMap.set(uid, {
        id: uid,
        uid,
        name: fu.name || fu.fullName || fu.displayName || (fu.phoneNumber ? `User (${fu.phoneNumber})` : `User #${uid.slice(-6).toUpperCase()}`),
        displayName: fu.name || fu.fullName || fu.displayName || `User #${uid.slice(-6).toUpperCase()}`,
        phoneNumber: fu.phoneNumber || fu.phone || "—",
        email: fu.email || null,
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

    // Sort by registration/created time descending (latest registered first)
    return Array.from(userMap.values()).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [authUsers, firestoreUsers]);

  const isLoading = (authLoading || firestoreLoading) && mergedUsers.length === 0;

  const totalUsers = mergedUsers.length;
  const farmerUsers = mergedUsers.filter((u) => u.role === "Farmer" || (Array.isArray(u.roles) && u.roles.includes("Farmer"))).length;
  const sellerUsers = mergedUsers.filter((u) => u.role === "Seller" || (Array.isArray(u.roles) && u.roles.includes("Seller"))).length;
  const vetUsers = mergedUsers.filter((u) => u.role === "Veterinarian" || (Array.isArray(u.roles) && u.roles.includes("Veterinarian"))).length;

  return (
    <div className="space-y-6">
      <DataPage
        title="User Accounts Directory"
        description="All registered Firebase Authentication users, verified farmer roles, store profiles, and contact details."
        primaryAction="Add User"
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
          { label: "Farmers", value: isLoading ? "…" : farmerUsers.toLocaleString(), change: "With farm & cattle data", up: true },
          { label: "Sellers", value: isLoading ? "…" : sellerUsers.toLocaleString(), change: "Marketplace vendors", up: true },
          { label: "Veterinarians", value: isLoading ? "…" : vetUsers.toLocaleString(), change: "Verified doctors", up: true },
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
