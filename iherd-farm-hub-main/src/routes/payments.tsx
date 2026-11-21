import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { DataPage } from "@/components/admin/DataPage";
import { useQuery } from "@tanstack/react-query";
import { getLocalizedText, formatImageUrl } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  FileText,
  ExternalLink,
  Download,
  Clock,
  MapPin,
  Phone,
  Store,
  Copy,
  Check,
  Info,
  Receipt,
  FileCheck,
  TrendingUp,
  Beef,
  ShoppingCart,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const Route = createFileRoute("/payments")({
  head: () => ({ meta: [{ title: "Payments — iHerd Admin" }] }),
  component: PaymentsPage,
});

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://iherdadminpanel.onrender.com";

const DEFAULT_CATTLE_IMAGE =
  "https://images.unsplash.com/photo-1546445317-29f4545e9d53?auto=format&fit=crop&w=300&q=80";

async function fetchPaymentsData() {
  // 1. Try Backend API first (with 6s safe timeout)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${API_BASE}/api/admin/payments`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.payments) && data.payments.length > 0) {
        return {
          payments: data.payments,
          summary: data.summary || {},
        };
      }
    }
  } catch (err) {
    console.warn("Backend payments notice, switching to direct Firestore fallback:", err);
  }

  // 2. Direct Firestore fallback (aggregates ProductOrders & CattleOrders on client)
  try {
    const [pSnap, cSnap] = await Promise.all([
      getDocs(collection(db, "ProductOrders")).catch(() => null),
      getDocs(collection(db, "CattleOrders")).catch(() => null),
    ]);

    const fallbackTxns: any[] = [];
    pSnap?.docs?.forEach((d) => {
      const o = d.data();
      const orderKey = o.orderId || d.id;
      const txnId = `TXN-PRD-${orderKey}`;
      const items = Array.isArray(o.items) ? o.items : [];
      const prodImg =
        items[0]?.image ||
        items[0]?.thumbnailUrl ||
        o.thumbnailUrl ||
        (Array.isArray(o.imageUrls) ? o.imageUrls[0] : null) ||
        (Array.isArray(o.images) ? o.images[0] : null) ||
        o.image ||
        "";
      const prodTitle =
        items[0]?.name ||
        items[0]?.title ||
        o.productName ||
        o.name ||
        (items.length > 0 ? `${items.length} Product Items` : "Marketplace Product");

      fallbackTxns.push({
        id: txnId,
        transactionId: txnId,
        orderId: orderKey,
        userId: o.userId || null,
        party: o.buyerName || o.shippingAddress?.name || "Customer",
        partyPhone: o.buyerPhone || o.shippingAddress?.phone || "—",
        type: "Product Purchase",
        category: "E-Commerce Store",
        title: prodTitle,
        image: prodImg,
        method: o.paymentMethod || "UPI / Online Payment",
        amount: Number(o.totalAmount || o.price || o.amount || 0),
        seller: o.sellerName || "Chimertech",
        itemsCount: items.length || 1,
        items,
        status: (o.status || "").toLowerCase().includes("cancel") ? "Failed" : "Paid",
        invoiceNumber: o.invoiceNumber || o.invoiceNo || (orderKey ? `INV-${orderKey.slice(-8)}` : "—"),
        createdAt: o.createdAt || o.date || null,
      });
    });

    cSnap?.docs?.forEach((d) => {
      const o = d.data();
      const orderKey = o.orderId || o.cattleOrderId || d.id;
      const txnId = `TXN-CTL-${orderKey}`;
      const cattleImg =
        o.cattleImage ||
        o.image ||
        (Array.isArray(o.cattlePhotos) ? o.cattlePhotos[0] : null) ||
        (Array.isArray(o.photos) ? o.photos[0] : null) ||
        (Array.isArray(o.images) ? o.images[0] : null) ||
        "";
      const cattleTitle =
        o.cattleName || o.name || o.title || o.breed || o.animal || "Livestock Cattle";

      fallbackTxns.push({
        id: txnId,
        transactionId: txnId,
        orderId: orderKey,
        userId: o.userId || null,
        party: o.buyerName || "Buyer",
        partyPhone: o.buyerPhone || o.phoneNumber || "—",
        type: "Livestock Cattle Purchase",
        category: "Livestock Herd",
        title: cattleTitle,
        image: cattleImg,
        method: o.paymentMethod || "Escrow / Online",
        amount: Number(o.price || o.totalAmount || o.amount || 0),
        seller: o.sellerName || "Verified Seller",
        itemsCount: 1,
        status: (o.status || "").toLowerCase().includes("cancel") ? "Failed" : "Paid",
        invoiceNumber: o.invoiceNumber || o.invoiceNo || "—",
        createdAt: o.createdAt || o.date || null,
      });
    });

    if (fallbackTxns.length > 0) {
      fallbackTxns.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return {
        payments: fallbackTxns,
        summary: {
          totalTransactions: fallbackTxns.length,
          totalVolume: fallbackTxns.reduce((sum, t) => sum + t.amount, 0),
          paidCount: fallbackTxns.filter((t) => t.status === "Paid").length,
          pendingCount: fallbackTxns.filter((t) => t.status === "Pending").length,
          failedCount: fallbackTxns.filter((t) => t.status === "Failed").length,
        },
      };
    }
  } catch (fbErr) {
    console.warn("Direct Firestore fallback error in payments:", fbErr);
  }

  return { payments: [], summary: {} };
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

function PaymentsPage() {
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["adminPayments"],
    queryFn: fetchPaymentsData,
    staleTime: 15_000,
  });

  const payments = data?.payments || [];

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("Transaction ID copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isCattleTxn = (p: any) => {
    const t = (p.type || p.category || "").toLowerCase();
    return t.includes("cattle") || t.includes("livestock");
  };

  // Prepare enriched payments: map itemType to "Product" or "Cattle" for the filter
  const enrichedPayments = useMemo(() => {
    return payments.map((p: any) => {
      const isCattle = isCattleTxn(p);
      const itemType = isCattle ? "Cattle" : "Product";
      const title =
        p.title ||
        (isCattle
          ? p.cattleName || p.name || "Livestock Cattle"
          : p.items?.[0]?.name || p.productName || "Product Item");
      const rawImg = p.image || (isCattle ? p.cattleImage : p.items?.[0]?.image) || "";
      const image = rawImg || (isCattle ? DEFAULT_CATTLE_IMAGE : "");

      return {
        ...p,
        itemType, // Target key for the "Product" vs "Cattle" filter
        title,
        image,
        status: getLocalizedText(p.status, "Paid"),
        rawTxn: { ...p, itemType, title, image },
      };
    });
  }, [payments]);

  return (
    <div className="space-y-6">
      <DataPage<any>
        title="Payments & Transactions"
        description="Transactions, payouts, and customer settlements from Product and Cattle marketplace orders."
        primaryAction=""
        isLoading={isLoading}
        filters={["Product", "Cattle"]}
        statusKey="itemType"
        statusOptions={["Product", "Cattle"]}
        kpis={(filtered, activeFilter, allData) => {
          const isProduct = activeFilter.toLowerCase() === "product";
          const isCattle = activeFilter.toLowerCase() === "cattle";
          const currentVolume = filtered.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
          const currentPaid = filtered.filter((p: any) => (p.status || "").toLowerCase().includes("paid")).length;
          const currentPending = filtered.length - currentPaid;

          if (isProduct) {
            return [
              {
                label: "Product Gross Volume",
                value: isLoading ? "…" : `₹${currentVolume.toLocaleString()}`,
                hint: `Total sales for ${filtered.length} Product orders`,
                up: true,
              },
              {
                label: "Product Orders",
                value: isLoading ? "…" : `${filtered.length} Orders`,
                hint: "Filtered by Product category",
                up: true,
              },
              {
                label: "Settled Payments",
                value: isLoading ? "…" : `${currentPaid} Paid`,
                hint: "Completed settlements",
                up: true,
              },
              {
                label: "Pending / Processing",
                value: isLoading ? "…" : `${currentPending} Orders`,
                hint: "Pending or unpaid",
              },
            ];
          }

          if (isCattle) {
            return [
              {
                label: "Cattle Gross Volume",
                value: isLoading ? "…" : `₹${currentVolume.toLocaleString()}`,
                hint: `Total livestock value for ${filtered.length} Cattle orders`,
                up: true,
              },
              {
                label: "Cattle Orders",
                value: isLoading ? "…" : `${filtered.length} Orders`,
                hint: "Filtered by Cattle orders",
                up: true,
              },
              {
                label: "Settled Payments",
                value: isLoading ? "…" : `${currentPaid} Paid`,
                hint: "Completed settlements",
                up: true,
              },
              {
                label: "Pending / Processing",
                value: isLoading ? "…" : `${currentPending} Orders`,
                hint: "Pending or unpaid",
              },
            ];
          }

          const totalAllVolume = allData.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
          const prodList = allData.filter((p: any) => p.itemType === "Product");
          const prodVol = prodList.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
          const ctlList = allData.filter((p: any) => p.itemType === "Cattle");
          const ctlVol = ctlList.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
          const totalPaid = allData.filter((p: any) => (p.status || "").toLowerCase().includes("paid")).length;

          return [
            {
              label: "Total Gross Volume",
              value: isLoading ? "…" : `₹${totalAllVolume.toLocaleString()}`,
              hint: `₹${prodVol.toLocaleString()} Products · ₹${ctlVol.toLocaleString()} Cattle`,
              up: true,
            },
            {
              label: "Product Orders",
              value: isLoading ? "…" : `${prodList.length} Orders`,
              hint: `₹${prodVol.toLocaleString()} Product volume`,
              up: true,
            },
            {
              label: "Cattle Orders",
              value: isLoading ? "…" : `${ctlList.length} Orders`,
              hint: `₹${ctlVol.toLocaleString()} Cattle volume`,
              up: true,
            },
            {
              label: "Completed Settlements",
              value: isLoading ? "…" : `${totalPaid} Paid`,
              hint: "All settled orders",
              up: true,
            },
          ];
        }}
        data={enrichedPayments}
        columns={[
          {
            key: "id",
            label: "Transaction ID",
            render: (r: any) => {
              const txnId = r.id || r.transactionId;
              return (
                <div className="flex items-center gap-1.5">
                  <span
                    className="font-mono text-xs font-bold text-foreground bg-primary/10 text-primary px-2.5 py-1 rounded-lg cursor-pointer hover:bg-primary/20 transition-all truncate max-w-[170px]"
                    onClick={() => setSelectedTxn(r.rawTxn || r)}
                    title={txnId}
                  >
                    #{txnId}
                  </span>
                  <button
                    onClick={(e) => handleCopy(txnId, e)}
                    className="text-muted-foreground hover:text-foreground transition-all p-1"
                    title="Copy Transaction ID"
                  >
                    {copiedId === txnId ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              );
            },
          },
          {
            key: "item",
            label: "Product / Cattle Item",
            render: (r: any) => {
              const isCattle = r.itemType === "Cattle";
              const imgUrl = r.image ? formatImageUrl(r.image) : "";
              return (
                <div className="flex items-center gap-2.5 min-w-[200px]">
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={r.title || "Item"}
                      className="h-10 w-10 rounded-xl object-cover ring-1 ring-border shrink-0 bg-background shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setSelectedTxn(r.rawTxn || r)}
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                      {isCattle ? <Beef className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div
                      className="font-semibold text-xs text-foreground truncate max-w-[160px] cursor-pointer hover:text-primary transition-colors"
                      onClick={() => setSelectedTxn(r.rawTxn || r)}
                    >
                      {r.title || (isCattle ? "Livestock Cattle" : "Product Item")}
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                      <span
                        className={`px-1.5 py-0.2 rounded font-semibold ${
                          isCattle
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {r.itemType}
                      </span>
                      <span className="truncate max-w-[100px]">• {r.seller || "Verified Seller"}</span>
                    </div>
                  </div>
                </div>
              );
            },
          },
          {
            key: "party",
            label: "Party / Customer",
            render: (r: any) => {
              const uId = r.userId || r.rawTxn?.userId;
              return (
                <div className="space-y-0.5 min-w-[130px]">
                  {uId ? (
                    <Link
                      to={`/users/${uId}` as any}
                      className="font-semibold text-xs text-primary hover:underline block truncate"
                    >
                      {r.party || "Customer"}
                    </Link>
                  ) : (
                    <span className="font-semibold text-xs text-foreground block truncate">
                      {r.party || "Customer"}
                    </span>
                  )}
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    <span>{r.partyPhone || "—"}</span>
                  </div>
                </div>
              );
            },
          },
          {
            key: "amount",
            label: "Amount",
            render: (r: any) => (
              <div className="font-bold text-sm text-primary">₹{Number(r.amount || 0).toLocaleString()}</div>
            ),
          },
          {
            key: "date",
            label: "Date & Time",
            render: (r: any) => (
              <div className="space-y-0.5 text-xs min-w-[120px]">
                <div className="font-medium text-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>{formatDateTime(r.createdAt)}</span>
                </div>
              </div>
            ),
          },
          {
            key: "invoice",
            label: "Invoice",
            render: (r: any) => {
              if (r.invoiceUrl) {
                return (
                  <a
                    href={r.invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-success text-success-foreground text-[11px] font-bold shadow-sm hover:opacity-90 transition-all"
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
            render: (r: any) => <StatusBadge status={r.status || "Paid"} />,
          },
          {
            key: "actions",
            label: "Action",
            render: (r: any) => (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs rounded-xl gap-1 px-2.5"
                onClick={() => setSelectedTxn(r.rawTxn || r)}
              >
                <Info className="h-3.5 w-3.5" /> Details
              </Button>
            ),
          },
        ]}
      />

      {/* Transaction & Settlement Details Modal */}
      <Dialog open={!!selectedTxn} onOpenChange={() => setSelectedTxn(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 text-lg">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                <span>Transaction #{selectedTxn?.id}</span>
              </div>
              {selectedTxn && <StatusBadge status={selectedTxn.status || "Paid"} />}
            </DialogTitle>
          </DialogHeader>

          {selectedTxn && (
            <div className="space-y-5 mt-2">
              {/* Product / Cattle Item Banner with Image */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border flex items-center gap-3">
                {selectedTxn.image ? (
                  <img
                    src={formatImageUrl(selectedTxn.image)}
                    alt={selectedTxn.title || "Item"}
                    className="h-14 w-14 rounded-2xl object-cover ring-1 ring-border shrink-0 bg-background shadow-xs"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
                    {selectedTxn.itemType === "Cattle" ? (
                      <Beef className="h-7 w-7" />
                    ) : (
                      <Package className="h-7 w-7" />
                    )}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-foreground truncate">
                    {selectedTxn.title || (selectedTxn.itemType === "Cattle" ? "Livestock Cattle" : "Product Item")}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${
                        selectedTxn.itemType === "Cattle"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {selectedTxn.itemType}
                    </span>
                    <span>{selectedTxn.category}</span>
                  </div>
                </div>
              </div>

              {/* Header Box */}
              <div className="p-4 rounded-2xl bg-muted/30 border space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>
                      Processed on:{" "}
                      <strong className="text-foreground">{formatDateTime(selectedTxn.createdAt)}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Receipt className="h-3.5 w-3.5 text-primary" />
                    <span>
                      Source Order:{" "}
                      <strong className="font-mono text-foreground">#{selectedTxn.orderId}</strong>
                    </span>
                  </div>
                </div>

                {selectedTxn.invoiceUrl && (
                  <div className="pt-2 border-t flex items-center justify-between gap-2">
                    <span className="text-xs text-success font-semibold flex items-center gap-1">
                      <FileCheck className="h-4 w-4" /> Tax Invoice PDF Ready
                    </span>
                    <a
                      href={selectedTxn.invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-success text-success-foreground text-xs font-bold shadow hover:opacity-90"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Invoice PDF
                    </a>
                  </div>
                )}
              </div>

              {/* Amount Box */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between font-black text-base text-foreground">
                <span>Total Payment Amount</span>
                <span className="text-primary text-xl">₹{Number(selectedTxn.amount || 0).toLocaleString()}</span>
              </div>

              {/* Parties Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-muted/20 border space-y-1">
                  <div className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    Payer / Customer
                  </div>
                  <div className="font-semibold text-foreground text-sm">{selectedTxn.party}</div>
                  <div className="text-muted-foreground">Phone: {selectedTxn.partyPhone}</div>
                  {selectedTxn.method && (
                    <div className="text-muted-foreground">Method: {selectedTxn.method}</div>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border space-y-1">
                  <div className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    Beneficiary / Seller
                  </div>
                  <div className="font-semibold text-foreground text-sm">{selectedTxn.seller}</div>
                  <div className="text-muted-foreground">Type: {selectedTxn.type}</div>
                  <div className="text-muted-foreground">Category: {selectedTxn.category}</div>
                </div>
              </div>

              {/* Itemized summary for product order transactions */}
              {Array.isArray(selectedTxn.items) && selectedTxn.items.length > 0 && (
                <div className="space-y-2 text-xs">
                  <h4 className="font-bold uppercase tracking-wider text-muted-foreground">
                    Included Items ({selectedTxn.items.length})
                  </h4>
                  <div className="space-y-1.5 divide-y divide-border/40">
                    {selectedTxn.items.map((it: any, iIdx: number) => (
                      <div key={iIdx} className="pt-1.5 flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground truncate">{it.name}</span>
                        <span className="text-muted-foreground shrink-0">
                          {it.quantity || 1} × ₹{it.price}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

