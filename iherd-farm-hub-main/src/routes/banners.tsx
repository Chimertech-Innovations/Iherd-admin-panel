import React, { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  Plus,
  Image as ImageIcon,
  Edit2,
  Trash2,
  CheckCircle2,
  Power,
  ExternalLink,
  Sparkles,
  Layers,
  ArrowUpDown,
  ShoppingBag,
  Tag,
  Eye,
  AlertTriangle,
  Download,
} from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAdminBanners, useAdminProducts } from "@/hooks/useFirebaseData";
import { formatImageUrl } from "@/lib/utils";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csvExport";

export const Route = createFileRoute("/banners")({
  head: () => ({ meta: [{ title: "Promotional Banners — iHerd Admin" }] }),
  component: BannersPage,
});

interface BannerItem {
  id: string;
  imageUrl?: string;
  actionType?: string;
  actionValue?: string;
  priority?: number;
  isActive?: boolean;
  updatedAt?: string;
}

const ACTION_TYPES = [
  { value: "product", label: "Product (Opens Product Details)", icon: ShoppingBag },
  { value: "category", label: "Category (Opens Product Category)", icon: Layers },
  { value: "cattle", label: "Cattle (Opens Livestock Details)", icon: Tag },
  { value: "external", label: "External Link (Opens Webpage)", icon: ExternalLink },
  { value: "none", label: "None (Informational only)", icon: Eye },
];

function BannersPage() {
  const { banners, isLoading, saveBanner, toggleBannerActive, deleteBanner } = useAdminBanners();
  const { data: products = [] } = useAdminProducts();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form State
  const [docId, setDocId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [actionType, setActionType] = useState("product");
  const [actionValue, setActionValue] = useState("");
  const [priority, setPriority] = useState<number>(1);
  const [isActive, setIsActive] = useState(true);

  // Quick stats
  const totalBanners = banners.length;
  const activeBanners = banners.filter((b) => b.isActive).length;
  const pausedBanners = totalBanners - activeBanners;

  const handleOpenAdd = () => {
    const nextIndex = totalBanners + 1;
    setEditingBanner(null);
    setDocId(`banner${nextIndex}`);
    setImageUrl("");
    setActionType("product");
    setActionValue(products[0]?.id || "");
    setPriority(nextIndex);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (banner: BannerItem) => {
    setEditingBanner(banner);
    setDocId(banner.id);
    setImageUrl(banner.imageUrl || "");
    setActionType(banner.actionType || "product");
    setActionValue(banner.actionValue || "");
    setPriority(Number(banner.priority) || 1);
    setIsActive(banner.isActive !== undefined ? Boolean(banner.isActive) : true);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageUrl.trim()) {
      toast.error("Please provide an Image URL for the banner.");
      return;
    }

    try {
      await saveBanner.mutateAsync({
        id: docId.trim(),
        imageUrl: imageUrl.trim(),
        actionType,
        actionValue: actionValue.trim(),
        priority: Number(priority) || 1,
        isActive,
      });

      toast.success(editingBanner ? `Banner "${docId}" updated successfully!` : `New banner "${docId}" created!`);
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error("Failed to save banner: " + (err?.message || "Unknown error"));
    }
  };

  const handleToggle = async (banner: BannerItem) => {
    const newStatus = !banner.isActive;
    try {
      await toggleBannerActive.mutateAsync({
        id: banner.id,
        isActive: newStatus,
      });
      toast.success(`Banner ${banner.id} is now ${newStatus ? "Active (Live in App)" : "Paused"}`);
    } catch (err: any) {
      toast.error("Failed to update status: " + (err?.message || "Unknown error"));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteBanner.mutateAsync(deleteId);
      toast.success(`Banner "${deleteId}" removed from Firestore.`);
      setDeleteId(null);
    } catch (err: any) {
      toast.error("Failed to delete banner: " + (err?.message || "Unknown error"));
    }
  };

  const handleExportBanners = () => {
    exportToCsv({
      filename: `iherd_banners_${new Date().toISOString().slice(0, 10)}`,
      data: banners,
      columns: [
        { header: "Banner Document ID", accessor: "id" },
        { header: "Image URL", accessor: "imageUrl" },
        { header: "Action Type", accessor: "actionType" },
        { header: "Action Value / Target ID", accessor: "actionValue" },
        { header: "Display Priority", accessor: "priority" },
        { header: "Active Status", accessor: (b: any) => b.isActive ? "Active (Live in App)" : "Paused" },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banners & Advertisements"
        description="Manage promotional mobile app carousel banners, priorities, and action deep-links."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportBanners}
              disabled={isLoading || banners.length === 0}
              className="gap-1.5"
              title={`Export ${banners.length} banners to CSV`}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={handleOpenAdd} className="gap-2 bg-gradient-to-br from-primary to-primary-glow shadow-md">
              <Plus className="h-4 w-4" /> Add New Banner
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 rounded-2xl border bg-card/60 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Total Carousel Banners</div>
            <div className="text-2xl font-bold">{totalBanners}</div>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border bg-card/60 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-lg">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Active in Mobile App</div>
            <div className="text-2xl font-bold text-emerald-600">{activeBanners}</div>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border bg-card/60 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-lg">
            <Power className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Paused / Inactive</div>
            <div className="text-2xl font-bold text-amber-600">{pausedBanners}</div>
          </div>
        </Card>
      </div>

      {/* Banners Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="rounded-2xl overflow-hidden animate-pulse border shadow-sm">
              <div className="h-44 bg-muted" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-8 bg-muted rounded w-full mt-4" />
              </div>
            </Card>
          ))}
        </div>
      ) : banners.length === 0 ? (
        <Card className="rounded-2xl p-12 text-center border shadow-sm">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" />
          <h3 className="text-lg font-semibold">No Banners Found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            You don't have any promotional banners configured in the Firestore <code className="text-primary font-mono">banners</code> collection yet.
          </p>
          <Button onClick={handleOpenAdd} className="mt-5 gap-2">
            <Plus className="h-4 w-4" /> Create First Banner
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {banners.map((b: BannerItem) => {
            const formattedImg = formatImageUrl(b.imageUrl);
            const isLive = Boolean(b.isActive);

            return (
              <Card
                key={b.id}
                className={`rounded-2xl overflow-hidden border transition-all duration-200 hover:shadow-lg flex flex-col ${
                  isLive ? "border-border/80 bg-card" : "border-border/40 bg-muted/20 opacity-80"
                }`}
              >
                {/* Image Banner Header */}
                <div className="relative h-44 w-full bg-muted/60 overflow-hidden group">
                  {formattedImg ? (
                    <img
                      src={formattedImg}
                      alt={b.id}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=800&auto=format&fit=crop&q=60";
                      }}
                    />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-10 w-10 mb-1" />
                      <span className="text-xs">No image provided</span>
                    </div>
                  )}

                  {/* Priority Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow">
                    <ArrowUpDown className="h-3 w-3" /> Priority #{b.priority ?? 1}
                  </div>

                  {/* Live Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shadow backdrop-blur-md ${
                        isLive
                          ? "bg-emerald-500/90 text-white"
                          : "bg-zinc-700/90 text-zinc-300"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-white animate-pulse" : "bg-zinc-400"}`} />
                      {isLive ? "Live in App" : "Paused"}
                    </span>
                  </div>
                </div>

                {/* Content Details */}
                <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-base tracking-tight font-mono text-primary">{b.id}</h4>
                      <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {b.actionType || "product"}
                      </span>
                    </div>

                    <div className="mt-3 p-2.5 rounded-xl bg-muted/40 border text-xs space-y-1">
                      <div className="text-muted-foreground font-medium flex items-center gap-1">
                        <Tag className="h-3 w-3" /> Action Target:
                      </div>
                      <div className="font-mono font-semibold truncate text-foreground">
                        {b.actionValue || "(No action target assigned)"}
                      </div>
                    </div>
                  </div>

                  {/* Card Controls */}
                  <div className="pt-2 border-t flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isLive}
                        onCheckedChange={() => handleToggle(b)}
                        aria-label="Toggle active status"
                      />
                      <span className="text-xs font-medium text-muted-foreground">
                        {isLive ? "Active" : "Paused"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(b)}
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(b.id)}
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Banner Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {editingBanner ? `Edit Banner (${editingBanner.id})` : "Create New App Banner"}
            </DialogTitle>
            <DialogDescription>
              Configure the banner image, target action, priority, and visibility in the mobile app.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Document ID */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Document Identifier
              </Label>
              <Input
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
                placeholder="e.g. banner1, banner2, promo_summer"
                required
                disabled={Boolean(editingBanner)}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Firestore document key in the <code className="text-primary font-mono">banners</code> collection.
              </p>
            </div>

            {/* Image URL with live preview */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Banner Image URL
              </Label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://firebasestorage.googleapis.com/... or Google Drive link"
                required
              />
              {imageUrl ? (
                <div className="mt-2 rounded-xl overflow-hidden border bg-muted/30 h-28 relative flex items-center justify-center">
                  <img
                    src={formatImageUrl(imageUrl)}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=800&auto=format&fit=crop&q=60";
                    }}
                  />
                  <div className="absolute bottom-1 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                    Live Preview
                  </div>
                </div>
              ) : null}
            </div>

            {/* Action Type & Value */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Action Type
                </Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          <t.icon className="h-3.5 w-3.5 text-primary" /> {t.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Priority Index
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value) || 1)}
                  placeholder="1"
                  required
                />
              </div>
            </div>

            {/* Action Value Target with helper */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Action Value / Target
                </Label>
                {actionType === "product" && products.length > 0 ? (
                  <span className="text-[11px] text-primary">Catalog has {products.length} products</span>
                ) : null}
              </div>

              {actionType === "product" && products.length > 0 ? (
                <div className="space-y-2">
                  <Select
                    value={actionValue}
                    onValueChange={(val) => setActionValue(val)}
                  >
                    <SelectTrigger className="font-mono text-xs">
                      <SelectValue placeholder="Pick a Product from Catalog" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {products.map((p: any) => {
                        const pName = typeof p.name === "object" ? p.name?.en || Object.values(p.name)[0] : p.name;
                        return (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="font-medium text-foreground">{pName}</span>
                            <span className="text-muted-foreground ml-2 font-mono text-xs">({p.id})</span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Input
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder="Or type custom product ID"
                    className="font-mono text-xs"
                  />
                </div>
              ) : (
                <Input
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  placeholder={
                    actionType === "category"
                      ? "e.g. cat_disease_management"
                      : actionType === "cattle"
                      ? "e.g. cattle_id_123"
                      : actionType === "external"
                      ? "https://yourwebsite.com/offer"
                      : "Action payload"
                  }
                  className="font-mono text-xs"
                />
              )}
            </div>

            {/* Live Active Switch */}
            <div className="pt-2 flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
              <div>
                <div className="font-semibold text-sm">Active in Carousel</div>
                <div className="text-xs text-muted-foreground">Immediately shows to farmers in the mobile app</div>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveBanner.isPending}
                className="bg-gradient-to-br from-primary to-primary-glow"
              >
                {saveBanner.isPending ? "Saving to Firebase..." : editingBanner ? "Update Banner" : "Create Banner"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete Banner?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete banner document <strong className="font-mono text-foreground">{deleteId}</strong> from Firebase Firestore? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
