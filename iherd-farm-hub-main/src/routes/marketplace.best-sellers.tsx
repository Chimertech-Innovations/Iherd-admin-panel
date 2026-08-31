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
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const bestSellerProducts = allProducts.filter((p) => p.bestSeller || p.isBestSeller);

  const categoryMap = new Map();
  categories.forEach((cat) => {
    categoryMap.set(cat.id, getLocalizedText(cat.name, cat.id));
  });

  const handleToggle = async (product: any) => {
    const nextStatus = !(product.bestSeller || product.isBestSeller);
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

  // Non best-sellers for "Add Best Seller" modal
  const candidateProducts = allProducts.filter((p) => {
    const isBs = p.bestSeller || p.isBestSeller;
    if (isBs) return false;
    const name = getLocalizedText(p.name || p.title || p.id).toLowerCase();
    return name.includes(addSearch.toLowerCase()) || p.id?.toLowerCase().includes(addSearch.toLowerCase());
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
        <DialogContent className="sm:max-w-xl rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
                <Flame className="h-4.5 w-4.5" />
              </span>
              Feature a Product as Best Seller
            </DialogTitle>
            <DialogDescription>
              Select any catalog product to add to the featured best seller highlights.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder="Search catalog products..."
                className="pl-9"
              />
            </div>

            <div className="divide-y max-h-96 overflow-y-auto border rounded-xl">
              {candidateProducts.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No unfeatured products found matching search.
                </div>
              ) : (
                candidateProducts.slice(0, 20).map((p) => {
                  const img = getProductThumbnail(p);
                  const prodName = getLocalizedText(p.name || p.title, p.id);

                  return (
                    <div key={p.id} className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden shrink-0 border flex items-center justify-center">
                          <ProductImage src={img} alt={prodName} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-xs text-foreground truncate">{prodName}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{p.id} • ₹{Number(p.price || 0).toLocaleString()}</div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={async () => {
                          await handleToggle(p);
                        }}
                        className="h-7 px-2.5 text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium shrink-0 ml-2"
                      >
                        <Flame className="h-3 w-3 mr-1" /> Feature
                      </Button>
                    </div>
                  );
                })
              )}
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
