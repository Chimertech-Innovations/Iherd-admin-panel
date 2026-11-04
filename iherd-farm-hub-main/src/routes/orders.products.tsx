import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DataPage } from "@/components/admin/DataPage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLocalizedText, formatImageUrl } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  Calendar,
  CreditCard,
  User,
  ShieldCheck,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Loader2,
  Send,
  Building2,
  Tag,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const Route = createFileRoute("/orders/products")({
  head: () => ({ meta: [{ title: "Product Orders & Shipping Tracking — iHerd Admin" }] }),
  component: ProductOrdersPage,
});

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://iherdadminpanel.onrender.com";
const FALLBACK_API_BASE = "https://iherdadminpanel.onrender.com";

const CARRIER_PRESETS = [
  { name: "Delhivery", urlTemplate: "https://www.delhivery.com/track/package/{awb}" },
  { name: "Blue Dart", urlTemplate: "https://www.bluedart.com/tracking" },
  { name: "DTDC", urlTemplate: "https://www.dtdc.in/tracking/shipment-tracking.asp?trkType=awb&strCnno={awb}" },
  { name: "India Post (Speed Post)", urlTemplate: "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx" },
  { name: "Shiprocket", urlTemplate: "https://shiprocket.co/tracking/{awb}" },
  { name: "Ekart Logistics", urlTemplate: "https://ekartlogistics.com/shipmenttrack/{awb}" },
  { name: "Shadowfax", urlTemplate: "https://tracker.shadowfax.in/#/track/{awb}" },
  { name: "XpressBees", urlTemplate: "https://www.xpressbees.com/track?awb={awb}" },
  { name: "Ecom Express", urlTemplate: "https://ecomexpress.in/tracking/?awb={awb}" },
  { name: "In-House Delivery", urlTemplate: "" },
  { name: "Other / Custom", urlTemplate: "" },
];

const ORDER_STATUS_STEPS = [
  { key: "ordered", label: "Order Placed", desc: "Order submitted by customer" },
  { key: "processing", label: "Processing / Packed", desc: "Items prepared & packed" },
  { key: "shipped", label: "Shipped / In Transit", desc: "Handed to courier carrier" },
  { key: "out_for_delivery", label: "Out for Delivery", desc: "Courier on way to address" },
  { key: "delivered", label: "Delivered", desc: "Successfully handed over" },
];

async function fetchProductOrders() {
  const endpoints = [API_BASE];
  if (API_BASE !== FALLBACK_API_BASE) {
    endpoints.push(FALLBACK_API_BASE);
  }

  for (const base of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${base}/api/admin/product-orders?refresh=1&t=${Date.now()}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.orders || [];
    } catch (err) {
      console.warn(`Fetch product orders from ${base} notice:`, err);
    }
  }
  return [];
}

async function updateProductOrderTracking(orderId: string, payload: any) {
  let backendSuccess = false;
  const endpoints = [API_BASE];
  if (API_BASE !== FALLBACK_API_BASE) {
    endpoints.push(FALLBACK_API_BASE);
  }

  for (const base of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${base}/api/admin/product-orders/${encodeURIComponent(orderId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        backendSuccess = true;
        break;
      }
    } catch (backendErr) {
      console.warn(`Backend update on ${base} notice:`, backendErr);
    }
  }

  // Direct Firestore sync fallback
  try {
    const pRef = doc(db, "ProductOrders", orderId);
    await setDoc(pRef, { ...payload, updatedAt: new Date().toISOString() }, { merge: true });
    backendSuccess = true;
  } catch (fbErr) {
    console.warn("Firestore direct write notice:", fbErr);
  }

  if (!backendSuccess) {
    throw new Error("Unable to save tracking info. Please verify network connection.");
  }
  return { success: true };
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

function formatDateOnly(val: any) {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(val);
  }
}

function getStepIndex(status?: string): number {
  const s = (status || "").toLowerCase().trim();
  if (s.includes("cancel") || s.includes("return")) return -1;
  if (s.includes("deliver") || s.includes("complete")) return 4;
  if (s.includes("out for delivery") || s.includes("out_for_delivery")) return 3;
  if (s.includes("ship") || s.includes("transit") || s.includes("dispatched")) return 2;
  if (s.includes("process") || s.includes("pack") || s.includes("ready")) return 1;
  return 0; // Ordered / Pending
}

function ProductOrdersPage() {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Tracking form states
  const [carrierName, setCarrierName] = useState<string>("");
  const [trackingId, setTrackingId] = useState<string>("");
  const [trackingUrl, setTrackingUrl] = useState<string>("");
  const [orderStatus, setOrderStatus] = useState<string>("Processing");
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState<string>("");
  const [dispatchedDate, setDispatchedDate] = useState<string>("");
  const [shippingNotes, setShippingNotes] = useState<string>("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["adminProductOrders"],
    queryFn: fetchProductOrders,
    placeholderData: [],
    staleTime: 15_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: any }) =>
      updateProductOrderTracking(orderId, payload),
    onSuccess: (_, variables) => {
      toast.success(`Shipping tracking & status updated for #${variables.orderId}`);
      queryClient.invalidateQueries({ queryKey: ["adminProductOrders"] });
      
      // Update locally selected order if viewing details
      if (selectedOrder && (selectedOrder.id === variables.orderId || selectedOrder.orderId === variables.orderId)) {
        setSelectedOrder((prev: any) => ({
          ...prev,
          ...variables.payload,
        }));
      }
      setTrackingOrder(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update tracking details");
    },
  });

  const handleCopy = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openTrackingDialog = (order: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const o = order.rawOrder || order;
    setTrackingOrder(o);
    setCarrierName(o.carrierName || o.courierPartner || "Delhivery");
    setTrackingId(o.trackingId && o.trackingId !== "—" ? o.trackingId : "");
    setTrackingUrl(o.trackingUrl || "");
    setOrderStatus(o.status || "Processing");
    setEstimatedDeliveryDate(o.estimatedDeliveryDate || o.deliveryDate || "");
    setDispatchedDate(o.dispatchedAt || o.shippingDate || "");
    setShippingNotes(o.shippingNotes || o.adminNotes || "");
  };

  const handleCarrierChange = (carrier: string) => {
    setCarrierName(carrier);
    const preset = CARRIER_PRESETS.find((p) => p.name.toLowerCase() === carrier.toLowerCase());
    if (preset && preset.urlTemplate && trackingId) {
      setTrackingUrl(preset.urlTemplate.replace("{awb}", encodeURIComponent(trackingId.trim())));
    }
  };

  const handleTrackingIdChange = (val: string) => {
    setTrackingId(val);
    const preset = CARRIER_PRESETS.find((p) => p.name.toLowerCase() === carrierName.toLowerCase());
    if (preset && preset.urlTemplate && val.trim()) {
      setTrackingUrl(preset.urlTemplate.replace("{awb}", encodeURIComponent(val.trim())));
    }
  };

  const handleSaveTracking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingOrder) return;
    const targetId = trackingOrder.orderId || trackingOrder.id;
    if (!targetId) {
      toast.error("Invalid order identifier");
      return;
    }

    const orderKey = trackingOrder.orderId || trackingOrder.id || targetId;
    const totalAmt = Number(trackingOrder.totalAmount ?? trackingOrder.price ?? trackingOrder.amount ?? 0);
    const items = Array.isArray(trackingOrder.items) ? trackingOrder.items : [];

    const payload = {
      id: orderKey,
      orderId: orderKey,
      userId: trackingOrder.userId || null,
      buyerName: trackingOrder.buyerName || "Customer",
      buyerPhone: trackingOrder.buyerPhone || "—",
      buyerAddress: trackingOrder.buyerAddress || "—",
      sellerName: trackingOrder.sellerName || trackingOrder.shopName || "iHerd Marketplace Store",
      items: items,
      itemCount: items.length || 1,
      totalAmount: totalAmt,
      price: totalAmt,
      amount: totalAmt,
      shippingFee: Number(trackingOrder.shippingFee || 0),
      discount: Number(trackingOrder.discount || 0),
      invoiceNumber: trackingOrder.invoiceNumber || trackingOrder.invoiceNo || "—",
      invoiceUrl: trackingOrder.invoiceUrl || null,
      trackingId: trackingId.trim() || "—",
      deliveryDate: estimatedDeliveryDate.trim() || trackingOrder.deliveryDate || "Standard Shipping",
      status: orderStatus || "Ordered",
      createdAt: trackingOrder.createdAt || trackingOrder.date || null,
      updatedAt: new Date().toISOString(),
    };

    updateMutation.mutate({ orderId: targetId, payload });
  };

  // KPIs
  const totalCount = orders.length;
  const processingCount = orders.filter((o: any) => {
    const s = (o.status || "").toLowerCase();
    return s === "processing" || s === "pending" || s === "ordered" || s === "packed";
  }).length;
  const inTransitCount = orders.filter((o: any) => {
    const s = (o.status || "").toLowerCase();
    return s === "shipped" || s === "in transit" || s === "out for delivery";
  }).length;
  const completedCount = orders.filter((o: any) => {
    const s = (o.status || "").toLowerCase();
    return s === "completed" || s === "delivered";
  }).length;
  const totalRevenue = orders.reduce(
    (sum: number, o: any) => sum + Number(o.totalAmount || o.price || 0),
    0
  );

  return (
    <div className="space-y-6">
      <DataPage<any>
        title="Product Marketplace Orders & Shipping"
        description="Monitor farm hub e-commerce orders, customer shipments, and update live courier tracking information."
        isLoading={isLoading}
        searchKeys={[
          "id",
          "orderId",
          "buyerName",
          "buyerPhone",
          "sellerName",
          "trackingId",
          "carrierName",
          "status",
          "paymentStatus",
          "invoiceNumber",
          "shippingAddress",
          "buyerAddress",
        ]}
        searchPlaceholder="Search product orders by Order ID, customer, phone, seller, tracking, or items..."
        filters={[
          "Ordered",
          "Processing",
          "Packed",
          "Shipped",
          "In Transit",
          "Out for Delivery",
          "Delivered",
          "Completed",
          "Cancelled",
        ]}
        statusKey="status"
        kpis={[
          { label: "Total Orders", value: isLoading ? "…" : totalCount.toLocaleString() },
          { label: "Total Revenue", value: isLoading ? "…" : `₹${totalRevenue.toLocaleString()}` }
        ]}
        data={orders.map((o: any) => {
          const rawSeller = (o.sellerName || o.shopName || o.storeName || "").trim();
          const sellerName =
            rawSeller && rawSeller !== "—" && !rawSeller.toLowerCase().includes("iherd marketplace")
              ? rawSeller
              : "Chimertech";
          return {
            ...o,
            sellerName,
            status: getLocalizedText(o.status, "Ordered"),
            rawOrder: { ...o, sellerName },
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
                    title="Click to view full order details"
                  >
                    #{ordId}
                  </span>
                  <button
                    onClick={(e) => handleCopy(ordId, e)}
                    className="text-muted-foreground hover:text-foreground transition-all p-1"
                    title="Copy Order ID"
                  >
                    {copiedId === ordId ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
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
            render: (r) => {
              const raw = (r.sellerName || r.shopName || r.storeName || r.rawOrder?.sellerName || "").trim();
              const sellerName =
                raw && raw !== "—" && !raw.toLowerCase().includes("iherd marketplace")
                  ? raw
                  : "Chimertech";
              return (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-[120px]">
                  <Store className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-foreground font-semibold truncate">
                    {sellerName}
                  </span>
                </div>
              );
            },
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
                          {items.length > 1
                            ? `+${items.length - 1} more item(s)`
                            : `Qty: ${items[0].quantity || 1} × ₹${items[0].price}`}
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
                  {r.shippingFee > 0 ? (
                    <div className="text-[10px] text-muted-foreground">+ ₹{r.shippingFee} ship</div>
                  ) : (
                    <div className="text-[10px] text-emerald-600 font-medium">Free Delivery</div>
                  )}
                </div>
              );
            },
          },
          {
            key: "shippingTracking",
            label: "Shipping & Tracking",
            render: (r) => {
              const hasTracking = r.trackingId && r.trackingId !== "—" && r.trackingId.trim() !== "";
              const carrier = r.carrierName || r.courierPartner || "Courier";
              const statusStr = (r.status || "").toLowerCase();
              const isCancelled = statusStr === "cancelled" || statusStr === "canceled";
              const isDelivered = statusStr === "delivered" || statusStr === "completed";
              const isDispatched = statusStr === "shipped" || statusStr === "dispatched" || statusStr === "in transit" || statusStr === "out for delivery";

              if (isCancelled) {
                return (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground border-border bg-muted/40">
                    Cancelled / N/A
                  </Badge>
                );
              }

              if (hasTracking) {
                return (
                  <div className="space-y-0.5 min-w-[160px]">
                    <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                      <Truck className="h-3 w-3 text-primary" />
                      <span className="truncate">{carrier}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-foreground font-medium">
                        {r.trackingId}
                      </span>
                      {r.trackingUrl && (
                        <a
                          href={r.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline inline-flex items-center"
                          title="Open tracking page"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              }

              if (isDelivered) {
                return (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
                    Delivered
                  </Badge>
                );
              }

              if (isDispatched) {
                return (
                  <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/20">
                    In Transit
                  </Badge>
                );
              }

              return (
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                    Not Dispatched
                  </Badge>
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
            key: "status",
            label: "Status",
            render: (r) => <StatusBadge status={r.status || "Ordered"} />,
          },
          {
            key: "actions",
            label: "Actions",
            render: (r) => {
              const statusStr = (r.status || "").toLowerCase();
              const isCancelled = statusStr === "cancelled" || statusStr === "canceled";

              return (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs rounded-xl gap-1 px-2.5"
                    onClick={() => setSelectedOrder(r.rawOrder || r)}
                    title="View complete order details"
                  >
                    <Info className="h-3.5 w-3.5" /> Details
                  </Button>
                  <Button
                    size="sm"
                    variant={isCancelled ? "secondary" : "default"}
                    disabled={isCancelled}
                    className={`h-7 text-xs rounded-xl gap-1 px-2.5 shadow-sm ${
                      isCancelled
                        ? "opacity-40 cursor-not-allowed bg-muted text-muted-foreground"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                    onClick={(e) => !isCancelled && openTrackingDialog(r, e)}
                    title={isCancelled ? "Order was cancelled" : "Fill or edit shipping tracking details"}
                  >
                    <Truck className="h-3.5 w-3.5" /> Track / Ship
                  </Button>
                </div>
              );
            },
          },
        ]}
      />

      {/* ========================================================================= */}
      {/* 1. FULL ORDER DETAILS MODAL DIALOG                                        */}
      {/* ========================================================================= */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-7">
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  <DialogTitle className="text-xl font-bold tracking-tight">
                    Order #{selectedOrder?.orderId || selectedOrder?.id}
                  </DialogTitle>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span>Ordered: <strong>{formatDateTime(selectedOrder?.createdAt || selectedOrder?.date)}</strong></span>
                  {selectedOrder?.userId && (
                    <>
                      <span>•</span>
                      <Link
                        to={`/users/${selectedOrder.userId}` as any}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <User className="h-3 w-3" /> User: {selectedOrder.userId.slice(0, 10)}...
                      </Link>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedOrder && <StatusBadge status={selectedOrder.status || "Ordered"} />}
                <Button
                  size="sm"
                  onClick={() => openTrackingDialog(selectedOrder)}
                  className="h-8 rounded-xl gap-1.5 text-xs font-semibold bg-primary text-primary-foreground shadow-sm"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Update Shipping / Tracking
                </Button>
              </div>
            </div>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-5 mt-3">
              {/* Official Tax Invoice Download Banner */}
              {(selectedOrder.invoiceUrl || (selectedOrder.invoiceNumber && selectedOrder.invoiceNumber !== "—")) && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                    <div className="h-9 w-9 rounded-xl bg-emerald-500/20 grid place-items-center text-emerald-700 dark:text-emerald-300">
                      <FileCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">Official Tax Invoice</div>
                      <div className="text-[11px] font-mono opacity-85">
                        Invoice No: {selectedOrder.invoiceNumber || `INV-${selectedOrder.orderId || selectedOrder.id}`}
                      </div>
                    </div>
                  </div>
                  {selectedOrder.invoiceUrl ? (
                    <a
                      href={selectedOrder.invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition-all"
                    >
                      <Download className="h-4 w-4" /> Download Tax Invoice PDF
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground font-medium bg-background/60 px-3 py-1.5 rounded-xl border">
                      Invoice Generated
                    </span>
                  )}
                </div>
              )}

              {/* Delivery Address & Customer Information */}
              <div className="p-4 rounded-2xl bg-muted/20 border space-y-3 text-xs">
                <h4 className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> Delivery & Shipping Address
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {selectedOrder.buyerName || "Customer"}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground">{selectedOrder.buyerPhone || "—"}</span>
                      {selectedOrder.buyerPhone && (
                        <button
                          onClick={() => handleCopy(selectedOrder.buyerPhone)}
                          className="hover:text-foreground ml-1"
                          title="Copy phone"
                        >
                          <Copy className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-background border text-foreground leading-relaxed text-xs">
                    {selectedOrder.buyerAddress || selectedOrder.shippingAddress
                      ? typeof selectedOrder.shippingAddress === "object"
                        ? [
                            selectedOrder.shippingAddress.line1,
                            selectedOrder.shippingAddress.line2,
                            selectedOrder.shippingAddress.landmark && `Landmark: ${selectedOrder.shippingAddress.landmark}`,
                            selectedOrder.shippingAddress.district || selectedOrder.shippingAddress.city,
                            selectedOrder.shippingAddress.state,
                            selectedOrder.shippingAddress.pincode && `PIN: ${selectedOrder.shippingAddress.pincode}`,
                          ]
                            .filter(Boolean)
                            .join(", ")
                        : selectedOrder.buyerAddress
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Purchased Products List */}
              {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Purchased Items ({selectedOrder.items.length})</span>
                    <span className="text-[11px] font-normal text-muted-foreground">Itemized Bill</span>
                  </h4>
                  <div className="space-y-2 divide-y divide-border/40 rounded-2xl border bg-background p-4">
                    {selectedOrder.items.map((it: any, iIdx: number) => (
                      <div key={iIdx} className={`${iIdx > 0 ? "pt-3" : ""} flex items-center justify-between gap-3 text-xs`}>
                        <div className="flex items-center gap-3">
                          {it.image ? (
                            <img
                              src={formatImageUrl(it.image)}
                              alt={it.name}
                              className="h-12 w-12 rounded-xl object-cover ring-1 ring-border bg-background"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                          <div className="space-y-0.5">
                            <div className="font-bold text-foreground text-sm">{it.name}</div>
                            <div className="text-muted-foreground text-[11px]">
                              Price: <strong className="text-foreground">₹{it.price}</strong> × Qty:{" "}
                              <strong className="text-foreground">{it.quantity || 1}</strong>
                              {it.gstPercent ? ` (${it.gstPercent}% GST)` : ""}
                              {it.unit ? ` • ${it.unit}` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-foreground text-sm">
                            ₹{Number((it.price || 0) * (it.quantity || 1)).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total Billing & Price Breakdown */}
              <div className="p-4 rounded-2xl bg-muted/30 border space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Products Subtotal</span>
                  <span className="font-medium text-foreground">
                    ₹
                    {Number(
                      Array.isArray(selectedOrder.items)
                        ? selectedOrder.items.reduce(
                            (s: number, it: any) =>
                              s + Number(it.price || 0) * Number(it.quantity || 1),
                            0
                          )
                        : selectedOrder.totalAmount || 0
                    ).toLocaleString()}
                  </span>
                </div>
                {selectedOrder.shippingFee > 0 ? (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Delivery / Shipping Fee</span>
                    <span className="font-medium text-foreground">₹{selectedOrder.shippingFee}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-emerald-600 font-medium">
                    <span>Shipping Charges</span>
                    <span>Free Delivery</span>
                  </div>
                )}
                {selectedOrder.discount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 font-medium">
                    <span>Discount / Coupon Applied</span>
                    <span>-₹{selectedOrder.discount}</span>
                  </div>
                )}
                <div className="pt-2 border-t flex items-center justify-between font-black text-base text-foreground">
                  <span>Total Amount Paid / Payable</span>
                  <span className="text-primary text-lg">
                    ₹{Number(selectedOrder.totalAmount || selectedOrder.price || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex sm:justify-between gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setSelectedOrder(null)} className="rounded-xl text-xs">
              Close Window
            </Button>
            <Button
              onClick={() => openTrackingDialog(selectedOrder)}
              className="rounded-xl text-xs gap-1.5 bg-primary text-primary-foreground"
            >
              <Truck className="h-3.5 w-3.5" /> Fill / Update Shipping Tracking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 2. DEDICATED SHIPPING & TRACKING FILL FORM MODAL DIALOG                     */}
      {/* ========================================================================= */}
      <Dialog open={!!trackingOrder} onOpenChange={() => setTrackingOrder(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight">
                  Update Shipping & Tracking Details
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Order #{trackingOrder?.orderId || trackingOrder?.id} • Buyer: {trackingOrder?.buyerName || "Customer"}
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveTracking} className="space-y-4 mt-2">
            {/* Order Status Dropdown */}
            <div className="space-y-1.5">
              

              {/* Tracking / AWB Number */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  AWB / Tracking Number
                </Label>
                <Input
                  value={trackingId}
                  onChange={(e) => handleTrackingIdChange(e.target.value)}
                  placeholder="e.g. DL938472910IN"
                  className="rounded-xl h-10 text-xs font-mono"
                />
              </div>
            </div>

            

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTrackingOrder(null)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="rounded-xl text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving Details...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" /> Save Tracking Information
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
