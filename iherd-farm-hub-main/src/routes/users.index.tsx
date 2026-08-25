import { createFileRoute, Link } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { useFirebaseCollection } from "../hooks/useFirebaseData";
import { useAdminUsers } from "../hooks/useAdminUsers";

import { getLocalizedText } from "@/lib/utils";

export const Route = createFileRoute("/users/")({
  head: () => ({ meta: [{ title: "Users — iHerd Admin" }] }),
  component: UsersPage,
});

function UsersPage() {
  // 1. Fetch authenticated users from backend server
  const { data: authUsers = [], isLoading: authLoading } = useAdminUsers();

  // 2. Fetch users collection from Firestore to merge roles
  const { data: firestoreUsers = [], isLoading: firestoreLoading } = useFirebaseCollection<any>("users");

  const isLoading = authLoading || firestoreLoading;

  // Merge Auth data with Firestore roles & metadata
  const mergedUsers = authUsers.map((authUser: any) => {
    const fsUser = firestoreUsers.find((fu: any) => fu.id === authUser.uid || fu.uid === authUser.uid);
    const roles = fsUser?.roles || (fsUser?.role ? [fsUser.role] : authUser.roles || ["User"]);
    
    // Determine primary role for filters
    let primaryRole = "other";
    if (roles.includes("farmer") || (fsUser && (fsUser.farms || fsUser.farmer))) {
      primaryRole = "farmer";
    } else if (roles.includes("seller") || (fsUser && fsUser.seller)) {
      primaryRole = "seller";
    } else if (roles.includes("veterinarian") || roles.includes("vet") || (fsUser && (fsUser.veterinarian || fsUser.vet))) {
      primaryRole = "veterinarian";
    }

    return {
      ...authUser,
      roles,
      role: primaryRole, // role string for filters
      displayName: fsUser?.name || fsUser?.displayName || authUser.displayName || "User",
      phoneNumber: fsUser?.phoneNumber || fsUser?.phone || authUser.phoneNumber || "—",
      createdAt: fsUser?.createdAt 
        ? (fsUser.createdAt.seconds ? fsUser.createdAt.seconds * 1000 : fsUser.createdAt)
        : authUser.createdAt,
      lastLoginAt: authUser.lastLoginAt || fsUser?.updatedAt || null,
      farms: fsUser?.farms || null,
      farmer: fsUser?.farmer || null,
      seller: fsUser?.seller || null,
      veterinarian: fsUser?.veterinarian || fsUser?.vet || null,
    };
  });

  // Sort by latest last login time (lastLoginAt)
  const sortedUsers = [...mergedUsers].sort((a, b) => {
    const timeA = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
    const timeB = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
    if (timeA === 0 && timeB === 0) {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    }
    return timeB - timeA;
  });

  const totalUsers = sortedUsers.length;
  const farmerUsers = sortedUsers.filter(u => u.role === "farmer").length;
  const sellerUsers = sortedUsers.filter(u => u.role === "seller").length;
  const vetUsers = sortedUsers.filter(u => u.role === "veterinarian").length;

  return (
    <DataPage
      title="User Accounts"
      description="View app users, registration dates, phone numbers, and roles from Firebase Auth & Firestore."
      primaryAction=""
      isLoading={isLoading}
      filters={["Farmer", "Seller", "Veterinarian", "Other"]}
      statusKey="role"
      rowHref={(r) => `/users/${r.uid}`}
      kpis={[
        { label: "Total Users", value: totalUsers.toLocaleString() },
        { label: "Farmers", value: farmerUsers.toLocaleString() },
        { label: "Sellers", value: sellerUsers.toLocaleString() },
        { label: "Vets", value: vetUsers.toLocaleString() },
      ]}
      data={sortedUsers}
      columns={[
        {
          key: "uid",
          label: "User ID / UID",
          render: (r) => (
            <Link
              to="/users/$userId"
              params={{ userId: r.uid }}
              className="flex items-center gap-3 min-w-0 group hover:underline decoration-primary"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                US
              </div>
              <div className="min-w-0">
                <div className="font-mono text-xs font-medium truncate max-w-[150px] group-hover:text-primary transition-colors">{r.uid}</div>
                <div className="text-xs text-muted-foreground truncate">{r.email || "No email"}</div>
              </div>
            </Link>
          ),
        },
        {
          key: "phoneNumber",
          label: "Phone Number",
          render: (r) => <span className="font-medium">{r.phoneNumber || "—"}</span>,
        },
        {
          key: "roles",
          label: "Roles",
          render: (r) => {
            const rolesList = r.roles || (r.role ? [r.role] : []);
            return (
              <div className="flex flex-wrap gap-1">
                {rolesList.length > 0 ? (
                  rolesList.map((role: string) => (
                    <span key={role} className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                      {role}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </div>
            );
          },
        },
        {
          key: "profileDetails",
          label: "Profile Details",
          render: (r) => {
            if ((r.farms && typeof r.farms === "object" && !Array.isArray(r.farms)) || (r.farmer && typeof r.farmer === "object")) {
              const farmerInfo = r.farmer || r.farms || {};
              return (
                <div className="text-xs">
                  <span className="font-semibold text-primary">🌾 Farm: </span>
                  <span>{getLocalizedText(farmerInfo.name, "Unnamed Farm")}</span>
                  {farmerInfo.state && <span className="text-muted-foreground"> ({getLocalizedText(farmerInfo.state)})</span>}
                </div>
              );
            }
            if (r.seller && typeof r.seller === "object") {
              return (
                <div className="text-xs">
                  <span className="font-semibold text-emerald-600">🏪 Store: </span>
                  <span>{getLocalizedText(r.seller.name || r.seller.shopName, "Unnamed Store")}</span>
                  {r.seller.category && <span className="text-muted-foreground"> ({getLocalizedText(r.seller.category)})</span>}
                </div>
              );
            }
            if (r.veterinarian && typeof r.veterinarian === "object") {
              return (
                <div className="text-xs">
                  <span className="font-semibold text-sky-600">🩺 Vet: </span>
                  <span>{getLocalizedText(r.veterinarian.clinic || r.veterinarian.hospital, "Unnamed Clinic")}</span>
                  {r.veterinarian.qualification && <span className="text-muted-foreground"> ({getLocalizedText(r.veterinarian.qualification)})</span>}
                </div>
              );
            }
            return <span className="text-muted-foreground text-xs">—</span>;
          },
        },
        {
          key: "createdAt",
          label: "Created At",
          render: (r) => {
            if (!r.createdAt) return <span className="text-muted-foreground text-xs">—</span>;
            const date = new Date(r.createdAt);
            return <span className="text-xs">{date.toLocaleString()}</span>;
          },
        },
      ]}
    />
  );
}

