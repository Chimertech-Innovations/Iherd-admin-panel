import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Coins,
  Save,
  CheckCircle2,
  AlertCircle,
  Beef,
  RefreshCw,
  Info,
  ShieldCheck,
  CreditCard,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useTokenAdvance, useFirebaseCollection } from "@/hooks/useFirebaseData";
import { getLocalizedText } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";

export const Route = createFileRoute("/token-advance")({
  head: () => ({ meta: [{ title: "Token Advance — iHerd Admin" }] }),
  component: TokenAdvancePage,
});

function TokenAdvancePage() {
  const { data, isLoading, refetch, updateRates } = useTokenAdvance();
  const { data: cattleOrders = [], isLoading: ordersLoading } = useFirebaseCollection<any>("CattleOrders");

  const [cowRate, setCowRate] = useState("200");
  const [buffaloRate, setBuffaloRate] = useState("250");
  const [goatRate, setGoatRate] = useState("100");
  const [sheepRate, setSheepRate] = useState("50");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data?.rates) {
      if (data.rates.cow !== undefined) setCowRate(String(data.rates.cow));
      if (data.rates.buffalo !== undefined) setBuffaloRate(String(data.rates.buffalo));
      if (data.rates.goat !== undefined) setGoatRate(String(data.rates.goat));
      if (data.rates.sheep !== undefined) setSheepRate(String(data.rates.sheep));
    }
  }, [data]);

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateRates.mutateAsync({
        cow: Number(cowRate) || 0,
        buffalo: Number(buffaloRate) || 0,
        goat: Number(goatRate) || 0,
        sheep: Number(sheepRate) || 0,
      });
      toast.success("Token advance rates updated successfully in Firestore!");
    } catch (err: any) {
      toast.error(`Failed to update token advance rates: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const advanceBookings = cattleOrders.filter(
    (o) => o.tokenAdvance || o.advancePaid || o.tokenPaid || o.tokenAmount
  );

  const handleExportAdvance = () => {
    const dataToExport = advanceBookings.length > 0 ? advanceBookings : cattleOrders;
    exportToCsv({
      filename: `iherd_token_advance_bookings_${new Date().toISOString().slice(0, 10)}`,
      data: dataToExport,
      columns: [
        { header: "Order ID", accessor: (o: any) => o.orderId || o.id },
        { header: "Cattle Tag / ID", accessor: (o: any) => o.cattleTag || o.tagNo || o.cattleId || "—" },
        { header: "Cattle Breed", accessor: (o: any) => getLocalizedText(o.breed || o.cattleBreed) },
        { header: "Buyer Name", accessor: (o: any) => o.buyerName || o.customerName || "—" },
        { header: "Buyer Phone", accessor: (o: any) => o.buyerPhone || o.customerPhone || "—" },
        { header: "Token Advance Paid (INR)", accessor: (o: any) => o.tokenAdvance || o.advancePaid || o.tokenPaid || o.tokenAmount || 0 },
        { header: "Total Price (INR)", accessor: (o: any) => o.totalAmount || o.price || 0 },
        { header: "Booking Date", accessor: (o: any) => o.createdAt ? new Date(o.createdAt).toLocaleString() : "—" },
        { header: "Status", accessor: (o: any) => getLocalizedText(o.status, "Reserved") },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Token advance configuration"
        description="Manage the non-refundable advance booking deposit required to lock cattle in the marketplace."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportAdvance}
              disabled={ordersLoading || advanceBookings.length === 0}
              className="gap-1.5"
              title={`Export ${advanceBookings.length} token advance bookings to CSV`}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        }
      />

      {/* Info Banner */}
      <Card className="p-4 rounded-2xl bg-primary/5 border-primary/20 text-sm flex items-start gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
          <Info className="h-4.5 w-4.5" />
        </div>
        <div className="space-y-1">
          <div className="font-semibold text-foreground">What is Token Advance?</div>
          <div className="text-muted-foreground text-xs leading-relaxed">
            When a buyer reserves a cattle listed on the iHerd marketplace, they pay a nominal token advance fee.
            These rates are retrieved directly by mobile apps from Firestore path <code>/token-advance/token-advance</code>.
          </div>
        </div>
      </Card>

      {/* Current Rates Configuration Card */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 rounded-2xl border-border">
          <div className="flex items-center justify-between pb-4 border-b">
            <div>
              <h3 className="font-semibold text-base">Cattle Species Booking Rates</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set the default token advance fee in Indian Rupees (₹) for each species category.
              </p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Coins className="h-5 w-5" />
            </div>
          </div>

          <form onSubmit={handleSaveRates} className="pt-6 space-y-6">
            <div className="grid sm:grid-cols-2 gap-5">
              {/* Cow */}
              <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <Beef className="h-4 w-4 text-primary" /> Cow (गाय)
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">cow</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground text-sm">₹</span>
                  <Input
                    type="number"
                    value={cowRate}
                    onChange={(e) => setCowRate(e.target.value)}
                    className="pl-8 font-bold text-base"
                    placeholder="200"
                    required
                  />
                </div>
              </div>

              {/* Buffalo */}
              <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <Beef className="h-4 w-4 text-indigo-600" /> Buffalo (भैंस)
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">buffalo</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground text-sm">₹</span>
                  <Input
                    type="number"
                    value={buffaloRate}
                    onChange={(e) => setBuffaloRate(e.target.value)}
                    className="pl-8 font-bold text-base"
                    placeholder="250"
                    required
                  />
                </div>
              </div>

              {/* Goat */}
              <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <Coins className="h-4 w-4 text-emerald-600" /> Goat (बकरी)
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">goat</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground text-sm">₹</span>
                  <Input
                    type="number"
                    value={goatRate}
                    onChange={(e) => setGoatRate(e.target.value)}
                    className="pl-8 font-bold text-base"
                    placeholder="100"
                    required
                  />
                </div>
              </div>

              {/* Sheep */}
              <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-600" /> Sheep (भेड़)
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">sheep</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground text-sm">₹</span>
                  <Input
                    type="number"
                    value={sheepRate}
                    onChange={(e) => setSheepRate(e.target.value)}
                    className="pl-8 font-bold text-base"
                    placeholder="50"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Synced directly with Firebase Firestore <code>token-advance</code></span>
              </div>
              <Button
                type="submit"
                disabled={isSaving}
                className="gap-2 bg-gradient-to-br from-primary to-primary-glow font-medium"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? "Saving..." : "Save advance rates"}
              </Button>
            </div>
          </form>
        </Card>

        {/* Live Overview & Stats Card */}
        <div className="space-y-4">
          <Card className="p-5 rounded-2xl border-border bg-card">
            <h4 className="font-semibold text-sm mb-3">Live Active Rates</h4>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-sm p-2 rounded-lg bg-muted/40">
                <span className="text-muted-foreground">Buffalo</span>
                <span className="font-bold text-foreground">₹{data?.rates?.buffalo ?? buffaloRate}</span>
              </div>
              <div className="flex justify-between items-center text-sm p-2 rounded-lg bg-muted/40">
                <span className="text-muted-foreground">Cow</span>
                <span className="font-bold text-foreground">₹{data?.rates?.cow ?? cowRate}</span>
              </div>
              <div className="flex justify-between items-center text-sm p-2 rounded-lg bg-muted/40">
                <span className="text-muted-foreground">Goat</span>
                <span className="font-bold text-foreground">₹{data?.rates?.goat ?? goatRate}</span>
              </div>
              <div className="flex justify-between items-center text-sm p-2 rounded-lg bg-muted/40">
                <span className="text-muted-foreground">Sheep</span>
                <span className="font-bold text-foreground">₹{data?.rates?.sheep ?? sheepRate}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 rounded-2xl border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Cattle Orders</div>
                <div className="text-xl font-bold">{ordersLoading ? "…" : cattleOrders.length}</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              Advance deposits guarantee buyer commitment and reduce seller cancellations.
            </div>
          </Card>
        </div>
      </div>

      {/* Cattle Orders with Advance Table */}
      <Card className="rounded-2xl overflow-hidden border-border">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-base">Recent Cattle Advance Bookings</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bookings recorded in <code>CattleOrders</code> with advance payment transactions.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Order / Booking ID</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Cattle Type</TableHead>
                <TableHead>Token Advance Paid</TableHead>
                <TableHead>Total Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="py-4 text-center">
                      <div className="h-4 bg-muted rounded animate-pulse w-3/4 mx-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : cattleOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No cattle orders found yet.
                  </TableCell>
                </TableRow>
              ) : (
                cattleOrders.slice(0, 10).map((o) => {
                  const tokenAmt = o.tokenAdvance || o.advancePaid || o.tokenAmount || o.tokenPaid || 200;
                  const cattleType = getLocalizedText(o.breed || o.cattleType || o.species || o.category || o.title, "Cattle");
                  const buyerName = getLocalizedText(o.userName || o.buyerName || o.userId, "—");
                  const statusStr = getLocalizedText(o.status, "Booked");
                  const amtStr = typeof tokenAmt === "number" ? `₹${tokenAmt}` : String(tokenAmt).startsWith("₹") ? tokenAmt : `₹${getLocalizedText(tokenAmt)}`;

                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{getLocalizedText(o.id)}</TableCell>
                      <TableCell>{buyerName}</TableCell>
                      <TableCell>
                        <span className="font-medium">{cattleType}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-emerald-600">{amtStr}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {o.totalAmount ? `₹${Number(o.totalAmount).toLocaleString()}` : o.price ? `₹${Number(o.price).toLocaleString()}` : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {statusStr}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleDateString() : getLocalizedText(o.createdAt, "—")}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
