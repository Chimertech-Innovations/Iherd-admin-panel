import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, collectionGroup, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getApiBaseUrlSync } from "../lib/apiClient";

export const API_BASE = getApiBaseUrlSync();

export function useFirebaseCollectionGroup<T>(collectionId: string) {
  const isMockKey = !import.meta.env.VITE_FIREBASE_API_KEY || 
                    import.meta.env.VITE_FIREBASE_API_KEY === "mock-api-key" || 
                    import.meta.env.VITE_FIREBASE_API_KEY.includes("YOUR_ACTUAL");

  return useQuery({
    queryKey: ["collectionGroup", collectionId],
    queryFn: async () => {
      if (!isMockKey) {
        try {
          const colRef = collectionGroup(db, collectionId);
          const snapshot = await getDocs(colRef);
          if (!snapshot.empty) {
            const results: any[] = [];
            snapshot.forEach((doc) => {
              results.push({ id: doc.id, _path: doc.ref.path, ...doc.data() });
            });
            if (results.length > 0) return results as T[];
          }
        } catch (error) {
          console.warn(`Client Firebase error for collectionGroup ${collectionId}, attempting backend fallback:`, error);
        }
      }

      // Backend Admin SDK Fallback (handles security rules and indexes with Admin privileges)
      try {
        const base = getApiBaseUrlSync();
        const res = await fetch(`${base}/api/admin/collection-group/${collectionId}`).catch(() =>
          fetch(`/api/admin/collection-group/${collectionId}`)
        );

        if (res && res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data) && json.data.length > 0) {
            return json.data as T[];
          }
        }
      } catch (e) {}

      return [] as T[];
    },
    placeholderData: (previousData) => previousData || [],
    staleTime: 600_000,
    gcTime: 1800_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useFirebaseCollection<T>(collectionPath: string) {
  const isMockKey = !import.meta.env.VITE_FIREBASE_API_KEY || 
                    import.meta.env.VITE_FIREBASE_API_KEY === "mock-api-key" || 
                    import.meta.env.VITE_FIREBASE_API_KEY.includes("YOUR_ACTUAL");

  return useQuery({
    queryKey: [collectionPath],
    queryFn: async () => {
      if (isMockKey) {
        return [];
      }
      try {
        const segments = collectionPath.split("/").filter(Boolean);
        const colRef = collection(db, segments[0], ...segments.slice(1));
        const snapshot = await getDocs(colRef);
        if (snapshot.empty) {
          return [];
        }
        const results: any[] = [];
        snapshot.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() });
        });
        return results as T[];
      } catch (error) {
        console.warn(`Error fetching ${collectionPath} from Firebase:`, error);
        return [];
      }
    },
    placeholderData: (previousData) => previousData || [],
    staleTime: 600_000,
    gcTime: 1800_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useFirebaseDoc<T>(collectionPath: string, docId: string) {
  const isMockKey = !import.meta.env.VITE_FIREBASE_API_KEY || 
                    import.meta.env.VITE_FIREBASE_API_KEY === "mock-api-key" || 
                    import.meta.env.VITE_FIREBASE_API_KEY.includes("YOUR_ACTUAL");

  return useQuery({
    queryKey: [collectionPath, docId],
    queryFn: async () => {
      if (isMockKey || !docId) {
        return null;
      }
      try {
        const segments = collectionPath.split("/").filter(Boolean);
        const docRef = doc(db, segments[0], ...segments.slice(1), docId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          return null;
        }
        return { id: snapshot.id, ...snapshot.data() } as T;
      } catch (error) {
        console.warn(`Error fetching ${collectionPath}/${docId} from Firebase:`, error);
        return null;
      }
    },
    enabled: !!docId,
    initialData: null,
    staleTime: 600_000,
    gcTime: 1800_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

// Token Advance Hook
export interface TokenAdvanceRates {
  cow: number;
  buffalo: number;
  goat: number;
  sheep: number;
  [key: string]: any;
}

export function useTokenAdvance() {
  const queryClient = useQueryClient();

  const query = useQuery<{ rates: TokenAdvanceRates; items: any[] }>({
    queryKey: ["token-advance"],
    queryFn: async () => {
      // Try Backend API first, fallback to Firestore client
      try {
        const res = await fetch(`${API_BASE}/api/admin/token-advance`);
        if (res.ok) {
          const data = await res.json();
          return {
            rates: data.rates || { cow: 200, buffalo: 250, goat: 100, sheep: 50 },
            items: data.items || [],
          };
        }
      } catch (err) {
        console.warn("Backend token advance fetch error, trying client SDK:", err);
      }

      try {
        const colRef = collection(db, "token-advance");
        const snap = await getDocs(colRef);
        let rates: TokenAdvanceRates = { cow: 200, buffalo: 250, goat: 100, sheep: 50 };
        const items: any[] = [];
        snap.forEach((d) => {
          const data = d.data();
          items.push({ id: d.id, ...data });
          if (d.id === "token-advance" || d.id === "default") {
            rates = { ...rates, ...data };
          }
        });
        return { rates, items };
      } catch (err) {
        console.warn("Client SDK token advance error:", err);
        return { rates: { cow: 200, buffalo: 250, goat: 100, sheep: 50 }, items: [] };
      }
    },
    staleTime: 600_000,
    gcTime: 1800_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const updateRates = useMutation({
    mutationFn: async (rates: Partial<TokenAdvanceRates>) => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/token-advance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rates),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("Backend update token advance failed, trying client SDK:", err);
      }

      // Fallback to client SDK
      const docRef = doc(db, "token-advance", "token-advance");
      await setDoc(docRef, rates, { merge: true });
      return { success: true, rates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["token-advance"] });
    },
  });

  return { ...query, updateRates };
}

// Coupons Hook
export interface Coupon {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED" | string;
  value: number;
  minOrder?: number;
  maxDiscount?: number;
  active: boolean;
  allowedFlow?: string;
  expiresAt?: any;
  expiresAtFormatted?: string;
  excludedProductIds?: string[];
  productIds?: string[];
  usedUserIds?: string[];
  usedCount?: number;
  [key: string]: any;
}

export function useCoupons() {
  const queryClient = useQueryClient();

  const query = useQuery<Coupon[]>({
    queryKey: ["coupons_code"],
    queryFn: async () => {
      // Try backend first
      try {
        const res = await fetch(`${API_BASE}/api/admin/coupons`);
        if (res.ok) {
          const data = await res.json();
          if (data.coupons && data.coupons.length > 0) {
            return data.coupons;
          }
        }
      } catch (err) {
        console.warn("Backend coupons fetch error, trying client SDK:", err);
      }

      // Fallback to Firestore client SDK
      try {
        const colRef = collection(db, "product_marketplace", "main", "coupons_code");
        const snap = await getDocs(colRef);
        const results: Coupon[] = [];
        snap.forEach((d) => {
          const data = d.data();
          let expiresAtFormatted = null;
          if (data.expiresAt?.toDate) {
            expiresAtFormatted = data.expiresAt.toDate().toISOString();
          } else if (data.expiresAt?._seconds) {
            expiresAtFormatted = new Date(data.expiresAt._seconds * 1000).toISOString();
          } else if (data.expiresAt?.seconds) {
            expiresAtFormatted = new Date(data.expiresAt.seconds * 1000).toISOString();
          } else if (typeof data.expiresAt === "string") {
            expiresAtFormatted = data.expiresAt;
          }

          results.push({
            id: d.id,
            ...data,
            code: data.code || d.id,
            active: data.active !== false,
            type: data.type || "PERCENT",
            value: data.value || 0,
            expiresAtFormatted,
            usedCount: Array.isArray(data.usedUserIds) ? data.usedUserIds.filter(Boolean).length : 0,
          } as Coupon);
        });
        return results;
      } catch (err) {
        console.warn("Client SDK coupons fetch error:", err);
        return [];
      }
    },
    placeholderData: [],
    staleTime: 600_000,
    gcTime: 1800_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const saveCoupon = useMutation({
    mutationFn: async (coupon: Partial<Coupon>) => {
      const code = (coupon.code || coupon.id || "").trim().toUpperCase();
      try {
        const res = await fetch(`${API_BASE}/api/admin/coupons`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...coupon, code }),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("Backend coupon save error, trying client SDK:", err);
      }

      const docRef = doc(db, "product_marketplace", "main", "coupons_code", code);
      await setDoc(docRef, { ...coupon, code }, { merge: true });
      return { success: true, id: code };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons_code"] });
      queryClient.invalidateQueries({ queryKey: ["product_marketplace/main/coupons_code"] });
    },
  });

  const toggleCouponStatus = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/coupons/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active }),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("Backend coupon toggle error, trying client SDK:", err);
      }

      const docRef = doc(db, "product_marketplace", "main", "coupons_code", id);
      await setDoc(docRef, { active }, { merge: true });
      return { success: true, id, active };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons_code"] });
      queryClient.invalidateQueries({ queryKey: ["product_marketplace/main/coupons_code"] });
    },
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/coupons/${id}`, {
          method: "DELETE",
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("Backend delete coupon error, trying client SDK:", err);
      }

      const docRef = doc(db, "product_marketplace", "main", "coupons_code", id);
      await deleteDoc(docRef);
      return { success: true, id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons_code"] });
      queryClient.invalidateQueries({ queryKey: ["product_marketplace/main/coupons_code"] });
    },
  });

  return { ...query, saveCoupon, toggleCouponStatus, deleteCoupon };
}

// Best Sellers Hook
export function useBestSellers() {
  const queryClient = useQueryClient();

  const query = useQuery<any[]>({
    queryKey: ["bestSellers"],
    queryFn: async () => {
      // Try backend first
      try {
        const res = await fetch(`${API_BASE}/api/admin/best-sellers`);
        if (res.ok) {
          const data = await res.json();
          if (data.bestSellers && data.bestSellers.length > 0) {
            return data.bestSellers;
          }
        }
      } catch (err) {
        console.warn("Backend best sellers fetch error:", err);
      }

      // Fallback: Query products with bestSeller == true
      try {
        const colRef = collection(db, "product_marketplace", "main", "products");
        const snap = await getDocs(colRef);
        const results: any[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (data.bestSeller || data.isBestSeller) {
            results.push({ id: d.id, ...data, bestSeller: true });
          }
        });
        return results;
      } catch (err) {
        console.warn("Client SDK best sellers error:", err);
        return [];
      }
    },
    placeholderData: [],
    staleTime: 600_000,
    gcTime: 1800_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const toggleBestSeller = useMutation({
    mutationFn: async ({ productId, isBestSeller }: { productId: string; isBestSeller: boolean }) => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/best-sellers/toggle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, isBestSeller }),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("Backend toggle best seller error, trying client SDK:", err);
      }

      const prodRef = doc(db, "product_marketplace", "main", "products", productId);
      await updateDoc(prodRef, { bestSeller: isBestSeller, isBestSeller });
      return { success: true, productId, bestSeller: isBestSeller };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bestSellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin_products"] });
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
      queryClient.invalidateQueries({ queryKey: ["product_marketplace/main/products"] });
      queryClient.invalidateQueries({ queryKey: ["product_marketplace/main/best_seller"] });
    },
  });

  return { ...query, toggleBestSeller };
}

// Full Admin Products Hook
export function useAdminProducts() {
  const queryClient = useQueryClient();

  const query = useQuery<any[]>({
    queryKey: ["product_marketplace/main/products"],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/products`);
        if (res.ok) {
          const data = await res.json();
          if (data.products && data.products.length > 0) {
            return data.products;
          }
        }
      } catch (err) {
        console.warn("Backend products fetch error, trying client SDK:", err);
      }

      try {
        const colRef = collection(db, "product_marketplace", "main", "products");
        const snap = await getDocs(colRef);
        const results: any[] = [];
        snap.forEach((d) => {
          results.push({ id: d.id, ...d.data() });
        });
        return results;
      } catch (err) {
        console.warn("Client SDK products error:", err);
        return [];
      }
    },
    staleTime: 600_000,
    gcTime: 1800_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const saveProduct = useMutation({
    mutationFn: async (product: any) => {
      const prodId = product.id;
      // Try backend first (bypasses Firestore client security rules for admin updates)
      try {
        const url = prodId ? `${API_BASE}/api/admin/products/${prodId}` : `${API_BASE}/api/admin/products`;
        const method = prodId ? "PUT" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(product),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("Backend product save error, trying client SDK:", err);
      }

      const docId = prodId || `PRD-${Date.now()}`;
      const docRef = doc(db, "product_marketplace", "main", "products", docId);
      const payloadToSave: any = { ...product, id: docId, updatedAt: new Date().toISOString() };
      if (payloadToSave.deliveryConfig === null) {
        payloadToSave.deliveryConfig = deleteField();
      }
      await setDoc(docRef, payloadToSave, { merge: true });
      return { success: true, id: docId, product };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_marketplace/main/products"] });
      queryClient.invalidateQueries({ queryKey: ["bestSellers"] });
    },
  });

  const updateProductPrice = useMutation({
    mutationFn: async ({ productId, price, mrp }: { productId: string; price: number; mrp?: number }) => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/products/${productId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ price, mrp }),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("Backend price update error, trying client SDK:", err);
      }

      const prodRef = doc(db, "product_marketplace", "main", "products", productId);
      const updateData: any = { price, updatedAt: new Date().toISOString() };
      if (mrp !== undefined) updateData.mrp = mrp;
      await updateDoc(prodRef, updateData);
      return { success: true, productId, price, mrp };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_marketplace/main/products"] });
      queryClient.invalidateQueries({ queryKey: ["bestSellers"] });
    },
  });

  const deleteProduct = useMutation({
    onMutate: async (productId: string) => {
      await queryClient.cancelQueries({ queryKey: ["product_marketplace/main/products"] });
      const previous = queryClient.getQueryData<any[]>(["product_marketplace/main/products"]);
      if (previous) {
        queryClient.setQueryData(
          ["product_marketplace/main/products"],
          previous.filter((p) => p.id !== productId)
        );
      }
      return { previous };
    },
    mutationFn: async (productId: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/products/${productId}`, {
          method: "DELETE",
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("Backend product delete error, trying client SDK:", err);
      }

      const prodRef = doc(db, "product_marketplace", "main", "products", productId);
      await deleteDoc(prodRef);
      return { success: true, id: productId };
    },
    onError: (_err, _productId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["product_marketplace/main/products"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["product_marketplace/main/products"] });
      queryClient.invalidateQueries({ queryKey: ["bestSellers"] });
    },
  });

  return { ...query, saveProduct, updateProductPrice, deleteProduct };
}

export function useAdminBanners() {
  const queryClient = useQueryClient();

  const query = useQuery<any[]>({
    queryKey: ["banners"],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/banners`);
        if (res.ok) {
          const data = await res.json();
          if (data.banners && Array.isArray(data.banners)) {
            return data.banners;
          }
        }
      } catch (err) {
        console.warn("Backend banners fetch error, trying client SDK:", err);
      }

      try {
        const colRef = collection(db, "banners");
        const snap = await getDocs(colRef);
        const results: any[] = [];
        snap.forEach((d) => {
          results.push({ id: d.id, ...d.data() });
        });
        results.sort((a, b) => (Number(a.priority) || 999) - (Number(b.priority) || 999));
        return results;
      } catch (err) {
        console.warn("Client SDK banners error:", err);
        return [];
      }
    },
    staleTime: 600_000,
    gcTime: 1800_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const saveBanner = useMutation({
    mutationFn: async (banner: {
      id?: string;
      imageUrl: string;
      actionType: string;
      actionValue: string;
      priority: number;
      isActive: boolean;
    }) => {
      const isEdit = Boolean(banner.id);
      const docId = banner.id || `banner${Date.now()}`;

      try {
        const url = isEdit ? `${API_BASE}/api/admin/banners/${docId}` : `${API_BASE}/api/admin/banners`;
        const method = isEdit ? "PUT" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...banner, id: docId }),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("Backend banner save error, trying client SDK:", err);
      }

      const bannerRef = doc(db, "banners", docId);
      const payload: any = {
        imageUrl: banner.imageUrl || "",
        actionType: banner.actionType || "product",
        actionValue: banner.actionValue || "",
        priority: Number(banner.priority) || 1,
        isActive: Boolean(banner.isActive),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(bannerRef, payload, { merge: true });
      return { success: true, id: docId, banner: payload };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banners"] });
    },
  });

  const toggleBannerActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/banners/${id}/toggle`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive }),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("Backend banner toggle error, trying client SDK:", err);
      }

      const bannerRef = doc(db, "banners", id);
      await updateDoc(bannerRef, {
        isActive,
        updatedAt: new Date().toISOString(),
      });
      return { success: true, id, isActive };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banners"] });
    },
  });

  const deleteBanner = useMutation({
    mutationFn: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/banners/${id}`, {
          method: "DELETE",
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("Backend banner delete error, trying client SDK:", err);
      }

      const bannerRef = doc(db, "banners", id);
      await deleteDoc(bannerRef);
      return { success: true, id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banners"] });
    },
  });

  return { ...query, banners: query.data || [], saveBanner, toggleBannerActive, deleteBanner };
}

// ==========================================
// 1. SHIPPING CONFIG HOOK & TYPES
// Document: product_marketplace/main/shipping_config/config
// ==========================================
export interface ShippingSlab {
  min: number;
  max: number;
  price: number;
}

export interface ZonePricing {
  extraPricePerKg: number;
  slabs: ShippingSlab[];
}

export interface ShippingConfig {
  zones: Record<string, string[]>;
  pricing: Record<string, ZonePricing>;
  delivery_time: Record<string, Record<string, string>>;
  updatedAt?: any;
}

export function useShippingConfig() {
  const queryClient = useQueryClient();

  const query = useQuery<ShippingConfig>({
    queryKey: ["shipping-config"],
    queryFn: async () => {
      const base = getApiBaseUrlSync();
      // 1. Try Backend API
      try {
        const res = await fetch(`${base}/api/admin/shipping-config`);
        if (res.ok) {
          const data = await res.json();
          if (data?.config) return data.config as ShippingConfig;
        }
      } catch (err) {
        console.warn("Backend shipping config fetch error, trying client SDK:", err);
      }

      // 2. Client SDK Fallback
      try {
        const docRef = doc(db, "product_marketplace", "main", "shipping_config", "config");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return snap.data() as ShippingConfig;
        }
      } catch (err) {
        console.warn("Client SDK shipping config error:", err);
      }

      return {
        zones: {},
        pricing: {},
        delivery_time: {},
      };
    },
    staleTime: 60_000,
    gcTime: 900_000,
    refetchOnWindowFocus: false,
  });

  const updateConfig = useMutation({
    onMutate: async (newConfig: ShippingConfig) => {
      await queryClient.cancelQueries({ queryKey: ["shipping-config"] });
      const previous = queryClient.getQueryData<ShippingConfig>(["shipping-config"]);
      queryClient.setQueryData(["shipping-config"], newConfig);
      return { previous };
    },
    mutationFn: async (newConfig: ShippingConfig) => {
      const base = getApiBaseUrlSync();
      let clientSaved = false;
      let backendSaved = false;
      let lastErr: any = null;

      // Clean duplicate state codes in every zone
      const cleanedZones: Record<string, string[]> = {};
      if (newConfig.zones) {
        Object.keys(newConfig.zones).forEach((zKey) => {
          cleanedZones[zKey] = Array.from(new Set(newConfig.zones[zKey] || []));
        });
      }
      const payload: ShippingConfig = {
        ...newConfig,
        zones: cleanedZones,
        updatedAt: new Date().toISOString(),
      };

      // 1. Direct write via Client SDK (instant persistence)
      try {
        const docRef = doc(db, "product_marketplace", "main", "shipping_config", "config");
        await setDoc(docRef, payload, { merge: true });
        clientSaved = true;
      } catch (err) {
        lastErr = err;
        console.warn("Client SDK shipping update error:", err);
      }

      // 2. Admin backend API (Admin SDK bypasses client permissions)
      try {
        const res = await fetch(`${base}/api/admin/shipping-config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          backendSaved = true;
          const data = await res.json().catch(() => null);
          return { success: true, config: data?.config || payload };
        } else {
          const errText = await res.text().catch(() => "");
          lastErr = new Error(`Server returned ${res.status}: ${errText}`);
        }
      } catch (err) {
        lastErr = err;
        console.warn("Backend shipping config update error:", err);
      }

      if (!clientSaved && !backendSaved) {
        throw lastErr || new Error("Failed to save shipping configuration to Firebase");
      }

      return { success: true, config: payload };
    },
    onError: (err, newConfig, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["shipping-config"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-config"] });
    },
  });

  return { ...query, config: query.data, updateConfig };
}

// ==========================================
// 2. COMBOS PRODUCTS HOOK & TYPES
// Collection: product_marketplace/main/combos
// ==========================================
export interface ComboProduct {
  id: string;
  name: Record<string, string> | string;
  price: number;
  mrp: number;
  gst?: number;
  quantity: number;
  quantityUnit?: Record<string, string> | string;
  weight: number;
  weightUnit?: Record<string, string> | string;
  categoryId?: string;
  subCategoryId?: string;
  isActive: boolean;
  bestSeller?: boolean;
  thumbnailUrl?: string;
  imageUrls?: string[];
  specification?: { specification?: Record<string, string> } | Record<string, string> | string;
  instructionsToUse?: Record<string, string[]> | any;
  productIngredients?: Record<string, string[]> | any;
  storageCondition?: Record<string, string[]> | any;
  best_before?: Record<string, string> | string;
  sellerName?: Record<string, string> | string;
  sellerType?: string;
  sellerLogo?: string;
  createdAt?: any;
  updatedAt?: any;
}

export function useCombos() {
  const queryClient = useQueryClient();

  const query = useQuery<ComboProduct[]>({
    queryKey: ["marketplace-combos"],
    queryFn: async () => {
      const base = getApiBaseUrlSync();
      // 1. Try Backend API
      try {
        const res = await fetch(`${base}/api/admin/combos`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.combos)) return data.combos as ComboProduct[];
        }
      } catch (err) {
        console.warn("Backend combos fetch error, trying client SDK:", err);
      }

      // 2. Client SDK Fallback
      try {
        const colRef = collection(db, "product_marketplace", "main", "combos");
        const snap = await getDocs(colRef);
        const combos: ComboProduct[] = [];
        snap.forEach((d) => {
          combos.push({ id: d.id, ...d.data() } as ComboProduct);
        });
        return combos;
      } catch (err) {
        console.warn("Client SDK combos error:", err);
        return [];
      }
    },
    staleTime: 60_000,
    gcTime: 900_000,
    refetchOnWindowFocus: false,
  });

  const saveCombo = useMutation({
    onMutate: async (comboData: Partial<ComboProduct>) => {
      await queryClient.cancelQueries({ queryKey: ["marketplace-combos"] });
      const previous = queryClient.getQueryData<ComboProduct[]>(["marketplace-combos"]) || [];
      const comboId = comboData.id || `COMBO--${Date.now()}`;
      const payload: ComboProduct = {
        id: comboId,
        name: comboData.name || "Combo Product",
        price: Number(comboData.price) || 0,
        mrp: Number(comboData.mrp) || Number(comboData.price) || 0,
        gst: Number(comboData.gst) !== undefined && !isNaN(Number(comboData.gst)) ? Number(comboData.gst) : 5,
        quantity: Number(comboData.quantity) || 1,
        quantityUnit: comboData.quantityUnit,
        weight: Number(comboData.weight) || 0,
        weightUnit: comboData.weightUnit,
        categoryId: comboData.categoryId || "cat_disease_management",
        subCategoryId: comboData.subCategoryId,
        thumbnailUrl: comboData.thumbnailUrl,
        imageUrls: comboData.imageUrls,
        isActive: comboData.isActive !== false,
        bestSeller: Boolean(comboData.bestSeller),
        specification: comboData.specification,
        instructionsToUse: comboData.instructionsToUse,
        productIngredients: comboData.productIngredients,
        storageCondition: comboData.storageCondition,
        best_before: comboData.best_before,
        sellerName: comboData.sellerName,
        sellerType: comboData.sellerType || "seller",
        sellerLogo: comboData.sellerLogo,
        updatedAt: new Date().toISOString(),
      };

      const existingIndex = previous.findIndex((c) => c.id === comboId);
      let updated: ComboProduct[];
      if (existingIndex >= 0) {
        updated = [...previous];
        updated[existingIndex] = { ...updated[existingIndex], ...payload };
      } else {
        updated = [payload, ...previous];
      }
      queryClient.setQueryData(["marketplace-combos"], updated);
      return { previous };
    },
    mutationFn: async (comboData: Partial<ComboProduct>) => {
      const base = getApiBaseUrlSync();
      const comboId = comboData.id || `COMBO--${Date.now()}`;
      const payload = {
        ...comboData,
        id: comboId,
        updatedAt: new Date().toISOString(),
      };

      let clientSaved = false;
      let backendSaved = false;
      let lastErr: any = null;

      // Direct write to Firestore
      try {
        const docRef = doc(db, "product_marketplace", "main", "combos", comboId);
        await setDoc(docRef, payload, { merge: true });
        clientSaved = true;
      } catch (clientErr) {
        lastErr = clientErr;
        console.warn("Client SDK save combo failed:", clientErr);
      }

      // Sync with backend API
      try {
        const res = await fetch(`${base}/api/admin/combos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          backendSaved = true;
          const data = await res.json().catch(() => null);
          return { success: true, id: comboId, combo: data?.combo || payload };
        } else {
          const errText = await res.text().catch(() => "");
          lastErr = new Error(`Backend combo save failed: ${res.status} ${errText}`);
        }
      } catch (err) {
        lastErr = err;
        console.warn("Backend save combo failed:", err);
      }

      if (!clientSaved && !backendSaved) {
        throw lastErr || new Error("Failed to save combo product to Firebase");
      }

      return { success: true, id: comboId, combo: payload };
    },
    onError: (err, newCombo, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["marketplace-combos"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-combos"] });
    },
  });

  const deleteCombo = useMutation({
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["marketplace-combos"] });
      const previous = queryClient.getQueryData<ComboProduct[]>(["marketplace-combos"]) || [];
      const updated = previous.filter((c) => c.id !== id);
      queryClient.setQueryData(["marketplace-combos"], updated);
      return { previous };
    },
    mutationFn: async (id: string) => {
      const base = getApiBaseUrlSync();
      let clientDeleted = false;
      let backendDeleted = false;

      try {
        const docRef = doc(db, "product_marketplace", "main", "combos", id);
        await deleteDoc(docRef);
        clientDeleted = true;
      } catch (clientErr) {
        console.warn("Client SDK delete combo failed:", clientErr);
      }

      try {
        const res = await fetch(`${base}/api/admin/combos/${id}`, { method: "DELETE" });
        if (res.ok) backendDeleted = true;
      } catch (err) {
        console.warn("Backend delete combo failed:", err);
      }

      return { success: true, id };
    },
    onError: (err, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["marketplace-combos"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-combos"] });
    },
  });

  const toggleComboActive = useMutation({
    onMutate: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ["marketplace-combos"] });
      const previous = queryClient.getQueryData<ComboProduct[]>(["marketplace-combos"]) || [];
      const updated = previous.map((c) => (c.id === id ? { ...c, isActive } : c));
      queryClient.setQueryData(["marketplace-combos"], updated);
      return { previous };
    },
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const base = getApiBaseUrlSync();
      try {
        const docRef = doc(db, "product_marketplace", "main", "combos", id);
        await updateDoc(docRef, { isActive, updatedAt: new Date().toISOString() });
      } catch (clientErr) {
        console.warn("Client SDK toggle combo failed:", clientErr);
      }

      try {
        await fetch(`${base}/api/admin/combos/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive }),
        });
      } catch (err) {
        console.warn("Backend toggle combo failed:", err);
      }

      return { success: true, id, isActive };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["marketplace-combos"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-combos"] });
    },
  });

  return {
    ...query,
    combos: query.data || [],
    saveCombo,
    deleteCombo,
    toggleComboActive,
  };
}

// ==========================================
// 3. PASHUPRENEUR COURSES HOOK & TYPES
// Collection: pashuprenuer_courses
// ==========================================
export interface PashuprenuerCourse {
  id: string;
  order: number;
  youtubeUrl: string;
  isActive: boolean;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  updatedAt?: any;
}

export function usePashuprenuerCourses() {
  const queryClient = useQueryClient();

  const query = useQuery<PashuprenuerCourse[]>({
    queryKey: ["pashuprenuer-courses"],
    queryFn: async () => {
      const base = getApiBaseUrlSync();
      // 1. Try Backend API (Admin privileges bypass security rules)
      try {
        let res = await fetch(`${base}/api/admin/pashuprenuer-courses`);
        if (!res.ok) {
          res = await fetch(`${base}/api/admin/pashupreneur-courses`);
        }
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.courses)) return data.courses as PashuprenuerCourse[];
        }
      } catch (err) {
        console.warn("Backend pashuprenuer courses fetch error, trying client SDK:", err);
      }

      // 2. Client SDK Fallback
      try {
        const colRef = collection(db, "pashuprenuer_courses");
        const snap = await getDocs(colRef);
        const courses: PashuprenuerCourse[] = [];
        snap.forEach((d) => {
          courses.push({ id: d.id, ...d.data() } as PashuprenuerCourse);
        });
        courses.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
        return courses;
      } catch (err) {
        console.warn("Client SDK pashuprenuer courses error:", err);
        return [];
      }
    },
    staleTime: 60_000,
    gcTime: 900_000,
    refetchOnWindowFocus: false,
  });

  const saveCourse = useMutation({
    onMutate: async (courseData: Partial<PashuprenuerCourse>) => {
      await queryClient.cancelQueries({ queryKey: ["pashuprenuer-courses"] });
      const previous = queryClient.getQueryData<PashuprenuerCourse[]>(["pashuprenuer-courses"]) || [];
      const courseId = courseData.id || `course_${Date.now()}`;
      const payload: PashuprenuerCourse = {
        id: courseId,
        title: courseData.title || `Dairy Entrepreneurship Module #${courseData.order || 1}`,
        description: courseData.description || "",
        order: Number(courseData.order) || 1,
        youtubeUrl: courseData.youtubeUrl || "",
        isActive: courseData.isActive !== false,
        updatedAt: new Date().toISOString(),
      };

      const existingIndex = previous.findIndex((c) => c.id === courseId);
      let updated: PashuprenuerCourse[];
      if (existingIndex >= 0) {
        updated = [...previous];
        updated[existingIndex] = { ...updated[existingIndex], ...payload };
      } else {
        updated = [...previous, payload];
      }
      updated.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

      queryClient.setQueryData(["pashuprenuer-courses"], updated);
      return { previous };
    },
    mutationFn: async (courseData: Partial<PashuprenuerCourse>) => {
      const base = getApiBaseUrlSync();
      const courseId = courseData.id || `course_${Date.now()}`;
      const payload = {
        ...courseData,
        id: courseId,
        order: Number(courseData.order) || 1,
        isActive: courseData.isActive !== false,
        updatedAt: new Date().toISOString(),
      };

      let clientSaved = false;
      let backendSaved = false;
      let lastError: any = null;

      // 1. Direct write to Firestore via Client SDK (instant persistence if authenticated)
      try {
        const docRef = doc(db, "pashuprenuer_courses", courseId);
        await setDoc(docRef, payload, { merge: true });
        clientSaved = true;
      } catch (clientErr) {
        lastError = clientErr;
        console.warn("Client SDK save course failed, syncing to backend:", clientErr);
      }

      // 2. Write to Backend Admin API (Admin privileges bypass all client security rules)
      try {
        let res = await fetch(`${base}/api/admin/pashuprenuer-courses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          res = await fetch(`${base}/api/admin/pashupreneur-courses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }
        if (res.ok) {
          backendSaved = true;
          const data = await res.json().catch(() => null);
          return { success: true, id: courseId, course: data?.course || payload };
        } else {
          const errText = await res.text().catch(() => "");
          lastError = new Error(`Backend response ${res.status}: ${errText}`);
        }
      } catch (err) {
        lastError = err;
        console.warn("Backend save course failed:", err);
      }

      if (!clientSaved && !backendSaved) {
        throw lastError || new Error("Failed to save course to Firebase. Please check backend connection.");
      }

      return { success: true, id: courseId, course: payload };
    },
    onError: (err, newCourse, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["pashuprenuer-courses"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pashuprenuer-courses"] });
    },
  });

  const deleteCourse = useMutation({
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["pashuprenuer-courses"] });
      const previous = queryClient.getQueryData<PashuprenuerCourse[]>(["pashuprenuer-courses"]) || [];
      const updated = previous.filter((c) => c.id !== id);
      queryClient.setQueryData(["pashuprenuer-courses"], updated);
      return { previous };
    },
    mutationFn: async (id: string) => {
      const base = getApiBaseUrlSync();
      let clientDeleted = false;
      let backendDeleted = false;
      let lastError: any = null;

      try {
        const docRef = doc(db, "pashuprenuer_courses", id);
        await deleteDoc(docRef);
        clientDeleted = true;
      } catch (clientErr) {
        lastError = clientErr;
        console.warn("Client SDK delete course failed:", clientErr);
      }

      try {
        let res = await fetch(`${base}/api/admin/pashuprenuer-courses/${id}`, { method: "DELETE" });
        if (!res.ok) {
          res = await fetch(`${base}/api/admin/pashupreneur-courses/${id}`, { method: "DELETE" });
        }
        if (res.ok) {
          backendDeleted = true;
        } else {
          lastError = new Error(`Backend delete error: ${res.status}`);
        }
      } catch (err) {
        lastError = err;
        console.warn("Backend delete course failed:", err);
      }

      if (!clientDeleted && !backendDeleted) {
        throw lastError || new Error("Failed to delete course from Firebase.");
      }

      return { success: true, id };
    },
    onError: (err, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["pashuprenuer-courses"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pashuprenuer-courses"] });
    },
  });

  const toggleCourseActive = useMutation({
    onMutate: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ["pashuprenuer-courses"] });
      const previous = queryClient.getQueryData<PashuprenuerCourse[]>(["pashuprenuer-courses"]) || [];
      const updated = previous.map((c) => (c.id === id ? { ...c, isActive } : c));
      queryClient.setQueryData(["pashuprenuer-courses"], updated);
      return { previous };
    },
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const base = getApiBaseUrlSync();
      let clientUpdated = false;
      let backendUpdated = false;
      let lastError: any = null;

      try {
        const docRef = doc(db, "pashuprenuer_courses", id);
        await updateDoc(docRef, { isActive, updatedAt: new Date().toISOString() });
        clientUpdated = true;
      } catch (clientErr) {
        lastError = clientErr;
        console.warn("Client SDK toggle course failed:", clientErr);
      }

      try {
        let res = await fetch(`${base}/api/admin/pashuprenuer-courses/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive }),
        });
        if (!res.ok) {
          res = await fetch(`${base}/api/admin/pashupreneur-courses/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive }),
          });
        }
        if (res.ok) {
          backendUpdated = true;
        } else {
          lastError = new Error(`Backend toggle error: ${res.status}`);
        }
      } catch (err) {
        lastError = err;
        console.warn("Backend toggle course failed:", err);
      }

      if (!clientUpdated && !backendUpdated) {
        throw lastError || new Error("Failed to update course status in Firebase.");
      }

      return { success: true, id, isActive };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["pashuprenuer-courses"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pashuprenuer-courses"] });
    },
  });

  return {
    ...query,
    courses: query.data || [],
    saveCourse,
    deleteCourse,
    toggleCourseActive,
  };
}



