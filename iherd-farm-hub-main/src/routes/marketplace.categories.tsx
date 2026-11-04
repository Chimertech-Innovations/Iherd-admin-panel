import { useState, useMemo, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, doc, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { getApiBaseUrlSync } from "@/lib/apiClient";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Layers,
  Plus,
  Pencil,
  Trash2,
  Search,
  Upload,
  Image as ImageIcon,
  ExternalLink,
  Eye,
  Check,
  AlertCircle,
  Copy,
  FolderTree,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { formatImageUrl, getLocalizedText } from "@/lib/utils";
import { validateImageFile, processSquareImage } from "@/lib/imageProcessor";
import { PRODUCT_CATEGORIES } from "@/lib/categories";

// Converts any Google Drive preview/sharing link to direct high-speed CDN image stream
// Compatible with Flutter Image.network, Android, iOS, and Web browsers
export function convertToDirectImageUrl(raw: string): string {
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

export const Route = createFileRoute("/marketplace/categories")({
  head: () => ({ meta: [{ title: "Categories & Subcategories — iHerd Admin" }] }),
  component: CategoriesPage,
});

export interface MultiLangName {
  en: string;
  hi: string;
  id: string;
  kn: string;
  mr: string;
  pa: string;
  ta: string;
}

export interface CategoryItem {
  id: string;
  image?: string;
  imageUrl?: string;
  icon?: string;
  iconUrl?: string;
  categoryImage?: string;
  name: MultiLangName;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubCategoryItem {
  id: string;
  categoryId: string;
  name: MultiLangName;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

function emptyMultiLang(defaultValue = ""): MultiLangName {
  return {
    en: defaultValue,
    hi: defaultValue,
    id: defaultValue,
    kn: defaultValue,
    mr: defaultValue,
    pa: defaultValue,
    ta: defaultValue,
  };
}

function CategoriesPage() {
  const queryClient = useQueryClient();
  const API_BASE = getApiBaseUrlSync();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<"categories" | "subcategories">("categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParentFilter, setSelectedParentFilter] = useState<string>("all");

  // Category Modal State
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [catId, setCatId] = useState("");
  const [catImage, setCatImage] = useState("");
  const [catOrder, setCatOrder] = useState<number>(1);
  const [catNames, setCatNames] = useState<MultiLangName>(emptyMultiLang());
  const [catFileError, setCatFileError] = useState<string | null>(null);
  const [isUploadingCatImage, setIsUploadingCatImage] = useState(false);
  const [isCatIdCustom, setIsCatIdCustom] = useState(false);

  // Subcategory Modal State
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [editingSubCategory, setEditingSubCategory] = useState<SubCategoryItem | null>(null);
  const [subId, setSubId] = useState("");
  const [subParentId, setSubParentId] = useState("");
  const [subOrder, setSubOrder] = useState<number>(1);
  const [subNames, setSubNames] = useState<MultiLangName>(emptyMultiLang());
  const [isSubIdCustom, setIsSubIdCustom] = useState(false);
  const [subPrefix, setSubPrefix] = useState<"subcat_" | "sub_">("subcat_");

  // Image Zoom State
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // 1. Fetch Main Categories
  const { data: categories = [], isLoading: catLoading, refetch: refetchCategories } = useQuery<CategoryItem[]>({
    queryKey: ["product_categories"],
    queryFn: async () => {
      // Direct Client Firestore SDK
      try {
        const snap = await getDocs(collection(db, "product_marketplace", "main", "categories"));
        if (!snap.empty) {
          const list = snap.docs.map((d) => {
            const data = d.data();
            const rawName = data.name || {};
            const enName = typeof rawName === "object" ? (rawName.en || "") : String(rawName || d.id);
            const rawImg = data.image || data.imageUrl || data.icon || data.iconUrl || data.categoryImage || "";
            const directImg = convertToDirectImageUrl(rawImg);
            return {
              id: d.id,
              image: directImg,
              imageUrl: directImg,
              icon: directImg,
              iconUrl: directImg,
              categoryImage: directImg,
              name: {
                en: enName,
                hi: rawName.hi || enName,
                id: rawName.id || enName,
                kn: rawName.kn || enName,
                mr: rawName.mr || enName,
                pa: rawName.pa || enName,
                ta: rawName.ta || enName,
              },
              order: typeof data.order === "number" ? data.order : parseInt(data.order, 10) || 0,
              createdAt: data.createdAt || null,
              updatedAt: data.updatedAt || null,
            };
          });
          list.sort((a, b) => a.order - b.order);
          return list;
        }
      } catch (err) {
        console.warn("Client Firestore categories fetch warning:", err);
      }

      // Backend API Fallback
      try {
        const res = await fetch(`${API_BASE}/api/admin/categories`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.categories) && json.categories.length > 0) {
            return json.categories;
          }
        }
      } catch (err) {
        console.warn("Backend API categories fetch warning:", err);
      }

      // Fallback to static catalog if empty
      return PRODUCT_CATEGORIES.map((c, idx) => ({
        id: c.id,
        image: "",
        name: {
          en: c.name,
          hi: c.nameHi || c.name,
          id: c.name,
          kn: c.name,
          mr: c.name,
          pa: c.name,
          ta: c.name,
        },
        order: idx + 1,
      }));
    },
    staleTime: 30_000,
  });

  // 2. Fetch Subcategories
  const { data: subcategories = [], isLoading: subLoading, refetch: refetchSubcategories } = useQuery<SubCategoryItem[]>({
    queryKey: ["product_subcategories"],
    queryFn: async () => {
      // Direct Client Firestore SDK
      try {
        const snap = await getDocs(collection(db, "product_marketplace", "main", "subcategories"));
        if (!snap.empty) {
          const list = snap.docs.map((d) => {
            const data = d.data();
            const rawName = data.name || {};
            const enName = typeof rawName === "object" ? (rawName.en || "") : String(rawName || d.id);
            return {
              id: d.id,
              categoryId: data.categoryId || "",
              name: {
                en: enName,
                hi: rawName.hi || enName,
                id: rawName.id || enName,
                kn: rawName.kn || enName,
                mr: rawName.mr || enName,
                pa: rawName.pa || enName,
                ta: rawName.ta || enName,
              },
              order: typeof data.order === "number" ? data.order : parseInt(data.order, 10) || 0,
              createdAt: data.createdAt || null,
              updatedAt: data.updatedAt || null,
            };
          });
          list.sort((a, b) => a.order - b.order);
          return list;
        }
      } catch (err) {
        console.warn("Client Firestore subcategories fetch warning:", err);
      }

      // Backend API Fallback
      try {
        const res = await fetch(`${API_BASE}/api/admin/subcategories`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.subcategories) && json.subcategories.length > 0) {
            return json.subcategories;
          }
        }
      } catch (err) {
        console.warn("Backend API subcategories fetch warning:", err);
      }

      // Fallback to static catalog subcategories
      const list: SubCategoryItem[] = [];
      PRODUCT_CATEGORIES.forEach((cat) => {
        cat.subcategories.forEach((sub, sIdx) => {
          list.push({
            id: sub.id,
            categoryId: cat.id,
            name: {
              en: sub.name,
              hi: sub.name,
              id: sub.name,
              kn: sub.name,
              mr: sub.name,
              pa: sub.name,
              ta: sub.name,
            },
            order: sIdx + 1,
          });
        });
      });
      return list;
    },
    staleTime: 30_000,
  });

  // Map category IDs to subcategory counts
  const categorySubCountMap = useMemo(() => {
    const map = new Map<string, number>();
    subcategories.forEach((s) => {
      map.set(s.categoryId, (map.get(s.categoryId) || 0) + 1);
    });
    return map;
  }, [subcategories]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter((c) => {
      const en = (c.name?.en || "").toLowerCase();
      const hi = (c.name?.hi || "").toLowerCase();
      const id = c.id.toLowerCase();
      return en.includes(q) || hi.includes(q) || id.includes(q);
    });
  }, [categories, searchQuery]);

  // Filtered subcategories
  const filteredSubcategories = useMemo(() => {
    return subcategories.filter((s) => {
      const matchesParent = selectedParentFilter === "all" || s.categoryId === selectedParentFilter;
      if (!matchesParent) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const en = (s.name?.en || "").toLowerCase();
      const hi = (s.name?.hi || "").toLowerCase();
      const id = s.id.toLowerCase();
      return en.includes(q) || hi.includes(q) || id.includes(q);
    });
  }, [subcategories, selectedParentFilter, searchQuery]);

  // 3. Category Mutations (Save / Delete)
  const saveCategoryMutation = useMutation({
    mutationFn: async (payload: CategoryItem) => {
      // 1. If editing and ID was changed, remove the old document key
      if (editingCategory && editingCategory.id !== payload.id) {
        try {
          await deleteDoc(doc(db, "product_marketplace", "main", "categories", editingCategory.id));
          await deleteDoc(doc(db, "categories", editingCategory.id)).catch(() => {});
          await deleteDoc(doc(db, "product_categories", editingCategory.id)).catch(() => {});
          await fetch(`${API_BASE}/api/admin/categories/${encodeURIComponent(editingCategory.id)}`, { method: "DELETE" }).catch(() => {});
        } catch (cleanupErr) {
          console.warn("Cleanup old category id warning:", cleanupErr);
        }
      }

      // 2. Direct Firestore write (Primary: /product_marketplace/main/categories, Mirror: /categories and /product_categories)
      try {
        const docRef = doc(db, "product_marketplace", "main", "categories", payload.id);
        const updateData = { ...payload, updatedAt: new Date().toISOString() };
        await setDoc(docRef, updateData, { merge: true });
        // Mirror to root paths for full compatibility with Flutter app models
        await setDoc(doc(db, "categories", payload.id), updateData, { merge: true }).catch(() => {});
        await setDoc(doc(db, "product_categories", payload.id), updateData, { merge: true }).catch(() => {});
      } catch (clientErr) {
        console.warn("Client Firestore category save warning:", clientErr);
      }

      // 3. Backend REST API
      const res = await fetch(`${API_BASE}/api/admin/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, isUpdate: !!editingCategory }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return payload;
    },
    onSuccess: (data) => {
      toast.success(`Category "${data.name.en || data.id}" saved successfully!`);
      queryClient.invalidateQueries({ queryKey: ["product_categories"] });
      queryClient.invalidateQueries({ queryKey: ["product_marketplace_categories"] });
      queryClient.invalidateQueries({ queryKey: ["product_marketplace/main/categories"] });
      setCatModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save category.");
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (catId: string) => {
      // 1. Direct Firestore delete (Primary + Mirrors)
      try {
        const docRef = doc(db, "product_marketplace", "main", "categories", catId);
        await deleteDoc(docRef);
        await deleteDoc(doc(db, "categories", catId)).catch(() => {});
        await deleteDoc(doc(db, "product_categories", catId)).catch(() => {});
      } catch (clientErr) {
        console.warn("Client Firestore category delete warning:", clientErr);
      }

      // 2. Backend REST API
      const res = await fetch(`${API_BASE}/api/admin/categories/${encodeURIComponent(catId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return catId;
    },
    onSuccess: (deletedId) => {
      toast.success(`Category "${deletedId}" deleted.`);
      queryClient.invalidateQueries({ queryKey: ["product_categories"] });
      queryClient.invalidateQueries({ queryKey: ["product_marketplace_categories"] });
      queryClient.invalidateQueries({ queryKey: ["product_marketplace/main/categories"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete category.");
    },
  });

  // 4. Subcategory Mutations (Save / Delete)
  const saveSubCategoryMutation = useMutation({
    mutationFn: async (payload: SubCategoryItem) => {
      // 1. If editing and ID was changed, remove the old document key
      if (editingSubCategory && editingSubCategory.id !== payload.id) {
        try {
          await deleteDoc(doc(db, "product_marketplace", "main", "subcategories", editingSubCategory.id));
          await fetch(`${API_BASE}/api/admin/subcategories/${encodeURIComponent(editingSubCategory.id)}`, { method: "DELETE" }).catch(() => {});
        } catch (cleanupErr) {
          console.warn("Cleanup old subcategory id warning:", cleanupErr);
        }
      }

      // 2. Direct Firestore write
      try {
        const docRef = doc(db, "product_marketplace", "main", "subcategories", payload.id);
        await setDoc(docRef, { ...payload, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (clientErr) {
        console.warn("Client Firestore subcategory save warning:", clientErr);
      }

      // 3. Backend REST API
      const res = await fetch(`${API_BASE}/api/admin/subcategories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, isUpdate: !!editingSubCategory }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return payload;
    },
    onSuccess: (data) => {
      toast.success(`Subcategory "${data.name.en || data.id}" saved successfully!`);
      queryClient.invalidateQueries({ queryKey: ["product_subcategories"] });
      queryClient.invalidateQueries({ queryKey: ["product_marketplace_subcategories"] });
      queryClient.invalidateQueries({ queryKey: ["product_marketplace/main/subcategories"] });
      setSubModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save subcategory.");
    },
  });

  const deleteSubCategoryMutation = useMutation({
    mutationFn: async (subId: string) => {
      // 1. Direct Firestore delete
      try {
        const docRef = doc(db, "product_marketplace", "main", "subcategories", subId);
        await deleteDoc(docRef);
      } catch (clientErr) {
        console.warn("Client Firestore subcategory delete warning:", clientErr);
      }

      // 2. Backend REST API
      const res = await fetch(`${API_BASE}/api/admin/subcategories/${encodeURIComponent(subId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return subId;
    },
    onSuccess: (deletedId) => {
      toast.success(`Subcategory "${deletedId}" deleted.`);
      queryClient.invalidateQueries({ queryKey: ["product_subcategories"] });
      queryClient.invalidateQueries({ queryKey: ["product_marketplace_subcategories"] });
      queryClient.invalidateQueries({ queryKey: ["product_marketplace/main/subcategories"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete subcategory.");
    },
  });

  // Handlers for Category Modal
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCatId("");
    setCatImage("");
    setCatOrder(categories.length + 1);
    setCatNames(emptyMultiLang());
    setCatFileError(null);
    setIsCatIdCustom(false);
    setCatModalOpen(true);
  };

  const handleOpenEditCategory = (c: CategoryItem) => {
    setEditingCategory(c);
    setCatId(c.id);
    const existingImg = c.image || c.imageUrl || c.icon || c.iconUrl || c.categoryImage || "";
    setCatImage(convertToDirectImageUrl(existingImg));
    setCatOrder(c.order || 1);
    setCatNames({ ...c.name });
    setCatFileError(null);
    setIsCatIdCustom(true);
    setCatModalOpen(true);
  };

  const handleCopyCategoryEnglishToAll = () => {
    const en = catNames.en.trim();
    if (!en) {
      toast.error("Please enter English name first.");
      return;
    }
    setCatNames({
      en,
      hi: catNames.hi || en,
      id: catNames.id || en,
      kn: catNames.kn || en,
      mr: catNames.mr || en,
      pa: catNames.pa || en,
      ta: catNames.ta || en,
    });
    toast.success("Copied English name to Hindi, Indonesian, Kannada, Marathi, Punjabi, Tamil!");
  };

  // Category Image Upload with strict PDF / non-image rejection
  // Supports both Backend API upload and direct Firebase Storage client SDK fallback
  const handleCategoryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const val = validateImageFile(file);

    if (!val.valid || isPdf) {
      const errMsg = isPdf
        ? "PDF files are not supported! Please upload only image files (PNG, JPG, WebP)."
        : (val.error || "Unsupported file format! Please upload only image files.");
      setCatFileError(errMsg);
      toast.error(errMsg);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setCatFileError(null);
    setIsUploadingCatImage(true);

    try {
      // Process to 1:1 square & compress
      const processed = await processSquareImage(file, false);
      let uploadedUrl = "";

      // 1. Try Backend Upload
      try {
        const res = await fetch(`${API_BASE}/api/admin/upload-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64: processed.base64,
            filename: processed.file.name,
            contentType: processed.file.type || "image/webp",
            folder: "product_marketplace/categories",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.url) {
            uploadedUrl = data.url;
          }
        }
      } catch (backendErr) {
        console.warn("Backend upload failed, trying direct Firebase Storage SDK:", backendErr);
      }

      // 2. Direct Firebase Storage Client SDK Fallback
      if (!uploadedUrl) {
        try {
          const safeName = `${Date.now()}_${processed.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const storageRef = ref(storage, `product_marketplace/categories/${safeName}`);
          await uploadBytes(storageRef, processed.file, {
            contentType: processed.file.type || "image/webp",
          });
          uploadedUrl = await getDownloadURL(storageRef);
        } catch (storageErr: any) {
          console.error("Direct storage SDK upload failed:", storageErr);
        }
      }

      if (uploadedUrl) {
        const direct = convertToDirectImageUrl(uploadedUrl);
        setCatImage(direct);
        toast.success("Category image uploaded successfully!");
      } else {
        toast.error("Upload failed. You can paste a direct image URL or Google Drive link below.");
      }
    } catch (err: any) {
      toast.error("Upload error: " + (err.message || "Failed to upload image."));
    } finally {
      setIsUploadingCatImage(false);
    }
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catId.trim()) {
      toast.error("Category ID is required (e.g. cat_breeding).");
      return;
    }
    if (!catNames.en.trim()) {
      toast.error("English Category Name is required.");
      return;
    }

    const finalImageUrl = convertToDirectImageUrl(catImage.trim());
    const payload: CategoryItem = {
      id: catId.trim(),
      image: finalImageUrl,
      imageUrl: finalImageUrl,
      icon: finalImageUrl,
      iconUrl: finalImageUrl,
      categoryImage: finalImageUrl,
      name: {
        en: catNames.en.trim(),
        hi: catNames.hi.trim() || catNames.en.trim(),
        id: catNames.id.trim() || catNames.en.trim(),
        kn: catNames.kn.trim() || catNames.en.trim(),
        mr: catNames.mr.trim() || catNames.en.trim(),
        pa: catNames.pa.trim() || catNames.en.trim(),
        ta: catNames.ta.trim() || catNames.en.trim(),
      },
      order: Number(catOrder) || 1,
    };

    saveCategoryMutation.mutate(payload);
  };

  // Handlers for Subcategory Modal
  const handleOpenAddSubCategory = (defaultParentId?: string) => {
    setEditingSubCategory(null);
    setSubId("");
    setSubParentId(defaultParentId || categories[0]?.id || "cat_breeding");
    setSubOrder(subcategories.length + 1);
    setSubNames(emptyMultiLang());
    setIsSubIdCustom(false);
    setSubPrefix("subcat_");
    setSubModalOpen(true);
  };

  const handleOpenEditSubCategory = (s: SubCategoryItem) => {
    setEditingSubCategory(s);
    setSubId(s.id);
    setSubParentId(s.categoryId);
    setSubOrder(s.order || 1);
    setSubNames({ ...s.name });
    setIsSubIdCustom(true);
    setSubPrefix(s.id.startsWith("sub_") ? "sub_" : "subcat_");
    setSubModalOpen(true);
  };

  const handleCopySubEnglishToAll = () => {
    const en = subNames.en.trim();
    if (!en) {
      toast.error("Please enter English name first.");
      return;
    }
    setSubNames({
      en,
      hi: subNames.hi || en,
      id: subNames.id || en,
      kn: subNames.kn || en,
      mr: subNames.mr || en,
      pa: subNames.pa || en,
      ta: subNames.ta || en,
    });
    toast.success("Copied English subcategory name to all regional languages!");
  };

  const handleSaveSubCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subId.trim()) {
      toast.error("Subcategory ID is required (e.g. subcat_ai_equipment).");
      return;
    }
    if (!subParentId.trim()) {
      toast.error("Please select a parent Category.");
      return;
    }
    if (!subNames.en.trim()) {
      toast.error("English Subcategory Name is required.");
      return;
    }

    const payload: SubCategoryItem = {
      id: subId.trim(),
      categoryId: subParentId.trim(),
      name: {
        en: subNames.en.trim(),
        hi: subNames.hi.trim() || subNames.en.trim(),
        id: subNames.id.trim() || subNames.en.trim(),
        kn: subNames.kn.trim() || subNames.en.trim(),
        mr: subNames.mr.trim() || subNames.en.trim(),
        pa: subNames.pa.trim() || subNames.en.trim(),
        ta: subNames.ta.trim() || subNames.en.trim(),
      },
      order: Number(subOrder) || 1,
    };

    saveSubCategoryMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Product Categories & Subcategories"
        description="Create, edit, and organize multi-language marketplace categories (/product_marketplace/main/categories) and subcategories (/product_marketplace/main/subcategories) with instant Firebase synchronization."
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            asChild
            className="h-9 gap-1.5 rounded-xl border-dashed"
          >
            <Link to="/marketplace/products">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              <span>Back to Products</span>
            </Link>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              refetchCategories();
              refetchSubcategories();
              toast.success("Refreshed categories and subcategories!");
            }}
            className="h-9 gap-1.5 rounded-xl"
            title="Refresh from Firestore"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenAddCategory}
            className="h-9 gap-1.5 rounded-xl bg-primary shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span>New Main Category</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenAddSubCategory()}
            className="h-9 gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>New Subcategory</span>
          </Button>
        </div>
      </PageHeader>

      {/* Main Tabs Container */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="bg-muted/60 p-1 rounded-2xl h-11 border">
            <TabsTrigger value="categories" className="rounded-xl text-xs gap-1.5 font-bold data-[state=active]:bg-background data-[state=active]:shadow-xs px-4">
              <Layers className="h-4 w-4 text-primary" />
              <span>Main Categories</span>
              <Badge variant="secondary" className="text-[10px] ml-1 bg-primary/10 text-primary">
                {categories.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="subcategories" className="rounded-xl text-xs gap-1.5 font-bold data-[state=active]:bg-background data-[state=active]:shadow-xs px-4">
              <FolderTree className="h-4 w-4 text-emerald-600" />
              <span>Subcategories</span>
              <Badge variant="secondary" className="text-[10px] ml-1 bg-emerald-500/10 text-emerald-600">
                {subcategories.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2.5 flex-wrap">
            {activeTab === "subcategories" && (
              <Select value={selectedParentFilter} onValueChange={setSelectedParentFilter}>
                <SelectTrigger className="w-48 text-xs h-9 rounded-xl bg-background">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-xl">
                  <SelectItem value="all">All Categories ({subcategories.length})</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name.en} ({categorySubCountMap.get(c.id) || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-xs rounded-xl bg-background"
              />
            </div>
          </div>
        </div>

        {/* TAB 1: MAIN CATEGORIES */}
        <TabsContent value="categories" className="space-y-4">
          <Card className="rounded-3xl border shadow-xs overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-16 text-center font-bold">Order</TableHead>
                  <TableHead className="w-20">Image</TableHead>
                  <TableHead>Category Name (Multilingual)</TableHead>
                  <TableHead>Document ID</TableHead>
                  <TableHead className="text-center">Subcategories</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell colSpan={6} className="h-16 bg-muted/20" />
                    </TableRow>
                  ))
                ) : filteredCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                      No main categories found. Click "+ New Main Category" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCategories.map((c) => {
                    const subCount = categorySubCountMap.get(c.id) || 0;
                    return (
                      <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                        {/* Order */}
                        <TableCell className="text-center">
                          <span className="font-mono text-xs font-bold bg-muted px-2 py-0.5 rounded-lg border">
                            #{c.order}
                          </span>
                        </TableCell>

                        {/* Image */}
                        <TableCell>
                          {c.image ? (
                            <div
                              className="relative group h-12 w-12 rounded-xl overflow-hidden border bg-muted cursor-pointer shadow-xs"
                              onClick={() => setPreviewImage({ url: formatImageUrl(c.image || ""), title: c.name.en })}
                              title="Click to zoom image"
                            >
                              <img
                                src={formatImageUrl(c.image)}
                                alt={c.name.en}
                                className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                onError={(e: any) => {
                                  e.target.onerror = null;
                                  e.target.src = "https://placehold.co/100x100?text=Category";
                                }}
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Eye className="h-3.5 w-3.5" />
                              </div>
                            </div>
                          ) : (
                            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center text-xs font-bold border border-primary/20">
                              <Layers className="h-5 w-5" />
                            </div>
                          )}
                        </TableCell>

                        {/* Name (Multilingual preview) */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-bold text-sm text-foreground flex items-center gap-2">
                              <span>{c.name.en}</span>
                              {c.name.hi && c.name.hi !== c.name.en && (
                                <span className="text-xs text-muted-foreground font-normal">
                                  ({c.name.hi})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground">
                              {c.name.kn && <span className="bg-muted px-1.5 py-0.2 rounded border">kn: {c.name.kn}</span>}
                              {c.name.mr && <span className="bg-muted px-1.5 py-0.2 rounded border">mr: {c.name.mr}</span>}
                              {c.name.pa && <span className="bg-muted px-1.5 py-0.2 rounded border">pa: {c.name.pa}</span>}
                              {c.name.ta && <span className="bg-muted px-1.5 py-0.2 rounded border">ta: {c.name.ta}</span>}
                              {c.name.id && c.name.id !== c.name.en && <span className="bg-muted px-1.5 py-0.2 rounded border">id: {c.name.id}</span>}
                            </div>
                          </div>
                        </TableCell>

                        {/* Document ID */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-mono text-xs text-primary font-bold">
                            <span>{c.id}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(c.id);
                                toast.success(`Copied ID: ${c.id}`);
                              }}
                              className="text-muted-foreground hover:text-foreground"
                              title="Copy ID"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </TableCell>

                        {/* Subcategories count */}
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedParentFilter(c.id);
                              setActiveTab("subcategories");
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline bg-primary/10 px-2.5 py-1 rounded-lg"
                            title="View subcategories under this category"
                          >
                            <span>{subCount} subcategories</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenAddSubCategory(c.id)}
                              className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 gap-1 rounded-xl"
                              title="Add subcategory directly under this"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Add Sub</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEditCategory(c)}
                              className="h-8 w-8 p-0 rounded-xl"
                              title="Edit Category"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete category "${c.name.en}" (${c.id})?`)) {
                                  deleteCategoryMutation.mutate(c.id);
                                }
                              }}
                              className="h-8 w-8 p-0 rounded-xl text-destructive hover:bg-destructive/10"
                              title="Delete Category"
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
        </TabsContent>

        {/* TAB 2: SUBCATEGORIES */}
        <TabsContent value="subcategories" className="space-y-4">
          <Card className="rounded-3xl border shadow-xs overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-16 text-center font-bold">Order</TableHead>
                  <TableHead>Subcategory Name (Multilingual)</TableHead>
                  <TableHead>Parent Category (categoryId)</TableHead>
                  <TableHead>Document ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell colSpan={5} className="h-16 bg-muted/20" />
                    </TableRow>
                  ))
                ) : filteredSubcategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                      No subcategories found. Click "+ New Subcategory" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubcategories.map((s) => {
                    const parentCat = categories.find((c) => c.id === s.categoryId);
                    return (
                      <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
                        {/* Order */}
                        <TableCell className="text-center">
                          <span className="font-mono text-xs font-bold bg-muted px-2 py-0.5 rounded-lg border">
                            #{s.order}
                          </span>
                        </TableCell>

                        {/* Name (Multilingual preview) */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-bold text-sm text-foreground flex items-center gap-2">
                              <span>{s.name.en}</span>
                              {s.name.hi && s.name.hi !== s.name.en && (
                                <span className="text-xs text-muted-foreground font-normal">
                                  ({s.name.hi})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground">
                              {s.name.kn && <span className="bg-muted px-1.5 py-0.2 rounded border">kn: {s.name.kn}</span>}
                              {s.name.mr && <span className="bg-muted px-1.5 py-0.2 rounded border">mr: {s.name.mr}</span>}
                              {s.name.pa && <span className="bg-muted px-1.5 py-0.2 rounded border">pa: {s.name.pa}</span>}
                              {s.name.ta && <span className="bg-muted px-1.5 py-0.2 rounded border">ta: {s.name.ta}</span>}
                              {s.name.id && s.name.id !== s.name.en && <span className="bg-muted px-1.5 py-0.2 rounded border">id: {s.name.id}</span>}
                            </div>
                          </div>
                        </TableCell>

                        {/* Parent Category */}
                        <TableCell>
                          <Badge variant="outline" className="font-semibold gap-1 text-xs py-1">
                            <Layers className="h-3 w-3 text-primary" />
                            <span>{parentCat?.name.en || s.categoryId}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">({s.categoryId})</span>
                          </Badge>
                        </TableCell>

                        {/* Document ID */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-mono text-xs text-primary font-bold">
                            <span>{s.id}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(s.id);
                                toast.success(`Copied ID: ${s.id}`);
                              }}
                              className="text-muted-foreground hover:text-foreground"
                              title="Copy ID"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEditSubCategory(s)}
                              className="h-8 w-8 p-0 rounded-xl"
                              title="Edit Subcategory"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete subcategory "${s.name.en}" (${s.id})?`)) {
                                  deleteSubCategoryMutation.mutate(s.id);
                                }
                              }}
                              className="h-8 w-8 p-0 rounded-xl text-destructive hover:bg-destructive/10"
                              title="Delete Subcategory"
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
        </TabsContent>
      </Tabs>

      {/* MODAL 1: CREATE / EDIT MAIN CATEGORY */}
      <Dialog open={catModalOpen} onOpenChange={setCatModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <span>{editingCategory ? `Edit Category: ${editingCategory.name.en}` : "Create New Main Category"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Saved directly to Firestore path: <code>/product_marketplace/main/categories/{catId || "{id}"}</code>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCategory} className="space-y-4 pt-2">
            {/* Red Alert Pop-up for Unsupported Files / PDF Upload attempts */}
            {catFileError && (
              <div className="p-3 rounded-xl bg-destructive/10 border-2 border-destructive/40 flex items-center justify-between gap-2 text-xs text-destructive font-bold animate-shake">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                  <span>{catFileError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCatFileError(null)}
                  className="text-destructive/80 hover:text-destructive text-sm font-bold px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Basic ID & Order */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/20 p-3.5 rounded-2xl border">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Category ID (String) *</Label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const clean = catId.replace(/^cat_/, "");
                        const base = clean || catNames.en.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 35);
                        setCatId(base ? `cat_${base}` : "cat_");
                        setIsCatIdCustom(true);
                      }}
                      className="text-[10px] text-primary hover:underline font-mono"
                      title="Add cat_ prefix"
                    >
                      + cat_
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => {
                        const slug = catNames.en.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 35);
                        setCatId(slug ? `cat_${slug}` : "cat_");
                        setIsCatIdCustom(false);
                      }}
                      className="text-[10px] text-emerald-600 hover:underline font-semibold"
                      title="Regenerate ID from English Name"
                    >
                      Auto from Name
                    </button>
                  </div>
                </div>
                <Input
                  value={catId}
                  onChange={(e) => {
                    setCatId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
                    setIsCatIdCustom(true);
                  }}
                  placeholder="e.g. cat_breeding"
                  className="font-mono text-xs"
                  required
                />
                <span className="text-[10px] text-muted-foreground">Unique doc key: formatted with <code>cat_</code> prefix (fully editable).</span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Display Order (Number) *</Label>
                <Input
                  type="number"
                  value={catOrder}
                  onChange={(e) => setCatOrder(parseInt(e.target.value, 10) || 1)}
                  className="text-xs"
                  required
                />
                <span className="text-[10px] text-muted-foreground">Ordering priority on mobile app</span>
              </div>
            </div>

            {/* Category Image */}
            <div className="space-y-2 bg-muted/20 p-3.5 rounded-2xl border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-primary" /> Category Icon / Image (1:1 Ratio image)
                </Label>
                <label className="cursor-pointer text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  <Upload className="h-3 w-3" />
                  <span>{isUploadingCatImage ? "Uploading..." : "Upload Image"}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={handleCategoryImageUpload}
                    disabled={isUploadingCatImage}
                  />
                </label>
              </div>

              <Input
                value={catImage}
                onChange={(e) => setCatImage(e.target.value)}
                onBlur={() => setCatImage((prev) => convertToDirectImageUrl(prev.trim()))}
                placeholder="Paste Google Drive link, Firebase Storage URL, or upload image above..."
                className="text-xs font-mono"
              />

              {catImage && (
                <div className="flex items-center gap-3 pt-1">
                  <div className="h-14 w-14 rounded-xl overflow-hidden border bg-background shrink-0 shadow-xs">
                    <img
                      src={convertToDirectImageUrl(catImage) || formatImageUrl(catImage)}
                      alt="Category Preview"
                      className="h-full w-full object-cover"
                      onError={(e: any) => {
                        e.target.onerror = null;
                        e.target.src = "https://placehold.co/100x100?text=Error";
                      }}
                    />
                  </div>
                  <div className="space-y-0.5 text-xs">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Direct Image Stream Ready</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Compatible with Flutter mobile app, Android, iOS & Web (Google Drive links are automatically converted).
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Multilingual Names Map */}
            <div className="space-y-3 bg-muted/20 p-3.5 rounded-2xl border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Multilingual Name Map (<code>name</code>) *
                </Label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-primary">English (<code>en</code>) *</Label>
                  <Input
                    value={catNames.en}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCatNames((prev) => ({ ...prev, en: val }));
                      if (!isCatIdCustom || !catId || catId.startsWith("cat_")) {
                        const slug = val.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 35);
                        setCatId(slug ? `cat_${slug}` : "");
                      }
                    }}
                    placeholder="e.g. Breeding"
                    className="text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Hindi (<code>hi</code>) *</Label>
                  <Input
                    value={catNames.hi}
                    onChange={(e) => setCatNames((prev) => ({ ...prev, hi: e.target.value }))}
                    placeholder="e.g. प्रजनन"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Indonesian (<code>id</code>)</Label>
                  <Input
                    value={catNames.id}
                    onChange={(e) => setCatNames((prev) => ({ ...prev, id: e.target.value }))}
                    placeholder="e.g. Pembiakan"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Kannada (<code>kn</code>)</Label>
                  <Input
                    value={catNames.kn}
                    onChange={(e) => setCatNames((prev) => ({ ...prev, kn: e.target.value }))}
                    placeholder="e.g. ಪ್ರಜನನ"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Marathi (<code>mr</code>)</Label>
                  <Input
                    value={catNames.mr}
                    onChange={(e) => setCatNames((prev) => ({ ...prev, mr: e.target.value }))}
                    placeholder="e.g. प्रजनन"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Punjabi (<code>pa</code>)</Label>
                  <Input
                    value={catNames.pa}
                    onChange={(e) => setCatNames((prev) => ({ ...prev, pa: e.target.value }))}
                    placeholder="e.g. ਪ੍ਰਜਨਨ"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] font-semibold">Tamil (<code>ta</code>)</Label>
                  <Input
                    value={catNames.ta}
                    onChange={(e) => setCatNames((prev) => ({ ...prev, ta: e.target.value }))}
                    placeholder="e.g. இனப்பெருக்கம்"
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCatModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveCategoryMutation.isPending} className="bg-primary gap-1">
                {saveCategoryMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{editingCategory ? "Update Category" : "Create Category"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: CREATE / EDIT SUBCATEGORY */}
      <Dialog open={subModalOpen} onOpenChange={setSubModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-emerald-600" />
              <span>{editingSubCategory ? `Edit Subcategory: ${editingSubCategory.name.en}` : "Create New Subcategory"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Saved directly to Firestore path: <code>/product_marketplace/main/subcategories/{subId || "{id}"}</code>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSubCategory} className="space-y-4 pt-2">
            {/* Parent Category & Basic ID */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/20 p-3.5 rounded-2xl border">
              <div className="space-y-1 sm:col-span-1">
                <Label className="text-xs font-semibold">Parent Category *</Label>
                <Select value={subParentId} onValueChange={setSubParentId}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 rounded-xl">
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name.en} ({c.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Subcategory ID *</Label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSubPrefix("sub_");
                        const clean = subId.replace(/^(subcat_|sub_|cat_)/, "");
                        const base = clean || subNames.en.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 35);
                        setSubId(base ? `sub_${base}` : "sub_");
                        setIsSubIdCustom(true);
                      }}
                      className={`text-[10px] font-mono px-1 rounded transition-colors ${
                        subPrefix === "sub_" ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Use sub_ prefix"
                    >
                      sub_
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSubPrefix("subcat_");
                        const clean = subId.replace(/^(subcat_|sub_|cat_)/, "");
                        const base = clean || subNames.en.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 35);
                        setSubId(base ? `subcat_${base}` : "subcat_");
                        setIsSubIdCustom(true);
                      }}
                      className={`text-[10px] font-mono px-1 rounded transition-colors ${
                        subPrefix === "subcat_" ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Use subcat_ prefix"
                    >
                      subcat_
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => {
                        const slug = subNames.en.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 35);
                        setSubId(slug ? `${subPrefix}${slug}` : subPrefix);
                        setIsSubIdCustom(false);
                      }}
                      className="text-[10px] text-emerald-600 hover:underline font-semibold"
                      title="Regenerate ID from English Name"
                    >
                      Auto
                    </button>
                  </div>
                </div>
                <Input
                  value={subId}
                  onChange={(e) => {
                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_");
                    setSubId(val);
                    setIsSubIdCustom(true);
                    if (val.startsWith("sub_")) setSubPrefix("sub_");
                    else if (val.startsWith("subcat_")) setSubPrefix("subcat_");
                  }}
                  placeholder="e.g. subcat_ai_equipment or sub_ai_equipment"
                  className="font-mono text-xs"
                  required
                />
                <span className="text-[10px] text-muted-foreground">Unique doc key: fully editable with <code>sub_</code> or <code>subcat_</code> prefix.</span>
              </div>

              <div className="space-y-1 sm:col-span-1">
                <Label className="text-xs font-semibold">Order *</Label>
                <Input
                  type="number"
                  value={subOrder}
                  onChange={(e) => setSubOrder(parseInt(e.target.value, 10) || 1)}
                  className="text-xs"
                  required
                />
              </div>
            </div>

            {/* Multilingual Names Map */}
            <div className="space-y-3 bg-muted/20 p-3.5 rounded-2xl border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Multilingual Name Map (<code>name</code>) *
                </Label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-emerald-600">English (<code>en</code>) *</Label>
                  <Input
                    value={subNames.en}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSubNames((prev) => ({ ...prev, en: val }));
                      if (!isSubIdCustom || !subId || subId.startsWith("subcat_") || subId.startsWith("sub_")) {
                        const slug = val.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 35);
                        setSubId(slug ? `${subPrefix}${slug}` : "");
                      }
                    }}
                    placeholder="e.g. AI Equipment"
                    className="text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Hindi (<code>hi</code>) *</Label>
                  <Input
                    value={subNames.hi}
                    onChange={(e) => setSubNames((prev) => ({ ...prev, hi: e.target.value }))}
                    placeholder="e.g. AI उपकरण"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Indonesian (<code>id</code>)</Label>
                  <Input
                    value={subNames.id}
                    onChange={(e) => setSubNames((prev) => ({ ...prev, id: e.target.value }))}
                    placeholder="e.g. Peralatan AI"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Kannada (<code>kn</code>)</Label>
                  <Input
                    value={subNames.kn}
                    onChange={(e) => setSubNames((prev) => ({ ...prev, kn: e.target.value }))}
                    placeholder="e.g. AI ಉಪಕರಣಗಳು"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Marathi (<code>mr</code>)</Label>
                  <Input
                    value={subNames.mr}
                    onChange={(e) => setSubNames((prev) => ({ ...prev, mr: e.target.value }))}
                    placeholder="e.g. कृत्रिम रेतन उपकरणे"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Punjabi (<code>pa</code>)</Label>
                  <Input
                    value={subNames.pa}
                    onChange={(e) => setSubNames((prev) => ({ ...prev, pa: e.target.value }))}
                    placeholder="e.g. AI ਉਪਕਰਣ"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] font-semibold">Tamil (<code>ta</code>)</Label>
                  <Input
                    value={subNames.ta}
                    onChange={(e) => setSubNames((prev) => ({ ...prev, ta: e.target.value }))}
                    placeholder="e.g. AI உபகரணங்கள்"
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setSubModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveSubCategoryMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                {saveSubCategoryMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{editingSubCategory ? "Update Subcategory" : "Create Subcategory"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Image Zoom Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-3xl bg-black border-none">
          {previewImage && (
            <div className="relative flex flex-col items-center justify-center p-4">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[80vh] max-w-full object-contain rounded-xl"
              />
              <div className="mt-3 text-center text-xs font-semibold text-white/90">
                {previewImage.title}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

