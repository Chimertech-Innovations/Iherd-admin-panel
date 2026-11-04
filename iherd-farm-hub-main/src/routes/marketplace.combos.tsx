import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Boxes,
  Plus,
  Search,
  IndianRupee,
  Weight,
  Layers,
  Sparkles,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Power,
  Upload,
  Image as ImageIcon,
  ExternalLink,
  Languages,
  FileText,
  Package,
  ShieldCheck,
  Percent,
  AlertCircle,
  X,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { useCombos, type ComboProduct } from "@/hooks/useFirebaseData";
import { getLocalizedText, formatImageUrl } from "@/lib/utils";
import { getApiBaseUrlSync } from "@/lib/apiClient";
import {
  PRODUCT_CATEGORIES,
  getSubcategoriesForCategory,
  getCategoryName,
  getSubcategoryName,
} from "@/lib/categories";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export function convertToDirectImageUrl(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  // Convert Google Drive view links to direct lh3 CDN image streams for Flutter & Web
  const driveMatch =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}=s800`;
  }
  return trimmed;
}

export const Route = createFileRoute("/marketplace/combos")({
  head: () => ({ meta: [{ title: "Combo Products — iHerd Admin" }] }),
  component: CombosPage,
});

type LangCode = "en" | "hi" | "kn" | "mr" | "pa" | "ta";

const LANG_CONFIG: { code: LangCode; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "hi", label: "Hindi (हिंदी)", flag: "🇮🇳" },
  { code: "kn", label: "Kannada (ಕನ್ನಡ)", flag: "🇮🇳" },
  { code: "mr", label: "Marathi (मराठी)", flag: "🇮🇳" },
  { code: "pa", label: "Punjabi (ਪੰਜਾਬੀ)", flag: "🇮🇳" },
  { code: "ta", label: "Tamil (தமிழ்)", flag: "🇮🇳" },
];

function CombosPage() {
  const { combos, isLoading, refetch, saveCombo, deleteCombo, toggleComboActive } = useCombos();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Add / Edit Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "languages" | "instructions" | "media">("basic");
  const [editingCombo, setEditingCombo] = useState<ComboProduct | null>(null);

  // Success Popup Modal
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Active language tab in Multi-language editor
  const [currentLang, setCurrentLang] = useState<LangCode>("en");

  // Form Fields - Basic & Pricing
  const [id, setId] = useState("");
  const [categoryId, setCategoryId] = useState("cat_disease_management");
  const [subCategoryId, setSubCategoryId] = useState("subcat_disease_detection");
  const [price, setPrice] = useState("725");
  const [mrp, setMrp] = useState("1400");
  const [gst, setGst] = useState("5");
  const [quantity, setQuantity] = useState("500");
  const [quantityUnit, setQuantityUnit] = useState("Ml");
  const [weight, setWeight] = useState("2500");
  const [weightUnit, setWeightUnit] = useState("g");
  const [isActive, setIsActive] = useState(true);
  const [bestSeller, setBestSeller] = useState(false);

  // Form Fields - Multi-Language Names
  const [nameEn, setNameEn] = useState("");
  const [nameHi, setNameHi] = useState("");
  const [nameKn, setNameKn] = useState("");
  const [nameMr, setNameMr] = useState("");
  const [namePa, setNamePa] = useState("");
  const [nameTa, setNameTa] = useState("");

  // Form Fields - Multi-Language Descriptions
  const [descEn, setDescEn] = useState("");
  const [descHi, setDescHi] = useState("");
  const [descKn, setDescKn] = useState("");
  const [descMr, setDescMr] = useState("");
  const [descPa, setDescPa] = useState("");
  const [descTa, setDescTa] = useState("");

  // Form Fields - Multi-Language Best Before
  const [bbEn, setBbEn] = useState("2 Years");
  const [bbHi, setBbHi] = useState("2 वर्ष");
  const [bbKn, setBbKn] = useState("2 ವರ್ಷಗಳು");
  const [bbMr, setBbMr] = useState("2 वर्षे");
  const [bbPa, setBbPa] = useState("2 ਸਾਲ");
  const [bbTa, setBbTa] = useState("2 ஆண்டுகள்");

  // Form Fields - Multi-Language Specifications
  const [specEn, setSpecEn] = useState("");
  const [specHi, setSpecHi] = useState("");
  const [specKn, setSpecKn] = useState("");
  const [specMr, setSpecMr] = useState("");
  const [specPa, setSpecPa] = useState("");
  const [specTa, setSpecTa] = useState("");

  // Active language tab in Instructions & Ingredients editor
  const [instructionLang, setInstructionLang] = useState<LangCode>("en");

  // Multi-Language Instructions (en, hi, kn, mr, pa, ta)
  const [instructionsEn, setInstructionsEn] = useState("");
  const [instructionsHi, setInstructionsHi] = useState("");
  const [instructionsKn, setInstructionsKn] = useState("");
  const [instructionsMr, setInstructionsMr] = useState("");
  const [instructionsPa, setInstructionsPa] = useState("");
  const [instructionsTa, setInstructionsTa] = useState("");

  // Multi-Language Ingredients (en, hi, kn, mr, pa, ta)
  const [ingredientsEn, setIngredientsEn] = useState("");
  const [ingredientsHi, setIngredientsHi] = useState("");
  const [ingredientsKn, setIngredientsKn] = useState("");
  const [ingredientsMr, setIngredientsMr] = useState("");
  const [ingredientsPa, setIngredientsPa] = useState("");
  const [ingredientsTa, setIngredientsTa] = useState("");

  // Multi-Language Storage Condition (en, hi, kn, mr, pa, ta)
  const [storageEn, setStorageEn] = useState("Room Temperature [25°C]");
  const [storageHi, setStorageHi] = useState("कमरे का तापमान [25°C]");
  const [storageKn, setStorageKn] = useState("ಕೊಠಡಿ ತಾಪಮಾನ [25°C]");
  const [storageMr, setStorageMr] = useState("खोलीचे तापमान [25°C]");
  const [storagePa, setStoragePa] = useState("ਕਮਰੇ ਦਾ ਤਾਪਮਾਨ [25°C]");
  const [storageTa, setStorageTa] = useState("அறை வெப்பநிலை [25°C]");

  // Form Fields - Media & Seller
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [extraImagesText, setExtraImagesText] = useState("");
  const [sellerName, setSellerName] = useState("Chimertech");
  const [sellerType, setSellerType] = useState("seller");
  const [sellerLogo, setSellerLogo] = useState("https://drive.google.com/file/d/1x72e_nlxXIzwHtgzvXcGFReKwgOBAIP4/view?usp=sharing");

  // Quick Price Only Edit Modal State
  const [quickPriceOpen, setQuickPriceOpen] = useState(false);
  const [quickCombo, setQuickCombo] = useState<ComboProduct | null>(null);
  const [quickPrice, setQuickPrice] = useState("");
  const [quickMrp, setQuickMrp] = useState("");
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);

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

  const resetForm = () => {
    setFieldErrors({});
    setId("");
    setCategoryId("cat_disease_management");
    setSubCategoryId("subcat_disease_detection");
    setPrice("725");
    setMrp("1400");
    setGst("5");
    setQuantity("500");
    setQuantityUnit("Ml");
    setWeight("2500");
    setWeightUnit("g");
    setIsActive(true);
    setBestSeller(false);

    setNameEn("");
    setNameHi("");
    setNameKn("");
    setNameMr("");
    setNamePa("");
    setNameTa("");

    setDescEn("");
    setDescHi("");
    setDescKn("");
    setDescMr("");
    setDescPa("");
    setDescTa("");

    setBbEn("2 Years");
    setBbHi("2 वर्ष");
    setBbKn("2 ವರ್ಷಗಳು");
    setBbMr("2 वर्षे");
    setBbPa("2 ਸਾਲ");
    setBbTa("2 ஆண்டுகள்");

    setSpecEn("");
    setSpecHi("");
    setSpecKn("");
    setSpecMr("");
    setSpecPa("");
    setSpecTa("");

    setInstructionsEn("");
    setInstructionsHi("");
    setInstructionsKn("");
    setInstructionsMr("");
    setInstructionsPa("");
    setInstructionsTa("");

    setIngredientsEn("");
    setIngredientsHi("");
    setIngredientsKn("");
    setIngredientsMr("");
    setIngredientsPa("");
    setIngredientsTa("");

    setStorageEn("Room Temperature [25°C]");
    setStorageHi("कमरे का तापमान [25°C]");
    setStorageKn("ಕೊಠಡಿ ತಾಪಮಾನ [25°C]");
    setStorageMr("खोलीचे तापमान [25°C]");
    setStoragePa("ਕਮਰੇ ਦਾ ਤਾਪਮਾਨ [25°C]");
    setStorageTa("அறை வெப்பநிலை [25°C]");
    setInstructionLang("en");

    setThumbnailUrl("");
    setExtraImagesText("");
    setSellerName("Chimertech");
    setSellerType("seller");
    setSellerLogo("https://drive.google.com/file/d/1x72e_nlxXIzwHtgzvXcGFReKwgOBAIP4/view?usp=sharing");

    setActiveTab("basic");
    setCurrentLang("en");
    setEditingCombo(null);
  };

  const openCreateDialog = () => {
    resetForm();
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setId(`COMBO--${dateStr}-A${randomSuffix}`);
    setDialogOpen(true);
  };

  const openEditDialog = (c: ComboProduct) => {
    setFieldErrors({});
    setEditingCombo(c);
    setId(c.id);
    setActiveTab("basic");
    setCurrentLang("en");

    // Category & Subcategory
    setCategoryId(c.categoryId || "cat_disease_management");
    setSubCategoryId(c.subCategoryId || "subcat_disease_detection");

    // Numbers & Pricing
    setPrice(String(c.price || 0));
    setMrp(String(c.mrp || c.price || 0));
    setGst(String(c.gst !== undefined ? c.gst : 5));
    setQuantity(String(c.quantity || 1));
    setQuantityUnit(typeof c.quantityUnit === "object" ? c.quantityUnit.en || "Ml" : String(c.quantityUnit || "Ml"));
    setWeight(String(c.weight || 0));
    setWeightUnit(typeof c.weightUnit === "object" ? c.weightUnit.en || "g" : String(c.weightUnit || "g"));
    setIsActive(c.isActive !== false);
    setBestSeller(Boolean(c.bestSeller));

    // Multi-Language Names (fallback to base English name so no language is blank)
    if (typeof c.name === "object" && c.name !== null) {
      const baseN = c.name.en || Object.values(c.name)[0] || "";
      setNameEn(baseN);
      setNameHi(c.name.hi || baseN);
      setNameKn(c.name.kn || baseN);
      setNameMr(c.name.mr || baseN);
      setNamePa(c.name.pa || baseN);
      setNameTa(c.name.ta || baseN);
    } else {
      const n = String(c.name || "");
      setNameEn(n);
      setNameHi(n);
      setNameKn(n);
      setNameMr(n);
      setNamePa(n);
      setNameTa(n);
    }

    // Multi-Language Descriptions (fallback to English so no language is blank)
    if (typeof c.description === "object" && c.description !== null) {
      const baseD = c.description.en || Object.values(c.description)[0] || "";
      setDescEn(baseD);
      setDescHi(c.description.hi || baseD);
      setDescKn(c.description.kn || baseD);
      setDescMr(c.description.mr || baseD);
      setDescPa(c.description.pa || baseD);
      setDescTa(c.description.ta || baseD);
    } else {
      const d = String(c.description || "");
      setDescEn(d);
      setDescHi(d);
      setDescKn(d);
      setDescMr(d);
      setDescPa(d);
      setDescTa(d);
    }

    // Multi-Language Best Before
    if (typeof c.best_before === "object" && c.best_before !== null) {
      const baseB = c.best_before.en || "2 Years";
      setBbEn(baseB);
      setBbHi(c.best_before.hi || baseB);
      setBbKn(c.best_before.kn || baseB);
      setBbMr(c.best_before.mr || baseB);
      setBbPa(c.best_before.pa || baseB);
      setBbTa(c.best_before.ta || baseB);
    } else {
      const b = String(c.best_before || "2 Years");
      setBbEn(b);
      setBbHi(b);
      setBbKn(b);
      setBbMr(b);
      setBbPa(b);
      setBbTa(b);
    }

    // Multi-Language Specifications
    const rawSpec: any = c.specification;
    const specMap =
      rawSpec && typeof rawSpec === "object" && rawSpec.specification && typeof rawSpec.specification === "object"
        ? rawSpec.specification
        : typeof rawSpec === "object" && rawSpec !== null
        ? rawSpec
        : null;

    if (specMap) {
      const baseS = specMap.en || Object.values(specMap)[0] || "";
      setSpecEn(baseS);
      setSpecHi(specMap.hi || baseS);
      setSpecKn(specMap.kn || baseS);
      setSpecMr(specMap.mr || baseS);
      setSpecPa(specMap.pa || baseS);
      setSpecTa(specMap.ta || baseS);
    } else {
      const s = String(c.specification || "");
      setSpecEn(s);
      setSpecHi(s);
      setSpecKn(s);
      setSpecMr(s);
      setSpecPa(s);
      setSpecTa(s);
    }

    // Helper to safely extract multi-language string/array
    const extractArray = (field: any, lang: string): string => {
      if (!field) return "";
      if (typeof field === "object" && !Array.isArray(field)) {
        const val = field[lang] || (lang === "en" ? field.en : "");
        return Array.isArray(val) ? val.join("\n") : String(val || "");
      }
      if (Array.isArray(field) && lang === "en") {
        return field.join("\n");
      }
      if (typeof field === "string" && lang === "en") {
        return field;
      }
      return "";
    };

    const extractStorage = (field: any, lang: string, def: string): string => {
      if (!field) return def;
      if (typeof field === "object" && !Array.isArray(field)) {
        const val = field[lang] || (lang === "en" ? field.en : "");
        return Array.isArray(val) ? val.join("\n") : String(val || def);
      }
      if (Array.isArray(field) && lang === "en") return field.join("\n");
      if (typeof field === "string" && lang === "en") return field;
      return def;
    };

    // Multi-Language Instructions (defaults to English if regional language is empty)
    const instEn = extractArray(c.instructionsToUse, "en");
    setInstructionsEn(instEn);
    setInstructionsHi(extractArray(c.instructionsToUse, "hi") || instEn);
    setInstructionsKn(extractArray(c.instructionsToUse, "kn") || instEn);
    setInstructionsMr(extractArray(c.instructionsToUse, "mr") || instEn);
    setInstructionsPa(extractArray(c.instructionsToUse, "pa") || instEn);
    setInstructionsTa(extractArray(c.instructionsToUse, "ta") || instEn);

    // Multi-Language Ingredients (defaults to English if regional language is empty)
    const ingEn = extractArray(c.productIngredients, "en");
    setIngredientsEn(ingEn);
    setIngredientsHi(extractArray(c.productIngredients, "hi") || ingEn);
    setIngredientsKn(extractArray(c.productIngredients, "kn") || ingEn);
    setIngredientsMr(extractArray(c.productIngredients, "mr") || ingEn);
    setIngredientsPa(extractArray(c.productIngredients, "pa") || ingEn);
    setIngredientsTa(extractArray(c.productIngredients, "ta") || ingEn);

    // Multi-Language Storage Condition
    const storeEn = extractStorage(c.storageCondition, "en", "Room Temperature [25°C]");
    setStorageEn(storeEn);
    setStorageHi(extractStorage(c.storageCondition, "hi", storeEn));
    setStorageKn(extractStorage(c.storageCondition, "kn", storeEn));
    setStorageMr(extractStorage(c.storageCondition, "mr", storeEn));
    setStoragePa(extractStorage(c.storageCondition, "pa", storeEn));
    setStorageTa(extractStorage(c.storageCondition, "ta", storeEn));
    setInstructionLang("en");

    // Media
    const thumb = c.thumbnailUrl || (c.imageUrls && c.imageUrls[0]) || "";
    setThumbnailUrl(thumb);
    const extra = (c.imageUrls || []).filter((u) => u && u !== thumb).join("\n");
    setExtraImagesText(extra);

    // Seller
    if (typeof c.sellerName === "object" && c.sellerName !== null) {
      setSellerName(c.sellerName.en || Object.values(c.sellerName)[0] || "Chimertech");
    } else {
      setSellerName(String(c.sellerName || "Chimertech"));
    }
    setSellerType(c.sellerType || "seller");
    setSellerLogo(c.sellerLogo || "");

    setDialogOpen(true);
  };

  // Quick Price Dialog Trigger
  const openQuickPriceDialog = (c: ComboProduct) => {
    setQuickCombo(c);
    setQuickPrice(String(c.price || 0));
    setQuickMrp(String(c.mrp || c.price || 0));
    setQuickPriceOpen(true);
  };

  // Quick Price Save Handler (Updates ONLY price & mrp, preserves 100% of all other data)
  const handleSaveQuickPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCombo) return;
    const pVal = Number(quickPrice);
    const mVal = Number(quickMrp) || pVal;
    if (isNaN(pVal) || pVal < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setIsUpdatingPrice(true);
    try {
      await saveCombo.mutateAsync({
        ...quickCombo,
        price: pVal,
        mrp: mVal,
        updatedAt: new Date().toISOString(),
      });
      setQuickPriceOpen(false);
      toast.success(
        `Price for "${getLocalizedText(quickCombo.name)}" updated to ₹${pVal.toLocaleString()}! Balance data preserved.`
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to update price");
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  // Image File Upload handler - Uploads to Firebase Storage folder 'combos/images' via backend service account
  // Supports single or multiple file uploads simultaneously
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    const newUrls: string[] = [];

    try {
      const base = getApiBaseUrlSync();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;

        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const base64 = await base64Promise;

        const res = await fetch(`${base}/api/admin/upload-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64,
            filename: file.name,
            contentType: file.type || "image/jpeg",
            folder: "combos/images",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.url) {
            newUrls.push(data.url);
            successCount++;
          }
        }
      }

      if (newUrls.length > 0) {
        if (!thumbnailUrl.trim()) {
          setThumbnailUrl(newUrls[0]);
          if (newUrls.length > 1) {
            const extra = newUrls.slice(1).join("\n");
            setExtraImagesText((prev) => (prev ? `${prev}\n${extra}` : extra));
          }
        } else {
          const extra = newUrls.join("\n");
          setExtraImagesText((prev) => (prev ? `${prev}\n${extra}` : extra));
        }
        clearFieldError("images");
        toast.success(`Successfully uploaded ${successCount} combo image(s) to Firebase Storage!`);
      } else {
        toast.error("Failed to upload image(s). Please verify the server connection.");
      }
    } catch (err: any) {
      console.error("Storage upload failed:", err);
      toast.error(`Image upload failed: ${err.message || "Network error"}`);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleCopyEnglishToAllLanguages = () => {
    if (!nameEn.trim() && !descEn.trim() && !specEn.trim() && !instructionsEn.trim() && !ingredientsEn.trim()) {
      toast.error("Please fill in English fields first before copying to other languages.");
      return;
    }
    if (nameEn.trim()) {
      if (!nameHi) setNameHi(nameEn);
      if (!nameKn) setNameKn(nameEn);
      if (!nameMr) setNameMr(nameEn);
      if (!namePa) setNamePa(nameEn);
      if (!nameTa) setNameTa(nameEn);
    }
    if (descEn.trim()) {
      if (!descHi) setDescHi(descEn);
      if (!descKn) setDescKn(descEn);
      if (!descMr) setDescMr(descEn);
      if (!descPa) setDescPa(descEn);
      if (!descTa) setDescTa(descEn);
    }
    if (specEn.trim()) {
      if (!specHi) setSpecHi(specEn);
      if (!specKn) setSpecKn(specEn);
      if (!specMr) setSpecMr(specEn);
      if (!specPa) setSpecPa(specEn);
      if (!specTa) setSpecTa(specEn);
    }
    if (instructionsEn.trim()) {
      if (!instructionsHi) setInstructionsHi(instructionsEn);
      if (!instructionsKn) setInstructionsKn(instructionsEn);
      if (!instructionsMr) setInstructionsMr(instructionsEn);
      if (!instructionsPa) setInstructionsPa(instructionsEn);
      if (!instructionsTa) setInstructionsTa(instructionsEn);
    }
    if (ingredientsEn.trim()) {
      if (!ingredientsHi) setIngredientsHi(ingredientsEn);
      if (!ingredientsKn) setIngredientsKn(ingredientsEn);
      if (!ingredientsMr) setIngredientsMr(ingredientsEn);
      if (!ingredientsPa) setIngredientsPa(ingredientsEn);
      if (!ingredientsTa) setIngredientsTa(ingredientsEn);
    }
    if (bbEn.trim()) {
      if (!bbHi) setBbHi(bbEn);
      if (!bbKn) setBbKn(bbEn);
      if (!bbMr) setBbMr(bbEn);
      if (!bbPa) setBbPa(bbEn);
      if (!bbTa) setBbTa(bbEn);
    }
    setFieldErrors({});
    toast.success("English content copied to all regional languages (Hindi, Kannada, Marathi, Punjabi, Tamil)!");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Strict Validation - Check all basic and multi-language fields
    setFieldErrors({});

    // Validate English Combo Name (Primary; regional languages auto-populate if left blank)
    if (!nameEn?.trim()) {
      setFieldErrors({ name_en: true, name: true });
      setActiveTab("languages");
      setCurrentLang("en");
      toast.error("Required field missing: Combo Product Name (English). Please enter a name.");
      return;
    }

    const numPrice = Number(price);
    if (!price || isNaN(numPrice) || numPrice <= 0) {
      setFieldErrors({ price: true });
      setActiveTab("basic");
      toast.error("Required field missing: Selling Price. Please enter a valid price greater than ₹0.");
      return;
    }

    const numMrp = Number(mrp);
    if (!mrp || isNaN(numMrp) || numMrp <= 0) {
      setFieldErrors({ mrp: true });
      setActiveTab("basic");
      toast.error("Required field missing: MRP Price. Please enter a valid MRP greater than ₹0.");
      return;
    }

    const numWeight = Number(weight);
    if (!weight || isNaN(numWeight) || numWeight <= 0) {
      setFieldErrors({ weight: true });
      setActiveTab("basic");
      toast.error("Required field missing: Product Weight. Please enter a valid weight in grams.");
      return;
    }

    if (!categoryId) {
      setFieldErrors({ categoryId: true });
      setActiveTab("basic");
      toast.error("Required field missing: Product Category. Please select a category from the dropdown.");
      return;
    }

    if (!descEn?.trim()) {
      setFieldErrors({ desc_en: true, description: true });
      setActiveTab("languages");
      setCurrentLang("en");
      toast.error("Required field missing: Combo Description (English).");
      return;
    }

    const rawThumb = thumbnailUrl.trim();
    const rawExtras = extraImagesText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const allImages = Array.from(new Set([rawThumb, ...rawExtras])).filter(Boolean);
    if (allImages.length === 0) {
      setFieldErrors({ images: true });
      setActiveTab("media");
      toast.error("Required field missing: Product Image. Please upload or provide at least one image.");
      return;
    }

    // Convert any Google Drive links into direct lh3 CDN image streams for Flutter & Web
    const directThumb = convertToDirectImageUrl(rawThumb);
    const directImages = allImages.map(convertToDirectImageUrl).filter(Boolean);

    // 2. Build Multi-Language Maps
    const baseTitle = nameEn.trim();
    const nameMap: Record<string, string> = {
      en: baseTitle,
      hi: nameHi.trim() || baseTitle,
      kn: nameKn.trim() || baseTitle,
      mr: nameMr.trim() || baseTitle,
      pa: namePa.trim() || baseTitle,
      ta: nameTa.trim() || baseTitle,
      id: baseTitle,
    };

    const baseDesc = descEn.trim();
    const descMap: Record<string, string> = {
      en: baseDesc,
      hi: descHi.trim() || baseDesc,
      kn: descKn.trim() || baseDesc,
      mr: descMr.trim() || baseDesc,
      pa: descPa.trim() || baseDesc,
      ta: descTa.trim() || baseDesc,
      id: baseDesc,
    };

    const fallbackBb = bbEn.trim() || "2 Years";
    const bestBeforeMap: Record<string, string> = {
      en: fallbackBb,
      hi: bbHi.trim() || fallbackBb,
      kn: bbKn.trim() || fallbackBb,
      mr: bbMr.trim() || fallbackBb,
      pa: bbPa.trim() || fallbackBb,
      ta: bbTa.trim() || fallbackBb,
    };

    const qUnit = quantityUnit.trim() || "Ml";
    const quantityUnitMap: Record<string, string> = {
      en: qUnit,
      hi: qUnit === "Ml" ? "मि.ली" : qUnit === "g" ? "ग्राम" : qUnit,
      kn: qUnit === "Ml" ? "ಮಿ.ಲೀ" : qUnit,
      mr: qUnit === "Ml" ? "मिली" : qUnit,
      pa: qUnit === "Ml" ? "ਮਿ.ਲੀ" : qUnit,
      ta: qUnit === "Ml" ? "மி.லி" : qUnit,
      id: qUnit,
    };

    const wUnit = weightUnit.trim() || "g";
    const weightUnitMap: Record<string, string> = {
      en: wUnit,
      hi: wUnit === "g" ? "ग्राम" : wUnit === "kg" ? "किग्रा" : wUnit,
      kn: wUnit === "g" ? "ಗ್ರಾಂ" : wUnit,
      mr: wUnit === "g" ? "ग्रॅम" : wUnit,
      pa: wUnit === "g" ? "ਗ੍ਰਾਮ" : wUnit,
      ta: wUnit === "g" ? "கிராம்" : wUnit,
      id: wUnit,
    };

    const sName = sellerName.trim() || "Chimertech";
    const sellerNameMap: Record<string, string> = {
      en: sName,
      hi: sName,
      kn: sName,
      mr: sName,
      pa: sName,
      ta: sName,
      id: sName,
    };

    // 3. Build Multi-Language Array Maps for Instructions, Ingredients, and Storage
    const toLines = (t: string) =>
      t
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

    const fallbackInst = toLines(instructionsEn).length > 0 ? toLines(instructionsEn) : ["Use as directed by veterinarian."];
    const instructionsMap: Record<string, string[]> = {
      en: toLines(instructionsEn).length > 0 ? toLines(instructionsEn) : fallbackInst,
      hi: toLines(instructionsHi).length > 0 ? toLines(instructionsHi) : fallbackInst,
      kn: toLines(instructionsKn).length > 0 ? toLines(instructionsKn) : fallbackInst,
      mr: toLines(instructionsMr).length > 0 ? toLines(instructionsMr) : fallbackInst,
      pa: toLines(instructionsPa).length > 0 ? toLines(instructionsPa) : fallbackInst,
      ta: toLines(instructionsTa).length > 0 ? toLines(instructionsTa) : fallbackInst,
    };

    const fallbackIng = toLines(ingredientsEn).length > 0 ? toLines(ingredientsEn) : ["Not Applicable"];
    const ingredientsMap: Record<string, string[]> = {
      en: toLines(ingredientsEn).length > 0 ? toLines(ingredientsEn) : fallbackIng,
      hi: toLines(ingredientsHi).length > 0 ? toLines(ingredientsHi) : fallbackIng,
      kn: toLines(ingredientsKn).length > 0 ? toLines(ingredientsKn) : fallbackIng,
      mr: toLines(ingredientsMr).length > 0 ? toLines(ingredientsMr) : fallbackIng,
      pa: toLines(ingredientsPa).length > 0 ? toLines(ingredientsPa) : fallbackIng,
      ta: toLines(ingredientsTa).length > 0 ? toLines(ingredientsTa) : fallbackIng,
      id: fallbackIng,
    };

    const fallbackStorage = storageEn.trim() || "Room Temperature [25°C]";
    const storageMap: Record<string, string[]> = {
      en: [storageEn.trim() || fallbackStorage],
      hi: [storageHi.trim() || fallbackStorage],
      kn: [storageKn.trim() || fallbackStorage],
      mr: [storageMr.trim() || fallbackStorage],
      pa: [storagePa.trim() || fallbackStorage],
      ta: [storageTa.trim() || fallbackStorage],
    };

    // 4. Build Nested Multi-Language Specification Map
    const fallbackSpec = specEn.trim() || baseTitle;
    const specificationMap = {
      specification: {
        en: fallbackSpec,
        hi: specHi.trim() || fallbackSpec,
        kn: specKn.trim() || fallbackSpec,
        mr: specMr.trim() || fallbackSpec,
        pa: specPa.trim() || fallbackSpec,
        ta: specTa.trim() || fallbackSpec,
      },
    };

    // 5. Construct Exact Firestore Document Structure (COMBO--03-26-A001)
    // Merges with existingCombo so balance data is 100% preserved
    const payload: Partial<ComboProduct> = {
      ...(editingCombo || {}),
      id: id.trim() || editingCombo?.id || `COMBO--${Date.now()}`,
      name: nameMap,
      description: descMap,
      best_before: bestBeforeMap,
      price: Number(price) || 0,
      mrp: Number(mrp) || Number(price) || 0,
      gst: Number(gst) !== undefined && !isNaN(Number(gst)) ? Number(gst) : (editingCombo?.gst ?? 5),
      quantity: Number(quantity) || 1,
      quantityUnit: quantityUnitMap,
      weight: Number(weight) || 0,
      weightUnit: weightUnitMap,
      categoryId,
      subCategoryId,
      thumbnailUrl: directThumb,
      imageUrls: directImages.length > 0 ? directImages : directThumb ? [directThumb] : (editingCombo?.imageUrls || []),
      sellerName: sellerNameMap,
      sellerType: sellerType.trim() || editingCombo?.sellerType || "seller",
      sellerLogo: sellerLogo.trim() || editingCombo?.sellerLogo || "",
      specification: specificationMap,
      instructionsToUse: instructionsMap,
      productIngredients: ingredientsMap,
      storageCondition: storageMap,
      isActive,
      bestSeller,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveCombo.mutateAsync(payload);
      setDialogOpen(false);
      setSuccessMessage(
        editingCombo
          ? `Combo Product "${baseTitle}" updated successfully!`
          : `New Combo Product "${baseTitle}" created and published successfully!`
      );
      setSuccessModalOpen(true);
      toast.success(editingCombo ? "Updated successfully!" : "New combo bundle created successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save combo product");
    }
  };

  const handleToggle = async (c: ComboProduct) => {
    try {
      await toggleComboActive.mutateAsync({ id: c.id, isActive: !c.isActive });
      toast.success("Combo visibility updated successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to toggle status");
    }
  };

  const handleDelete = async (c: ComboProduct) => {
    if (!confirm(`Are you sure you want to delete combo "${getLocalizedText(c.name)}"?`)) return;
    try {
      await deleteCombo.mutateAsync(c.id);
      toast.success("Combo product deleted successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete combo");
    }
  };

  // Filtered Combos
  const filtered = useMemo(() => {
    return combos.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const name = getLocalizedText(c.name).toLowerCase();
      const cid = (c.id || "").toLowerCase();
      return !q || name.includes(q) || cid.includes(q);
    });
  }, [combos, searchQuery]);

  const bestSellerCount = combos.filter((c) => c.bestSeller).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Combo Products Management"
        description="Add, edit, and publish combo package bundles stored in /product_marketplace/main/combos."
        action={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="gap-2 rounded-xl"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={openCreateDialog}
              className="gap-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-xs"
            >
              <Plus className="h-4 w-4" /> Add New Combo
            </Button>
          </div>
        }
      />

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 rounded-2xl border bg-card/50 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 grid place-items-center shrink-0">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Total Combos</div>
            <div className="text-xl font-bold text-foreground">{combos.length} Bundles</div>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border bg-card/50 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Published Bundles</div>
            <div className="text-xl font-bold text-foreground">{combos.length} Ready</div>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border bg-card/50 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Featured Best Sellers</div>
            <div className="text-xl font-bold text-foreground">{bestSellerCount} Featured</div>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border bg-card/50 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 grid place-items-center shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Firestore Root</div>
            <div className="text-xs font-mono font-bold text-foreground truncate max-w-[170px]">
              main/combos
            </div>
          </div>
        </Card>
      </div>

      {/* Search Bar with Quick Add Button */}
      <Card className="p-4 rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search combos by title or ID (e.g. Anti Kick Bar, Mineral Block)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl text-xs"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              onClick={openCreateDialog}
              className="rounded-xl text-xs h-9 font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> + Add New Combo
            </Button>
          </div>
        </div>
      </Card>

      {/* Combos Table */}
      <Card className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 text-[11px] font-semibold text-muted-foreground">
              <TableHead className="w-16">Image</TableHead>
              <TableHead className="min-w-[220px]">Combo Bundle & ID</TableHead>
              <TableHead>Selling Price</TableHead>
              <TableHead>MRP</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-xs text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    Loading combo bundles from Firestore...
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-36 text-center text-xs text-muted-foreground">
                  <p className="mb-2">No combo products found matching your filter.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openCreateDialog}
                    className="rounded-xl text-xs gap-1.5 font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add First Combo Product
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => {
                const name = getLocalizedText(c.name);
                const discount = c.mrp && c.mrp > c.price ? Math.round(((c.mrp - c.price) / c.mrp) * 100) : 0;
                const weightDisplay = c.weight ? `${c.weight}g` : "—";
                const rawImg = c.thumbnailUrl || (c.imageUrls && c.imageUrls[0]) || "";
                const displayImg = formatImageUrl(rawImg);

                return (
                  <TableRow key={c.id} className="text-xs hover:bg-muted/10">
                    <TableCell>
                      <div className="h-12 w-12 rounded-xl bg-muted/60 overflow-hidden border border-border/80 grid place-items-center shadow-xs shrink-0 relative">
                        {displayImg ? (
                          <img
                            src={displayImg}
                            alt={name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              const target = e.currentTarget;
                              const driveMatch =
                                rawImg.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                                rawImg.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                                rawImg.match(/\/d\/([a-zA-Z0-9_-]+)/);
                              if (!target.dataset.triedFallback) {
                                target.dataset.triedFallback = "1";
                                if (driveMatch && driveMatch[1]) {
                                  target.src = `https://lh3.googleusercontent.com/d/${driveMatch[1]}=s800`;
                                  return;
                                }
                              } else if (target.dataset.triedFallback === "1") {
                                target.dataset.triedFallback = "2";
                                if (driveMatch && driveMatch[1]) {
                                  target.src = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w800`;
                                  return;
                                }
                              }
                              target.style.display = "none";
                              const parent = target.parentElement;
                              if (parent && !parent.querySelector(".fallback-label")) {
                                const placeholder = document.createElement("div");
                                placeholder.className =
                                  "fallback-label text-[9px] font-mono font-bold text-muted-foreground p-1 text-center";
                                placeholder.innerText = "IMG";
                                parent.appendChild(placeholder);
                              }
                            }}
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="max-w-[260px]">
                      <div className="font-bold text-foreground truncate">{name}</div>
                      <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span className="truncate">{c.id}</span>
                        {c.bestSeller && (
                          <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 py-0 shrink-0">
                            ★ Best Seller
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="font-bold text-emerald-600 font-mono">
                      <button
                        type="button"
                        onClick={() => openQuickPriceDialog(c)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-emerald-500/10 text-emerald-600 group transition-all text-left"
                        title="Click to quickly edit price only"
                      >
                        <span>₹{c.price?.toLocaleString() || "0"}</span>
                        <Edit className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </TableCell>

                    <TableCell className="line-through text-muted-foreground font-mono">
                      ₹{c.mrp?.toLocaleString() || "0"}
                    </TableCell>

                    <TableCell>
                      {discount > 0 ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold">
                          {discount}% OFF
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="font-mono text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Weight className="h-3.5 w-3.5" />
                        {weightDisplay}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-[11px] text-muted-foreground capitalize">
                        {(c.categoryId || "General").replace(/^cat_/, "").replace(/_/g, " ")}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(c)}
                          className="h-8 w-8 rounded-lg hover:bg-muted text-foreground"
                          title="Edit Combo"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(c)}
                          className="h-8 w-8 rounded-lg hover:bg-rose-500/10 text-rose-500"
                          title="Delete Combo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Comprehensive Add / Edit Combo Dialog Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Boxes className="h-4.5 w-4.5" />
                </div>
                {editingCombo ? "Edit Combo Bundle" : "Add New Combo Product"}
              </DialogTitle>
              <Badge variant="outline" className="font-mono text-[11px] py-0.5">
                {id || "New Combo"}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure multi-language catalog fields, weight slabs, usage instructions, and Google Drive images matching Firestore document schema.
            </DialogDescription>
          </DialogHeader>

          {/* Dialog Navigation Tabs */}
          <div className="flex items-center gap-1.5 border-b pb-2 pt-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("basic")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTab === "basic"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              1. Basic & Pricing
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("languages")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTab === "languages"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Languages className="h-3.5 w-3.5" />
              2. Multi-Language Content
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("instructions")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTab === "instructions"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              3. Instructions & Ingredients
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("media")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTab === "media"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              4. Media & Seller
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {/* TAB 1: BASIC & PRICING */}
            {activeTab === "basic" && (
              <div className="space-y-4">
                {/* ID & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="comboId" className="text-xs font-semibold">
                      Combo Unique ID *
                    </Label>
                    <Input
                      id="comboId"
                      value={id}
                      onChange={(e) => setId(e.target.value)}
                      required
                      placeholder="e.g. COMBO--03-26-A007"
                      className="rounded-xl font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="category" className="text-xs font-semibold flex items-center justify-between">
                      <span>Primary Category</span>
                      <span className="text-[10px] text-muted-foreground font-mono">categoryId</span>
                    </Label>
                    <Select
                      value={categoryId}
                      onValueChange={(newCatId) => {
                        setCategoryId(newCatId);
                        const subs = getSubcategoriesForCategory(newCatId);
                        if (subs.length > 0) {
                          setSubCategoryId(subs[0].id);
                        }
                      }}
                    >
                      <SelectTrigger className="rounded-xl text-xs h-9 bg-background">
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
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="subCategory" className="text-xs font-semibold flex items-center justify-between">
                      <span>Sub-Category</span>
                      <span className="text-[10px] text-muted-foreground font-mono">subCategoryId</span>
                    </Label>
                    <Select value={subCategoryId} onValueChange={setSubCategoryId}>
                      <SelectTrigger className="rounded-xl text-xs h-9 bg-background">
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

                {/* Pricing, MRP & GST */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl border bg-muted/20">
                  <div className="space-y-1">
                    <Label htmlFor="price" className="text-xs font-semibold flex items-center gap-1 text-emerald-600">
                      <IndianRupee className="h-3.5 w-3.5" />
                      Selling Price (₹) *
                    </Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      value={price}
                      onChange={(e) => {
                        setPrice(e.target.value);
                        clearFieldError("price");
                      }}
                      required
                      className={`rounded-xl font-mono text-xs font-bold text-emerald-600 ${
                        fieldErrors.price ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""
                      }`}
                    />
                    {fieldErrors.price && (
                      <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>Selling price is required and must be greater than ₹0</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="mrp" className="text-xs font-semibold flex items-center gap-1">
                      <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
                      MRP Price (₹) *
                    </Label>
                    <Input
                      id="mrp"
                      type="number"
                      min="0"
                      value={mrp}
                      onChange={(e) => {
                        setMrp(e.target.value);
                        clearFieldError("mrp");
                      }}
                      required
                      className={`rounded-xl font-mono text-xs ${
                        fieldErrors.mrp ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""
                      }`}
                    />
                    {fieldErrors.mrp && (
                      <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>MRP is required and must be greater than ₹0</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="gst" className="text-xs font-semibold flex items-center gap-1">
                      <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                      GST Rate (%)
                    </Label>
                    <Input
                      id="gst"
                      type="number"
                      min="0"
                      max="28"
                      value={gst}
                      onChange={(e) => setGst(e.target.value)}
                      placeholder="5"
                      className="rounded-xl font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Packaging, Weight & Units */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl border bg-muted/20">
                  <div className="space-y-1">
                    <Label htmlFor="qty" className="text-xs font-semibold">
                      Pack Quantity
                    </Label>
                    <Input
                      id="qty"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="rounded-xl font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="qtyUnit" className="text-xs font-semibold">
                      Quantity Unit
                    </Label>
                    <Input
                      id="qtyUnit"
                      value={quantityUnit}
                      onChange={(e) => setQuantityUnit(e.target.value)}
                      placeholder="Ml, Pack, Unit"
                      className="rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="weight" className="text-xs font-semibold flex items-center gap-1">
                      <Weight className="h-3.5 w-3.5 text-muted-foreground" />
                      Gross Weight (g) *
                    </Label>
                    <Input
                      id="weight"
                      type="number"
                      min="0"
                      value={weight}
                      onChange={(e) => {
                        setWeight(e.target.value);
                        clearFieldError("weight");
                      }}
                      required
                      placeholder="e.g. 2500"
                      className={`rounded-xl font-mono text-xs font-semibold ${
                        fieldErrors.weight ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""
                      }`}
                    />
                    {fieldErrors.weight && (
                      <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>Gross weight is required</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="weightUnit" className="text-xs font-semibold">
                      Weight Unit
                    </Label>
                    <Input
                      id="weightUnit"
                      value={weightUnit}
                      onChange={(e) => setWeightUnit(e.target.value)}
                      placeholder="g, kg"
                      className="rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap items-center gap-6 p-3 rounded-2xl border bg-muted/10">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    Published in App Catalog
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-600">
                    <input
                      type="checkbox"
                      checked={bestSeller}
                      onChange={(e) => setBestSeller(e.target.checked)}
                      className="rounded border-input text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    Feature as Best Seller Bundle
                  </label>
                </div>
              </div>
            )}

            {/* TAB 2: MULTI-LANGUAGE CONTENT */}
            {activeTab === "languages" && (
              <div className="space-y-4">
                {/* Language Switcher Pills */}
                <div className="flex items-center gap-1.5 p-1.5 rounded-2xl border bg-muted/30 overflow-x-auto">
                  {LANG_CONFIG.map((lang) => {
                    const hasMissing =
                      (lang.code === "en" && (!nameEn.trim() || !descEn.trim() || !specEn.trim())) ||
                      (lang.code === "hi" && (!nameHi.trim() || !descHi.trim() || !specHi.trim())) ||
                      (lang.code === "kn" && (!nameKn.trim() || !descKn.trim() || !specKn.trim())) ||
                      (lang.code === "mr" && (!nameMr.trim() || !descMr.trim() || !specMr.trim())) ||
                      (lang.code === "pa" && (!namePa.trim() || !descPa.trim() || !specPa.trim())) ||
                      (lang.code === "ta" && (!nameTa.trim() || !descTa.trim() || !specTa.trim()));
                    const hasError =
                      fieldErrors[`name_${lang.code}`] ||
                      fieldErrors[`desc_${lang.code}`] ||
                      fieldErrors[`spec_${lang.code}`] ||
                      (Object.keys(fieldErrors).length > 0 && hasMissing);

                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setCurrentLang(lang.code)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                          currentLang === lang.code
                            ? "bg-background text-foreground shadow-xs border"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.label}</span>
                        {hasError ? (
                          <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" title="Missing required content in this language" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {/* Content for Current Language */}
                <div className="space-y-3 p-4 rounded-2xl border bg-muted/20">
                  <div className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>Editing Content for: {LANG_CONFIG.find((l) => l.code === currentLang)?.label} ({currentLang.toUpperCase()})</span>
                    <span className="text-[11px] text-primary font-semibold">
                      Required Field
                    </span>
                  </div>

                  {/* Title Field */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">
                      Combo Product Title ({currentLang.toUpperCase()}) *
                    </Label>
                    {currentLang === "en" && (
                      <>
                        <Input
                          value={nameEn}
                          onChange={(e) => {
                            setNameEn(e.target.value);
                            clearFieldError("name");
                            clearFieldError("name_en");
                          }}
                          required
                          placeholder="e.g. Combo FineKine and MooFoam with Dipcup"
                          className={`rounded-xl text-xs font-semibold ${
                            fieldErrors.name || fieldErrors.name_en ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""
                          }`}
                        />
                        {(fieldErrors.name || fieldErrors.name_en) && (
                          <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                            <AlertCircle className="h-3 w-3" />
                            <span>Combo product title in English is required.</span>
                          </p>
                        )}
                      </>
                    )}
                    {currentLang === "hi" && (
                      <>
                        <Input
                          value={nameHi}
                          onChange={(e) => {
                            setNameHi(e.target.value);
                            clearFieldError("name_hi");
                          }}
                          placeholder="फाइनकाइन और मूफोम डिप कप के साथ कॉम्बो"
                          className={`rounded-xl text-xs ${
                            fieldErrors.name_hi ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""
                          }`}
                        />
                        {fieldErrors.name_hi && (
                          <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                            <AlertCircle className="h-3 w-3" />
                            <span>Combo product title in Hindi is required.</span>
                          </p>
                        )}
                      </>
                    )}
                    {currentLang === "kn" && (
                      <>
                        <Input
                          value={nameKn}
                          onChange={(e) => {
                            setNameKn(e.target.value);
                            clearFieldError("name_kn");
                          }}
                          placeholder="ಡಿಪ್‌ಕಪ್‌ನೊಂದಿಗೆ ಫೈನ್‌ಕೈನ್ ಮತ್ತು ಮೂಫೋಮ್ ಕಾಂಬೊ"
                          className={`rounded-xl text-xs ${
                            fieldErrors.name_kn ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""
                          }`}
                        />
                        {fieldErrors.name_kn && (
                          <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                            <AlertCircle className="h-3 w-3" />
                            <span>Combo product title in Kannada is required.</span>
                          </p>
                        )}
                      </>
                    )}
                    {currentLang === "mr" && (
                      <>
                        <Input
                          value={nameMr}
                          onChange={(e) => {
                            setNameMr(e.target.value);
                            clearFieldError("name_mr");
                          }}
                          placeholder="डिप कपसह फाइनकाइन आणि मूफोम कॉम्बो"
                          className={`rounded-xl text-xs ${
                            fieldErrors.name_mr ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""
                          }`}
                        />
                        {fieldErrors.name_mr && (
                          <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                            <AlertCircle className="h-3 w-3" />
                            <span>Combo product title in Marathi is required.</span>
                          </p>
                        )}
                      </>
                    )}
                    {currentLang === "pa" && (
                      <>
                        <Input
                          value={namePa}
                          onChange={(e) => {
                            setNamePa(e.target.value);
                            clearFieldError("name_pa");
                          }}
                          placeholder="ਡਿੱਪ ਕੱਪ ਦੇ ਨਾਲ ਫਾਈਨਕਾਈਨ ਅਤੇ ਮੂਫੋਮ ਕੰਬੋ"
                          className={`rounded-xl text-xs ${
                            fieldErrors.name_pa ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""
                          }`}
                        />
                        {fieldErrors.name_pa && (
                          <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                            <AlertCircle className="h-3 w-3" />
                            <span>Combo product title in Punjabi is required.</span>
                          </p>
                        )}
                      </>
                    )}
                    {currentLang === "ta" && (
                      <>
                        <Input
                          value={nameTa}
                          onChange={(e) => {
                            setNameTa(e.target.value);
                            clearFieldError("name_ta");
                          }}
                          placeholder="டிப் கப் உடன் ஃபைன்கைன் மற்றும் மூஃபோம் காம்போ"
                          className={`rounded-xl text-xs ${
                            fieldErrors.name_ta ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5 text-destructive" : ""
                          }`}
                        />
                        {fieldErrors.name_ta && (
                          <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                            <AlertCircle className="h-3 w-3" />
                            <span>Combo product title in Tamil is required.</span>
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Description Field */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">
                      Detailed Description ({currentLang.toUpperCase()})
                    </Label>
                    {currentLang === "en" && (
                      <>
                        <textarea
                          rows={4}
                          value={descEn}
                          onChange={(e) => {
                            setDescEn(e.target.value);
                            clearFieldError("description");
                          }}
                          placeholder="MooFoam is a teat wash designed for the prevention of mastitis in cattle..."
                          className={`w-full rounded-xl border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 ${
                            fieldErrors.description
                              ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                              : "border-input bg-transparent focus:ring-ring"
                          }`}
                        />
                        {fieldErrors.description && (
                          <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                            <AlertCircle className="h-3 w-3" />
                            <span>Detailed description is required. Please fill in this field.</span>
                          </p>
                        )}
                      </>
                    )}
                    {currentLang === "hi" && (
                      <textarea
                        rows={4}
                        value={descHi}
                        onChange={(e) => {
                          setDescHi(e.target.value);
                          clearFieldError("desc_hi");
                        }}
                        placeholder="मूफोम गाय, भेड़, बकरी, गधे और ऊंट में मैस्टाइटिस की रोकथाम के लिए..."
                        className={`w-full rounded-xl border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 ${
                          fieldErrors.desc_hi
                            ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                            : "border-input bg-transparent focus:ring-ring"
                        }`}
                      />
                    )}
                    {currentLang === "kn" && (
                      <textarea
                        rows={4}
                        value={descKn}
                        onChange={(e) => {
                          setDescKn(e.target.value);
                          clearFieldError("desc_kn");
                        }}
                        placeholder="ಮೂಫೋಮ್ ಎಂಬುದು ದನ, ಕುರಿ, ಮೇಕೆಗಳಲ್ಲಿ ಮಾಸ್ಟೈಟಿಸ್ ತಡೆಗಟ್ಟಲು..."
                        className={`w-full rounded-xl border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 ${
                          fieldErrors.desc_kn
                            ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                            : "border-input bg-transparent focus:ring-ring"
                        }`}
                      />
                    )}
                    {currentLang === "mr" && (
                      <textarea
                        rows={4}
                        value={descMr}
                        onChange={(e) => {
                          setDescMr(e.target.value);
                          clearFieldError("desc_mr");
                        }}
                        placeholder="मूफोम हे गाय, मेंढी, शेळी यांच्यातील मॅस्टायटिस रोखण्यासाठी..."
                        className={`w-full rounded-xl border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 ${
                          fieldErrors.desc_mr
                            ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                            : "border-input bg-transparent focus:ring-ring"
                        }`}
                      />
                    )}
                    {currentLang === "pa" && (
                      <textarea
                        rows={4}
                        value={descPa}
                        onChange={(e) => {
                          setDescPa(e.target.value);
                          clearFieldError("desc_pa");
                        }}
                        placeholder="ਮੂਫੋਮ ਗਾਵਾਂ, ਭੇਡਾਂ, ਬੱਕਰੀਆਂ ਵਿੱਚ ਮੈਸਟਾਈਟਿਸ ਦੀ ਰੋਕਥਾਮ ਲਈ..."
                        className={`w-full rounded-xl border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 ${
                          fieldErrors.desc_pa
                            ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                            : "border-input bg-transparent focus:ring-ring"
                        }`}
                      />
                    )}
                    {currentLang === "ta" && (
                      <textarea
                        rows={4}
                        value={descTa}
                        onChange={(e) => {
                          setDescTa(e.target.value);
                          clearFieldError("desc_ta");
                        }}
                        placeholder="மூஃபோம் என்பது மாடு, செம்மறியாடு, வெள்ளாடுகளில் மேஸ்டைடிஸ் நோயைத் தடுக்க..."
                        className={`w-full rounded-xl border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 ${
                          fieldErrors.desc_ta
                            ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                            : "border-input bg-transparent focus:ring-ring"
                        }`}
                      />
                    )}
                  </div>

                  {/* Specifications Field in Current Language */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                      <span>Bundle Specifications ({currentLang.toUpperCase()}) *</span>
                      <span className="text-[10px] text-muted-foreground font-mono">specification.specification.{currentLang}</span>
                    </Label>
                    {currentLang === "en" && (
                      <>
                        <textarea
                          rows={3}
                          value={specEn}
                          onChange={(e) => {
                            setSpecEn(e.target.value);
                            clearFieldError("specification");
                            clearFieldError("spec_en");
                          }}
                          placeholder="e.g. FineKine (500ml) & MooFoam (500ml) complete anti-mastitis teat hygiene system..."
                          className={`w-full rounded-xl border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 ${
                            fieldErrors.specification || fieldErrors.spec_en
                              ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                              : "border-input bg-transparent focus:ring-ring"
                          }`}
                        />
                        {(fieldErrors.specification || fieldErrors.spec_en) && (
                          <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                            <AlertCircle className="h-3 w-3" />
                            <span>Bundle specifications are required. Please fill in this field.</span>
                          </p>
                        )}
                      </>
                    )}
                    {currentLang === "hi" && (
                      <textarea
                        rows={3}
                        value={specHi}
                        onChange={(e) => {
                          setSpecHi(e.target.value);
                          clearFieldError("spec_hi");
                        }}
                        placeholder="फाइनकाइन (500 मि.ली) और मूफोम (500 मि.ली) का संपूर्ण थनैला रोधी कॉम्बो..."
                        className={`w-full rounded-xl border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 ${
                          fieldErrors.spec_hi
                            ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                            : "border-input bg-transparent focus:ring-ring"
                        }`}
                      />
                    )}
                    {currentLang === "kn" && (
                      <textarea
                        rows={3}
                        value={specKn}
                        onChange={(e) => {
                          setSpecKn(e.target.value);
                          clearFieldError("spec_kn");
                        }}
                        placeholder="ಫೈನ್‌ಕೈನ್ ಮತ್ತು ಮೂಫೋಮ್ ಸಂಪೂರ್ಣ ಮಾಸ್ಟೈಟಿಸ್ ತಡೆಗಟ್ಟುವ ಕಾಂಬೊ..."
                        className={`w-full rounded-xl border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 ${
                          fieldErrors.spec_kn
                            ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                            : "border-input bg-transparent focus:ring-ring"
                        }`}
                      />
                    )}
                    {currentLang === "mr" && (
                      <textarea
                        rows={3}
                        value={specMr}
                        onChange={(e) => {
                          setSpecMr(e.target.value);
                          clearFieldError("spec_mr");
                        }}
                        placeholder="फाइनकाइन आणि मूफोम संपूर्ण मॅस्टायटिस प्रतिबंधक कॉम्बो..."
                        className={`w-full rounded-xl border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 ${
                          fieldErrors.spec_mr
                            ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                            : "border-input bg-transparent focus:ring-ring"
                        }`}
                      />
                    )}
                    {currentLang === "pa" && (
                      <textarea
                        rows={3}
                        value={specPa}
                        onChange={(e) => {
                          setSpecPa(e.target.value);
                          clearFieldError("spec_pa");
                        }}
                        placeholder="ਫਾਈਨਕਾਈਨ ਅਤੇ ਮੂਫੋਮ ਸੰਪੂਰਨ ਮੈਸਟਾਈਟਿਸ ਰੋਕਥਾਮ ਕੰਬੋ..."
                        className={`w-full rounded-xl border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 ${
                          fieldErrors.spec_pa
                            ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                            : "border-input bg-transparent focus:ring-ring"
                        }`}
                      />
                    )}
                    {currentLang === "ta" && (
                      <textarea
                        rows={3}
                        value={specTa}
                        onChange={(e) => {
                          setSpecTa(e.target.value);
                          clearFieldError("spec_ta");
                        }}
                        placeholder="ஃபைன்கைன் மற்றும் மூஃபோம் முழுமையான மேஸ்டைடிஸ் தடுப்பு காம்போ..."
                        className={`w-full rounded-xl border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 ${
                          fieldErrors.spec_ta
                            ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                            : "border-input bg-transparent focus:ring-ring"
                        }`}
                      />
                    )}
                  </div>

                  {/* Best Before Field */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">
                      Best Before / Shelf Life ({currentLang.toUpperCase()})
                    </Label>
                    {currentLang === "en" && (
                      <Input
                        value={bbEn}
                        onChange={(e) => setBbEn(e.target.value)}
                        placeholder="e.g. 2 Years"
                        className="rounded-xl text-xs font-mono"
                      />
                    )}
                    {currentLang === "hi" && (
                      <Input
                        value={bbHi}
                        onChange={(e) => setBbHi(e.target.value)}
                        placeholder="2 वर्ष"
                        className="rounded-xl text-xs"
                      />
                    )}
                    {currentLang === "kn" && (
                      <Input
                        value={bbKn}
                        onChange={(e) => setBbKn(e.target.value)}
                        placeholder="2 ವರ್ಷಗಳು"
                        className="rounded-xl text-xs"
                      />
                    )}
                    {currentLang === "mr" && (
                      <Input
                        value={bbMr}
                        onChange={(e) => setBbMr(e.target.value)}
                        placeholder="2 वर्षे"
                        className="rounded-xl text-xs"
                      />
                    )}
                    {currentLang === "pa" && (
                      <Input
                        value={bbPa}
                        onChange={(e) => setBbPa(e.target.value)}
                        placeholder="2 ਸਾਲ"
                        className="rounded-xl text-xs"
                      />
                    )}
                    {currentLang === "ta" && (
                      <Input
                        value={bbTa}
                        onChange={(e) => setBbTa(e.target.value)}
                        placeholder="2 ஆண்டுகள்"
                        className="rounded-xl text-xs"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: INSTRUCTIONS & INGREDIENTS */}
            {activeTab === "instructions" && (
              <div className="space-y-4">
                {/* Language Switcher Bar */}
                <div className="flex items-center gap-1.5 border-b pb-2 overflow-x-auto">
                  {LANG_CONFIG.map((lang) => {
                    const hasMissing =
                      (lang.code === "en" && (!instructionsEn.trim() || !ingredientsEn.trim())) ||
                      (lang.code === "hi" && (!instructionsHi.trim() || !ingredientsHi.trim())) ||
                      (lang.code === "kn" && (!instructionsKn.trim() || !ingredientsKn.trim())) ||
                      (lang.code === "mr" && (!instructionsMr.trim() || !ingredientsMr.trim())) ||
                      (lang.code === "pa" && (!instructionsPa.trim() || !ingredientsPa.trim())) ||
                      (lang.code === "ta" && (!instructionsTa.trim() || !ingredientsTa.trim()));
                    const hasError =
                      fieldErrors[`instructions_${lang.code}`] ||
                      fieldErrors[`ingredients_${lang.code}`] ||
                      (Object.keys(fieldErrors).length > 0 && hasMissing);

                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setInstructionLang(lang.code)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                          instructionLang === lang.code
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.label}</span>
                        {hasError ? (
                          <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {/* Sub-header showing active language */}
                <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-xl border">
                  <span>
                    Editing in:{" "}
                    <strong className="text-foreground">
                      {LANG_CONFIG.find((l) => l.code === instructionLang)?.label} ({instructionLang.toUpperCase()})
                    </strong>
                  </span>
                  <span className="text-[10px] text-muted-foreground">Optional (auto-fills from English)</span>
                </div>

                {/* Usage Instructions */}
                <div className="space-y-1">
                  <Label htmlFor="instructions" className="text-xs font-semibold flex items-center justify-between">
                    <span>Usage Instructions ({instructionLang.toUpperCase()}){instructionLang === "en" ? " *" : ""} — One instruction per line</span>
                    <span className="text-[11px] text-muted-foreground font-normal">instructionsToUse.{instructionLang}</span>
                  </Label>
                  {instructionLang === "en" && (
                    <>
                      <textarea
                        id="instructions"
                        rows={4}
                        value={instructionsEn}
                        onChange={(e) => {
                          setInstructionsEn(e.target.value);
                          clearFieldError("instructions");
                          clearFieldError("instructions_en");
                        }}
                        placeholder={"FineKine:\nUse after milking.\nDip 3/4th of the teat length.\nMooFoam:\nDo not add water.\nDip teats before and after milking."}
                        className={`w-full rounded-xl border px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 ${
                          fieldErrors.instructions || fieldErrors.instructions_en
                            ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                            : "border-input bg-transparent focus:ring-ring"
                        }`}
                      />
                      {(fieldErrors.instructions || fieldErrors.instructions_en) && (
                        <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                          <AlertCircle className="h-3 w-3" />
                          <span>Usage instructions in English are required.</span>
                        </p>
                      )}
                    </>
                  )}
                  {instructionLang === "hi" && (
                    <textarea
                      rows={4}
                      value={instructionsHi}
                      onChange={(e) => {
                        setInstructionsHi(e.target.value);
                        clearFieldError("instructions_hi");
                      }}
                      placeholder={"फाइनकाइन:\nदूध निकालने के बाद उपयोग करें।\nथनों के 3/4 भाग को डुबोएं।\nमूफोम:\nपानी न मिलाएं।\nदूध निकालने से पहले और बाद में डुबोएं।"}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 ${
                        fieldErrors.instructions_hi
                          ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                          : "border-input bg-transparent focus:ring-ring"
                      }`}
                    />
                  )}
                  {instructionLang === "kn" && (
                    <textarea
                      rows={4}
                      value={instructionsKn}
                      onChange={(e) => {
                        setInstructionsKn(e.target.value);
                        clearFieldError("instructions_kn");
                      }}
                      placeholder={"ಫೈನ್‌ಕೈನ್:\nಹಾಲು ಕರೆದ ನಂತರ ಬಳಸಿ.\nತೊಟ್ಟುಗಳ 3/4 ಭಾಗವನ್ನು ಅದ್ದಿ.\nಮೂಫೋಮ್:\nನೀರು ಸೇರಿಸಬೇಡಿ."}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 ${
                        fieldErrors.instructions_kn
                          ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                          : "border-input bg-transparent focus:ring-ring"
                      }`}
                    />
                  )}
                  {instructionLang === "mr" && (
                    <textarea
                      rows={4}
                      value={instructionsMr}
                      onChange={(e) => {
                        setInstructionsMr(e.target.value);
                        clearFieldError("instructions_mr");
                      }}
                      placeholder={"फाइनकाइन:\nदूध काढल्यानंतर वापरा.\nकासेच्या ३/४ भागावर लावा.\nमूफोम:\nपाणी टाकू नका."}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 ${
                        fieldErrors.instructions_mr
                          ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                          : "border-input bg-transparent focus:ring-ring"
                      }`}
                    />
                  )}
                  {instructionLang === "pa" && (
                    <textarea
                      rows={4}
                      value={instructionsPa}
                      onChange={(e) => {
                        setInstructionsPa(e.target.value);
                        clearFieldError("instructions_pa");
                      }}
                      placeholder={"ਫਾਈਨਕਾਈਨ:\nਦੁੱਧ ਚੋਣ ਤੋਂ ਬਾਅਦ ਵਰਤੋਂ.\nਥਣਾਂ ਦੀ 3/4 ਲੰਬਾਈ ਡੁਬੋਵੋ.\nਮੂਫੋਮ:\nਪਾਣੀ ਨਾ ਮਿਲਾਓ."}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 ${
                        fieldErrors.instructions_pa
                          ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                          : "border-input bg-transparent focus:ring-ring"
                      }`}
                    />
                  )}
                  {instructionLang === "ta" && (
                    <textarea
                      rows={4}
                      value={instructionsTa}
                      onChange={(e) => {
                        setInstructionsTa(e.target.value);
                        clearFieldError("instructions_ta");
                      }}
                      placeholder={"ஃபைன்கைன்:\nபால் கறந்த பிறகு பயன்படுத்தவும்.\nகாம்பின் 3/4 பகுதியை நனைக்கவும்.\nமூஃபோம்:\nதண்ணீர் சேர்க்க வேண்டாம்."}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 ${
                        fieldErrors.instructions_ta
                          ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                          : "border-input bg-transparent focus:ring-ring"
                      }`}
                    />
                  )}
                </div>

                {/* Product Ingredients */}
                <div className="space-y-1">
                  <Label htmlFor="ingredients" className="text-xs font-semibold flex items-center justify-between">
                    <span>Product Ingredients ({instructionLang.toUpperCase()}) * — One per line</span>
                    <span className="text-[11px] text-muted-foreground font-normal">productIngredients.{instructionLang}</span>
                  </Label>
                  {instructionLang === "en" && (
                    <>
                      <textarea
                        id="ingredients"
                        rows={3}
                        value={ingredientsEn}
                        onChange={(e) => {
                          setIngredientsEn(e.target.value);
                          clearFieldError("ingredients");
                          clearFieldError("ingredients_en");
                        }}
                        placeholder={"MooFoam: Lactic Acid, Coconut surfactant, Water...\nFineKine: Pure Aloe Vera, Vitamin E, Plant emollients..."}
                        className={`w-full rounded-xl border px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 ${
                          fieldErrors.ingredients || fieldErrors.ingredients_en
                            ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                            : "border-input bg-transparent focus:ring-ring"
                        }`}
                      />
                      {(fieldErrors.ingredients || fieldErrors.ingredients_en) && (
                        <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mt-1 animate-pulse">
                          <AlertCircle className="h-3 w-3" />
                          <span>Product ingredients in English are required.</span>
                        </p>
                      )}
                    </>
                  )}
                  {instructionLang === "hi" && (
                    <textarea
                      rows={3}
                      value={ingredientsHi}
                      onChange={(e) => {
                        setIngredientsHi(e.target.value);
                        clearFieldError("ingredients_hi");
                      }}
                      placeholder={"मूफोम: लैक्टिक एसिड, नारियल सर्फेक्टेंट, पानी...\nफाइनकाइन: एलोवेरा, विटामिन ई, पौधे के अर्क..."}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 ${
                        fieldErrors.ingredients_hi
                          ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                          : "border-input bg-transparent focus:ring-ring"
                      }`}
                    />
                  )}
                  {instructionLang === "kn" && (
                    <textarea
                      rows={3}
                      value={ingredientsKn}
                      onChange={(e) => {
                        setIngredientsKn(e.target.value);
                        clearFieldError("ingredients_kn");
                      }}
                      placeholder={"ಮೂಫೋಮ್: ಲ್ಯಾಕ್ಟಿಕ್ ಆಮ್ಲ, ತೆಂಗಿನ ಸರ್ಫ್ಯಾಕ್ಟಂಟ್...\nಫೈನ್‌ಕೈನ್: ಅಲೋವೆರಾ, ವಿಟಮಿನ್ ಇ..."}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 ${
                        fieldErrors.ingredients_kn
                          ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                          : "border-input bg-transparent focus:ring-ring"
                      }`}
                    />
                  )}
                  {instructionLang === "mr" && (
                    <textarea
                      rows={3}
                      value={ingredientsMr}
                      onChange={(e) => {
                        setIngredientsMr(e.target.value);
                        clearFieldError("ingredients_mr");
                      }}
                      placeholder={"मूफोम: लॅक्टिक ऍसिड, खोबरेल सर्फॅक्टंट...\nफाइनकाइन: कोरफड, व्हिटॅमिन ई..."}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 ${
                        fieldErrors.ingredients_mr
                          ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                          : "border-input bg-transparent focus:ring-ring"
                      }`}
                    />
                  )}
                  {instructionLang === "pa" && (
                    <textarea
                      rows={3}
                      value={ingredientsPa}
                      onChange={(e) => {
                        setIngredientsPa(e.target.value);
                        clearFieldError("ingredients_pa");
                      }}
                      placeholder={"ਮੂਫੋਮ: ਲੈਕਟਿਕ ਐਸਿਡ, ਨਾਰੀਅਲ ਸਰਫੈਕਟੈਂਟ...\nਫਾਈਨਕਾਈਨ: ਐਲੋਵੇਰਾ, ਵਿਟਾਮਿਨ ਈ..."}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 ${
                        fieldErrors.ingredients_pa
                          ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                          : "border-input bg-transparent focus:ring-ring"
                      }`}
                    />
                  )}
                  {instructionLang === "ta" && (
                    <textarea
                      rows={3}
                      value={ingredientsTa}
                      onChange={(e) => {
                        setIngredientsTa(e.target.value);
                        clearFieldError("ingredients_ta");
                      }}
                      placeholder={"மூஃபோம்: லாக்டிக் அமிலம், தேங்காய் சர்பாக்டான்ட்...\nஃபைன்கைன்: கற்றாழை, வைட்டமின் ஈ..."}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 ${
                        fieldErrors.ingredients_ta
                          ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5"
                          : "border-input bg-transparent focus:ring-ring"
                      }`}
                    />
                  )}
                </div>

                {/* Storage Condition & Technical Specs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Storage Condition ({instructionLang.toUpperCase()})
                    </Label>
                    {instructionLang === "en" && (
                      <Input
                        value={storageEn}
                        onChange={(e) => setStorageEn(e.target.value)}
                        placeholder="Room Temperature [25°C]"
                        className="rounded-xl text-xs font-mono"
                      />
                    )}
                    {instructionLang === "hi" && (
                      <Input
                        value={storageHi}
                        onChange={(e) => setStorageHi(e.target.value)}
                        placeholder="कमरे का तापमान [25°C]"
                        className="rounded-xl text-xs font-mono"
                      />
                    )}
                    {instructionLang === "kn" && (
                      <Input
                        value={storageKn}
                        onChange={(e) => setStorageKn(e.target.value)}
                        placeholder="ಕೊಠಡಿ ತಾಪಮಾನ [25°C]"
                        className="rounded-xl text-xs font-mono"
                      />
                    )}
                    {instructionLang === "mr" && (
                      <Input
                        value={storageMr}
                        onChange={(e) => setStorageMr(e.target.value)}
                        placeholder="खोलीचे तापमान [25°C]"
                        className="rounded-xl text-xs font-mono"
                      />
                    )}
                    {instructionLang === "pa" && (
                      <Input
                        value={storagePa}
                        onChange={(e) => setStoragePa(e.target.value)}
                        placeholder="ਕਮਰੇ ਦਾ ਤਾਪਮਾਨ [25°C]"
                        className="rounded-xl text-xs font-mono"
                      />
                    )}
                    {instructionLang === "ta" && (
                      <Input
                        value={storageTa}
                        onChange={(e) => setStorageTa(e.target.value)}
                        placeholder="அறை வெப்பநிலை [25°C]"
                        className="rounded-xl text-xs font-mono"
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Bundle Specifications ({instructionLang.toUpperCase()})
                    </Label>
                    {instructionLang === "en" && (
                      <Input
                        value={specEn}
                        onChange={(e) => setSpecEn(e.target.value)}
                        placeholder="Combo Bundle of FineKine (500ml) & MooFoam (500ml)"
                        className="rounded-xl text-xs"
                      />
                    )}
                    {instructionLang === "hi" && (
                      <Input
                        value={specHi}
                        onChange={(e) => setSpecHi(e.target.value)}
                        placeholder="फाइनकाइन (500 मि.ली) और मूफोम (500 मि.ली) का कॉम्बो"
                        className="rounded-xl text-xs"
                      />
                    )}
                    {instructionLang === "kn" && (
                      <Input
                        value={specKn}
                        onChange={(e) => setSpecKn(e.target.value)}
                        placeholder="ಫೈನ್‌ಕೈನ್ (500 ಮಿ.ಲೀ) ಮತ್ತು ಮೂಫೋಮ್ (500 ಮಿ.ಲೀ) ಕಾಂಬೊ"
                        className="rounded-xl text-xs"
                      />
                    )}
                    {instructionLang === "mr" && (
                      <Input
                        value={specMr}
                        onChange={(e) => setSpecMr(e.target.value)}
                        placeholder="फाइनकाइन (500 मिली) आणि मूफोम (500 मिली) कॉम्बो"
                        className="rounded-xl text-xs"
                      />
                    )}
                    {instructionLang === "pa" && (
                      <Input
                        value={specPa}
                        onChange={(e) => setSpecPa(e.target.value)}
                        placeholder="ਫਾਈਨਕਾਈਨ (500 ਮਿ.ਲੀ) ਅਤੇ ਮੂਫੋਮ (500 ਮਿ.ਲੀ) ਕੰਬੋ"
                        className="rounded-xl text-xs"
                      />
                    )}
                    {instructionLang === "ta" && (
                      <Input
                        value={specTa}
                        onChange={(e) => setSpecTa(e.target.value)}
                        placeholder="ஃபைன்கைன் (500 மி.லி) மற்றும் மூஃபோம் (500 மி.லி) காம்போ"
                        className="rounded-xl text-xs"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: MEDIA & SELLER */}
            {activeTab === "media" && (
              <div className="space-y-4">
                {/* Image Gallery and Multi-Upload Section */}
                <div
                  className={`p-4 rounded-2xl border space-y-4 transition-all ${
                    fieldErrors.images ? "border-destructive ring-2 ring-destructive/50 bg-destructive/5" : "bg-muted/20"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        <ImageIcon className="h-4 w-4 text-primary" /> Combo Product Images *
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Upload one or multiple images to Firebase Storage (<code>combos/images</code>). Click any image to set as Primary Thumbnail.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label
                        className={`cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/20 bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition-all ${
                          isUploading ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>{isUploading ? "Uploading Images..." : "Upload Image(s)"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleImageFileUpload}
                          disabled={isUploading}
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
                        ...extraImagesText
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
                                  alt={`Image ${idx + 1}`}
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover"
                                />

                                {isPrimary ? (
                                  <span className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                                    Thumbnail
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setThumbnailUrl(imgUrl);
                                      const others = allImgs.filter((u) => u !== imgUrl);
                                      setExtraImagesText(others.join("\n"));
                                      toast.success("Set as Primary Thumbnail!");
                                    }}
                                    className="absolute top-1.5 left-1.5 bg-black/75 hover:bg-black text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    Make Main
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    const remaining = allImgs.filter((u) => u !== imgUrl);
                                    setThumbnailUrl(remaining[0] || "");
                                    setExtraImagesText(remaining.slice(1).join("\n"));
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
                        <Label htmlFor="imgUrl" className="text-[11px] font-semibold text-muted-foreground">
                          Primary Thumbnail URL (Firebase Storage or Google Drive):
                        </Label>
                        <Input
                          id="imgUrl"
                          value={thumbnailUrl}
                          onChange={(e) => {
                            setThumbnailUrl(e.target.value);
                            clearFieldError("images");
                          }}
                          placeholder="https://firebasestorage.googleapis.com/... or Google Drive Link"
                          className="rounded-xl text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="extraImgs" className="text-[11px] font-semibold text-muted-foreground">
                          Additional Image URLs (One URL per line):
                        </Label>
                        <textarea
                          id="extraImgs"
                          rows={1}
                          value={extraImagesText}
                          onChange={(e) => {
                            setExtraImagesText(e.target.value);
                            clearFieldError("images");
                          }}
                          placeholder="https://firebasestorage.googleapis.com/..."
                          className="w-full rounded-xl border border-input bg-transparent px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seller Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl border bg-muted/20">
                  <div className="space-y-1">
                    <Label htmlFor="sellerName" className="text-xs font-semibold">
                      Seller / Brand Name
                    </Label>
                    <Input
                      id="sellerName"
                      value={sellerName}
                      onChange={(e) => setSellerName(e.target.value)}
                      placeholder="Chimertech"
                      className="rounded-xl text-xs font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="sellerType" className="text-xs font-semibold">
                      Seller Type
                    </Label>
                    <Input
                      id="sellerType"
                      value={sellerType}
                      onChange={(e) => setSellerType(e.target.value)}
                      placeholder="seller"
                      className="rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="sellerLogo" className="text-xs font-semibold">
                      Seller Logo URL
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                      <Input
                        id="sellerLogo"
                        value={sellerLogo}
                        onChange={(e) => setSellerLogo(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="rounded-xl font-mono text-xs"
                      />
                      {sellerLogo && (
                        <div className="h-16 w-36 px-3 py-1.5 rounded-xl border-2 border-border/80 bg-white dark:bg-card shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                          <img
                            src={formatImageUrl(sellerLogo)}
                            alt="Seller Logo"
                            referrerPolicy="no-referrer"
                            className="max-h-12 w-auto max-w-full object-contain mx-auto"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer with Actions */}
            <DialogFooter className="pt-4 border-t flex items-center justify-between sm:justify-between w-full">
              <div className="text-[11px] text-muted-foreground">
                Target: <code className="font-mono bg-muted/80 px-1 py-0.5 rounded">/product_marketplace/main/combos/{id || "..."}</code>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saveCombo.isPending || isUploading}
                  className="rounded-xl bg-primary text-primary-foreground font-semibold px-5"
                >
                  {saveCombo.isPending ? "Saving to Firebase..." : editingCombo ? "Update Combo" : "Save & Publish Combo"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Success Confirmation Modal Popup */}
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-2">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            Saved Successfully!
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {successMessage || "Combo product has been saved and published successfully in Firebase at:"}
            <code className="block mt-2 font-mono text-[11px] bg-muted/60 p-2 rounded-xl text-foreground">
              /product_marketplace/main/combos
            </code>
          </DialogDescription>
          <DialogFooter className="mt-4 sm:justify-center">
            <Button
              onClick={() => setSuccessModalOpen(false)}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6"
            >
              Done & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Quick Price Only Edit Modal */}
      <Dialog open={quickPriceOpen} onOpenChange={setQuickPriceOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <IndianRupee className="h-4 w-4" />
              </div>
              Update Price Only
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Quickly update selling price or MRP. All other combo specifications, multi-language descriptions, and images remain untouched and identical.
            </DialogDescription>
          </DialogHeader>

          {quickCombo && (
            <form onSubmit={handleSaveQuickPrice} className="space-y-4 pt-2">
              <div className="p-3 rounded-2xl border bg-muted/30 space-y-1">
                <div className="text-xs font-bold text-foreground truncate">
                  {getLocalizedText(quickCombo.name)}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  ID: {quickCombo.id}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="qPrice" className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <IndianRupee className="h-3 w-3" /> Selling Price (₹) *
                  </Label>
                  <Input
                    id="qPrice"
                    type="number"
                    min="0"
                    value={quickPrice}
                    onChange={(e) => setQuickPrice(e.target.value)}
                    required
                    autoFocus
                    className="rounded-xl font-mono text-sm font-bold text-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="qMrp" className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <IndianRupee className="h-3 w-3" /> MRP Price (₹)
                  </Label>
                  <Input
                    id="qMrp"
                    type="number"
                    min="0"
                    value={quickMrp}
                    onChange={(e) => setQuickMrp(e.target.value)}
                    className="rounded-xl font-mono text-sm"
                  />
                </div>
              </div>

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
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5"
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
