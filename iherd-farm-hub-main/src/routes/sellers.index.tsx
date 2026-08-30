import { createFileRoute, Link } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useFirebaseCollection } from "../hooks/useFirebaseData";
import { getLocalizedText } from "@/lib/utils";

export const Route = createFileRoute("/sellers/")({
  head: () => ({ meta: [{ title: "Sellers — iHerd Admin" }] }),
  component: SellersPage,
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
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function SellersPage() {
  const { data: authUsers = [], isLoading: authLoading } = useAdminUsers();
  const { data: firestoreUsers = [], isLoading: fsLoading } = useFirebaseCollection<any>("users");
  const { data: directSellers = [], isLoading: sellersLoading } = useFirebaseCollection<any>("sellers");
  const isLoading = authLoading || fsLoading || sellersLoading;

  const sellerMap = new Map<string, any>();

  // 1. Process Auth users merged with Firestore profiles
  authUsers.forEach((authUser: any) => {
    const fsUser = firestoreUsers.find((fu: any) => fu.id === authUser.uid || fu.uid === authUser.uid);
    const directSeller = directSellers.find((ds: any) => ds.id === authUser.uid || ds.uid === authUser.uid);

    const roles: string[] = fsUser?.roles || (fsUser?.role ? [fsUser.role] : authUser?.roles || []);
    const isSeller =
      roles.some((r: any) => typeof r === "string" && r.toLowerCase().includes("seller")) ||
      Boolean(fsUser && (fsUser.seller || fsUser.isSeller)) ||
      Boolean(authUser && authUser.seller) ||
      Boolean(directSeller);

    if (isSeller) {
      const sellerProfile = fsUser?.seller || authUser?.seller || directSeller || {};
      const uid = authUser.uid;
      const rawTimestamp = parseTime(
        fsUser?.createdAt ||
        sellerProfile?.createdAt ||
        authUser?.createdAt ||
        directSeller?.createdAt ||
        authUser?.metadata?.creationTime
      );

      const name = sellerProfile.name || sellerProfile.shopName || fsUser?.name || fsUser?.displayName || authUser?.displayName || "Unknown Seller";

      sellerMap.set(uid, {
        id: uid,
        name: getLocalizedText(name),
        category: getLocalizedText(sellerProfile.category || "General"),
        products: sellerProfile.products || 0,
        gmv: sellerProfile.gmv || "—",
        rating: sellerProfile.rating || 0,
        joined: formatDate(rawTimestamp),
        rawTimestamp,
        status: fsUser?.status || authUser?.status || sellerProfile.status || "Active",
        verified: sellerProfile.verified || false,
      });
    }
  });

  // 2. Process standalone Firestore users
  firestoreUsers.forEach((fsUser: any) => {
    const uid = fsUser.id || fsUser.uid;
    if (!uid || sellerMap.has(uid)) return;

    const roles: string[] = fsUser.roles || (fsUser.role ? [fsUser.role] : []);
    const isSeller =
      roles.some((r: any) => typeof r === "string" && r.toLowerCase().includes("seller")) ||
      Boolean(fsUser.seller || fsUser.isSeller);

    if (isSeller) {
      const directSeller = directSellers.find((ds: any) => ds.id === uid || ds.uid === uid);
      const sellerProfile = fsUser.seller || directSeller || {};
      const rawTimestamp = parseTime(
        fsUser.createdAt ||
        sellerProfile?.createdAt ||
        directSeller?.createdAt
      );

      const name = sellerProfile.name || sellerProfile.shopName || fsUser.name || fsUser.displayName || "Unknown Seller";

      sellerMap.set(uid, {
        id: uid,
        name: getLocalizedText(name),
        category: getLocalizedText(sellerProfile.category || "General"),
        products: sellerProfile.products || 0,
        gmv: sellerProfile.gmv || "—",
        rating: sellerProfile.rating || 0,
        joined: formatDate(rawTimestamp),
        rawTimestamp,
        status: fsUser.status || sellerProfile.status || "Active",
        verified: sellerProfile.verified || false,
      });
    }
  });

  // 3. Process direct sellers collection
  directSellers.forEach((ds: any) => {
    const id = ds.id || ds.uid;
    if (!id || sellerMap.has(id)) return;

    const rawTimestamp = parseTime(ds.createdAt);

    sellerMap.set(id, {
      id: id,
      name: getLocalizedText(ds.name || ds.shopName || "Unknown Seller"),
      category: getLocalizedText(ds.category || "General"),
      products: ds.products || 0,
      gmv: ds.gmv || "—",
      rating: ds.rating || 0,
      joined: formatDate(rawTimestamp),
      rawTimestamp,
      status: ds.status || "Active",
      verified: ds.verified || false,
    });
  });

  // Sort strictly by registration / filled timestamp descending (latest first)
  const sellers = Array.from(sellerMap.values()).sort(
    (a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0)
  );

  const totalSellers = sellers.length;
  const verifiedSellers = sellers.filter((s) => s.verified).length;

  return (
    <DataPage
      title="Seller management"
      description="Manage marketplace sellers — feed, equipment, medicines and cattle."
      primaryAction="Add seller"
      isLoading={isLoading}
      filters={["Active", "Pending", "Suspended"]}
      kpis={[
        { label: "Total sellers", value: totalSellers.toLocaleString() },
        { label: "Verified", value: verifiedSellers.toLocaleString() },
        { label: "GMV (30d)", value: "₹0" },
        { label: "Avg payout", value: "₹0" },
      ]}
      data={sellers}
      rowHref={(row) => `/users/${row.id}`}
      columns={[
        {
          key: "name",
          label: "Seller",
          render: (row) => (
            <Link
              to="/users/$userId"
              params={{ userId: row.id }}
              className="font-medium text-primary hover:underline underline-offset-2"
            >
              {row.name}
            </Link>
          ),
        },
        { key: "category", label: "Category" },
        { key: "products", label: "Products" },
        { key: "gmv", label: "GMV (30d)" },
        { key: "joined", label: "Joined" },
        { key: "rating", label: "Rating" },
        { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
