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
  X,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminProducts, useFirebaseCollection, useBestSellers } from "@/hooks/useFirebaseData";
import { getLocalizedText, formatImageUrl } from "@/lib/utils";

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
    setEditingProduct(p);
    setProductId(p.id || "");

    // Name Map (en, hi, kn, mr, pa, ta)
    if (typeof p.name === "object" && p.name !== null) {
      setNameEn(p.name.en || "");
      setNameHi(p.name.hi || "");
      setNameKn(p.name.kn || "");
      setNameMr(p.name.mr || "");
      setNamePa(p.name.pa || "");
      setNameTa(p.name.ta || "");
    } else {
      const s = String(p.name || p.title || "");
      setNameEn(s);
      setNameHi("");
      setNameKn("");
      setNameMr("");
      setNamePa("");
      setNameTa("");
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
      setQuantityUnitEn(p.quantityUnit.en || "Unit");
      setQuantityUnitHi(p.quantityUnit.hi || "इकाई");
      setQuantityUnitKn(p.quantityUnit.kn || "ಘಟಕ");
      setQuantityUnitMr(p.quantityUnit.mr || "युनिट");
      setQuantityUnitPa(p.quantityUnit.pa || "ਯੂਨਿਟ");
      setQuantityUnitTa(p.quantityUnit.ta || "அலகு");
    } else {
      const s = String(p.quantityUnit || "Unit");
      setQuantityUnitEn(s);
      setQuantityUnitHi("इकाई");
      setQuantityUnitKn("ಘಟಕ");
      setQuantityUnitMr("युनिट");
      setQuantityUnitPa("ਯੂਨਿਟ");
      setQuantityUnitTa("அலகு");
    }

    // Weight & Weight Unit Map
    setWeight(String(p.weight || 0));
    if (typeof p.weightUnit === "object" && p.weightUnit !== null) {
      setWeightUnitEn(p.weightUnit.en || p.weightUnit.key || "g");
      setWeightUnitHi(p.weightUnit.hi || "ग्राम");
      setWeightUnitKn(p.weightUnit.kn || "g");
      setWeightUnitMr(p.weightUnit.mr || "g");
      setWeightUnitPa(p.weightUnit.pa || "ਗ੍ਰਾਮ");
      setWeightUnitTa(p.weightUnit.ta || "g");
    } else {
      const s = String(p.weightUnit || "g");
      setWeightUnitEn(s);
      setWeightUnitHi("ग्राम");
      setWeightUnitKn("g");
      setWeightUnitMr("g");
      setWeightUnitPa("ਗ੍ਰਾਮ");
      setWeightUnitTa("g");
    }

    // Seller Profile Map
    if (typeof p.sellerName === "object" && p.sellerName !== null) {
      setSellerNameEn(p.sellerName.en || "");
      setSellerNameHi(p.sellerName.hi || "");
      setSellerNameKn(p.sellerName.kn || "");
      setSellerNameMr(p.sellerName.mr || "");
      setSellerNamePa(p.sellerName.pa || "");
      setSellerNameTa(p.sellerName.ta || "");
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
      setDescriptionEn(p.description.en || "");
      setDescriptionHi(p.description.hi || "");
      setDescriptionKn(p.description.kn || "");
      setDescriptionMr(p.description.mr || "");
      setDescriptionPa(p.description.pa || "");
      setDescriptionTa(p.description.ta || "");
    } else {
      const s = String(p.description || "");
      setDescriptionEn(s);
      setDescriptionHi("");
      setDescriptionKn("");
      setDescriptionMr("");
      setDescriptionPa("");
      setDescriptionTa("");
    }

    // Specification Map
    if (typeof p.specification === "object" && p.specification !== null) {
      setSpecificationEn(p.specification.en || "");
      setSpecificationHi(p.specification.hi || "");
      setSpecificationKn(p.specification.kn || "");
      setSpecificationMr(p.specification.mr || "");
      setSpecificationPa(p.specification.pa || "");
      setSpecificationTa(p.specification.ta || "");
    } else {
      const s = String(p.specification || "");
      setSpecificationEn(s);
      setSpecificationHi("");
      setSpecificationKn("");
      setSpecificationMr("");
      setSpecificationPa("");
      setSpecificationTa("");
    }

    // Product Ingredients Map
    if (typeof p.productIngredients === "object" && p.productIngredients !== null) {
      setProductIngredientsEn(Array.isArray(p.productIngredients.en) ? p.productIngredients.en.join(", ") : (p.productIngredients.en || ""));
      setProductIngredientsHi(Array.isArray(p.productIngredients.hi) ? p.productIngredients.hi.join(", ") : (p.productIngredients.hi || ""));
      setProductIngredientsKn(Array.isArray(p.productIngredients.kn) ? p.productIngredients.kn.join(", ") : (p.productIngredients.kn || ""));
      setProductIngredientsMr(Array.isArray(p.productIngredients.mr) ? p.productIngredients.mr.join(", ") : (p.productIngredients.mr || ""));
      setProductIngredientsPa(Array.isArray(p.productIngredients.pa) ? p.productIngredients.pa.join(", ") : (p.productIngredients.pa || ""));
      setProductIngredientsTa(Array.isArray(p.productIngredients.ta) ? p.productIngredients.ta.join(", ") : (p.productIngredients.ta || ""));
    } else {
      const s = String(p.productIngredients || "");
      setProductIngredientsEn(s);
      setProductIngredientsHi("");
      setProductIngredientsKn("");
      setProductIngredientsMr("");
      setProductIngredientsPa("");
      setProductIngredientsTa("");
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
      setInstructionsToUseKn(Array.isArray(p.instructionsToUse.kn) ? p.instructionsToUse.kn.join("\n") : (p.instructionsToUse.kn || ""));
      setInstructionsToUseMr(Array.isArray(p.instructionsToUse.mr) ? p.instructionsToUse.mr.join("\n") : (p.instructionsToUse.mr || ""));
      setInstructionsToUsePa(Array.isArray(p.instructionsToUse.pa) ? p.instructionsToUse.pa.join("\n") : (p.instructionsToUse.pa || ""));
      setInstructionsToUseTa(Array.isArray(p.instructionsToUse.ta) ? p.instructionsToUse.ta.join("\n") : (p.instructionsToUse.ta || ""));
    } else {
      const s = String(p.instructionsToUse || "");
      setInstructionsToUseEn(s);
      setInstructionsToUseHi("");
      setInstructionsToUseKn("");
      setInstructionsToUseMr("");
      setInstructionsToUsePa("");
      setInstructionsToUseTa("");
    }

    // Storage Condition Map
    if (typeof p.storageCondition === "object" && p.storageCondition !== null) {
      setStorageConditionEn(Array.isArray(p.storageCondition.en) ? p.storageCondition.en.join(", ") : (p.storageCondition.en || ""));
      setStorageConditionHi(Array.isArray(p.storageCondition.hi) ? p.storageCondition.hi.join(", ") : (p.storageCondition.hi || ""));
      setStorageConditionKn(Array.isArray(p.storageCondition.kn) ? p.storageCondition.kn.join(", ") : (p.storageCondition.kn || ""));
      setStorageConditionMr(Array.isArray(p.storageCondition.mr) ? p.storageCondition.mr.join(", ") : (p.storageCondition.mr || ""));
      setStorageConditionPa(Array.isArray(p.storageCondition.pa) ? p.storageCondition.pa.join(", ") : (p.storageCondition.pa || ""));
      setStorageConditionTa(Array.isArray(p.storageCondition.ta) ? p.storageCondition.ta.join(", ") : (p.storageCondition.ta || ""));
    } else {
      const s = String(p.storageCondition || "");
      setStorageConditionEn(s);
      setStorageConditionHi("");
      setStorageConditionKn("");
      setStorageConditionMr("");
      setStorageConditionPa("");
      setStorageConditionTa("");
    }

    // Best Before Map
    const bb = p.bestBefore || p.best_before;
    if (typeof bb === "object" && bb !== null) {
      setBestBeforeEn(bb.en || "1 Year");
      setBestBeforeHi(bb.hi || "1 वर्ष");
      setBestBeforeKn(bb.kn || "1 ವರ್ಷ");
      setBestBeforeMr(bb.mr || "१ वर्ष");
      setBestBeforePa(bb.pa || "1 ਸਾਲ");
      setBestBeforeTa(bb.ta || "1 ஆண்டு");
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

    const makeMultiLang = (enVal: string, hiVal: string, knVal: string, mrVal: string, paVal: string, taVal: string, fallback = "") => {
      const e = toStr(enVal) || toStr(hiVal) || fallback;
      return {
        en: e,
        hi: toStr(hiVal) || e,
        kn: toStr(knVal) || e,
        mr: toStr(mrVal) || e,
        pa: toStr(paVal) || e,
        ta: toStr(taVal) || e,
      };
    };

    // EXACT 100% Match for Flutter `ProductListingEntity` Model & Types with all 6 regional languages
    const payload: any = {
      id: toStr(productId) || `PRD-${Date.now()}`,
      
      // Map<String, dynamic> name (en, hi, kn, mr, pa, ta)
      name: makeMultiLang(nameEn, nameHi, nameKn, nameMr, namePa, nameTa, "Product"),

      // Map<String, dynamic> sellerName (en, hi, kn, mr, pa, ta)
      sellerName: makeMultiLang(sellerNameEn, sellerNameHi, sellerNameKn, sellerNameMr, sellerNamePa, sellerNameTa, "Chimertech"),

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

      // Map<String, dynamic> description (en, hi, kn, mr, pa, ta)
      description: makeMultiLang(descriptionEn, descriptionHi, descriptionKn, descriptionMr, descriptionPa, descriptionTa, ""),

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
      weightUnit: makeMultiLang(weightUnitEn, weightUnitHi, weightUnitKn, weightUnitMr, weightUnitPa, weightUnitTa, "g"),

      // Map<String, dynamic> quantityUnit (en, hi, kn, mr, pa, ta)
      quantityUnit: makeMultiLang(quantityUnitEn, quantityUnitHi, quantityUnitKn, quantityUnitMr, quantityUnitPa, quantityUnitTa, "Unit"),

      // Map<String, dynamic>? usage
      usage: toStr(usageEn) || toStr(usageHi) ? {
        en: toStr(usageEn) || toStr(usageHi),
        ...(toStr(usageHi) ? { hi: toStr(usageHi) } : {}),
      } : null,

      // Map<String, dynamic>? storageCondition (en, hi, kn, mr, pa, ta)
      storageCondition: makeMultiLang(storageConditionEn, storageConditionHi, storageConditionKn, storageConditionMr, storageConditionPa, storageConditionTa, "°C to 15°C"),

      // Map<String, dynamic>? specification (en, hi, kn, mr, pa, ta)
      specification: makeMultiLang(specificationEn, specificationHi, specificationKn, specificationMr, specificationPa, specificationTa, ""),

      // Map<String, dynamic>? instructionsToUse (en, hi, kn, mr, pa, ta)
      instructionsToUse: makeMultiLang(instructionsToUseEn, instructionsToUseHi, instructionsToUseKn, instructionsToUseMr, instructionsToUsePa, instructionsToUseTa, ""),

      // Map<String, dynamic>? productIngredients (en, hi, kn, mr, pa, ta)
      productIngredients: makeMultiLang(productIngredientsEn, productIngredientsHi, productIngredientsKn, productIngredientsMr, productIngredientsPa, productIngredientsTa, ""),

      // String categoryId
      categoryId: toStr(categoryId),

      // String subCategoryId
      subCategoryId: toStr(subCategoryId),

      // Map<String, String>? category (en, hi, kn, mr, pa, ta)
      category: makeMultiLang(categoryNameEn, selectedCategoryObj?.name?.hi || categoryNameEn, selectedCategoryObj?.name?.kn || categoryNameEn, selectedCategoryObj?.name?.mr || categoryNameEn, selectedCategoryObj?.name?.pa || categoryNameEn, selectedCategoryObj?.name?.ta || categoryNameEn, "Breeding"),

      // Map<String, String>? subCategory (en, hi, kn, mr, pa, ta)
      subCategory: makeMultiLang(subCategoryNameEn, subCategoryNameEn, subCategoryNameEn, subCategoryNameEn, subCategoryNameEn, subCategoryNameEn, "breeding detection"),

      // String sellerType
      sellerType: toStr(sellerType) || "seller",

      // double gst
      gst: Number(gst) || 5.0,

      // Map<String, dynamic>? bestBefore & best_before (en, hi, kn, mr, pa, ta)
      bestBefore: makeMultiLang(bestBeforeEn, bestBeforeHi, bestBeforeKn, bestBeforeMr, bestBeforePa, bestBeforeTa, "1 Year"),
      best_before: makeMultiLang(bestBeforeEn, bestBeforeHi, bestBeforeKn, bestBeforeMr, bestBeforePa, bestBeforeTa, "1 Year"),

      // bool? cartAddded
      cartAddded: Boolean(cartAddded),

      // bool bestSeller & isBestSeller
      bestSeller: Boolean(bestSeller),
      isBestSeller: Boolean(bestSeller),

      // DeliveryConfig? deliveryConfig (null deletes mapping from Firestore, object creates/updates)
      deliveryConfig: deliveryType === "all" ? null : {
        type: deliveryType,
        states: deliveryStates,
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
              <p className="text-xs text-muted-foreground font-medium">Approved / Active</p>
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
                <div className="p-3 rounded-2xl bg-muted/30 border space-y-2">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Regional Languages (<code>name.hi, kn, mr, pa, ta</code>)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                    <div className="space-y-1">
                      <Label htmlFor="prod-name-hi" className="text-[11px]">Hindi (<code>hi</code>)</Label>
                      <Input
                        id="prod-name-hi"
                        placeholder="e.g. प्रेगकाइन बोवाइन..."
                        value={nameHi}
                        onChange={(e) => setNameHi(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-name-kn" className="text-[11px]">Kannada (<code>kn</code>)</Label>
                      <Input
                        id="prod-name-kn"
                        placeholder="e.g. ಪ್ರೆಗ್‌ಕೈನ್ ಬೋವೈನ್..."
                        value={nameKn}
                        onChange={(e) => setNameKn(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-name-mr" className="text-[11px]">Marathi (<code>mr</code>)</Label>
                      <Input
                        id="prod-name-mr"
                        placeholder="e.g. प्रेगकाईन बोव्हाइन..."
                        value={nameMr}
                        onChange={(e) => setNameMr(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-name-pa" className="text-[11px]">Punjabi (<code>pa</code>)</Label>
                      <Input
                        id="prod-name-pa"
                        placeholder="e.g. ਪ੍ਰੇਗਕਾਈਨ ਬੋਵਾਈਨ..."
                        value={namePa}
                        onChange={(e) => setNamePa(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-name-ta" className="text-[11px]">Tamil (<code>ta</code>)</Label>
                      <Input
                        id="prod-name-ta"
                        placeholder="e.g. பிரெக்கைன் போவின்..."
                        value={nameTa}
                        onChange={(e) => setNameTa(e.target.value)}
                        className="text-xs"
                      />
                    </div>
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
                    Description (<code>description</code>: en, hi, kn, mr, pa, ta)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="prod-desc-en" className="text-[11px]">English (<code>en</code>)</Label>
                      <Textarea
                        id="prod-desc-en"
                        rows={2}
                        placeholder="Advanced, rapid pregnancy detection kit..."
                        value={descriptionEn}
                        onChange={(e) => setDescriptionEn(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-desc-hi" className="text-[11px]">Hindi (<code>hi</code>)</Label>
                      <Textarea
                        id="prod-desc-hi"
                        rows={2}
                        placeholder="गायों के लिए रैपिड प्रेगनेंसी..."
                        value={descriptionHi}
                        onChange={(e) => setDescriptionHi(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-desc-kn" className="text-[11px]">Kannada (<code>kn</code>)</Label>
                      <Textarea
                        id="prod-desc-kn"
                        rows={2}
                        placeholder="ಕನ್ನಡ ವಿವರಣೆ..."
                        value={descriptionKn}
                        onChange={(e) => setDescriptionKn(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-desc-mr" className="text-[11px]">Marathi (<code>mr</code>)</Label>
                      <Textarea
                        id="prod-desc-mr"
                        rows={2}
                        placeholder="मराठी वर्णन..."
                        value={descriptionMr}
                        onChange={(e) => setDescriptionMr(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-desc-pa" className="text-[11px]">Punjabi (<code>pa</code>)</Label>
                      <Textarea
                        id="prod-desc-pa"
                        rows={2}
                        placeholder="ਪੰਜਾਬੀ ਵੇਰਵਾ..."
                        value={descriptionPa}
                        onChange={(e) => setDescriptionPa(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-desc-ta" className="text-[11px]">Tamil (<code>ta</code>)</Label>
                      <Textarea
                        id="prod-desc-ta"
                        rows={2}
                        placeholder="தமிழ் விளக்கம்..."
                        value={descriptionTa}
                        onChange={(e) => setDescriptionTa(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Specification Map (en, hi, kn, mr, pa, ta) */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Specifications (<code>specification</code>: en, hi, kn, mr, pa, ta)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="prod-spec-en" className="text-[11px]">English (<code>en</code>)</Label>
                      <Textarea
                        id="prod-spec-en"
                        rows={2}
                        placeholder="Detects in as early as 28 days..."
                        value={specificationEn}
                        onChange={(e) => setSpecificationEn(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-spec-hi" className="text-[11px]">Hindi (<code>hi</code>)</Label>
                      <Textarea
                        id="prod-spec-hi"
                        rows={2}
                        placeholder="प्रजनन या कृत्रिम गर्भाधान के बाद 28 दिनों में..."
                        value={specificationHi}
                        onChange={(e) => setSpecificationHi(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-spec-kn" className="text-[11px]">Kannada (<code>kn</code>)</Label>
                      <Textarea
                        id="prod-spec-kn"
                        rows={2}
                        placeholder="ಸಂತಾನೋತ್ಪತ್ತಿ ಅಥವಾ ಕೃತಕ ಗರ್ಭಧಾರಣೆಯ ನಂತರ 28 ದಿನಗಳಲ್ಲಿ..."
                        value={specificationKn}
                        onChange={(e) => setSpecificationKn(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-spec-mr" className="text-[11px]">Marathi (<code>mr</code>)</Label>
                      <Textarea
                        id="prod-spec-mr"
                        rows={2}
                        placeholder="प्रजनन किंवा कृत्रिम रेतन नंतर अवघ्या २८ दिवसांत..."
                        value={specificationMr}
                        onChange={(e) => setSpecificationMr(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-spec-pa" className="text-[11px]">Punjabi (<code>pa</code>)</Label>
                      <Textarea
                        id="prod-spec-pa"
                        rows={2}
                        placeholder="ਪ੍ਰਜਨਨ ਜਾਂ ਕ੍ਰਿਤ੍ਰਿਮ ਗਰਭਧਾਰਣ ਤੋਂ 28 ਦਿਨਾਂ ਬਾਅਦ..."
                        value={specificationPa}
                        onChange={(e) => setSpecificationPa(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-spec-ta" className="text-[11px]">Tamil (<code>ta</code>)</Label>
                      <Textarea
                        id="prod-spec-ta"
                        rows={2}
                        placeholder="இனப்பெருக்கம் அல்லது செயற்கை கருத்தரிப்பிற்குப் பின் 28 நாட்களிலேயே..."
                        value={specificationTa}
                        onChange={(e) => setSpecificationTa(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Product Ingredients Map (en, hi, kn, mr, pa, ta) */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Ingredients (<code>productIngredients</code>: en, hi, kn, mr, pa, ta)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <Label htmlFor="prod-ing-en" className="text-[11px]">English</Label>
                      <Input
                        id="prod-ing-en"
                        placeholder="Vaccutainer, 18G Needle, Syringe..."
                        value={productIngredientsEn}
                        onChange={(e) => setProductIngredientsEn(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-ing-hi" className="text-[11px]">Hindi</Label>
                      <Input
                        id="prod-ing-hi"
                        placeholder="वै큠टेनर, 18G सुई, सिरिंज..."
                        value={productIngredientsHi}
                        onChange={(e) => setProductIngredientsHi(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-ing-kn" className="text-[11px]">Kannada</Label>
                      <Input
                        id="prod-ing-kn"
                        placeholder="ವ್ಯಾಕ್ಯೂಟೈನರ್, 18G ಸೂಜಿ..."
                        value={productIngredientsKn}
                        onChange={(e) => setProductIngredientsKn(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-ing-mr" className="text-[11px]">Marathi</Label>
                      <Input
                        id="prod-ing-mr"
                        placeholder="व्हॅक्यूटेनर, १८G सुई..."
                        value={productIngredientsMr}
                        onChange={(e) => setProductIngredientsMr(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-ing-pa" className="text-[11px]">Punjabi</Label>
                      <Input
                        id="prod-ing-pa"
                        placeholder="ਵੈਕਿਊਟੇਨਰ, 18G ਸੂਈ..."
                        value={productIngredientsPa}
                        onChange={(e) => setProductIngredientsPa(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-ing-ta" className="text-[11px]">Tamil</Label>
                      <Input
                        id="prod-ing-ta"
                        placeholder="வாக்குடெய்னர், 18G ஊசி..."
                        value={productIngredientsTa}
                        onChange={(e) => setProductIngredientsTa(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Instructions to Use (en, hi, kn, mr, pa, ta) */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Instructions To Use (<code>instructionsToUse</code>: en, hi, kn, mr, pa, ta)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="prod-inst-en" className="text-[11px]">English (<code>en</code>)</Label>
                      <Textarea
                        id="prod-inst-en"
                        rows={2}
                        placeholder="Step - 1: Add one drop of Whole Blood..."
                        value={instructionsToUseEn}
                        onChange={(e) => setInstructionsToUseEn(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-inst-hi" className="text-[11px]">Hindi (<code>hi</code>)</Label>
                      <Textarea
                        id="prod-inst-hi"
                        rows={2}
                        placeholder="वैक्यूम जाँचें, प्री-हाइजीन के बाद..."
                        value={instructionsToUseHi}
                        onChange={(e) => setInstructionsToUseHi(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-inst-kn" className="text-[11px]">Kannada (<code>kn</code>)</Label>
                      <Textarea
                        id="prod-inst-kn"
                        rows={2}
                        placeholder="ಹಂತ - 1: ರಕ್ತದ ಹನಿಯನ್ನು ಸೇರಿಸಿ..."
                        value={instructionsToUseKn}
                        onChange={(e) => setInstructionsToUseKn(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-inst-mr" className="text-[11px]">Marathi (<code>mr</code>)</Label>
                      <Textarea
                        id="prod-inst-mr"
                        rows={2}
                        placeholder="पायरी - १: नमुना रक्ताचा थेंब घाला..."
                        value={instructionsToUseMr}
                        onChange={(e) => setInstructionsToUseMr(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-inst-pa" className="text-[11px]">Punjabi (<code>pa</code>)</Label>
                      <Textarea
                        id="prod-inst-pa"
                        rows={2}
                        placeholder="ਕਦਮ - 1: ਖੂਨ ਦੀ ਇੱਕ ਬੂੰਦ ਪਾਓ..."
                        value={instructionsToUsePa}
                        onChange={(e) => setInstructionsToUsePa(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prod-inst-ta" className="text-[11px]">Tamil (<code>ta</code>)</Label>
                      <Textarea
                        id="prod-inst-ta"
                        rows={2}
                        placeholder="படி - 1: இரத்த மாதிரியை சேர்க்கவும்..."
                        value={instructionsToUseTa}
                        onChange={(e) => setInstructionsToUseTa(e.target.value)}
                        className="text-xs"
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
    </div>
  );
}
