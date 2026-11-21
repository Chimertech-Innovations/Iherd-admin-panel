import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, Plus, Phone, Mail, MapPin } from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchApiJson } from "@/lib/apiClient";
import { toast } from "sonner";
import { useVerifiedDirectory } from "@/hooks/useVerifiedDirectory";

export const Route = createFileRoute("/sellers/")({
  head: () => ({ meta: [{ title: "Sellers Management — iHerd Admin" }] }),
  component: SellersPage,
});

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

      try {
        await fetchApiJson("/api/admin/sellers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sellerData),
        });
      } catch (apiErr) {
        await addDoc(collection(db, "sellers"), sellerData);
      }

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
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm rounded-xl">
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
            <Label htmlFor="ownerName" className="text-xs font-semibold">Owner Name</Label>
            <Input
              id="ownerName"
              placeholder="e.g. Rajesh Kumar"
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
                <SelectTrigger id="category" className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Feed & Nutrition">Feed & Nutrition</SelectItem>
                  <SelectItem value="Veterinary Medicines">Veterinary Medicines</SelectItem>
                  <SelectItem value="Dairy Equipment">Dairy Equipment</SelectItem>
                  <SelectItem value="Cattle Trading">Cattle Trading</SelectItem>
                  <SelectItem value="General Supplies">General Supplies</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs font-semibold">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="vendor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl"
            />
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
  const { sellers, isLoading } = useVerifiedDirectory();

  const totalSellers = sellers.length;
  const verifiedSellers = sellers.filter((s) => s.verified || s.status === "Active").length;
  const totalListedProducts = sellers.reduce((acc, s) => acc + (s.products || 0), 0);

  return (
    <div className="space-y-6">
      <DataPage
        title="Seller Management"
        description="All registered marketplace sellers — feed, equipment, medicines, and cattle trading."
        isLoading={isLoading}
        searchPlaceholder="Search sellers by store name, owner, phone, or category..."
        searchKeys={["name", "ownerName", "phone", "category", "city", "state"]}
        kpis={[
          { label: "Total Sellers", value: isLoading ? "…" : totalSellers.toLocaleString(), change: "Registered vendors", up: true },
          { label: "Verified Sellers", value: isLoading ? "…" : verifiedSellers.toLocaleString(), change: "Verified vendors", up: true },
          { label: "Products Listed", value: isLoading ? "…" : totalListedProducts.toLocaleString(), change: "Catalog items", up: true },
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
            render: (row) => {
              const hasPhone = Boolean(row.phone && row.phone !== "—");
              const hasEmail = Boolean(row.email && row.email !== "—");

              if (hasPhone) {
                return (
                  <div className="flex items-center gap-1 text-xs font-medium">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{row.phone}</span>
                  </div>
                );
              }
              if (hasEmail) {
                return (
                  <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate max-w-[150px]">{row.email}</span>
                  </div>
                );
              }
              return (
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                  <span>—</span>
                </div>
              );
            },
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
            key: "location",
            label: "Location",
            render: (row) => (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>
                  {row.location && row.location !== "—"
                    ? row.location
                    : row.city && row.city !== "—"
                    ? `${row.city}${row.state && row.state !== "—" ? `, ${row.state}` : ""}`
                    : row.state && row.state !== "—"
                    ? row.state
                    : "—"}
                </span>
              </div>
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
            render: (row) => <span className="text-muted-foreground text-xs">{row.joined}</span>,
          },
        ]}
      />
    </div>
  );
}
