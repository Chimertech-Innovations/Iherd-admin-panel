import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DataPage } from "@/components/admin/DataPage";
import { useQuery } from "@tanstack/react-query";
import { getLocalizedText } from "@/lib/utils";
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
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/payments")({
  head: () => ({ meta: [{ title: "Payments — iHerd Admin" }] }),
  component: PaymentsPage,
});

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://iherdadminpanel.onrender.com";

async function fetchPaymentsData() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/payments`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      payments: data.payments || [],
      summary: data.summary || {},
    };
  } catch (err) {
    console.warn("Error fetching payments from backend:", err);
    return { payments: [], summary: {} };
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

function PaymentsPage() {
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["adminPayments"],
    queryFn: fetchPaymentsData,
    placeholderData: { payments: [], summary: {} },
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

  const totalVolume = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const paidCount = payments.filter((p: any) => p.status === "Paid").length;
  const pendingCount = payments.filter((p: any) => p.status === "Pending").length;
  const failedCount = payments.filter((p: any) => p.status === "Failed").length;

  return (
    <div className="space-y-6">
      <DataPage<any>
        title="Payments & Transactions"
        description="Transactions, payouts, and customer settlements from Product and Cattle marketplace orders."
        primaryAction=""
        isLoading={isLoading}
        filters={["Paid", "Pending", "Failed"]}
        statusKey="status"
        kpis={[
          { label: "Total Gross Volume", value: isLoading ? "…" : `₹${totalVolume.toLocaleString()}` },
          { label: "Paid / Completed", value: isLoading ? "…" : `${paidCount} Completed` },
          { label: "Pending Escrow / Orders", value: isLoading ? "…" : `${pendingCount} Pending` },
          { label: "Failed / Cancelled", value: isLoading ? "…" : `${failedCount} Failed` },
        ]}
        data={payments.map((p: any) => ({
          ...p,
          status: getLocalizedText(p.status, "Paid"),
          rawTxn: p,
        }))}
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
            key: "party",
            label: "Party / Customer",
            render: (r: any) => {
              const uId = r.userId || r.rawTxn?.userId;
              return (
                <div className="space-y-0.5 min-w-[140px]">
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
            key: "type",
            label: "Type & Category",
            render: (r: any) => (
              <div className="space-y-0.5 min-w-[140px]">
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground">
                  {r.type?.includes("Cattle") ? <Beef className="h-3 w-3 text-primary" /> : <ShoppingCart className="h-3 w-3 text-primary" />}
                  <span>{r.type}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">{r.category || "Order Transaction"}</div>
              </div>
            ),
          },
          {
            key: "method",
            label: "Payment Method",
            render: (r: any) => (
              <div className="flex items-center gap-1 text-xs text-foreground min-w-[110px]">
                <CreditCard className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">{r.method || "UPI / Online"}</span>
              </div>
            ),
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
              {/* Header Box */}
              <div className="p-4 rounded-2xl bg-muted/30 border space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>Processed on: <strong className="text-foreground">{formatDateTime(selectedTxn.createdAt)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Receipt className="h-3.5 w-3.5 text-primary" />
                    <span>Source Order: <strong className="font-mono text-foreground">#{selectedTxn.orderId}</strong></span>
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
                  <div className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Payer / Customer</div>
                  <div className="font-semibold text-foreground text-sm">{selectedTxn.party}</div>
                  <div className="text-muted-foreground">Phone: {selectedTxn.partyPhone}</div>
                  <div className="text-muted-foreground">Method: {selectedTxn.method}</div>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border space-y-1">
                  <div className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Beneficiary / Seller</div>
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
                        <span className="text-muted-foreground shrink-0">{it.quantity || 1} × ₹{it.price}</span>
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
