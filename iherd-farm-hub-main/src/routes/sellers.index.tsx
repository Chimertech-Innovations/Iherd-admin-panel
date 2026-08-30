import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useFirebaseCollection } from "../hooks/useFirebaseData";
import { getLocalizedText } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, Plus, Phone, Mail, MapPin, CheckCircle2 } from "lucide-react";
import { doc, setDoc, collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

export const Route = createFileRoute("/sellers/")({
  head: () => ({ meta: [{ title: "Sellers Management — iHerd Admin" }] }),
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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AddSellerDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("Feed & Nutrition");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim() && !ownerName.trim()) {
      toast.error("Please enter a shop name or owner name.");
      return;
    }

    setLoading(true);
    try {
      const sellerData = {
        name: ownerName.trim() || shopName.trim(),
        shopName: shopName.trim() || ownerName.trim(),
        storeName: shopName.trim() || ownerName.trim(),
        phone: phone.trim() || "—",
        phoneNumber: phone.trim() || "—",
        email: email.trim() || "",
        category,
        state: state.trim() || "",
        city: city.trim() || "",
        products: 0,
        gmv: "—",
        rating: 5.0,
        status: "Active",
        verified: true,
        isSeller: true,
        roles: ["seller"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save directly into Firestore 'sellers' collection
      await addDoc(collection(db, "sellers"), sellerData);

      toast.success(`Seller "${sellerData.shopName}" registered successfully!`);
      setOpen(false);
      setShopName("");
      setOwnerName("");
      setPhone("");
      setEmail("");
      setState("");
      setCity("");
      if (onCreated) onCreated();
    } catch (err: any) {
      console.error("Error creating seller:", err);
      toast.error(err.message || "Failed to create seller");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm">
          <Plus className="h-4 w-4" /> Add Seller
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Store className="h-4.5 w-4.5" />
            </span>
            Add New Marketplace Seller
          </DialogTitle>
          <DialogDescription>
            Register a vendor store for feeds, equipment, medicines, or cattle trading.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          <div className="space-y-1">
            <Label htmlFor="shopName" className="text-xs font-semibold">Store / Shop Name *</Label>
            <Input
              id="shopName"
              placeholder="e.g. Kisan Agro Feeds & Supplies"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ownerName" className="text-xs font-semibold">Owner / Contact Person</Label>
            <Input
              id="ownerName"
              placeholder="e.g. Ramesh Kumar"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs font-semibold">Phone Number</Label>
              <Input
                id="phone"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category" className="text-xs font-semibold">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl text-xs">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Feed & Nutrition">Feed & Nutrition</SelectItem>
                  <SelectItem value="Veterinary Medicines">Veterinary Medicines</SelectItem>
                  <SelectItem value="Farm Equipment">Farm Equipment</SelectItem>
                  <SelectItem value="Dairy Machinery">Dairy Machinery</SelectItem>
                  <SelectItem value="Cattle Trader">Cattle Trader</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="city" className="text-xs font-semibold">City / District</Label>
              <Input
                id="city"
                placeholder="e.g. Anand"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="state" className="text-xs font-semibold">State</Label>
              <Input
                id="state"
                placeholder="e.g. Gujarat"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading ? "Saving..." : "Register Seller"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SellersPage() {
  const { data: authUsers = [], isLoading: authLoading, refetch: refetchAuth } = useAdminUsers();
  const { data: firestoreUsers = [], isLoading: fsLoading, refetch: refetchFs } = useFirebaseCollection<any>("users");
  const { data: directSellers = [], isLoading: sellersLoading, refetch: refetchSellers } = useFirebaseCollection<any>("sellers");
  const isLoading = authLoading || fsLoading || sellersLoading;

  const handleRefresh = () => {
    refetchAuth();
    refetchFs();
    refetchSellers();
  };

  const sellerMap = new Map<string, any>();

  // 1. Process direct sellers collection
  directSellers.forEach((ds: any) => {
    const id = ds.id || ds.uid;
    if (!id) return;

    const rawTimestamp = parseTime(ds.createdAt || ds.timestamp || ds.updatedAt);
    const phone = ds.phone || ds.phoneNumber || ds.sellerPhone || "—";
    const shopName = ds.shopName || ds.storeName || ds.name || ds.sellerName || "Marketplace Store";

    sellerMap.set(id, {
      id,
      uid: id,
      name: getLocalizedText(shopName),
      ownerName: getLocalizedText(ds.name || ds.ownerName || "Seller"),
      phone,
      category: getLocalizedText(ds.category || ds.shopCategory || "Feed & Supplies"),
      products: Number(ds.products || ds.productCount || 0),
      gmv: ds.gmv || "—",
      rating: Number(ds.rating || 5.0),
      joined: formatDate(rawTimestamp),
      rawTimestamp,
      status: ds.status || "Active",
      verified: Boolean(ds.verified || ds.isVerified),
      city: ds.city || ds.district || "—",
      state: ds.state || "—",
    });
  });

  // 2. Process Auth users merged with Firestore profiles
  authUsers.forEach((authUser: any) => {
    const uid = authUser.uid;
    const fsUser = firestoreUsers.find((fu: any) => fu.id === uid || fu.uid === uid);
    const directSeller = directSellers.find((ds: any) => ds.id === uid || ds.uid === uid);

    const fsRoles = fsUser?.roles || (fsUser?.role ? [fsUser.role] : []);
    const roles: string[] = Array.isArray(fsRoles) ? fsRoles : [String(fsRoles)];
    const hasSellerRole = roles.some((r: any) => typeof r === "string" && r.toLowerCase().includes("seller"));
    const hasDirectSellerDoc = Boolean(directSeller);
    const hasSellerProfile = Boolean(
      (fsUser?.seller && typeof fsUser.seller === "object" && (fsUser.seller.name || fsUser.seller.shopName || fsUser.seller.storeName || fsUser.seller.phone || fsUser.seller.category)) ||
      (authUser?.seller && typeof authUser.seller === "object" && (authUser.seller.name || authUser.seller.shopName || authUser.seller.storeName || authUser.seller.category)) ||
      fsUser?.isSeller === true ||
      authUser?.isSeller === true
    );

    const isSeller = hasSellerRole || hasDirectSellerDoc || hasSellerProfile;

    if (isSeller) {
      const sellerProfile = fsUser?.seller || authUser?.seller || directSeller || {};
      const rawTimestamp = parseTime(
        sellerProfile?.createdAt ||
        fsUser?.createdAt ||
        authUser?.createdAt ||
        directSeller?.createdAt ||
        authUser?.metadata?.creationTime
      );

      const phone =
        (sellerProfile.phone && sellerProfile.phone !== "—") ? sellerProfile.phone :
        (sellerProfile.sellerPhone && sellerProfile.sellerPhone !== "—") ? sellerProfile.sellerPhone :
        (authUser?.phoneNumber && authUser.phoneNumber !== "—") ? authUser.phoneNumber :
        (fsUser?.phoneNumber && fsUser.phoneNumber !== "—") ? fsUser.phoneNumber :
        "—";

      const shopName =
        sellerProfile.shopName ||
        sellerProfile.storeName ||
        sellerProfile.name ||
        sellerProfile.sellerName ||
        (fsUser?.fullName && fsUser.fullName !== "User" && !fsUser.fullName.startsWith("Farmer") ? fsUser.fullName : null) ||
        (fsUser?.name && fsUser.name !== "User" && !fsUser.name.startsWith("Farmer") ? fsUser.name : null) ||
        (phone !== "—" ? `Store (${phone})` : `Seller #${uid.slice(-6).toUpperCase()}`);

      const ownerName =
        (fsUser?.fullName && fsUser.fullName !== "User" && !fsUser.fullName.startsWith("Farmer")) ? fsUser.fullName :
        (fsUser?.name && fsUser.name !== "User" && !fsUser.name.startsWith("Farmer")) ? fsUser.name :
        (sellerProfile.name && sellerProfile.name !== "User") ? sellerProfile.name :
        "Seller";

      sellerMap.set(uid, {
        id: uid,
        uid,
        name: getLocalizedText(shopName),
        ownerName: getLocalizedText(ownerName),
        phone,
        category: getLocalizedText(sellerProfile.category || "Feed & Supplies"),
        products: Number(sellerProfile.products || sellerProfile.productCount || 0),
        gmv: sellerProfile.gmv || "—",
        rating: Number(sellerProfile.rating || 5.0),
        joined: formatDate(rawTimestamp),
        rawTimestamp,
        status: fsUser?.status || authUser?.status || sellerProfile.status || "Active",
        verified: Boolean(sellerProfile.verified || fsUser?.verified),
        city: sellerProfile.city || fsUser?.district || "—",
        state: sellerProfile.state || fsUser?.state || "—",
      });
    }
  });

  // 3. Process standalone Firestore users
  firestoreUsers.forEach((fsUser: any) => {
    const uid = fsUser.id || fsUser.uid;
    if (!uid || sellerMap.has(uid)) return;

    const fsRoles = fsUser.roles || (fsUser.role ? [fsUser.role] : []);
    const roles: string[] = Array.isArray(fsRoles) ? fsRoles : [String(fsRoles)];
    const hasSellerRole = roles.some((r: any) => typeof r === "string" && r.toLowerCase().includes("seller"));
    const hasSellerProfile = Boolean(
      (fsUser.seller && typeof fsUser.seller === "object" && (fsUser.seller.name || fsUser.seller.shopName || fsUser.seller.storeName || fsUser.seller.phone || fsUser.seller.category)) ||
      fsUser.isSeller === true
    );

    if (hasSellerRole || hasSellerProfile) {
      const sellerProfile = fsUser.seller || {};
      const rawTimestamp = parseTime(
        sellerProfile?.createdAt ||
        fsUser.createdAt
      );

      const phone =
        (sellerProfile.phone && sellerProfile.phone !== "—") ? sellerProfile.phone :
        (fsUser.phoneNumber && fsUser.phoneNumber !== "—") ? fsUser.phoneNumber :
        "—";

      const shopName =
        sellerProfile.shopName ||
        sellerProfile.storeName ||
        sellerProfile.name ||
        (fsUser.fullName && fsUser.fullName !== "User" && !fsUser.fullName.startsWith("Farmer") ? fsUser.fullName : null) ||
        (fsUser.name && fsUser.name !== "User" && !fsUser.name.startsWith("Farmer") ? fsUser.name : null) ||
        (phone !== "—" ? `Store (${phone})` : `Seller #${uid.slice(-6).toUpperCase()}`);

      sellerMap.set(uid, {
        id: uid,
        uid,
        name: getLocalizedText(shopName),
        ownerName: getLocalizedText(fsUser.fullName || fsUser.name || "Seller"),
        phone,
        category: getLocalizedText(sellerProfile.category || "Feed & Supplies"),
        products: Number(sellerProfile.products || 0),
        gmv: sellerProfile.gmv || "—",
        rating: Number(sellerProfile.rating || 5.0),
        joined: formatDate(rawTimestamp),
        rawTimestamp,
        status: fsUser.status || sellerProfile.status || "Active",
        verified: Boolean(sellerProfile.verified || fsUser.verified),
        city: fsUser.district || "—",
        state: fsUser.state || "—",
      });
    }
  });

  // Sort strictly by registration timestamp descending (latest registered first)
  const sellers = Array.from(sellerMap.values()).sort(
    (a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0)
  );

  const totalSellers = sellers.length;
  const verifiedSellers = sellers.filter((s) => s.verified || s.status === "Active").length;

  return (
    <div className="space-y-6">
      <DataPage
        title="Seller Management"
        description="All registered marketplace sellers — feed, equipment, medicines, and cattle trading."
        primaryAction={<AddSellerDialog onCreated={handleRefresh} />}
        isLoading={isLoading}
        filters={["Active", "Pending", "Suspended"]}
        searchPlaceholder="Search sellers by store name, owner, phone, or category..."
        searchKeys={["name", "ownerName", "phone", "category", "city", "state"]}
        kpis={[
          { label: "Total Sellers", value: totalSellers.toLocaleString(), change: "Registered vendors", up: true },
          { label: "Verified & Active", value: verifiedSellers.toLocaleString(), change: "Active in marketplace", up: true },
          { label: "GMV (30d)", value: "₹0", change: "Marketplace revenue", up: true },
          { label: "Avg Payout", value: "₹0", change: "Vendor payouts", up: true },
        ]}
        data={sellers}
        rowHref={(row) => `/users/${row.id}`}
        columns={[
          {
            key: "name",
            label: "Store / Seller",
            render: (row) => (
              <Link
                to="/users/$userId"
                params={{ userId: row.id }}
                className="flex items-center gap-3 min-w-0 group"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600 font-bold text-xs border border-amber-500/20 group-hover:scale-105 transition-transform">
                  <Store className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                    {row.name}
                  </div>
                  {row.ownerName && row.ownerName !== row.name && (
                    <div className="text-xs text-muted-foreground truncate">
                      Owner: {row.ownerName}
                    </div>
                  )}
                </div>
              </Link>
            ),
          },
          {
            key: "phone",
            label: "Contact Phone",
            render: (row) => (
              <div className="flex items-center gap-1 text-xs font-medium">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{row.phone || "—"}</span>
              </div>
            ),
          },
          {
            key: "category",
            label: "Category",
            render: (row) => (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                {row.category}
              </span>
            ),
          },
          {
            key: "products",
            label: "Products",
            render: (row) => <span className="font-medium text-xs">{row.products} items</span>,
          },
          {
            key: "joined",
            label: "Joined Date",
            render: (row) => <span className="text-xs text-muted-foreground">{row.joined}</span>,
          },
          {
            key: "status",
            label: "Status",
            render: (r) => <StatusBadge status={r.status || "Active"} />,
          },
        ]}
      />
    </div>
  );
}
