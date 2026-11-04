import React, { useState, useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { processBannerImage, validateImageFile } from "@/lib/imageProcessor";
import { getApiBaseUrlSync } from "@/lib/apiClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  Link as LinkIcon,
  HelpCircle,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import {
  PRODUCT_CATEGORIES,
  getSubcategoriesForCategory,
  getCategoryName,
  getSubcategoryName,
} from "@/lib/categories";
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

export function getActionTypeLabel(type: string): string {
  const match = ACTION_TYPE_OPTIONS.find((o) => o.value === type);
  if (match) return match.label.split(" (")[0];
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : "App Screen";
}

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

const API_BASE = getApiBaseUrlSync();

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
  const [submitting, setSubmitting] = useState(false);
  const [imageTab, setImageTab] = useState<"upload" | "url">("upload");
  const [imagePreview, setImagePreview] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedDimensions, setDetectedDimensions] = useState<{ width: number; height: number; isExact: boolean } | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("cat_disease_management");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("subcat_disease_detection");

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

  // Handle Image File Upload directly to Firebase Storage with format validation and dimension detection
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict image validation
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error || "Unsupported file format! Please upload an image file (PNG, JPG, WebP).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);
    setUploadingImage(true);

    try {
      const bannerProcessed = await processBannerImage(file, false);
      setDetectedDimensions({
        width: bannerProcessed.width,
        height: bannerProcessed.height,
        isExact: bannerProcessed.isExact,
      });

      const downloadUrl = await uploadImageFile(file);
      setImageUrl(downloadUrl);
      if (bannerProcessed.isExact) {
        toast.success("Banner image uploaded with exact 485 × 210 px dimensions!");
      } else {
        toast.info(`Banner uploaded (${bannerProcessed.width}×${bannerProcessed.height} px). You can click "Auto-Fit to 485×210" if desired.`);
      }
    } catch (err: any) {
      console.warn("Background upload error, will auto-retry when saving:", err);
      const msg = err?.message || "Storage upload issue";
      toast.error(msg.includes("too large") ? "Image size too large. Please select a smaller file." : msg);
    } finally {
      setUploadingImage(false);
    }
  };

  // Auto-fit selected banner image to exact 485 × 210 canvas
  const handleAutoFitBanner = async () => {
    if (!selectedFile && !imagePreview && !imageUrl) return;
    try {
      setUploadingImage(true);
      let fileToFit = selectedFile;
      if (!fileToFit && (imagePreview || imageUrl)) {
        const res = await fetch(imagePreview || formatImageUrl(imageUrl));
        const blob = await res.blob();
        fileToFit = new File([blob], "banner.jpg", { type: blob.type || "image/jpeg" });
      }
      if (!fileToFit) return;

      const fitted = await processBannerImage(fileToFit, true);
      setSelectedFile(fitted.file);
      const localUrl = URL.createObjectURL(fitted.file);
      setImagePreview(localUrl);
      setDetectedDimensions({
        width: fitted.width,
        height: fitted.height,
        isExact: true,
      });

      const downloadUrl = await uploadImageFile(fitted.file);
      setImageUrl(downloadUrl);
      toast.success("Banner image successfully auto-fitted to 485 × 210 px!");
    } catch (err: any) {
      toast.error("Auto-fit failed: " + (err.message || "Unknown error"));
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
    setDetectedDimensions(null);
    setImageTab("upload");
    setProductSearch("");
    setSelectedCategory("cat_disease_management");
    setSelectedSubCategory("subcat_disease_detection");
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
    setDetectedDimensions(null);
    if (banner.imageUrl) {
      const img = new Image();
      img.onload = () => {
        setDetectedDimensions({
          width: img.width,
          height: img.height,
          isExact: img.width === 485 && img.height === 210,
        });
      };
      img.src = formatImageUrl(banner.imageUrl);
    }
    setImageTab(banner.imageUrl ? "upload" : "upload");
    setProductSearch("");
    const resolvedActionType = banner.actionType || (banner.bannerType === "offer_banners" ? "product" : "screen");
    setActionType(resolvedActionType);
    setActionValue(banner.actionValue || "");
    setPriority(Number(banner.priority) || 1);
    setIsActive(banner.isActive !== undefined ? Boolean(banner.isActive) : true);
    setSelectedProfiles(
      Array.isArray(banner.profiles) && banner.profiles.length > 0
        ? banner.profiles
        : ["farmer", "vet", "seller"]
    );

    // Initialize category / subcategory if editing a category action
    if (resolvedActionType === "category") {
      const val = banner.actionValue || "";
      if (val.startsWith("subcat_")) {
        const found = PRODUCT_CATEGORIES.find((c) => c.subcategories.some((s) => s.id === val));
        if (found) {
          setSelectedCategory(found.id);
          setSelectedSubCategory(val);
        }
      } else if (val.startsWith("cat_")) {
        setSelectedCategory(val);
        const subs = getSubcategoriesForCategory(val);
        if (subs.length > 0) setSelectedSubCategory(subs[0].id);
      }
    } else {
      setSelectedCategory("cat_disease_management");
      setSelectedSubCategory("subcat_disease_detection");
    }

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

    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Banner Active Status (Instant 0ms Optimistic Update)
  const handleToggle = async (banner: BannerItem) => {
    const newStatus = !banner.isActive;
    const prevStatus = banner.isActive;

    // 1. Immediately update TanStack React Query cache (0ms instant visual switch)
    queryClient.setQueryData<any>(["app_banners"], (old: any) => {
      if (!old) return old;
      const updateList = (list: BannerItem[]) =>
        (list || []).map((item) =>
          item.id === banner.id && item.bannerType === banner.bannerType
            ? { ...item, isActive: newStatus, updatedAt: new Date().toISOString() }
            : item
        );

      return {
        ...old,
        all: updateList(old.all),
        ads_banners: updateList(old.ads_banners),
        offer_banners: updateList(old.offer_banners),
      };
    });

    if (viewingDetailBanner && viewingDetailBanner.id === banner.id && viewingDetailBanner.bannerType === banner.bannerType) {
      setViewingDetailBanner({ ...viewingDetailBanner, isActive: newStatus });
    }

    toast.success(`Banner "${banner.id}" visibility updated`);

    // 2. Perform network operations asynchronously in parallel without blocking UI
    try {
      const bannerRef = doc(db, "banners", banner.bannerType, "items", banner.id);

      const backendPromise = fetch(`${API_BASE}/api/admin/banners/${banner.bannerType}/${banner.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newStatus }),
      }).catch((e) => console.warn("Backend toggle error (fallback to Firestore SDK):", e));

      const firestorePromise = setDoc(
        bannerRef,
        { isActive: newStatus, updatedAt: new Date().toISOString() },
        { merge: true }
      );

      await Promise.allSettled([backendPromise, firestorePromise]);
    } catch (err: any) {
      // Revert cache if error occurs
      console.error("Failed to update banner status:", err);
      queryClient.setQueryData<any>(["app_banners"], (old: any) => {
        if (!old) return old;
        const revertList = (list: BannerItem[]) =>
          (list || []).map((item) =>
            item.id === banner.id && item.bannerType === banner.bannerType
              ? { ...item, isActive: prevStatus }
              : item
          );

        return {
          ...old,
          all: revertList(old.all),
          ads_banners: revertList(old.ads_banners),
          offer_banners: revertList(old.offer_banners),
        };
      });

      if (viewingDetailBanner && viewingDetailBanner.id === banner.id && viewingDetailBanner.bannerType === banner.bannerType) {
        setViewingDetailBanner({ ...viewingDetailBanner, isActive: prevStatus });
      }

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
              <div className="text-xs text-muted-foreground font-medium">Published in App</div>
              <div className="text-2xl font-black text-primary mt-0.5">
                {isLoading ? <span className="inline-block h-7 w-12 bg-muted/70 rounded-lg animate-pulse" /> : activeCount}
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">Carousel banners</div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary grid place-items-center">
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
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate max-w-[220px]" title={`/banners/${banner.bannerType}/items/${banner.id}`}>
                      /banners/{banner.bannerType}/items/{banner.id}
                    </div>
                  </div>

                  {/* Visibility Switch Toggle */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={banner.isActive}
                      onCheckedChange={() => handleToggle(banner)}
                      title={banner.isActive ? "Hide from carousel" : "Show in carousel"}
                    />
                  </div>
                </div>

                {/* Target Action & Screen */}
                <div className="p-2.5 rounded-2xl bg-muted/40 border border-border/50 text-xs space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span className="flex items-center gap-1 font-medium">
                      <Smartphone className="h-3 w-3 text-primary" /> Action Type:
                    </span>
                    <strong className="text-foreground capitalize font-semibold">
                      {getActionTypeLabel(banner.actionType)}
                    </strong>
                  </div>
                  {banner.actionValue && (
                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span className="font-medium">Target:</span>
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
                <TableHead>Action Type</TableHead>
                <TableHead>Target Value</TableHead>
                <TableHead className="text-center">Priority</TableHead>
                <TableHead>profiles</TableHead>
                <TableHead className="text-center">Visibility</TableHead>
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
                    <span className="px-2.5 py-1 rounded-xl bg-primary/10 text-primary text-[11px] font-semibold inline-flex items-center gap-1.5">
                      {getActionTypeLabel(banner.actionType)}
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
        <DialogContent className="w-[96vw] max-w-2xl p-5 sm:p-6 rounded-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
                <ImageIcon className="h-4 w-4" />
              </div>
              <span className="truncate">Banner Details: {viewingDetailBanner?.id}</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-mono text-muted-foreground truncate">
              /banners/{viewingDetailBanner?.bannerType}/items/{viewingDetailBanner?.id}
            </DialogDescription>
          </DialogHeader>

          {viewingDetailBanner && (
            <div className="space-y-4 pt-1">
              {/* High Quality Banner Image View */}
              <div
                className="relative h-48 sm:h-56 w-full rounded-2xl overflow-hidden border bg-muted/40 cursor-pointer shadow-xs group flex items-center justify-center p-2"
                onClick={() => setZoomImage({ url: viewingDetailBanner.imageUrl, title: viewingDetailBanner.id })}
              >
                <img
                  src={formatImageUrl(viewingDetailBanner.imageUrl)}
                  alt={viewingDetailBanner.id}
                  className="max-h-full max-w-full object-contain rounded-xl shadow-xs"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-semibold rounded-2xl">
                  <Maximize2 className="h-4 w-4" /> Click to View Full Size
                </div>
              </div>

              {/* Specifications Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl border bg-muted/20 space-y-1">
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                    Action Type
                  </div>
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{getActionTypeLabel(viewingDetailBanner.actionType)}</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl border bg-muted/20 space-y-1 sm:col-span-2">
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                    Target Destination
                  </div>
                  <div className="text-xs font-bold font-mono text-primary truncate" title={viewingDetailBanner.actionValue}>
                    {viewingDetailBanner.actionValue || "—"}
                  </div>
                </div>
              </div>

              {/* Priority & Audience Roles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl border bg-muted/20 space-y-1">
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                    Display Priority
                  </div>
                  <div className="text-xs font-bold font-mono text-foreground flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      #{viewingDetailBanner.priority}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-normal">in carousel</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl border bg-muted/20 space-y-1 sm:col-span-2">
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                    Target Profiles
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {Array.isArray(viewingDetailBanner.profiles) && viewingDetailBanner.profiles.length > 0 ? (
                      viewingDetailBanner.profiles.map((p, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-0.5 rounded-lg bg-background border text-[11px] font-semibold text-foreground flex items-center gap-1 shadow-xs"
                        >
                          <Users className="h-3 w-3 text-primary" />
                          <span className="capitalize">{p}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">All profiles</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Image URL with Copy */}
              <div className="p-3 rounded-2xl border bg-muted/20 space-y-1.5">
                <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center justify-between">
                  <span>Banner Image URL</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] gap-1 rounded-lg text-primary hover:text-primary"
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
              <DialogFooter className="pt-3 flex flex-row items-center justify-between gap-2 border-t">
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
        <DialogContent className="w-[96vw] max-w-3xl max-h-[92vh] p-0 rounded-3xl overflow-hidden flex flex-col bg-background border border-border/70 shadow-2xl">
          {/* Modal Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-border/60 bg-muted/20 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`h-10 w-10 rounded-2xl grid place-items-center shadow-xs shrink-0 ${
                  formBannerType === "offer_banners"
                    ? "bg-amber-500/15 text-amber-600"
                    : "bg-primary/15 text-primary"
                }`}
              >
                {formBannerType === "offer_banners" ? (
                  <Tag className="h-5 w-5" />
                ) : (
                  <ImageIcon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                    {editingBanner ? `Edit Banner: ${docId}` : "Create New App Banner"}
                  </h2>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                      formBannerType === "offer_banners"
                        ? "border-amber-500/30 text-amber-700 bg-amber-500/10 dark:text-amber-300"
                        : "border-primary/30 text-primary bg-primary/10"
                    }`}
                  >
                    {formBannerType === "offer_banners" ? "Offer Banner" : "Ads Banner"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {formBannerType === "offer_banners"
                    ? "Marketplace product deal banner linking to a specific item"
                    : "Main app carousel banner for promotions, screens, or links"}
                </p>
              </div>
            </div>
          </div>

          {/* Modal Scrollable Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* 1. Category & Document ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-2xl border border-border/60">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Banner Category</span>
                  {editingBanner && (
                    <span className="text-[10px] text-muted-foreground font-normal">(Locked on edit)</span>
                  )}
                </Label>
                <Select
                  value={formBannerType}
                  onValueChange={(val: BannerType) => {
                    setFormBannerType(val);
                    if (val === "offer_banners") {
                      setActionType("product");
                      if (!actionValue || actionValue === "cattleMarketplace") {
                        setActionValue(marketplaceProducts[0]?.sku || marketplaceProducts[0]?.id || "VDD1-101-C01-500M");
                      }
                    } else if (actionType === "product") {
                      setActionType("screen");
                      setActionValue("cattleMarketplace");
                    }
                  }}
                  disabled={!!editingBanner}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ads_banners">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-3.5 w-3.5 text-primary" />
                        <span>Ads Banners (/banners/ads_banners/items)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="offer_banners">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-amber-600" />
                        <span>Offer Banners (/banners/offer_banners/items)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-[11px] text-muted-foreground">
                  {formBannerType === "offer_banners"
                    ? "Directs users to specific marketplace discounts"
                    : "Displayed in the main app banner carousel"}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Banner Document ID</span>
                  <span className="text-[10px] font-mono text-muted-foreground">Key</span>
                </Label>
                <Input
                  value={docId}
                  onChange={(e) => setDocId(e.target.value)}
                  placeholder="e.g. banner1, banner-festive"
                  disabled={!!editingBanner}
                  className="h-10 text-xs font-mono rounded-xl bg-background border-border"
                  required
                />
                <div className="text-[11px] text-muted-foreground">
                  Unique identifier in Firestore database collection
                </div>
              </div>
            </div>

            {/* 2. Banner Artwork & Media Upload */}
            <div className="bg-muted/20 p-4 sm:p-5 rounded-2xl border border-border/60 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      <span>Banner Artwork</span>
                    </Label>
                    <Badge variant="outline" className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200">
                      Required Dimension: 485 × 210 px
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Standard mobile app carousel banner ratio is 485 × 210 px (~2.31:1)
                  </p>
                </div>
                <div className="flex items-center rounded-xl bg-background border p-0.5 text-xs font-medium shrink-0">
                  <button
                    type="button"
                    onClick={() => setImageTab("upload")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      imageTab === "upload"
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageTab("url")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      imageTab === "url"
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Image URL
                  </button>
                </div>
              </div>

              {imageTab === "upload" ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {imagePreview || imageUrl ? (
                    <div className="rounded-2xl overflow-hidden border border-border/80 bg-background shadow-xs space-y-0">
                      <div className="relative w-full aspect-[485/210] max-h-56 bg-slate-900/90 dark:bg-black flex items-center justify-center p-2 group">
                        <img
                          src={imagePreview || formatImageUrl(imageUrl)}
                          alt="Banner Preview"
                          className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-xl text-xs gap-1.5 bg-white text-black hover:bg-slate-100 font-semibold"
                          >
                            <Upload className="h-3.5 w-3.5" /> Replace Image
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedFile(null);
                              setImagePreview("");
                              setImageUrl("");
                              setDetectedDimensions(null);
                            }}
                            className="rounded-xl text-xs gap-1.5 font-semibold"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </Button>
                        </div>
                      </div>

                      {/* Dimension and Auto-Fit action banner */}
                      <div className="p-3 bg-muted/40 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          {detectedDimensions ? (
                            detectedDimensions.isExact ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 text-[11px] font-semibold py-0.5">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Exact Dimension: 485 × 210 px
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 gap-1 text-[11px] font-semibold py-0.5">
                                  <AlertTriangle className="h-3.5 w-3.5" /> Uploaded: {detectedDimensions.width} × {detectedDimensions.height} px
                                </Badge>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={handleAutoFitBanner}
                                  disabled={uploadingImage}
                                  className="h-6 text-[11px] rounded-lg px-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs gap-1"
                                >
                                  <Sparkles className="h-3 w-3" /> Auto-Fit to 485 × 210 px
                                </Button>
                              </div>
                            )
                          ) : (
                            <span className="text-[11px] text-muted-foreground font-medium">
                              Target Dimension: 485 × 210 px
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {uploadingImage && (
                            <span className="text-primary font-semibold text-[11px] flex items-center gap-1">
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Uploading...
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-7 text-xs px-2.5 text-primary hover:text-primary font-semibold"
                          >
                            Change File
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border/80 hover:border-primary/80 transition-all rounded-2xl p-6 bg-background/50 hover:bg-background text-center cursor-pointer group space-y-2.5"
                    >
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mx-auto group-hover:scale-105 transition-transform">
                        <Upload className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          Click to browse banner image file
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Only image files (PNG, JPG, WebP) supported. Standard size: <strong className="text-foreground">485 × 210 px</strong>.
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                          <Sparkles className="h-3 w-3" /> Auto-fits & compresses to Firebase Storage
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <LinkIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={imageUrl}
                      onChange={(e) => {
                        setImageUrl(e.target.value);
                        setImagePreview(e.target.value);
                        if (e.target.value) {
                          const img = new Image();
                          img.onload = () => {
                            setDetectedDimensions({
                              width: img.width,
                              height: img.height,
                              isExact: img.width === 485 && img.height === 210,
                            });
                          };
                          img.src = e.target.value;
                        } else {
                          setDetectedDimensions(null);
                        }
                      }}
                      placeholder="Paste https://firebasestorage.googleapis.com/... or CDN image URL"
                      className="h-10 pl-9 text-xs font-mono rounded-xl bg-background border-border"
                    />
                  </div>
                  {(imagePreview || imageUrl) && (
                    <div className="rounded-2xl overflow-hidden border bg-background shadow-xs space-y-0">
                      <div className="relative w-full aspect-[485/210] max-h-56 bg-slate-900/90 dark:bg-black flex items-center justify-center p-2">
                        <img
                          src={imagePreview || formatImageUrl(imageUrl)}
                          alt="Banner Preview"
                          className="max-h-full max-w-full object-contain rounded-lg"
                        />
                      </div>
                      {detectedDimensions && (
                        <div className="p-2.5 bg-muted/40 border-t flex items-center justify-between text-xs">
                          {detectedDimensions.isExact ? (
                            <Badge className="bg-emerald-600 text-white gap-1 text-[11px] font-semibold py-0.5">
                              <CheckCircle2 className="h-3 w-3" /> Exact Dimension: 485 × 210 px
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 gap-1 text-[11px] font-semibold py-0.5">
                              <AlertTriangle className="h-3 w-3" /> Dimension: {detectedDimensions.width} × {detectedDimensions.height} px (Recommended: 485 × 210)
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Action Type & Navigation Target */}
            <div className="bg-muted/20 p-4 rounded-2xl border border-border/60 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Action Type (Tap Behavior)</span>
                    {formBannerType === "offer_banners" && (
                      <span className="text-[10px] text-amber-600 font-bold">product required</span>
                    )}
                  </Label>
                  <Select
                    value={actionType}
                    onValueChange={(val) => {
                      setActionType(val);
                      if (val === "product" && (!actionValue || actionValue === "cattleMarketplace")) {
                        setActionValue(marketplaceProducts[0]?.sku || marketplaceProducts[0]?.id || "VDD1-101-C01-500M");
                      } else if (val === "category") {
                        setActionValue(selectedCategory || "cat_disease_management");
                      } else if (val === "screen" && (actionValue.startsWith("VDD") || actionValue.includes("COMBO") || actionValue.startsWith("cat_") || actionValue.startsWith("subcat_"))) {
                        setActionValue("cattleMarketplace");
                      }
                    }}
                    disabled={formBannerType === "offer_banners"}
                  >
                    <SelectTrigger className="h-10 text-xs rounded-xl bg-background border-border">
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
                  <div className="text-[11px] text-muted-foreground">
                    Action executed when a customer taps this banner
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Target Destination Value</span>
                    <span className="text-[10px] font-mono text-muted-foreground">actionValue</span>
                  </Label>
                  <Input
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder={
                      actionType === "product" || formBannerType === "offer_banners"
                        ? "e.g. VDD1-101-C01-500M"
                        : "e.g. cattleMarketplace, openPashu"
                    }
                    className="h-10 text-xs font-mono rounded-xl bg-background border-border"
                    required
                  />
                  <div className="text-[11px] text-muted-foreground">
                    {actionType === "product" || formBannerType === "offer_banners"
                      ? "Product SKU or ID to open directly"
                      : "Screen route name or URL"}
                  </div>
                </div>
              </div>

              {/* Product Selector for Offer Banners and 'product' actions */}
              {(formBannerType === "offer_banners" || actionType === "product") && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                    <span className="flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-amber-600" />
                      <span>Select Target Product from Marketplace</span>
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-background">
                      {filteredProducts.length} items
                    </Badge>
                  </div>

                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Filter product by name, SKU, or category..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="h-9 pl-8 text-xs rounded-xl bg-background"
                    />
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1 rounded-xl border border-border/60 bg-background/80 p-1.5">
                    {filteredProducts.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        No products found matching your search.
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
                                ? "bg-amber-500/15 border border-amber-500/40 text-foreground font-semibold shadow-xs"
                                : "hover:bg-muted/50 text-foreground border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {img ? (
                                <img
                                  src={formatImageUrl(img)}
                                  alt={name}
                                  className="h-8 w-8 rounded-lg object-cover border shrink-0 bg-muted"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs shrink-0">
                                  📦
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-xs truncate flex items-center gap-1.5">
                                  <span className="truncate">{name}</span>
                                  {price && <span className="text-[11px] text-emerald-600 font-bold shrink-0">₹{price}</span>}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-mono truncate">
                                  SKU: <span className="text-foreground font-semibold">{sku}</span>
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {isSelected ? (
                                <Badge className="bg-amber-500 text-white font-semibold text-[10px] px-2 py-0.5 gap-1">
                                  <Check className="h-3 w-3" /> Selected
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-muted-foreground hover:text-foreground">
                                  Select
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Screen Shortcuts for 'screen' actions */}
              {actionType === "screen" && formBannerType !== "offer_banners" && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Quick Screen Shortcuts:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_SCREEN_SUGGESTIONS.map((sug) => (
                      <button
                        key={sug.value}
                        type="button"
                        onClick={() => setActionValue(sug.value)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-all border ${
                          actionValue === sug.value
                            ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                            : "bg-background text-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {sug.value}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category & Subcategory Selectors for 'category' actions */}
              {actionType === "category" && formBannerType !== "offer_banners" && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-primary/5 border border-primary/20">
                  <div className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-primary" />
                      <span>Select Target Marketplace Category & Subcategory</span>
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-background">
                      {PRODUCT_CATEGORIES.length} Categories
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Product Category</Label>
                      <Select
                        value={selectedCategory}
                        onValueChange={(val) => {
                          setSelectedCategory(val);
                          setActionValue(val);
                          const subs = getSubcategoriesForCategory(val);
                          if (subs.length > 0) {
                            setSelectedSubCategory(subs[0].id);
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 text-xs rounded-xl bg-background">
                          <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {PRODUCT_CATEGORIES.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold">{c.name}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">({c.id})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Subcategory Target (Optional)</Label>
                      <Select
                        value={selectedSubCategory}
                        onValueChange={(val) => {
                          setSelectedSubCategory(val);
                          setActionValue(val);
                        }}
                      >
                        <SelectTrigger className="h-10 text-xs rounded-xl bg-background">
                          <SelectValue placeholder="Select Subcategory" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {getSubcategoriesForCategory(selectedCategory).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold">{s.name}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">({s.id})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                    <span>Active Target Value: <code className="font-mono text-primary font-bold">{actionValue}</code></span>
                    <button
                      type="button"
                      onClick={() => setActionValue(selectedCategory)}
                      className="text-xs text-primary hover:underline font-semibold"
                    >
                      Target Whole Category
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Display Priority & Active Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-2xl border border-border/60 items-center">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Display Priority</span>
                  <span className="text-[10px] text-muted-foreground font-mono">1 = First</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value, 10) || 1)}
                    className="h-10 text-xs rounded-xl font-mono bg-background border-border"
                    required
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPriority(Math.max(1, priority - 1))}
                      className="h-10 w-9 p-0 rounded-xl"
                    >
                      -
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPriority(priority + 1)}
                      className="h-10 w-9 p-0 rounded-xl"
                    >
                      +
                    </Button>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Controls slide order in the mobile app carousel
                </div>
              </div>

              <div
                onClick={() => setIsActive(!isActive)}
                className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                  isActive
                    ? "bg-primary/10 border-primary/30 text-foreground"
                    : "bg-background border-border text-muted-foreground"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>{isActive ? "Visible in Mobile App" : "Hidden from Mobile App"}</span>
                  </div>
                  <div className="text-[11px] opacity-80">
                    {isActive ? "Slide displays in user carousel" : "Hidden from user carousel"}
                  </div>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* 5. Target Audience Profiles (Ads Banners only) */}
            {formBannerType === "ads_banners" ? (
              <div className="bg-muted/20 p-4 rounded-2xl border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-primary" />
                    <span>Target Audience Profiles</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedProfiles.length === TARGET_PROFILES.length
                      ? "All Users"
                      : `${selectedProfiles.length} roles selected`}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
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
                            : "bg-background text-muted-foreground border-border hover:bg-muted/60"
                        }`}
                      >
                        <span className="truncate">{tp.label}</span>
                        {isChecked ? (
                          <Check className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <Plus className="h-3.5 w-3.5 opacity-40 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Path Hint */}
            <div className="px-3 py-2 rounded-xl bg-muted/40 border border-border/50 text-[11px] text-muted-foreground font-mono flex items-center justify-between">
              <span>Target Firestore Path:</span>
              <span className="text-primary font-semibold truncate ml-2">
                /banners/{formBannerType}/items/{docId || "new_id"}
              </span>
            </div>

            {/* Modal Sticky Footer */}
            <div className="pt-3 border-t border-border/60 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="w-full sm:w-auto rounded-xl text-xs h-10 px-5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={uploadingImage || submitting}
                className="w-full sm:w-auto rounded-xl text-xs h-10 px-6 gap-1.5 font-bold"
              >
                {submitting || uploadingImage ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Saving Banner...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>{editingBanner ? "Save Changes" : "Create Banner"}</span>
                  </>
                )}
              </Button>
            </div>
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
