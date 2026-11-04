import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  X,
  Ban,
  RefreshCw,
  Sparkles,
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

  // Map of all products for instant lookups
  const productMap = useMemo(() => {
    const map = new Map<string, any>();
    products.forEach((p: any) => {
      map.set(p.id, p);
      if (p.sku) map.set(p.sku, p);
      if (p.productCode) map.set(p.productCode, p);
    });
    return map;
  }, [products]);

  // Excluded product cards
  const excludedProductObjects = useMemo(() => {
    return excludedProductIds.map((id) => {
      const prod = productMap.get(id);
      return {
        id,
        name: prod ? getLocalizedText(prod.name || prod.title, id) : id,
        price: prod?.sellingPrice || prod?.price || null,
        sku: prod?.sku || prod?.productCode || id,
        image: prod ? formatImageUrl(prod.thumbnailUrl || prod.imageUrls?.[0] || prod.images?.[0] || prod.image) : null,
        category: prod ? getLocalizedText(prod.category, "") : "",
      };
    });
  }, [excludedProductIds, productMap]);

  // Included product cards
  const includedProductObjects = useMemo(() => {
    return includedProductIds.map((id) => {
      const prod = productMap.get(id);
      return {
        id,
        name: prod ? getLocalizedText(prod.name || prod.title, id) : id,
        price: prod?.sellingPrice || prod?.price || null,
        sku: prod?.sku || prod?.productCode || id,
        image: prod ? formatImageUrl(prod.thumbnailUrl || prod.imageUrls?.[0] || prod.images?.[0] || prod.image) : null,
        category: prod ? getLocalizedText(prod.category, "") : "",
      };
    });
  }, [includedProductIds, productMap]);

  // Filtered products for applicability selector inside dialog
  const filteredProductsList = useMemo(() => {
    if (!productSearch.trim()) return products;
    const s = productSearch.toLowerCase();
    return products.filter((p: any) => {
      const pName = getLocalizedText(p.name || p.title, "").toLowerCase();
      const pId = (p.id || "").toLowerCase();
      const pSku = String(p.sku || p.productCode || "").toLowerCase();
      return pName.includes(s) || pId.includes(s) || pSku.includes(s);
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
    const matchType =
      typeFilter === "all"
        ? true
        : (c.type || "PERCENT").toUpperCase() === typeFilter.toUpperCase();
    return codeMatch && matchType;
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
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Valid Coupons</span>
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
        <DialogContent className="w-[96vw] max-w-3xl max-h-[92vh] p-0 rounded-3xl overflow-hidden flex flex-col bg-background border border-border/70 shadow-2xl">
          {/* Modal Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-border/60 bg-muted/20 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-2xl bg-primary/15 text-primary grid place-items-center shadow-xs shrink-0">
                <Ticket className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                  {editingCoupon ? `Edit Coupon: ${code}` : "Create New Coupon Code"}
                </h2>
                <p className="text-xs text-muted-foreground truncate">
                  Configure discount percentage or flat amount, order requirements, and product restrictions
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* 1. Coupon Code & Discount Value */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-muted/20 border border-border/60">
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="coupon-code" className="text-xs font-semibold text-foreground">
                  Coupon Code *
                </Label>
                <Input
                  id="coupon-code"
                  placeholder="e.g. CPLADI005"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                  className="font-mono uppercase font-bold text-xs h-10 bg-background"
                />
                <div className="text-[11px] text-muted-foreground">Code entered by customer at checkout</div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Discount Type</Label>
                <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                  <SelectTrigger className="h-10 text-xs rounded-xl bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="PERCENT">
                      <div className="flex items-center gap-2">
                        <Percent className="h-3.5 w-3.5 text-primary" />
                        <span>Percentage (%)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="FIXED">
                      <div className="flex items-center gap-2">
                        <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Flat Discount (₹)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-[11px] text-muted-foreground">
                  {discountType === "PERCENT" ? "Deducts % off eligible items" : "Deducts fixed ₹ cash discount"}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coupon-value" className="text-xs font-semibold text-foreground">
                  {discountType === "PERCENT" ? "Discount Rate (%) *" : "Discount Amount (₹) *"}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">
                    {discountType === "PERCENT" ? "%" : "₹"}
                  </span>
                  <Input
                    id="coupon-value"
                    type="number"
                    placeholder="10"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                    className="pl-7 h-10 text-xs font-bold font-mono bg-background"
                  />
                </div>
                <div className="text-[11px] text-muted-foreground">e.g. 10 for 10% or ₹10</div>
              </div>
            </div>

            {/* 2. Order Limits & Expiry */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-muted/20 border border-border/60">
              <div className="space-y-1.5">
                <Label htmlFor="min-order" className="text-xs font-semibold text-foreground">
                  Min Order Value (₹)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                  <Input
                    id="min-order"
                    type="number"
                    placeholder="0"
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    className="pl-7 h-10 text-xs font-mono bg-background"
                  />
                </div>
                <div className="text-[11px] text-muted-foreground">0 = No minimum purchase required</div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="max-discount" className="text-xs font-semibold text-foreground">
                  Max Discount Cap (₹)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                  <Input
                    id="max-discount"
                    type="number"
                    placeholder="1000"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                    className="pl-7 h-10 text-xs font-mono bg-background"
                  />
                </div>
                <div className="text-[11px] text-muted-foreground">Maximum limit saved per transaction</div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expiry-date" className="text-xs font-semibold text-foreground">
                  Expiry Date
                </Label>
                <Input
                  id="expiry-date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="h-10 text-xs bg-background"
                />
                <div className="text-[11px] text-muted-foreground">Leave empty for lifetime coupon</div>
              </div>
            </div>

            {/* 3. Product Scope & Dedicated Excluded / Included Products Box */}
            <div className="space-y-3 p-4 rounded-2xl bg-muted/20 border border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div>
                  <Label className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-primary" /> Product Applicability & Restrictions
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Choose whether this coupon applies storewide or excludes / includes specific items
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full self-start sm:self-auto ${
                    applicabilityMode === "EXCLUDED"
                      ? "border-amber-500/40 text-amber-700 bg-amber-500/10 dark:text-amber-300"
                      : applicabilityMode === "INCLUDED"
                      ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/10 dark:text-emerald-300"
                      : "border-border text-muted-foreground bg-background"
                  }`}
                >
                  {applicabilityMode === "ALL"
                    ? "Storewide"
                    : applicabilityMode === "EXCLUDED"
                    ? `${excludedProductIds.length} Excluded`
                    : `${includedProductIds.length} Included`}
                </Badge>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-background border">
                <button
                  type="button"
                  onClick={() => setApplicabilityMode("ALL")}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    applicabilityMode === "ALL"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>All Products</span>
                </button>

                <button
                  type="button"
                  onClick={() => setApplicabilityMode("EXCLUDED")}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    applicabilityMode === "EXCLUDED"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Ban className="h-3.5 w-3.5" />
                  <span>Exclude Specific ({excludedProductIds.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setApplicabilityMode("INCLUDED")}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    applicabilityMode === "INCLUDED"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Specific Only ({includedProductIds.length})</span>
                </button>
              </div>

              {/* EXCLUDED PRODUCTS SECTION */}
              {applicabilityMode === "EXCLUDED" && (
                <div className="space-y-3 pt-1">
                  {/* Dedicated Excluded Products Container */}
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                          <span>Excluded Products in this Box</span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px]">
                            {excludedProductObjects.length} items
                          </span>
                        </span>
                      </div>

                      {excludedProductObjects.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setExcludedProductIds([])}
                          className="h-6 text-[11px] px-2 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        >
                          Clear All Exclusions
                        </Button>
                      )}
                    </div>

                    {excludedProductObjects.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-amber-500/30 bg-background/50 text-center text-xs text-muted-foreground">
                        No products excluded yet. Select products from the search list below to exclude them.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {excludedProductObjects.map((prod) => (
                          <div
                            key={prod.id}
                            className="p-2.5 rounded-xl bg-background border border-amber-500/30 flex items-center justify-between gap-2.5 shadow-2xs hover:border-amber-500/50 transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {prod.image ? (
                                <img
                                  src={prod.image}
                                  alt=""
                                  className="h-10 w-10 rounded-lg object-cover border shrink-0 bg-muted"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                                  📦
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-foreground truncate">{prod.name}</div>
                                <div className="text-[10px] text-muted-foreground font-mono truncate flex items-center gap-1.5">
                                  <span>{prod.sku}</span>
                                  {prod.price && (
                                    <span className="text-emerald-600 font-bold">₹{prod.price}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setExcludedProductIds((prev) => prev.filter((id) => id !== prod.id))}
                              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 grid place-items-center transition-colors shrink-0"
                              title="Remove exclusion"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add More Products to Exclude List */}
                  <div className="space-y-2 p-3 rounded-2xl bg-background border border-border/60">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5 text-primary" />
                        <span>Search & Add More Products to Exclusion</span>
                      </span>
                      <span className="text-[11px] text-muted-foreground font-normal">
                        Click on any product to exclude it
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Filter products by title, SKU (e.g. VDD1), or ID..."
                        className="h-8 pl-8 text-xs bg-muted/30 rounded-xl"
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1 divide-y divide-border/20 pr-1">
                      {filteredProductsList.length === 0 ? (
                        <div className="text-center py-4 text-xs text-muted-foreground">
                          No products found matching your search.
                        </div>
                      ) : (
                        filteredProductsList.map((p: any) => {
                          const rawImg = p.thumbnailUrl || p.imageUrls?.[0] || p.images?.[0] || p.image;
                          const img = formatImageUrl(rawImg);
                          const pName = getLocalizedText(p.name || p.title, p.id);
                          const isExcluded = excludedProductIds.includes(p.id);

                          return (
                            <div
                              key={p.id}
                              onClick={() => toggleProductSelection(p.id)}
                              className={`pt-1 p-2 rounded-xl flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                                isExcluded
                                  ? "bg-amber-500/10 border border-amber-500/30"
                                  : "hover:bg-muted/40 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {img ? (
                                  <img src={img} alt="" className="h-7 w-7 rounded-md object-cover border shrink-0 bg-muted" />
                                ) : (
                                  <div className="h-7 w-7 rounded-md bg-muted text-muted-foreground flex items-center justify-center text-xs shrink-0">
                                    📦
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-foreground truncate">{pName}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                                    {p.sku || p.id}
                                    {p.price && <span className="text-emerald-600 font-bold ml-1.5">₹{p.price}</span>}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0">
                                {isExcluded ? (
                                  <Badge className="bg-amber-600 text-white text-[10px] px-2 py-0.5 gap-1">
                                    <Ban className="h-2.5 w-2.5" /> Excluded
                                  </Badge>
                                ) : (
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 rounded-lg">
                                    + Exclude
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* INCLUDED PRODUCTS SECTION */}
              {applicabilityMode === "INCLUDED" && (
                <div className="space-y-3 pt-1">
                  {/* Dedicated Included Products Container */}
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                          <span>Included Products in this Box</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px]">
                            {includedProductObjects.length} items
                          </span>
                        </span>
                      </div>

                      {includedProductObjects.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIncludedProductIds([])}
                          className="h-6 text-[11px] px-2 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        >
                          Clear All
                        </Button>
                      )}
                    </div>

                    {includedProductObjects.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-emerald-500/30 bg-background/50 text-center text-xs text-muted-foreground">
                        No products added to this coupon yet. Select products from the search list below to include them.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {includedProductObjects.map((prod) => (
                          <div
                            key={prod.id}
                            className="p-2.5 rounded-xl bg-background border border-emerald-500/30 flex items-center justify-between gap-2.5 shadow-2xs hover:border-emerald-500/50 transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {prod.image ? (
                                <img
                                  src={prod.image}
                                  alt=""
                                  className="h-10 w-10 rounded-lg object-cover border shrink-0 bg-muted"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                                  📦
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-foreground truncate">{prod.name}</div>
                                <div className="text-[10px] text-muted-foreground font-mono truncate flex items-center gap-1.5">
                                  <span>{prod.sku}</span>
                                  {prod.price && (
                                    <span className="text-emerald-600 font-bold">₹{prod.price}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setIncludedProductIds((prev) => prev.filter((id) => id !== prod.id))}
                              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 grid place-items-center transition-colors shrink-0"
                              title="Remove inclusion"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add More Products to Included List */}
                  <div className="space-y-2 p-3 rounded-2xl bg-background border border-border/60">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5 text-primary" />
                        <span>Search & Add More Products</span>
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Filter products by title, SKU, or ID..."
                        className="h-8 pl-8 text-xs bg-muted/30 rounded-xl"
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1 divide-y divide-border/20 pr-1">
                      {filteredProductsList.length === 0 ? (
                        <div className="text-center py-4 text-xs text-muted-foreground">
                          No products found matching your search.
                        </div>
                      ) : (
                        filteredProductsList.map((p: any) => {
                          const rawImg = p.thumbnailUrl || p.imageUrls?.[0] || p.images?.[0] || p.image;
                          const img = formatImageUrl(rawImg);
                          const pName = getLocalizedText(p.name || p.title, p.id);
                          const isIncluded = includedProductIds.includes(p.id);

                          return (
                            <div
                              key={p.id}
                              onClick={() => toggleProductSelection(p.id)}
                              className={`pt-1 p-2 rounded-xl flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                                isIncluded
                                  ? "bg-emerald-500/10 border border-emerald-500/30"
                                  : "hover:bg-muted/40 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {img ? (
                                  <img src={img} alt="" className="h-7 w-7 rounded-md object-cover border shrink-0 bg-muted" />
                                ) : (
                                  <div className="h-7 w-7 rounded-md bg-muted text-muted-foreground flex items-center justify-center text-xs shrink-0">
                                    📦
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-foreground truncate">{pName}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                                    {p.sku || p.id}
                                    {p.price && <span className="text-emerald-600 font-bold ml-1.5">₹{p.price}</span>}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0">
                                {isIncluded ? (
                                  <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 gap-1">
                                    <Check className="h-2.5 w-2.5" /> Added
                                  </Badge>
                                ) : (
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 rounded-lg">
                                    + Add
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Customer Usage Restriction */}
            <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="coupon-track-users"
                  checked={trackUserIds}
                  onChange={(e) => setTrackUserIds(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-xs font-medium text-foreground">
                  Limit to One Time Use per Customer (Prevents duplicate redemption by the same user account)
                </span>
              </label>
            </div>

            {/* Modal Sticky Footer */}
            <DialogFooter className="pt-3 border-t border-border/60 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="w-full sm:w-auto rounded-xl text-xs h-10 px-5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto rounded-xl text-xs h-10 px-6 font-bold"
              >
                {editingCoupon ? "Save Changes" : "Create Coupon Code"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
