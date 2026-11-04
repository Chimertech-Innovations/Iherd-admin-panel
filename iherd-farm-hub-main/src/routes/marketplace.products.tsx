import { createFileRoute, Link } from "@tanstack/react-router";
import { processSquareImage, validateImageFile } from "@/lib/imageProcessor";
import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ShoppingBag,
  Plus,
  Search,
  Flame,
  Pencil,
  Trash2,
  Package,
  IndianRupee,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  Star,
  Truck,
  ShieldCheck,
  Building,
  Info,
  Scale,
  Calendar,
  Image as ImageIcon,
  ExternalLink,
  Maximize2,
  Tag,
  Check,
  HelpCircle,
  Download,
  X,
  MapPin,
  Upload,
  FolderTree,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminProducts, useFirebaseCollection, useBestSellers } from "@/hooks/useFirebaseData";
import { getLocalizedText, formatImageUrl } from "@/lib/utils";
import { getApiBaseUrlSync } from "@/lib/apiClient";

function convertToDirectImageUrl(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const driveMatch =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}=s800`;
  }
  return trimmed;
}
import {
  PRODUCT_CATEGORIES,
  getSubcategoriesForCategory,
  getCategoryName,
  getSubcategoryName,
} from "@/lib/categories";

const INDIAN_STATES = [
  { name: "Andhra Pradesh", code: "AP" },
  { name: "Arunachal Pradesh", code: "AR" },
  { name: "Assam", code: "AS" },
  { name: "Bihar", code: "BR" },
  { name: "Chhattisgarh", code: "CG" },
  { name: "Goa", code: "GA" },
  { name: "Gujarat", code: "GJ" },
  { name: "Haryana", code: "HR" },
  { name: "Himachal Pradesh", code: "HP" },
  { name: "Jharkhand", code: "JH" },
  { name: "Karnataka", code: "KA" },
  { name: "Kerala", code: "KL" },
  { name: "Madhya Pradesh", code: "MP" },
  { name: "Maharashtra", code: "MH" },
  { name: "Manipur", code: "MN" },
  { name: "Meghalaya", code: "ML" },
  { name: "Mizoram", code: "MZ" },
  { name: "Nagaland", code: "NL" },
  { name: "Odisha", code: "OD" },
  { name: "Punjab", code: "PB" },
  { name: "Rajasthan", code: "RJ" },
  { name: "Sikkim", code: "SK" },
  { name: "Tamil Nadu", code: "TN" },
  { name: "Telangana", code: "TS" },
  { name: "Tripura", code: "TR" },
  { name: "Uttar Pradesh", code: "UP" },
  { name: "Uttarakhand", code: "UK" },
  { name: "West Bengal", code: "WB" },
  { name: "Andaman and Nicobar Islands", code: "AN" },
  { name: "Chandigarh", code: "CH" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", code: "DD" },
  { name: "Delhi", code: "DL" },
  { name: "Jammu and Kashmir", code: "JK" },
  { name: "Ladakh", code: "LA" },
  { name: "Lakshadweep", code: "LD" },
  { name: "Puducherry", code: "PY" },
];
import { exportToCsv } from "@/lib/csvExport";

export const Route = createFileRoute("/marketplace/products")({
  head: () => ({ meta: [{ title: "Product Marketplace — iHerd Admin" }] }),
  component: ProductsMarketplacePage,
});

// Multi-Tier Resilient Product Image Component:
// 1. Direct formatted URL (handles Google Drive proxy or direct CDN)
// 2. Direct lh3 Google CDN (for Drive links)
// 3. Backend image proxy (/api/admin/proxy-image?url=...) (for Firebase Storage, external images, or CORS-restricted URLs)
// 4. Drive thumbnail endpoint
// 5. If all fail, seamlessly renders clean FallbackIcon badge without broken image icon
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
  const [errorIndex, setErrorIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  // Compute all potential fallback URLs in priority order
  const candidateUrls = useMemo(() => {
    if (!src || typeof src !== "string" || !src.trim()) return [];
    const trimmed = src.trim();
    const urls: string[] = [];

    // Formatted URL (e.g. via proxy or direct)
    const formatted = formatImageUrl(trimmed);
    if (formatted) urls.push(formatted);

    // If Google Drive link: try direct Google lh3 CDN & thumbnail
    const driveMatch =
      trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      const id = driveMatch[1];
      urls.push(`https://lh3.googleusercontent.com/d/${id}=s800`);
      urls.push(`https://drive.google.com/thumbnail?id=${id}&sz=w800`);
    }

    // Backend proxy fallback for any image URL (e.g. Firebase Storage with CORS or tokens)
    const base = getApiBaseUrlSync();
    const proxyUrl = `${base}/api/admin/proxy-image?url=${encodeURIComponent(trimmed)}`;
    if (!urls.includes(proxyUrl)) {
      urls.push(proxyUrl);
    }

    // Direct raw URL as last resort
    if (!urls.includes(trimmed)) {
      urls.push(trimmed);
    }

    // Deduplicate while preserving order
    return Array.from(new Set(urls.filter(Boolean)));
  }, [src]);

  // Reset error index if source changes
  useEffect(() => {
    setErrorIndex(0);
    setFailed(false);
  }, [src]);

  const currentUrl = candidateUrls[errorIndex];

  // If candidate URLs exhausted, failed, or invalid source, cleanly display FallbackIcon badge
  if (!currentUrl || errorIndex >= candidateUrls.length || failed) {
    return (
      <div className={`grid place-items-center bg-primary/10 text-primary ${className}`}>
        <FallbackIcon className="h-1/2 w-1/2" />
      </div>
    );
  }

  return (
    <img
      src={currentUrl}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        if (errorIndex + 1 < candidateUrls.length) {
          setErrorIndex((prev) => prev + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

function ProductsMarketplacePage() {
  const { data: products = [], isLoading, saveProduct, deleteProduct } = useAdminProducts();
  const { data: categories = [] } = useFirebaseCollection<any>("product_marketplace/main/categories");
  const { toggleBestSeller } = useBestSellers();

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Inspection & Preview Modals
  const [selectedProductDetail, setSelectedProductDetail] = useState<any | null>(null);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Edit / Add Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState("general");
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [optimisticBestSellers, setOptimisticBestSellers] = useState<Record<string, boolean>>({});

  // 1. Identity & Names (en, hi, kn, mr, pa, ta)
  const [productId, setProductId] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameHi, setNameHi] = useState("");
  const [nameKn, setNameKn] = useState("");
  const [nameMr, setNameMr] = useState("");
  const [namePa, setNamePa] = useState("");
  const [nameTa, setNameTa] = useState("");

  // 2. Categories
  const [categoryId, setCategoryId] = useState("cat_breeding");
  const [subCategoryId, setSubCategoryId] = useState("subcat_ai_equipment");

  // 3. Commercial Pricing & Tax
  const [price, setPrice] = useState("8850");
  const [mrp, setMrp] = useState("9999");
  const [gst, setGst] = useState("18");
  const [rating, setRating] = useState("4.5");
  const [bestSeller, setBestSeller] = useState(false);
  const [cartAddded, setCartAddded] = useState(false);

  // 4. Quantity & Units (en, hi, kn, mr, pa, ta)
  const [quantity, setQuantity] = useState("1000");
  const [quantityUnitEn, setQuantityUnitEn] = useState("Unit");
  const [quantityUnitHi, setQuantityUnitHi] = useState("इकाई");
  const [quantityUnitKn, setQuantityUnitKn] = useState("ಘಟಕ");
  const [quantityUnitMr, setQuantityUnitMr] = useState("युनिट");
  const [quantityUnitPa, setQuantityUnitPa] = useState("ਯੂਨਿਟ");
  const [quantityUnitTa, setQuantityUnitTa] = useState("அலகு");

  // 5. Weight & Units (en, hi, kn, mr, pa, ta)
  const [weight, setWeight] = useState("2500");
  const [weightUnitEn, setWeightUnitEn] = useState("g");
  const [weightUnitHi, setWeightUnitHi] = useState("ग्राम");
  const [weightUnitKn, setWeightUnitKn] = useState("g");
  const [weightUnitMr, setWeightUnitMr] = useState("g");
  const [weightUnitPa, setWeightUnitPa] = useState("ਗ੍ਰਾਮ");
  const [weightUnitTa, setWeightUnitTa] = useState("g");

  // 6. Seller Profile & Permissions (en, hi, kn, mr, pa, ta)
  const [sellerNameEn, setSellerNameEn] = useState("Chimertech");
  const [sellerNameHi, setSellerNameHi] = useState("Chimertech");
  const [sellerNameKn, setSellerNameKn] = useState("Chimertech");
  const [sellerNameMr, setSellerNameMr] = useState("Chimertech");
  const [sellerNamePa, setSellerNamePa] = useState("Chimertech");
  const [sellerNameTa, setSellerNameTa] = useState("Chimertech");
  const [sellerLogo, setSellerLogo] = useState("");
  const [sellerType, setSellerType] = useState("seller");
  const [postedByRole, setPostedByRole] = useState("admin");
  const [postedByUid, setPostedByUid] = useState("admin-root");

  // 7. Visual Media & Gallery
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [imageUrlsText, setImageUrlsText] = useState("");

  // 8. Description & Specifications (en, hi, kn, mr, pa, ta)
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionHi, setDescriptionHi] = useState("");
  const [descriptionKn, setDescriptionKn] = useState("");
  const [descriptionMr, setDescriptionMr] = useState("");
  const [descriptionPa, setDescriptionPa] = useState("");
  const [descriptionTa, setDescriptionTa] = useState("");

  const [specificationEn, setSpecificationEn] = useState("");
  const [specificationHi, setSpecificationHi] = useState("");
  const [specificationKn, setSpecificationKn] = useState("");
  const [specificationMr, setSpecificationMr] = useState("");
  const [specificationPa, setSpecificationPa] = useState("");
  const [specificationTa, setSpecificationTa] = useState("");

  // 9. Ingredients & Care (en, hi, kn, mr, pa, ta)
  const [productIngredientsEn, setProductIngredientsEn] = useState("");
  const [productIngredientsHi, setProductIngredientsHi] = useState("");
  const [productIngredientsKn, setProductIngredientsKn] = useState("");
  const [productIngredientsMr, setProductIngredientsMr] = useState("");
  const [productIngredientsPa, setProductIngredientsPa] = useState("");
  const [productIngredientsTa, setProductIngredientsTa] = useState("");

  const [usageEn, setUsageEn] = useState("");
  const [usageHi, setUsageHi] = useState("");

  const [instructionsToUseEn, setInstructionsToUseEn] = useState("");
  const [instructionsToUseHi, setInstructionsToUseHi] = useState("");
  const [instructionsToUseKn, setInstructionsToUseKn] = useState("");
  const [instructionsToUseMr, setInstructionsToUseMr] = useState("");
  const [instructionsToUsePa, setInstructionsToUsePa] = useState("");
  const [instructionsToUseTa, setInstructionsToUseTa] = useState("");

  const [storageConditionEn, setStorageConditionEn] = useState("");
  const [storageConditionHi, setStorageConditionHi] = useState("");
  const [storageConditionKn, setStorageConditionKn] = useState("");
  const [storageConditionMr, setStorageConditionMr] = useState("");
  const [storageConditionPa, setStorageConditionPa] = useState("");
  const [storageConditionTa, setStorageConditionTa] = useState("");

  const [bestBeforeEn, setBestBeforeEn] = useState("1 Year");
  const [bestBeforeHi, setBestBeforeHi] = useState("1 वर्ष");
  const [bestBeforeKn, setBestBeforeKn] = useState("1 ವರ್ಷ");
  const [bestBeforeMr, setBestBeforeMr] = useState("१ वर्ष");
  const [bestBeforePa, setBestBeforePa] = useState("1 ਸਾਲ");
  const [bestBeforeTa, setBestBeforeTa] = useState("1 ஆண்டு");

  // 10. Delivery Config
  const [deliveryType, setDeliveryType] = useState<string>("all");
  const [deliveryStates, setDeliveryStates] = useState<string[]>([]);
  const [stateSearchQuery, setStateSearchQuery] = useState("");

  const [status, setStatus] = useState("Approved");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [productFileFormatError, setProductFileFormatError] = useState<string | null>(null);

  // Field Validation Errors State (Highlights empty fields in red and shows alerts)
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  const clearFieldError = (f: string) => {
    setFieldErrors((prev) => {
      if (!prev[f]) return prev;
      const next = { ...prev };
      delete next[f];
      return next;
    });
  };

  // Quick Price Edit Dialog State
  const [quickPriceOpen, setQuickPriceOpen] = useState(false);
  const [quickProduct, setQuickProduct] = useState<any | null>(null);
  const [quickPriceVal, setQuickPriceVal] = useState("");
  const [quickMrpVal, setQuickMrpVal] = useState("");
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);

  // Image File Upload handler - Uploads to Firebase Storage via backend service account
  // Supports uploading one or multiple images simultaneously
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    let successCount = 0;
    const newUrls: string[] = [];

    try {
      const base = getApiBaseUrlSync();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        const val = validateImageFile(file);
        if (!val.valid || isPdf) {
          const errMsg = isPdf
            ? `PDF format is not supported for product images (${file.name})! Please upload only image files (PNG, JPG, WebP).`
            : (val.error || "Unsupported file format! Please upload only image files (PNG, JPEG, WebP).");
          setProductFileFormatError(errMsg);
          toast.error(errMsg);
          continue;
        }
        setProductFileFormatError(null);

        const isPrimary = i === 0 && !thumbnailUrl.trim();
        let processed;
        try {
          processed = await processSquareImage(file, isPrimary);
        } catch (procErr: any) {
          toast.error(`Image error for ${file.name}: ${procErr.message}`);
          continue;
        }

        const res = await fetch(`${base}/api/admin/upload-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64: processed.base64,
            filename: processed.file.name,
            contentType: processed.file.type || "image/webp",
            folder: "marketplace/products",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.url) {
            newUrls.push(data.url);
            successCount++;
            if (isPrimary) {
              toast.success(`Primary image formatted to 1:1 square & compressed to ${processed.sizeKB} KB (<= 20 KB limit)!`);
            }
          }
        }
      }

      if (newUrls.length > 0) {
        if (!thumbnailUrl.trim()) {
          setThumbnailUrl(newUrls[0]);
          if (newUrls.length > 1) {
            const extra = newUrls.slice(1).join("\n");
            setImageUrlsText((prev) => (prev ? `${prev}\n${extra}` : extra));
          }
        } else {
          const extra = newUrls.join("\n");
          setImageUrlsText((prev) => (prev ? `${prev}\n${extra}` : extra));
        }
        clearFieldError("images");
        toast.success(`Successfully uploaded ${successCount} product image(s) to Firebase Storage!`);
      } else {
        toast.error("Failed to upload image(s). Please verify the server connection.");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
    }
  };

  const openQuickPriceDialog = (p: any) => {
    setQuickProduct(p);
    setQuickPriceVal(String(p.price || 0));
    setQuickMrpVal(String(p.mrp || p.price || 0));
    setQuickPriceOpen(true);
  };

  const handleSaveQuickPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickProduct) return;
    const p = Number(quickPriceVal);
    const m = Number(quickMrpVal) || p;
    if (isNaN(p) || p <= 0) {
      toast.error("Please enter a valid selling price greater than ₹0");
      return;
    }
    if (m <= p) {
      toast.error(`Invalid Price Condition: MRP (₹${m.toLocaleString()}) must be strictly greater than Selling Price (₹${p.toLocaleString()}).`);
      return;
    }
    setIsUpdatingPrice(true);
    try {
      await saveProduct.mutateAsync({
        ...quickProduct,
        price: p,
        mrp: m,
        updatedAt: new Date().toISOString(),
      });
      setQuickPriceOpen(false);
      toast.success(`Price for "${getLocalizedText(quickProduct.name)}" updated to ₹${p.toLocaleString()}! Balance data preserved.`);
    } catch (err: any) {
      toast.error(`Failed to update price: ${err.message}`);
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  // Category mapping
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat) => {
      map.set(cat.id, getLocalizedText(cat.name, cat.id));
    });
    return map;
  }, [categories]);

  const openAddModal = () => {
    setFieldErrors({});
    setEditingProduct(null);
    setProductId(`PRD-${Date.now().toString().slice(-6)}`);
    setNameEn("");
    setNameHi("");
    setNameKn("");
    setNameMr("");
    setNamePa("");
    setNameTa("");

    setCategoryId(categories[0]?.id || "cat_breeding");
    setSubCategoryId("subcat_breeding_detection");

    setPrice("360");
    setMrp("519");
    setGst("5");
    setRating("4.5");
    setBestSeller(false);
    setCartAddded(false);

    setQuantity("1000");
    setQuantityUnitEn("Unit");
    setQuantityUnitHi("इकाई");
    setQuantityUnitKn("ಘಟಕ");
    setQuantityUnitMr("युनिट");
    setQuantityUnitPa("ਯੂਨਿਟ");
    setQuantityUnitTa("அலகு");

    setWeight("250");
    setWeightUnitEn("g");
    setWeightUnitHi("ग्राम");
    setWeightUnitKn("g");
    setWeightUnitMr("g");
    setWeightUnitPa("ਗ੍ਰਾਮ");
    setWeightUnitTa("g");

    setSellerNameEn("Chimertech");
    setSellerNameHi("Chimertech");
    setSellerNameKn("Chimertech");
    setSellerNameMr("Chimertech");
    setSellerNamePa("Chimertech");
    setSellerNameTa("Chimertech");
    setSellerLogo("https://drive.google.com/file/d/1x72e_nlxXIzwHtgzvXcGFReKwgOBAIP4/view?usp=sharing");
    setSellerType("seller");
    setPostedByRole("admin");
    setPostedByUid("admin-root");

    setThumbnailUrl("");
    setImageUrlsText("");

    setDescriptionEn("");
    setDescriptionHi("");
    setDescriptionKn("");
    setDescriptionMr("");
    setDescriptionPa("");
    setDescriptionTa("");

    setSpecificationEn("");
    setSpecificationHi("");
    setSpecificationKn("");
    setSpecificationMr("");
    setSpecificationPa("");
    setSpecificationTa("");

    setProductIngredientsEn("");
    setProductIngredientsHi("");
    setProductIngredientsKn("");
    setProductIngredientsMr("");
    setProductIngredientsPa("");
    setProductIngredientsTa("");

    setUsageEn("");
    setUsageHi("");

    setInstructionsToUseEn("");
    setInstructionsToUseHi("");
    setInstructionsToUseKn("");
    setInstructionsToUseMr("");
    setInstructionsToUsePa("");
    setInstructionsToUseTa("");

    setStorageConditionEn("°C to 15°C");
    setStorageConditionHi("°C से 15°C तक");
    setStorageConditionKn("°C ರಿಂದ 15°C ವರೆಗೆ");
    setStorageConditionMr("°C ते १५°C");
    setStorageConditionPa("°C ਤੋਂ 15°C ਤੱਕ");
    setStorageConditionTa("°C முதல் 15°C வரை");

    setBestBeforeEn("1 Year");
    setBestBeforeHi("1 वर्ष");
    setBestBeforeKn("1 ವರ್ಷ");
    setBestBeforeMr("१ वर्ष");
    setBestBeforePa("1 ਸਾਲ");
    setBestBeforeTa("1 ஆண்டு");

    setDeliveryType("all");
    setDeliveryStates([]);
    setStateSearchQuery("");

    setStatus("Approved");
    setModalTab("general");
    setModalOpen(true);
  };

  const openEditModal = (p: any) => {
    setFieldErrors({});
    setEditingProduct(p);
    setProductId(p.id || "");

    // Name Map (en, hi, kn, mr, pa, ta)
    if (typeof p.name === "object" && p.name !== null) {
      const en = p.name.en || Object.values(p.name)[0] || "";
      setNameEn(en);
      setNameHi(p.name.hi || en);
      setNameKn(p.name.kn || en);
      setNameMr(p.name.mr || en);
      setNamePa(p.name.pa || en);
      setNameTa(p.name.ta || en);
    } else {
      const s = String(p.name || p.title || "");
      setNameEn(s);
      setNameHi(s);
      setNameKn(s);
      setNameMr(s);
      setNamePa(s);
      setNameTa(s);
    }

    setCategoryId(p.categoryId || "cat_breeding");
    setSubCategoryId(p.subCategoryId || "subcat_breeding_detection");

    setPrice(String(p.price || 0));
    setMrp(String(p.mrp || p.price || 0));
    setGst(String(p.gst !== undefined ? p.gst : 5));
    setRating(String(p.rating || 4.5));
    setBestSeller(Boolean(p.bestSeller || p.isBestSeller));
    setCartAddded(Boolean(p.cartAddded || p.cartAdded));

    // Quantity & Quantity Unit Map
    setQuantity(String(p.quantity !== undefined ? p.quantity : (p.stock !== undefined ? p.stock : 1000)));
    if (typeof p.quantityUnit === "object" && p.quantityUnit !== null) {
      const quEn = p.quantityUnit.en || "Unit";
      setQuantityUnitEn(quEn);
      setQuantityUnitHi(p.quantityUnit.hi || quEn);
      setQuantityUnitKn(p.quantityUnit.kn || quEn);
      setQuantityUnitMr(p.quantityUnit.mr || quEn);
      setQuantityUnitPa(p.quantityUnit.pa || quEn);
      setQuantityUnitTa(p.quantityUnit.ta || quEn);
    } else {
      const s = String(p.quantityUnit || "Unit");
      setQuantityUnitEn(s);
      setQuantityUnitHi(s);
      setQuantityUnitKn(s);
      setQuantityUnitMr(s);
      setQuantityUnitPa(s);
      setQuantityUnitTa(s);
    }

    // Weight & Weight Unit Map
    setWeight(String(p.weight || 0));
    if (typeof p.weightUnit === "object" && p.weightUnit !== null) {
      const wuEn = p.weightUnit.en || p.weightUnit.key || "g";
      setWeightUnitEn(wuEn);
      setWeightUnitHi(p.weightUnit.hi || wuEn);
      setWeightUnitKn(p.weightUnit.kn || wuEn);
      setWeightUnitMr(p.weightUnit.mr || wuEn);
      setWeightUnitPa(p.weightUnit.pa || wuEn);
      setWeightUnitTa(p.weightUnit.ta || wuEn);
    } else {
      const s = String(p.weightUnit || "g");
      setWeightUnitEn(s);
      setWeightUnitHi(s);
      setWeightUnitKn(s);
      setWeightUnitMr(s);
      setWeightUnitPa(s);
      setWeightUnitTa(s);
    }

    // Seller Profile Map
    if (typeof p.sellerName === "object" && p.sellerName !== null) {
      const sEn = p.sellerName.en || Object.values(p.sellerName)[0] || "Chimertech";
      setSellerNameEn(sEn);
      setSellerNameHi(p.sellerName.hi || sEn);
      setSellerNameKn(p.sellerName.kn || sEn);
      setSellerNameMr(p.sellerName.mr || sEn);
      setSellerNamePa(p.sellerName.pa || sEn);
      setSellerNameTa(p.sellerName.ta || sEn);
    } else {
      const s = String(p.sellerName || "Chimertech");
      setSellerNameEn(s);
      setSellerNameHi(s);
      setSellerNameKn(s);
      setSellerNameMr(s);
      setSellerNamePa(s);
      setSellerNameTa(s);
    }
    setSellerLogo(p.sellerLogo || "");
    setSellerType(p.sellerType || "seller");
    setPostedByRole(p.postedByRole || "admin");
    setPostedByUid(p.postedByUid || "admin-root");

    // Images
    const thumb = p.thumbnailUrl || (Array.isArray(p.imageUrls) ? p.imageUrls[0] : "") || (Array.isArray(p.images) ? p.images[0] : "") || "";
    setThumbnailUrl(thumb);
    const urls = Array.isArray(p.imageUrls) ? p.imageUrls : (Array.isArray(p.images) ? p.images : (thumb ? [thumb] : []));
    setImageUrlsText(urls.join("\n"));

    // Description Map
    if (typeof p.description === "object" && p.description !== null) {
      const dEn = p.description.en || Object.values(p.description)[0] || "";
      setDescriptionEn(dEn);
      setDescriptionHi(p.description.hi || dEn);
      setDescriptionKn(p.description.kn || dEn);
      setDescriptionMr(p.description.mr || dEn);
      setDescriptionPa(p.description.pa || dEn);
      setDescriptionTa(p.description.ta || dEn);
    } else {
      const s = String(p.description || "");
      setDescriptionEn(s);
      setDescriptionHi(s);
      setDescriptionKn(s);
      setDescriptionMr(s);
      setDescriptionPa(s);
      setDescriptionTa(s);
    }

    // Specification Map
    if (typeof p.specification === "object" && p.specification !== null) {
      const spEn = p.specification.en || Object.values(p.specification)[0] || "";
      setSpecificationEn(spEn);
      setSpecificationHi(p.specification.hi || spEn);
      setSpecificationKn(p.specification.kn || spEn);
      setSpecificationMr(p.specification.mr || spEn);
      setSpecificationPa(p.specification.pa || spEn);
      setSpecificationTa(p.specification.ta || spEn);
    } else {
      const s = String(p.specification || "");
      setSpecificationEn(s);
      setSpecificationHi(s);
      setSpecificationKn(s);
      setSpecificationMr(s);
      setSpecificationPa(s);
      setSpecificationTa(s);
    }

    // Product Ingredients Map
    const getVal = (val: any) => Array.isArray(val) ? val.join(", ") : (val || "");
    if (typeof p.productIngredients === "object" && p.productIngredients !== null) {
      const ingEn = getVal(p.productIngredients.en) || getVal(Object.values(p.productIngredients)[0]) || "";
      setProductIngredientsEn(ingEn);
      setProductIngredientsHi(getVal(p.productIngredients.hi) || ingEn);
      setProductIngredientsKn(getVal(p.productIngredients.kn) || ingEn);
      setProductIngredientsMr(getVal(p.productIngredients.mr) || ingEn);
      setProductIngredientsPa(getVal(p.productIngredients.pa) || ingEn);
      setProductIngredientsTa(getVal(p.productIngredients.ta) || ingEn);
    } else {
      const s = String(p.productIngredients || "");
      setProductIngredientsEn(s);
      setProductIngredientsHi(s);
      setProductIngredientsKn(s);
      setProductIngredientsMr(s);
      setProductIngredientsPa(s);
      setProductIngredientsTa(s);
    }

    // Usage Map
    if (typeof p.usage === "object" && p.usage !== null) {
      const uEn = p.usage.en || Object.values(p.usage)[0] || "";
      setUsageEn(uEn);
      setUsageHi(p.usage.hi || uEn);
    } else {
      const s = String(p.usage || "");
      setUsageEn(s);
      setUsageHi(s);
    }

    // Instructions to Use Map
    const getLines = (val: any) => Array.isArray(val) ? val.join("\n") : (val || "");
    if (typeof p.instructionsToUse === "object" && p.instructionsToUse !== null) {
      const instEn = getLines(p.instructionsToUse.en) || getLines(Object.values(p.instructionsToUse)[0]) || "";
      setInstructionsToUseEn(instEn);
      setInstructionsToUseHi(getLines(p.instructionsToUse.hi) || instEn);
      setInstructionsToUseKn(getLines(p.instructionsToUse.kn) || instEn);
      setInstructionsToUseMr(getLines(p.instructionsToUse.mr) || instEn);
      setInstructionsToUsePa(getLines(p.instructionsToUse.pa) || instEn);
      setInstructionsToUseTa(getLines(p.instructionsToUse.ta) || instEn);
    } else {
      const s = String(p.instructionsToUse || "");
      setInstructionsToUseEn(s);
      setInstructionsToUseHi(s);
      setInstructionsToUseKn(s);
      setInstructionsToUseMr(s);
      setInstructionsToUsePa(s);
      setInstructionsToUseTa(s);
    }

    // Storage Condition Map
    if (typeof p.storageCondition === "object" && p.storageCondition !== null) {
      const scEn = getVal(p.storageCondition.en) || getVal(Object.values(p.storageCondition)[0]) || "°C to 15°C";
      setStorageConditionEn(scEn);
      setStorageConditionHi(getVal(p.storageCondition.hi) || scEn);
      setStorageConditionKn(getVal(p.storageCondition.kn) || scEn);
      setStorageConditionMr(getVal(p.storageCondition.mr) || scEn);
      setStorageConditionPa(getVal(p.storageCondition.pa) || scEn);
      setStorageConditionTa(getVal(p.storageCondition.ta) || scEn);
    } else {
      const s = String(p.storageCondition || "°C to 15°C");
      setStorageConditionEn(s);
      setStorageConditionHi("°C से 15°C तक");
      setStorageConditionKn("°C ರಿಂದ 15°C ವರೆಗೆ");
      setStorageConditionMr("°C ते १५°C");
      setStorageConditionPa("°C ਤੋਂ 15°C ਤੱਕ");
      setStorageConditionTa("°C முதல் 15°C வரை");
    }

    // Best Before Map
    const bb = p.bestBefore || p.best_before;
    if (typeof bb === "object" && bb !== null) {
      const bbEn = bb.en || Object.values(bb)[0] || "1 Year";
      setBestBeforeEn(bbEn);
      setBestBeforeHi(bb.hi || bbEn);
      setBestBeforeKn(bb.kn || bbEn);
      setBestBeforeMr(bb.mr || bbEn);
      setBestBeforePa(bb.pa || bbEn);
      setBestBeforeTa(bb.ta || bbEn);
    } else {
      const s = String(bb || "1 Year");
      setBestBeforeEn(s);
      setBestBeforeHi("1 वर्ष");
      setBestBeforeKn("1 ವರ್ಷ");
      setBestBeforeMr("१ वर्ष");
      setBestBeforePa("1 ਸਾਲ");
      setBestBeforeTa("1 ஆண்டு");
    }

    // Delivery Config
    const dc = p.deliveryConfig;
    if (!dc || !dc.type || dc.type === "all") {
      setDeliveryType("all");
      setDeliveryStates([]);
    } else {
      setDeliveryType(dc.type || "exclude");
      setDeliveryStates(Array.isArray(dc.states) ? dc.states : []);
    }
    setStateSearchQuery("");

    setStatus(getLocalizedText(p.status, "Approved"));
    setModalTab("general");
    setModalOpen(true);
  };

  const toStr = (val: any): string => {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") return val.trim();
    if (typeof val === "object") return getLocalizedText(val, "").trim();
    return String(val).trim();
  };

  const handleCopyEnglishToAllLanguages = () => {
    if (!toStr(nameEn) && !toStr(descriptionEn) && !toStr(specificationEn) && !toStr(instructionsToUseEn) && !toStr(productIngredientsEn)) {
      toast.error("Please fill in English fields first before copying to other languages.");
      return;
    }
    if (toStr(nameEn)) {
      if (!nameHi) setNameHi(nameEn);
      if (!nameKn) setNameKn(nameEn);
      if (!nameMr) setNameMr(nameEn);
      if (!namePa) setNamePa(nameEn);
      if (!nameTa) setNameTa(nameEn);
    }
    if (toStr(descriptionEn)) {
      if (!descriptionHi) setDescriptionHi(descriptionEn);
      if (!descriptionKn) setDescriptionKn(descriptionEn);
      if (!descriptionMr) setDescriptionMr(descriptionEn);
      if (!descriptionPa) setDescriptionPa(descriptionPa ? descriptionPa : descriptionEn);
      if (!descriptionTa) setDescriptionTa(descriptionEn);
    }
    if (toStr(specificationEn)) {
      if (!specificationHi) setSpecificationHi(specificationEn);
      if (!specificationKn) setSpecificationKn(specificationEn);
      if (!specificationMr) setSpecificationMr(specificationEn);
      if (!specificationPa) setSpecificationPa(specificationEn);
      if (!specificationTa) setSpecificationTa(specificationEn);
    }
    if (toStr(instructionsToUseEn)) {
      if (!instructionsToUseHi) setInstructionsToUseHi(instructionsToUseEn);
      if (!instructionsToUseKn) setInstructionsToUseKn(instructionsToUseEn);
      if (!instructionsToUseMr) setInstructionsToUseMr(instructionsToUseEn);
      if (!instructionsToUsePa) setInstructionsToUsePa(instructionsToUseEn);
      if (!instructionsToUseTa) setInstructionsToUseTa(instructionsToUseEn);
    }
    if (toStr(productIngredientsEn)) {
      if (!productIngredientsHi) setProductIngredientsHi(productIngredientsEn);
      if (!productIngredientsKn) setProductIngredientsKn(productIngredientsEn);
      if (!productIngredientsMr) setProductIngredientsMr(productIngredientsEn);
      if (!productIngredientsPa) setProductIngredientsPa(productIngredientsEn);
      if (!productIngredientsTa) setProductIngredientsTa(productIngredientsEn);
    }
    setFieldErrors({});
    toast.success("English content copied to all regional languages (Hindi, Kannada, Marathi, Punjabi, Tamil)!");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validation for Required Fields (English is primary; other languages auto-populate if left blank)
    setFieldErrors({});

    if (!toStr(nameEn)) {
      setFieldErrors({ name_en: true, name: true });
      setModalTab("general");
      toast.error("Required field missing: Product Name (English). Please enter a name.");
      return;
    }

    const numPrice = Number(price);
    if (!price || isNaN(numPrice) || numPrice <= 0) {
      setFieldErrors({ price: true });
      setModalTab("general");
      toast.error("Required field missing: Selling Price. Please enter a valid price greater than ₹0.");
      return;
    }

    const numMrp = Number(mrp);
    if (!mrp || isNaN(numMrp) || numMrp <= 0) {
      setFieldErrors({ mrp: true });
      setModalTab("general");
      toast.error("Required field missing: MRP Price. Please enter a valid MRP greater than ₹0.");
      return;
    }

    if (numMrp <= numPrice) {
      setFieldErrors({ mrp: true, price: true });
      setModalTab("general");
      toast.error(`Invalid Price Condition: MRP (₹${numMrp.toLocaleString()}) must be strictly greater than Selling Price (₹${numPrice.toLocaleString()}).`);
      return;
    }

    if (!categoryId) {
      setFieldErrors({ categoryId: true });
      setModalTab("general");
      toast.error("Required field missing: Product Category. Please select a category from the dropdown.");
      return;
    }

    const numWeight = Number(weight);
    if (!weight || isNaN(numWeight) || numWeight <= 0) {
      setFieldErrors({ weight: true });
      setModalTab("units");
      toast.error("Required field missing: Product Weight. Please enter a valid weight greater than 0.");
      return;
    }

    if (!toStr(descriptionEn)) {
      setFieldErrors({ description_en: true, description: true });
      setModalTab("specs");
      toast.error("Required field missing: Product Description (English).");
      return;
    }

    // Parse image URLs list
    const rawImages = toStr(imageUrlsText)
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const rawThumb = toStr(thumbnailUrl) || (rawImages.length > 0 ? rawImages[0] : "");
    const finalThumbnail = convertToDirectImageUrl(rawThumb);
    const finalImageUrls = Array.from(
      new Set([finalThumbnail, ...rawImages.map((u) => convertToDirectImageUrl(u))].filter(Boolean))
    );

    if (finalImageUrls.length === 0) {
      setFieldErrors({ images: true });
      setModalTab("media");
      toast.error("Required field missing: Product Image. Please upload or provide at least one product image.");
      return;
    }

    const selectedCategoryObj = categories.find((c) => c.id === categoryId);
    const categoryNameEn = selectedCategoryObj ? getLocalizedText(selectedCategoryObj.name, categoryId) : "Breeding";
    const subCategoryNameEn = toStr(subCategoryId).replace(/^subcat_/, "").replace(/_/g, " ");

    const makeMultiLang = (enVal: string, hiVal: string, knVal: string, mrVal: string, paVal: string, taVal: string, fallback = "", ex?: any) => {
      const e = toStr(enVal) || toStr(hiVal) || fallback;
      const exObj = ex && typeof ex === "object" ? ex : {};
      return {
        en: e,
        hi: toStr(hiVal) || exObj.hi || e,
        kn: toStr(knVal) || exObj.kn || e,
        mr: toStr(mrVal) || exObj.mr || e,
        pa: toStr(paVal) || exObj.pa || e,
        ta: toStr(taVal) || exObj.ta || e,
      };
    };

    // EXACT 100% Match for Flutter `ProductListingEntity` Model & Types with all 6 regional languages
    // Preserves ALL existing balance data from editingProduct
    const payload: any = {
      ...(editingProduct || {}),
      id: toStr(productId) || editingProduct?.id || `PRD-${Date.now()}`,
      
      // Map<String, dynamic> name (en, hi, kn, mr, pa, ta)
      name: makeMultiLang(nameEn, nameHi, nameKn, nameMr, namePa, nameTa, "Product", editingProduct?.name),

      // Map<String, dynamic> sellerName (en, hi, kn, mr, pa, ta)
      sellerName: makeMultiLang(sellerNameEn, sellerNameHi, sellerNameKn, sellerNameMr, sellerNamePa, sellerNameTa, "Chimertech", editingProduct?.sellerName),

      // String sellerLogo
      sellerLogo: toStr(sellerLogo) || editingProduct?.sellerLogo || "",

      // String? postedByRole
      postedByRole: toStr(postedByRole) || editingProduct?.postedByRole || "admin",

      // String? postedByUid
      postedByUid: toStr(postedByUid) || editingProduct?.postedByUid || "admin-root",

      // List<String> imageUrls
      imageUrls: finalImageUrls.length > 0 ? finalImageUrls : (editingProduct?.imageUrls || []),

      // String thumbnailUrl
      thumbnailUrl: finalThumbnail || editingProduct?.thumbnailUrl || "",

      // Map<String, dynamic> description (en, hi, kn, mr, pa, ta)
      description: makeMultiLang(descriptionEn, descriptionHi, descriptionKn, descriptionMr, descriptionPa, descriptionTa, "", editingProduct?.description),

      // double price
      price: Number(price) || 0.0,

      // double mrp
      mrp: Number(mrp) || Number(price) || 0.0,

      // double? rating
      rating: Number(rating) || 4.5,

      // int quantity
      quantity: Math.round(Number(quantity) || 1),

      // double weight
      weight: Number(weight) || 0.0,

      // Map<String, dynamic> weightUnit (en, hi, kn, mr, pa, ta)
      weightUnit: makeMultiLang(weightUnitEn, weightUnitHi, weightUnitKn, weightUnitMr, weightUnitPa, weightUnitTa, "g", editingProduct?.weightUnit),

      // Map<String, dynamic> quantityUnit (en, hi, kn, mr, pa, ta)
      quantityUnit: makeMultiLang(quantityUnitEn, quantityUnitHi, quantityUnitKn, quantityUnitMr, quantityUnitPa, quantityUnitTa, "Unit", editingProduct?.quantityUnit),

      // Map<String, dynamic>? usage
      usage: toStr(usageEn) || toStr(usageHi) ? {
        en: toStr(usageEn) || toStr(usageHi),
        ...(toStr(usageHi) ? { hi: toStr(usageHi) } : {}),
      } : (editingProduct?.usage ?? null),

      // Map<String, dynamic>? storageCondition (en, hi, kn, mr, pa, ta)
      storageCondition: makeMultiLang(storageConditionEn, storageConditionHi, storageConditionKn, storageConditionMr, storageConditionPa, storageConditionTa, "°C to 15°C", editingProduct?.storageCondition),

      // Map<String, dynamic>? specification (en, hi, kn, mr, pa, ta)
      specification: makeMultiLang(specificationEn, specificationHi, specificationKn, specificationMr, specificationPa, specificationTa, "", editingProduct?.specification),

      // Map<String, dynamic>? instructionsToUse (en, hi, kn, mr, pa, ta)
      instructionsToUse: makeMultiLang(instructionsToUseEn, instructionsToUseHi, instructionsToUseKn, instructionsToUseMr, instructionsToUsePa, instructionsToUseTa, "", editingProduct?.instructionsToUse),

      // Map<String, dynamic>? productIngredients (en, hi, kn, mr, pa, ta)
      productIngredients: makeMultiLang(productIngredientsEn, productIngredientsHi, productIngredientsKn, productIngredientsMr, productIngredientsPa, productIngredientsTa, "", editingProduct?.productIngredients),

      // String categoryId
      categoryId: toStr(categoryId),

      // String subCategoryId
      subCategoryId: toStr(subCategoryId),

      // Map<String, String>? category (en, hi, kn, mr, pa, ta)
      category: makeMultiLang(categoryNameEn, selectedCategoryObj?.name?.hi || categoryNameEn, selectedCategoryObj?.name?.kn || categoryNameEn, selectedCategoryObj?.name?.mr || categoryNameEn, selectedCategoryObj?.name?.pa || categoryNameEn, selectedCategoryObj?.name?.ta || categoryNameEn, "Breeding", editingProduct?.category),

      // Map<String, String>? subCategory (en, hi, kn, mr, pa, ta)
      subCategory: makeMultiLang(subCategoryNameEn, subCategoryNameEn, subCategoryNameEn, subCategoryNameEn, subCategoryNameEn, subCategoryNameEn, "breeding detection", editingProduct?.subCategory),

      // String sellerType
      sellerType: toStr(sellerType) || editingProduct?.sellerType || "seller",

      // double gst
      gst: Number(gst) || 5.0,

      // Map<String, dynamic>? bestBefore & best_before (en, hi, kn, mr, pa, ta)
      bestBefore: makeMultiLang(bestBeforeEn, bestBeforeHi, bestBeforeKn, bestBeforeMr, bestBeforePa, bestBeforeTa, "1 Year", editingProduct?.bestBefore),
      best_before: makeMultiLang(bestBeforeEn, bestBeforeHi, bestBeforeKn, bestBeforeMr, bestBeforePa, bestBeforeTa, "1 Year", editingProduct?.best_before),

      // bool? cartAddded
      cartAddded: Boolean(cartAddded),

      // bool bestSeller & isBestSeller
      bestSeller: Boolean(bestSeller),
      isBestSeller: Boolean(bestSeller),

      // bool isActive (strictly boolean for Flutter mobile app)
      isActive: true,

      // DeliveryConfig? deliveryConfig (null deletes mapping from Firestore, object creates/updates)
      deliveryConfig: deliveryType === "all" ? null : {
        type: deliveryType,
        states: deliveryStates,
      },
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveProduct.mutateAsync(payload);
      toast.success(editingProduct ? `Updated "${getLocalizedText(payload.name)}" successfully!` : `Created product "${getLocalizedText(payload.name)}" successfully!`);
      setModalOpen(false);
    } catch (err: any) {
      toast.error(`Failed to save product: ${err.message}`);
    }
  };

  const handleDelete = async (p: any) => {
    const pName = getLocalizedText(p.name || p.title, p.id);
    if (!confirm(`Are you sure you want to delete "${pName}"? This action cannot be undone.`)) return;
    try {
      await deleteProduct.mutateAsync(p.id);
      toast.success(`Product "${pName}" deleted.`);
    } catch (err: any) {
      toast.error(`Failed to delete product: ${err.message}`);
    }
  };

  const isProductBestSeller = (p: any) => {
    if (!p) return false;
    if (optimisticBestSellers[p.id] !== undefined) {
      return optimisticBestSellers[p.id];
    }
    return Boolean(p.bestSeller || p.isBestSeller);
  };

  const handleToggleBestSeller = async (p: any) => {
    const currentBs = isProductBestSeller(p);
    const nextBs = !currentBs;
    // Instant optimistic visual feedback!
    setOptimisticBestSellers((prev) => ({ ...prev, [p.id]: nextBs }));
    try {
      await toggleBestSeller.mutateAsync({
        productId: p.id,
        isBestSeller: nextBs,
      });
      toast.success(nextBs ? `Marked "${getLocalizedText(p.name || p.title)}" as Best Seller` : `Removed Best Seller status`);
    } catch (err: any) {
      setOptimisticBestSellers((prev) => ({ ...prev, [p.id]: currentBs }));
      toast.error(`Error updating best seller: ${err.message}`);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      const pName = getLocalizedText(p.name || p.title, "").toLowerCase();
      const pId = String(p.id || "").toLowerCase();
      const pSeller = getLocalizedText(p.sellerName, "").toLowerCase();
      const queryStr = q.toLowerCase().trim();
      const pSku = String(p.sku || p.SKU || "").toLowerCase();
      const pBrand = String(p.brand || p.brandName || "").toLowerCase();
      const pSellerId = String(p.sellerId || p.sellerUid || "").toLowerCase();
      const pCategory = String(p.category || p.categoryName || categoryMap.get(p.categoryId) || "").toLowerCase();

      const matchQ =
        !queryStr ||
        pName.includes(queryStr) ||
        pId.includes(queryStr) ||
        pSeller.includes(queryStr) ||
        pSku.includes(queryStr) ||
        pBrand.includes(queryStr) ||
        pSellerId.includes(queryStr) ||
        pCategory.includes(queryStr);

      const pStatus = (getLocalizedText(p.status, "Approved")).toLowerCase();
      const isBs = isProductBestSeller(p);

      let matchFilter = true;
      if (filter === "approved") matchFilter = pStatus === "approved" || pStatus === "active";
      if (filter === "pending") matchFilter = pStatus === "pending" || pStatus === "inreview";
      if (filter === "bestseller") matchFilter = isBs;
      if (filter === "outofstock") matchFilter = Number(p.quantity ?? p.stock ?? 0) <= 0 || pStatus === "out of stock";

      const matchCat = categoryFilter === "all" || p.categoryId === categoryFilter;

      return matchQ && matchFilter && matchCat;
    });
  }, [products, q, filter, categoryFilter]);

  // KPIs
  const totalCount = products.length;
  const approvedCount = products.filter((p: any) => (getLocalizedText(p.status, "Approved")).toLowerCase() === "approved" || (getLocalizedText(p.status, "Approved")).toLowerCase() === "active").length;
  const bestSellerCount = products.filter((p: any) => p.bestSeller || p.isBestSeller).length;
  const lowStockCount = products.filter((p: any) => Number(p.quantity ?? p.stock ?? 0) <= 10).length;

  const handleExportProducts = () => {
    const dataToExport = filteredProducts.length > 0 ? filteredProducts : products;
    exportToCsv({
      filename: `iherd_marketplace_products_${new Date().toISOString().slice(0, 10)}`,
      data: dataToExport,
      columns: [
        { header: "Product ID / SKU", accessor: (p: any) => p.id },
        { header: "Product Name", accessor: (p: any) => getLocalizedText(p.name || p.title) },
        { header: "Category", accessor: (p: any) => getLocalizedText(p.category || p.categoryName || p.categoryId) },
        { header: "Subcategory", accessor: (p: any) => getLocalizedText(p.subCategory || p.subCategoryName || p.subCategoryId) },
        { header: "Regular Price (INR)", accessor: (p: any) => p.originalPrice ?? p.price ?? 0 },
        { header: "Discounted Price (INR)", accessor: (p: any) => p.price ?? 0 },
        { header: "Stock Quantity", accessor: (p: any) => p.quantity ?? p.stock ?? 0 },
        { header: "Weight", accessor: (p: any) => `${p.weight ?? 0} ${getLocalizedText(p.weightUnit, "g")}` },
        { header: "Best Seller", accessor: (p: any) => (p.bestSeller || p.isBestSeller) ? "Yes" : "No" },
        { header: "Seller Name", accessor: (p: any) => getLocalizedText(p.sellerName, "Chimertech") },
        { header: "Seller Type", accessor: (p: any) => p.sellerType || "seller" },
        { header: "GST (%)", accessor: (p: any) => p.gst ?? 18 },
        { header: "Delivery Type", accessor: (p: any) => p.deliveryConfig?.type || "all (Nationwide)" },
        { header: "Delivery States", accessor: (p: any) => Array.isArray(p.deliveryConfig?.states) ? p.deliveryConfig.states.join(", ") : "All States" },
        { header: "Status", accessor: (p: any) => getLocalizedText(p.status, "Approved") },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Product Marketplace"
          description="Manage veterinary equipment, pharmaceuticals, cattle feeds, supplements, and digital products."
        />
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="rounded-2xl gap-1.5"
            title="Manage product categories and subcategories"
          >
            <Link to="/marketplace/categories">
              <FolderTree className="h-4 w-4 text-emerald-600" />
              <span>Categories</span>
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportProducts}
            disabled={isLoading || products.length === 0}
            className="rounded-2xl gap-1.5"
            title={`Export ${filteredProducts.length} products to CSV`}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button onClick={openAddModal} className="bg-gradient-to-br from-primary to-primary-glow shadow-md gap-1.5 rounded-2xl font-bold">
            <Plus className="h-4 w-4" /> Add New Product
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-3xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Products</p>
              {isLoading ? (
                <div className="h-8 w-20 bg-muted/70 rounded-lg animate-pulse mt-1" />
              ) : (
                <h3 className="text-2xl font-bold mt-1 text-foreground">{totalCount}</h3>
              )}
            </div>
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
            <Layers className="h-3 w-3" /> Across {categories.length || "all"} categories
          </p>
        </Card>

        <Card className="p-4 rounded-3xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Approved Products</p>
              {isLoading ? (
                <div className="h-8 w-20 bg-muted/70 rounded-lg animate-pulse mt-1" />
              ) : (
                <h3 className="text-2xl font-bold mt-1 text-emerald-600">{approvedCount}</h3>
              )}
            </div>
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-emerald-600 mt-2 font-medium">Live on mobile app</p>
        </Card>

        <Card className="p-4 rounded-3xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Featured Best Sellers</p>
              {isLoading ? (
                <div className="h-8 w-20 bg-muted/70 rounded-lg animate-pulse mt-1" />
              ) : (
                <h3 className="text-2xl font-bold mt-1 text-amber-500">{bestSellerCount}</h3>
              )}
            </div>
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Flame className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-amber-600 mt-2 font-medium">Homepage recommended</p>
        </Card>

        <Card className="p-4 rounded-3xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Low / Out of Stock</p>
              {isLoading ? (
                <div className="h-8 w-20 bg-muted/70 rounded-lg animate-pulse mt-1" />
              ) : (
                <h3 className="text-2xl font-bold mt-1 text-rose-500">{lowStockCount}</h3>
              )}
            </div>
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-rose-500 mt-2 font-medium">Requires inventory refill</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 rounded-3xl border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by product name, SKU / ID, or seller name..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 rounded-2xl text-xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-44 text-xs rounded-xl h-9">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {getLocalizedText(c.name, c.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border text-xs">
              {[
                { label: "All", value: "all" },
                { label: "Approved", value: "approved" },
                { label: "Best Sellers", value: "bestseller" },
                { label: "Low Stock", value: "outofstock" },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setFilter(t.value)}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    filter === t.value ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Table */}
        <div className="rounded-2xl border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-bold">Product & Media</TableHead>
                <TableHead className="text-xs font-bold">Category</TableHead>
                <TableHead className="text-xs font-bold">Pricing & MRP</TableHead>
                <TableHead className="text-xs font-bold">Stock & Weight</TableHead>
                <TableHead className="text-xs font-bold">Seller</TableHead>
                <TableHead className="text-xs font-bold">Status</TableHead>
                <TableHead className="text-xs font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <div className="h-10 w-full bg-muted/60 rounded-xl animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-36 text-center text-xs text-muted-foreground">
                    No products found matching the criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((p: any) => {
                  const pName = getLocalizedText(p.name || p.title, "Unnamed Product");
                  const thumb = p.thumbnailUrl || (Array.isArray(p.imageUrls) ? p.imageUrls[0] : "") || (Array.isArray(p.images) ? p.images[0] : "") || "";
                  const pCategory = categoryMap.get(p.categoryId) || getLocalizedText(p.category, p.categoryId || "General");
                  const isBs = isProductBestSeller(p);
                  const pStatus = getLocalizedText(p.status, "Approved");
                  const currentStock = Number(p.quantity !== undefined ? p.quantity : (p.stock !== undefined ? p.stock : 0));
                  const qUnitStr = typeof p.quantityUnit === "object" ? getLocalizedText(p.quantityUnit, "Units") : String(p.quantityUnit || "Units");
                  const weightStr = p.weight ? `${p.weight} ${typeof p.weightUnit === "object" ? getLocalizedText(p.weightUnit, "g") : String(p.weightUnit || "g")}` : "—";

                  return (
                    <TableRow key={p.id} className="hover:bg-muted/20 text-xs">
                      {/* Product & Media */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {thumb ? (
                            <div
                              className="relative h-12 w-12 rounded-2xl overflow-hidden border bg-muted shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setSelectedPreviewImage({ url: thumb, title: pName })}
                            >
                              <ProductImage src={thumb} alt={pName} className="h-full w-full object-cover" />
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <Eye className="h-3.5 w-3.5 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0 border border-primary/20">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-bold text-foreground truncate max-w-[200px]" title={pName}>
                              {pName}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[180px]">
                              ID: {p.id}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Category */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-semibold text-foreground">{pCategory}</div>
                          {p.subCategoryId && (
                            <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                              {p.subCategoryId}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Pricing */}
                      <TableCell>
                        {(() => {
                          const pVal = Number(p.price || 0);
                          const mVal = Number(p.mrp || 0);
                          const isInvalid = mVal > 0 && pVal > 0 && mVal <= pVal;
                          const discount = mVal > pVal && mVal > 0 ? Math.round(((mVal - pVal) / mVal) * 100) : 0;
                          return (
                            <button
                              type="button"
                              onClick={() => openQuickPriceDialog(p)}
                              className="space-y-0.5 text-left group hover:bg-primary/5 p-1.5 -m-1.5 rounded-xl transition-all"
                              title="Click to quickly update price & MRP"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-emerald-600 text-sm">₹{pVal.toLocaleString()}</span>
                                <Pencil className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                                {discount > 0 && (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-500/10 dark:text-emerald-400 px-1.5 py-0.2 rounded">
                                    {discount}% OFF
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] flex items-center gap-1.5 flex-wrap">
                                {mVal > 0 && (
                                  <span className="line-through text-red-500 font-medium">₹{mVal.toLocaleString()}</span>
                                )}
                                <span className="text-muted-foreground text-[10px]">• GST: {p.gst || 18}%</span>
                              </div>
                              {isInvalid && (
                                <div className="text-[10px] font-bold text-destructive flex items-center gap-0.5">
                                  <span>⚠️ MRP must be &gt; Price</span>
                                </div>
                              )}
                            </button>
                          );
                        })()}
                      </TableCell>

                      {/* Stock & Weight */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-medium text-foreground">
                            {currentStock <= 0 ? (
                              <span className="text-rose-500 font-bold">Out of stock</span>
                            ) : (
                              <span>{currentStock} {qUnitStr}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Weight: {weightStr}</div>
                        </div>
                      </TableCell>

                      {/* Seller */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {p.sellerLogo ? (
                            <ProductImage
                              src={p.sellerLogo}
                              alt="Seller Logo"
                              className="h-8 w-8 rounded-xl object-contain border shadow-2xs shrink-0 bg-white p-0.5"
                              fallbackIcon={Building}
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                              {(getLocalizedText(p.sellerName, "C"))[0]?.toUpperCase() || "S"}
                            </div>
                          )}
                          <div className="font-medium text-foreground truncate max-w-[140px]">
                            {getLocalizedText(p.sellerName, "Chimertech")}
                          </div>
                        </div>
                      </TableCell>

                      {/* Status & Badges */}
                      <TableCell>
                        <div className="space-y-1">
                          <div
                            title={
                              pStatus.toLowerCase() === "approved" || pStatus.toLowerCase() === "active"
                                ? "Verified by Admin and live for customer purchase on iHerd app"
                                : "Pending review or deactivated by administrator"
                            }
                            className="inline-block cursor-help"
                          >
                            <StatusBadge status={pStatus} />
                          </div>
                          {isBs && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              <Flame className="h-3 w-3 fill-amber-500 text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" /> Best Seller
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1 rounded-xl"
                            onClick={() => setSelectedProductDetail(p)}
                            title="Inspect complete Firestore specifications"
                          >
                            <Maximize2 className="h-3.5 w-3.5" /> Full Data
                          </Button>
                          <Button
                            size="sm"
                            variant={isBs ? "default" : "outline"}
                            onClick={() => handleToggleBestSeller(p)}
                            className={`h-8 px-2.5 text-xs gap-1 font-semibold rounded-xl transition-all ${
                              isBs
                                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/30 ring-2 ring-amber-400/40"
                                : "border-amber-500/30 text-amber-600 hover:bg-amber-50"
                            }`}
                            title={isBs ? "Remove Best Seller" : "Mark as Best Seller"}
                          >
                            <Flame
                              className={`h-3.5 w-3.5 transition-all ${
                                isBs
                                  ? "fill-white text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)] animate-pulse"
                                  : "fill-none text-amber-500"
                              }`}
                            />
                            <span>{isBs ? "Best Seller" : "Feature"}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(p)}
                            className="h-8 px-2.5 text-xs gap-1 font-medium rounded-xl"
                            title="Edit product"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(p)}
                            className="h-8 w-8 p-0 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-xl"
                            title="Delete product"
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
      </Card>

      {/* FULL PRODUCT INSPECTION MODAL */}
      <Dialog open={!!selectedProductDetail} onOpenChange={(open) => !open && setSelectedProductDetail(null)}>
        <DialogContent className="max-w-3xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-6 w-6 text-primary" />
                <span>{getLocalizedText(selectedProductDetail?.name, "Product Details")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs bg-muted px-2.5 py-1 rounded-lg border font-bold">
                  {selectedProductDetail?.id}
                </span>
                <StatusBadge status={getLocalizedText(selectedProductDetail?.status, "Approved")} />
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedProductDetail && (
            <div className="space-y-6 mt-4">
              {/* Image Gallery */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-primary" /> Product Images & Gallery (<code>imageUrls</code>, <code>thumbnailUrl</code>)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    selectedProductDetail.thumbnailUrl,
                    ...(Array.isArray(selectedProductDetail.imageUrls) ? selectedProductDetail.imageUrls : []),
                    ...(Array.isArray(selectedProductDetail.images) ? selectedProductDetail.images : []),
                  ]
                    .filter(Boolean)
                    .filter((url, idx, self) => self.indexOf(url) === idx)
                    .map((url, i) => (
                      <div
                        key={i}
                        className="group relative rounded-2xl overflow-hidden border aspect-square bg-muted/30 cursor-pointer hover:border-primary transition-all"
                        onClick={() => setSelectedPreviewImage({ url, title: `${getLocalizedText(selectedProductDetail.name)} - Image #${i + 1}` })}
                      >
                        <ProductImage src={url} alt={`Product View ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-center">
                          <span className="text-[11px] font-semibold text-white">
                            {i === 0 ? "Thumbnail" : `Image #${i + 1}`}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Technical Specifications Grid */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Pricing & Commercials */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <IndianRupee className="h-4 w-4 text-primary" /> Pricing & Commercials (<code>double</code> & <code>int</code>)
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Selling Price (<code>price</code>)</span>
                      <span className="font-bold text-primary text-sm">₹{Number(selectedProductDetail.price || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">MRP Price (<code>mrp</code>)</span>
                      <span className="font-semibold">₹{Number(selectedProductDetail.mrp || selectedProductDetail.price || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">GST Rate (<code>gst</code>)</span>
                      <span className="font-semibold">{selectedProductDetail.gst || 18}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Stock Quantity (<code>quantity</code>)</span>
                      <span className="font-bold">
                        {selectedProductDetail.quantity ?? 1000} {typeof selectedProductDetail.quantityUnit === "object" ? getLocalizedText(selectedProductDetail.quantityUnit, "Units") : String(selectedProductDetail.quantityUnit || "Units")}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Weight & Unit (<code>weight</code>, <code>weightUnit</code>)</span>
                      <span className="font-semibold">
                        {selectedProductDetail.weight || 0} {typeof selectedProductDetail.weightUnit === "object" ? getLocalizedText(selectedProductDetail.weightUnit, "g") : String(selectedProductDetail.weightUnit || "g")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Categories & Classifications */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-primary" /> Category & Configuration (<code>Map</code> & <code>bool</code>)
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Category ID (<code>categoryId</code>)</span>
                      <span className="font-semibold font-mono">{selectedProductDetail.categoryId}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Sub Category ID (<code>subCategoryId</code>)</span>
                      <span className="font-semibold font-mono">{selectedProductDetail.subCategoryId || "—"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Best Seller (<code>bestSeller</code>)</span>
                      <span className="font-bold text-amber-500">
                        {selectedProductDetail.bestSeller ? "🔥 Featured" : "No"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Best Before (<code>bestBefore</code>)</span>
                      <span className="font-semibold">
                        {getLocalizedText(selectedProductDetail.bestBefore || selectedProductDetail.best_before, "लागू नहीं")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description, Ingredients & Usage */}
              <div className="space-y-3 p-4 rounded-2xl border bg-muted/10">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-primary" /> Specifications, Ingredients & Usage Maps
                </h4>
                <div className="space-y-3 text-xs">
                  {selectedProductDetail.description && (
                    <div>
                      <span className="font-semibold text-foreground block mb-0.5">Description (<code>description</code>):</span>
                      <p className="text-muted-foreground leading-relaxed">{getLocalizedText(selectedProductDetail.description)}</p>
                    </div>
                  )}

                  {selectedProductDetail.specification && (
                    <div>
                      <span className="font-semibold text-foreground block mb-0.5">Specifications (<code>specification</code>):</span>
                      <p className="text-muted-foreground leading-relaxed">{getLocalizedText(selectedProductDetail.specification)}</p>
                    </div>
                  )}

                  {selectedProductDetail.productIngredients && (
                    <div>
                      <span className="font-semibold text-foreground block mb-0.5">Ingredients (<code>productIngredients</code>):</span>
                      <p className="text-muted-foreground leading-relaxed">{getLocalizedText(selectedProductDetail.productIngredients)}</p>
                    </div>
                  )}

                  {selectedProductDetail.usage && (
                    <div>
                      <span className="font-semibold text-foreground block mb-0.5">Usage (<code>usage</code>):</span>
                      <p className="text-muted-foreground leading-relaxed">{getLocalizedText(selectedProductDetail.usage)}</p>
                    </div>
                  )}

                  {selectedProductDetail.instructionsToUse && (
                    <div>
                      <span className="font-semibold text-foreground block mb-0.5">Instructions to Use (<code>instructionsToUse</code>):</span>
                      <p className="text-muted-foreground leading-relaxed">{getLocalizedText(selectedProductDetail.instructionsToUse)}</p>
                    </div>
                  )}

                  {selectedProductDetail.storageCondition && (
                    <div>
                      <span className="font-semibold text-foreground block mb-0.5">Storage Condition (<code>storageCondition</code>):</span>
                      <p className="text-muted-foreground leading-relaxed">{getLocalizedText(selectedProductDetail.storageCondition)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Seller Information & Delivery Card */}
              <div className="flex items-center justify-between p-4 rounded-2xl border bg-primary/5 border-primary/20 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  {selectedProductDetail.sellerLogo ? (
                    <ProductImage src={selectedProductDetail.sellerLogo} alt="Logo" className="h-10 min-w-[90px] max-w-[140px] px-2 py-0.5 rounded-xl object-contain border shrink-0 bg-white shadow-2xs" fallbackIcon={Building} />
                  ) : (
                    <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      <Building className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-sm text-foreground">{getLocalizedText(selectedProductDetail.sellerName, "Chimertech")}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      Seller Type: {selectedProductDetail.sellerType || "seller"} • Role: {selectedProductDetail.postedByRole || "admin"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => { setSelectedProductDetail(null); openEditModal(selectedProductDetail); }}>
                    <Pencil className="h-3.5 w-3.5" /> Edit Product
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ADD / EDIT PRODUCT MODAL WITH ALL 30 ENTITY FIELDS */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <span>{editingProduct ? "Edit Product (ProductListingEntity)" : "Add New Product (ProductListingEntity)"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Directly map all fields and types matching Flutter <code>ProductListingEntity</code>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <Tabs value={modalTab} onValueChange={setModalTab} className="w-full">
              <TabsList className="grid grid-cols-4 p-1 rounded-2xl bg-muted/60 mb-3">
                <TabsTrigger value="general" className="rounded-xl text-xs font-semibold">General & Pricing</TabsTrigger>
                <TabsTrigger value="units" className="rounded-xl text-xs font-semibold">Units & Inventory</TabsTrigger>
                <TabsTrigger value="specs" className="rounded-xl text-xs font-semibold">Specs & Details</TabsTrigger>
                <TabsTrigger value="media" className="rounded-xl text-xs font-semibold">Media & Delivery</TabsTrigger>
              </TabsList>

              {/* TAB 1: GENERAL & PRICING */}
              <TabsContent value="general" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-id" className="font-mono">Product ID (<code>String id</code>) *</Label>
                    <Input
                      id="prod-id"
                      placeholder="e.g. VBG1-805-A01-1UNT"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      required
                      disabled={!!editingProduct}
                      className="font-mono text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="prod-name-en">Product Name English (<code>name.en</code>) *</Label>
                    <Input
                      id="prod-name-en"
                      placeholder="e.g. Portable Liquid Nitrogen Container"
                      value={nameEn}
                      onChange={(e) => {
                        setNameEn(e.target.value);
                        clearFieldError("name");
                      }}
                      required
                      className={fieldErrors.name ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}
                    />
                    {fieldErrors.name && (
                      <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                        <AlertCircle className="h-3 w-3" />
                        <span>Product name in English is required. Please fill in this field.</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Multilingual Names (Map<String, dynamic> name) */}
                <div className="p-3 rounded-2xl bg-muted/30 border space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Regional Languages (<code>name.hi, kn, mr, pa, ta</code>) — <span className="text-muted-foreground font-normal">Optional (auto-fills from English)</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                    <div className="space-y-1">
                      <Label htmlFor="prod-name-hi" className="text-[11px]">Hindi (<code>hi</code>)</Label>
                      <Input
                        id="prod-name-hi"
                        placeholder="e.g. प्रेगकाइन बोवाइन..."
                        value={nameHi}
                        onChange={(e) => {
                          setNameHi(e.target.value);
                          clearFieldError("name_hi");
                        }}
                        className={`text-xs ${fieldErrors.name_hi ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-name-kn" className="text-[11px]">Kannada (<code>kn</code>)</Label>
                      <Input
                        id="prod-name-kn"
                        placeholder="e.g. ಪ್ರೆಗ್‌ಕೈನ್ ಬೋವೈನ್..."
                        value={nameKn}
                        onChange={(e) => {
                          setNameKn(e.target.value);
                          clearFieldError("name_kn");
                        }}
                        className={`text-xs ${fieldErrors.name_kn ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-name-mr" className="text-[11px]">Marathi (<code>mr</code>)</Label>
                      <Input
                        id="prod-name-mr"
                        placeholder="e.g. प्रेगकाईन बोव्हाइन..."
                        value={nameMr}
                        onChange={(e) => {
                          setNameMr(e.target.value);
                          clearFieldError("name_mr");
                        }}
                        className={`text-xs ${fieldErrors.name_mr ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-name-pa" className="text-[11px]">Punjabi (<code>pa</code>)</Label>
                      <Input
                        id="prod-name-pa"
                        placeholder="e.g. ਪ੍ਰੇਗਕਾਈਨ ਬੋਵਾਈਨ..."
                        value={namePa}
                        onChange={(e) => {
                          setNamePa(e.target.value);
                          clearFieldError("name_pa");
                        }}
                        className={`text-xs ${fieldErrors.name_pa ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-name-ta" className="text-[11px]">Tamil (<code>ta</code>)</Label>
                      <Input
                        id="prod-name-ta"
                        placeholder="e.g. பிரெக்கைன் போவின்..."
                        value={nameTa}
                        onChange={(e) => {
                          setNameTa(e.target.value);
                          clearFieldError("name_ta");
                        }}
                        className={`text-xs ${fieldErrors.name_ta ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Categories & Subcategories Dropdown Selectors */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl border ${
                  fieldErrors.categoryId ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5" : "bg-muted/20"
                }`}>
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-cat" className="text-xs font-semibold flex items-center justify-between">
                      <span>Category *</span>
                      <span className="text-[10px] text-muted-foreground font-mono">categoryId</span>
                    </Label>
                    <Select
                      value={categoryId}
                      onValueChange={(newCatId) => {
                        setCategoryId(newCatId);
                        clearFieldError("categoryId");
                        const subs = getSubcategoriesForCategory(newCatId);
                        if (subs.length > 0) {
                          setSubCategoryId(subs[0].id);
                        }
                      }}
                    >
                      <SelectTrigger id="prod-cat" className="rounded-xl text-xs h-10 bg-background">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {PRODUCT_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{cat.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">({cat.id})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.categoryId && (
                      <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                        <AlertCircle className="h-3 w-3" />
                        <span>Please select a product category</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prod-subcat" className="text-xs font-semibold flex items-center justify-between">
                      <span>Subcategory</span>
                      <span className="text-[10px] text-muted-foreground font-mono">subCategoryId</span>
                    </Label>
                    <Select value={subCategoryId} onValueChange={setSubCategoryId}>
                      <SelectTrigger id="prod-subcat" className="rounded-xl text-xs h-10 bg-background">
                        <SelectValue placeholder="Select Subcategory" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {getSubcategoriesForCategory(categoryId).map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{sub.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">({sub.id})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Pricing, MRP & GST with Strict Validation (MRP > Price, Green/Red Highlights) */}
                {(() => {
                  const numPriceVal = Number(price) || 0;
                  const numMrpVal = Number(mrp) || 0;
                  const isPriceInvalid = numPriceVal > 0 && numMrpVal > 0 && numMrpVal <= numPriceVal;
                  const discountPercent = numMrpVal > numPriceVal && numMrpVal > 0 ? Math.round(((numMrpVal - numPriceVal) / numMrpVal) * 100) : 0;

                  return (
                    <div className="space-y-2 p-3.5 rounded-2xl bg-muted/30 border">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="prod-price" className="text-emerald-600 font-bold flex items-center justify-between">
                            <span>Selling Price (₹) *</span>
                            {discountPercent > 0 && (
                              <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded">
                                {discountPercent}% OFF
                              </span>
                            )}
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">₹</span>
                            <Input
                              id="prod-price"
                              type="number"
                              step="0.01"
                              value={price}
                              onChange={(e) => {
                                setPrice(e.target.value);
                                clearFieldError("price");
                              }}
                              required
                              className={`pl-7 font-bold text-base text-emerald-600 border-emerald-500/40 focus:border-emerald-600 ${
                                fieldErrors.price || isPriceInvalid ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""
                              }`}
                            />
                          </div>
                          {fieldErrors.price && (
                            <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                              <AlertCircle className="h-3 w-3" />
                              <span>Selling price must be &gt; ₹0</span>
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="prod-mrp" className="text-red-500 font-bold flex items-center justify-between">
                            <span>MRP Price (₹) *</span>
                            <span className="text-[10px] text-muted-foreground font-normal">(Must be &gt; Price)</span>
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 font-bold">₹</span>
                            <Input
                              id="prod-mrp"
                              type="number"
                              step="0.01"
                              value={mrp}
                              onChange={(e) => {
                                setMrp(e.target.value);
                                clearFieldError("mrp");
                              }}
                              className={`pl-7 font-semibold text-red-500 border-red-300 dark:border-red-900 ${
                                fieldErrors.mrp || isPriceInvalid ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive font-bold" : ""
                              }`}
                            />
                          </div>
                          {fieldErrors.mrp && (
                            <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                              <AlertCircle className="h-3 w-3" />
                              <span>MRP must be &gt; ₹0</span>
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="prod-gst" className="text-xs font-semibold">GST % (<code>double gst</code>)</Label>
                          <Input
                            id="prod-gst"
                            type="number"
                            step="0.1"
                            value={gst}
                            onChange={(e) => setGst(e.target.value)}
                            className="rounded-xl"
                          />
                        </div>
                      </div>

                      {isPriceInvalid && (
                        <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>Condition Error: MRP (₹{numMrpVal}) must be strictly GREATER than normal Selling Price (₹{numPriceVal}).</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Best Seller Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center gap-2.5">
                    <Flame className="h-5 w-5 text-amber-600" />
                    <div>
                      <Label htmlFor="prod-bs" className="cursor-pointer font-bold text-xs text-foreground block">
                        Best Seller (<code>bool bestSeller</code>)
                      </Label>
                      <p className="text-[10px] text-muted-foreground">Featured on homepage carousel</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="prod-bs"
                    checked={bestSeller}
                    onChange={(e) => setBestSeller(e.target.checked)}
                    className="h-5 w-5 rounded text-amber-500 cursor-pointer"
                  />
                </div>
              </TabsContent>

              {/* TAB 2: UNITS & INVENTORY */}
              <TabsContent value="units" className="space-y-4">
                {/* Quantity & Localized Quantity Unit */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-primary" /> Quantity (<code>int quantity</code>) & Units (<code>Map weightUnit</code>)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-quantity">Quantity (int)</Label>
                      <Input
                        id="prod-quantity"
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-qunit-en">Unit (English)</Label>
                      <Input
                        id="prod-qunit-en"
                        placeholder="e.g. Unit / Litre"
                        value={quantityUnitEn}
                        onChange={(e) => setQuantityUnitEn(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-qunit-hi">Unit (Hindi)</Label>
                      <Input
                        id="prod-qunit-hi"
                        placeholder="e.g. लीटर"
                        value={quantityUnitHi}
                        onChange={(e) => setQuantityUnitHi(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-qunit-pa">Unit (Punjabi)</Label>
                      <Input
                        id="prod-qunit-pa"
                        placeholder="e.g. ਲੀਟਰ"
                        value={quantityUnitPa}
                        onChange={(e) => setQuantityUnitPa(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Weight & Localized Weight Unit */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Scale className="h-4 w-4 text-primary" /> Weight (<code>double weight</code>) & Units (<code>Map weightUnit</code>)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-weight">Weight (double) *</Label>
                      <Input
                        id="prod-weight"
                        type="number"
                        step="0.1"
                        value={weight}
                        onChange={(e) => {
                          setWeight(e.target.value);
                          clearFieldError("weight");
                        }}
                        className={fieldErrors.weight ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}
                      />
                      {fieldErrors.weight && (
                        <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                          <AlertCircle className="h-3 w-3" />
                          <span>Weight is required</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-wunit-en">Unit (English)</Label>
                      <Input
                        id="prod-wunit-en"
                        placeholder="e.g. g / kg"
                        value={weightUnitEn}
                        onChange={(e) => setWeightUnitEn(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-wunit-hi">Unit (Hindi)</Label>
                      <Input
                        id="prod-wunit-hi"
                        placeholder="e.g. ग्राम"
                        value={weightUnitHi}
                        onChange={(e) => setWeightUnitHi(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-wunit-pa">Unit (Punjabi)</Label>
                      <Input
                        id="prod-wunit-pa"
                        placeholder="e.g. ਗ੍ਰਾਮ"
                        value={weightUnitPa}
                        onChange={(e) => setWeightUnitPa(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Best Before Localized Map (en, hi, kn, mr, pa, ta) */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-primary" /> Best Before (<code>bestBefore & best_before</code>: en, hi, kn, mr, pa, ta)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                    <div className="space-y-1">
                      <Label htmlFor="prod-bb-en" className="text-[11px]">English (<code>en</code>)</Label>
                      <Input
                        id="prod-bb-en"
                        placeholder="1 Year"
                        value={bestBeforeEn}
                        onChange={(e) => setBestBeforeEn(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-bb-hi" className="text-[11px]">Hindi (<code>hi</code>)</Label>
                      <Input
                        id="prod-bb-hi"
                        placeholder="1 वर्ष"
                        value={bestBeforeHi}
                        onChange={(e) => setBestBeforeHi(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-bb-kn" className="text-[11px]">Kannada (<code>kn</code>)</Label>
                      <Input
                        id="prod-bb-kn"
                        placeholder="1 ವರ್ಷ"
                        value={bestBeforeKn}
                        onChange={(e) => setBestBeforeKn(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-bb-mr" className="text-[11px]">Marathi (<code>mr</code>)</Label>
                      <Input
                        id="prod-bb-mr"
                        placeholder="१ वर्ष"
                        value={bestBeforeMr}
                        onChange={(e) => setBestBeforeMr(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-bb-pa" className="text-[11px]">Punjabi (<code>pa</code>)</Label>
                      <Input
                        id="prod-bb-pa"
                        placeholder="1 ਸਾਲ"
                        value={bestBeforePa}
                        onChange={(e) => setBestBeforePa(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-bb-ta" className="text-[11px]">Tamil (<code>ta</code>)</Label>
                      <Input
                        id="prod-bb-ta"
                        placeholder="1 ஆண்டு"
                        value={bestBeforeTa}
                        onChange={(e) => setBestBeforeTa(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: SPECS & DETAILS */}
              <TabsContent value="specs" className="space-y-4">
                {/* Description Map (en, hi, kn, mr, pa, ta) */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Description (<code>description</code>: en, hi, kn, mr, pa, ta) *
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="prod-desc-en" className="text-[11px]">English (<code>en</code>) *</Label>
                      <Textarea
                        id="prod-desc-en"
                        rows={2}
                        placeholder="Advanced, rapid pregnancy detection kit..."
                        value={descriptionEn}
                        onChange={(e) => {
                          setDescriptionEn(e.target.value);
                          clearFieldError("description");
                          clearFieldError("description_en");
                        }}
                        className={`text-xs ${
                          fieldErrors.description || fieldErrors.description_en ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""
                        }`}
                      />
                      {(fieldErrors.description || fieldErrors.description_en) && (
                        <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                          <AlertCircle className="h-3 w-3" />
                          <span>Description in English is required</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-desc-hi" className="text-[11px]">Hindi (<code>hi</code>) *</Label>
                      <Textarea
                        id="prod-desc-hi"
                        rows={2}
                        placeholder="गायों के लिए रैपिड प्रेगनेंसी..."
                        value={descriptionHi}
                        onChange={(e) => {
                          setDescriptionHi(e.target.value);
                          clearFieldError("description_hi");
                        }}
                        className={`text-xs ${fieldErrors.description_hi ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-desc-kn" className="text-[11px]">Kannada (<code>kn</code>) *</Label>
                      <Textarea
                        id="prod-desc-kn"
                        rows={2}
                        placeholder="ಕನ್ನಡ ವಿವರಣೆ..."
                        value={descriptionKn}
                        onChange={(e) => {
                          setDescriptionKn(e.target.value);
                          clearFieldError("description_kn");
                        }}
                        className={`text-xs ${fieldErrors.description_kn ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-desc-mr" className="text-[11px]">Marathi (<code>mr</code>) *</Label>
                      <Textarea
                        id="prod-desc-mr"
                        rows={2}
                        placeholder="मराठी वर्णन..."
                        value={descriptionMr}
                        onChange={(e) => {
                          setDescriptionMr(e.target.value);
                          clearFieldError("description_mr");
                        }}
                        className={`text-xs ${fieldErrors.description_mr ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-desc-pa" className="text-[11px]">Punjabi (<code>pa</code>) *</Label>
                      <Textarea
                        id="prod-desc-pa"
                        rows={2}
                        placeholder="ਪੰਜਾਬੀ ਵੇਰਵਾ..."
                        value={descriptionPa}
                        onChange={(e) => {
                          setDescriptionPa(e.target.value);
                          clearFieldError("description_pa");
                        }}
                        className={`text-xs ${fieldErrors.description_pa ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-desc-ta" className="text-[11px]">Tamil (<code>ta</code>) *</Label>
                      <Textarea
                        id="prod-desc-ta"
                        rows={2}
                        placeholder="தமிழ் விளக்கம்..."
                        value={descriptionTa}
                        onChange={(e) => {
                          setDescriptionTa(e.target.value);
                          clearFieldError("description_ta");
                        }}
                        className={`text-xs ${fieldErrors.description_ta ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Specification Map (en, hi, kn, mr, pa, ta) */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Specifications (<code>specification</code>: en, hi, kn, mr, pa, ta) *
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="prod-spec-en" className="text-[11px]">English (<code>en</code>) *</Label>
                      <Textarea
                        id="prod-spec-en"
                        rows={2}
                        placeholder="Detects in as early as 28 days..."
                        value={specificationEn}
                        onChange={(e) => {
                          setSpecificationEn(e.target.value);
                          clearFieldError("specification");
                          clearFieldError("specification_en");
                        }}
                        className={`text-xs ${
                          fieldErrors.specification || fieldErrors.specification_en ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""
                        }`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-spec-hi" className="text-[11px]">Hindi (<code>hi</code>) *</Label>
                      <Textarea
                        id="prod-spec-hi"
                        rows={2}
                        placeholder="प्रजनन या कृत्रिम गर्भाधान के बाद 28 दिनों में..."
                        value={specificationHi}
                        onChange={(e) => {
                          setSpecificationHi(e.target.value);
                          clearFieldError("specification_hi");
                        }}
                        className={`text-xs ${fieldErrors.specification_hi ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-spec-kn" className="text-[11px]">Kannada (<code>kn</code>) *</Label>
                      <Textarea
                        id="prod-spec-kn"
                        rows={2}
                        placeholder="ಸಂತಾನೋತ್ಪತ್ತಿ ಅಥವಾ ಕೃತಕ ಗರ್ಭಧಾರಣೆಯ ನಂತರ 28 ದಿನಗಳಲ್ಲಿ..."
                        value={specificationKn}
                        onChange={(e) => {
                          setSpecificationKn(e.target.value);
                          clearFieldError("specification_kn");
                        }}
                        className={`text-xs ${fieldErrors.specification_kn ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-spec-mr" className="text-[11px]">Marathi (<code>mr</code>) *</Label>
                      <Textarea
                        id="prod-spec-mr"
                        rows={2}
                        placeholder="प्रजनन किंवा कृत्रिम रेतन नंतर अवघ्या २८ दिवसांत..."
                        value={specificationMr}
                        onChange={(e) => {
                          setSpecificationMr(e.target.value);
                          clearFieldError("specification_mr");
                        }}
                        className={`text-xs ${fieldErrors.specification_mr ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-spec-pa" className="text-[11px]">Punjabi (<code>pa</code>) *</Label>
                      <Textarea
                        id="prod-spec-pa"
                        rows={2}
                        placeholder="ਪ੍ਰਜਨਨ ਜਾਂ ਕ੍ਰਿਤ੍ਰਿਮ ਗਰਭਧਾਰਣ ਤੋਂ 28 ਦਿਨਾਂ ਬਾਅਦ..."
                        value={specificationPa}
                        onChange={(e) => {
                          setSpecificationPa(e.target.value);
                          clearFieldError("specification_pa");
                        }}
                        className={`text-xs ${fieldErrors.specification_pa ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-spec-ta" className="text-[11px]">Tamil (<code>ta</code>) *</Label>
                      <Textarea
                        id="prod-spec-ta"
                        rows={2}
                        placeholder="இனப்பெருக்கம் அல்லது செயற்கை கருத்தரிப்பிற்குப் பின் 28 நாட்களிலேயே..."
                        value={specificationTa}
                        onChange={(e) => {
                          setSpecificationTa(e.target.value);
                          clearFieldError("specification_ta");
                        }}
                        className={`text-xs ${fieldErrors.specification_ta ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Product Ingredients Map (en, hi, kn, mr, pa, ta) */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Ingredients (<code>productIngredients</code>: en, hi, kn, mr, pa, ta) *
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <Label htmlFor="prod-ing-en" className="text-[11px]">English *</Label>
                      <Input
                        id="prod-ing-en"
                        placeholder="Vaccutainer, 18G Needle, Syringe..."
                        value={productIngredientsEn}
                        onChange={(e) => {
                          setProductIngredientsEn(e.target.value);
                          clearFieldError("ingredients");
                          clearFieldError("ingredients_en");
                        }}
                        className={`text-xs ${
                          fieldErrors.ingredients || fieldErrors.ingredients_en ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""
                        }`}
                      />
                      {(fieldErrors.ingredients || fieldErrors.ingredients_en) && (
                        <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                          <AlertCircle className="h-3 w-3" />
                          <span>Ingredients are required</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-ing-hi" className="text-[11px]">Hindi *</Label>
                      <Input
                        id="prod-ing-hi"
                        placeholder="वै큠टेनर, 18G सुई, सिरिंज..."
                        value={productIngredientsHi}
                        onChange={(e) => {
                          setProductIngredientsHi(e.target.value);
                          clearFieldError("ingredients_hi");
                        }}
                        className={`text-xs ${fieldErrors.ingredients_hi ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-ing-kn" className="text-[11px]">Kannada *</Label>
                      <Input
                        id="prod-ing-kn"
                        placeholder="ವ್ಯಾಕ್ಯೂಟೈನರ್, 18G ಸೂಜಿ..."
                        value={productIngredientsKn}
                        onChange={(e) => {
                          setProductIngredientsKn(e.target.value);
                          clearFieldError("ingredients_kn");
                        }}
                        className={`text-xs ${fieldErrors.ingredients_kn ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-ing-mr" className="text-[11px]">Marathi *</Label>
                      <Input
                        id="prod-ing-mr"
                        placeholder="व्हॅक्यूटेनर, १८G सुई..."
                        value={productIngredientsMr}
                        onChange={(e) => {
                          setProductIngredientsMr(e.target.value);
                          clearFieldError("ingredients_mr");
                        }}
                        className={`text-xs ${fieldErrors.ingredients_mr ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-ing-pa" className="text-[11px]">Punjabi *</Label>
                      <Input
                        id="prod-ing-pa"
                        placeholder="ਵੈਕਿਊਟੇਨਰ, 18G ਸੂਈ..."
                        value={productIngredientsPa}
                        onChange={(e) => {
                          setProductIngredientsPa(e.target.value);
                          clearFieldError("ingredients_pa");
                        }}
                        className={`text-xs ${fieldErrors.ingredients_pa ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-ing-ta" className="text-[11px]">Tamil *</Label>
                      <Input
                        id="prod-ing-ta"
                        placeholder="வாக்குடெய்னர், 18G ஊசி..."
                        value={productIngredientsTa}
                        onChange={(e) => {
                          setProductIngredientsTa(e.target.value);
                          clearFieldError("ingredients_ta");
                        }}
                        className={`text-xs ${fieldErrors.ingredients_ta ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Instructions to Use (en, hi, kn, mr, pa, ta) */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Instructions To Use (<code>instructionsToUse</code>: en, hi, kn, mr, pa, ta) *
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="prod-inst-en" className="text-[11px]">English (<code>en</code>) *</Label>
                      <Textarea
                        id="prod-inst-en"
                        rows={2}
                        placeholder="Step - 1: Add one drop of Whole Blood..."
                        value={instructionsToUseEn}
                        onChange={(e) => {
                          setInstructionsToUseEn(e.target.value);
                          clearFieldError("instructions");
                          clearFieldError("instructions_en");
                        }}
                        className={`text-xs ${
                          fieldErrors.instructions || fieldErrors.instructions_en ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""
                        }`}
                      />
                      {(fieldErrors.instructions || fieldErrors.instructions_en) && (
                        <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                          <AlertCircle className="h-3 w-3" />
                          <span>Usage instructions in English are required</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-inst-hi" className="text-[11px]">Hindi (<code>hi</code>) *</Label>
                      <Textarea
                        id="prod-inst-hi"
                        rows={2}
                        placeholder="वैक्यूम जाँचें, प्री-हाइजीन के बाद..."
                        value={instructionsToUseHi}
                        onChange={(e) => {
                          setInstructionsToUseHi(e.target.value);
                          clearFieldError("instructions_hi");
                        }}
                        className={`text-xs ${fieldErrors.instructions_hi ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-inst-kn" className="text-[11px]">Kannada (<code>kn</code>) *</Label>
                      <Textarea
                        id="prod-inst-kn"
                        rows={2}
                        placeholder="ಹಂತ - 1: ರಕ್ತದ ಹನಿಯನ್ನು ಸೇರಿಸಿ..."
                        value={instructionsToUseKn}
                        onChange={(e) => {
                          setInstructionsToUseKn(e.target.value);
                          clearFieldError("instructions_kn");
                        }}
                        className={`text-xs ${fieldErrors.instructions_kn ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-inst-mr" className="text-[11px]">Marathi (<code>mr</code>) *</Label>
                      <Textarea
                        id="prod-inst-mr"
                        rows={2}
                        placeholder="पायरी - १: नमुना रक्ताचा थेंब घाला..."
                        value={instructionsToUseMr}
                        onChange={(e) => {
                          setInstructionsToUseMr(e.target.value);
                          clearFieldError("instructions_mr");
                        }}
                        className={`text-xs ${fieldErrors.instructions_mr ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-inst-pa" className="text-[11px]">Punjabi (<code>pa</code>) *</Label>
                      <Textarea
                        id="prod-inst-pa"
                        rows={2}
                        placeholder="ਕਦਮ - 1: ਖੂਨ ਦੀ ਇੱਕ ਬੂੰਦ ਪਾਓ..."
                        value={instructionsToUsePa}
                        onChange={(e) => {
                          setInstructionsToUsePa(e.target.value);
                          clearFieldError("instructions_pa");
                        }}
                        className={`text-xs ${fieldErrors.instructions_pa ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-inst-ta" className="text-[11px]">Tamil (<code>ta</code>) *</Label>
                      <Textarea
                        id="prod-inst-ta"
                        rows={2}
                        placeholder="படி - 1: இரத்த மாதிரியை சேர்க்கவும்..."
                        value={instructionsToUseTa}
                        onChange={(e) => {
                          setInstructionsToUseTa(e.target.value);
                          clearFieldError("instructions_ta");
                        }}
                        className={`text-xs ${fieldErrors.instructions_ta ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Storage Condition Map (en, hi, kn, mr, pa, ta) */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Storage Condition (<code>storageCondition</code>: en, hi, kn, mr, pa, ta)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                    <div className="space-y-1">
                      <Label htmlFor="prod-store-en" className="text-[11px]">English</Label>
                      <Input
                        id="prod-store-en"
                        placeholder="°C to 15°C"
                        value={storageConditionEn}
                        onChange={(e) => setStorageConditionEn(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-store-hi" className="text-[11px]">Hindi</Label>
                      <Input
                        id="prod-store-hi"
                        placeholder="°C से 15°C तक"
                        value={storageConditionHi}
                        onChange={(e) => setStorageConditionHi(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-store-kn" className="text-[11px]">Kannada</Label>
                      <Input
                        id="prod-store-kn"
                        placeholder="°C ರಿಂದ 15°C ವರೆಗೆ"
                        value={storageConditionKn}
                        onChange={(e) => setStorageConditionKn(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-store-mr" className="text-[11px]">Marathi</Label>
                      <Input
                        id="prod-store-mr"
                        placeholder="°C ते १५°C"
                        value={storageConditionMr}
                        onChange={(e) => setStorageConditionMr(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-store-pa" className="text-[11px]">Punjabi</Label>
                      <Input
                        id="prod-store-pa"
                        placeholder="°C ਤੋਂ 15°C ਤੱਕ"
                        value={storageConditionPa}
                        onChange={(e) => setStorageConditionPa(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-store-ta" className="text-[11px]">Tamil</Label>
                      <Input
                        id="prod-store-ta"
                        placeholder="°C முதல் 15°C வரை"
                        value={storageConditionTa}
                        onChange={(e) => setStorageConditionTa(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 4: MEDIA, SELLER & DELIVERY */}
              <TabsContent value="media" className="space-y-4">
                {/* Red Alert Pop-up for Unsupported Files / PDF Upload attempts */}
                {productFileFormatError && (
                  <div className="p-3 rounded-xl bg-destructive/10 border-2 border-destructive/40 flex items-center justify-between gap-2 text-xs text-destructive font-bold animate-shake">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                      <span>{productFileFormatError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProductFileFormatError(null)}
                      className="text-destructive/80 hover:text-destructive text-sm font-bold px-1"
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Image Gallery and Multi-Upload Section */}
                <div
                  className={`p-4 rounded-2xl border space-y-4 transition-all ${
                    fieldErrors.images ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5" : "bg-muted/20"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        <ImageIcon className="h-4 w-4 text-primary" /> Product Images *
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Upload images to Firebase Storage (<code>marketplace/products</code>). <strong>1st image: 1:1 square ratio &lt;= 20 KB</strong> (auto-compressed). Other images: 1:1 square ratio &lt;= 1 MB. Click any image to set as Primary Thumbnail.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label
                        className={`cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/20 bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition-all ${
                          isUploadingImage ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>{isUploadingImage ? "Compressing & Uploading..." : "Upload Image(s)"}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          multiple
                          className="hidden"
                          onChange={handleImageFileUpload}
                          disabled={isUploadingImage}
                        />
                      </label>
                    </div>
                  </div>

                  {fieldErrors.images && (
                    <p className="text-xs font-semibold text-destructive flex items-center gap-1 animate-pulse">
                      <AlertCircle className="h-4 w-4" />
                      <span>Product image is required! Please upload at least one image or provide an image link.</span>
                    </p>
                  )}

                  {/* Render Visual Image Previews for All Uploaded Images */}
                  {(() => {
                    const allImgs = Array.from(
                      new Set([
                        thumbnailUrl.trim() ? convertToDirectImageUrl(thumbnailUrl.trim()) : "",
                        ...imageUrlsText
                          .split(/[\n,]/)
                          .map((s) => convertToDirectImageUrl(s.trim()))
                          .filter(Boolean),
                      ])
                    ).filter(Boolean);

                    if (allImgs.length === 0) {
                      return (
                        <div className="p-6 border-2 border-dashed rounded-2xl text-center bg-card/50">
                          <ImageIcon className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                          <p className="text-xs text-muted-foreground mt-2 font-medium">No images uploaded yet</p>
                          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                            Click "Upload Image(s)" above to upload 1 or more images directly to Firebase Storage.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                          <span>Uploaded Images ({allImgs.length}):</span>
                          <span className="text-[10px] text-emerald-600 font-bold">Auto-saved to Storage</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                          {allImgs.map((imgUrl, idx) => {
                            const isPrimary = idx === 0 || convertToDirectImageUrl(thumbnailUrl) === imgUrl;
                            return (
                              <div
                                key={idx}
                                className={`relative group rounded-2xl border-2 overflow-hidden bg-card aspect-square flex flex-col justify-between shadow-xs transition-all ${
                                  isPrimary ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                                }`}
                              >
                                <img
                                  src={formatImageUrl(imgUrl)}
                                  alt={`Product Image ${idx + 1}`}
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover"
                                />

                                {isPrimary ? (
                                  <div className="absolute top-1.5 left-1.5 flex flex-col gap-0.5 pointer-events-none">
                                    <span className="bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                                      Primary 1:1
                                    </span>
                                    <span className="bg-emerald-600/90 text-white text-[8px] font-bold px-1 py-0.2 rounded shadow-xs">
                                      &le; 20 KB
                                    </span>
                                  </div>
                                ) : (
                                  <div className="absolute top-1.5 left-1.5 flex flex-col gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setThumbnailUrl(imgUrl);
                                        const others = allImgs.filter((u) => u !== imgUrl);
                                        setImageUrlsText(others.join("\n"));
                                        toast.success("Set as Primary Thumbnail!");
                                      }}
                                      className="bg-black/75 hover:bg-black text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      Make Main
                                    </button>
                                    <span className="bg-black/60 text-white text-[8px] px-1 py-0.2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                      1:1 &le; 1 MB
                                    </span>
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    const remaining = allImgs.filter((u) => u !== imgUrl);
                                    setThumbnailUrl(remaining[0] || "");
                                    setImageUrlsText(remaining.slice(1).join("\n"));
                                    toast.info("Image removed");
                                  }}
                                  className="absolute top-1.5 right-1.5 bg-destructive text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                                  title="Remove Image"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Manual URL Input Fields */}
                  <div className="pt-2 border-t border-border/40 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="prod-thumb" className="text-[11px] font-semibold text-muted-foreground">
                          Primary Thumbnail URL (Firebase Storage or Google Drive):
                        </Label>
                        <Input
                          id="prod-thumb"
                          value={thumbnailUrl}
                          onChange={(e) => {
                            setThumbnailUrl(e.target.value);
                            clearFieldError("images");
                          }}
                          placeholder="https://firebasestorage.googleapis.com/... or Google Drive URL"
                          className="rounded-xl font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="prod-images" className="text-[11px] font-semibold text-muted-foreground">
                          Additional Image URLs List (One URL per line):
                        </Label>
                        <Textarea
                          id="prod-images"
                          rows={1}
                          value={imageUrlsText}
                          onChange={(e) => {
                            setImageUrlsText(e.target.value);
                            clearFieldError("images");
                          }}
                          placeholder="https://firebasestorage.googleapis.com/..."
                          className="font-mono text-xs rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seller Profile Localized Map & Logo */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building className="h-4 w-4 text-primary" /> Seller Profile (<code>sellerName</code>, <code>sellerLogo</code>, <code>sellerType</code>)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-seller-en">Seller Name (English)</Label>
                      <Input
                        id="prod-seller-en"
                        placeholder="Chimertech"
                        value={sellerNameEn}
                        onChange={(e) => setSellerNameEn(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-seller-hi">Seller Name (Hindi)</Label>
                      <Input
                        id="prod-seller-hi"
                        placeholder="चिमरटेक"
                        value={sellerNameHi}
                        onChange={(e) => setSellerNameHi(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-seller-type">Seller Type (<code>String sellerType</code>)</Label>
                      <Input
                        id="prod-seller-type"
                        placeholder="seller"
                        value={sellerType}
                        onChange={(e) => setSellerType(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="prod-seller-logo" className="text-xs font-semibold">Seller Logo URL (<code>String sellerLogo</code>)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                      <Input
                        id="prod-seller-logo"
                        placeholder="https://drive.google.com/file/d/1x72e_nlxXlzwHtgzvXc..."
                        value={sellerLogo}
                        onChange={(e) => setSellerLogo(e.target.value)}
                        className="rounded-xl font-mono text-xs"
                      />
                      {sellerLogo && (
                        <div className="h-16 w-36 px-3 py-1.5 rounded-xl border-2 border-border/80 bg-white dark:bg-card shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                          <ProductImage
                            src={sellerLogo}
                            alt="Seller Logo"
                            className="max-h-12 w-auto max-w-full object-contain mx-auto"
                            fallbackIcon={Building}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delivery Config */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Truck className="h-4 w-4 text-primary" /> Delivery Config (<code>DeliveryConfig? deliveryConfig</code>)
                    </h4>
                    {deliveryStates.length > 0 && deliveryType !== "all" && (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {deliveryStates.length} State{deliveryStates.length > 1 ? "s" : ""} {deliveryType === "exclude" ? "Excluded" : "Included"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prod-del-type">Delivery Availability Type (<code>type</code>)</Label>
                    <Select value={deliveryType} onValueChange={setDeliveryType}>
                      <SelectTrigger id="prod-del-type" className="w-full rounded-xl border-input bg-background">
                        <SelectValue placeholder="Select delivery type" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all">All States (Nationwide Delivery - Deletes restriction map)</SelectItem>
                        <SelectItem value="exclude">Exclude Selected States (Not available in selected states)</SelectItem>
                        <SelectItem value="include">Include Selected States (Available ONLY in selected states)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {deliveryType === "all" && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>Available nationwide across all states. Selecting "All States" will remove the <code>deliveryConfig</code> field mapping from Firestore.</span>
                    </div>
                  )}

                  {/* State Selection Search & Select Table */}
                  {deliveryType !== "all" && (
                    <div className="space-y-3 pt-3 border-t border-border/50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-primary" /> Select States / Union Territories (<code>states</code>)
                        </Label>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDeliveryStates(INDIAN_STATES.map((s) => s.code))}
                            className="h-7 text-xs rounded-lg px-2.5"
                          >
                            Select All (36)
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDeliveryStates([])}
                            className="h-7 text-xs rounded-lg px-2.5 text-destructive hover:text-destructive"
                          >
                            Clear All
                          </Button>
                        </div>
                      </div>

                      {/* Search Input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search State / Union Territory or Code (e.g., Tamil Nadu or TN)..."
                          value={stateSearchQuery}
                          onChange={(e) => setStateSearchQuery(e.target.value)}
                          className="pl-9 pr-8 text-xs rounded-xl bg-background"
                        />
                        {stateSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setStateSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Selected Badges */}
                      {deliveryStates.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-background/60 rounded-xl border">
                          {deliveryStates.map((code) => {
                            const st = INDIAN_STATES.find((s) => s.code === code);
                            return (
                              <span
                                key={code}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 transition-all hover:bg-primary/20"
                              >
                                <span>{st ? st.name : code}</span>
                                <span className="font-bold text-[10px] opacity-75">({code})</span>
                                <button
                                  type="button"
                                  onClick={() => setDeliveryStates((prev) => prev.filter((c) => c !== code))}
                                  className="hover:bg-primary/30 rounded-full p-0.5 ml-0.5 text-primary"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Search and Select Table */}
                      <div className="rounded-xl border bg-background overflow-hidden">
                        <div className="max-h-56 overflow-y-auto">
                          <Table className="text-xs">
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                              <TableRow>
                                <TableHead className="w-12 text-center">Select</TableHead>
                                <TableHead className="font-semibold">State / Union Territory</TableHead>
                                <TableHead className="w-24 font-semibold text-center">Code</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {INDIAN_STATES.filter(
                                (s) =>
                                  s.name.toLowerCase().includes(stateSearchQuery.toLowerCase()) ||
                                  s.code.toLowerCase().includes(stateSearchQuery.toLowerCase())
                              ).map((state) => {
                                const isSelected = deliveryStates.includes(state.code);
                                return (
                                  <TableRow
                                    key={state.code}
                                    onClick={() => {
                                      if (isSelected) {
                                        setDeliveryStates((prev) => prev.filter((c) => c !== state.code));
                                      } else {
                                        setDeliveryStates((prev) => [...prev, state.code]);
                                      }
                                    }}
                                    className={`cursor-pointer transition-colors ${
                                      isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/40"
                                    }`}
                                  >
                                    <TableCell className="text-center p-2" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setDeliveryStates((prev) => [...prev, state.code]);
                                          } else {
                                            setDeliveryStates((prev) => prev.filter((c) => c !== state.code));
                                          }
                                        }}
                                        className="h-4 w-4 rounded border-primary text-primary cursor-pointer"
                                      />
                                    </TableCell>
                                    <TableCell className="font-medium p-2">{state.name}</TableCell>
                                    <TableCell className="text-center p-2">
                                      <span className="font-mono font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground text-[11px]">
                                        {state.code}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" className="bg-gradient-to-br from-primary to-primary-glow rounded-xl font-bold">
                {editingProduct ? "Save Changes" : "Create Product in Firestore"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* IMAGE PREVIEW MODAL */}
      <Dialog open={!!selectedPreviewImage} onOpenChange={(open) => !open && setSelectedPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-4 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold truncate">
              {selectedPreviewImage?.title || "Image Preview"}
            </DialogTitle>
          </DialogHeader>
          {selectedPreviewImage && (
            <div className="rounded-2xl overflow-hidden bg-black/90 flex items-center justify-center max-h-[75vh]">
              <img
                src={formatImageUrl(selectedPreviewImage.url)}
                alt={selectedPreviewImage.title}
                className="max-h-[75vh] w-auto object-contain rounded-xl"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* QUICK PRICE ONLY MODAL */}
      <Dialog open={quickPriceOpen} onOpenChange={setQuickPriceOpen}>
        <DialogContent className="max-w-md p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                <IndianRupee className="h-4 w-4" />
              </div>
              <span>Update Product Price Only</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modify only the selling price or MRP. All product titles, multi-language descriptions, images, and specifications remain completely preserved.
            </DialogDescription>
          </DialogHeader>

          {quickProduct && (
            <form onSubmit={handleSaveQuickPrice} className="space-y-4 pt-2">
              <div className="p-3 rounded-2xl border bg-muted/30 space-y-1">
                <div className="text-xs font-bold text-foreground truncate">
                  {getLocalizedText(quickProduct.name)}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  ID: {quickProduct.id}
                </div>
              </div>

              {(() => {
                const p = Number(quickPriceVal) || 0;
                const m = Number(quickMrpVal) || 0;
                const isInvalid = p > 0 && m > 0 && m <= p;
                const discount = m > p && m > 0 ? Math.round(((m - p) / m) * 100) : 0;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="qp-price" className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                          <IndianRupee className="h-3 w-3" /> Selling Price (₹) *
                        </Label>
                        <Input
                          id="qp-price"
                          type="number"
                          min="0"
                          value={quickPriceVal}
                          onChange={(e) => setQuickPriceVal(e.target.value)}
                          required
                          autoFocus
                          className="rounded-xl font-mono text-sm font-bold text-emerald-600 border-emerald-500/40 focus:border-emerald-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="qp-mrp" className="text-xs font-semibold text-red-500 flex items-center gap-1">
                          <IndianRupee className="h-3 w-3" /> MRP Price (₹) *
                        </Label>
                        <Input
                          id="qp-mrp"
                          type="number"
                          min="0"
                          value={quickMrpVal}
                          onChange={(e) => setQuickMrpVal(e.target.value)}
                          className={`rounded-xl font-mono text-sm ${
                            isInvalid
                              ? "border-destructive ring-2 ring-destructive/40 bg-destructive/5 text-destructive font-bold"
                              : "text-red-500 font-semibold border-red-300 dark:border-red-900"
                          }`}
                        />
                      </div>
                    </div>

                    {isInvalid ? (
                      <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>Condition Error: MRP (₹{m}) must be strictly GREATER than Selling Price (₹{p}).</span>
                      </div>
                    ) : discount > 0 ? (
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-semibold flex items-center justify-between">
                        <span>Customer Discount:</span>
                        <span className="font-bold">{discount}% OFF</span>
                      </div>
                    ) : null}
                  </>
                );
              })()}

              <DialogFooter className="pt-2 sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQuickPriceOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdatingPrice}
                  className="rounded-xl bg-primary text-primary-foreground font-semibold px-5"
                >
                  {isUpdatingPrice ? "Updating..." : "Save Price Only"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
