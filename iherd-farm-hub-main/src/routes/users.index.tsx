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
  // 1. Fetch authenticated users from backend server
  const { data: authUsers = [], isLoading: authLoading } = useAdminUsers();

  // 2. Fetch users collection from Firestore to merge live roles & profiles
  const { data: firestoreUsers = [], isLoading: firestoreLoading } = useFirebaseCollection<any>("users");

  const isLoading = authLoading && authUsers.length === 0;

  // Merge Auth users and Firestore user documents
  const mergedUsers = useMemo(() => {
    const userMap = new Map<string, any>();

    // 1. Index all Auth users
    authUsers.forEach((authUser: any) => {
      const uid = authUser.uid || authUser.id;
      if (!uid) return;
      const fsUser = firestoreUsers.find((fu: any) => isSimilarUid(fu.id, uid) || isSimilarUid(fu.uid, uid));

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
        village: farmProfile?.village || farmerProfile?.village || fsUser?.village || "—",
        district: farmProfile?.district || farmerProfile?.district || fsUser?.district || "—",
        state: farmProfile?.state || farmerProfile?.state || fsUser?.state || "—",
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

      userMap.set(uid, {
        id: uid,
        uid,
        name: fu.name || fu.fullName || fu.displayName || (fu.phoneNumber ? `User (${fu.phoneNumber})` : `User #${uid.slice(-6).toUpperCase()}`),
        displayName: fu.name || fu.fullName || fu.displayName || `User #${uid.slice(-6).toUpperCase()}`,
        phoneNumber: fu.phoneNumber || fu.phone || "—",
        email: fu.email || null,
        roles,
        role: primaryRole,
        farmer: fu.farmer || null,
        farms: fu.farms || null,
        seller: fu.seller || null,
        veterinarian: fu.veterinarian || fu.vet || null,
        village: fu.village || "—",
        district: fu.district || "—",
        state: fu.state || "—",
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
        filters={["Farmer", "Seller", "Veterinarian", "User"]}
        statusKey="role"
        searchPlaceholder="Search by name, phone, UID, email, location..."
        searchKeys={["name", "displayName", "uid", "phoneNumber", "email", "village", "district", "state"]}
        rowHref={(r) => `/users/${r.uid}`}
        kpis={[
          { label: "Total Accounts", value: totalUsers.toLocaleString(), change: "All registered users", up: true },
          { label: "Farmers", value: farmerUsers.toLocaleString(), change: "With farm & cattle data", up: true },
          { label: "Sellers", value: sellerUsers.toLocaleString(), change: "Marketplace vendors", up: true },
          { label: "Veterinarians", value: vetUsers.toLocaleString(), change: "Verified doctors", up: true },
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
              if (r.role === "Farmer") {
                const farmName = r.farms?.name || r.farmer?.farmName || "Dairy Farm";
                const location = [r.village, r.district, r.state].filter((v) => v && v !== "—").join(", ");
                return (
                  <div className="text-xs space-y-0.5">
                    <div className="font-medium text-emerald-600 flex items-center gap-1">
                      <Building className="h-3.5 w-3.5 shrink-0" />
                      <span>{farmName}</span>
                    </div>
                    {location && (
                      <div className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>{location}</span>
                      </div>
                    )}
                  </div>
                );
              }
              if (r.role === "Seller" && r.seller) {
                return (
                  <div className="text-xs space-y-0.5">
                    <div className="font-medium text-amber-600 flex items-center gap-1">
                      <Store className="h-3.5 w-3.5 shrink-0" />
                      <span>{r.seller.name || r.seller.shopName || "Marketplace Store"}</span>
                    </div>
                    {r.seller.category && (
                      <div className="text-muted-foreground">{r.seller.category}</div>
                    )}
                  </div>
                );
              }
              if (r.role === "Veterinarian" && r.veterinarian) {
                return (
                  <div className="text-xs space-y-0.5">
                    <div className="font-medium text-purple-600 flex items-center gap-1">
                      <Stethoscope className="h-3.5 w-3.5 shrink-0" />
                      <span>{r.veterinarian.clinic || r.veterinarian.hospital || "Veterinary Clinic"}</span>
                    </div>
                    {r.veterinarian.qualification && (
                      <div className="text-muted-foreground">{r.veterinarian.qualification}</div>
                    )}
                  </div>
                );
              }
              const loc = [r.village, r.state].filter((v) => v && v !== "—").join(", ");
              return loc ? (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>{loc}</span>
                </div>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
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
