import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DataPage } from "@/components/admin/DataPage";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getApiBaseUrlSync } from "@/lib/apiClient";
import { getLocalizedText } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Beef,
  FileText,
  ExternalLink,
  Download,
  Clock,
  MapPin,
  Phone,
  Store,
  Truck,
  Copy,
  Check,
  Info,
  Package,
  Receipt,
  FileCheck,
  ShieldCheck,
  Image as ImageIcon,
  Coins,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/orders/cattle")({
  head: () => ({ meta: [{ title: "Cattle orders — iHerd Admin" }] }),
  component: CattleOrdersPage,
});

async function fetchCattleOrders() {
  const ordersMap = new Map<string, any>();

  // 1. Backend REST API (with ?fresh=true to bypass stale cache)
  try {
    const API_BASE = getApiBaseUrlSync();
    const res = await fetch(`${API_BASE}/api/admin/cattle-orders?fresh=true`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.orders)) {
        data.orders.forEach((o: any) => {
          const key = o.orderId || o.cattleOrderId || o.id;
          ordersMap.set(key, o);
        });
      }
    }
  } catch (err) {
    console.warn("Backend cattle orders error, trying client SDK:", err);
  }

  // 2. Direct Firestore SDK fallback (CattleOrders, cattle_orders, received_orders)
  try {
    const [cSnap, legacySnap, rSnap] = await Promise.all([
      getDocs(collection(db, "CattleOrders")).catch(() => null),
      getDocs(collection(db, "cattle_orders")).catch(() => null),
      getDocs(collection(db, "received_orders")).catch(() => null),
    ]);

    const processDoc = (docSnap: any) => {
      if (!docSnap) return;
      docSnap.docs?.forEach((d: any) => {
        const o = { id: d.id, ...d.data() };
        const key = o.orderId || o.cattleOrderId || o.id;
        if (!ordersMap.has(key)) {
          const totalAmount = Number(o.price || o.totalAmount || o.amount || 0);
          const tokenAmount = Number(o.tokenAmount || o.advanceAmount || 0);
          const balanceAmount = Number(o.balanceAmount || (totalAmount > tokenAmount ? totalAmount - tokenAmount : 0));
          ordersMap.set(key, {
            ...o,
            id: key,
            orderId: key,
            cattleName: o.cattleName || o.name || o.title || o.animal || "Livestock Cattle",
            breed: o.breed || o.cattleBreed || "Amritmahal",
            species: o.species || o.animalType || "Cow",
            tagNo: o.tagNo || o.tagNumber || o.earTagNo || o.rfid || "—",
            buyerName: o.buyerName || o.userName || o.shippingAddress?.name || "Buyer",
            buyerPhone: o.buyerPhone || o.phone || o.phoneNumber || o.shippingAddress?.phone || "—",
            buyerLocation: o.buyerLocation || (o.shippingAddress ? [o.shippingAddress.line1, o.shippingAddress.district, o.shippingAddress.state].filter(Boolean).join(", ") : "—"),
            sellerName: o.sellerName || o.owner || "Verified Seller",
            price: totalAmount,
            totalAmount,
            amount: totalAmount,
            tokenAmount,
            balanceAmount,
            paymentMethod: o.paymentMethod || o.paymentMode || "Escrow / Online",
            status: o.status || "Ordered",
            createdAt: o.createdAt || o.date || null,
          });
        }
      });
    };

    processDoc(cSnap);
    processDoc(legacySnap);
    processDoc(rSnap);
  } catch (clientErr) {
    console.warn("Client Firestore cattle orders fallback warning:", clientErr);
  }

  const list = Array.from(ordersMap.values());
  list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return list;
}

function formatDateTime(val: any) {
  if (!val) return "—";
  try {
    let d: Date;
    if (typeof val === "object" && (val._seconds || val.seconds)) {
      d = new Date((val._seconds || val.seconds) * 1000);
    } else if (typeof val === "number") {
      d = new Date(val);
    } else {
      d = new Date(val);
    }
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(val);
  }
}

const DEFAULT_CATTLE_IMAGE = "https://images.unsplash.com/photo-1546445317-29f4545e9d53?auto=format&fit=crop&w=300&q=80";

function formatImageUrl(url?: string | null) {
  if (!url) return DEFAULT_CATTLE_IMAGE;
  if (url.includes("drive.google.com")) {
    const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`;
    }
  }
  return url;
}

function CattleOrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<any | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<{ url: string; title: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["adminCattleOrders"],
    queryFn: fetchCattleOrders,
    placeholderData: [],
    staleTime: 15_000,
  });

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("Order ID copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalCount = orders.length;
  const escrowCount = orders.filter(
    (o: any) =>
      (o.status || "").toLowerCase().includes("escrow") ||
      (o.status || "").toLowerCase() === "pending" ||
      (o.status || "").toLowerCase() === "ordered"
  ).length;
  const completedCount = orders.filter(
    (o: any) =>
      (o.status || "").toLowerCase() === "completed" ||
      (o.status || "").toLowerCase() === "delivered"
  ).length;

  const totalVolume = orders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || o.price || 0), 0);

  return (
    <div className="space-y-6">
      <DataPage<any>
        title="Livestock & Cattle Orders"
        description="Buyer–Seller cattle marketplace transactions, escrow deposits, and verified livestock deliveries."
        primaryAction=""
        isLoading={isLoading}
        hideStatusFilter={true}
        filters={[]}
        statusKey="status"
        kpis={[
          { label: "Total Cattle Orders", value: isLoading ? "…" : totalCount.toLocaleString() },
          { label: "Total Revenue", value: isLoading ? "…" : `₹${totalVolume.toLocaleString()}` },
        ]}
        data={orders.map((o: any) => {
          return {
            ...o,
            status: getLocalizedText(o.status, "Ordered"),
            rawOrder: o,
          };
        })}
        columns={[
          {
            key: "id",
            label: "Order ID",
            render: (r: any) => {
              const ordId = r.id || r.orderId;
              return (
                <div className="flex items-center gap-1.5">
                  <span
                    className="font-mono text-xs font-bold text-foreground bg-primary/10 text-primary px-2.5 py-1 rounded-lg cursor-pointer hover:bg-primary/20 transition-all"
                    onClick={() => setSelectedOrder(r.rawOrder || r)}
                  >
                    #{ordId}
                  </span>
                  <button
                    onClick={(e) => handleCopy(ordId, e)}
                    className="text-muted-foreground hover:text-foreground transition-all p-1"
                    title="Copy Order ID"
                  >
                    {copiedId === ordId ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              );
            },
          },
          {
            key: "buyer",
            label: "Buyer",
            render: (r) => {
              const uId = r.userId || r.rawOrder?.userId;
              return (
                <div className="space-y-0.5 min-w-[140px]">
                  {uId ? (
                    <Link
                      to={`/users/${uId}` as any}
                      className="font-semibold text-xs text-primary hover:underline block truncate"
                    >
                      {r.buyerName || "Buyer"}
                    </Link>
                  ) : (
                    <span className="font-semibold text-xs text-foreground block truncate">
                      {r.buyerName || "Buyer"}
                    </span>
                  )}
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    <span>{r.buyerPhone || "—"}</span>
                  </div>
                </div>
              );
            },
          },
          {
            key: "seller",
            label: "Seller / Farm",
            render: (r) => {
              const sId = r.sellerId || r.rawOrder?.sellerId;
              return (
                <div className="space-y-0.5 min-w-[140px]">
                  {sId ? (
                    <Link
                      to={`/users/${sId}` as any}
                      className="font-semibold text-xs text-primary hover:underline block truncate"
                    >
                      {r.sellerName || "Farmer / Seller"}
                    </Link>
                  ) : (
                    <span className="font-semibold text-xs text-foreground block truncate">
                      {r.sellerName || "Farmer / Seller"}
                    </span>
                  )}
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Store className="h-3 w-3" />
                    <span>Verified Seller</span>
                  </div>
                </div>
              );
            },
          },
          {
            key: "animal",
            label: "Livestock Cattle",
            render: (r) => {
              const displayImg = formatImageUrl(r.image || r.cattleImage || r.imageUrl || r.thumbnail || r.faceViewImage || r.leftViewImage);
              const tag = r.tagNo || r.tagNumber || r.rfid;
              return (
                <div className="flex items-center gap-2.5 min-w-[190px]">
                  <img
                    src={displayImg}
                    alt={r.cattleName || "Cattle"}
                    className="h-10 w-10 rounded-xl object-cover ring-1 ring-border cursor-pointer shrink-0 hover:scale-105 transition-all"
                    onError={(e) => {
                      if (e.currentTarget.src !== DEFAULT_CATTLE_IMAGE) {
                        e.currentTarget.src = DEFAULT_CATTLE_IMAGE;
                      }
                    }}
                    onClick={() => setSelectedImagePreview({ url: displayImg, title: r.cattleName || "Cattle" })}
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-foreground truncate">{r.cattleName || "Livestock"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{r.breed || "Amritmahal"} • {r.species || "Cow"}</div>
                    {tag && tag !== "—" && (
                      <span className="inline-block mt-0.5 text-[10px] font-mono font-semibold bg-muted px-1.5 py-0.2 rounded border text-muted-foreground">
                        Tag: {tag}
                      </span>
                    )}
                  </div>
                </div>
              );
            },
          },
          {
            key: "amount",
            label: "Order Price",
            render: (r) => {
              const amt = Number(r.totalAmount || r.price || r.amount || 0);
              const tok = Number(r.tokenAmount || r.advanceAmount || 0);
              const due = Number(r.balanceAmount || (amt > tok && tok > 0 ? amt - tok : 0));
              return (
                <div className="space-y-0.5">
                  <div className="font-bold text-sm text-primary">₹{amt.toLocaleString()}</div>
                  {tok > 0 && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                      <Coins className="h-3 w-3" />
                      <span>Token: ₹{tok.toLocaleString()}</span>
                    </div>
                  )}
                  {due > 0 && tok > 0 && (
                    <div className="text-[10px] text-muted-foreground">Due: ₹{due.toLocaleString()}</div>
                  )}
                </div>
              );
            },
          },
          {
            key: "date",
            label: "Date & Time",
            render: (r) => (
              <div className="space-y-0.5 text-xs min-w-[120px]">
                <div className="font-medium text-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>{formatDateTime(r.createdAt || r.date)}</span>
                </div>
              </div>
            ),
          },
          {
            key: "invoice",
            label: "Invoice",
            render: (r) => {
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (r.invoiceUrl) {
                      window.open(r.invoiceUrl, "_blank");
                    } else {
                      setSelectedInvoiceOrder(r.rawOrder || r);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm transition-all"
                  title="View Official Tax Invoice"
                >
                  <FileText className="h-3 w-3" /> PDF <ExternalLink className="h-2.5 w-2.5" />
                </button>
              );
            },
          },
          {
            key: "status",
            label: "Status",
            render: (r) => <StatusBadge status={r.status || "Ordered"} />,
          },
          {
            key: "actions",
            label: "Action",
            render: (r) => (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs rounded-xl gap-1 px-2.5"
                onClick={() => setSelectedOrder(r.rawOrder || r)}
              >
                <Info className="h-3.5 w-3.5" /> Details
              </Button>
            ),
          },
        ]}
      />

      {/* Cattle Order Details & Invoice Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 text-lg">
              <div className="flex items-center gap-2">
                <Beef className="h-5 w-5 text-primary" />
                <span>Cattle Order #{selectedOrder?.orderId || selectedOrder?.id}</span>
              </div>
              {selectedOrder && <StatusBadge status={selectedOrder.status || "Ordered"} />}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-5 mt-2">
              {/* Order Header Card */}
              <div className="p-4 rounded-2xl bg-muted/30 border space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>Ordered on: <strong className="text-foreground">{formatDateTime(selectedOrder.createdAt)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Receipt className="h-3.5 w-3.5 text-primary" />
                    <span>Invoice No: <strong className="font-mono text-foreground">{selectedOrder.invoiceNumber || "—"}</strong></span>
                  </div>
                </div>

                {selectedOrder.invoiceUrl && (
                  <div className="pt-2 border-t flex items-center justify-between gap-2">
                    <span className="text-xs text-success font-semibold flex items-center gap-1">
                      <FileCheck className="h-4 w-4" /> Official Tax Invoice Ready
                    </span>
                    <a
                      href={selectedOrder.invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-success text-success-foreground text-xs font-bold shadow hover:opacity-90"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Invoice PDF
                    </a>
                  </div>
                )}
              </div>

              {/* Cattle Card */}
              <div className="p-4 rounded-2xl bg-card border space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Livestock Details
                </h4>
                <div className="flex items-start gap-4">
                  {selectedOrder.image ? (
                    <img
                      src={selectedOrder.image}
                      alt={selectedOrder.cattleName}
                      className="h-20 w-20 rounded-2xl object-cover ring-1 ring-border cursor-pointer shrink-0"
                      onClick={() => setSelectedImagePreview({ url: selectedOrder.image, title: selectedOrder.cattleName || "Cattle" })}
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
                      <Beef className="h-8 w-8" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs min-w-0 flex-1">
                    <div><span className="text-muted-foreground">Name:</span> <strong className="text-foreground">{selectedOrder.cattleName || "—"}</strong></div>
                    <div><span className="text-muted-foreground">Breed:</span> <strong className="text-foreground">{selectedOrder.breed || "—"}</strong></div>
                    <div><span className="text-muted-foreground">Species:</span> <strong className="text-foreground">{selectedOrder.species || "Cow"}</strong></div>
                    <div><span className="text-muted-foreground">Tag / RFID:</span> <strong className="font-mono text-foreground">{selectedOrder.tagNo || selectedOrder.tagNumber || selectedOrder.rfid || "—"}</strong></div>
                    <div><span className="text-muted-foreground">Price:</span> <strong className="text-primary font-bold">₹{Number(selectedOrder.totalAmount || selectedOrder.price || 0).toLocaleString()}</strong></div>
                    {selectedOrder.tokenAmount > 0 && (
                      <div><span className="text-muted-foreground">Token Paid:</span> <strong className="text-emerald-600 font-bold">₹{Number(selectedOrder.tokenAmount).toLocaleString()}</strong></div>
                    )}
                    {selectedOrder.balanceAmount > 0 && (
                      <div><span className="text-muted-foreground">Balance Due:</span> <strong className="text-amber-600 font-bold">₹{Number(selectedOrder.balanceAmount).toLocaleString()}</strong></div>
                    )}
                    {selectedOrder.age && <div><span className="text-muted-foreground">Age:</span> <strong className="text-foreground">{selectedOrder.age}</strong></div>}
                    {selectedOrder.milkYield && <div><span className="text-muted-foreground">Milk Yield:</span> <strong className="text-foreground">{selectedOrder.milkYield} L/day</strong></div>}
                    <div><span className="text-muted-foreground">Payment Mode:</span> <strong className="text-foreground">{selectedOrder.paymentMethod || "Escrow / Online"}</strong></div>
                  </div>
                </div>
              </div>

              {/* Buyer & Seller Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-muted/20 border space-y-1">
                  <div className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Buyer Information</div>
                  <div className="font-semibold text-foreground text-sm">{selectedOrder.buyerName}</div>
                  <div className="text-muted-foreground">Phone: {selectedOrder.buyerPhone}</div>
                  <div className="text-muted-foreground">{selectedOrder.buyerLocation}</div>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border space-y-1">
                  <div className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Seller Information</div>
                  <div className="font-semibold text-foreground text-sm">{selectedOrder.sellerName}</div>
                  {selectedOrder.sellerPhone && selectedOrder.sellerPhone !== "—" && (
                    <div className="text-muted-foreground">Phone: {selectedOrder.sellerPhone}</div>
                  )}
                  {selectedOrder.farmName && selectedOrder.farmName !== "—" && (
                    <div className="text-muted-foreground">Farm: {selectedOrder.farmName}</div>
                  )}
                  <div className="text-muted-foreground">Verified Seller / Farm Owner</div>
                </div>
              </div>

              {/* Total Billing */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center justify-between font-black text-base text-foreground">
                  <span>Total Transaction Amount</span>
                  <span className="text-primary text-lg">₹{Number(selectedOrder.totalAmount || selectedOrder.price || 0).toLocaleString()}</span>
                </div>
                {selectedOrder.tokenAmount > 0 && (
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-primary/10">
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5" /> Token Deposit Paid: ₹{Number(selectedOrder.tokenAmount).toLocaleString()}
                    </span>
                    <span className="text-amber-700 font-semibold">
                      Remaining Balance: ₹{Number(selectedOrder.balanceAmount || ((selectedOrder.totalAmount || 0) - selectedOrder.tokenAmount)).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      <Dialog open={!!selectedImagePreview} onOpenChange={() => setSelectedImagePreview(null)}>
        <DialogContent className="max-w-xl p-3 bg-card rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">{selectedImagePreview?.title}</DialogTitle>
          </DialogHeader>
          {selectedImagePreview && (
            <img
              src={selectedImagePreview.url}
              alt={selectedImagePreview.title}
              className="w-full max-h-[70vh] object-contain rounded-2xl"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Tax Invoice Printable Modal */}
      <Dialog open={!!selectedInvoiceOrder} onOpenChange={() => setSelectedInvoiceOrder(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 bg-card text-foreground">
          {selectedInvoiceOrder && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Beef className="h-6 w-6 text-primary" />
                    <span className="text-xl font-black tracking-tight">iHerd Farm Hub</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Livestock & Cattle Marketplace Invoice</p>
                </div>
                <div className="text-right">
                  <div className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 font-bold text-xs">
                    TAX INVOICE
                  </div>
                  <p className="font-mono text-xs font-bold text-foreground mt-1">
                    #{selectedInvoiceOrder.invoiceNumber || selectedInvoiceOrder.id}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Date: {formatDateTime(selectedInvoiceOrder.createdAt || selectedInvoiceOrder.date)}
                  </p>
                </div>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-2xl bg-muted/30 border">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1">Billed To (Buyer)</p>
                  <p className="font-bold text-foreground text-sm">{selectedInvoiceOrder.buyerName || "Buyer"}</p>
                  <p className="text-muted-foreground mt-0.5">Phone: {selectedInvoiceOrder.buyerPhone || "—"}</p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed mt-1">
                    {selectedInvoiceOrder.buyerLocation || "Verified Farm Hub User"}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-muted/30 border">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1">Billed By (Seller)</p>
                  <p className="font-bold text-foreground text-sm">{selectedInvoiceOrder.sellerName || "Verified Seller"}</p>
                  <p className="text-muted-foreground mt-0.5">Role: Certified Cattle Farmer / Seller</p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed mt-1">iHerd Platform Verified Livestock</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-2xl border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="py-2.5 px-3 text-left font-bold text-muted-foreground">Item Description</th>
                      <th className="py-2.5 px-3 text-center font-bold text-muted-foreground">Breed / Type</th>
                      <th className="py-2.5 px-3 text-center font-bold text-muted-foreground">Qty</th>
                      <th className="py-2.5 px-3 text-right font-bold text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-3 px-3 font-semibold text-foreground">
                        {selectedInvoiceOrder.cattleName || "Livestock Cattle"}
                      </td>
                      <td className="py-3 px-3 text-center text-muted-foreground">
                        {selectedInvoiceOrder.breed || "Amritmahal"} ({selectedInvoiceOrder.species || "Cow"})
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-medium">1</td>
                      <td className="py-3 px-3 text-right font-bold text-foreground">
                        ₹{Number(selectedInvoiceOrder.totalAmount || selectedInvoiceOrder.price || 0).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals & Status */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>Payment Protected via <strong>iHerd Escrow</strong></span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Status: <strong className="text-emerald-600 font-bold uppercase">{selectedInvoiceOrder.status || "COMPLETED"}</strong>
                  </div>
                </div>

                <div className="w-full sm:w-48 space-y-1 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span>₹{Number(selectedInvoiceOrder.totalAmount || selectedInvoiceOrder.price || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST (Included):</span>
                    <span>₹0.00</span>
                  </div>
                  <div className="flex justify-between font-black text-sm text-foreground pt-1 border-t">
                    <span>Total Amount:</span>
                    <span className="text-primary">₹{Number(selectedInvoiceOrder.totalAmount || selectedInvoiceOrder.price || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs gap-1"
                  onClick={() => window.print()}
                >
                  <Download className="h-3.5 w-3.5" /> Print / Save PDF
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl text-xs"
                  onClick={() => setSelectedInvoiceOrder(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
