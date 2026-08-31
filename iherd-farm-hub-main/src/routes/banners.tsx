import React, { useState, useMemo, useRef } from "react";
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
  Upload,
  RefreshCw,
  Sliders,
  Check,
  X,
  Smartphone,
  Users,
  ShieldCheck,
  Maximize2,
  Calendar,
  Globe,
  Stethoscope,
  Copy,
  Info,
  LayoutGrid,
  Table as TableIcon,
  Code2,
  Search,
  Package,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { formatImageUrl, getLocalizedText } from "@/lib/utils";
import { useAdminProducts } from "@/hooks/useFirebaseData";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csvExport";

export const Route = createFileRoute("/banners")({
  head: () => ({ meta: [{ title: "App Banners & Promotions — iHerd Admin" }] }),
  component: BannersPage,
});

export type BannerType = "ads_banners" | "offer_banners";

export interface BannerItem {
  id: string;
  bannerType: BannerType;
  imageUrl: string;
  actionType: string;
  actionValue?: string;
  priority: number;
  isActive: boolean;
  profiles: string[];
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  raw?: any;
}

const ACTION_TYPE_OPTIONS = [
  { value: "screen", label: "App Screen (e.g. cattleMarketplace)", icon: Smartphone },
  { value: "website", label: "Website / External Link (e.g. openPashu)", icon: Globe },
  { value: "product", label: "Product (Opens Product Details)", icon: ShoppingBag },
  { value: "category", label: "Category (Opens Product Category)", icon: Layers },
  { value: "cattle", label: "Cattle (Opens Livestock Item)", icon: Tag },
  { value: "url", label: "Direct URL", icon: ExternalLink },
  { value: "none", label: "Informational (No Action)", icon: Eye },
];

const COMMON_SCREEN_SUGGESTIONS = [
  { label: "Cattle Marketplace", value: "cattleMarketplace" },
  { label: "Product Marketplace", value: "productMarketplace" },
  { label: "Cattle Section", value: "cattle" },
  { label: "Telemedicine", value: "telemedicine" },
  { label: "Open Pashu", value: "openPashu" },
];

const TARGET_PROFILES = [
  { id: "farmer", label: "Farmer", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  { id: "vet", label: "Veterinarian", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  { id: "seller", label: "Seller / Vendor", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  { id: "buyer", label: "Buyer", color: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
];

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:5000";

function BannersPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab & View Mode State
  const [selectedType, setSelectedType] = useState<BannerType | "all">("ads_banners");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [profileFilter, setProfileFilter] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);
  const [viewingDetailBanner, setViewingDetailBanner] = useState<BannerItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; bannerType: BannerType } | null>(null);
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);  
  
  // Form State
  const [formBannerType, setFormBannerType] = useState<BannerType>("ads_banners");
  const [docId, setDocId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [actionType, setActionType] = useState("screen");
  const [actionValue, setActionValue] = useState("cattleMarketplace");
  const [priority, setPriority] = useState<number>(1);
  const [isActive, setIsActive] = useState(true);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>(["farmer", "vet", "seller"]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [productSearch, setProductSearch] = useState("");

  // Live Products for Offer Banner selector
  const { data: marketplaceProducts = [] } = useAdminProducts();

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return marketplaceProducts.slice(0, 30);
    const q = productSearch.toLowerCase();
    return marketplaceProducts
      .filter((p: any) => {
        const name = getLocalizedText(p.name || p.title || "").toLowerCase();
        const sku = String(p.sku || p.productCode || p.id || "").toLowerCase();
        const cat = getLocalizedText(p.category || "").toLowerCase();
        return name.includes(q) || sku.includes(q) || cat.includes(q);
      })
      .slice(0, 30);
  }, [marketplaceProducts, productSearch]);

  // 1. Fetch Live Banners from Firestore and Backend
  const { data: bannerData, isLoading, refetch } = useQuery({
    queryKey: ["app_banners"],
    queryFn: async () => {
      // 1. Try Direct Client Firestore SDK First
      try {
        const [adsSnap, offerSnap] = await Promise.all([
          getDocs(collection(db, "banners", "ads_banners", "items")).catch(() => ({ docs: [] } as any)),
          getDocs(collection(db, "banners", "offer_banners", "items")).catch(() => ({ docs: [] } as any)),
        ]);

        const ads: BannerItem[] = adsSnap.docs.map((d: any) => {
          const data = d.data();
          return {
            id: String(d.id || "").trim(),
            bannerType: "ads_banners",
            actionType: data.actionType || "screen",
            actionValue: data.actionValue || "",
            imageUrl: data.imageUrl || data.image || "",
            isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
            priority: typeof data.priority === "number" ? data.priority : parseInt(dPriority(data.priority), 10) || 1,
            profiles: Array.isArray(data.profiles) ? data.profiles : (data.profiles ? [data.profiles] : ["farmer", "vet", "seller"]),
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
            raw: data,
          };
        });

        const offers: BannerItem[] = offerSnap.docs.map((d: any) => {
          const data = d.data();
          return {
            id: String(d.id || "").trim(),
            bannerType: "offer_banners",
            actionType: data.actionType || "product",
            actionValue: data.actionValue || "",
            imageUrl: data.imageUrl || data.image || "",
            isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
            priority: typeof data.priority === "number" ? data.priority : parseInt(dPriority(data.priority), 10) || 1,
            profiles: Array.isArray(data.profiles) ? data.profiles : (data.profiles ? [data.profiles] : ["farmer", "vet", "seller"]),
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
            raw: data,
          };
        });

        ads.sort((a, b) => (a.priority || 999) - (b.priority || 999));
        offers.sort((a, b) => (a.priority || 999) - (b.priority || 999));

        if (ads.length > 0 || offers.length > 0) {
          return {
            all: [...ads, ...offers],
            ads_banners: ads,
            offer_banners: offers,
          };
        }
      } catch (err) {
        console.warn("Client Firestore SDK banners error, attempting backend fallback:", err);
      }

      // 2. Fallback to Backend Admin API
      try {
        const res = await fetch(`${API_BASE}/api/admin/banners`).catch(() => fetch("/api/admin/banners"));
        if (res && res.ok) {
          const json = await res.json();
          if (Array.isArray(json.banners)) {
            const formatItem = (b: any): BannerItem => ({
              id: String(b.id || "").trim(),
              bannerType: b.bannerType === "offer_banners" ? "offer_banners" : "ads_banners",
              actionType: b.actionType || "screen",
              actionValue: b.actionValue || "",
              imageUrl: b.imageUrl || b.image || "",
              isActive: b.isActive !== undefined ? Boolean(b.isActive) : true,
              priority: typeof b.priority === "number" ? b.priority : parseInt(dPriority(b.priority), 10) || 1,
              profiles: Array.isArray(b.profiles) ? b.profiles : (b.profiles ? [b.profiles] : ["farmer", "vet", "seller"]),
              createdAt: b.createdAt || null,
              updatedAt: b.updatedAt || null,
              raw: b,
            });

            const ads = ((json.adsBanners || json.banners.filter((b: any) => b.bannerType === "ads_banners")) as any[]).map(formatItem);
            const offers = ((json.offerBanners || json.banners.filter((b: any) => b.bannerType === "offer_banners")) as any[]).map(formatItem);

            return {
              all: (json.banners as any[]).map(formatItem),
              ads_banners: ads,
              offer_banners: offers,
            };
          }
        }
      } catch (err) {
        console.error("Backend banners API error:", err);
      }

      return { all: [], ads_banners: [], offer_banners: [] };
    },
    staleTime: 10_000,
  });

  function dPriority(val: any): string {
    if (typeof val === "number") return String(val);
    if (!val) return "1";
    return String(val);
  }

  const adsBanners = bannerData?.ads_banners || [];
  const offerBanners = bannerData?.offer_banners || [];
  const allBanners = bannerData?.all || [];

  // Filtered List based on selected tab and search
  const currentList = useMemo(() => {
    let list: BannerItem[] = [];
    if (selectedType === "ads_banners") list = adsBanners;
    else if (selectedType === "offer_banners") list = offerBanners;
    else list = allBanners;

    return list.filter((b) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.actionValue || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.actionType || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchProfile =
        profileFilter === "all" ||
        (Array.isArray(b.profiles) && b.profiles.includes(profileFilter));

      return matchSearch && matchProfile;
    });
  }, [selectedType, adsBanners, offerBanners, allBanners, searchQuery, profileFilter]);

  // Helper to optimize large images before upload
  const optimizeImage = async (file: File): Promise<File> => {
    if (file.size < 1.5 * 1024 * 1024) return file; // Less than 1.5MB doesn't need downscaling

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1920;
        const maxHeight = 1080;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const optimizedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
                  type: "image/webp",
                });
                resolve(optimizedFile);
                return;
              }
              resolve(file);
            },
            "image/webp",
            0.88
          );
        } else {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  // Robust Upload to Firebase Storage helper
  const uploadImageFile = async (rawFile: File): Promise<string> => {
    const file = await optimizeImage(rawFile);

    // 1. Client Firebase Storage SDK
    try {
      const storagePath = `banners/${formBannerType}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const storageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      if (downloadUrl) return downloadUrl;
    } catch (clientErr) {
      console.warn("Client Storage upload fallback:", clientErr);
    }

    // 2. Backend Storage API Fallback
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await fetch(`${API_BASE}/api/admin/upload-banner-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              base64: base64Data,
              filename: file.name,
              contentType: file.type || "image/png",
              bannerType: formBannerType,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.url) return resolve(data.url);
          } else {
            const errJson = await res.json().catch(() => ({}));
            return reject(new Error(errJson.error || `Upload failed with HTTP ${res.status}`));
          }
          reject(new Error("Could not upload image to backend"));
        } catch (backendErr: any) {
          reject(backendErr);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle Image File Upload directly to Firebase Storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);
    setUploadingImage(true);

    try {
      const downloadUrl = await uploadImageFile(file);
      setImageUrl(downloadUrl);
      toast.success("Banner image uploaded to Firebase Storage!");
    } catch (err: any) {
      console.warn("Background upload error, will auto-retry when saving:", err);
      const msg = err?.message || "Storage upload issue";
      toast.error(msg.includes("too large") ? "Image size too large. Please select a smaller file." : msg);
    } finally {
      setUploadingImage(false);
    }
  };

  // Open Create Modal
  const handleOpenAdd = (type: BannerType = "ads_banners") => {
    const list = type === "ads_banners" ? adsBanners : offerBanners;
    const nextIndex = list.length + 1;
    setEditingBanner(null);
    setFormBannerType(type);
    setDocId(`banner${nextIndex}`);
    setImageUrl("");
    setImagePreview("");
    setSelectedFile(null);
    setProductSearch("");
    if (type === "offer_banners") {
      setActionType("product");
      setActionValue(marketplaceProducts[0]?.sku || marketplaceProducts[0]?.id || "VDD1-101-C01-500M");
    } else {
      setActionType("screen");
      setActionValue("cattleMarketplace");
    }
    setPriority(nextIndex);
    setIsActive(true);
    setSelectedProfiles(["farmer", "vet", "seller"]);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (banner: BannerItem) => {
    setEditingBanner(banner);
    setFormBannerType(banner.bannerType || "ads_banners");
    setDocId(banner.id);
    setImageUrl(banner.imageUrl || "");
    setImagePreview(banner.imageUrl || "");
    setSelectedFile(null);
    setProductSearch("");
    setActionType(banner.actionType || (banner.bannerType === "offer_banners" ? "product" : "screen"));
    setActionValue(banner.actionValue || "");
    setPriority(Number(banner.priority) || 1);
    setIsActive(banner.isActive !== undefined ? Boolean(banner.isActive) : true);
    setSelectedProfiles(
      Array.isArray(banner.profiles) && banner.profiles.length > 0
        ? banner.profiles
        : ["farmer", "vet", "seller"]
    );
    if (viewingDetailBanner) setViewingDetailBanner(null);
    setIsModalOpen(true);
  };

  // Save / Submit Banner
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalImageUrl = imageUrl.trim();

    // If image URL is empty but file is attached, upload now
    if (!finalImageUrl && selectedFile) {
      setUploadingImage(true);
      try {
        finalImageUrl = await uploadImageFile(selectedFile);
        setImageUrl(finalImageUrl);
      } catch (uploadErr: any) {
        toast.error("Failed to upload image: " + (uploadErr?.message || "Storage upload error"));
        setUploadingImage(false);
        return;
      }
      setUploadingImage(false);
    }

    if (!finalImageUrl && !imagePreview) {
      toast.error("Please upload an image file or provide an Image URL for this banner.");
      return;
    }

    if (!docId.trim()) {
      toast.error("Please provide a Document ID for the banner.");
      return;
    }

    const cleanDocId = docId.trim();
    const isOffer = formBannerType === "offer_banners";

    // Offer Banners have exact schema: actionType, actionValue, imageUrl, isActive, priority
    // Ads Banners also include: profiles
    const docData: any = {
      actionType: actionType.trim(),
      actionValue: actionValue.trim() || (isOffer ? "VDD1-101-C01-500M" : "cattleMarketplace"),
      imageUrl: finalImageUrl || imagePreview,
      isActive,
      priority: Number(priority) || 1,
    };

    if (!isOffer) {
      docData.profiles = selectedProfiles;
    }

    const payload = {
      id: cleanDocId,
      bannerType: formBannerType,
      ...docData,
    };

    try {
      // 1. Try Backend API
      try {
        const res = await fetch(`${API_BASE}/api/admin/banners`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success(
            editingBanner
              ? `Banner "${cleanDocId}" updated successfully!`
              : `New ${isOffer ? "Offer" : "Ads"} banner "${cleanDocId}" created!`
          );
          setIsModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["app_banners"] });
          refetch();
          return;
        }
      } catch (backendErr) {
        console.warn("Backend save failed, writing directly to Firestore:", backendErr);
      }

      // 2. Direct Firestore SDK Write
      const docRef = doc(db, "banners", formBannerType, "items", cleanDocId);
      await setDoc(docRef, docData, { merge: true });

      toast.success(
        editingBanner
          ? `Banner "${cleanDocId}" saved to Firestore!`
          : `New ${isOffer ? "Offer" : "Ads"} banner "${cleanDocId}" published to /banners/${formBannerType}/items!`
      );
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["app_banners"] });
      refetch();
    } catch (err: any) {
      console.error("Error saving banner:", err);
      toast.error("Failed to save banner: " + (err?.message || "Unknown error"));
    }
  };

  // Toggle Banner Active Status
  const handleToggle = async (banner: BannerItem) => {
    const newStatus = !banner.isActive;
    try {
      // Try Backend API
      try {
        await fetch(`${API_BASE}/api/admin/banners/${banner.bannerType}/${banner.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: newStatus }),
        });
      } catch {}

      // Client Firestore SDK
      const bannerRef = doc(db, "banners", banner.bannerType, "items", banner.id);
      await setDoc(bannerRef, { isActive: newStatus, updatedAt: new Date().toISOString() }, { merge: true });

      toast.success(`Banner "${banner.id}" is now ${newStatus ? "Active" : "Paused"}`);
      if (viewingDetailBanner && viewingDetailBanner.id === banner.id) {
        setViewingDetailBanner({ ...viewingDetailBanner, isActive: newStatus });
      }
      queryClient.invalidateQueries({ queryKey: ["app_banners"] });
      refetch();
    } catch (err: any) {
      toast.error("Failed to update status: " + (err?.message || "Unknown error"));
    }
  };

  // Delete Banner Confirmation
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      // Try Backend API
      try {
        await fetch(`${API_BASE}/api/admin/banners/${deleteTarget.bannerType}/${deleteTarget.id}`, {
          method: "DELETE",
        });
      } catch {}

      // Client Firestore SDK
      const bannerRef = doc(db, "banners", deleteTarget.bannerType, "items", deleteTarget.id);
      await deleteDoc(bannerRef);

      toast.success(`Banner "${deleteTarget.id}" deleted successfully from /banners/${deleteTarget.bannerType}/items`);
      setDeleteTarget(null);
      if (viewingDetailBanner && viewingDetailBanner.id === deleteTarget.id) {
        setViewingDetailBanner(null);
      }
      queryClient.invalidateQueries({ queryKey: ["app_banners"] });
      refetch();
    } catch (err: any) {
      toast.error("Failed to delete banner: " + (err?.message || "Unknown error"));
    }
  };

  // Export to CSV
  const handleExport = () => {
    const exportData = currentList.map((b) => ({
      "Document ID": b.id,
      "Banner Type": b.bannerType === "ads_banners" ? "Ads Banner" : "Offer Banner",
      "Firestore Path": `/banners/${b.bannerType}/items/${b.id}`,
      "Action Type": b.actionType || "screen",
      "Action Target / Value": b.actionValue || "—",
      Priority: b.priority,
      Status: b.isActive ? "Active" : "Paused",
      "Target Profiles": Array.isArray(b.profiles) ? b.profiles.join(", ") : "All",
      "Image URL": b.imageUrl,
    }));
    exportToCsv(`iherd_${selectedType}_export`, exportData );
    toast.success("Banners exported to CSV successfully!");
  };

  const activeCount = currentList.filter((b) => b.isActive).length;
  const pausedCount = currentList.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="App Banners & Ads Directory"
        description="Comprehensive management of /banners/ads_banners/items and /banners/offer_banners/items with full schema metadata, instant editing, and Storage image uploads."
      >
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            className="h-9 gap-1.5 rounded-xl border-dashed"
            title="Export banners list to CSV"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
            <span>Export CSV</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenAdd("offer_banners")}
            className="h-9 gap-1.5 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/30"
          >
            <Sparkles className="h-4 w-4" />
            <span>+ Add Offer Banner</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenAdd("ads_banners")}
            className="h-9 gap-1.5 rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-90 font-semibold"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add Ads Banner</span>
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card
          className={`rounded-3xl border transition-all cursor-pointer shadow-sm ${
            selectedType === "ads_banners" ? "ring-2 ring-primary bg-primary/5" : "bg-card/60"
          }`}
          onClick={() => setSelectedType("ads_banners")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Ads Banners</div>
              <div className="text-2xl font-black text-foreground mt-0.5">
                {isLoading ? <span className="inline-block h-7 w-12 bg-muted/70 rounded-lg animate-pulse" /> : adsBanners.length}
              </div>
              <div className="text-[10px] text-primary font-mono mt-0.5">/banners/ads_banners/items</div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-blue-500/10 text-blue-500 grid place-items-center">
              <Smartphone className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`rounded-3xl border transition-all cursor-pointer shadow-sm ${
            selectedType === "offer_banners" ? "ring-2 ring-amber-500 bg-amber-500/5" : "bg-card/60"
          }`}
          onClick={() => setSelectedType("offer_banners")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Offer Banners</div>
              <div className="text-2xl font-black text-foreground mt-0.5">
                {isLoading ? <span className="inline-block h-7 w-12 bg-muted/70 rounded-lg animate-pulse" /> : offerBanners.length}
              </div>
              <div className="text-[10px] text-amber-600 font-mono mt-0.5">/banners/offer_banners/items</div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-amber-500/10 text-amber-500 grid place-items-center">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border bg-card/60 backdrop-blur-md shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Active & Live</div>
              <div className="text-2xl font-black text-emerald-600 mt-0.5">
                {isLoading ? <span className="inline-block h-7 w-12 bg-muted/70 rounded-lg animate-pulse" /> : activeCount}
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Published on App</div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-600 grid place-items-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border bg-card/60 backdrop-blur-md shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Paused / Drafts</div>
              <div className="text-2xl font-black text-muted-foreground mt-0.5">
                {isLoading ? <span className="inline-block h-7 w-12 bg-muted/70 rounded-lg animate-pulse" /> : pausedCount}
              </div>
              <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Hidden from App</div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-muted text-muted-foreground grid place-items-center">
              <Power className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar (Tabs, View Mode, Search, Profile Filters) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-3.5 rounded-3xl border shadow-sm">
        {/* Banner Section Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-2xl border w-fit">
          <Button
            size="sm"
            variant={selectedType === "ads_banners" ? "default" : "ghost"}
            onClick={() => setSelectedType("ads_banners")}
            className={`rounded-xl gap-2 text-xs font-semibold px-4 h-9 ${
              selectedType === "ads_banners" ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="h-4 w-4 text-blue-500" />
            <span>Ads Banners</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-primary-foreground/20 text-primary-foreground">
              {adsBanners.length}
            </span>
          </Button>

          <Button
            size="sm"
            variant={selectedType === "offer_banners" ? "default" : "ghost"}
            onClick={() => setSelectedType("offer_banners")}
            className={`rounded-xl gap-2 text-xs font-semibold px-4 h-9 ${
              selectedType === "offer_banners" ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Offer Banners</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-primary-foreground/20 text-primary-foreground">
              {offerBanners.length}
            </span>
          </Button>

          <Button
            size="sm"
            variant={selectedType === "all" ? "default" : "ghost"}
            onClick={() => setSelectedType("all")}
            className={`rounded-xl gap-2 text-xs font-semibold px-4 h-9 ${
              selectedType === "all" ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-4 w-4 text-purple-500" />
            <span>All ({allBanners.length})</span>
          </Button>
        </div>

        {/* View Mode & Filter Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border">
            <Button
              size="sm"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              onClick={() => setViewMode("grid")}
              className="h-7 w-7 p-0 rounded-lg"
              title="Card Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              onClick={() => setViewMode("table")}
              className="h-7 w-7 p-0 rounded-lg"
              title="Table Details View"
            >
              <TableIcon className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Search Input */}
          <Input
            placeholder="Search by ID, action, screen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-48 sm:w-56 text-xs rounded-xl bg-background/60"
          />

          {/* Profile Filter */}
          <Select value={profileFilter} onValueChange={setProfileFilter}>
            <SelectTrigger className="h-9 text-xs rounded-xl w-36 bg-background/60">
              <SelectValue placeholder="Target Profile" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Profiles</SelectItem>
              <SelectItem value="farmer">Farmer</SelectItem>
              <SelectItem value="vet">Veterinarian</SelectItem>
              <SelectItem value="seller">Seller / Vendor</SelectItem>
              <SelectItem value="buyer">Buyer</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="h-9 w-9 p-0 rounded-xl"
            title="Refresh Banners from Firebase"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Path Header Indicator & Quick Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-3xl bg-card/60 backdrop-blur-md border shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
            {selectedType === "offer_banners" ? <Sparkles className="h-4 w-4 text-amber-500" /> : <Smartphone className="h-4 w-4 text-blue-500" />}
          </div>
          <div>
            <div className="text-xs font-bold text-foreground flex items-center gap-2">
              <span>{selectedType === "ads_banners" ? "Ads Banners Collection" : selectedType === "offer_banners" ? "Offer Banners Collection" : "All App Banners"}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-muted font-mono font-semibold">
                {currentList.length} items
              </span>
            </div>
            <code className="text-primary font-mono text-[11px]">
              /banners/{selectedType === "all" ? "{ads_banners | offer_banners}" : selectedType}/items
            </code>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => handleOpenAdd(selectedType === "offer_banners" ? "offer_banners" : "ads_banners")}
            className="h-9 gap-1.5 rounded-xl bg-primary text-primary-foreground font-bold shadow-sm px-4 hover:opacity-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add New {selectedType === "offer_banners" ? "Offer" : "Ads"} Banner</span>
          </Button>
        </div>
      </div>

      {/* Content Area: Grid View vs Table View */}
      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" /> Loading live banners from Firestore...
        </div>
      ) : currentList.length === 0 ? (
        <Card className="rounded-3xl border border-dashed p-12 text-center bg-card/40">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <ImageIcon className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-sm text-foreground">No banners found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            {selectedType === "ads_banners"
              ? "No ad banners currently exist in /banners/ads_banners/items."
              : selectedType === "offer_banners"
              ? "No offer banners currently exist in /banners/offer_banners/items."
              : "No banners match your active search or filters."}
          </p>
          <Button
            size="sm"
            onClick={() => handleOpenAdd(selectedType === "offer_banners" ? "offer_banners" : "ads_banners")}
            className="gap-1.5 rounded-xl"
          >
            <Plus className="h-4 w-4" /> Add First Banner
          </Button>
        </Card>
      ) : viewMode === "grid" ? (
        /* 1. CARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {currentList.map((banner) => (
            <Card
              key={`${banner.bannerType}_${banner.id}`}
              className={`rounded-3xl border transition-all duration-200 overflow-hidden group hover:shadow-lg ${
                banner.isActive ? "bg-card/70 border-border/80" : "bg-muted/30 border-dashed border-border/60 opacity-85"
              }`}
            >
              {/* Banner Image Container */}
              <div
                className="relative h-48 bg-muted overflow-hidden cursor-pointer flex items-center justify-center border-b border-border/50"
                onClick={() => setViewingDetailBanner(banner)}
              >
                {banner.imageUrl ? (
                  <img
                    src={formatImageUrl(banner.imageUrl)}
                    alt={banner.id}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e: any) => {
                      e.target.onerror = null;
                      e.target.src = "https://placehold.co/600x300?text=Banner+Image+Error";
                    }}
                  />
                ) : (
                  <div className="text-xs text-muted-foreground flex flex-col items-center gap-1.5">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                    <span>No image preview</span>
                  </div>
                )}

                {/* Badges Over Image */}
                <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md bg-black/70 text-white border border-white/20 shadow-sm pointer-events-auto">
                    {banner.bannerType === "ads_banners" ? "Ads Banner" : "Offer Banner"}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold backdrop-blur-md bg-primary text-primary-foreground shadow-sm">
                    Priority #{banner.priority}
                  </span>
                </div>

                {/* Zoom / Full Details Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-semibold">
                  <Maximize2 className="h-4 w-4" /> Click to View Full Data
                </div>
              </div>

              {/* Banner Card Details */}
              <CardContent className="p-4 space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div
                      className="font-extrabold text-sm text-foreground flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => setViewingDetailBanner(banner)}
                    >
                      <span>{banner.id}</span>
                      {banner.isActive ? (
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="Active on App" />
                      ) : (
                        <span className="inline-block h-2 w-2 rounded-full bg-slate-400" title="Paused" />
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate max-w-[220px]" title={`/banners/${banner.bannerType}/items/${banner.id}`}>
                      /banners/{banner.bannerType}/items/{banner.id}
                    </div>
                  </div>

                  {/* Active Switch Toggle */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={banner.isActive}
                      onCheckedChange={() => handleToggle(banner)}
                      title={banner.isActive ? "Pause this banner" : "Activate this banner"}
                    />
                  </div>
                </div>

                {/* Target Action & Screen */}
                <div className="p-2.5 rounded-2xl bg-muted/40 border border-border/50 text-xs space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span className="flex items-center gap-1 font-medium">
                      <Smartphone className="h-3 w-3 text-primary" /> actionType:
                    </span>
                    <strong className="text-foreground capitalize font-semibold">{banner.actionType || "screen"}</strong>
                  </div>
                  {banner.actionValue && (
                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span className="font-medium">actionValue:</span>
                      <strong className="text-primary font-mono truncate max-w-[150px]" title={banner.actionValue}>
                        {banner.actionValue}
                      </strong>
                    </div>
                  )}
                </div>

                {/* Target Profiles Roles */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    profiles:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(banner.profiles) && banner.profiles.length > 0 ? (
                      banner.profiles.map((p) => {
                        const targetDef = TARGET_PROFILES.find((tp) => tp.id === p);
                        return (
                          <span
                            key={p}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              targetDef?.color || "bg-muted text-foreground border-border"
                            }`}
                          >
                            {targetDef?.label || p}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">All User Profiles</span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewingDetailBanner(banner)}
                    className="h-8 text-xs gap-1 rounded-xl bg-background/50 hover:bg-muted"
                  >
                    <Info className="h-3.5 w-3.5 text-muted-foreground" /> Full Data
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEdit(banner)}
                      className="h-8 text-xs gap-1 rounded-xl bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget({ id: banner.id, bannerType: banner.bannerType })}
                      className="h-8 w-8 p-0 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Delete Banner"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* 2. TABULAR DETAILS VIEW */
        <Card className="rounded-3xl border overflow-hidden bg-card/60 backdrop-blur-md shadow-sm">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-16">Preview</TableHead>
                <TableHead>Document ID & Path</TableHead>
                <TableHead>actionType</TableHead>
                <TableHead>actionValue</TableHead>
                <TableHead className="text-center">Priority</TableHead>
                <TableHead>profiles</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentList.map((banner) => (
                <TableRow key={`${banner.bannerType}_${banner.id}`} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div
                      className="h-10 w-14 rounded-xl overflow-hidden bg-muted border cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                      onClick={() => setZoomImage({ url: banner.imageUrl, title: banner.id })}
                    >
                      <img src={formatImageUrl(banner.imageUrl)} alt={banner.id} className="h-full w-full object-cover" />
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-0.5">
                      <div
                        className="font-bold text-xs text-foreground hover:text-primary cursor-pointer transition-colors"
                        onClick={() => setViewingDetailBanner(banner)}
                      >
                        {banner.id}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">
                        /banners/{banner.bannerType}/items/{banner.id}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="px-2 py-0.5 rounded-lg bg-muted text-[11px] font-mono font-medium">
                      {banner.actionType || "screen"}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="text-xs font-mono font-semibold text-primary">
                      {banner.actionValue || "—"}
                    </span>
                  </TableCell>

                  <TableCell className="text-center">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono text-xs font-bold">
                      #{banner.priority}
                    </span>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(banner.profiles) && banner.profiles.length > 0 ? (
                        banner.profiles.map((p) => (
                          <span key={p} className="px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-medium">
                            {p}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-muted-foreground">All</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <Switch checked={banner.isActive} onCheckedChange={() => handleToggle(banner)} />
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingDetailBanner(banner)}
                        className="h-8 text-xs gap-1 rounded-xl"
                      >
                        <Info className="h-3.5 w-3.5" /> Full Data
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(banner)}
                        className="h-8 text-xs gap-1 rounded-xl bg-primary/10 text-primary border-primary/30"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget({ id: banner.id, bannerType: banner.bannerType })}
                        className="h-8 w-8 p-0 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* FULL BANNER DETAIL MODAL */}
      <Dialog open={!!viewingDetailBanner} onOpenChange={(open) => !open && setViewingDetailBanner(null)}>
        <DialogContent className="max-w-2xl p-6 rounded-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-primary/15 text-primary grid place-items-center">
                  <Smartphone className="h-4 w-4" />
                </div>
                <span>Banner Details: {viewingDetailBanner?.id}</span>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  viewingDetailBanner?.isActive
                    ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                {viewingDetailBanner?.isActive ? "Active / Published" : "Paused / Draft"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs font-mono text-primary">
              /banners/{viewingDetailBanner?.bannerType}/items/{viewingDetailBanner?.id}
            </DialogDescription>
          </DialogHeader>

          {viewingDetailBanner && (
            <div className="space-y-5 pt-2">
              {/* High Quality Banner Image View */}
              <div
                className="relative h-56 w-full rounded-2xl overflow-hidden border bg-muted cursor-pointer shadow-sm group"
                onClick={() => setZoomImage({ url: viewingDetailBanner.imageUrl, title: viewingDetailBanner.id })}
              >
                <img
                  src={formatImageUrl(viewingDetailBanner.imageUrl)}
                  alt={viewingDetailBanner.id}
                  className="h-full w-full object-contain bg-black/90"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-semibold">
                  <Maximize2 className="h-4 w-4" /> Click to View Full Size
                </div>
              </div>

              {/* Exact Field Specifications Grid */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl border bg-muted/20 space-y-1.5">
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                    actionType (string)
                  </div>
                  <div className="text-sm font-bold text-foreground capitalize flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4 text-primary" />
                    <span>"{viewingDetailBanner.actionType}"</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border bg-muted/20 space-y-1.5">
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                    actionValue (string)
                  </div>
                  <div className="text-sm font-bold font-mono text-primary truncate" title={viewingDetailBanner.actionValue}>
                    "{viewingDetailBanner.actionValue || "—"}"
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border bg-muted/20 space-y-1.5">
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                    priority (int64)
                  </div>
                  <div className="text-sm font-bold font-mono text-foreground">
                    {viewingDetailBanner.priority}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border bg-muted/20 space-y-1.5">
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                    isActive (boolean)
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold font-mono text-foreground">
                      {String(viewingDetailBanner.isActive)}
                    </span>
                    <Switch
                      checked={viewingDetailBanner.isActive}
                      onCheckedChange={() => handleToggle(viewingDetailBanner)}
                    />
                  </div>
                </div>
              </div>

              {/* Profiles Array */}
              <div className="p-3.5 rounded-2xl border bg-muted/20 space-y-2">
                <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                  profiles (array of string roles)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.isArray(viewingDetailBanner.profiles) && viewingDetailBanner.profiles.length > 0 ? (
                    viewingDetailBanner.profiles.map((p, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-xl bg-background border text-xs font-semibold font-mono text-foreground flex items-center gap-1.5 shadow-xs"
                      >
                        <span className="text-primary font-bold">[{idx}]</span> "{p}"
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">All profiles</span>
                  )}
                </div>
              </div>

              {/* Image URL with Copy */}
              <div className="p-3.5 rounded-2xl border bg-muted/20 space-y-1.5">
                <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center justify-between">
                  <span>imageUrl (Firebase Storage)</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] gap-1 rounded-lg"
                    onClick={() => {
                      navigator.clipboard.writeText(viewingDetailBanner.imageUrl);
                      toast.success("Image URL copied to clipboard!");
                    }}
                  >
                    <Copy className="h-3 w-3" /> Copy URL
                  </Button>
                </div>
                <div className="p-2 rounded-xl bg-background border text-[11px] font-mono text-muted-foreground truncate select-all">
                  {viewingDetailBanner.imageUrl}
                </div>
              </div>

              {/* Action Buttons */}
              <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between gap-2 border-t">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDeleteTarget({ id: viewingDetailBanner.id, bannerType: viewingDetailBanner.bannerType });
                  }}
                  className="rounded-xl text-xs gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Banner
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setViewingDetailBanner(null)}
                    className="rounded-xl text-xs"
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleOpenEdit(viewingDetailBanner)}
                    className="rounded-xl text-xs gap-1.5"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit Banner
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CREATE & EDIT BANNER MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl p-6 rounded-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-primary/15 text-primary grid place-items-center">
                <ImageIcon className="h-4 w-4" />
              </div>
              <span>{editingBanner ? `Edit Banner: ${docId}` : "Create New App Banner"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Upload banner image to Firebase Storage and configure target navigation screens, priority, and target profiles.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Banner Category Selector */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Banner Section / Category</Label>
                <Select
                  value={formBannerType}
                  onValueChange={(val: BannerType) => setFormBannerType(val)}
                  disabled={!!editingBanner}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ads_banners">Ads Banners (/banners/ads_banners/items)</SelectItem>
                    <SelectItem value="offer_banners">Offer Banners (/banners/offer_banners/items)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Document ID (Firebase Key)</Label>
                <Input
                  value={docId}
                  onChange={(e) => setDocId(e.target.value)}
                  placeholder="e.g. banner1, banner2"
                  disabled={!!editingBanner}
                  className="h-10 text-xs font-mono rounded-xl"
                  required
                />
              </div>
            </div>

            {/* Direct Image File Upload Card */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>Banner Image Upload (Firebase Storage)</span>
                {uploadingImage && (
                  <span className="text-[11px] text-primary flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Uploading to Storage...
                  </span>
                )}
              </Label>

              <div
                className="border-2 border-dashed border-border/80 hover:border-primary/60 transition-colors rounded-2xl p-4 bg-muted/20 text-center cursor-pointer relative overflow-hidden group"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {imagePreview || imageUrl ? (
                  <div className="relative h-36 w-full rounded-xl overflow-hidden bg-black/10 flex items-center justify-center">
                    <img
                      src={imagePreview || formatImageUrl(imageUrl)}
                      alt="Banner Preview"
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-semibold">
                      <Upload className="h-4 w-4" /> Click to Change Image File
                    </div>
                  </div>
                ) : (
                  <div className="py-4 space-y-2">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary grid place-items-center mx-auto">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="text-xs font-semibold text-foreground">Click to upload banner image file</div>
                    <div className="text-[11px] text-muted-foreground">PNG, JPG, WebP (Automatically saved to Firebase Storage)</div>
                  </div>
                )}
              </div>

              {/* Direct Image URL input (Optional if file is uploaded) */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Image URL (or upload image file above):</span>
                  {imageUrl ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Image Ready
                    </span>
                  ) : imagePreview ? (
                    <span className="text-amber-600 font-medium flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Image File Attached (Auto-uploading)
                    </span>
                  ) : null}
                </div>
                <Input
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setImagePreview(e.target.value);
                  }}
                  placeholder="Upload image above or paste https://firebasestorage... URL here"
                  className="h-9 text-xs font-mono rounded-xl bg-background/60"
                />
              </div>
            </div>

            {/* Action Type & Target Value */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  actionType (string)
                  {formBannerType === "offer_banners" && (
                    <span className="ml-1 text-[10px] text-amber-600 font-semibold font-mono">(offer: "product")</span>
                  )}
                </Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {ACTION_TYPE_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                            <span>{opt.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {formBannerType === "offer_banners" ? "actionValue (Product SKU / Product ID)" : "actionValue (Target Screen / URL)"}
                </Label>
                <Input
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  placeholder={formBannerType === "offer_banners" ? "e.g. VDD1-101-C01-500M" : "e.g. cattleMarketplace, openPashu, cattle"}
                  className="h-10 text-xs font-mono rounded-xl"
                  required
                />
              </div>
            </div>

            {/* Searchable Product Selector for Offer Banners & Product Actions */}
            {(formBannerType === "offer_banners" || actionType === "product") ? (
              <div className="space-y-2 bg-amber-500/5 p-3 rounded-2xl border border-amber-500/20">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-amber-600" />
                    <span>Search & Select Marketplace Product</span>
                  </Label>
                  <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                    {marketplaceProducts.length} available
                  </span>
                </div>

                {/* Product Search Input */}
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search product by title, SKU (e.g. VDD1), category..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="h-8 pl-8 text-xs rounded-xl bg-background"
                  />
                </div>

                {/* Filtered Product Selection Cards */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/20 rounded-xl border bg-background/60 p-1.5">
                  {filteredProducts.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      No matching products found. You can type the SKU directly above.
                    </div>
                  ) : (
                    filteredProducts.map((prod: any) => {
                      const sku = prod.sku || prod.productCode || prod.id || "";
                      const isSelected = actionValue === sku || actionValue === prod.id;
                      const img = prod.images?.[0] || prod.imageUrl || prod.image || null;
                      const name = getLocalizedText(prod.name || prod.title || "Product");
                      const price = prod.sellingPrice || prod.price || null;

                      return (
                        <div
                          key={prod.id}
                          onClick={() => {
                            setActionType("product");
                            setActionValue(sku);
                          }}
                          className={`p-2 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all ${
                            isSelected
                              ? "bg-amber-500/20 border border-amber-500/40 text-foreground font-semibold"
                              : "hover:bg-muted/40 text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {img ? (
                              <img
                                src={formatImageUrl(img)}
                                alt={name}
                                className="h-9 w-9 rounded-lg object-cover border shrink-0 bg-muted"
                              />
                            ) : (
                              <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs shrink-0">
                                📦
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                                <span>{name}</span>
                                {price && <span className="text-[11px] text-emerald-600 font-bold">₹{price}</span>}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono truncate">
                                SKU: <span className="text-foreground font-semibold">{sku}</span>
                                {prod.category && <span> • {getLocalizedText(prod.category)}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isSelected ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-semibold flex items-center gap-1">
                                <Check className="h-3 w-3" /> Selected
                              </span>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] rounded-lg">
                                Select
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : actionType === "screen" ? (
              <div className="space-y-1 bg-muted/30 p-2.5 rounded-2xl border">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Quick Screen Shortcuts:
                </span>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {COMMON_SCREEN_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug.value}
                      type="button"
                      onClick={() => setActionValue(sug.value)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-colors border ${
                        actionValue === sug.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {sug.value}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Priority & Status Switch */}
            <div className="grid sm:grid-cols-2 gap-4 items-center">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">priority (int64 / Sort Order)</Label>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value, 10) || 1)}
                  className="h-10 text-xs rounded-xl font-mono"
                  required
                />
                <div className="text-[10px] text-muted-foreground">e.g. 1 = appears first in app slider</div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl border bg-muted/20">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground">isActive (boolean)</div>
                  <div className="text-[10px] text-muted-foreground">Toggle to publish (true) or pause (false)</div>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>

            {/* Target Profile Roles Selection (Only for Ads Banners) */}
            {formBannerType === "ads_banners" ? (
              <div className="space-y-2 pt-1">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" /> profiles (array of user roles)
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TARGET_PROFILES.map((tp) => {
                    const isChecked = selectedProfiles.includes(tp.id);
                    return (
                      <div
                        key={tp.id}
                        onClick={() => {
                          if (isChecked) {
                            setSelectedProfiles(selectedProfiles.filter((p) => p !== tp.id));
                          } else {
                            setSelectedProfiles([...selectedProfiles, tp.id]);
                          }
                        }}
                        className={`p-2.5 rounded-2xl border text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                          isChecked
                            ? `${tp.color} border-current shadow-xs`
                            : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
                        }`}
                      >
                        <span>"{tp.id}"</span>
                        {isChecked ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5 opacity-40" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-muted/20 border text-xs text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                <span>
                  Offer banners target all marketplace shoppers with <strong>actionType: "product"</strong> and <strong>actionValue: "{actionValue || "product-sku"}"</strong>.
                </span>
              </div>
            )}

            {/* Firestore Path Hint */}
            <div className="p-3 rounded-2xl bg-muted/40 border text-[11px] text-muted-foreground font-mono">
              Target Firestore Path: <strong className="text-primary">/banners/{formBannerType}/items/{docId || "new_id"}</strong>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={uploadingImage} className="rounded-xl text-xs gap-1.5">
                <Check className="h-4 w-4" /> {editingBanner ? "Save Changes" : "Create Banner"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION ALERT DIALOG */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-3xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Delete Banner</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to permanently delete banner{" "}
              <strong className="text-foreground font-mono">"{deleteTarget?.id}"</strong> from{" "}
              <code className="text-primary font-mono">/banners/{deleteTarget?.bannerType}/items</code>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs"
            >
              Delete Banner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FULL PHOTO ZOOM MODAL */}
      <Dialog open={!!zoomImage} onOpenChange={(open) => !open && setZoomImage(null)}>
        <DialogContent className="max-w-4xl p-4 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold truncate">
              {zoomImage?.title || "Banner Preview"}
            </DialogTitle>
          </DialogHeader>
          {zoomImage && (
            <div className="space-y-3">
              <div className="rounded-2xl overflow-hidden bg-black/90 flex items-center justify-center max-h-[75vh]">
                <img
                  src={formatImageUrl(zoomImage.url)}
                  alt={zoomImage.title}
                  className="max-h-[75vh] w-auto object-contain rounded-xl"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                <span className="truncate max-w-md">{zoomImage.url}</span>
                <Button asChild size="sm" variant="outline" className="gap-1 text-xs rounded-xl">
                  <a href={zoomImage.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Open Full Resolution
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
