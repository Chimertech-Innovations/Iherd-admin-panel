import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  Calendar,
  ShieldCheck,
  FileText,
  Eye,
  CheckCircle2,
  XCircle,
  Ban,
  BadgeCheck,
  Store,
  Package,
  ShoppingCart,
  Wallet,
  Star,
  TrendingUp,
  Clock,
  LogIn,
  Building2,
  RotateCcw,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProfileHero } from "@/components/admin/ProfileHero";
import { toast } from "sonner";
import { useFirebaseCollection } from "../hooks/useFirebaseData";
import { exportToCsv } from "@/lib/csvExport";

const DOCUMENTS = [
  { name: "GST Certificate", type: "Tax", uploaded: "Jan 12, 2024", status: "Approved" },
  { name: "PAN Card", type: "ID Proof", uploaded: "Jan 12, 2024", status: "Approved" },
  { name: "Shop Establishment", type: "License", uploaded: "Jan 14, 2024", status: "Approved" },
  { name: "Bank Account Proof", type: "Banking", uploaded: "Jan 20, 2024", status: "Pending" },
];

const PRODUCTS = [
  { id: "P-7001", name: "Premium Cattle Feed 50kg", category: "Feed", price: "₹ 1,200", stock: 240, status: "Active" },
  { id: "P-7002", name: "Mineral Mixture 5kg", category: "Feed", price: "₹ 480", stock: 120, status: "Active" },
  { id: "P-7003", name: "Calcium Supplement", category: "Medicines", price: "₹ 320", stock: 0, status: "Out of stock" },
  { id: "P-7004", name: "Milking Machine Pro", category: "Equipment", price: "₹ 38,900", stock: 14, status: "Active" },
];

const ORDERS = [
  { id: "ORD-8821", buyer: "Selvam K", date: "Jun 14, 2026", items: "Feed x4", amount: "₹ 4,800", status: "Delivered" },
  { id: "ORD-8810", buyer: "Suresh Yadav", date: "Jun 11, 2026", items: "Mineral Mix", amount: "₹ 1,920", status: "Shipped" },
  { id: "ORD-8788", buyer: "Lakshmi Devi", date: "Jun 06, 2026", items: "Equipment", amount: "₹ 38,900", status: "Delivered" },
  { id: "ORD-8742", buyer: "Manoj Kumar", date: "May 28, 2026", items: "Supplements", amount: "₹ 1,280", status: "Pending" },
];

const PAYOUTS = [
  { id: "PAY-3321", date: "Jun 15, 2026", period: "Jun 1-14", amount: "₹ 1,84,200", status: "Paid" },
  { id: "PAY-3284", date: "Jun 01, 2026", period: "May 15-31", amount: "₹ 2,12,500", status: "Paid" },
  { id: "PAY-3251", date: "May 15, 2026", period: "May 1-14", amount: "₹ 1,68,900", status: "Paid" },
  { id: "PAY-3219", date: "May 01, 2026", period: "Apr 15-30", amount: "₹ 1,42,100", status: "Processing" },
];

const REVIEWS = [
  { buyer: "Selvam K", rating: 5, comment: "Top quality feed, fast delivery. Will buy again.", date: "Jun 14, 2026" },
  { buyer: "Manoj Kumar", rating: 4, comment: "Good products, packaging could be better.", date: "Jun 09, 2026" },
  { buyer: "Lakshmi Devi", rating: 5, comment: "Genuine items at fair prices. Recommended.", date: "Jun 02, 2026" },
];

const LOGIN_HISTORY = [
  { when: "Today, 09:20", device: "Chrome · Windows", ip: "103.21.58.12", location: "Ahmedabad, GJ", status: "Success" },
  { when: "Yesterday, 18:11", device: "iPhone 15 · iOS 18", ip: "103.21.58.12", location: "Ahmedabad, GJ", status: "Success" },
  { when: "3 days ago, 07:30", device: "Android · Pixel 7", ip: "49.36.112.4", location: "Surat, GJ", status: "Success" },
  { when: "1 week ago, 22:04", device: "Chrome · macOS", ip: "182.68.10.7", location: "Mumbai, MH", status: "Failed" },
];

export const Route = createFileRoute("/sellers/$sellerId")({
  head: () => ({ meta: [{ title: "Seller Profile — iHerd Admin" }] }),
  component: SellerDetail,
});

function InfoRow({ icon: Icon, label, value, valueClass }: { icon: any; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-sm font-semibold truncate ${valueClass ?? ""}`}>{value}</div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string | number; highlight?: boolean }) {
  return (
    <Card className={`p-4 rounded-2xl flex items-center gap-3 ${highlight ? "bg-primary/5 border-primary/30" : ""}`}>
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${highlight ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-bold truncate">{value}</div>
      </div>
    </Card>
  );
}

function SellerDetail() {
  const { sellerId } = Route.useParams();
  const { data: sellers = [] } = useFirebaseCollection<any>("sellers");
  const { data: users = [] } = useFirebaseCollection<any>("users");

  const rawSeller = sellers.find((s) => s.id === sellerId || s.uid === sellerId);
  const rawUser = users.find((u) => u.id === sellerId || u.uid === sellerId);
  const sellerObj = rawUser?.seller || {};

  const rawPhone =
    rawSeller?.sellerPhoneNumber ||
    rawSeller?.sellerPhone ||
    rawSeller?.phone ||
    rawSeller?.phoneNumber ||
    sellerObj?.sellerPhoneNumber ||
    sellerObj?.sellerPhone ||
    sellerObj?.phone ||
    sellerObj?.phoneNumber ||
    rawUser?.phoneNumber ||
    rawUser?.phone ||
    "—";

  const resolvedPhone =
    rawPhone && rawPhone !== "—"
      ? (rawPhone.startsWith("+") ? rawPhone : /^\d{10}$/.test(rawPhone) ? `+91${rawPhone}` : rawPhone)
      : "—";

  const seller = {
    id: sellerId,
    name: rawSeller?.name || rawSeller?.shopName || sellerObj?.shopName || sellerObj?.name || rawUser?.displayName || rawUser?.name || "Marketplace Seller",
    category: rawSeller?.category || sellerObj?.category || "Feed & Supplies",
    products: rawSeller?.products || sellerObj?.products || 0,
    gmv: rawSeller?.gmv || "—",
    rating: rawSeller?.rating || 5.0,
    status: rawSeller?.status || rawUser?.status || "Active",
    owner: rawSeller?.owner || rawSeller?.name || rawUser?.name || "Seller",
    phone: resolvedPhone,
    email: rawSeller?.email || rawUser?.email || sellerObj?.email || "—",
    city: rawSeller?.city || sellerObj?.city || rawUser?.district || "—",
    state: rawSeller?.state || sellerObj?.state || rawUser?.state || "—",
    address: rawSeller?.address || sellerObj?.address || rawUser?.address || "—",
    joined: rawSeller?.joined || rawSeller?.createdAt || rawUser?.createdAt || "—",
    lastLogin: rawSeller?.lastLogin || rawUser?.lastLoginAt || "—",
    gstin: rawSeller?.gstin || sellerObj?.gstin || "—",
    verified: Boolean(rawSeller?.verified || rawUser?.verified || true),
    orders: rawSeller?.orders || 0,
    payouts: rawSeller?.payouts || "—",
    returns: rawSeller?.returns || "—",
  };

  const [docs, setDocs] = useState(DOCUMENTS);
  const [status, setStatus] = useState<string>(seller.status);
  const [verified, setVerified] = useState<boolean>(seller.verified);

  const initials = seller.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("");

  const handleExportSeller = () => {
    exportToCsv({
      filename: `seller_${(seller.name || seller.id).toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      data: [
        {
          id: seller.id,
          name: seller.name,
          category: seller.category,
          owner: seller.owner,
          phone: seller.phone,
          email: seller.email,
          city: seller.city,
          state: seller.state,
          address: seller.address,
          gstin: seller.gstin,
          status,
          verified: verified ? "Yes" : "No",
          productsCount: seller.products,
          totalGMV: seller.gmv,
          rating: seller.rating,
          joined: seller.joined,
          lastLogin: seller.lastLogin,
        },
      ],
      columns: [
        { header: "Seller ID", accessor: "id" },
        { header: "Shop / Business Name", accessor: "name" },
        { header: "Category", accessor: "category" },
        { header: "Owner Name", accessor: "owner" },
        { header: "Phone Number", accessor: "phone" },
        { header: "Email Address", accessor: "email" },
        { header: "City", accessor: "city" },
        { header: "State", accessor: "state" },
        { header: "Address", accessor: "address" },
        { header: "GSTIN", accessor: "gstin" },
        { header: "Status", accessor: "status" },
        { header: "Verified", accessor: "verified" },
        { header: "Total Products", accessor: "productsCount" },
        { header: "Gross GMV", accessor: "totalGMV" },
        { header: "Seller Rating", accessor: "rating" },
        { header: "Registration Date", accessor: "joined" },
        { header: "Last Login", accessor: "lastLogin" },
      ],
    });
  };

  return (
    <div>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <Link to="/sellers">
            <ArrowLeft className="h-4 w-4" /> Back to sellers
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Seller profile"
        description={`Manage and verify ${seller.name}'s account`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExportSeller}
              title="Export seller profile & performance to CSV"
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => { setStatus("Suspended"); toast.warning(`${seller.name} suspended`); }}
            >
              <Ban className="h-4 w-4" /> Suspend
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive"
              onClick={() => { setStatus("Rejected"); toast.error(`${seller.name} rejected`); }}
            >
              <XCircle className="h-4 w-4" /> Reject
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setStatus("Active");
                setVerified(true);
                setDocs((d) => d.map((x) => ({ ...x, status: "Approved" })));
                toast.success(`${seller.name} approved`);
              }}
            >
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <ProfileHero
          name={seller.name}
          id={seller.id}
          subtitle={seller.category}
          subtitleIcon={Store}
          initials={initials}
          status={status}
          verified={verified}
          phone={seller.phone}
          email={seller.email}
          joined={seller.joined}
          location={`${seller.city}, ${seller.state}`}
        />

        {/* Business overview */}
        <Card className="p-6 rounded-3xl shadow-sm border-border/60">
          <h3 className="text-base font-semibold mb-4">Business overview</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Package} label="Products" value={seller.products} highlight />
            <StatCard icon={ShoppingCart} label="Total orders" value={seller.orders} />
            <StatCard icon={TrendingUp} label="GMV (30d)" value={seller.gmv} />
            <StatCard icon={Star} label="Avg rating" value={`${seller.rating} / 5`} />
          </div>
        </Card>

        {/* Documents */}
        <Card className="p-6 rounded-3xl shadow-sm border-border/60">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <h3 className="text-base font-semibold">Uploaded documents</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Verify KYC, tax and banking proofs</p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setDocs((d) => d.map((x) => ({ ...x, status: "Approved" })));
                setVerified(true);
                toast.success("All documents verified");
              }}
            >
              <BadgeCheck className="h-4 w-4" /> Verify all documents
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.name}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="h-4 w-4" />
                        </div>
                        <span className="font-medium">{d.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.type}</TableCell>
                    <TableCell className="text-muted-foreground">{d.uploaded}</TableCell>
                    <TableCell><StatusBadge status={d.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => toast(`Viewing ${d.name}`)}>
                          <Eye className="h-4 w-4" /> View
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => {
                            setDocs((arr) => arr.map((x) => x.name === d.name ? { ...x, status: "Approved" } : x));
                            toast.success(`${d.name} approved`);
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDocs((arr) => arr.map((x) => x.name === d.name ? { ...x, status: "Rejected" } : x));
                            toast.error(`${d.name} rejected`);
                          }}
                        >
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Activity tabs */}
        <Card className="p-6 rounded-3xl shadow-sm border-border/60">
        <Tabs defaultValue="products">
          <TabsList className="inline-flex flex-wrap h-auto w-fit justify-start gap-2 p-1.5 bg-muted/60 [&>*]:data-[state=active]:bg-primary [&>*]:data-[state=active]:text-primary-foreground [&>*]:data-[state=active]:shadow-md">
            <TabsTrigger value="products">Products ({PRODUCTS.length})</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
            <TabsTrigger value="reviews">Reviews & ratings</TabsTrigger>
            <TabsTrigger value="logins">Login history</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PRODUCTS.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          {p.name}
                        </div>
                      </TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell className="font-semibold">{p.price}</TableCell>
                      <TableCell>{p.stock}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Order ID</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ORDERS.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                          {o.id}
                        </div>
                      </TableCell>
                      <TableCell>{o.buyer}</TableCell>
                      <TableCell className="text-muted-foreground">{o.date}</TableCell>
                      <TableCell>{o.items}</TableCell>
                      <TableCell className="font-semibold">{o.amount}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="payouts" className="mt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Payout ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PAYOUTS.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.id}</TableCell>
                      <TableCell>{p.date}</TableCell>
                      <TableCell className="text-muted-foreground">{p.period}</TableCell>
                      <TableCell className="font-semibold">{p.amount}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="mt-4">
            <div className="space-y-3">
              {REVIEWS.map((r, i) => (
                <Card key={i} className="p-4 rounded-2xl border-border/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{r.buyer}</div>
                      <div className="text-xs text-muted-foreground">{r.date}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star
                          key={idx}
                          className={`h-4 w-4 ${idx < r.rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{r.comment}</p>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logins" className="mt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>When</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {LOGIN_HISTORY.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <LogIn className="h-3.5 w-3.5 text-muted-foreground" />
                          {l.when}
                        </div>
                      </TableCell>
                      <TableCell>{l.device}</TableCell>
                      <TableCell className="font-mono text-xs">{l.ip}</TableCell>
                      <TableCell>{l.location}</TableCell>
                      <TableCell><StatusBadge status={l.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
      </div>
    </div>
  );
}
