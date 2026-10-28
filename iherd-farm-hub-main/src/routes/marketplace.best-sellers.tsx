import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
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
  Flame,
  Search,
  Plus,
  Star,
  Tag,
  Package,
  Layers,
  Sparkles,
  Info,
  Check,
  Power,
  Eye,
  Download,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminProducts, useFirebaseCollection, useBestSellers } from "@/hooks/useFirebaseData";
import { getLocalizedText, formatImageUrl } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";

export const Route = createFileRoute("/marketplace/best-sellers")({
  head: () => ({ meta: [{ title: "Best Sellers — iHerd Admin" }] }),
  component: BestSellersPage,
});

// Resilient image component with Google Drive CDN fallback and referrer policy
function ProductImage({
  src,
  alt,
  className = "",
  fallbackIcon: FallbackIcon = Package,
}: {
  src: string;
  alt: string;
  className?: string;
  fallbackIcon?: any;
}) {
  const [errorLevel, setErrorLevel] = useState(0);

  if (!src || errorLevel >= 3) {
    return (
      <div className={`grid place-items-center bg-primary/10 text-primary ${className}`}>
        <FallbackIcon className="h-1/2 w-1/2" />
      </div>
    );
  }

  let finalUrl = formatImageUrl(src);

  // Fallback 1: if lh3 fails, try drive.google.com/thumbnail
  if (errorLevel === 1) {
    const driveMatch = src.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || src.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      finalUrl = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w800`;
    }
  }

  // Fallback 2: if thumbnail fails, try direct uc export view
  if (errorLevel === 2) {
    const driveMatch = src.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || src.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      finalUrl = `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
    }
  }

  return (
    <img
      src={finalUrl}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      onError={() => setErrorLevel((prev) => prev + 1)}
    />
  );
}

function getProductThumbnail(p: any): string {
  if (!p) return "";
  if (typeof p.thumbnailUrl === "string" && p.thumbnailUrl.trim()) return p.thumbnailUrl.trim();
  if (typeof p.thumbnail === "string" && p.thumbnail.trim()) return p.thumbnail.trim();
  if (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) {
    const first = p.imageUrls.find((u: any) => typeof u === "string" && u.trim());
    if (first) return first.trim();
  }
  if (typeof p.imageUrls === "string" && p.imageUrls.trim()) return p.imageUrls.trim();
  if (Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images.find((u: any) => typeof u === "string" && u.trim());
    if (first) return first.trim();
  }
  if (typeof p.images === "string" && p.images.trim()) return p.images.trim();
  if (typeof p.imageUrl === "string" && p.imageUrl.trim()) return p.imageUrl.trim();
  if (typeof p.image === "string" && p.image.trim()) return p.image.trim();
  if (typeof p.photoUrl === "string" && p.photoUrl.trim()) return p.photoUrl.trim();
  return "";
}

function BestSellersPage() {
  const { data: allProducts = [], isLoading: productsLoading } = useAdminProducts();
  const { data: categories = [] } =
    useFirebaseCollection<any>("product_marketplace/main/categories");
  const { toggleBestSeller } = useBestSellers();

  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addCategoryFilter, setAddCategoryFilter] = useState("all");
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [optimisticBestSellers, setOptimisticBestSellers] = useState<Record<string, boolean>>({});

  const isProductBestSeller = (p: any) => {
    if (!p) return false;
    if (optimisticBestSellers[p.id] !== undefined) {
      return optimisticBestSellers[p.id];
    }
    return Boolean(p.bestSeller || p.isBestSeller);
  };

  const bestSellerProducts = allProducts.filter((p) => isProductBestSeller(p));

  const categoryMap = new Map();
  categories.forEach((cat) => {
    categoryMap.set(cat.id, getLocalizedText(cat.name, cat.id));
  });

  const handleToggle = async (product: any) => {
    const currentStatus = isProductBestSeller(product);
    const nextStatus = !currentStatus;
    if (!nextStatus) {
      const prodName = getLocalizedText(product.name, product.id);
      const confirmed = window.confirm(`Are you sure you want to remove "${prodName}" from Best Sellers?`);
      if (!confirmed) return;
    }

    // Instantly update UI with glow / un-glow
    setOptimisticBestSellers((prev) => ({ ...prev, [product.id]: nextStatus }));

    try {
      await toggleBestSeller.mutateAsync({
        productId: product.id,
        isBestSeller: nextStatus,
      });
      toast.success(
        nextStatus
          ? `Added "${getLocalizedText(product.name, product.id)}" to Best Sellers!`
          : `Removed "${getLocalizedText(product.name, product.id)}" from Best Sellers.`
      );
    } catch (err: any) {
      // Revert if error
      setOptimisticBestSellers((prev) => ({ ...prev, [product.id]: currentStatus }));
      toast.error(`Failed to toggle best seller: ${err.message}`);
    }
  };

  const openDetails = (p: any) => {
    setSelectedProduct(p);
    setDetailModalOpen(true);
  };

  const filteredBestSellers = bestSellerProducts.filter((p) => {
    const name = getLocalizedText(p.name || p.title || p.id).toLowerCase();
    const matchesQ = name.includes(q.toLowerCase()) || p.id?.toLowerCase().includes(q.toLowerCase());
    const matchesCat = categoryFilter === "all" ? true : p.categoryId === categoryFilter;
    return matchesQ && matchesCat;
  });

  // Candidate products for "Feature product" modal showing all products with category and search filter
  const candidateProducts = allProducts.filter((p) => {
    const name = getLocalizedText(p.name || p.title || p.id).toLowerCase();
    const id = (p.id || "").toLowerCase();
    const seller = getLocalizedText(p.sellerName, "").toLowerCase();
    const qStr = addSearch.toLowerCase().trim();
    const matchesSearch = !qStr || name.includes(qStr) || id.includes(qStr) || seller.includes(qStr);
    const matchesCat = addCategoryFilter === "all" || p.categoryId === addCategoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleExportBestSellers = () => {
    const dataToExport = filteredBestSellers.length > 0 ? filteredBestSellers : bestSellerProducts;
    exportToCsv({
      filename: `iherd_best_sellers_${new Date().toISOString().slice(0, 10)}`,
      data: dataToExport,
      columns: [
        { header: "Product ID / SKU", accessor: (p: any) => p.id },
        { header: "Product Name", accessor: (p: any) => getLocalizedText(p.name || p.title) },
        { header: "Category", accessor: (p: any) => categoryMap.get(p.categoryId) || getLocalizedText(p.category || p.categoryId) },
        { header: "Price (INR)", accessor: (p: any) => p.price || 0 },
        { header: "Stock Quantity", accessor: (p: any) => p.quantity ?? p.stock ?? 0 },
        { header: "Best Seller Status", accessor: () => "Featured Best Seller" },
        { header: "Status", accessor: (p: any) => getLocalizedText(p.status, "Approved") },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Best seller products"
        description="Featured top-performing products displayed in mobile app best-seller highlights and marketplace feeds."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportBestSellers}
              disabled={productsLoading || bestSellerProducts.length === 0}
              className="gap-1.5"
              title={`Export ${filteredBestSellers.length} best sellers to CSV`}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setAddSearch("");
                setAddModalOpen(true);
              }}
              className="gap-1.5 bg-gradient-to-br from-amber-500 to-orange-600 font-medium text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
            >
              <Plus className="h-4 w-4" /> Feature product
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-2xl bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Featured Best Sellers</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">
            {productsLoading ? "…" : bestSellerProducts.length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Highlighted in app store front</div>
        </Card>

        <Card className="p-4 rounded-2xl bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Total Catalog</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold">{productsLoading ? "…" : allProducts.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Products in marketplace</div>
        </Card>

        <Card className="p-4 rounded-2xl bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Top Category</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-purple-500/10 text-purple-600">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold truncate">Disease & Breeding</div>
          <div className="text-xs text-muted-foreground mt-1">Most popular tags</div>
        </Card>

        <Card className="p-4 rounded-2xl bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">App Placement</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">Active Feed</div>
          <div className="text-xs text-muted-foreground mt-1">Synced to <code>best_seller</code></div>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="rounded-2xl overflow-hidden border-border">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search best seller products..."
              className="pl-9 bg-muted/50 border-transparent focus-visible:bg-background"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44 bg-muted/50">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {getLocalizedText(c.name, c.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Product ID</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>MRP</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="py-4 text-center">
                      <div className="h-4 bg-muted rounded animate-pulse w-3/4 mx-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredBestSellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    <Flame className="h-8 w-8 mx-auto text-amber-500/50 mb-2" />
                    <p className="font-semibold text-foreground">No best seller products found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Click "Feature product" above to mark products as best sellers.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredBestSellers.map((p) => {
                  const img = getProductThumbnail(p);
                  const catName = categoryMap.get(p.categoryId) || p.category || "General";
                  const prodName = getLocalizedText(p.name || p.title, p.id);

                  return (
                    <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div
                          className="h-12 w-12 rounded-xl bg-muted overflow-hidden flex items-center justify-center border shrink-0 cursor-pointer hover:opacity-90 transition-opacity relative group"
                          onClick={() => {
                            if (img) setSelectedPreviewImage({ url: img, title: prodName });
                          }}
                        >
                          <ProductImage src={img} alt={prodName} className="h-full w-full object-cover" />
                          {img && (
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye className="h-3.5 w-3.5 text-white" />
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5 max-w-xs">
                          <div className="font-medium text-sm text-foreground flex items-center gap-1.5">
                            <span className="truncate">{prodName}</span>
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] font-bold bg-amber-500/10 text-amber-600 rounded">
                              <Flame className="h-2.5 w-2.5" /> Best Seller
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {p.quantity ? `${getLocalizedText(p.quantity)} ${getLocalizedText(p.quantityUnit, "")}` : p.weight ? `${getLocalizedText(p.weight)} ${getLocalizedText(p.weightUnit, "")}` : ""}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">{getLocalizedText(p.id)}</span>
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-muted font-medium">
                          {getLocalizedText(catName)}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="font-bold text-foreground">₹{Number(p.price || 0).toLocaleString()}</span>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs text-muted-foreground line-through">
                          {p.mrp ? `₹${Number(p.mrp).toLocaleString()}` : "—"}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs text-muted-foreground truncate">{getLocalizedText(p.sellerName, "iHerd Official")}</span>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetails(p)}
                            className="h-8 px-2 text-xs gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" /> Details
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggle(p)}
                            className="h-8 px-2 text-xs text-destructive border-destructive/20 hover:bg-destructive/10"
                            title="Remove from best sellers"
                          >
                            Unfeature
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
      </Card>

      {/* Product Details Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
                <Flame className="h-4.5 w-4.5" />
              </span>
              Product Details & Specifications
            </DialogTitle>
            <DialogDescription>
              Full product attributes from <code>product_marketplace/main/products</code>.
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="flex gap-4 items-start">
                <div
                  className="h-20 w-20 rounded-2xl bg-muted overflow-hidden flex items-center justify-center border shrink-0 cursor-pointer hover:opacity-90 transition-opacity relative group"
                  onClick={() => {
                    const img = getProductThumbnail(selectedProduct);
                    if (img) setSelectedPreviewImage({ url: img, title: getLocalizedText(selectedProduct.name || selectedProduct.title) });
                  }}
                >
                  <ProductImage
                    src={getProductThumbnail(selectedProduct)}
                    alt={getLocalizedText(selectedProduct.name || selectedProduct.title)}
                    className="h-full w-full object-cover"
                  />
                  {getProductThumbnail(selectedProduct) && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-base text-foreground">
                    {getLocalizedText(selectedProduct.name || selectedProduct.title, selectedProduct.id)}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">{selectedProduct.id}</div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-lg font-bold text-emerald-600">
                      ₹{Number(selectedProduct.price || 0).toLocaleString()}
                    </span>
                    {selectedProduct.mrp && (
                      <span className="text-xs text-muted-foreground line-through">
                        ₹{Number(selectedProduct.mrp).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                <div className="p-2 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">Seller:</span>
                  <div className="font-semibold text-foreground mt-0.5">{getLocalizedText(selectedProduct.sellerName, "—")}</div>
                </div>
                <div className="p-2 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">Category:</span>
                  <div className="font-semibold text-foreground mt-0.5">
                    {getLocalizedText(categoryMap.get(selectedProduct.categoryId) || selectedProduct.categoryId, "—")}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">Quantity / Pack:</span>
                  <div className="font-semibold text-foreground mt-0.5">
                    {getLocalizedText(selectedProduct.quantity || selectedProduct.weight, "—")} {getLocalizedText(selectedProduct.quantityUnit || selectedProduct.weightUnit, "")}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">GST:</span>
                  <div className="font-semibold text-foreground mt-0.5">{selectedProduct.gst ? `${getLocalizedText(selectedProduct.gst)}%` : "—"}</div>
                </div>
              </div>

              {selectedProduct.description && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Description:</span>
                  <p className="text-xs text-foreground bg-muted/20 p-3 rounded-xl leading-relaxed">
                    {getLocalizedText(selectedProduct.description)}
                  </p>
                </div>
              )}

              {selectedProduct.instructionsToUse && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Instructions to use:</span>
                  <p className="text-xs text-foreground bg-muted/20 p-3 rounded-xl leading-relaxed">
                    {getLocalizedText(selectedProduct.instructionsToUse)}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Feature / Add to Best Sellers Dialog */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-3xl rounded-3xl max-h-[88vh] overflow-y-auto p-6 bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 shadow-sm shadow-amber-500/20">
                <Flame className="h-5 w-5 fill-amber-500 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
              </span>
              <div>
                <div className="font-bold">Feature Products as Best Sellers</div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Browse all catalog products and click the flame button to instantly feature or unfeature.
                </DialogDescription>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Search & Category Filter Toolbar */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Search products by name, SKU, brand, ID..."
                  className="pl-9 rounded-xl bg-muted/40"
                />
              </div>

              <Select value={addCategoryFilter} onValueChange={setAddCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48 rounded-xl bg-muted/40">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="all">All Categories ({allProducts.length})</SelectItem>
                  {categories.map((c) => {
                    const count = allProducts.filter((p) => p.categoryId === c.id).length;
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        {getLocalizedText(c.name, c.id)} ({count})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Category Quick Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                type="button"
                onClick={() => setAddCategoryFilter("all")}
                className={`px-3 py-1 rounded-full font-medium transition-all shrink-0 ${
                  addCategoryFilter === "all"
                    ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({allProducts.length})
              </button>
              {categories.slice(0, 6).map((c) => {
                const count = allProducts.filter((p) => p.categoryId === c.id).length;
                const isSelected = addCategoryFilter === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setAddCategoryFilter(c.id)}
                    className={`px-3 py-1 rounded-full font-medium transition-all shrink-0 ${
                      isSelected
                        ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {getLocalizedText(c.name, c.id)} ({count})
                  </button>
                );
              })}
            </div>

            {/* Product List */}
            <div className="divide-y max-h-[50vh] overflow-y-auto border rounded-2xl bg-card">
              {candidateProducts.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Package className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
                  <p className="text-xs text-muted-foreground">No products found matching your search or category filter.</p>
                </div>
              ) : (
                candidateProducts.map((p) => {
                  const img = getProductThumbnail(p);
                  const prodName = getLocalizedText(p.name || p.title, p.id);
                  const catName = categoryMap.get(p.categoryId) || getLocalizedText(p.category || p.categoryId, "General");
                  const isBs = isProductBestSeller(p);

                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                        isBs ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className="h-12 w-12 rounded-xl bg-muted overflow-hidden shrink-0 border relative flex items-center justify-center cursor-pointer hover:opacity-90"
                          onClick={() => {
                            if (img) setSelectedPreviewImage({ url: img, title: prodName });
                          }}
                        >
                          <ProductImage src={img} alt={prodName} className="h-full w-full object-cover" />
                        </div>

                        <div className="min-w-0 space-y-0.5 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground truncate">{prodName}</span>
                            {isBs && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-600 font-bold text-[10px] shrink-0 border border-amber-500/30">
                                <Flame className="h-3 w-3 fill-amber-500 text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                                Best Seller
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10px] bg-muted px-1.5 py-0.2 rounded">{p.id}</span>
                            <span>•</span>
                            <span className="text-primary font-medium">{catName}</span>
                            <span>•</span>
                            <span className="font-bold text-foreground">₹{Number(p.price || 0).toLocaleString()}</span>
                            {p.mrp && <span className="line-through text-muted-foreground text-[10px]">₹{p.mrp}</span>}
                            <span>•</span>
                            <span>Stock: <strong>{p.quantity ?? p.stock ?? "—"}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Instant Toggle Button */}
                      <Button
                        size="sm"
                        onClick={async () => {
                          await handleToggle(p);
                        }}
                        className={`h-8 px-3 text-xs font-semibold rounded-xl shrink-0 transition-all ${
                          isBs
                            ? "bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/30"
                            : "border border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                        }`}
                        variant={isBs ? "default" : "outline"}
                      >
                        <Flame
                          className={`h-3.5 w-3.5 mr-1 transition-all ${
                            isBs
                              ? "fill-white text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)] animate-pulse"
                              : "fill-none text-amber-500 group-hover:fill-amber-500"
                          }`}
                        />
                        {isBs ? "Featured" : "Feature"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>
                Total Featured: <strong className="text-amber-600">{bestSellerProducts.length}</strong> of{" "}
                {allProducts.length} products
              </span>
              <Button size="sm" variant="ghost" onClick={() => setAddModalOpen(false)} className="rounded-xl">
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Preview Image Dialog */}
      {selectedPreviewImage && (
        <Dialog open={!!selectedPreviewImage} onOpenChange={() => setSelectedPreviewImage(null)}>
          <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-0 bg-transparent shadow-2xl">
            <div className="relative bg-black/95 p-6 text-center">
              <button
                onClick={() => setSelectedPreviewImage(null)}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="max-h-[60vh] overflow-hidden rounded-2xl flex items-center justify-center">
                <ProductImage
                  src={selectedPreviewImage.url}
                  alt={selectedPreviewImage.title}
                  className="max-h-[60vh] w-auto max-w-full object-contain mx-auto rounded-xl"
                />
              </div>
              <p className="text-white text-sm font-semibold mt-4">{selectedPreviewImage.title}</p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
