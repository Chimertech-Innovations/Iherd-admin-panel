import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DataPage } from "@/components/admin/DataPage";
import { useQuery } from "@tanstack/react-query";
import { getLocalizedText, formatImageUrl } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
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
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/orders/products")({
  head: () => ({ meta: [{ title: "Product orders — iHerd Admin" }] }),
  component: ProductOrdersPage,
});

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://iherdadminpanel.onrender.com";

async function fetchProductOrders() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/product-orders`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.orders || [];
  } catch (err) {
    console.warn("Error fetching product orders from backend:", err);
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

function ProductOrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["adminProductOrders"],
    queryFn: fetchProductOrders,
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
  const processingCount = orders.filter(
    (o: any) =>
      (o.status || "").toLowerCase() === "processing" ||
      (o.status || "").toLowerCase() === "pending" ||
      (o.status || "").toLowerCase() === "ordered"
  ).length;
  const completedCount = orders.filter(
    (o: any) =>
      (o.status || "").toLowerCase() === "completed" ||
      (o.status || "").toLowerCase() === "delivered"
  ).length;

  const totalRevenue = orders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || o.price || 0), 0);

  return (
    <div className="space-y-6">
      <DataPage<any>
        title="Product Marketplace Orders"
        description="Live orders placed across the iHerd Farm Hub e-commerce & veterinary supplies store."
        primaryAction=""
        isLoading={isLoading}
        filters={["Ordered", "Pending", "Processing", "Shipped", "Delivered", "Completed", "Cancelled"]}
        statusKey="status"
        kpis={[
          { label: "Total Orders", value: isLoading ? "…" : totalCount.toLocaleString() },
          { label: "Pending / Ordered", value: isLoading ? "…" : processingCount.toLocaleString() },
          { label: "Completed / Delivered", value: isLoading ? "…" : completedCount.toLocaleString() },
          { label: "Total Revenue", value: isLoading ? "…" : `₹${totalRevenue.toLocaleString()}` },
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
            label: "Buyer / Customer",
            render: (r) => {
              const uId = r.userId || r.rawOrder?.userId;
              return (
                <div className="space-y-0.5 min-w-[140px]">
                  {uId ? (
                    <Link
                      to={`/users/${uId}` as any}
                      className="font-semibold text-xs text-primary hover:underline block truncate"
                    >
                      {r.buyerName || "Customer"}
                    </Link>
                  ) : (
                    <span className="font-semibold text-xs text-foreground block truncate">
                      {r.buyerName || "Customer"}
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
            label: "Shop / Seller",
            render: (r) => (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-[120px]">
                <Store className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-foreground font-medium truncate">{r.sellerName || "iHerd Marketplace"}</span>
              </div>
            ),
          },
          {
            key: "items",
            label: "Product Items",
            render: (r) => {
              const items = Array.isArray(r.items) ? r.items : [];
              return (
                <div className="space-y-1 min-w-[180px]">
                  {items.length > 0 ? (
                    <div className="flex items-center gap-2">
                      {items[0]?.image ? (
                        <img
                          src={formatImageUrl(items[0].image)}
                          alt={items[0].name}
                          className="h-8 w-8 rounded-lg object-cover ring-1 ring-border shrink-0 bg-background"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                          <Package className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-xs text-foreground truncate max-w-[140px]">
                          {items[0].name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {items.length > 1 ? `+${items.length - 1} more item(s)` : `Qty: ${items[0].quantity || 1} × ₹${items[0].price}`}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">1 item</span>
                  )}
                </div>
              );
            },
          },
          {
            key: "amount",
            label: "Total Price",
            render: (r) => {
              const amt = Number(r.totalAmount || r.price || r.amount || 0);
              return (
                <div className="space-y-0.5">
                  <div className="font-bold text-sm text-primary">₹{amt.toLocaleString()}</div>
                  {r.shippingFee > 0 && (
                    <div className="text-[10px] text-muted-foreground">+ ₹{r.shippingFee} ship</div>
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

      {/* Order Details & Invoice Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 text-lg">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                <span>Order #{selectedOrder?.orderId || selectedOrder?.id}</span>
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

              {/* Items List */}
              {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Purchased Products ({selectedOrder.items.length})
                  </h4>
                  <div className="space-y-2 divide-y divide-border/40">
                    {selectedOrder.items.map((it: any, iIdx: number) => (
                      <div key={iIdx} className="pt-2 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          {it.image ? (
                            <img
                              src={formatImageUrl(it.image)}
                              alt={it.name}
                              className="h-11 w-11 rounded-lg object-cover ring-1 ring-border bg-background"
                              referrerPolicy="no-referrer"
                              crossOrigin="anonymous"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary grid place-items-center">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-foreground text-sm">{it.name}</div>
                            <div className="text-muted-foreground">
                              Qty: <strong className="text-foreground">{it.quantity || 1}</strong> × ₹{it.price}
                              {it.gstPercent ? ` (${it.gstPercent}% GST)` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="font-bold text-foreground text-sm">
                          ₹{Number((it.price || 0) * (it.quantity || 1)).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery & Customer Info */}
              <div className="p-4 rounded-2xl bg-muted/20 border space-y-2 text-xs">
                <h4 className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> Delivery & Customer Details
                </h4>
                <div className="space-y-1">
                  <div className="font-bold text-foreground text-sm">{selectedOrder.buyerName}</div>
                  <div className="text-muted-foreground">Contact: <span className="font-medium text-foreground">{selectedOrder.buyerPhone}</span></div>
                  <div className="text-foreground font-medium">{selectedOrder.buyerAddress}</div>
                  {selectedOrder.trackingId && selectedOrder.trackingId !== "—" && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
                      <Truck className="h-3 w-3 text-primary" />
                      <span>Tracking ID: <strong className="font-mono text-foreground">{selectedOrder.trackingId}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Total Billing Breakdown */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Items Subtotal</span>
                  <span>
                    ₹{Number(
                      Array.isArray(selectedOrder.items)
                        ? selectedOrder.items.reduce((s: number, it: any) => s + (Number(it.price || 0) * Number(it.quantity || 1)), 0)
                        : selectedOrder.totalAmount || 0
                    ).toLocaleString()}
                  </span>
                </div>
                {selectedOrder.shippingFee > 0 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Shipping & Delivery Fee</span>
                    <span>₹{selectedOrder.shippingFee}</span>
                  </div>
                )}
                {selectedOrder.discount > 0 && (
                  <div className="flex items-center justify-between text-xs text-success">
                    <span>Discount</span>
                    <span>-₹{selectedOrder.discount}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-primary/20 flex items-center justify-between font-black text-base text-foreground">
                  <span>Grand Total</span>
                  <span className="text-primary text-lg">₹{Number(selectedOrder.totalAmount || selectedOrder.price || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
