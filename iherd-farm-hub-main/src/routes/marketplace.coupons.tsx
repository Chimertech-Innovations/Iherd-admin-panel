import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Ticket,
  Plus,
  Search,
  Percent,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Calendar,
  Layers,
  Trash2,
  Power,
  Package,
  Filter,
  CheckSquare,
  Square,
  ShoppingBag,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useCoupons, useAdminProducts, type Coupon } from "@/hooks/useFirebaseData";
import { getLocalizedText, formatImageUrl } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";

export const Route = createFileRoute("/marketplace/coupons")({
  head: () => ({ meta: [{ title: "Coupon Codes — iHerd Admin" }] }),
  component: CouponsPage,
});

function CouponsPage() {
  const { data: coupons = [], isLoading: couponsLoading, saveCoupon, toggleCouponStatus, deleteCoupon } = useCoupons();
  const { data: products = [], isLoading: productsLoading } = useAdminProducts();

  const isLoading = couponsLoading || productsLoading;

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Create / Edit modal state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState("10");
  const [minOrder, setMinOrder] = useState("0");
  const [maxDiscount, setMaxDiscount] = useState("1000");
  const [expiryDate, setExpiryDate] = useState("");
  const [active, setActive] = useState(true);
  const [trackUserIds, setTrackUserIds] = useState(false);

  // Product Applicability State
  const [applicabilityMode, setApplicabilityMode] = useState<"ALL" | "INCLUDED" | "EXCLUDED">("ALL");
  const [includedProductIds, setIncludedProductIds] = useState<string[]>([]);
  const [excludedProductIds, setExcludedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const handleCopy = (couponCode: string) => {
    navigator.clipboard.writeText(couponCode);
    setCopiedCode(couponCode);
    toast.success(`Coupon code ${couponCode} copied to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const openCreateDialog = () => {
    setEditingCoupon(null);
    setCode("");
    setDiscountType("PERCENT");
    setValue("10");
    setMinOrder("0");
    setMaxDiscount("1000");
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setExpiryDate(d.toISOString().slice(0, 10));
    setActive(true);
    setTrackUserIds(false);
    setApplicabilityMode("ALL");
    setIncludedProductIds([]);
    setExcludedProductIds([]);
    setProductSearch("");
    setDialogOpen(true);
  };

  const openEditDialog = (c: Coupon) => {
    setEditingCoupon(c);
    setCode(c.code || c.id);
    setDiscountType(c.type?.toUpperCase() === "FIXED" ? "FIXED" : "PERCENT");
    setValue(String(c.value || 0));
    setMinOrder(String(c.minOrder || 0));
    setMaxDiscount(String(c.maxDiscount || 0));
    const exp = c.expiresAtFormatted ? c.expiresAtFormatted.slice(0, 10) : "";
    setExpiryDate(exp);
    setActive(c.active !== false);
    setTrackUserIds(Array.isArray(c.usedUserIds));

    if (Array.isArray(c.productIds) && c.productIds.length > 0) {
      setApplicabilityMode("INCLUDED");
      setIncludedProductIds(c.productIds);
      setExcludedProductIds([]);
    } else if (Array.isArray(c.excludedProductIds) && c.excludedProductIds.length > 0) {
      setApplicabilityMode("EXCLUDED");
      setExcludedProductIds(c.excludedProductIds);
      setIncludedProductIds([]);
    } else {
      setApplicabilityMode("ALL");
      setIncludedProductIds([]);
      setExcludedProductIds([]);
    }
    setProductSearch("");
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Please provide a valid coupon code");
      return;
    }

    try {
      const couponPayload: any = {
        code: code.trim().toUpperCase(),
        type: discountType,
        value: Number(value) || 0,
        minOrder: Number(minOrder) || 0,
        maxDiscount: Number(maxDiscount) || 0,
        active: active,
        expiresAt: expiryDate ? new Date(expiryDate).toISOString() : null,
        productIds: applicabilityMode === "INCLUDED" ? includedProductIds : [],
        excludedProductIds: applicabilityMode === "EXCLUDED" ? excludedProductIds : [],
        allowedFlow: "PRODUCT",
      };

      if (trackUserIds) {
        couponPayload.usedUserIds = editingCoupon?.usedUserIds && Array.isArray(editingCoupon.usedUserIds)
          ? editingCoupon.usedUserIds
          : [];
        couponPayload.includeUsedUserIds = true;
      }

      await saveCoupon.mutateAsync(couponPayload);

      toast.success(editingCoupon ? "Coupon updated successfully" : "Coupon created successfully");
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(`Error saving coupon: ${err.message}`);
    }
  };

  const handleToggle = async (c: Coupon) => {
    try {
      await toggleCouponStatus.mutateAsync({ id: c.id, active: !c.active });
      toast.success(`Coupon ${c.code} is now ${!c.active ? "Active" : "Inactive"}`);
    } catch (err: any) {
      toast.error(`Failed to toggle coupon status: ${err.message}`);
    }
  };

  const handleDelete = async (c: Coupon) => {
    if (!confirm(`Are you sure you want to delete coupon ${c.code}?`)) return;
    try {
      await deleteCoupon.mutateAsync(c.id);
      toast.success(`Coupon ${c.code} deleted`);
    } catch (err: any) {
      toast.error(`Failed to delete coupon: ${err.message}`);
    }
  };

  // Filtered products for applicability selector inside dialog
  const filteredProductsList = useMemo(() => {
    if (!productSearch.trim()) return products;
    const s = productSearch.toLowerCase();
    return products.filter((p: any) => {
      const pName = getLocalizedText(p.name || p.title, "").toLowerCase();
      const pId = (p.id || "").toLowerCase();
      return pName.includes(s) || pId.includes(s);
    });
  }, [products, productSearch]);

  const toggleProductSelection = (pId: string) => {
    if (applicabilityMode === "INCLUDED") {
      setIncludedProductIds((prev) =>
        prev.includes(pId) ? prev.filter((id) => id !== pId) : [...prev, pId]
      );
    } else if (applicabilityMode === "EXCLUDED") {
      setExcludedProductIds((prev) =>
        prev.includes(pId) ? prev.filter((id) => id !== pId) : [...prev, pId]
      );
    }
  };

  const selectAllFiltered = () => {
    const ids = filteredProductsList.map((p) => p.id);
    if (applicabilityMode === "INCLUDED") {
      setIncludedProductIds((prev) => Array.from(new Set([...prev, ...ids])));
    } else if (applicabilityMode === "EXCLUDED") {
      setExcludedProductIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const clearSelection = () => {
    if (applicabilityMode === "INCLUDED") setIncludedProductIds([]);
    else if (applicabilityMode === "EXCLUDED") setExcludedProductIds([]);
  };

  // KPIs
  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter((c) => c.active !== false).length;
  const percentCoupons = coupons.filter((c) => (c.type || "PERCENT").toUpperCase() === "PERCENT").length;

  const filteredCoupons = coupons.filter((c) => {
    const codeMatch = (c.code || c.id || "").toLowerCase().includes(q.toLowerCase());
    const matchStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
        ? c.active !== false
        : c.active === false;
    const matchType =
      typeFilter === "all"
        ? true
        : (c.type || "PERCENT").toUpperCase() === typeFilter.toUpperCase();
    return codeMatch && matchStatus && matchType;
  });

  const handleExportCoupons = () => {
    const dataToExport = filteredCoupons.length > 0 ? filteredCoupons : coupons;
    exportToCsv({
      filename: `iherd_coupons_${new Date().toISOString().slice(0, 10)}`,
      data: dataToExport,
      columns: [
        { header: "Coupon Code", accessor: (c: any) => c.code },
        { header: "Discount Type", accessor: (c: any) => c.type || "PERCENT" },
        { header: "Discount Value", accessor: (c: any) => `${c.value}${c.type === "FIXED" ? " INR" : "%"}` },
        { header: "Min Order Amount (INR)", accessor: (c: any) => c.minOrder || 0 },
        { header: "Max Discount (INR)", accessor: (c: any) => c.maxDiscount || "No limit" },
        { header: "Expiry Date", accessor: (c: any) => c.expiryDate || "No expiry" },
        { header: "Single Use Per User", accessor: (c: any) => c.trackUserIds ? "Yes" : "No" },
        { header: "Status", accessor: (c: any) => c.active !== false ? "Active" : "Inactive" },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupon codes & discounts"
        description="Manage marketplace promotional coupons, discount rules, included/excluded product restrictions, and customer usage limits."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCoupons}
              disabled={isLoading || coupons.length === 0}
              className="gap-1.5"
              title={`Export ${filteredCoupons.length} coupons to CSV`}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button
              size="sm"
              onClick={openCreateDialog}
              className="gap-1.5 bg-gradient-to-br from-primary to-primary-glow font-medium shadow-sm"
            >
              <Plus className="h-4 w-4" /> Create coupon
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-2xl bg-card border-border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Total Coupons</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <Ticket className="h-4 w-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="h-8 w-16 bg-muted/70 rounded-lg mt-2 animate-pulse" />
          ) : (
            <div className="mt-2 text-2xl font-bold">{totalCoupons}</div>
          )}
          <div className="text-xs text-muted-foreground mt-1">Configured codes</div>
        </Card>

        <Card className="p-4 rounded-2xl bg-card border-border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Active Coupons</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="h-8 w-16 bg-muted/70 rounded-lg mt-2 animate-pulse" />
          ) : (
            <div className="mt-2 text-2xl font-bold text-emerald-600">{activeCoupons}</div>
          )}
          <div className="text-xs text-muted-foreground mt-1">Available for redemption</div>
        </Card>

        <Card className="p-4 rounded-2xl bg-card border-border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Marketplace Catalog</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <Package className="h-4 w-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="h-8 w-16 bg-muted/70 rounded-lg mt-2 animate-pulse" />
          ) : (
            <div className="mt-2 text-2xl font-bold">{products.length} Products</div>
          )}
          <div className="text-xs text-muted-foreground mt-1">Ready for discount inclusion</div>
        </Card>

        <Card className="p-4 rounded-2xl bg-card border-border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Discount Breakdown</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="h-8 w-24 bg-muted/70 rounded-lg mt-2 animate-pulse" />
          ) : (
            <div className="mt-2 text-2xl font-bold">{`${percentCoupons} % / ${totalCoupons - percentCoupons} Flat`}</div>
          )}
          <div className="text-xs text-muted-foreground mt-1">Discount structure</div>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="rounded-2xl overflow-hidden border-border relative">
        {/* Animated Progress Bar */}
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary/20 overflow-hidden z-20">
            <div className="h-full bg-primary animate-pulse w-full" />
          </div>
        )}

        <div className="p-4 border-b flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search coupon codes..."
              className="pl-9 bg-muted/50 border-transparent focus-visible:bg-background"
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}>
              <SelectTrigger className="w-36 bg-muted/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter} disabled={isLoading}>
              <SelectTrigger className="w-36 bg-muted/50">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="PERCENT">Percentage (%)</SelectItem>
                <SelectItem value="FIXED">Flat (₹)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-48">Coupon Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Product Scope</TableHead>
                <TableHead>Min. Order</TableHead>
                <TableHead>Max. Cap</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell><div className="h-6 w-28 bg-muted/70 rounded-md animate-pulse" /></TableCell>
                    <TableCell><div className="h-5 w-16 bg-muted/60 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-5 w-24 bg-muted/50 rounded-full animate-pulse" /></TableCell>
                    <TableCell><div className="h-5 w-16 bg-muted/50 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-5 w-14 bg-muted/50 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-5 w-20 bg-muted/50 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-5 w-16 bg-muted/60 rounded-full animate-pulse" /></TableCell>
                    <TableCell className="text-right"><div className="h-8 w-20 bg-muted/60 rounded-lg ml-auto animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : filteredCoupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    <Ticket className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    No coupon codes match your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCoupons.map((c) => {
                  const isPercent = (c.type || "PERCENT").toUpperCase() === "PERCENT";
                  const isCopied = copiedCode === c.code;

                  const hasIncluded = Array.isArray(c.productIds) && c.productIds.length > 0;
                  const hasExcluded = Array.isArray(c.excludedProductIds) && c.excludedProductIds.length > 0;

                  return (
                    <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="font-mono font-bold text-sm bg-primary/10 text-primary px-2.5 py-1 rounded-lg border border-primary/20 flex items-center gap-1.5">
                            <Ticket className="h-3.5 w-3.5" />
                            {c.code || c.id}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(c.code || c.id)}
                            className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                            title="Copy code"
                          >
                            {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="font-semibold text-foreground">
                          {isPercent ? `${c.value}% OFF` : `₹${c.value} OFF`}
                        </span>
                      </TableCell>

                      <TableCell>
                        {hasIncluded ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> {c.productIds?.length} Products Only
                          </span>
                        ) : hasExcluded ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            <AlertCircle className="h-3 w-3" /> {c.excludedProductIds?.length} Excluded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            <ShoppingBag className="h-3 w-3" /> All Products
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <span className="text-muted-foreground">
                          {c.minOrder ? `₹${Number(c.minOrder).toLocaleString()}` : "No min"}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="text-muted-foreground">
                          {c.maxDiscount ? `₹${Number(c.maxDiscount).toLocaleString()}` : "—"}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span>{c.expiresAtFormatted ? new Date(c.expiresAtFormatted).toLocaleDateString() : "No expiry"}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={c.active !== false ? "Active" : "Suspended"} />
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggle(c)}
                            className={`h-8 w-8 p-0 ${
                              c.active !== false
                                ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                                : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            }`}
                            title={c.active !== false ? "Deactivate coupon" : "Activate coupon"}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(c)}
                            className="h-8 px-2.5 text-xs"
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(c)}
                            className="h-8 w-8 p-0 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                            title="Delete coupon"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="p-4 border-t text-xs text-muted-foreground flex justify-between items-center">
          {isLoading ? (
            <span className="inline-flex items-center gap-2 text-xs font-medium text-primary">
              <span className="h-2 w-2 rounded-full bg-primary animate-ping" /> Loading coupons...
            </span>
          ) : (
            <span>
              Showing <b className="text-foreground">{filteredCoupons.length}</b> of{" "}
              <b className="text-foreground">{coupons.length}</b> coupons from <code>coupons_code</code>
            </span>
          )}
        </div>
      </Card>

      {/* Create / Edit Coupon Modal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl rounded-3xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Ticket className="h-4.5 w-4.5" />
              </span>
              {editingCoupon ? "Edit Coupon" : "Create Coupon Code"}
            </DialogTitle>
            <DialogDescription>
              Set discount rates, minimum order value, validity, and applicable or excluded products.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-code">Coupon Code *</Label>
              <Input
                id="coupon-code"
                placeholder="e.g. FESTIVE20 or SPECIAL50"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                className="font-mono uppercase font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Discount Type</Label>
                <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Percentage (%)</SelectItem>
                    <SelectItem value="FIXED">Flat (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coupon-value">{discountType === "PERCENT" ? "Percentage Value (%)" : "Flat Amount (₹)"}</Label>
                <Input
                  id="coupon-value"
                  type="number"
                  placeholder="20"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="min-order">Min Order (₹)</Label>
                <Input
                  id="min-order"
                  type="number"
                  placeholder="0"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="max-discount">Max Discount Cap (₹)</Label>
                <Input
                  id="max-discount"
                  type="number"
                  placeholder="1000"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expiry-date">Expiry Date</Label>
              <Input
                id="expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>

            {/* Product Applicability Scope & Selector */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-primary" /> Product Applicability & Restrictions
                </Label>
                <span className="text-xs text-muted-foreground">
                  {applicabilityMode === "ALL"
                    ? "Applies to all products"
                    : applicabilityMode === "INCLUDED"
                    ? `${includedProductIds.length} Included Products`
                    : `${excludedProductIds.length} Excluded Products`}
                </span>
              </div>

              {/* Mode Switcher */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setApplicabilityMode("ALL")}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                    applicabilityMode === "ALL"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  All Products
                </button>
                <button
                  type="button"
                  onClick={() => setApplicabilityMode("INCLUDED")}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                    applicabilityMode === "INCLUDED"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  Specific Included
                </button>
                <button
                  type="button"
                  onClick={() => setApplicabilityMode("EXCLUDED")}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                    applicabilityMode === "EXCLUDED"
                      ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  Exclude Specific
                </button>
              </div>

              {/* Searchable Product Multi-Select Box */}
              {applicabilityMode !== "ALL" && (
                <div className="space-y-2 p-3 rounded-2xl bg-muted/20 border">
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search products by name or ID..."
                        className="pl-8 h-8 text-xs bg-background"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={selectAllFiltered}
                        className="h-8 text-[11px] px-2"
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                        className="h-8 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  {/* Scrollable Product Items List */}
                  <div className="max-h-52 overflow-y-auto space-y-1 divide-y divide-border/40 pr-1">
                    {filteredProductsList.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground">
                        No products match your search.
                      </div>
                    ) : (
                      filteredProductsList.map((p: any) => {
                        const rawImg = p.thumbnailUrl || p.imageUrls?.[0] || p.images?.[0] || p.image;
                        const img = formatImageUrl(rawImg);
                        const pName = getLocalizedText(p.name || p.title, p.id);
                        const isSelected =
                          applicabilityMode === "INCLUDED"
                            ? includedProductIds.includes(p.id)
                            : excludedProductIds.includes(p.id);

                        return (
                          <div
                            key={p.id}
                            onClick={() => toggleProductSelection(p.id)}
                            className={`pt-1.5 flex items-center justify-between gap-2 p-1.5 rounded-xl cursor-pointer transition-colors ${
                              isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // Handled by container click
                                className="h-4 w-4 rounded border-gray-300 text-primary pointer-events-none"
                              />
                              <div className="h-8 w-8 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0 border">
                                {img ? (
                                  <img
                                    src={img}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    referrerPolicy="no-referrer"
                                    crossOrigin="anonymous"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-xs text-foreground truncate">{pName}</div>
                                <div className="text-[10px] text-muted-foreground font-mono truncate">{p.id}</div>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-foreground shrink-0">
                              ₹{Number(p.price || 0).toLocaleString()}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="coupon-track-users"
                  checked={trackUserIds}
                  onChange={(e) => setTrackUserIds(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <Label htmlFor="coupon-track-users" className="cursor-pointer font-normal text-xs text-muted-foreground hover:text-foreground">
                  One time use per User
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="coupon-active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <Label htmlFor="coupon-active" className="cursor-pointer font-normal text-xs">
                  Coupon is active and available for customer redemption
                </Label>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gradient-to-br from-primary to-primary-glow">
                {editingCoupon ? "Update coupon" : "Save coupon"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
