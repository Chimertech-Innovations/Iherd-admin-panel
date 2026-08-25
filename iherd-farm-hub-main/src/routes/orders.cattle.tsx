import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DataPage } from "@/components/admin/DataPage";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/orders/cattle")({
  head: () => ({ meta: [{ title: "Cattle orders — iHerd Admin" }] }),
  component: CattleOrdersPage,
});

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://iherdadminpanel.onrender.com";

async function fetchCattleOrders() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/cattle-orders`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.orders || [];
  } catch (err) {
    console.warn("Error fetching cattle orders from backend:", err);
    return [];
  }
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

function CattleOrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
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
        filters={["Ordered", "Pending", "In escrow", "In transit", "Completed", "Cancelled"]}
        statusKey="status"
        kpis={[
          { label: "Total Cattle Orders", value: isLoading ? "…" : totalCount.toLocaleString() },
          { label: "Pending / Escrow", value: isLoading ? "…" : escrowCount.toLocaleString() },
          { label: "Completed", value: isLoading ? "…" : completedCount.toLocaleString() },
          { label: "Trade Volume", value: isLoading ? "…" : `₹${totalVolume.toLocaleString()}` },
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
            render: (r) => (
              <div className="flex items-center gap-2.5 min-w-[180px]">
                {r.image ? (
                  <img
                    src={r.image}
                    alt={r.cattleName || "Cattle"}
                    className="h-9 w-9 rounded-xl object-cover ring-1 ring-border cursor-pointer shrink-0 hover:scale-105 transition-all"
                    onClick={() => setSelectedImagePreview({ url: r.image, title: r.cattleName || "Cattle" })}
                  />
                ) : (
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Beef className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-xs text-foreground truncate">{r.cattleName || "Livestock"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{r.breed || "Amritmahal"} • {r.species || "Cow"}</div>
                </div>
              </div>
            ),
          },
          {
            key: "amount",
            label: "Order Price",
            render: (r) => {
              const amt = Number(r.totalAmount || r.price || r.amount || 0);
              return (
                <div className="font-bold text-sm text-primary">₹{amt.toLocaleString()}</div>
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
              if (r.invoiceUrl) {
                return (
                  <a
                    href={r.invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-success text-success-foreground text-[11px] font-bold shadow-sm hover:opacity-90 transition-all"
                  >
                    <FileText className="h-3 w-3" /> PDF <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                );
              }
              return (
                <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {r.invoiceNumber || "—"}
                </span>
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
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs min-w-0 flex-1">
                    <div><span className="text-muted-foreground">Name:</span> <strong className="text-foreground">{selectedOrder.cattleName || "—"}</strong></div>
                    <div><span className="text-muted-foreground">Breed:</span> <strong className="text-foreground">{selectedOrder.breed || "—"}</strong></div>
                    <div><span className="text-muted-foreground">Species:</span> <strong className="text-foreground">{selectedOrder.species || "Cow"}</strong></div>
                    <div><span className="text-muted-foreground">Price:</span> <strong className="text-primary font-bold">₹{Number(selectedOrder.totalAmount || selectedOrder.price || 0).toLocaleString()}</strong></div>
                    {selectedOrder.age && <div><span className="text-muted-foreground">Age:</span> <strong className="text-foreground">{selectedOrder.age}</strong></div>}
                    {selectedOrder.milkYield && <div><span className="text-muted-foreground">Milk Yield:</span> <strong className="text-foreground">{selectedOrder.milkYield} L/day</strong></div>}
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
                  <div className="text-muted-foreground">Verified Seller / Farm Owner</div>
                </div>
              </div>

              {/* Total Billing */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between font-black text-base text-foreground">
                <span>Total Transaction Amount</span>
                <span className="text-primary text-lg">₹{Number(selectedOrder.totalAmount || selectedOrder.price || 0).toLocaleString()}</span>
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
    </div>
  );
}
