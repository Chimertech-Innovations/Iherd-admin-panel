import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useAdminProducts, useFirebaseCollection, useBestSellers } from "@/hooks/useFirebaseData";
import { getLocalizedText, formatImageUrl } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";

export const Route = createFileRoute("/marketplace/products")({
  head: () => ({ meta: [{ title: "Product Marketplace — iHerd Admin" }] }),
  component: ProductsMarketplacePage,
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

  // 1. Identity & Names
  const [productId, setProductId] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameHi, setNameHi] = useState("");
  const [namePa, setNamePa] = useState("");
  const [nameMr, setNameMr] = useState("");

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

  // 4. Quantity & Units
  const [quantity, setQuantity] = useState("1000");
  const [quantityUnitEn, setQuantityUnitEn] = useState("Unit");
  const [quantityUnitHi, setQuantityUnitHi] = useState("लीटर");
  const [quantityUnitPa, setQuantityUnitPa] = useState("ਲੀਟਰ");

  // 5. Weight & Units
  const [weight, setWeight] = useState("2500");
  const [weightUnitEn, setWeightUnitEn] = useState("g");
  const [weightUnitHi, setWeightUnitHi] = useState("ग्राम");
  const [weightUnitPa, setWeightUnitPa] = useState("ਗ੍ਰਾਮ");

  // 6. Seller Profile & Permissions
  const [sellerNameEn, setSellerNameEn] = useState("Chimertech");
  const [sellerNameHi, setSellerNameHi] = useState("चिमरटेक");
  const [sellerNamePa, setSellerNamePa] = useState("ਚਿਮਰਟੈਕ");
  const [sellerLogo, setSellerLogo] = useState("");
  const [sellerType, setSellerType] = useState("seller");
  const [postedByRole, setPostedByRole] = useState("admin");
  const [postedByUid, setPostedByUid] = useState("admin-root");

  // 7. Visual Media & Gallery
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [imageUrlsText, setImageUrlsText] = useState("");

  // 8. Description & Specifications
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionHi, setDescriptionHi] = useState("");
  const [descriptionPa, setDescriptionPa] = useState("");

  const [specificationEn, setSpecificationEn] = useState("");
  const [specificationHi, setSpecificationHi] = useState("");
  const [specificationPa, setSpecificationPa] = useState("");

  // 9. Ingredients & Care
  const [productIngredientsEn, setProductIngredientsEn] = useState("");
  const [productIngredientsHi, setProductIngredientsHi] = useState("लागू नहीं");
  const [productIngredientsPa, setProductIngredientsPa] = useState("ਲਾਗੂ ਨਹੀਂ");

  const [usageEn, setUsageEn] = useState("");
  const [usageHi, setUsageHi] = useState("");

  const [instructionsToUseEn, setInstructionsToUseEn] = useState("");
  const [instructionsToUseHi, setInstructionsToUseHi] = useState("");
  const [instructionsToUsePa, setInstructionsToUsePa] = useState("");

  const [storageConditionEn, setStorageConditionEn] = useState("");
  const [storageConditionHi, setStorageConditionHi] = useState("");
  const [storageConditionPa, setStorageConditionPa] = useState("");

  const [bestBeforeEn, setBestBeforeEn] = useState("");
  const [bestBeforeHi, setBestBeforeHi] = useState("लागू नहीं");
  const [bestBeforePa, setBestBeforePa] = useState("ਲਾਗੂ ਨਹੀਂ");

  // 10. Delivery Config
  const [isFreeDelivery, setIsFreeDelivery] = useState(true);
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [estimatedDays, setEstimatedDays] = useState("3");

  const [status, setStatus] = useState("Approved");

  // Category mapping
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat) => {
      map.set(cat.id, getLocalizedText(cat.name, cat.id));
    });
    return map;
  }, [categories]);

  const openAddModal = () => {
    setEditingProduct(null);
    setProductId(`PRD-${Date.now().toString().slice(-6)}`);
    setNameEn("");
    setNameHi("");
    setNamePa("");
    setNameMr("");

    setCategoryId(categories[0]?.id || "cat_breeding");
    setSubCategoryId("subcat_ai_equipment");

    setPrice("8850");
    setMrp("9999");
    setGst("18");
    setRating("4.5");
    setBestSeller(false);
    setCartAddded(false);

    setQuantity("1000");
    setQuantityUnitEn("Unit");
    setQuantityUnitHi("लीटर");
    setQuantityUnitPa("ਲੀਟਰ");

    setWeight("2500");
    setWeightUnitEn("g");
    setWeightUnitHi("ग्राम");
    setWeightUnitPa("ਗ੍ਰਾਮ");

    setSellerNameEn("Chimertech");
    setSellerNameHi("चिमरटेक");
    setSellerNamePa("ਚਿਮਰਟੈਕ");
    setSellerLogo("");
    setSellerType("seller");
    setPostedByRole("admin");
    setPostedByUid("admin-root");

    setThumbnailUrl("");
    setImageUrlsText("");

    setDescriptionEn("");
    setDescriptionHi("");
    setDescriptionPa("");

    setSpecificationEn("");
    setSpecificationHi("");
    setSpecificationPa("");

    setProductIngredientsEn("");
    setProductIngredientsHi("लागू नहीं");
    setProductIngredientsPa("ਲਾਗੂ ਨਹੀਂ");

    setUsageEn("");
    setUsageHi("");

    setInstructionsToUseEn("");
    setInstructionsToUseHi("");
    setInstructionsToUsePa("");

    setStorageConditionEn("");
    setStorageConditionHi("");
    setStorageConditionPa("");

    setBestBeforeEn("");
    setBestBeforeHi("लागू नहीं");
    setBestBeforePa("ਲਾਗੂ ਨਹੀਂ");

    setIsFreeDelivery(true);
    setDeliveryCharge("0");
    setEstimatedDays("3");

    setStatus("Approved");
    setModalTab("general");
    setModalOpen(true);
  };

  const openEditModal = (p: any) => {
    setEditingProduct(p);
    setProductId(p.id || "");

    // Name Map
    if (typeof p.name === "object" && p.name !== null) {
      setNameEn(p.name.en || "");
      setNameHi(p.name.hi || "");
      setNamePa(p.name.pa || "");
      setNameMr(p.name.mr || "");
    } else {
      setNameEn(String(p.name || p.title || ""));
      setNameHi("");
      setNamePa("");
      setNameMr("");
    }

    setCategoryId(p.categoryId || "cat_breeding");
    setSubCategoryId(p.subCategoryId || "subcat_ai_equipment");

    setPrice(String(p.price || 0));
    setMrp(String(p.mrp || p.price || 0));
    setGst(String(p.gst !== undefined ? p.gst : 18));
    setRating(String(p.rating || 4.5));
    setBestSeller(Boolean(p.bestSeller || p.isBestSeller));
    setCartAddded(Boolean(p.cartAddded || p.cartAdded));

    // Quantity & Quantity Unit Map
    setQuantity(String(p.quantity !== undefined ? p.quantity : (p.stock !== undefined ? p.stock : 1000)));
    if (typeof p.quantityUnit === "object" && p.quantityUnit !== null) {
      setQuantityUnitEn(p.quantityUnit.en || "Unit");
      setQuantityUnitHi(p.quantityUnit.hi || "लीटर");
      setQuantityUnitPa(p.quantityUnit.pa || "ਲੀਟਰ");
    } else {
      setQuantityUnitEn(String(p.quantityUnit || "Unit"));
      setQuantityUnitHi("लीटर");
      setQuantityUnitPa("ਲੀਟਰ");
    }

    // Weight & Weight Unit Map
    setWeight(String(p.weight || 0));
    if (typeof p.weightUnit === "object" && p.weightUnit !== null) {
      setWeightUnitEn(p.weightUnit.en || p.weightUnit.key || "g");
      setWeightUnitHi(p.weightUnit.hi || "ग्राम");
      setWeightUnitPa(p.weightUnit.pa || "ਗ੍ਰਾਮ");
    } else {
      setWeightUnitEn(String(p.weightUnit || "g"));
      setWeightUnitHi("ग्राम");
      setWeightUnitPa("ਗ੍ਰਾਮ");
    }

    // Seller Profile Map
    if (typeof p.sellerName === "object" && p.sellerName !== null) {
      setSellerNameEn(p.sellerName.en || "");
      setSellerNameHi(p.sellerName.hi || "");
      setSellerNamePa(p.sellerName.pa || "");
    } else {
      setSellerNameEn(String(p.sellerName || "Chimertech"));
      setSellerNameHi("चिमरटेक");
      setSellerNamePa("ਚਿਮਰਟੈਕ");
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
      setDescriptionEn(p.description.en || "");
      setDescriptionHi(p.description.hi || "");
      setDescriptionPa(p.description.pa || "");
    } else {
      setDescriptionEn(String(p.description || ""));
      setDescriptionHi("");
      setDescriptionPa("");
    }

    // Specification Map
    if (typeof p.specification === "object" && p.specification !== null) {
      setSpecificationEn(p.specification.en || "");
      setSpecificationHi(p.specification.hi || "");
      setSpecificationPa(p.specification.pa || "");
    } else {
      setSpecificationEn(String(p.specification || ""));
      setSpecificationHi("");
      setSpecificationPa("");
    }

    // Product Ingredients Map
    if (typeof p.productIngredients === "object" && p.productIngredients !== null) {
      setProductIngredientsEn(p.productIngredients.en || "");
      setProductIngredientsHi(p.productIngredients.hi || "लागू नहीं");
      setProductIngredientsPa(p.productIngredients.pa || "ਲਾਗੂ ਨਹੀਂ");
    } else {
      setProductIngredientsEn(String(p.productIngredients || ""));
      setProductIngredientsHi("लागू नहीं");
      setProductIngredientsPa("ਲਾਗੂ ਨਹੀਂ");
    }

    // Usage Map
    if (typeof p.usage === "object" && p.usage !== null) {
      setUsageEn(p.usage.en || "");
      setUsageHi(p.usage.hi || "");
    } else {
      setUsageEn(String(p.usage || ""));
      setUsageHi("");
    }

    // Instructions to Use Map
    if (typeof p.instructionsToUse === "object" && p.instructionsToUse !== null) {
      setInstructionsToUseEn(Array.isArray(p.instructionsToUse.en) ? p.instructionsToUse.en.join("\n") : (p.instructionsToUse.en || ""));
      setInstructionsToUseHi(Array.isArray(p.instructionsToUse.hi) ? p.instructionsToUse.hi.join("\n") : (p.instructionsToUse.hi || ""));
      setInstructionsToUsePa(Array.isArray(p.instructionsToUse.pa) ? p.instructionsToUse.pa.join("\n") : (p.instructionsToUse.pa || ""));
    } else {
      setInstructionsToUseEn(String(p.instructionsToUse || ""));
      setInstructionsToUseHi("");
      setInstructionsToUsePa("");
    }

    // Storage Condition Map
    if (typeof p.storageCondition === "object" && p.storageCondition !== null) {
      setStorageConditionEn(p.storageCondition.en || "");
      setStorageConditionHi(p.storageCondition.hi || "");
      setStorageConditionPa(p.storageCondition.pa || "");
    } else {
      setStorageConditionEn(String(p.storageCondition || ""));
      setStorageConditionHi("");
      setStorageConditionPa("");
    }

    // Best Before Map
    const bb = p.bestBefore || p.best_before;
    if (typeof bb === "object" && bb !== null) {
      setBestBeforeEn(bb.en || "");
      setBestBeforeHi(bb.hi || "लागू नहीं");
      setBestBeforePa(bb.pa || "ਲਾਗੂ ਨਹੀਂ");
    } else {
      setBestBeforeEn(String(bb || ""));
      setBestBeforeHi("लागू नहीं");
      setBestBeforePa("ਲਾਗੂ नहीं");
    }

    // Delivery Config
    const dc = p.deliveryConfig || {};
    setIsFreeDelivery(dc.isFreeDelivery !== undefined ? Boolean(dc.isFreeDelivery) : (Number(dc.deliveryCharge || 0) === 0));
    setDeliveryCharge(String(dc.deliveryCharge || 0));
    setEstimatedDays(String(dc.estimatedDays || 3));

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNameEn = toStr(nameEn);
    const cleanNameHi = toStr(nameHi);

    if (!cleanNameEn && !cleanNameHi) {
      toast.error("Please provide at least an English or Hindi product name");
      return;
    }

    // Parse image URLs list
    const rawImages = toStr(imageUrlsText)
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const finalThumbnail = toStr(thumbnailUrl) || (rawImages.length > 0 ? rawImages[0] : "");
    const finalImageUrls = Array.from(new Set([finalThumbnail, ...rawImages].filter(Boolean)));

    const selectedCategoryObj = categories.find((c) => c.id === categoryId);
    const categoryNameEn = selectedCategoryObj ? getLocalizedText(selectedCategoryObj.name, categoryId) : "Breeding";
    const subCategoryNameEn = toStr(subCategoryId).replace(/^subcat_/, "").replace(/_/g, " ");

    // EXACT 100% Match for Flutter `ProductListingEntity` Model & Types
    const payload: any = {
      id: toStr(productId) || `PRD-${Date.now()}`,
      
      // Map<String, dynamic> name
      name: {
        en: cleanNameEn || cleanNameHi,
        hi: cleanNameHi || cleanNameEn,
        ...(toStr(namePa) ? { pa: toStr(namePa) } : {}),
        ...(toStr(nameMr) ? { mr: toStr(nameMr) } : {}),
      },

      // Map<String, dynamic> sellerName
      sellerName: {
        en: toStr(sellerNameEn) || "Chimertech",
        hi: toStr(sellerNameHi) || "चिमरटेक",
        pa: toStr(sellerNamePa) || "ਚਿਮਰਟੈਕ",
      },

      // String sellerLogo
      sellerLogo: toStr(sellerLogo),

      // String? postedByRole
      postedByRole: toStr(postedByRole) || "admin",

      // String? postedByUid
      postedByUid: toStr(postedByUid) || "admin-root",

      // List<String> imageUrls
      imageUrls: finalImageUrls,

      // String thumbnailUrl
      thumbnailUrl: finalThumbnail,

      // Map<String, dynamic> description
      description: {
        en: toStr(descriptionEn) || toStr(descriptionHi),
        hi: toStr(descriptionHi) || toStr(descriptionEn),
        ...(toStr(descriptionPa) ? { pa: toStr(descriptionPa) } : {}),
      },

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

      // Map<String, dynamic> weightUnit
      weightUnit: {
        en: toStr(weightUnitEn) || "g",
        hi: toStr(weightUnitHi) || "ग्राम",
        pa: toStr(weightUnitPa) || "ਗ੍ਰਾਮ",
      },

      // Map<String, dynamic>? usage
      usage: toStr(usageEn) || toStr(usageHi) ? {
        en: toStr(usageEn) || toStr(usageHi),
        ...(toStr(usageHi) ? { hi: toStr(usageHi) } : {}),
      } : null,

      // Map<String, dynamic>? storageCondition
      storageCondition: toStr(storageConditionEn) || toStr(storageConditionHi) || toStr(storageConditionPa) ? {
        en: toStr(storageConditionEn) || null,
        hi: toStr(storageConditionHi) || null,
        pa: toStr(storageConditionPa) || null,
      } : null,

      // Map<String, dynamic>? specification
      specification: toStr(specificationEn) || toStr(specificationHi) || toStr(specificationPa) ? {
        en: toStr(specificationEn) || toStr(specificationHi),
        hi: toStr(specificationHi) || toStr(specificationEn),
        ...(toStr(specificationPa) ? { pa: toStr(specificationPa) } : {}),
      } : null,

      // Map<String, dynamic>? instructionsToUse
      instructionsToUse: toStr(instructionsToUseEn) || toStr(instructionsToUseHi) || toStr(instructionsToUsePa) ? {
        en: toStr(instructionsToUseEn) || toStr(instructionsToUseHi),
        hi: toStr(instructionsToUseHi) || toStr(instructionsToUseEn),
        ...(toStr(instructionsToUsePa) ? { pa: toStr(instructionsToUsePa) } : {}),
      } : null,

      // Map<String, dynamic>? productIngredients
      productIngredients: toStr(productIngredientsEn) || toStr(productIngredientsHi) || toStr(productIngredientsPa) ? {
        en: toStr(productIngredientsEn) || toStr(productIngredientsHi),
        hi: toStr(productIngredientsHi) || "लागू नहीं",
        pa: toStr(productIngredientsPa) || "ਲਾਗੂ ਨਹੀਂ",
      } : null,

      // String categoryId
      categoryId: toStr(categoryId),

      // String subCategoryId
      subCategoryId: toStr(subCategoryId),

      // Map<String, String>? category
      category: {
        en: categoryNameEn,
      },

      // Map<String, String>? subCategory
      subCategory: {
        en: subCategoryNameEn,
      },

      // String sellerType
      sellerType: toStr(sellerType) || "seller",

      // double gst
      gst: Number(gst) || 18.0,

      // Map<String, dynamic>? bestBefore
      bestBefore: {
        en: toStr(bestBeforeEn) || toStr(bestBeforeHi),
        hi: toStr(bestBeforeHi) || "लागू नहीं",
        pa: toStr(bestBeforePa) || "ਲਾਗੂ ਨਹੀਂ",
      },

      // bool? cartAddded
      cartAddded: Boolean(cartAddded),

      // bool bestSeller
      bestSeller: Boolean(bestSeller),

      // DeliveryConfig? deliveryConfig
      deliveryConfig: {
        isFreeDelivery: Boolean(isFreeDelivery),
        deliveryCharge: isFreeDelivery ? 0.0 : Number(deliveryCharge) || 0.0,
        estimatedDays: Math.round(Number(estimatedDays) || 3),
      },
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

  const handleToggleBestSeller = async (p: any) => {
    const isBs = Boolean(p.bestSeller || p.isBestSeller);
    try {
      await toggleBestSeller.mutateAsync({
        productId: p.id,
        isBestSeller: !isBs,
      });
      toast.success(!isBs ? `Marked "${getLocalizedText(p.name || p.title)}" as Best Seller` : `Removed Best Seller status`);
    } catch (err: any) {
      toast.error(`Error updating best seller: ${err.message}`);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      const pName = getLocalizedText(p.name || p.title, "").toLowerCase();
      const pId = String(p.id || "").toLowerCase();
      const pSeller = getLocalizedText(p.sellerName, "").toLowerCase();
      const matchQ = !q || pName.includes(q.toLowerCase()) || pId.includes(q.toLowerCase()) || pSeller.includes(q.toLowerCase());

      const pStatus = (getLocalizedText(p.status, "Approved")).toLowerCase();
      const isBs = Boolean(p.bestSeller || p.isBestSeller);

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
        { header: "Free Delivery", accessor: (p: any) => p.deliveryConfig?.isFreeDelivery ? "Yes" : "No" },
        { header: "Delivery Charge", accessor: (p: any) => p.deliveryConfig?.deliveryCharge ?? 0 },
        { header: "Estimated Delivery (Days)", accessor: (p: any) => p.deliveryConfig?.estimatedDays ?? 3 },
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
              <h3 className="text-2xl font-bold mt-1 text-foreground">{totalCount}</h3>
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
              <p className="text-xs text-muted-foreground font-medium">Approved / Active</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-600">{approvedCount}</h3>
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
              <h3 className="text-2xl font-bold mt-1 text-amber-500">{bestSellerCount}</h3>
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
              <h3 className="text-2xl font-bold mt-1 text-rose-500">{lowStockCount}</h3>
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
              {filteredProducts.length === 0 ? (
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
                  const isBs = Boolean(p.bestSeller || p.isBestSeller);
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
                        <div className="space-y-0.5">
                          <div className="font-bold text-primary text-sm flex items-center gap-1">
                            <span>₹{Number(p.price || 0).toLocaleString()}</span>
                            {Number(p.mrp || 0) > Number(p.price || 0) && (
                              <span className="text-[10px] text-muted-foreground line-through font-normal">
                                ₹{Number(p.mrp).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">GST: {p.gst || 18}%</div>
                        </div>
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
                        <div className="flex items-center gap-1.5">
                          {p.sellerLogo ? (
                            <ProductImage src={p.sellerLogo} alt="Seller Logo" className="h-5 w-5 rounded-full object-cover border shrink-0 bg-white" fallbackIcon={Building} />
                          ) : (
                            <Building className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                          <div className="font-medium text-foreground truncate max-w-[140px]">
                            {getLocalizedText(p.sellerName, "Chimertech")}
                          </div>
                        </div>
                      </TableCell>

                      {/* Status & Badges */}
                      <TableCell>
                        <div className="space-y-1">
                          <StatusBadge status={pStatus} />
                          {isBs && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              <Flame className="h-3 w-3 fill-amber-500" /> Best Seller
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
                            className={`h-8 px-2 text-xs gap-1 rounded-xl ${
                              isBs ? "bg-amber-500 hover:bg-amber-600 text-white" : "border-amber-500/30 text-amber-600 hover:bg-amber-50"
                            }`}
                            title={isBs ? "Remove Best Seller" : "Mark as Best Seller"}
                          >
                            <Flame className="h-3 w-3" />
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
                      <span className="text-muted-foreground">Rating Score (<code>rating</code>)</span>
                      <span className="font-bold text-amber-500 flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-current" /> {selectedProductDetail.rating || 4.5} / 5.0
                      </span>
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
                    <ProductImage src={selectedProductDetail.sellerLogo} alt="Logo" className="h-10 w-10 rounded-2xl object-cover border shrink-0 bg-white" fallbackIcon={Building} />
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
                      onChange={(e) => setNameEn(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Multilingual Names (Map<String, dynamic> name) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-2xl bg-muted/30 border">
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-name-hi">Hindi (<code>name.hi</code>)</Label>
                    <Input
                      id="prod-name-hi"
                      placeholder="e.g. पोर्टेबल लिक्विड नाइट्रोजन"
                      value={nameHi}
                      onChange={(e) => setNameHi(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-name-pa">Punjabi (<code>name.pa</code>)</Label>
                    <Input
                      id="prod-name-pa"
                      placeholder="e.g. ਪੋਰਟੇਬਲ ਤਰਲ ਨਾਈਟ੍ਰੋਜਨ"
                      value={namePa}
                      onChange={(e) => setNamePa(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-name-mr">Marathi (<code>name.mr</code>)</Label>
                    <Input
                      id="prod-name-mr"
                      placeholder="e.g. पोर्टेबल लिक्विड नायट्रोजन"
                      value={nameMr}
                      onChange={(e) => setNameMr(e.target.value)}
                    />
                  </div>
                </div>

                {/* Categories (String categoryId, String subCategoryId) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-cat">Category ID (<code>String categoryId</code>)</Label>
                    <Input
                      id="prod-cat"
                      placeholder="e.g. cat_breeding"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prod-subcat">Sub Category ID (<code>String subCategoryId</code>)</Label>
                    <Input
                      id="prod-subcat"
                      placeholder="e.g. subcat_ai_equipment"
                      value={subCategoryId}
                      onChange={(e) => setSubCategoryId(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Pricing, MRP, GST & Rating (double) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-muted/30 border">
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-price" className="text-primary font-bold">Price (<code>double price</code>) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                      <Input
                        id="prod-price"
                        type="number"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                        className="pl-7 font-bold text-base"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prod-mrp">MRP (<code>double mrp</code>)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                      <Input
                        id="prod-mrp"
                        type="number"
                        step="0.01"
                        value={mrp}
                        onChange={(e) => setMrp(e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prod-gst">GST % (<code>double gst</code>)</Label>
                    <Input
                      id="prod-gst"
                      type="number"
                      step="0.1"
                      value={gst}
                      onChange={(e) => setGst(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prod-rating">Rating (<code>double? rating</code>)</Label>
                    <Input
                      id="prod-rating"
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                    />
                  </div>
                </div>

                {/* Best Seller & Cart Added (bool) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-primary/10 border border-primary/30">
                    <div className="flex items-center gap-2.5">
                      <ShoppingBag className="h-5 w-5 text-primary" />
                      <div>
                        <Label htmlFor="prod-cart" className="cursor-pointer font-bold text-xs text-foreground block">
                          Cart Added (<code>bool? cartAddded</code>)
                        </Label>
                        <p className="text-[10px] text-muted-foreground">Enable direct cart button</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      id="prod-cart"
                      checked={cartAddded}
                      onChange={(e) => setCartAddded(e.target.checked)}
                      className="h-5 w-5 rounded text-primary cursor-pointer"
                    />
                  </div>
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
                      <Label htmlFor="prod-weight">Weight (double)</Label>
                      <Input
                        id="prod-weight"
                        type="number"
                        step="0.1"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                      />
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

                {/* Best Before Localized Map */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-primary" /> Best Before (<code>Map&lt;String, dynamic&gt;? bestBefore</code>)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-bb-en">English</Label>
                      <Input
                        id="prod-bb-en"
                        placeholder="e.g. Not Applicable / 24 Months"
                        value={bestBeforeEn}
                        onChange={(e) => setBestBeforeEn(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-bb-hi">Hindi</Label>
                      <Input
                        id="prod-bb-hi"
                        placeholder="e.g. लागू नहीं"
                        value={bestBeforeHi}
                        onChange={(e) => setBestBeforeHi(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-bb-pa">Punjabi</Label>
                      <Input
                        id="prod-bb-pa"
                        placeholder="e.g. ਲਾਗੂ ਨਹੀਂ"
                        value={bestBeforePa}
                        onChange={(e) => setBestBeforePa(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: SPECS & DETAILS */}
              <TabsContent value="specs" className="space-y-4">
                {/* Description Map */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Description (<code>Map&lt;String, dynamic&gt; description</code>)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-desc-en">English</Label>
                      <Textarea
                        id="prod-desc-en"
                        rows={2}
                        placeholder="English description..."
                        value={descriptionEn}
                        onChange={(e) => setDescriptionEn(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-desc-hi">Hindi</Label>
                      <Textarea
                        id="prod-desc-hi"
                        rows={2}
                        placeholder="e.g. 2 लीटर एलएन2 पोर्टेबल..."
                        value={descriptionHi}
                        onChange={(e) => setDescriptionHi(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Specification Map */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Specifications (<code>Map&lt;String, dynamic&gt;? specification</code>)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-spec-en">English</Label>
                      <Textarea
                        id="prod-spec-en"
                        rows={2}
                        placeholder="Technical specs in English..."
                        value={specificationEn}
                        onChange={(e) => setSpecificationEn(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-spec-hi">Hindi</Label>
                      <Textarea
                        id="prod-spec-hi"
                        rows={2}
                        placeholder="e.g. 2 लीटर LN2 वीर्य भंडारण..."
                        value={specificationHi}
                        onChange={(e) => setSpecificationHi(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Product Ingredients Map */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Ingredients (<code>Map&lt;String, dynamic&gt;? productIngredients</code>)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-ing-en">English</Label>
                      <Input
                        id="prod-ing-en"
                        placeholder="e.g. Not Applicable / Reagent"
                        value={productIngredientsEn}
                        onChange={(e) => setProductIngredientsEn(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-ing-hi">Hindi</Label>
                      <Input
                        id="prod-ing-hi"
                        placeholder="e.g. लागू नहीं"
                        value={productIngredientsHi}
                        onChange={(e) => setProductIngredientsHi(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Usage & Instructions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-usage-en">Usage (<code>Map? usage</code>)</Label>
                    <Textarea
                      id="prod-usage-en"
                      rows={2}
                      placeholder="e.g. Apply 10ml to the affected area..."
                      value={usageEn}
                      onChange={(e) => setUsageEn(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-inst-hi">Instructions (<code>Map? instructionsToUse</code>)</Label>
                    <Textarea
                      id="prod-inst-hi"
                      rows={2}
                      placeholder="e.g. लिक्विड नाइट्रोजन हैंडलिंग निर्देश..."
                      value={instructionsToUseHi}
                      onChange={(e) => setInstructionsToUseHi(e.target.value)}
                    />
                  </div>
                </div>

                {/* Storage Condition Map */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Storage Condition (<code>Map&lt;String, dynamic&gt;? storageCondition</code>)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-store-en">English</Label>
                      <Input
                        id="prod-store-en"
                        placeholder="e.g. Store in a cool dry place"
                        value={storageConditionEn}
                        onChange={(e) => setStorageConditionEn(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-store-hi">Hindi (<code>hi</code>)</Label>
                      <Input
                        id="prod-store-hi"
                        placeholder="e.g. ठंडी और सूखी जगह पर रखें"
                        value={storageConditionHi}
                        onChange={(e) => setStorageConditionHi(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-store-pa">Punjabi (<code>pa</code>)</Label>
                      <Input
                        id="prod-store-pa"
                        placeholder="e.g. ਕਮਰੇ ਦੇ ਤਾਪਮਾਨ ਤੇ ਰੱਖੋ"
                        value={storageConditionPa}
                        onChange={(e) => setStorageConditionPa(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 4: MEDIA, SELLER & DELIVERY */}
              <TabsContent value="media" className="space-y-4">
                {/* Thumbnail URL with Google Drive Support */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                  <div className="space-y-1.5 flex-1">
                    <Label htmlFor="prod-thumb">Thumbnail URL (<code>String thumbnailUrl</code>)</Label>
                    <Input
                      id="prod-thumb"
                      placeholder="https://drive.google.com/file/d/... or web image URL"
                      value={thumbnailUrl}
                      onChange={(e) => setThumbnailUrl(e.target.value)}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Paste direct Google Drive link or web image URL.
                    </span>
                  </div>
                  {thumbnailUrl && (
                    <div className="h-14 w-14 rounded-2xl border bg-muted overflow-hidden flex items-center justify-center shrink-0">
                      <ProductImage src={thumbnailUrl} alt="Thumb" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>

                {/* Array of Image URLs */}
                <div className="space-y-1.5">
                  <Label htmlFor="prod-images">Image URLs List (<code>List&lt;String&gt; imageUrls</code>)</Label>
                  <Textarea
                    id="prod-images"
                    rows={3}
                    placeholder="https://drive.google.com/file/d/1AdeHmp...&#10;https://drive.google.com/file/d/1x72e_n..."
                    value={imageUrlsText}
                    onChange={(e) => setImageUrlsText(e.target.value)}
                    className="font-mono text-xs"
                  />
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

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center pt-1">
                    <div className="space-y-1.5 flex-1">
                      <Label htmlFor="prod-seller-logo">Seller Logo URL (<code>String sellerLogo</code>)</Label>
                      <Input
                        id="prod-seller-logo"
                        placeholder="https://drive.google.com/file/d/1x72e_nlxXlzwHtgzvXc..."
                        value={sellerLogo}
                        onChange={(e) => setSellerLogo(e.target.value)}
                      />
                    </div>
                    {sellerLogo && (
                      <div className="h-10 w-10 rounded-2xl border bg-muted overflow-hidden flex items-center justify-center shrink-0">
                        <ProductImage src={sellerLogo} alt="Logo" className="h-full w-full object-cover" fallbackIcon={Building} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery Config */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-primary" /> Delivery Config (<code>DeliveryConfig? deliveryConfig</code>)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5 flex flex-col justify-center">
                      <Label className="cursor-pointer">Free Delivery</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="checkbox"
                          id="prod-free-del"
                          checked={isFreeDelivery}
                          onChange={(e) => setIsFreeDelivery(e.target.checked)}
                          className="h-4 w-4 rounded text-primary cursor-pointer"
                        />
                        <label htmlFor="prod-free-del" className="text-xs text-muted-foreground cursor-pointer">
                          {isFreeDelivery ? "Free Delivery" : "Charge shipping"}
                        </label>
                      </div>
                    </div>

                    {!isFreeDelivery && (
                      <div className="space-y-1.5">
                        <Label htmlFor="prod-del-charge">Delivery Charge (₹)</Label>
                        <Input
                          id="prod-del-charge"
                          type="number"
                          value={deliveryCharge}
                          onChange={(e) => setDeliveryCharge(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="prod-del-days">Estimated Delivery (Days)</Label>
                      <Input
                        id="prod-del-days"
                        type="number"
                        value={estimatedDays}
                        onChange={(e) => setEstimatedDays(e.target.value)}
                      />
                    </div>
                  </div>
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
    </div>
  );
}
