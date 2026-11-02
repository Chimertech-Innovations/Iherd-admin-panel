import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/admin/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Image as ImageIcon,
  FileText,
  ShoppingBag,
  User,
  Search,
  Download,
  ExternalLink,
  HardDrive,
  Eye,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ImageOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportToCsv } from "@/lib/csvExport";
import { getApiBaseUrl } from "@/lib/apiClient";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

export const Route = createFileRoute("/storage")({
  head: () => ({ meta: [{ title: "Storage — iHerd Admin" }] }),
  component: StoragePage,
});

export interface StorageFile {
  name: string;
  size: number;
  contentType: string;
  updated: string | null;
  url: string;
  title?: string;
  actionType?: string;
  actionValue?: string;
}

async function fetchStorage() {
  let backendData: any = null;
  try {
    const apiBase = await getApiBaseUrl();
    const res = await fetch(`${apiBase}/api/admin/storage`);
    if (res.ok) {
      backendData = await res.json();
    }
  } catch (err) {
    console.warn("Backend /api/admin/storage request failed:", err);
  }

  let userImages: StorageFile[] = backendData?.userImages || [];
  let invoices: StorageFile[] = backendData?.invoices || [];
  let cattleMarketplace: StorageFile[] = backendData?.cattleMarketplace || [];
  let marketplace: StorageFile[] = backendData?.marketplace || [];
  let offerBanners: StorageFile[] = backendData?.offerBanners || [];
  let otherBanners: StorageFile[] = backendData?.otherBanners || [];

  // Fallback & client-side enrichment:
  // If offerBanners or otherBanners are empty (e.g. older backend deployment),
  // fetch directly from Firestore /banners collections so the user always sees banner data!
  if (offerBanners.length === 0 || otherBanners.length === 0) {
    try {
      const [offerSnap, adsSnap] = await Promise.all([
        getDocs(collection(db, "banners", "offer_banners", "items")).catch(() => ({ docs: [] } as any)),
        getDocs(collection(db, "banners", "ads_banners", "items")).catch(() => ({ docs: [] } as any)),
      ]);

      if (offerBanners.length === 0 && offerSnap?.docs?.length > 0) {
        offerBanners = offerSnap.docs.map((d: any) => {
          const data = d.data();
          return {
            name: `banners/offer_banners/${d.id}`,
            size: 0,
            contentType: "image/png",
            updated: data.updatedAt || null,
            url: data.imageUrl || "",
            title: data.title || d.id,
            actionType: data.actionType,
            actionValue: data.actionValue,
          };
        }).filter((b: StorageFile) => Boolean(b.url));
      }

      if (otherBanners.length === 0 && adsSnap?.docs?.length > 0) {
        otherBanners = adsSnap.docs.map((d: any) => {
          const data = d.data();
          return {
            name: `banners/ads_banners/${d.id}`,
            size: 0,
            contentType: "image/png",
            updated: data.updatedAt || null,
            url: data.imageUrl || "",
            title: data.title || d.id,
            actionType: data.actionType,
            actionValue: data.actionValue,
          };
        }).filter((b: StorageFile) => Boolean(b.url));
      }
    } catch (fsErr) {
      console.warn("Client fallback banner query error:", fsErr);
    }
  }

  const allBanners = [...offerBanners, ...otherBanners];
  const totals = {
    userImages: userImages.length,
    invoices: invoices.length,
    cattleMarketplace: cattleMarketplace.length,
    marketplace: marketplace.length,
    banners: allBanners.length,
    offerBanners: offerBanners.length,
    otherBanners: otherBanners.length,
    total:
      userImages.length +
      invoices.length +
      cattleMarketplace.length +
      marketplace.length +
      allBanners.length,
  };

  return {
    userImages,
    invoices,
    cattleMarketplace,
    marketplace,
    banners: allBanners,
    offerBanners,
    otherBanners,
    totals,
    error: backendData?.error || null,
  };
}

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileLabel(name: string) {
  return name.split("/").pop() || name;
}

function isImage(contentType?: string, name?: string) {
  if (contentType?.startsWith("image/")) return true;
  if (!name) return false;
  const lower = name.toLowerCase();
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".svg") ||
    lower.endsWith(".bmp")
  ) {
    return true;
  }
  // User cattle images pattern: faceView, farmerView, leftView, muzzleView, rightView, topview, udderView
  if (
    lower.includes("view") ||
    lower.includes("cattleimage") ||
    lower.includes("userimages") ||
    lower.includes("banner")
  ) {
    return true;
  }
  return false;
}

const PAGE_SIZE = 48;

function FileGrid({
  files,
  query,
  onPreview,
}: {
  files: StorageFile[];
  query: string;
  onPreview: (f: StorageFile) => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    return files.filter(
      (f) =>
        f.name.toLowerCase().includes(query.toLowerCase()) ||
        (f.title && f.title.toLowerCase().includes(query.toLowerCase())) ||
        (f.actionValue && f.actionValue.toLowerCase().includes(query.toLowerCase()))
    );
  }, [files, query]);

  // Reset page when search or files change
  useMemo(() => {
    setCurrentPage(1);
  }, [query, files]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  if (filtered.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground bg-muted/20 border border-dashed rounded-2xl">
        <ImageIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
        <p className="font-medium text-foreground">
          {files.length === 0 ? "No files found in this storage path." : "No files match your search."}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {files.length === 0
            ? "Files uploaded to this Firebase Storage location will appear here automatically."
            : "Try adjusting your search keywords."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {paginatedFiles.map((f, i) => {
          const isImg = isImage(f.contentType, f.name);
          return (
            <Card
              key={`${f.name}-${i}`}
              onClick={() => onPreview(f)}
              className="rounded-xl overflow-hidden p-0 group hover:shadow-md transition-all border border-border/60 hover:border-primary/40 cursor-pointer bg-card flex flex-col justify-between"
            >
              {/* Preview Container */}
              <div className="relative h-28 bg-muted/40 flex items-center justify-center overflow-hidden select-none">
                {isImg ? (
                  <>
                    <img
                      src={f.url}
                      alt={fileLabel(f.name)}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        const fallback = target.parentElement?.querySelector(".img-fallback");
                        if (fallback) (fallback as HTMLElement).classList.remove("hidden");
                      }}
                    />
                    <div className="img-fallback hidden h-full w-full flex-col items-center justify-center bg-muted/80 text-muted-foreground p-2 text-center">
                      <ImageOff className="h-6 w-6 mb-1 opacity-50" />
                      <span className="text-[10px] truncate max-w-full font-medium">Image preview</span>
                    </div>
                  </>
                ) : (
                  <FileText className="h-10 w-10 text-muted-foreground/60" />
                )}

                {/* Hover overlay with action buttons */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview(f);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                    title="View Image Details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="grid h-8 w-8 place-items-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <a
                    href={f.url}
                    download={fileLabel(f.name)}
                    onClick={(e) => e.stopPropagation()}
                    className="grid h-8 w-8 place-items-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              </div>

              {/* Meta details */}
              <div className="p-2.5">
                <div className="text-xs font-semibold truncate text-foreground" title={f.title || fileLabel(f.name)}>
                  {f.title || fileLabel(f.name)}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{formatBytes(f.size)}</span>
                  {f.updated && (
                    <span className="truncate ml-1 font-mono">
                      {new Date(f.updated).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
          <div>
            Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} files
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-2.5 gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </Button>
            <span className="px-2 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 px-2.5 gap-1"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StoragePage() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("offerBanners");
  const [previewFile, setPreviewFile] = useState<StorageFile | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["adminStorage"],
    queryFn: fetchStorage,
    staleTime: 30_000,
  });

  const totals = data?.totals ?? {
    userImages: 0,
    invoices: 0,
    cattleMarketplace: 0,
    marketplace: 0,
    banners: 0,
    offerBanners: 0,
    otherBanners: 0,
    total: 0,
  };

  const kpis = [
    { id: "userImages", label: "User Images", value: totals.userImages, icon: User, tint: "bg-primary/10 text-primary" },
    { id: "offerBanners", label: "Offer Banners", value: data?.offerBanners?.length ?? totals.offerBanners ?? 0, icon: ImageIcon, tint: "bg-amber-500/10 text-amber-600" },
    { id: "otherBanners", label: "Other Banners", value: data?.otherBanners?.length ?? totals.otherBanners ?? 0, icon: ImageIcon, tint: "bg-indigo-500/10 text-indigo-600" },
    { id: "cattleMarketplace", label: "Cattle Media", value: totals.cattleMarketplace, icon: ImageIcon, tint: "bg-success/10 text-success" },
    
    { id: "invoices", label: "Invoices", value: totals.invoices, icon: FileText, tint: "bg-info/10 text-info" },
  ];

  const allStorageFiles: StorageFile[] = [
    ...(data?.userImages ?? []),
    ...(data?.invoices ?? []),
    ...(data?.cattleMarketplace ?? []),
    ...(data?.marketplace ?? []),
    ...(data?.offerBanners ?? []),
    ...(data?.otherBanners ?? []),
  ];

  const handleExportStorage = () => {
    exportToCsv({
      filename: `iherd_storage_files_${new Date().toISOString().slice(0, 10)}`,
      data: allStorageFiles,
      columns: [
        { header: "File Name", accessor: (f: StorageFile) => fileLabel(f.name) },
        { header: "Storage Path", accessor: "name" },
        { header: "Content Type", accessor: "contentType" },
        { header: "File Size", accessor: (f: StorageFile) => formatBytes(f.size) },
        { header: "Last Updated", accessor: (f: StorageFile) => (f.updated ? new Date(f.updated).toLocaleString() : "—") },
        { header: "Download URL", accessor: "url" },
      ],
    });
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Image URL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storage"
        description="All files stored in Firebase Storage across UserImages, invoices, cattle-marketplace, marketplace, and promotional banner paths."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
              title="Refresh Storage data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportStorage}
              disabled={isLoading || allStorageFiles.length === 0}
              className="gap-1.5"
              title={`Export ${allStorageFiles.length} storage file references to CSV`}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-lg border border-border/40">
              <HardDrive className="h-3.5 w-3.5 text-primary" />
              {isLoading ? "Loading…" : `${totals.total} total files`}
            </div>
          </div>
        }
      />

      {/* KPI cards - Click to switch tab */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => {
          const isSelected = activeTab === k.id;
          return (
            <Card
              key={k.id}
              onClick={() => setActiveTab(k.id)}
              className={`p-3.5 rounded-2xl cursor-pointer transition-all border ${
                isSelected
                  ? "ring-2 ring-primary border-primary shadow-sm bg-primary/5"
                  : "hover:border-primary/40 hover:shadow-xs bg-card"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${k.tint}`}>
                  <k.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground truncate font-medium">{k.label}</div>
                  <div className="text-lg font-bold tracking-tight text-foreground">
                    {isLoading ? "…" : k.value}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files by name, title or path…"
          className="pl-9 h-9 text-xs"
        />
      </div>

      {error || data?.error ? (
        <Card className="p-8 rounded-2xl border-destructive/20 bg-destructive/5 text-center">
          <p className="text-destructive font-semibold text-base">Storage Access Notice</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            {data?.error?.message || String(error)}
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            💡 To enable full direct GCS bucket scanning: ensure your Firebase Service Account has the{" "}
            <strong>Storage Admin</strong> or <strong>Storage Object Viewer</strong> role in Google Cloud IAM.
          </p>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-5 flex flex-wrap gap-1 bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="offerBanners" className="rounded-lg text-xs font-medium">
              Offer Banners {!isLoading && `(${data?.offerBanners?.length ?? totals.offerBanners ?? 0})`}
            </TabsTrigger>
            <TabsTrigger value="otherBanners" className="rounded-lg text-xs font-medium">
              Other Banners {!isLoading && `(${data?.otherBanners?.length ?? totals.otherBanners ?? 0})`}
            </TabsTrigger>
            <TabsTrigger value="cattleMarketplace" className="rounded-lg text-xs font-medium">
              Cattle Media {!isLoading && `(${totals.cattleMarketplace})`}
            </TabsTrigger>
            <TabsTrigger value="userImages" className="rounded-lg text-xs font-medium">
              User Images {!isLoading && `(${totals.userImages})`}
            </TabsTrigger>
            <TabsTrigger value="invoices" className="rounded-lg text-xs font-medium">
              Invoices {!isLoading && `(${totals.invoices})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="offerBanners">
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              <FileGrid files={data?.offerBanners ?? []} query={query} onPreview={setPreviewFile} />
            )}
          </TabsContent>
          <TabsContent value="otherBanners">
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              <FileGrid files={data?.otherBanners ?? []} query={query} onPreview={setPreviewFile} />
            )}
          </TabsContent>
          <TabsContent value="cattleMarketplace">
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              <FileGrid files={data?.cattleMarketplace ?? []} query={query} onPreview={setPreviewFile} />
            )}
          </TabsContent>
          <TabsContent value="userImages">
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              <FileGrid files={data?.userImages ?? []} query={query} onPreview={setPreviewFile} />
            )}
          </TabsContent>
          <TabsContent value="marketplace">
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              <FileGrid files={data?.marketplace ?? []} query={query} onPreview={setPreviewFile} />
            )}
          </TabsContent>
          <TabsContent value="invoices">
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              <FileGrid files={data?.invoices ?? []} query={query} onPreview={setPreviewFile} />
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Lightbox / Image Preview Modal */}
      <Dialog open={Boolean(previewFile)} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl bg-card border border-border">
          <DialogHeader className="p-4 pb-2 border-b border-border/50">
            <DialogTitle className="text-sm font-semibold truncate flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{previewFile?.title || fileLabel(previewFile?.name || "")}</span>
            </DialogTitle>
          </DialogHeader>

          {previewFile && (
            <div className="p-4 space-y-4">
              {/* Image Viewport */}
              <div className="relative rounded-xl overflow-hidden bg-muted/60 border border-border/50 max-h-[420px] flex items-center justify-center p-2">
                {isImage(previewFile.contentType, previewFile.name) ? (
                  <img
                    src={previewFile.url}
                    alt={fileLabel(previewFile.name)}
                    className="max-h-[380px] w-auto max-w-full object-contain rounded-lg shadow-xs"
                  />
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="h-16 w-16 mb-2 opacity-50" />
                    <p className="text-xs font-medium">Non-image file ({previewFile.contentType})</p>
                  </div>
                )}
              </div>

              {/* File Metadata Details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs bg-muted/30 p-3 rounded-xl border border-border/40">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                    File Name
                  </span>
                  <span className="font-medium text-foreground truncate block" title={fileLabel(previewFile.name)}>
                    {fileLabel(previewFile.name)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                    File Size
                  </span>
                  <span className="font-medium text-foreground block">{formatBytes(previewFile.size)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                    Last Updated
                  </span>
                  <span className="font-medium text-foreground block">
                    {previewFile.updated ? new Date(previewFile.updated).toLocaleString() : "—"}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                    Storage Path
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground truncate block">
                    {previewFile.name}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyUrl(previewFile.url)}
                  className="gap-1.5 text-xs"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy Link"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-1.5 text-xs"
                >
                  <a href={previewFile.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Open in New Tab
                  </a>
                </Button>
                <Button
                  size="sm"
                  asChild
                  className="gap-1.5 text-xs"
                >
                  <a href={previewFile.url} download={fileLabel(previewFile.name)}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <Card key={i} className="rounded-xl overflow-hidden p-0 animate-pulse bg-muted/40 border border-border/40">
          <div className="h-28 bg-muted" />
          <div className="p-2.5 space-y-1.5">
            <div className="h-3 bg-muted rounded w-3/4" />
            <div className="h-2.5 bg-muted rounded w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  );
}
