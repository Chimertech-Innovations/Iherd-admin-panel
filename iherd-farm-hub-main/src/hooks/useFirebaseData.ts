import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, collectionGroup, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://iherdadminpanel.onrender.com";

export function useFirebaseCollectionGroup<T>(collectionId: string) {
  const isMockKey = !import.meta.env.VITE_FIREBASE_API_KEY || 
                    import.meta.env.VITE_FIREBASE_API_KEY === "mock-api-key" || 
                    import.meta.env.VITE_FIREBASE_API_KEY.includes("YOUR_ACTUAL");

  return useQuery({
    queryKey: ["collectionGroup", collectionId],
    queryFn: async () => {
      if (isMockKey) {
        return [];
      }
      try {
        const colRef = collectionGroup(db, collectionId);
        const snapshot = await getDocs(colRef);
        if (snapshot.empty) {
          return [];
        }
        const results: any[] = [];
        snapshot.forEach((doc) => {
          results.push({ id: doc.id, _path: doc.ref.path, ...doc.data() });
        });
        return results as T[];
      } catch (error) {
        console.warn(`Error fetching collectionGroup ${collectionId} from Firebase:`, error);
        return [];
      }
    },
    placeholderData: [],
    staleTime: 10_000,
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
    placeholderData: [],
    staleTime: 10_000,
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
    staleTime: 10_000,
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
    staleTime: 10_000,
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
    staleTime: 10_000,
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
    staleTime: 15_000,
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
      await setDoc(docRef, { ...product, id: docId, updatedAt: new Date().toISOString() }, { merge: true });
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
    onSuccess: () => {
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
    staleTime: 10_000,
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



