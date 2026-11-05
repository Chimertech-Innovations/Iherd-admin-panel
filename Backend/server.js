require("dotenv").config();
const express = require("express");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

// Explicit CORS — handles preflight OPTIONS requests that fail during Render cold starts
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  credentials: false,
}));
app.options(/.*/, cors()); // Handle preflight for all routes — regex works in all Express versions

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Keep-alive ping endpoint — frontend pings this to prevent Render from sleeping
app.get("/ping", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Root path handler to check backend status
app.get("/", (req, res) => {
  res.send("iHerd Admin Console Backend API is running successfully!");
});

// Initialize Firebase Admin SDK
const bucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET || "auth-b404a.appspot.com";
try {
  const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || serviceAccount.project_id || "auth-b404a",
      storageBucket: bucketName
    });
    console.log(`Firebase Admin SDK initialized with Storage Bucket: ${bucketName}`);
  } else {
    initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || "auth-b404a",
      storageBucket: bucketName
    });
    console.log(`Firebase Admin SDK initialized using defaults with Project ID: ${process.env.VITE_FIREBASE_PROJECT_ID}`);
  }
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error);
}

const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

// Helper: list all files under a storage prefix with download tokens
async function listFilesUnderPrefix(bucket, prefix) {
  try {
    const [files] = await bucket.getFiles({ prefix });
    return files
      .filter((f) => !f.name.endsWith("/")) // skip folder placeholders
      .map((f) => {
        const token = f.metadata?.metadata?.firebaseStorageDownloadTokens;
        let url;
        if (token) {
          url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(f.name)}?alt=media&token=${token}`;
        } else {
          url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(f.name)}?alt=media`;
        }
        return {
          name: f.name,
          size: f.metadata?.size ? parseInt(f.metadata.size) : 0,
          contentType: f.metadata?.contentType || "application/octet-stream",
          updated: f.metadata?.updated || null,
          url,
        };
      });
  } catch (err) {
    console.warn(`Warning: Could not list files for prefix "${prefix}" on bucket "${bucket.name}":`, err.message);
    return [];
  }
}

// In-memory cache for high-frequency admin reads with SWR (Stale-While-Revalidate)
const memoryCache = new Map();

function getCached(key, ttlMs = 600000) {
  const item = memoryCache.get(key);
  if (!item) return null;
  const age = Date.now() - item.timestamp;
  // If fresh, return data immediately without touching database
  if (age <= ttlMs) {
    return item.data;
  }
  // If stale but within grace window (up to 60 mins), return data for instant response
  if (age <= 60 * 60 * 1000) {
    return item.data;
  }
  memoryCache.delete(key);
  return null;
}

function isCacheFresh(key, ttlMs = 600000) {
  const item = memoryCache.get(key);
  if (!item) return false;
  return (Date.now() - item.timestamp) <= ttlMs;
}

function setCache(key, data) {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

function clearCache(prefix = "") {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}

// REST API: list all Firebase Storage files across all known paths
app.get("/api/admin/storage", async (req, res) => {
  try {
    const cached = getCached("admin_storage", 120000);
    if (cached && !req.query.force) {
      return res.json(cached);
    }

    const defaultBucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET || "auth-b404a.appspot.com";
    const candidateBuckets = [
      defaultBucketName,
      "auth-b404a.firebasestorage.app",
      "auth-b404a.appspot.com"
    ];

    let bucket = getStorage().bucket(defaultBucketName);
    let userImages = [];
    let invoices = [];
    let cattleMarketplace = [];
    let marketplace = [];
    let banners = [];
    let success = false;
    let lastError = null;

    // Try candidate bucket names
    for (const bName of Array.from(new Set(candidateBuckets))) {
      try {
        const testBucket = getStorage().bucket(bName);
        const [files] = await testBucket.getFiles({ maxResults: 1 });
        bucket = testBucket;
        success = true;
        break;
      } catch (bErr) {
        lastError = bErr;
        console.warn(`Bucket check for "${bName}" failed:`, bErr.message);
      }
    }

    if (!success) {
      console.error("All storage bucket attempts failed:", lastError?.message);
      return res.status(403).json({
        error: {
          code: 403,
          message: `Storage permission denied or bucket not found. Ensure the Service Account has 'Storage Admin' or 'Storage Object Viewer' role in Google Cloud IAM. (${lastError?.message})`
        },
        userImages: [],
        invoices: [],
        cattleMarketplace: [],
        marketplace: [],
        banners: [],
        offerBanners: [],
        otherBanners: [],
        totals: { userImages: 0, invoices: 0, cattleMarketplace: 0, marketplace: 0, banners: 0, offerBanners: 0, otherBanners: 0, total: 0 }
      });
    }

    // Concurrently fetch all storage prefixes and Firestore banners metadata
    const [
      uImages,
      invs,
      cattleMkt,
      mkt,
      rawBanners,
      offerSnap,
      adsSnap,
    ] = await Promise.all([
      listFilesUnderPrefix(bucket, "UserImages/"),
      listFilesUnderPrefix(bucket, "invoices/"),
      listFilesUnderPrefix(bucket, "cattle-marketplace/"),
      listFilesUnderPrefix(bucket, "marketplace/"),
      listFilesUnderPrefix(bucket, "banners/"),
      getFirestore().collection("banners").doc("offer_banners").collection("items").get().catch(() => ({ docs: [] })),
      getFirestore().collection("banners").doc("ads_banners").collection("items").get().catch(() => ({ docs: [] })),
    ]);

    userImages = uImages || [];
    invoices = invs || [];
    cattleMarketplace = cattleMkt || [];
    marketplace = mkt || [];
    const validBanners = (rawBanners || []).filter((b) => b && b.name && !b.name.endsWith("/"));

    // Extract Firestore banner image URLs to accurately categorize offer banners vs general banners
    const offerImageUrls = new Set();
    const offerBannersList = [];
    const otherBannersList = [];

    (offerSnap.docs || []).forEach((doc) => {
      const d = doc.data();
      if (d?.imageUrl) offerImageUrls.add(d.imageUrl);
    });

    const adsImageUrls = new Set();
    (adsSnap.docs || []).forEach((doc) => {
      const d = doc.data();
      if (d?.imageUrl) adsImageUrls.add(d.imageUrl);
    });

    // Categorize files found in storage
    validBanners.forEach((b) => {
      const isOffer =
        b.name.includes("offer_banners") ||
        offerImageUrls.has(b.url) ||
        b.name.includes("ad1");
      if (isOffer) {
        offerBannersList.push(b);
      } else {
        otherBannersList.push(b);
      }
    });

    // Include any Firestore banner document if its imageUrl wasn't in the storage scan
    (offerSnap.docs || []).forEach((doc) => {
      const d = doc.data();
      if (d?.imageUrl && !offerBannersList.some((b) => b.url === d.imageUrl)) {
        offerBannersList.push({
          name: `banners/offer_banners/${doc.id}`,
          size: 0,
          contentType: "image/png",
          updated: d.updatedAt || null,
          url: d.imageUrl,
          title: d.title || doc.id,
          actionType: d.actionType,
          actionValue: d.actionValue,
        });
      }
    });

    (adsSnap.docs || []).forEach((doc) => {
      const d = doc.data();
      if (d?.imageUrl && !otherBannersList.some((b) => b.url === d.imageUrl)) {
        otherBannersList.push({
          name: `banners/ads_banners/${doc.id}`,
          size: 0,
          contentType: "image/png",
          updated: d.updatedAt || null,
          url: d.imageUrl,
          title: d.title || doc.id,
          actionType: d.actionType,
          actionValue: d.actionValue,
        });
      }
    });

    const responsePayload = {
      userImages,
      invoices,
      cattleMarketplace,
      marketplace,
      banners: [...offerBannersList, ...otherBannersList],
      offerBanners: offerBannersList,
      otherBanners: otherBannersList,
      totals: {
        userImages: userImages.length,
        invoices: invoices.length,
        cattleMarketplace: cattleMarketplace.length,
        marketplace: marketplace.length,
        banners: offerBannersList.length + otherBannersList.length,
        offerBanners: offerBannersList.length,
        otherBanners: otherBannersList.length,
        total:
          userImages.length +
          invoices.length +
          cattleMarketplace.length +
          marketplace.length +
          offerBannersList.length +
          otherBannersList.length,
      },
    };

    setCache("admin_storage", responsePayload);
    res.json(responsePayload);
  } catch (error) {
    console.error("Error in /api/admin/storage:", error);
    res.status(500).json({ error: error.message });
  }
});

function isSimilarUid(a, b) {
  if (!a || !b) return false;
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return true;
  const n1 = s1.replace(/[1li]/g, "x");
  const n2 = s2.replace(/[1li]/g, "x");
  return n1 === n2;
}

// REST API: get complete connected user data from Firestore subcollections, collections and Storage
app.get("/api/admin/user-full-data/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const phone = req.query.phone || "";
    const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true";
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const cacheKey = `user_full_${userId}_${cleanPhone}`;

    if (!forceRefresh) {
      const cachedData = getCached(cacheKey, 180000);
      if (cachedData) {
        return res.json(cachedData);
      }
    }

    const db = getFirestore();
    const auth = getAuth();

    // 1. Fetch user doc and Auth record with fuzzy ID/email/phone matching
    let userDoc = null;
    let authRecord = null;

    try {
      authRecord = await auth.getUser(userId).catch(() => null);
    } catch (e) {
      // ignore
    }

    try {
      const uSnap = await db.collection("users").doc(userId).get();
      if (uSnap.exists) {
        userDoc = { id: uSnap.id, ...uSnap.data() };
      } else {
        // Search by similarity or fields
        const allUsersSnap = await db.collection("users").get();
        for (const doc of allUsersSnap.docs) {
          const data = doc.data();
          const docId = doc.id;
          const uId = data.uid || "";
          const targetEmail = (authRecord?.email || "").toLowerCase();
          const docEmail = (data.email || "").toLowerCase();
          const docPhone = (data.phoneNumber || data.phone || data.farmer?.farmerPhoneNumber || "").replace(/\D/g, "").slice(-10);

          if (
            isSimilarUid(docId, userId) ||
            isSimilarUid(uId, userId) ||
            (targetEmail && docEmail === targetEmail) ||
            (cleanPhone && docPhone === cleanPhone)
          ) {
            userDoc = { id: doc.id, ...data };
            break;
          }
        }
      }
    } catch (e) {
      console.warn("Could not fetch userDoc:", e.message);
    }

    const resolvedDocId = userDoc?.id || userId;

    // 2. Fetch subcollections under users/{resolvedDocId}
    const subcollections = {};
    try {
      const userRef = db.collection("users").doc(resolvedDocId);
      const subRefs = await userRef.listCollections();
      for (const sub of subRefs) {
        const snap = await sub.get();
        subcollections[sub.id] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      console.warn("Error listing subcollections:", e.message);
    }

    // Extract roles from subcollection 'roles' if present
    const rolesSubcol = subcollections.roles || [];
    const farmerRoleDoc = rolesSubcol.find((r) => r.id === "farmer" || r.role === "farmer" || r.farmerPhoneNumber || r.name) || null;
    const sellerRoleDoc = rolesSubcol.find((r) => r.id === "seller" || r.role === "seller" || r.sellerPhoneNumber) || null;
    const vetRoleDoc = rolesSubcol.find((r) => r.id === "veterinarian" || r.id === "vet" || r.role === "vet" || r.vetPhoneNumber) || null;

    // 3. Fetch nested farms and cattles across all possible paths
    let nestedFarms = [];
    let nestedCattles = [];
    const farmIdSet = new Set();

    const processFarmDoc = async (fDoc, sourcePath) => {
      if (!fDoc || !fDoc.id || farmIdSet.has(fDoc.id)) return;
      farmIdSet.add(fDoc.id);
      const fData = { id: fDoc.id, farmId: fDoc.id, sourcePath, ...fDoc.data() };

      const farmCattles = [];
      // Check cattles under this farm doc (both 'cattles' and 'cattle' subcollections)
      try {
        const [cattlesSnap, cattleSnap] = await Promise.all([
          fDoc.ref.collection("cattles").get().catch(() => ({ docs: [] })),
          fDoc.ref.collection("cattle").get().catch(() => ({ docs: [] })),
        ]);
        const seenCattleIds = new Set();
        [...cattlesSnap.docs, ...cattleSnap.docs].forEach((cd) => {
          if (seenCattleIds.has(cd.id)) return;
          seenCattleIds.add(cd.id);
          const cData = cd.data();
          const cRecord = {
            id: cd.id,
            cattleId: cData.id || cd.id,
            cattleName: cData.cattleName || cData.name || cData.title || (cData.tagNo ? `Cattle ${cData.tagNo}` : `Cattle #${cd.id.slice(-4)}`),
            rfid: cData.tagNo || cData.rfid || cd.id,
            breed: cData.breed?.key || cData.breed || "—",
            species: cData.species || "Cow",
            gender: cData.gender || "female",
            color: cData.color || "—",
            age: cData.age,
            weight: cData.weight,
            height: cData.height,
            milkYield: cData.milkYield,
            parity: cData.parity,
            value: cData.value,
            fatherTagNo: cData.fatherTagNo,
            motherTagNo: cData.motherTagNo,
            insurance: cData.insurance,
            onSale: cData.onSale,
            faceView: cData.faceViewImagePath || cData.faceView,
            leftView: cData.leftViewImagePath || cData.leftView,
            rightView: cData.rightViewImagePath || cData.rightView,
            muzzleView: cData.muzzleViewImagePath || cData.muzzleView,
            udderView: cData.udderViewImagePath || cData.udderView,
            bottomView: cData.topViewImagePath || cData.bottomView || cData.topview,
            farmerView: cData.farmerViewImagePath || cData.farmerView,
            createdAt: cData.createdAt,
            ownerUid: resolvedDocId,
            farmId: fDoc.id,
            source: "nested_farm_cattle",
            ...cData,
          };
          farmCattles.push(cRecord);
          nestedCattles.push(cRecord);
        });
      } catch (e) {
        console.warn(`Error fetching cattles under farm ${fDoc.id}:`, e.message);
      }
      fData.cattles = farmCattles;
      fData.cattleCount = farmCattles.length;
      nestedFarms.push(fData);
    };

    try {
      // Check /users/{uid}/roles/farmer/farms
      const farmerRoleFarmSnap = await db
        .collection("users")
        .doc(resolvedDocId)
        .collection("roles")
        .doc("farmer")
        .collection("farms")
        .get();
      for (const fDoc of farmerRoleFarmSnap.docs) {
        await processFarmDoc(fDoc, `/users/${resolvedDocId}/roles/farmer/farms`);
      }

      // Check /users/{uid}/farms
      const userDirectFarmSnap = await db
        .collection("users")
        .doc(resolvedDocId)
        .collection("farms")
        .get();
      for (const fDoc of userDirectFarmSnap.docs) {
        await processFarmDoc(fDoc, `/users/${resolvedDocId}/farms`);
      }

      // Check /farmers/{uid}/farms
      const farmersDirectFarmSnap = await db
        .collection("farmers")
        .doc(resolvedDocId)
        .collection("farms")
        .get();
      for (const fDoc of farmersDirectFarmSnap.docs) {
        await processFarmDoc(fDoc, `/farmers/${resolvedDocId}/farms`);
      }

      // Fallback & comprehensive check: collectionGroup("farms") for this user or phone
      const groupFarmsSnap = await db.collectionGroup("farms").get().catch(() => ({ docs: [] }));
      for (const fDoc of groupFarmsSnap.docs) {
        const path = fDoc.ref.path;
        const fData = fDoc.data();
        const owner = fData.ownerUid || fData.userId || "";
        const matchesUser =
          isSimilarUid(owner, userId) ||
          isSimilarUid(owner, resolvedDocId) ||
          path.includes(`/users/${resolvedDocId}/`) ||
          path.includes(`/users/${userId}/`) ||
          path.includes(`/farmers/${resolvedDocId}/`) ||
          path.includes(`/farmers/${userId}/`) ||
          (cleanPhone && fData.farmPhoneNumber && fData.farmPhoneNumber.replace(/\D/g, "").slice(-10) === cleanPhone);

        if (matchesUser) {
          await processFarmDoc(fDoc, path);
        }
      }

      // Also check inline farm objects in userDoc (if any)
      if (userDoc?.farms && typeof userDoc.farms === "object") {
        const farmEntries = Array.isArray(userDoc.farms) ? userDoc.farms : Object.values(userDoc.farms);
        farmEntries.forEach((fo, idx) => {
          if (fo && typeof fo === "object" && (fo.farmName || fo.name || fo.animal || fo.village)) {
            const fid = fo.id || fo.farmId || `user-farm-${idx}`;
            if (!farmIdSet.has(fid)) {
              farmIdSet.add(fid);
              nestedFarms.push({ id: fid, farmId: fid, sourcePath: `/users/${resolvedDocId}/farms`, ...fo });
            }
          }
        });
      }
    } catch (e) {
      console.warn("Error fetching nested farms:", e.message);
    }

    const farmsList = [...nestedFarms, ...(subcollections.farms || [])];
    let farmDoc = farmsList[0] || null;
    let farmerDoc = farmerRoleDoc || userDoc?.farmer || (userDoc?.farms && typeof userDoc.farms === "object" && !Array.isArray(userDoc.farms) ? userDoc.farms : null) || null;
    let sellerDoc = sellerRoleDoc || userDoc?.seller || null;
    let vetDoc = vetRoleDoc || userDoc?.veterinarian || userDoc?.vet || null;

    if (!farmDoc && farmerDoc) {
      farmDoc = {
        name: farmerDoc.farmName || (farmerDoc.name ? `${farmerDoc.name}'s Dairy Farm` : "Registered Dairy Farm"),
        address: farmerDoc.address || farmerDoc.village || "—",
        village: farmerDoc.village || "—",
        taluk: farmerDoc.taluk || "—",
        postoffice: farmerDoc.postoffice || "—",
        district: farmerDoc.district || "—",
        state: farmerDoc.state || "—",
        pincode: farmerDoc.pincode || "—",
        country: farmerDoc.country || "🇮🇳 India",
        farmPhoneNumber: farmerDoc.farmerPhoneNumber || "—",
        farmTechnique: "Modern Dairy Management",
        numberOfAnimals: nestedCattles.length || 1,
      };
    }

    const farmerSubcollections = {};
    try {
      const fSnap = await db.collection("farmers").doc(resolvedDocId).get();
      if (fSnap.exists) {
        farmerDoc = { id: fSnap.id, ...(farmerDoc || {}), ...fSnap.data() };
        const fSubRefs = await db.collection("farmers").doc(resolvedDocId).listCollections();
        for (const sub of fSubRefs) {
          const snap = await sub.get();
          farmerSubcollections[sub.id] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
      } else if (cleanPhone) {
        const fq = await db.collection("farmers").where("phone", "==", cleanPhone).limit(1).get();
        if (!fq.empty) {
          farmerDoc = { id: fq.docs[0].id, ...(farmerDoc || {}), ...fq.docs[0].data() };
        }
      }
    } catch (e) {
      console.warn("Error fetching farmers collection:", e.message);
    }

    try {
      if (!sellerDoc) {
        const sSnap = await db.collection("sellers").doc(resolvedDocId).get();
        if (sSnap.exists) sellerDoc = { id: sSnap.id, ...sSnap.data() };
        else if (cleanPhone) {
          const sq = await db.collection("sellers").where("phone", "==", cleanPhone).limit(1).get();
          if (!sq.empty) sellerDoc = { id: sq.docs[0].id, ...sq.docs[0].data() };
        }
      }
      if (!sellerDoc) {
        const storeSnap = await db.collection("stores").doc(resolvedDocId).get();
        if (storeSnap.exists) sellerDoc = { id: storeSnap.id, ...storeSnap.data() };
      }
    } catch (e) {}

    try {
      if (!vetDoc) {
        const vSnap = await db.collection("vets").doc(resolvedDocId).get();
        if (vSnap.exists) vetDoc = { id: vSnap.id, ...vSnap.data() };
        else if (cleanPhone) {
          const vq = await db.collection("vets").where("phone", "==", cleanPhone).limit(1).get();
          if (!vq.empty) vetDoc = { id: vq.docs[0].id, ...vq.docs[0].data() };
        }
      }
      if (!vetDoc) {
        const vSnap2 = await db.collection("veterinarians").doc(resolvedDocId).get().catch(() => null);
        if (vSnap2 && vSnap2.exists) vetDoc = { id: vSnap2.id, ...vSnap2.data() };
        else if (cleanPhone) {
          const vq2 = await db.collection("veterinarians").where("phone", "==", cleanPhone).limit(1).get().catch(() => ({ empty: true }));
          if (!vq2.empty) vetDoc = { id: vq2.docs[0].id, ...vq2.docs[0].data() };
        }
      }
    } catch (e) {}

    const resolvedPhone = cleanPhone || (farmerDoc?.farmerPhoneNumber || sellerDoc?.sellerPhoneNumber || vetDoc?.vetPhoneNumber || userDoc?.phoneNumber || userDoc?.phone || authRecord?.phoneNumber || "").replace(/\D/g, "").slice(-10);
    const resolvedEmail = (userDoc?.email || authRecord?.email || "").toLowerCase();

    // 4. Fetch seller products if registered as seller
    let sellerProducts = [];
    try {
      const pSnap = await db.collection("product_marketplace").doc("main").collection("products").get();
      sellerProducts = pSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => {
          if (!p) return false;
          const owner = p.sellerId || p.ownerUid || p.userId || p.postedBy || "";
          if (isSimilarUid(owner, userId) || isSimilarUid(owner, resolvedDocId)) return true;
          if (resolvedPhone) {
            const pPhone = (p.sellerPhone || p.phone || "").replace(/\D/g, "").slice(-10);
            if (pPhone && pPhone === resolvedPhone) return true;
          }
          return false;
        });
    } catch (e) {}

    // 4. Fetch cattle from cattle_details AND cattle-marketplace
    let cattleListings = [];
    try {
      const [cdSnap, cmSnap] = await Promise.all([
        db.collection("cattle_details").get().catch(() => ({ docs: [] })),
        db.collection("cattle-marketplace").get().catch(() => ({ docs: [] })),
      ]);

      const isMatchingCattle = (c) => {
        if (!c) return false;
        const owner = c.ownerUid || c.sellerId || c.farmerId || c.userId || c.uid || c.postedBy || "";
        if (isSimilarUid(owner, userId) || isSimilarUid(owner, resolvedDocId)) return true;
        if (resolvedPhone) {
          const cPhone = (c.sellerPhone || c.phone || c.phoneNumber || "").replace(/\D/g, "").slice(-10);
          if (cPhone && cPhone === resolvedPhone) return true;
        }
        return false;
      };

      const cdList = cdSnap.docs.map((d) => ({ id: d.id, source: "cattle_details", ...d.data() })).filter(isMatchingCattle);
      const cmList = cmSnap.docs.map((d) => ({ id: d.id, source: "cattle-marketplace", ...d.data() })).filter(isMatchingCattle);

      const cattleMap = new Map();
      [...cdList, ...cmList].forEach((item) => {
        const key = item.cattleId || item.rfid || item.id;
        if (!cattleMap.has(key)) {
          cattleMap.set(key, item);
        } else {
          const existing = cattleMap.get(key);
          cattleMap.set(key, { ...existing, ...item });
        }
      });

      cattleListings = Array.from(cattleMap.values());
    } catch (e) {
      console.warn("Error fetching cattle:", e.message);
    }

    // Check if subcollections or nested farms have cattle
    if (nestedCattles && nestedCattles.length > 0) {
      nestedCattles.forEach((nc) => {
        const key = nc.cattleId || nc.rfid || nc.id;
        const exists = cattleListings.findIndex((c) => (c.cattleId || c.rfid || c.id) === key);
        if (exists >= 0) {
          cattleListings[exists] = { ...cattleListings[exists], ...nc };
        } else {
          cattleListings.push(nc);
        }
      });
    }
    if (subcollections.cattle) {
      cattleListings = [...cattleListings, ...subcollections.cattle];
    }
    if (farmerSubcollections.cattle) {
      cattleListings = [...cattleListings, ...farmerSubcollections.cattle];
    }

    // Enrich each farm in farmsList with matching cattle from cattleListings
    farmsList.forEach((farm) => {
      const fIds = [farm.id, farm.farmId].filter(Boolean);
      const matchingCattle = cattleListings.filter((c) => fIds.includes(c.farmId));
      const existing = farm.cattles || [];
      const existingIds = new Set(existing.map((c) => c.id || c.cattleId));
      matchingCattle.forEach((mc) => {
        if (!existingIds.has(mc.id || mc.cattleId)) {
          existing.push(mc);
        }
      });
      farm.cattles = existing;
      farm.cattleCount = existing.length;
    });

    // 5. Fetch Storage Invoices Index (to link PDF download URLs to all orders)
    const invoiceMap = new Map();
    try {
      const defaultBucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET || "auth-b404a.appspot.com";
      const bucket = getStorage().bucket(defaultBucketName);
      const invoiceFiles = await listFilesUnderPrefix(bucket, "invoices/");
      invoiceFiles.forEach((f) => {
        if (f.name && f.name.endsWith(".pdf") && f.url) {
          const parts = f.name.split("/");
          const fileName = parts[parts.length - 1].replace(/\.pdf$/i, "").toLowerCase();
          const folderName = (parts[1] || "").toLowerCase();
          if (folderName) invoiceMap.set(folderName, f.url);
          if (fileName) invoiceMap.set(fileName, f.url);
        }
      });
    } catch (e) {
      console.warn("Error indexing invoice files:", e.message);
    }

    // 6. Fetch Cattle Orders (Buyer & Seller perspectives)
    let cattleOrders = [];
    try {
      const [o1, o2, o3, userSubCO, userSubRO] = await Promise.all([
        db.collection("CattleOrders").get().catch(() => ({ docs: [] })),
        db.collection("received_orders").get().catch(() => ({ docs: [] })),
        db.collection("cattle_orders").get().catch(() => ({ docs: [] })),
        db.collection("users").doc(resolvedDocId).collection("CattleOrders").get().catch(() => ({ docs: [] })),
        db.collection("users").doc(resolvedDocId).collection("received_orders").get().catch(() => ({ docs: [] })),
      ]);

      const allCODocs = [...o1.docs, ...o2.docs, ...o3.docs, ...userSubCO.docs, ...userSubRO.docs];
      const seenOrderIds = new Set();

      allCODocs.forEach((doc) => {
        const o = { id: doc.id, ...doc.data() };
        const orderKey = o.orderId || o.id;
        if (seenOrderIds.has(orderKey)) return;

        const buyerUid = (o.userId || o.buyerId || o.farmerId || "").toLowerCase();
        const sellerUid = (o.sellerId || o.ownerUid || "").toLowerCase();
        const targetUid = userId.toLowerCase();
        const targetResolvedUid = resolvedDocId.toLowerCase();

        const matchUid = buyerUid === targetUid || buyerUid === targetResolvedUid || sellerUid === targetUid || sellerUid === targetResolvedUid;
        
        let matchPhone = false;
        if (resolvedPhone) {
          const oPhone = (o.phone || o.phoneNumber || o.customerPhone || o.buyerPhone || o.shippingAddress?.phone || "").replace(/\D/g, "").slice(-10);
          if (oPhone && oPhone === resolvedPhone) matchPhone = true;
        }

        if (matchUid || matchPhone) {
          seenOrderIds.add(orderKey);

          // Match invoice PDF URL from Storage
          const invKey = (o.orderId || o.id || "").toLowerCase();
          const invNoKey = (o.invoiceNo || o.invoiceNumber || "").toLowerCase();
          const invoiceUrl = invoiceMap.get(invKey) || invoiceMap.get(invNoKey) || o.invoiceUrl || o.invoicePath || null;

          const isSale = sellerUid === targetUid || sellerUid === targetResolvedUid;

          const cImgObj = (o.images && typeof o.images === "object" && !Array.isArray(o.images)) ? o.images : {};
          const cFace = o.image || o.imageUrl || o.cattleImage || o.faceViewImage || o.faceView || o.frontView || cImgObj.frontView || cImgObj.faceView || (Array.isArray(o.images) && o.images[0]) || o.leftViewImage || o.rightViewImage || o.cattleDetails?.image || o.cattleDetails?.imageUrl || null;
          const cImages = [
            cFace,
            o.image,
            o.imageUrl,
            o.cattleImage,
            o.faceViewImage,
            o.leftViewImage,
            o.rightViewImage,
            ...(Array.isArray(o.images) ? o.images : []),
            ...(typeof o.images === "object" && o.images ? Object.values(o.images) : []),
            o.cattleDetails?.image,
            o.cattleDetails?.imageUrl,
          ].filter((u) => typeof u === "string" && u.trim().length > 0);
          const uniqueCImages = Array.from(new Set(cImages));

          cattleOrders.push({
            id: o.id,
            orderId: o.orderId || o.id,
            type: isSale ? "Cattle Sale (Received)" : "Cattle Purchase",
            isSale,
            cattleName: o.cattleName || o.name || "Cattle",
            breed: o.breed || "—",
            species: o.species || "Cow",
            tagNo: o.tagNo || o.rfid || o.tagNumber || "—",
            age: o.age || "—",
            milkYield: o.milkYield || "—",
            price: Number(o.price || o.totalAmount || o.amount || 0),
            totalAmount: Number(o.price || o.totalAmount || o.amount || 0),
            status: o.status || "Completed",
            invoiceNumber: o.invoiceNo || o.invoiceNumber || (invoiceUrl ? `INV-${orderKey.slice(-8)}` : "—"),
            invoiceUrl,
            image: cFace,
            images: uniqueCImages,
            createdAt: o.createdAt || o.date || null,
            updatedAt: o.updatedAt || null,
            buyerName: o.buyerName || o.shippingAddress?.name || "—",
            buyerPhone: o.phoneNumber || o.shippingAddress?.phone || "—",
            buyerLocation: o.buyerLocation || (o.shippingAddress ? [o.shippingAddress.line1, o.shippingAddress.line2, o.shippingAddress.district, o.shippingAddress.state, o.shippingAddress.pincode].filter(Boolean).join(", ") : "—"),
            sellerName: o.sellerName || o.owner || "—",
            sellerId: o.sellerId || null,
            shippingAddress: o.shippingAddress || null,
            source: doc.ref.parent.id,
          });
        }
      });

      // Sort newest first
      cattleOrders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } catch (e) {
      console.warn("Error fetching cattle orders:", e.message);
    }

    // 7. Fetch Product Marketplace Orders
    let productOrders = [];
    try {
      const [p1, p2, userSubPO] = await Promise.all([
        db.collection("ProductOrders").get().catch(() => ({ docs: [] })),
        db.collection("product_orders").get().catch(() => ({ docs: [] })),
        db.collection("users").doc(resolvedDocId).collection("ProductOrders").get().catch(() => ({ docs: [] })),
      ]);

      const allPODocs = [...p1.docs, ...p2.docs, ...userSubPO.docs];
      const seenPOIds = new Set();

      allPODocs.forEach((doc) => {
        const po = { id: doc.id, ...doc.data() };
        const poKey = po.orderId || po.id;
        if (seenPOIds.has(poKey)) return;

        const customerUid = (po.userId || po.customerId || po.buyerId || "").toLowerCase();
        const sellerUid = (po.sellerId || po.farmerId || "").toLowerCase();
        const targetUid = userId.toLowerCase();
        const targetResolvedUid = resolvedDocId.toLowerCase();

        const matchUid = customerUid === targetUid || customerUid === targetResolvedUid || sellerUid === targetUid || sellerUid === targetResolvedUid;
        
        let matchPhone = false;
        if (resolvedPhone) {
          const pPhone = (po.phone || po.phoneNumber || po.customerPhone || po.shippingAddress?.phone || "").replace(/\D/g, "").slice(-10);
          if (pPhone && pPhone === resolvedPhone) matchPhone = true;
        }

        if (matchUid || matchPhone) {
          seenPOIds.add(poKey);

          // Match invoice PDF URL from Storage
          const invKey = (po.orderId || po.id || "").toLowerCase();
          const invNoKey = (po.invoiceNumber || po.invoiceNo || "").toLowerCase();
          const invoiceUrl = invoiceMap.get(invKey) || invoiceMap.get(invNoKey) || po.invoiceUrl || po.invoicePath || null;

          const items = Array.isArray(po.items) ? po.items : [];
          const itemsTotal = items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
          const shippingFee = Number(po.shippingFee || 0);
          const totalAmount = Number(po.totalAmount || (itemsTotal > 0 ? itemsTotal + shippingFee : (po.price || po.amount || 0)));

          productOrders.push({
            id: po.id,
            orderId: po.orderId || po.id,
            items,
            itemCount: items.length || 1,
            totalAmount,
            shippingFee,
            discount: Number(po.discount || 0),
            status: po.status || "Ordered",
            invoiceNumber: po.invoiceNumber || po.invoiceNo || (invoiceUrl ? `INV-${poKey.slice(-8)}` : "—"),
            invoiceUrl,
            trackingId: po.trackingId || "—",
            deliveryDate: po.deliveryDate || "Standard Shipping",
            shippingAddress: po.shippingAddress || null,
            createdAt: po.createdAt || null,
            updatedAt: po.updatedAt || null,
            source: doc.ref.parent.id,
          });
        }
      });

      // Sort newest first
      productOrders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } catch (e) {
      console.warn("Error fetching product orders:", e.message);
    }

    // 8. Fetch Token Advances & Cattle Reservation Deposits (Multi-collection scan)
    let tokenAdvances = [];
    try {
      const [tSnap1, tSnap2, tSnap3, userSubTA1, userSubTA2, userSubTA3, paymentsSnap] = await Promise.all([
        db.collection("token-advance").get().catch(() => ({ docs: [] })),
        db.collection("token_advance").get().catch(() => ({ docs: [] })),
        db.collection("token_payments").get().catch(() => ({ docs: [] })),
        db.collection("users").doc(resolvedDocId).collection("token_advance").get().catch(() => ({ docs: [] })),
        db.collection("users").doc(resolvedDocId).collection("token-advance").get().catch(() => ({ docs: [] })),
        db.collection("users").doc(resolvedDocId).collection("token_payments").get().catch(() => ({ docs: [] })),
        db.collection("payments").get().catch(() => ({ docs: [] })),
      ]);

      const seenTokenKeys = new Set();
      const allTADocs = [
        ...tSnap1.docs,
        ...tSnap2.docs,
        ...tSnap3.docs,
        ...userSubTA1.docs,
        ...userSubTA2.docs,
        ...userSubTA3.docs,
      ];

      allTADocs.forEach((doc) => {
        if (doc.id === "token-advance" && !doc.data().userId && !doc.data().farmerId) {
          // Skip global settings doc
          return;
        }

        const t = { id: doc.id, ...doc.data() };
        const u = (t.userId || t.farmerId || t.uid || t.buyerId || "").toLowerCase();
        let match = u === userId.toLowerCase() || u === resolvedDocId.toLowerCase();
        if (!match && resolvedPhone) {
          const tPhone = (t.phone || t.phoneNumber || t.buyerPhone || "").replace(/\D/g, "").slice(-10);
          if (tPhone && tPhone === resolvedPhone) match = true;
        }

        if (match) {
          const orderKey = t.orderId || t.cattleOrderId || t.id;
          if (seenTokenKeys.has(orderKey)) return;
          seenTokenKeys.add(orderKey);

          const invKey = (orderKey || "").toLowerCase();
          const invoiceUrl = invoiceMap.get(invKey) || t.invoiceUrl || null;

          tokenAdvances.push({
            id: t.id,
            orderId: orderKey,
            cattleType: t.cattleType || t.cattleName || t.animal || t.breed || "Livestock Cattle",
            amount: Number(t.amount || t.advanceAmount || t.tokenAmount || t.price || 0),
            balanceAmount: Number(t.balanceAmount || t.remainingAmount || 0),
            totalAmount: Number(t.totalAmount || t.price || 0),
            paymentMethod: t.paymentMethod || t.paymentMode || t.method || "UPI / Token Payment",
            transactionId: t.transactionId || t.paymentId || t.txnId || "—",
            status: t.status || (t.paid ? "Paid" : "Approved"),
            invoiceNumber: t.invoiceNumber || t.invoiceNo || (invoiceUrl ? `INV-${orderKey.slice(-8)}` : "—"),
            invoiceUrl,
            createdAt: t.createdAt || t.date || t.timestamp || null,
            updatedAt: t.updatedAt || null,
          });
        }
      });

      // Also check payments collection for token payments belonging to this user
      paymentsSnap.docs.forEach((doc) => {
        const p = { id: doc.id, ...doc.data() };
        const pType = String(p.type || p.category || "").toLowerCase();
        const isToken = pType.includes("token") || pType.includes("advance") || p.isTokenPayment === true;
        if (!isToken) return;

        const u = (p.userId || p.uid || p.buyerId || "").toLowerCase();
        let match = u === userId.toLowerCase() || u === resolvedDocId.toLowerCase();
        if (!match && resolvedPhone) {
          const pPhone = (p.phone || p.phoneNumber || "").replace(/\D/g, "").slice(-10);
          if (pPhone && pPhone === resolvedPhone) match = true;
        }

        if (match) {
          const orderKey = p.orderId || p.id;
          if (seenTokenKeys.has(orderKey)) return;
          seenTokenKeys.add(orderKey);

          const invKey = (orderKey || "").toLowerCase();
          const invoiceUrl = invoiceMap.get(invKey) || p.invoiceUrl || null;

          tokenAdvances.push({
            id: p.id,
            orderId: orderKey,
            cattleType: p.cattleType || p.animal || p.title || "Livestock Cattle",
            amount: Number(p.amount || p.tokenAmount || p.advanceAmount || 0),
            balanceAmount: Number(p.balanceAmount || 0),
            totalAmount: Number(p.totalAmount || p.amount || 0),
            paymentMethod: p.method || p.paymentMethod || "Direct Payment",
            transactionId: p.transactionId || p.id || "—",
            status: p.status || "Paid",
            invoiceNumber: p.invoiceNumber || (invoiceUrl ? `INV-${orderKey.slice(-8)}` : "—"),
            invoiceUrl,
            createdAt: p.createdAt || p.date || null,
            updatedAt: p.updatedAt || null,
          });
        }
      });

      // Also check cattleOrders if any contain advance/token amounts
      if (Array.isArray(cattleOrders)) {
        cattleOrders.forEach((co) => {
          const tokAmt = Number(co.tokenAmount || co.advanceAmount || 0);
          if (tokAmt > 0) {
            const orderKey = `TA-${co.orderId || co.id}`;
            if (!seenTokenKeys.has(orderKey)) {
              seenTokenKeys.add(orderKey);
              tokenAdvances.push({
                id: orderKey,
                orderId: co.orderId || co.id,
                cattleType: co.cattleName || co.breed || "Livestock Cattle",
                amount: tokAmt,
                totalAmount: Number(co.totalAmount || co.price || 0),
                balanceAmount: Number(co.balanceAmount || 0),
                paymentMethod: co.paymentMethod || "Token Deposit",
                transactionId: co.transactionId || "—",
                status: co.status || "Paid",
                invoiceNumber: co.invoiceNumber || "—",
                invoiceUrl: co.invoiceUrl || null,
                createdAt: co.createdAt || null,
                updatedAt: co.updatedAt || null,
              });
            }
          }
        });
      }

      tokenAdvances.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } catch (e) {
      console.warn("Error fetching token advance:", e.message);
    }

    // 7. Fetch Issues
    let issues = [];
    try {
      const iSnap = await db.collection("issues").get();
      issues = iSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((iss) => {
          if (!iss) return false;
          const u = (iss.userId || iss.uid || "").toLowerCase();
          if (u === userId.toLowerCase() || u === resolvedDocId.toLowerCase()) return true;
          if (resolvedPhone) {
            const iPhone = (iss.userPhone || iss.phone || "").replace(/\D/g, "").slice(-10);
            if (iPhone && iPhone === resolvedPhone) return true;
          }
          if (resolvedEmail && iss.email && iss.email.toLowerCase() === resolvedEmail) return true;
          return false;
        });
    } catch (e) {
      console.warn("Error fetching issues:", e.message);
    }

    // 8. Fetch Storage Files across all user & role directories
    let storageFiles = [];
    try {
      const defaultBucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET || "auth-b404a.appspot.com";
      const bucket = getStorage().bucket(defaultBucketName);
      const prefixes = Array.from(
        new Set([
          `users/${userId}`,
          `users/${resolvedDocId}`,
          `user/${userId}`,
          `user/${resolvedDocId}`,
          `UserImages/${userId}`,
          `UserImages/${resolvedDocId}`,
          `vets/${userId}`,
          `vets/${resolvedDocId}`,
          `veterinarians/${userId}`,
          `veterinarians/${resolvedDocId}`,
          `veterinary/${userId}`,
          `veterinary/${resolvedDocId}`,
          `certificates/${userId}`,
          `certificates/${resolvedDocId}`,
          `degrees/${userId}`,
          `degrees/${resolvedDocId}`,
          `documents/${userId}`,
          `documents/${resolvedDocId}`,
          `kyc/${userId}`,
          `kyc/${resolvedDocId}`,
          `cattle-marketplace/${userId}`,
          `cattle-marketplace/${resolvedDocId}`,
          `marketplace/${userId}`,
          `marketplace/${resolvedDocId}`,
          `farmers/${userId}`,
          `farmers/${resolvedDocId}`,
          `farms/${userId}`,
          `farms/${resolvedDocId}`,
          `invoices/${userId}`,
          `invoices/${resolvedDocId}`,
          ...(resolvedPhone ? [
            `users/${resolvedPhone}`,
            `user/${resolvedPhone}`,
            `UserImages/${resolvedPhone}`,
            `vets/${resolvedPhone}`,
            `veterinarians/${resolvedPhone}`,
            `documents/${resolvedPhone}`,
          ] : [])
        ])
      );
      const nestedFiles = await Promise.all(prefixes.map((p) => listFilesUnderPrefix(bucket, p)));
      const allFiles = nestedFiles.flat();
      const filesMap = new Map();
      allFiles.forEach((file) => {
        if (!file || !file.name) return;
        filesMap.set(file.name, file);
      });
      storageFiles = Array.from(filesMap.values());

      // If user has a FarmImage in storage, link it directly to farmDoc
      const farmImageFile = storageFiles.find((f) => f.name.includes("FarmImage"));
      if (farmImageFile && farmDoc) {
        farmDoc.imagePath = farmImageFile.url;
        const farmIdMatch = farmImageFile.name.split("FarmImage/")[1];
        if (farmIdMatch && (!farmDoc.farmId || farmDoc.farmId.startsWith("FARM-"))) {
          farmDoc.farmId = farmIdMatch;
        }
      }

      // Auto-link storage files to veterinarian profile (vetDoc)
      if (!vetDoc) {
        const hasVetInRoles = rolesSubcol.some((r) => r.id === "veterinarian" || r.id === "vet" || r.role === "vet" || r.vetPhoneNumber) ||
          (userDoc?.roles && Array.isArray(userDoc.roles) && userDoc.roles.some((r) => String(r).toLowerCase().includes("vet"))) ||
          userDoc?.role === "veterinarian" || userDoc?.role === "vet" || userDoc?.isVet === true;
        if (hasVetInRoles) {
          vetDoc = {
            id: resolvedDocId || userId,
            name: userDoc?.name || userDoc?.displayName || "Doctor",
            vetPhoneNumber: resolvedPhone,
            ...userDoc?.veterinarian,
            ...userDoc?.vet,
          };
        }
      }

      if (vetDoc) {
        storageFiles.forEach((f) => {
          const lower = f.name.toLowerCase();
          // Education / Degree Proof
          if (
            (lower.includes("education") || lower.includes("degree") || lower.includes("qualification") || lower.includes("certificate") || lower.includes("diploma") || lower.includes("bvsc") || lower.includes("mvsc")) &&
            (!vetDoc.educationProof || vetDoc.educationProof === "—")
          ) {
            vetDoc.educationProof = f.url;
          }
          // Identity Proof
          if (
            (lower.includes("identity") || lower.includes("id_proof") || lower.includes("idproof") || lower.includes("aadhaar") || lower.includes("aadhar") || lower.includes("pan") || lower.includes("voter")) &&
            (!vetDoc.identityProof || vetDoc.identityProof === "—")
          ) {
            vetDoc.identityProof = f.url;
          }
          // Registration License Proof
          if (
            (lower.includes("registration") || lower.includes("license") || lower.includes("reg_proof") || lower.includes("regproof") || lower.includes("council") || lower.includes("vci")) &&
            (!vetDoc.registrationProof || vetDoc.registrationProof === "—")
          ) {
            vetDoc.registrationProof = f.url;
          }
          // Doctor Profile Photo
          if (
            (lower.includes("doctor") || lower.includes("vet") || lower.includes("profile") || lower.includes("avatar")) &&
            (lower.includes("photo") || lower.includes("image") || lower.includes("pic")) &&
            (!vetDoc.imagePath || vetDoc.imagePath === "—")
          ) {
            vetDoc.imagePath = f.url;
          }
        });
      }
    } catch (e) {
      console.warn("Error fetching storage files:", e.message);
    }

    // 9. Deeply extract all image URLs from all objects
    const allImages = [];
    const seenUrls = new Set();
    const extractUrls = (obj, source = "Profile", title = "Image") => {
      if (!obj) return;
      if (typeof obj === "string") {
        if (obj.startsWith("http") && (obj.includes("firebasestorage") || obj.match(/\.(jpg|jpeg|png|webp|gif|svg)/i))) {
          if (!seenUrls.has(obj)) {
            seenUrls.add(obj);
            allImages.push({ url: obj, source, title });
          }
        }
        return;
      }
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => extractUrls(item, source, `${title} #${idx + 1}`));
        return;
      }
      if (typeof obj === "object") {
        for (const [key, val] of Object.entries(obj)) {
          const lowerKey = key.toLowerCase();
          let s = source;
          let t = key;
          if (lowerKey === "imagepath" || lowerKey === "profileimage" || lowerKey === "photourl" || lowerKey === "avatar") {
            s = "Farmer Profile Photo";
            t = "Profile Image";
          } else if (lowerKey.includes("faceview")) {
            s = "Cattle Face View";
            t = "Face View";
          } else if (lowerKey.includes("leftview")) {
            s = "Cattle Left View";
            t = "Left View";
          } else if (lowerKey.includes("rightview")) {
            s = "Cattle Right View";
            t = "Right View";
          } else if (lowerKey.includes("muzzleview")) {
            s = "Cattle Muzzle View";
            t = "Muzzle View";
          } else if (lowerKey.includes("udderview")) {
            s = "Cattle Udder View";
            t = "Udder View";
          } else if (lowerKey.includes("topview") || lowerKey.includes("bottomview")) {
            s = "Cattle Top/Bottom View";
            t = "Top View";
          } else if (lowerKey.includes("farmerview")) {
            s = "Farmer with Cattle";
            t = "Farmer View";
          } else if (lowerKey.includes("aadhaar") || lowerKey.includes("pan") || lowerKey.includes("kyc")) {
            s = "KYC Document";
            t = key;
          }
          extractUrls(val, s, t);
        }
      }
    };

    extractUrls(userDoc, "User Profile", "Profile Photo");
    extractUrls(farmerDoc, "Farmer Profile", "Farm / Profile");
    extractUrls(sellerDoc, "Seller Profile", "Seller");
    extractUrls(vetDoc, "Veterinarian Profile", "Vet Certificate");
    extractUrls(subcollections, "User Subcollection");
    extractUrls(farmerSubcollections, "Farmer Subcollection");
    extractUrls(cattleListings, "Cattle Listing");
    extractUrls(sellerProducts, "Seller Product");
    storageFiles.forEach((f) => {
      if (f.url && !seenUrls.has(f.url)) {
        seenUrls.add(f.url);
        allImages.push({
          url: f.url,
          source: f.name.includes("cattle") ? "Cattle Storage" : f.name.includes("FarmerImage") ? "Farmer Profile Photo" : f.name.includes("Vet") ? "Veterinarian Document" : f.name.includes("Seller") ? "Seller Photo" : "Storage File",
          title: f.name.split("/").pop() || f.name,
          size: f.size,
          updated: f.updated,
        });
      }
    });

    const responsePayload = {
      userId,
      userDoc,
      authRecord: authRecord ? { uid: authRecord.uid, email: authRecord.email, phoneNumber: authRecord.phoneNumber, displayName: authRecord.displayName, metadata: authRecord.metadata } : null,
      farmerDoc,
      farmDoc,
      farmsList,
      sellerDoc,
      vetDoc,
      sellerProducts,
      subcollections,
      farmerSubcollections,
      cattleListings,
      cattleOrders,
      productOrders,
      tokenAdvances,
      issues,
      storageFiles,
      allImages,
      profilePhotoUrl: farmerDoc?.imagePath || userDoc?.farmer?.imagePath || sellerDoc?.imagePath || vetDoc?.imagePath || userDoc?.photoURL || userDoc?.profileImage || (allImages.find(i => i.source.includes("Profile"))?.url) || null,
      counts: {
        cattle: cattleListings.length,
        cattleOrders: cattleOrders.length,
        productOrders: productOrders.length,
        sellerProducts: sellerProducts.length,
        tokenAdvances: tokenAdvances.length,
        issues: issues.length,
        storageFiles: storageFiles.length,
        images: allImages.length,
      },
    };

    setCache(cacheKey, responsePayload);
    res.json(responsePayload);
  } catch (error) {
    console.error("Error in /api/admin/user-full-data:", error);
    res.status(500).json({ error: error.message });
  }
});

// REST API: Save or update custom farm data for a user
app.post("/api/admin/user-farm-data/:userId", async (req, res) => {
  try {
    const db = getFirestore();
    const { userId } = req.params;
    const farmData = req.body;
    if (!farmData) return res.status(400).json({ error: "Missing farm data payload" });

    const farmId = farmData.farmId || `farm_${Date.now()}`;
    const cleanData = {
      ...farmData,
      farmId,
      updatedAt: new Date(),
    };

    // Save to users/{userId}/roles/farmer/farms/{farmId} AND users/{userId}/farms/{farmId}
    await Promise.all([
      db.collection("users").doc(userId).collection("roles").doc("farmer").collection("farms").doc(farmId).set(cleanData, { merge: true }),
      db.collection("users").doc(userId).collection("farms").doc(farmId).set(cleanData, { merge: true }),
    ]);

    // Also update users/{userId}/roles/farmer if farmName or address changed
    const roleFarmerUpdate = {};
    if (farmData.name) roleFarmerUpdate.farmName = farmData.name;
    if (farmData.village) roleFarmerUpdate.village = farmData.village;
    if (farmData.district) roleFarmerUpdate.district = farmData.district;
    if (farmData.state) roleFarmerUpdate.state = farmData.state;
    if (farmData.pincode) roleFarmerUpdate.pincode = farmData.pincode;
    if (farmData.address) roleFarmerUpdate.address = farmData.address;
    if (farmData.farmPhoneNumber) roleFarmerUpdate.farmerPhoneNumber = farmData.farmPhoneNumber;

    if (Object.keys(roleFarmerUpdate).length > 0) {
      await db.collection("users").doc(userId).collection("roles").doc("farmer").set(roleFarmerUpdate, { merge: true });
    }

    clearCache();
    res.json({ success: true, message: "Farm data updated successfully", farmId, data: cleanData });
  } catch (error) {
    console.error("Error updating farm data:", error);
    res.status(500).json({ error: error.message });
  }
});

// REST API: Save or update seller profile data for a user
app.post("/api/admin/user-seller-data/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const sellerData = req.body;
    if (!sellerData) return res.status(400).json({ error: "Missing seller data payload" });

    const cleanData = {
      ...sellerData,
      uid: userId,
      userId,
      isSeller: true,
      updatedAt: new Date(),
    };

    // Save to users/{userId}/roles/seller, users/{userId}, and sellers/{userId}
    await Promise.all([
      db.collection("users").doc(userId).collection("roles").doc("seller").set(cleanData, { merge: true }),
      db.collection("users").doc(userId).set({ seller: cleanData, isSeller: true }, { merge: true }),
      db.collection("sellers").doc(userId).set(cleanData, { merge: true }),
    ]);

    clearCache();
    res.json({ success: true, message: "Seller profile updated successfully", data: cleanData });
  } catch (error) {
    console.error("Error updating seller data:", error);
    res.status(500).json({ error: error.message });
  }
});

async function listAllAuthUsers(auth) {
  try {
    let rawUsers = [];
    let nextPageToken = undefined;
    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      if (listUsersResult && Array.isArray(listUsersResult.users)) {
        rawUsers = rawUsers.concat(listUsersResult.users);
      }
      nextPageToken = listUsersResult?.pageToken;
    } while (nextPageToken);
    return rawUsers;
  } catch (err) {
    console.warn("auth.listUsers warning:", err.message);
    return [];
  }
}

async function fetchAndProcessAdminUsers(force = false) {
  const cachedUsers = getCached("admin_users", 600000);
  if (!force && cachedUsers && Array.isArray(cachedUsers) && cachedUsers.length > 0) {
    return cachedUsers;
  }

  const auth = getAuth();
  const db = getFirestore();
  
  // Concurrently fetch Auth users and all Firestore user collections in parallel
  const [
    authUsersList,
    fsSnapshot,
    farmersSnapshot,
    sellersSnapshot,
    vetsSnapshot,
    farmsSnapshot,
    cattleSnapshot,
    groupRolesSnap,
    groupFarmerSnap,
    groupSellerSnap,
    groupVetSnap,
    storesSnap,
  ] = await Promise.all([
    listAllAuthUsers(auth),
    db.collection("users").get().catch(() => ({ docs: [] })),
    db.collection("farmers").get().catch(() => ({ docs: [] })),
    db.collection("sellers").get().catch(() => ({ docs: [] })),
    db.collection("vets").get().catch(() => ({ docs: [] })),
    db.collectionGroup("farms").get().catch(() => ({ docs: [] })),
    db.collection("cattle_details").get().catch(() => ({ docs: [] })),
    db.collectionGroup("roles").get().catch(() => ({ docs: [] })),
    db.collectionGroup("farmer").get().catch(() => ({ docs: [] })),
    db.collectionGroup("seller").get().catch(() => ({ docs: [] })),
    db.collectionGroup("veterinarian").get().catch(() => ({ docs: [] })),
    db.collection("stores").get().catch(() => ({ docs: [] })),
  ]);

  const fsUsersMap = {};
  fsSnapshot.docs?.forEach((doc) => {
    fsUsersMap[doc.id] = doc.data();
  });

  const subRolesMap = {}; // uid -> { farmer, seller, vet }
  const extractSubRole = (doc, defaultRole = null) => {
    const d = doc.data();
    const path = doc.ref.path;
    const parts = path.split("/");
    let uid = d.uid || d.userId;
    if (!uid && parts[0] === "users" && parts[1]) uid = parts[1];
    if (!uid && parts[0] === "farmers" && parts[1]) uid = parts[1];
    if (!uid && parts[0] === "sellers" && parts[1]) uid = parts[1];
    if (!uid && parts[0] === "vets" && parts[1]) uid = parts[1];
    if (!uid) uid = doc.id;
    if (!uid) return;

    if (!subRolesMap[uid]) subRolesMap[uid] = {};

    const roleId = (doc.id || defaultRole || d.role || "").toLowerCase();
    if (roleId.includes("farm") || defaultRole === "farmer") {
      subRolesMap[uid].farmer = { ...d, id: doc.id };
    }
    if (roleId.includes("sell") || defaultRole === "seller") {
      subRolesMap[uid].seller = { ...d, id: doc.id };
    }
    if (roleId.includes("vet") || defaultRole === "veterinarian") {
      subRolesMap[uid].vet = { ...d, id: doc.id };
    }
  };

  groupRolesSnap.docs?.forEach((doc) => extractSubRole(doc));
  groupFarmerSnap.docs?.forEach((doc) => extractSubRole(doc, "farmer"));
  groupSellerSnap.docs?.forEach((doc) => extractSubRole(doc, "seller"));
  groupVetSnap.docs?.forEach((doc) => extractSubRole(doc, "veterinarian"));
  storesSnap.docs?.forEach((doc) => {
    const d = doc.data();
    const uid = d.userId || d.ownerUid || d.uid || doc.id;
    if (uid) {
      if (!subRolesMap[uid]) subRolesMap[uid] = {};
      subRolesMap[uid].seller = { ...d, id: doc.id };
    }
  });

  const directFarmersMap = {};
  farmersSnapshot.docs?.forEach((doc) => {
    const d = doc.data();
    directFarmersMap[doc.id] = { id: doc.id, ...d };
    if (d.uid) directFarmersMap[d.uid] = { id: doc.id, ...d };
    const p = (d.phone || d.phoneNumber || d.farmerPhoneNumber || "").replace(/\D/g, "").slice(-10);
    if (p) directFarmersMap[p] = { id: doc.id, ...d };
  });

  const directSellersMap = {};
  sellersSnapshot.docs?.forEach((doc) => {
    const d = doc.data();
    directSellersMap[doc.id] = { id: doc.id, ...d };
    if (d.uid) directSellersMap[d.uid] = { id: doc.id, ...d };
    const p = (d.phone || d.phoneNumber || d.sellerPhone || "").replace(/\D/g, "").slice(-10);
    if (p) directSellersMap[p] = { id: doc.id, ...d };
  });

  const directVetsMap = {};
  vetsSnapshot.docs?.forEach((doc) => {
    const d = doc.data();
    directVetsMap[doc.id] = { id: doc.id, ...d };
    if (d.uid) directVetsMap[d.uid] = { id: doc.id, ...d };
    const p = (d.phone || d.phoneNumber || d.vetPhone || "").replace(/\D/g, "").slice(-10);
    if (p) directVetsMap[p] = { id: doc.id, ...d };
  });

  const farmOwnersMap = {};
  farmsSnapshot.docs?.forEach((doc) => {
    const data = doc.data();
    const path = doc.ref.path;
    const parts = path.split("/");
    let ownerUid = data.ownerUid || data.userId;
    if (!ownerUid && parts[0] === "users" && parts[1]) ownerUid = parts[1];
    if (ownerUid) {
      farmOwnersMap[ownerUid] = {
        name: data.ownerName || data.farmerName || (data.name !== "Registered Dairy Farm" ? data.name : null),
        phone: data.farmPhoneNumber || data.phoneNumber || data.phone,
        village: data.village,
        district: data.district,
        state: data.state,
        farmName: data.name || data.farmName,
        farmId: data.farmId || doc.id,
      };
    }
  });

  const cattleOwnersMap = {};
  cattleSnapshot.docs?.forEach((doc) => {
    const data = doc.data();
    const ownerUid = data.ownerUid || data.userId || data.farmerId || data.sellerId;
    if (ownerUid && !cattleOwnersMap[ownerUid]) {
      cattleOwnersMap[ownerUid] = {
        name: data.ownerName || data.farmerName || data.sellerName,
        phone: data.ownerPhone || data.phone || data.sellerPhone,
        village: data.village,
        district: data.district,
        state: data.state,
      };
    }
  });

  const userMap = new Map();

  // 1. Process all Firebase Authentication records
  authUsersList.forEach((userRecord) => {
    const uid = userRecord.uid;
    const fsUser = fsUsersMap[uid] || {};
    const cleanPhone = (userRecord.phoneNumber || fsUser.phoneNumber || fsUser.phone || "").replace(/\D/g, "").slice(-10);
    const subRoles = subRolesMap[uid] || {};

    const farmerRecord = directFarmersMap[uid] || (cleanPhone ? directFarmersMap[cleanPhone] : null) || subRoles.farmer || fsUser.farmer || null;
    const sellerRecord = directSellersMap[uid] || (cleanPhone ? directSellersMap[cleanPhone] : null) || subRoles.seller || fsUser.seller || null;
    const vetRecord = directVetsMap[uid] || (cleanPhone ? directVetsMap[cleanPhone] : null) || subRoles.vet || fsUser.veterinarian || fsUser.vet || null;
    const farmMeta = farmOwnersMap[uid] || null;
    const cattleMeta = cattleOwnersMap[uid] || null;

    const rawRoles = fsUser.roles || (fsUser.role ? [fsUser.role] : []);
    const roleArray = Array.isArray(rawRoles) ? rawRoles : [String(rawRoles)];

    const isFarmer = Boolean(
      farmerRecord ||
      farmMeta ||
      cattleMeta ||
      (fsUser.farms && Object.keys(fsUser.farms).length > 0) ||
      roleArray.some((r) => String(r).toLowerCase().includes("farmer"))
    );

    const isSeller = Boolean(
      sellerRecord ||
      fsUser.isSeller ||
      roleArray.some((r) => String(r).toLowerCase().includes("seller"))
    );

    const isVet = Boolean(
      vetRecord ||
      fsUser.isVet ||
      roleArray.some((r) => String(r).toLowerCase().includes("vet"))
    );

    const roles = [];
    if (isFarmer) roles.push("Farmer");
    if (isSeller) roles.push("Seller");
    if (isVet) roles.push("Veterinarian");
    if (roles.length === 0) roles.push("User");

    const explicitRealName =
      (userRecord.displayName && !userRecord.displayName.startsWith("Farmer") && !userRecord.displayName.startsWith("User") && !userRecord.displayName.startsWith("Seller") && !userRecord.displayName.startsWith("Dr.") ? userRecord.displayName : null) ||
      (fsUser.fullName && !fsUser.fullName.startsWith("Farmer") && !fsUser.fullName.startsWith("User") ? fsUser.fullName : null) ||
      (fsUser.name && !fsUser.name.startsWith("Farmer") && !fsUser.name.startsWith("User") ? fsUser.name : null) ||
      (fsUser.displayName && !fsUser.displayName.startsWith("Farmer") && !fsUser.displayName.startsWith("User") ? fsUser.displayName : null) ||
      (farmerRecord?.name && !farmerRecord.name.startsWith("Farmer") && !farmerRecord.name.startsWith("User") ? farmerRecord.name : null) ||
      (farmerRecord?.farmerName && !farmerRecord.farmerName.startsWith("Farmer") ? farmerRecord.farmerName : null) ||
      (sellerRecord?.name && !sellerRecord.name.startsWith("Seller") && !sellerRecord.name.startsWith("User") && !sellerRecord.name.startsWith("Farmer") ? sellerRecord.name : null) ||
      (sellerRecord?.shopName && !sellerRecord.shopName.startsWith("Seller") ? sellerRecord.shopName : null) ||
      (vetRecord?.name && !vetRecord.name.startsWith("User") ? (vetRecord.name.startsWith("Dr.") ? vetRecord.name : `Dr. ${vetRecord.name}`) : null) ||
      (vetRecord?.doctorName ? (vetRecord.doctorName.startsWith("Dr.") ? vetRecord.doctorName : `Dr. ${vetRecord.doctorName}`) : null) ||
      (farmMeta?.name && !farmMeta.name.startsWith("Farmer") ? farmMeta.name : null) ||
      (cattleMeta?.name && !cattleMeta.name.startsWith("Farmer") ? cattleMeta.name : null);

    let resolvedName = explicitRealName;
    if (!resolvedName) {
      if (isVet) resolvedName = userRecord.phoneNumber ? `Dr. (${userRecord.phoneNumber})` : `Dr. #${uid.slice(-6).toUpperCase()}`;
      else if (isSeller) resolvedName = userRecord.phoneNumber ? `Seller (${userRecord.phoneNumber})` : `Seller #${uid.slice(-6).toUpperCase()}`;
      else if (isFarmer) resolvedName = userRecord.phoneNumber ? `Farmer (${userRecord.phoneNumber})` : `Farmer #${uid.slice(-6).toUpperCase()}`;
      else resolvedName = userRecord.phoneNumber ? `User (${userRecord.phoneNumber})` : `User #${uid.slice(-6).toUpperCase()}`;
    }

    const resolvedPhone =
      (userRecord.phoneNumber && userRecord.phoneNumber !== "—") ? userRecord.phoneNumber :
      (fsUser.phoneNumber && fsUser.phoneNumber !== "—") ? fsUser.phoneNumber :
      (fsUser.phone && fsUser.phone !== "—") ? fsUser.phone :
      farmerRecord?.phone || farmerRecord?.farmerPhoneNumber ||
      sellerRecord?.phone || sellerRecord?.sellerPhone || sellerRecord?.sellerPhoneNumber ||
      vetRecord?.phone || vetRecord?.vetPhone || vetRecord?.vetPhoneNumber ||
      farmMeta?.phone || cattleMeta?.phone ||
      "—";

    const resolvedVillage =
      farmMeta?.village ||
      cattleMeta?.village ||
      farmerRecord?.village ||
      sellerRecord?.village ||
      sellerRecord?.city ||
      sellerRecord?.town ||
      vetRecord?.village ||
      vetRecord?.city ||
      vetRecord?.town ||
      fsUser.village ||
      fsUser.city ||
      fsUser.town ||
      "—";

    const resolvedDistrict =
      farmMeta?.district ||
      cattleMeta?.district ||
      farmerRecord?.district ||
      sellerRecord?.district ||
      sellerRecord?.districtName ||
      sellerRecord?.city ||
      vetRecord?.district ||
      vetRecord?.districtName ||
      vetRecord?.city ||
      fsUser.district ||
      fsUser.districtName ||
      "—";

    const resolvedState =
      farmMeta?.state ||
      cattleMeta?.state ||
      farmerRecord?.state ||
      sellerRecord?.state ||
      sellerRecord?.stateName ||
      sellerRecord?.stateCode ||
      vetRecord?.state ||
      vetRecord?.stateName ||
      vetRecord?.stateCode ||
      fsUser.state ||
      fsUser.stateName ||
      fsUser.stateCode ||
      "—";

    const resolvedAddress =
      farmerRecord?.address ||
      sellerRecord?.address ||
      sellerRecord?.fullAddress ||
      vetRecord?.address ||
      vetRecord?.clinicAddress ||
      fsUser.address ||
      fsUser.fullAddress ||
      "—";

    const locParts = [resolvedVillage, resolvedDistrict, resolvedState].filter((v) => v && v !== "—");
    const resolvedLocation = locParts.length > 0 ? locParts.join(", ") : (resolvedAddress !== "—" ? resolvedAddress : "—");

    userMap.set(uid, {
      uid,
      email: userRecord.email || fsUser.email || null,
      phoneNumber: resolvedPhone,
      displayName: resolvedName,
      name: resolvedName,
      roles: roles,
      role: roles[0],
      village: resolvedVillage,
      district: resolvedDistrict,
      state: resolvedState,
      address: resolvedAddress,
      location: resolvedLocation,
      createdAt: userRecord.metadata?.creationTime || (fsUser.createdAt?.seconds ? fsUser.createdAt.seconds * 1000 : fsUser.createdAt) || null,
      lastLoginAt: userRecord.metadata?.lastSignInTime || (fsUser.updatedAt?.seconds ? fsUser.updatedAt.seconds * 1000 : fsUser.updatedAt) || null,
      farms: fsUser.farms || (farmMeta ? { name: farmMeta.farmName, id: farmMeta.farmId } : null),
      farmer: isFarmer ? {
        ...(farmerRecord || {}),
        name: resolvedName,
        farmerPhoneNumber: resolvedPhone,
        village: resolvedVillage,
        district: resolvedDistrict,
        state: resolvedState,
        farmName: farmMeta?.farmName || farmerRecord?.farmName || null,
      } : null,
      isFarmer,
      status: fsUser.status || "Active",
      seller: isSeller ? {
        ...(sellerRecord || {}),
        name: sellerRecord?.name || sellerRecord?.shopName || resolvedName,
        phone: sellerRecord?.phone || resolvedPhone,
        state: sellerRecord?.state || resolvedState,
        district: sellerRecord?.district || resolvedDistrict,
        village: sellerRecord?.village || sellerRecord?.city || resolvedVillage,
        location: resolvedLocation,
      } : null,
      veterinarian: isVet ? {
        ...(vetRecord || {}),
        name: vetRecord?.name || vetRecord?.doctorName || resolvedName,
        phone: vetRecord?.phone || resolvedPhone,
        state: vetRecord?.state || resolvedState,
        district: vetRecord?.district || resolvedDistrict,
        village: vetRecord?.village || vetRecord?.city || resolvedVillage,
        location: resolvedLocation,
      } : null,
      isAuthUser: true,
    });
  });

  // 2. Add any additional Firestore user profiles that weren't directly in Auth list
  Object.keys(fsUsersMap).forEach((uid) => {
    if (userMap.has(uid)) return;
    const fsUser = fsUsersMap[uid];
    const cleanPhone = (fsUser.phoneNumber || fsUser.phone || "").replace(/\D/g, "").slice(-10);
    const subRoles = subRolesMap[uid] || {};
    const farmerRecord = directFarmersMap[uid] || (cleanPhone ? directFarmersMap[cleanPhone] : null) || subRoles.farmer || fsUser.farmer || null;
    const sellerRecord = directSellersMap[uid] || (cleanPhone ? directSellersMap[cleanPhone] : null) || subRoles.seller || fsUser.seller || null;
    const vetRecord = directVetsMap[uid] || (cleanPhone ? directVetsMap[cleanPhone] : null) || subRoles.vet || fsUser.veterinarian || fsUser.vet || null;
    const farmMeta = farmOwnersMap[uid] || null;
    const cattleMeta = cattleOwnersMap[uid] || null;

    const rawRoles = fsUser.roles || (fsUser.role ? [fsUser.role] : []);
    const roleArray = Array.isArray(rawRoles) ? rawRoles : [String(rawRoles)];

    const isFarmer = Boolean(
      farmerRecord || farmMeta || cattleMeta || (fsUser.farms && Object.keys(fsUser.farms).length > 0) || roleArray.some((r) => String(r).toLowerCase().includes("farmer"))
    );
    const isSeller = Boolean(sellerRecord || fsUser.isSeller || roleArray.some((r) => String(r).toLowerCase().includes("seller")));
    const isVet = Boolean(vetRecord || fsUser.isVet || roleArray.some((r) => String(r).toLowerCase().includes("vet")));

    const roles = [];
    if (isFarmer) roles.push("Farmer");
    if (isSeller) roles.push("Seller");
    if (isVet) roles.push("Veterinarian");
    if (roles.length === 0) roles.push("User");

    const explicitRealName =
      (fsUser.fullName && !fsUser.fullName.startsWith("Farmer") && !fsUser.fullName.startsWith("User") ? fsUser.fullName : null) ||
      (fsUser.name && !fsUser.name.startsWith("Farmer") && !fsUser.name.startsWith("User") ? fsUser.name : null) ||
      (fsUser.displayName && !fsUser.displayName.startsWith("Farmer") && !fsUser.displayName.startsWith("User") ? fsUser.displayName : null) ||
      (farmerRecord?.name && !farmerRecord.name.startsWith("Farmer") ? farmerRecord.name : null) ||
      (sellerRecord?.name && !sellerRecord.name.startsWith("Seller") ? sellerRecord.name : null) ||
      (vetRecord?.name ? (vetRecord.name.startsWith("Dr.") ? vetRecord.name : `Dr. ${vetRecord.name}`) : null);

    let resolvedName = explicitRealName;
    if (!resolvedName) {
      if (isVet) resolvedName = cleanPhone ? `Dr. (+91${cleanPhone})` : `Dr. #${uid.slice(-6).toUpperCase()}`;
      else if (isSeller) resolvedName = cleanPhone ? `Seller (+91${cleanPhone})` : `Seller #${uid.slice(-6).toUpperCase()}`;
      else if (isFarmer) resolvedName = cleanPhone ? `Farmer (+91${cleanPhone})` : `Farmer #${uid.slice(-6).toUpperCase()}`;
      else resolvedName = cleanPhone ? `User (+91${cleanPhone})` : `User #${uid.slice(-6).toUpperCase()}`;
    }

    const resolvedPhone = fsUser.phoneNumber || fsUser.phone || farmerRecord?.phone || sellerRecord?.phone || vetRecord?.phone || "—";

    const resolvedVillage =
      farmMeta?.village ||
      cattleMeta?.village ||
      farmerRecord?.village ||
      sellerRecord?.village ||
      sellerRecord?.city ||
      sellerRecord?.town ||
      vetRecord?.village ||
      vetRecord?.city ||
      vetRecord?.town ||
      fsUser.village ||
      fsUser.city ||
      fsUser.town ||
      "—";

    const resolvedDistrict =
      farmMeta?.district ||
      cattleMeta?.district ||
      farmerRecord?.district ||
      sellerRecord?.district ||
      sellerRecord?.districtName ||
      sellerRecord?.city ||
      vetRecord?.district ||
      vetRecord?.districtName ||
      vetRecord?.city ||
      fsUser.district ||
      fsUser.districtName ||
      "—";

    const resolvedState =
      farmMeta?.state ||
      cattleMeta?.state ||
      farmerRecord?.state ||
      sellerRecord?.state ||
      sellerRecord?.stateName ||
      sellerRecord?.stateCode ||
      vetRecord?.state ||
      vetRecord?.stateName ||
      vetRecord?.stateCode ||
      fsUser.state ||
      fsUser.stateName ||
      fsUser.stateCode ||
      "—";

    const resolvedAddress =
      farmerRecord?.address ||
      sellerRecord?.address ||
      sellerRecord?.fullAddress ||
      vetRecord?.address ||
      vetRecord?.clinicAddress ||
      fsUser.address ||
      fsUser.fullAddress ||
      "—";

    const locParts = [resolvedVillage, resolvedDistrict, resolvedState].filter((v) => v && v !== "—");
    const resolvedLocation = locParts.length > 0 ? locParts.join(", ") : (resolvedAddress !== "—" ? resolvedAddress : "—");

    userMap.set(uid, {
      uid,
      email: fsUser.email || null,
      phoneNumber: resolvedPhone,
      displayName: resolvedName,
      name: resolvedName,
      roles: roles,
      role: roles[0],
      village: resolvedVillage,
      district: resolvedDistrict,
      state: resolvedState,
      address: resolvedAddress,
      location: resolvedLocation,
      createdAt: fsUser.createdAt ? (fsUser.createdAt.seconds ? fsUser.createdAt.seconds * 1000 : fsUser.createdAt) : null,
      lastLoginAt: fsUser.updatedAt ? (fsUser.updatedAt.seconds ? fsUser.updatedAt.seconds * 1000 : fsUser.updatedAt) : null,
      farms: fsUser.farms || (farmMeta ? { name: farmMeta.farmName, id: farmMeta.farmId } : null),
      farmer: isFarmer ? {
        ...(farmerRecord || {}),
        name: resolvedName,
        farmerPhoneNumber: resolvedPhone,
        village: resolvedVillage,
        district: resolvedDistrict,
        state: resolvedState,
        farmName: farmMeta?.farmName || farmerRecord?.farmName || null,
      } : null,
      isFarmer,
      status: fsUser.status || "Active",
      seller: isSeller ? {
        ...(sellerRecord || {}),
        name: sellerRecord?.name || sellerRecord?.shopName || resolvedName,
        phone: sellerRecord?.phone || resolvedPhone,
        state: sellerRecord?.state || resolvedState,
        district: sellerRecord?.district || resolvedDistrict,
        village: sellerRecord?.village || sellerRecord?.city || resolvedVillage,
        location: resolvedLocation,
      } : null,
      veterinarian: isVet ? {
        ...(vetRecord || {}),
        name: vetRecord?.name || vetRecord?.doctorName || resolvedName,
        phone: vetRecord?.phone || resolvedPhone,
        state: vetRecord?.state || resolvedState,
        district: vetRecord?.district || resolvedDistrict,
        village: vetRecord?.village || vetRecord?.city || resolvedVillage,
        location: resolvedLocation,
      } : null,
      isAuthUser: false,
    });
  });

  const result = Array.from(userMap.values());

  // Sort all users by creation/registration time descending (latest first)
  result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  setCache("admin_users", result);
  return result;
}

// REST API to list all Firebase Authentication users with progressive pagination support
app.get(["/api/admin/users", "/get/api/admin/users"], async (req, res) => {
  try {
    const limit = req.query.limit ? Math.max(1, parseInt(req.query.limit, 10)) : null;
    const offset = req.query.offset ? Math.max(0, parseInt(req.query.offset, 10)) : 0;

    let allUsers = getCached("admin_users", 600000);
    let cached = true;

    if (!allUsers || !Array.isArray(allUsers) || allUsers.length === 0) {
      allUsers = await fetchAndProcessAdminUsers(true);
      cached = false;
    } else if (!isCacheFresh("admin_users", 600000)) {
      // Trigger background revalidation asynchronously
      fetchAndProcessAdminUsers(true).catch(() => {});
    }

    if (limit) {
      const sliced = allUsers.slice(offset, offset + limit);
      return res.json({
        users: sliced,
        total: allUsers.length,
        offset,
        limit,
        hasMore: offset + limit < allUsers.length,
        cached,
      });
    }

    res.json({ users: allUsers, total: allUsers.length, cached });
  } catch (error) {
    console.error("Error in /api/admin/users:", error);
    res.status(500).json({ error: error.message });
  }
});

// REST API to list all Sellers across all known collections and role subcollections
app.get("/api/admin/sellers", async (req, res) => {
  try {
    const cached = getCached("admin_sellers", 600000);
    if (cached) return res.json(cached);

    const db = getFirestore();
    const [sSnap, usersSnap, groupSellerSnap, groupSellersSnap, storesSnap, vendorAppsSnap, groupRolesSnap] = await Promise.all([
      db.collection("sellers").get().catch(() => ({ docs: [] })),
      db.collection("users").get().catch(() => ({ docs: [] })),
      db.collectionGroup("seller").get().catch(() => ({ docs: [] })),
      db.collectionGroup("sellers").get().catch(() => ({ docs: [] })),
      db.collection("stores").get().catch(() => ({ docs: [] })),
      db.collection("vendor_applications").get().catch(() => ({ docs: [] })),
      db.collectionGroup("roles").get().catch(() => ({ docs: [] })),
    ]);

    const sellersMap = new Map();

    function extractLoc(d = {}, u = {}) {
      const address = d.address || d.fullAddress || d.storeAddress || d.shopAddress || d.clinicAddress || u.address || u.fullAddress || "—";
      const village = d.village || d.city || d.town || u.village || u.city || u.town || "—";
      const district = d.district || d.districtName || u.district || u.districtName || "—";
      const state = d.state || d.stateName || d.stateCode || u.state || u.stateName || u.stateCode || "—";
      const pincode = d.pincode || d.pinCode || u.pincode || u.pinCode || "—";
      const locParts = [village, district, state].filter((x) => x && x !== "—");
      const location = locParts.length > 0 ? locParts.join(", ") : (address !== "—" ? address : "—");
      return { address, village, city: village, district, state, pincode, location };
    }

    // 1. Direct sellers collection
    sSnap.docs.forEach((doc) => {
      const d = doc.data();
      const id = doc.id;
      const phone = d.phone || d.phoneNumber || d.sellerPhone || "—";
      const name = d.shopName || d.storeName || d.name || d.sellerName || d.fullName || (phone !== "—" ? `Seller (${phone})` : `Seller #${id.slice(-6).toUpperCase()}`);
      const loc = extractLoc(d);
      sellersMap.set(id, {
        id,
        uid: d.uid || d.userId || id,
        ...d,
        ...loc,
        name,
        shopName: d.shopName || d.storeName || name,
        phone,
        phoneNumber: phone,
        category: d.category || d.shopCategory || d.storeType || "General",
        products: d.products || d.productCount || 0,
        status: d.status || "Active",
        verified: Boolean(d.verified || d.isVerified),
        createdAt: d.createdAt || d.timestamp || null,
      });
    });

    // 2. CollectionGroup 'seller' subcollections (/users/{uid}/roles/seller or /users/{uid}/seller)
    groupSellerSnap.docs.forEach((doc) => {
      const d = doc.data();
      const path = doc.ref.path;
      const segments = path.split("/");
      let uid = d.uid || d.userId;
      if (!uid && segments[0] === "users" && segments[1]) uid = segments[1];
      const id = uid || doc.id;
      if (!id) return;

      const phone = d.sellerPhoneNumber || d.phone || d.phoneNumber || d.sellerPhone || "—";
      const name = d.shopName || d.storeName || d.name || d.sellerName || d.fullName || (phone !== "—" ? `Seller (${phone})` : `Seller #${id.slice(-6).toUpperCase()}`);

      const existing = sellersMap.get(id) || {};
      sellersMap.set(id, {
        ...existing,
        id,
        uid: id,
        ...d,
        name: existing.name || name,
        shopName: d.shopName || d.storeName || existing.shopName || name,
        phone: phone !== "—" ? phone : existing.phone || "—",
        phoneNumber: phone !== "—" ? phone : existing.phoneNumber || "—",
        category: d.category || existing.category || "General",
        products: d.products || existing.products || 0,
        status: d.status || existing.status || "Active",
        verified: Boolean(d.verified || existing.verified),
        createdAt: d.createdAt || existing.createdAt || null,
      });
    });

    // 2b. CollectionGroup 'roles' (/users/{uid}/roles/seller)
    groupRolesSnap.docs.forEach((doc) => {
      const d = doc.data();
      if (doc.id !== "seller" && d.role !== "seller" && !d.sellerPhoneNumber) return;
      const path = doc.ref.path;
      const segments = path.split("/");
      let uid = d.uid || d.userId;
      if (!uid && segments[0] === "users" && segments[1]) uid = segments[1];
      const id = uid || doc.id;
      if (!id) return;

      const phone = d.sellerPhoneNumber || d.phone || d.phoneNumber || d.sellerPhone || "—";
      const name = d.shopName || d.storeName || d.name || d.sellerName || d.fullName || (phone !== "—" ? `Seller (${phone})` : `Seller #${id.slice(-6).toUpperCase()}`);
      const loc = extractLoc(d);

      const existing = sellersMap.get(id) || {};
      sellersMap.set(id, {
        ...existing,
        ...loc,
        id,
        uid: id,
        ...d,
        name: existing.name || name,
        shopName: d.shopName || d.storeName || existing.shopName || name,
        phone: phone !== "—" ? phone : existing.phone || "—",
        phoneNumber: phone !== "—" ? phone : existing.phoneNumber || "—",
        category: d.category || existing.category || "General",
        products: d.products || existing.products || 0,
        status: d.status || existing.status || "Active",
        verified: Boolean(d.verified || existing.verified),
        createdAt: d.createdAt || existing.createdAt || null,
      });
    });

    // 3. CollectionGroup 'sellers'
    groupSellersSnap.docs.forEach((doc) => {
      const d = doc.data();
      const path = doc.ref.path;
      const segments = path.split("/");
      let uid = d.uid || d.userId;
      if (!uid && segments[0] === "users" && segments[1]) uid = segments[1];
      const id = uid || doc.id;
      if (!id || sellersMap.has(id)) return;

      const phone = d.phone || d.phoneNumber || d.sellerPhone || "—";
      const name = d.shopName || d.storeName || d.name || d.sellerName || (phone !== "—" ? `Seller (${phone})` : `Seller #${id.slice(-6).toUpperCase()}`);
      sellersMap.set(id, {
        id,
        uid: id,
        ...d,
        name,
        shopName: d.shopName || d.storeName || name,
        phone,
        phoneNumber: phone,
        category: d.category || "General",
        products: d.products || 0,
        status: d.status || "Active",
        verified: Boolean(d.verified),
        createdAt: d.createdAt || null,
      });
    });

    // 4. Stores collection
    storesSnap.docs.forEach((doc) => {
      const d = doc.data();
      const id = d.userId || d.ownerUid || d.uid || doc.id;
      if (!id || sellersMap.has(id)) return;
      const phone = d.phone || d.phoneNumber || "—";
      const name = d.shopName || d.storeName || d.name || (phone !== "—" ? `Seller (${phone})` : `Seller #${id.slice(-6).toUpperCase()}`);
      sellersMap.set(id, {
        id,
        uid: id,
        ...d,
        name,
        shopName: d.shopName || d.storeName || name,
        phone,
        phoneNumber: phone,
        category: d.category || "General",
        products: d.products || 0,
        status: d.status || "Active",
        verified: Boolean(d.verified),
        createdAt: d.createdAt || null,
      });
    });

    // 5. Users collection with seller profile
    usersSnap.docs.forEach((doc) => {
      const u = doc.data();
      const id = doc.id;
      const rawRoles = u.roles || (u.role ? [u.role] : []);
      const roleList = Array.isArray(rawRoles) ? rawRoles : [String(rawRoles)];
      const hasSellerRole = roleList.some((r) => String(r).toLowerCase().includes("seller"));
      const sellerData = u.seller || null;

      if (sellerData || hasSellerRole || u.isSeller) {
        const d = (typeof sellerData === "object" && sellerData) ? sellerData : {};
        const phone = d.phone || d.phoneNumber || d.sellerPhone || u.phoneNumber || u.phone || "—";
        const name = d.shopName || d.storeName || d.name || d.sellerName || (u.fullName && u.fullName !== "User" && !u.fullName.startsWith("Farmer") ? u.fullName : (u.name && !u.name.startsWith("Farmer") ? u.name : (phone !== "—" ? `Seller (${phone})` : `Seller #${id.slice(-6).toUpperCase()}`)));

        if (sellersMap.has(id)) {
          const existing = sellersMap.get(id);
          sellersMap.set(id, {
            ...existing,
            name: (existing.name && !existing.name.startsWith("Farmer")) ? existing.name : name,
            phone: existing.phone !== "—" ? existing.phone : phone,
            phoneNumber: existing.phoneNumber !== "—" ? existing.phoneNumber : phone,
            email: u.email || existing.email || null,
          });
        } else {
          sellersMap.set(id, {
            id,
            uid: id,
            ...d,
            name,
            shopName: d.shopName || d.storeName || name,
            phone,
            phoneNumber: phone,
            email: u.email || null,
            category: d.category || "General",
            products: d.products || 0,
            status: u.status || d.status || "Active",
            verified: Boolean(d.verified || u.verified),
            createdAt: d.createdAt || u.createdAt || null,
          });
        }
      }
    });

    const result = Array.from(sellersMap.values());
    const payload = { sellers: result, count: result.length };
    setCache("admin_sellers", payload);
    res.json(payload);
  } catch (error) {
    console.error("Error in /api/admin/sellers:", error);
    res.status(500).json({ error: error.message, sellers: [] });
  }
});

// REST API to list all Veterinarians across all known collections and role subcollections
app.get("/api/admin/vets", async (req, res) => {
  try {
    const cached = getCached("admin_vets", 600000);
    if (cached) return res.json(cached);

    const db = getFirestore();
    const [vSnap, usersSnap, groupVetSnap, groupVetsSnap] = await Promise.all([
      db.collection("vets").get().catch(() => ({ docs: [] })),
      db.collection("users").get().catch(() => ({ docs: [] })),
      db.collectionGroup("veterinarian").get().catch(() => ({ docs: [] })),
      db.collectionGroup("vet").get().catch(() => ({ docs: [] })),
    ]);

    const vetsMap = new Map();

    // 1. Direct vets collection
    vSnap.docs.forEach((doc) => {
      const d = doc.data();
      const id = doc.id;
      const phone = d.phone || d.phoneNumber || d.vetPhoneNumber || d.vetPhone || "—";
      const docName = d.doctorName || d.name || d.fullName || (phone !== "—" ? `Dr. (${phone})` : `Dr. #${id.slice(-6).toUpperCase()}`);
      const formattedName = docName.startsWith("Dr.") ? docName : `Dr. ${docName}`;

      vetsMap.set(id, {
        id,
        uid: d.uid || d.userId || id,
        ...d,
        name: formattedName,
        doctorName: formattedName,
        phone,
        phoneNumber: phone,
        clinic: d.clinic || d.hospital || d.addInstitution || "—",
        qualification: d.qualification || d.degree || "B.V.Sc & A.H",
        experience: d.yearsOfExperience || d.experience || "—",
        specialization: Array.isArray(d.specialization) ? d.specialization : (d.specialization ? [d.specialization] : ["General Bovine Care"]),
        status: d.status || "Active",
        verified: Boolean(d.verified || d.isVerified),
        createdAt: d.createdAt || d.timestamp || null,
      });
    });

    // 2. CollectionGroup 'veterinarian'
    groupVetSnap.docs.forEach((doc) => {
      const d = doc.data();
      const path = doc.ref.path;
      const segments = path.split("/");
      let uid = d.uid || d.userId;
      if (!uid && segments[0] === "users" && segments[1]) uid = segments[1];
      const id = uid || doc.id;
      if (!id) return;

      const phone = d.phone || d.phoneNumber || d.vetPhoneNumber || d.vetPhone || "—";
      const docName = d.doctorName || d.name || d.fullName || (phone !== "—" ? `Dr. (${phone})` : `Dr. #${id.slice(-6).toUpperCase()}`);
      const formattedName = docName.startsWith("Dr.") ? docName : `Dr. ${docName}`;

      const existing = vetsMap.get(id) || {};
      vetsMap.set(id, {
        ...existing,
        id,
        uid: id,
        ...d,
        name: existing.name || formattedName,
        doctorName: existing.doctorName || formattedName,
        phone: phone !== "—" ? phone : existing.phone || "—",
        phoneNumber: phone !== "—" ? phone : existing.phoneNumber || "—",
        clinic: d.clinic || d.hospital || d.addInstitution || existing.clinic || "—",
        qualification: d.qualification || d.degree || existing.qualification || "B.V.Sc & A.H",
        experience: d.yearsOfExperience || d.experience || existing.experience || "—",
        specialization: Array.isArray(d.specialization) ? d.specialization : existing.specialization || ["General Bovine Care"],
        status: d.status || existing.status || "Active",
        verified: Boolean(d.verified || existing.verified),
        createdAt: d.createdAt || existing.createdAt || null,
      });
    });

    // 3. CollectionGroup 'vet'
    groupVetsSnap.docs.forEach((doc) => {
      const d = doc.data();
      const path = doc.ref.path;
      const segments = path.split("/");
      let uid = d.uid || d.userId;
      if (!uid && segments[0] === "users" && segments[1]) uid = segments[1];
      const id = uid || doc.id;
      if (!id || vetsMap.has(id)) return;

      const phone = d.phone || d.phoneNumber || d.vetPhoneNumber || "—";
      const docName = d.doctorName || d.name || (phone !== "—" ? `Dr. (${phone})` : `Dr. #${id.slice(-6).toUpperCase()}`);
      const formattedName = docName.startsWith("Dr.") ? docName : `Dr. ${docName}`;

      vetsMap.set(id, {
        id,
        uid: id,
        ...d,
        name: formattedName,
        doctorName: formattedName,
        phone,
        phoneNumber: phone,
        clinic: d.clinic || d.hospital || "—",
        qualification: d.qualification || "B.V.Sc & A.H",
        experience: d.yearsOfExperience || d.experience || "—",
        specialization: Array.isArray(d.specialization) ? d.specialization : ["General Bovine Care"],
        status: d.status || "Active",
        verified: Boolean(d.verified),
        createdAt: d.createdAt || null,
      });
    });

    // 4. Users with vet profile
    usersSnap.docs.forEach((doc) => {
      const u = doc.data();
      const id = doc.id;
      const rawRoles = u.roles || (u.role ? [u.role] : []);
      const roleList = Array.isArray(rawRoles) ? rawRoles : [String(rawRoles)];
      const hasVetRole = roleList.some((r) => String(r).toLowerCase().includes("vet"));
      const vetData = u.veterinarian || u.vet || null;

      if (vetData || hasVetRole || u.isVet) {
        const d = (typeof vetData === "object" && vetData) ? vetData : {};
        const phone = d.phone || d.phoneNumber || d.vetPhoneNumber || u.phoneNumber || u.phone || "—";
        const docName = d.doctorName || d.name || (u.fullName && !u.fullName.startsWith("Farmer") ? u.fullName : (u.name && !u.name.startsWith("Farmer") ? u.name : (phone !== "—" ? `Dr. (${phone})` : `Dr. #${id.slice(-6).toUpperCase()}`)));
        const formattedName = docName.startsWith("Dr.") ? docName : `Dr. ${docName}`;

        if (vetsMap.has(id)) {
          const existing = vetsMap.get(id);
          vetsMap.set(id, {
            ...existing,
            name: (existing.name && !existing.name.startsWith("Farmer")) ? existing.name : formattedName,
            phone: existing.phone !== "—" ? existing.phone : phone,
            phoneNumber: existing.phoneNumber !== "—" ? existing.phoneNumber : phone,
            email: u.email || existing.email || null,
          });
        } else {
          vetsMap.set(id, {
            id,
            uid: id,
            ...d,
            name: formattedName,
            doctorName: formattedName,
            phone,
            phoneNumber: phone,
            email: u.email || null,
            clinic: d.clinic || d.hospital || d.addInstitution || "—",
            qualification: d.qualification || "B.V.Sc & A.H",
            experience: d.yearsOfExperience || d.experience || "—",
            specialization: Array.isArray(d.specialization) ? d.specialization : ["General Bovine Care"],
            status: u.status || d.status || "Active",
            verified: Boolean(d.verified || u.verified),
            createdAt: d.createdAt || u.createdAt || null,
          });
        }
      }
    });

    const result = Array.from(vetsMap.values());
    const payload = { vets: result, count: result.length };
    setCache("admin_vets", payload);
    res.json(payload);
  } catch (error) {
    console.error("Error in /api/admin/vets:", error);
    res.status(500).json({ error: error.message, vets: [] });
  }
});

// REST API to list all Product Orders (bypasses client security rules)
app.get("/api/admin/product-orders", async (req, res) => {
  try {
    if (!req.query.refresh && !req.query.force) {
      const cached = getCached("admin_product_orders", 600000);
      if (cached) return res.json(cached);
    }

    const db = getFirestore();
    const defaultBucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET || "auth-b404a.appspot.com";
    const bucket = getStorage().bucket(defaultBucketName);

    const [pSnap, legacySnap, usersSnap, invoiceFiles] = await Promise.all([
      db.collection("ProductOrders").get().catch(() => ({ docs: [] })),
      db.collection("product_orders").get().catch(() => ({ docs: [] })),
      db.collection("users").get().catch(() => ({ docs: [] })),
      listFilesUnderPrefix(bucket, "invoices/").catch(() => []),
    ]);

    // Map invoices
    const invoiceMap = new Map();
    invoiceFiles.forEach((f) => {
      if (f.name && f.name.endsWith(".pdf") && f.url) {
        const parts = f.name.split("/");
        const fileName = parts[parts.length - 1].replace(/\.pdf$/i, "").toLowerCase();
        const folderName = (parts[1] || "").toLowerCase();
        if (folderName) invoiceMap.set(folderName, f.url);
        if (fileName) invoiceMap.set(fileName, f.url);
      }
    });

    // Map users for fast profile resolution
    const usersMap = new Map();
    usersSnap.docs.forEach((d) => {
      const uData = d.data();
      usersMap.set(d.id.toLowerCase(), { id: d.id, ...uData });
      if (uData.uid) usersMap.set(uData.uid.toLowerCase(), { id: d.id, ...uData });
    });

    const ordersMap = new Map();
    const addDoc = (doc) => {
      if (!ordersMap.has(doc.id)) {
        const po = { id: doc.id, ...doc.data() };
        const orderKey = po.orderId || po.id;
        const uId = (po.userId || po.customerId || po.buyerId || "").toLowerCase();
        const userProfile = usersMap.get(uId) || {};

        const buyerName =
          po.shippingAddress?.name ||
          po.buyerName ||
          po.userName ||
          userProfile.name ||
          userProfile.displayName ||
          (uId ? `User (${uId.slice(0, 8)}...)` : "Customer");

        const buyerPhone =
          po.shippingAddress?.phone ||
          userProfile.phoneNumber ||
          userProfile.phone ||
          po.phoneNumber ||
          po.phone ||
          "—";

        const buyerAddress = po.shippingAddress
          ? [po.shippingAddress.line1, po.shippingAddress.line2, po.shippingAddress.district, po.shippingAddress.state, po.shippingAddress.pincode].filter(Boolean).join(", ")
          : po.deliveryAddress || po.address || "—";

        const items = Array.isArray(po.items) ? po.items : [];
        const itemsTotal = items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
        const shippingFee = Number(po.shippingFee || 0);
        const discount = Number(po.discount || 0);
        const totalAmount = Number(po.totalAmount || (itemsTotal > 0 ? itemsTotal + shippingFee - discount : (po.price || po.amount || 0)));

        const invKey = (orderKey || "").toLowerCase();
        const invNoKey = (po.invoiceNumber || po.invoiceNo || "").toLowerCase();
        const invoiceUrl = invoiceMap.get(invKey) || invoiceMap.get(invNoKey) || po.invoiceUrl || null;

        ordersMap.set(doc.id, {
          ...po,
          id: orderKey,
          orderId: orderKey,
          userId: po.userId || userProfile.id || null,
          buyerName,
          buyerPhone,
          buyerAddress,
          sellerName: (po.sellerName && po.sellerName !== "—" && po.sellerName !== "iHerd Marketplace") ? po.sellerName : (po.shopName && po.shopName !== "—") ? po.shopName : (po.storeName && po.storeName !== "—") ? po.storeName : "Chimertech",
          paymentStatus: po.paymentStatus || po.payment?.status || po.payment_status || (po.status === "Delivered" || po.status === "Completed" ? "Paid" : (po.totalAmount ? "Paid" : "—")),
          paymentMethod: po.paymentMethod || po.paymentMode || po.payment?.method || po.payment_method || "—",
          items,
          itemCount: items.length || 1,
          totalAmount,
          price: totalAmount,
          amount: totalAmount,
          shippingFee,
          discount,
          invoiceNumber: po.invoiceNumber || po.invoiceNo || (invoiceUrl ? `INV-${orderKey.slice(-8)}` : "—"),
          invoiceUrl,
          trackingId: po.trackingId || "—",
          deliveryDate: po.deliveryDate || "Standard Shipping",
          status: po.status || "Ordered",
          createdAt: po.createdAt || po.date || null,
          updatedAt: po.updatedAt || null,
        });
      }
    };

    pSnap.docs?.forEach(addDoc);
    legacySnap.docs?.forEach(addDoc);

    const sortedOrders = Array.from(ordersMap.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    const payload = { orders: sortedOrders };
    setCache("admin_product_orders", payload);
    res.json(payload);
  } catch (error) {
    console.error("Error in /api/admin/product-orders:", error);
    res.status(500).json({ error: error.message, orders: [] });
  }
});

// REST API to update Product Order tracking details and status
app.put(["/api/admin/product-orders/:id"], async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    const body = req.body || {};

    const orderKey = body.orderId || body.id || id;
    const totalAmt = body.totalAmount !== undefined 
      ? Number(body.totalAmount) 
      : (body.price !== undefined ? Number(body.price) : (body.amount !== undefined ? Number(body.amount) : undefined));

    // Strictly whitelist and map only the exact fields requested
    const updateData = {};
    if (orderKey !== undefined) {
      updateData.id = orderKey;
      updateData.orderId = orderKey;
    }
    if (body.userId !== undefined) updateData.userId = body.userId;
    if (body.buyerName !== undefined) updateData.buyerName = body.buyerName;
    if (body.buyerPhone !== undefined) updateData.buyerPhone = body.buyerPhone;
    if (body.buyerAddress !== undefined) updateData.buyerAddress = body.buyerAddress;
    if (body.sellerName !== undefined) updateData.sellerName = body.sellerName;
    if (body.items !== undefined) {
      updateData.items = body.items;
      updateData.itemCount = Array.isArray(body.items) ? body.items.length : (body.itemCount || 1);
    } else if (body.itemCount !== undefined) {
      updateData.itemCount = Number(body.itemCount);
    }
    if (totalAmt !== undefined) {
      updateData.totalAmount = totalAmt;
      updateData.price = totalAmt;
      updateData.amount = totalAmt;
    }
    if (body.shippingFee !== undefined) updateData.shippingFee = Number(body.shippingFee);
    if (body.discount !== undefined) updateData.discount = Number(body.discount);
    if (body.invoiceNumber !== undefined) updateData.invoiceNumber = body.invoiceNumber;
    if (body.invoiceUrl !== undefined) updateData.invoiceUrl = body.invoiceUrl;
    if (body.trackingId !== undefined) updateData.trackingId = body.trackingId;
    if (body.deliveryDate !== undefined || body.estimatedDeliveryDate !== undefined) {
      updateData.deliveryDate = body.deliveryDate || body.estimatedDeliveryDate;
    }
    if (body.status !== undefined) updateData.status = body.status;
    if (body.createdAt !== undefined) updateData.createdAt = body.createdAt;
    updateData.updatedAt = body.updatedAt || new Date().toISOString();

    let updated = false;

    // 1. Try direct doc ID in ProductOrders
    const pRef = db.collection("ProductOrders").doc(id);
    const pDoc = await pRef.get();
    if (pDoc.exists) {
      await pRef.set(updateData, { merge: true });
      updated = true;
    }

    // 2. Try direct doc ID in product_orders
    const legacyRef = db.collection("product_orders").doc(id);
    const legacyDoc = await legacyRef.get();
    if (legacyDoc.exists) {
      await legacyRef.set(updateData, { merge: true });
      updated = true;
    }

    // 3. Search by orderId field in ProductOrders
    const qSnap = await db.collection("ProductOrders").where("orderId", "==", id).get();
    if (!qSnap.empty) {
      for (const d of qSnap.docs) {
        await d.ref.set(updateData, { merge: true });
        updated = true;
      }
    }

    // 4. Search by orderId field in product_orders
    const qLegacySnap = await db.collection("product_orders").where("orderId", "==", id).get();
    if (!qLegacySnap.empty) {
      for (const d of qLegacySnap.docs) {
        await d.ref.set(updateData, { merge: true });
        updated = true;
      }
    }

    // 5. Update user subcollection if userId provided or found
    const targetUserId = body.userId || (pDoc.exists ? pDoc.data()?.userId : null);
    if (targetUserId) {
      try {
        const userOrderRef = db.collection("users").doc(targetUserId).collection("ProductOrders").doc(id);
        const userOrderDoc = await userOrderRef.get();
        if (userOrderDoc.exists) {
          await userOrderRef.set(updateData, { merge: true });
          updated = true;
        }
      } catch (subErr) {
        console.warn("Could not update user subcollection:", subErr.message);
      }
    }

    // If doc was not found anywhere, create/set it in ProductOrders
    if (!updated) {
      await pRef.set(updateData, { merge: true });
    }

    console.log(`Updated product order ${id} with exact fields:`, updateData);
    res.json({ success: true, message: "Order updated successfully", orderId: id, data: updateData });
  } catch (error) {
    console.error("Error in PUT /api/admin/product-orders/:id:", error);
    res.status(500).json({ error: error.message });
  }
});

// REST API to list all Cattle Orders (bypasses client security rules)
app.get("/api/admin/cattle-orders", async (req, res) => {
  try {
    const isFresh = req.query.fresh === "true" || req.query.fresh === "1";
    if (!isFresh) {
      const cached = getCached("admin_cattle_orders", 15000); // 15-second cache for fast updates
      if (cached) return res.json(cached);
    }

    const db = getFirestore();
    const defaultBucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET || "auth-b404a.appspot.com";
    const bucket = getStorage().bucket(defaultBucketName);

    const [cSnap, rSnap, legacySnap, genericOrdersSnap, groupCattleOrdersSnap, usersSnap, invoiceFiles] = await Promise.all([
      db.collection("CattleOrders").get().catch(() => ({ docs: [] })),
      db.collection("received_orders").get().catch(() => ({ docs: [] })),
      db.collection("cattle_orders").get().catch(() => ({ docs: [] })),
      db.collection("orders").get().catch(() => ({ docs: [] })),
      db.collectionGroup("cattle_orders").get().catch(() => ({ docs: [] })),
      db.collection("users").get().catch(() => ({ docs: [] })),
      listFilesUnderPrefix(bucket, "invoices/").catch(() => []),
    ]);

    // Map invoices
    const invoiceMap = new Map();
    invoiceFiles.forEach((f) => {
      if (f.name && f.name.endsWith(".pdf") && f.url) {
        const parts = f.name.split("/");
        const fileName = parts[parts.length - 1].replace(/\.pdf$/i, "").toLowerCase();
        const folderName = (parts[1] || "").toLowerCase();
        if (folderName) invoiceMap.set(folderName, f.url);
        if (fileName) invoiceMap.set(fileName, f.url);
      }
    });

    // Map users for fast profile resolution
    const usersMap = new Map();
    usersSnap.docs.forEach((d) => {
      const uData = d.data();
      usersMap.set(d.id.toLowerCase(), { id: d.id, ...uData });
      if (uData.uid) usersMap.set(uData.uid.toLowerCase(), { id: d.id, ...uData });
    });

    const ordersMap = new Map();
    const addDoc = (doc) => {
      const o = { id: doc.id, ...doc.data() };
      const orderKey = o.orderId || o.cattleOrderId || o.id;
      if (ordersMap.has(orderKey)) return;

      const buyerUid = (o.userId || o.buyerId || o.farmerId || o.uid || "").toLowerCase();
      const sellerUid = (o.sellerId || o.ownerUid || o.postedBy || "").toLowerCase();

      const buyerUser = usersMap.get(buyerUid) || {};
      const sellerUser = usersMap.get(sellerUid) || {};

      const buyerName =
        o.shippingAddress?.name ||
        o.buyerName ||
        o.userName ||
        o.customerName ||
        buyerUser.name ||
        buyerUser.displayName ||
        (buyerUid ? `Buyer (${buyerUid.slice(0, 8)}...)` : "Buyer");

      const buyerPhone =
        o.shippingAddress?.phone ||
        o.phoneNumber ||
        o.buyerPhone ||
        o.phone ||
        buyerUser.phoneNumber ||
        buyerUser.phone ||
        "—";

      const buyerLocation =
        o.buyerLocation ||
        o.deliveryAddress ||
        (o.shippingAddress ? [o.shippingAddress.line1, o.shippingAddress.line2, o.shippingAddress.village, o.shippingAddress.taluk, o.shippingAddress.district, o.shippingAddress.state, o.shippingAddress.pincode].filter(Boolean).join(", ") : "—");

      const sellerName =
        o.sellerName ||
        o.ownerName ||
        o.owner ||
        o.farmerName ||
        sellerUser.name ||
        sellerUser.displayName ||
        "Verified Farmer / Seller";

      const sellerPhone =
        o.sellerPhone ||
        o.farmerPhone ||
        sellerUser.phoneNumber ||
        sellerUser.phone ||
        "—";

      const totalAmount = Number(o.price || o.totalAmount || o.amount || 0);
      const tokenAmount = Number(o.tokenAmount || o.advanceAmount || o.tokenPayment || 0);
      const balanceAmount = Number(o.balanceAmount || o.remainingAmount || (totalAmount > tokenAmount ? totalAmount - tokenAmount : 0));

      const invKey = (orderKey || "").toLowerCase();
      const invNoKey = (o.invoiceNo || o.invoiceNumber || "").toLowerCase();
      const invoiceUrl = invoiceMap.get(invKey) || invoiceMap.get(invNoKey) || o.invoiceUrl || null;

      const rawImg = o.image || o.cattleImage || o.imageUrl || o.thumbnail || o.photo || o.faceViewImage || o.leftViewImage || o.rightViewImage || (Array.isArray(o.images) ? o.images[0] : null) || null;
      const formattedImg = rawImg ? normalizeDirectImageUrl(rawImg) : null;

      ordersMap.set(orderKey, {
        ...o,
        id: orderKey,
        orderId: orderKey,
        userId: o.userId || buyerUser.id || null,
        sellerId: o.sellerId || sellerUser.id || null,
        cattleName: o.cattleName || o.name || o.title || o.animal || "Livestock Cattle",
        breed: o.breed || o.cattleBreed || "Amritmahal",
        species: o.species || o.animalType || o.category || "Cow",
        tagNo: o.tagNo || o.tagNumber || o.earTagNo || o.rfid || o.cattleTag || "—",
        image: formattedImg,
        buyerName,
        buyerPhone,
        buyerLocation,
        sellerName,
        sellerPhone,
        farmName: o.farmName || "—",
        price: totalAmount,
        totalAmount,
        amount: totalAmount,
        tokenAmount,
        balanceAmount,
        paymentMethod: o.paymentMethod || o.paymentMode || o.method || "Escrow / Online",
        paymentStatus: o.paymentStatus || o.paymentState || o.status || "Ordered",
        invoiceNumber: o.invoiceNo || o.invoiceNumber || (invoiceUrl ? `INV-${orderKey.slice(-8)}` : "—"),
        invoiceUrl,
        status: o.status || "Ordered",
        createdAt: o.createdAt || o.date || o.timestamp || null,
        updatedAt: o.updatedAt || null,
      });
    };

    cSnap.docs?.forEach(addDoc);
    rSnap.docs?.forEach(addDoc);
    legacySnap.docs?.forEach(addDoc);
    groupCattleOrdersSnap.docs?.forEach(addDoc);

    // Also include orders from generic 'orders' collection if they are cattle orders
    genericOrdersSnap.docs?.forEach((doc) => {
      const data = doc.data() || {};
      const type = String(data.orderType || data.type || data.category || "").toLowerCase();
      if (type.includes("cattle") || type.includes("livestock") || data.cattleId || data.animal) {
        addDoc(doc);
      }
    });

    const sortedOrders = Array.from(ordersMap.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    const payload = { orders: sortedOrders };
    setCache("admin_cattle_orders", payload);
    res.json(payload);
  } catch (error) {
    console.error("Error in /api/admin/cattle-orders:", error);
    res.status(500).json({ error: error.message, orders: [] });
  }
});

function extractCleanString(val, fallback = "—") {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    if (typeof val.en === "string" && val.en.trim()) return val.en;
    if (typeof val.hi === "string" && val.hi.trim()) return val.hi;
    if (typeof val.mr === "string" && val.mr.trim()) return val.mr;
    if (val.key !== undefined) return extractCleanString(val.key, fallback);
    if (val.name !== undefined) return extractCleanString(val.name, fallback);
    if (val.title !== undefined) return extractCleanString(val.title, fallback);
    for (const k of Object.keys(val)) {
      if (typeof val[k] === "string" && val[k].trim()) return val[k];
      if (typeof val[k] === "number") return String(val[k]);
    }
  }
  return fallback;
}

function parseNumericPrice(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (typeof val === "object") {
    if (val.amount !== undefined) return parseNumericPrice(val.amount);
    if (val.value !== undefined) return parseNumericPrice(val.value);
    if (val.price !== undefined) return parseNumericPrice(val.price);
    if (val.en !== undefined) return parseNumericPrice(val.en);
    for (const k of Object.keys(val)) {
      const p = parseNumericPrice(val[k]);
      if (p > 0) return p;
    }
    return 0;
  }
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function extractPriceFromDoc(item) {
  if (!item) return 0;
  const candidates = [
    item.price,
    item.expectedPrice,
    item.expected_price,
    item.amount,
    item.expectedAmount,
    item.expected_amount,
    item.cattlePrice,
    item.cattle_price,
    item.sellingPrice,
    item.selling_price,
    item.salePrice,
    item.sale_price,
    item.rate,
    item.cost,
    item.value,
    item.marketValue,
    item.market_value,
    item.basePrice,
    item.base_price,
    item.pricing,
    item.priceDetails?.price,
    item.priceDetails?.amount,
    item.details?.price,
    item.details?.amount,
    item.marketplaceData?.price,
    item.cattleDetails?.price,
    item.data?.price,
  ];
  for (const c of candidates) {
    const p = parseNumericPrice(c);
    if (p > 0) return p;
  }
  return 0;
}

// REST API to list all Cattle Register Details strictly from /users/{userId}/roles/farmer/farms/{farmId}/cattles/{cattleId}
app.get("/api/admin/cattle", async (req, res) => {
  try {
    const cached = getCached("admin_cattle", 600000);
    if (cached) return res.json(cached);

    const db = getFirestore();
    const [groupCattlesSnap, groupCattleSingularSnap, groupFarmsSnap, usersSnap] = await Promise.all([
      db.collectionGroup("cattles").get().catch(() => ({ docs: [] })),
      db.collectionGroup("cattle").get().catch(() => ({ docs: [] })),
      db.collectionGroup("farms").get().catch(() => ({ docs: [] })),
      db.collection("users").get().catch(() => ({ docs: [] })),
    ]);

    const usersMap = new Map();
    usersSnap.docs.forEach((d) => {
      const uData = d.data();
      usersMap.set(d.id, { id: d.id, ...uData });
      if (uData.uid) usersMap.set(uData.uid, { id: d.id, ...uData });
    });

    const farmsMap = new Map();
    groupFarmsSnap.docs.forEach((fDoc) => {
      const fData = fDoc.data();
      farmsMap.set(fDoc.id, { id: fDoc.id, ...fData });
    });

    const cattleMap = new Map();

    const processCattleItem = (item, sourceName) => {
      if (!item) return;
      const tag = extractCleanString(item.tagNo || item.tagNumber || item.earTagNo || item.rfid || "", "");
      const cattleKey = tag || String(item.cattleId || item.id || "");
      if (!cattleKey) return;

      const ownerUid = extractCleanString(item.ownerUid || item.sellerId || item.farmerId || item.userId || item.uid || item.postedBy, "");
      const ownerUser = usersMap.get(ownerUid) || {};

      const farmId = extractCleanString(item.farmId, "—");
      const farmInfo = farmsMap.get(farmId) || {};
      const farmName = extractCleanString(item.farmName || farmInfo.name || farmInfo.farmName, "—");

      const ownerName = extractCleanString(
        item.ownerName ||
        item.sellerName ||
        item.farmerName ||
        ownerUser.name ||
        ownerUser.displayName ||
        (ownerUid ? `Farmer (${ownerUid.slice(0, 8)}...)` : "iHerd Farmer"),
        "iHerd Farmer"
      );

      const ownerPhone = extractCleanString(
        item.sellerPhone ||
        item.phone ||
        item.phoneNumber ||
        ownerUser.phoneNumber ||
        ownerUser.phone,
        "—"
      );

      const rawImgObj = (item.images && typeof item.images === "object" && !Array.isArray(item.images)) ? item.images : {};
      const faceView = item.faceViewImagePath || item.faceView || item.face || item.frontView || rawImgObj.frontView || rawImgObj.faceView || rawImgObj.face || (Array.isArray(item.images) && item.images[0]) || item.imageUrl || null;
      const leftView = item.leftViewImagePath || item.leftView || rawImgObj.leftView || (Array.isArray(item.images) && item.images[1]) || null;
      const rightView = item.rightViewImagePath || item.rightView || rawImgObj.rightView || (Array.isArray(item.images) && item.images[2]) || null;
      const muzzleView = item.muzzleViewImagePath || item.muzzleView || rawImgObj.muzzleView || null;
      const udderView = item.udderViewImagePath || item.udderView || rawImgObj.udderView || null;
      const bottomView = item.topViewImagePath || item.bottomView || item.topview || item.rearView || rawImgObj.bottomView || rawImgObj.topview || rawImgObj.rearView || null;
      const farmerView = item.farmerViewImagePath || item.farmerView || item.farmerWithCattle || rawImgObj.farmerView || rawImgObj.farmerWithCattle || null;

      const allCattleImages = [
        faceView,
        leftView,
        rightView,
        muzzleView,
        udderView,
        bottomView,
        farmerView,
        ...(Array.isArray(item.images) ? item.images : []),
        ...(Array.isArray(item.photos) ? item.photos : []),
        ...(typeof item.images === "object" && item.images ? Object.values(item.images) : []),
        item.imageUrl,
        item.image,
      ].filter((u) => typeof u === "string" && u.trim().length > 0 && !u.startsWith("data:"));
      const uniqueCattleImages = Array.from(new Set(allCattleImages));

      const title = extractCleanString(item.cattleName || item.title || item.name, item.tagNo ? `Cattle #${item.tagNo}` : "Dairy Cattle");
      const breed = extractCleanString(item.breed, "—");
      const species = extractCleanString(item.species || item.animalType, "Cow");
      const rfid = extractCleanString(item.rfid || item.tagNo, cattleKey);
      const status = extractCleanString(item.status || (item.onSale ? "On Sale" : "Active"), "Active");
      const price = extractPriceFromDoc(item);

      const rawDate = item.createdAt || item.registeredAt || item.date || null;

      const enriched = {
        id: item.id || cattleKey,
        docId: item.id || cattleKey,
        cattleId: item.id || cattleKey,
        title,
        cattleName: title,
        breed,
        species,
        rfid,
        tagNo: rfid,
        gender: extractCleanString(item.gender || item.sex, "Female"),
        color: extractCleanString(item.color || item.cattleColor, "—"),
        age: extractCleanString(item.age || item.ageYears || item.ageInMonths, "—"),
        weight: extractCleanString(item.weight || item.weightKg, "—"),
        height: extractCleanString(item.height || item.heightCm, "—"),
        horns: extractCleanString(item.horns || item.hornType, "—"),
        castrated: item.castrated ?? item.isCastrated ?? null,
        milkYield: extractCleanString(item.milkYield || item.dailyYield || item.milkCapacity || item.yield, "—"),
        peakMilkYield: extractCleanString(item.peakMilkYield || item.maxYield, "—"),
        parity: extractCleanString(item.parity || item.lactation || item.lactationNumber || item.calvingCount, "—"),
        pregnant: item.pregnant ?? item.isPregnant ?? null,
        pregnancyMonth: extractCleanString(item.pregnancyMonth || item.pregnancyMonths, "—"),
        healthStatus: extractCleanString(item.healthStatus || item.condition || item.health, "Healthy"),
        vaccinated: Boolean(item.vaccinated || item.vaccinationStatus === "Vaccinated" || item.isVaccinated),
        dewormed: Boolean(item.dewormed || item.dewormingStatus === "Dewormed"),
        insurance: Boolean(item.insurance || item.isInsured),
        insuranceNumber: extractCleanString(item.insuranceNumber || item.policyNumber, "—"),
        price: Number(price) || 0,
        value: extractCleanString(item.value || price, "—"),
        fatherTagNo: extractCleanString(item.fatherTagNo || item.sireTag, "—"),
        motherTagNo: extractCleanString(item.motherTagNo || item.damTag, "—"),
        description: extractCleanString(item.description || item.notes || item.about || item.remarks, ""),
        status,
        ownerUid,
        ownerName,
        ownerPhone,
        farmId,
        farmName,
        village: extractCleanString(item.village || farmInfo.village || ownerUser.village, "—"),
        district: extractCleanString(item.district || farmInfo.district || ownerUser.district, "—"),
        state: extractCleanString(item.state || farmInfo.state || ownerUser.state, "—"),
        pincode: extractCleanString(item.pincode || farmInfo.pincode || ownerUser.pincode, "—"),
        faceView,
        leftView,
        rightView,
        muzzleView,
        udderView,
        bottomView,
        farmerView,
        images: uniqueCattleImages,
        source: sourceName,
        _path: item._path || item.path || "",
        createdAt: rawDate,
        raw: item,
      };

      if (!cattleMap.has(cattleKey)) {
        cattleMap.set(cattleKey, enriched);
      } else {
        const existing = cattleMap.get(cattleKey);
        cattleMap.set(cattleKey, {
          ...existing,
          ...enriched,
          milkYield: (enriched.milkYield && enriched.milkYield !== "—") ? enriched.milkYield : existing.milkYield,
          parity: (enriched.parity && enriched.parity !== "—") ? enriched.parity : existing.parity,
          insurance: enriched.insurance || existing.insurance,
          farmName: (enriched.farmName && enriched.farmName !== "—") ? enriched.farmName : existing.farmName,
        });
      }
    };

    // 1. Process collectionGroup('cattles') and collectionGroup('cattle')
    const allGroupDocs = [...groupCattlesSnap.docs, ...groupCattleSingularSnap.docs];
    allGroupDocs.forEach((cd) => {
      const pathParts = cd.ref.path.split("/");
      let pathOwnerUid = "";
      let pathFarmId = "";
      const uIdx = pathParts.indexOf("users");
      if (uIdx !== -1 && uIdx + 1 < pathParts.length) {
        pathOwnerUid = pathParts[uIdx + 1];
      }
      const fIdx = pathParts.indexOf("farms");
      if (fIdx !== -1 && fIdx + 1 < pathParts.length) {
        pathFarmId = pathParts[fIdx + 1];
      }
      const farmInfo = farmsMap.get(pathFarmId) || {};
      processCattleItem({
        id: cd.id,
        _path: cd.ref.path,
        ownerUid: pathOwnerUid,
        farmId: pathFarmId,
        farmName: farmInfo.name || farmInfo.farmName,
        ...cd.data(),
      }, "nested_farm_cattle");
    });

    // 2. Also iterate all farms to retrieve subcollections directly
    for (const fDoc of groupFarmsSnap.docs) {
      try {
        const [farmCattlesSnap, farmCattleSingularSnap] = await Promise.all([
          fDoc.ref.collection("cattles").get().catch(() => ({ docs: [] })),
          fDoc.ref.collection("cattle").get().catch(() => ({ docs: [] })),
        ]);
        const pathParts = fDoc.ref.path.split("/");
        const uIdx = pathParts.indexOf("users");
        const pathOwnerUid = uIdx !== -1 && uIdx + 1 < pathParts.length ? pathParts[uIdx + 1] : "";
        const fData = fDoc.data() || {};
        
        [...farmCattlesSnap.docs, ...farmCattleSingularSnap.docs].forEach((cd) => {
          processCattleItem({
            id: cd.id,
            _path: cd.ref.path,
            ownerUid: pathOwnerUid,
            farmId: fDoc.id,
            farmName: fData.name || fData.farmName,
            ...cd.data(),
          }, "nested_farm_cattle");
        });
      } catch (e) {}
    }

    const sortedCattle = Array.from(cattleMap.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    console.log(`Fetched and enriched ${sortedCattle.length} cattle register records strictly from farm subcollections`);
    const payload = { cattle: sortedCattle };
    setCache("admin_cattle", payload);
    res.json(payload);
  } catch (error) {
    console.error("Error in /api/admin/cattle:", error);
    res.status(500).json({ error: error.message, cattle: [] });
  }
});

// REST API to list all Cattle Marketplace listings directly from /cattle-marketplace
app.get("/api/admin/cattle-marketplace", async (req, res) => {
  try {
    const cached = getCached("admin_cattle_marketplace", 600000);
    if (cached) return res.json(cached);

    const db = getFirestore();
    const [cmSnap, usersSnap] = await Promise.all([
      db.collection("cattle-marketplace").get().catch(() => ({ docs: [] })),
      db.collection("users").get().catch(() => ({ docs: [] })),
    ]);

    const usersMap = new Map();
    usersSnap.docs.forEach((d) => {
      const uData = d.data();
      usersMap.set(d.id, { id: d.id, ...uData });
      if (uData.uid) usersMap.set(uData.uid, { id: d.id, ...uData });
    });

    const listings = cmSnap.docs.map((d) => {
      const item = { id: d.id, ...d.data() };
      const cattleKey = String(item.cattleId || item.rfid || item.tagNo || d.id || "");
      const ownerUid = extractCleanString(item.ownerUid || item.sellerId || item.farmerId || item.userId || item.uid || item.postedBy, "");
      const ownerUser = usersMap.get(ownerUid) || {};

      const ownerName = extractCleanString(
        item.sellerName ||
        item.ownerName ||
        item.farmerName ||
        ownerUser.name ||
        ownerUser.displayName ||
        (ownerUid ? `Farmer (${ownerUid.slice(0, 8)}...)` : "iHerd Seller"),
        "iHerd Seller"
      );

      const ownerPhone = extractCleanString(
        item.sellerPhone ||
        item.phone ||
        item.phoneNumber ||
        item.contactPhone ||
        item.mobile ||
        ownerUser.sellerPhoneNumber ||
        ownerUser.farmerPhoneNumber ||
        ownerUser.phoneNumber ||
        ownerUser.phone,
        "—"
      );

      const rawImgObj = (item.images && typeof item.images === "object" && !Array.isArray(item.images)) ? item.images : {};
      const faceView = item.faceViewImagePath || item.faceView || item.face || item.frontView || rawImgObj.frontView || rawImgObj.faceView || rawImgObj.face || (Array.isArray(item.images) && item.images[0]) || item.imageUrl || null;
      const leftView = item.leftViewImagePath || item.leftView || rawImgObj.leftView || (Array.isArray(item.images) && item.images[1]) || null;
      const rightView = item.rightViewImagePath || item.rightView || rawImgObj.rightView || (Array.isArray(item.images) && item.images[2]) || null;
      const muzzleView = item.muzzleViewImagePath || item.muzzleView || rawImgObj.muzzleView || null;
      const udderView = item.udderViewImagePath || item.udderView || rawImgObj.udderView || null;
      const bottomView = item.topViewImagePath || item.bottomView || item.topview || item.rearView || rawImgObj.bottomView || rawImgObj.topview || rawImgObj.rearView || null;
      const farmerView = item.farmerViewImagePath || item.farmerView || item.farmerWithCattle || rawImgObj.farmerView || rawImgObj.farmerWithCattle || null;

      const allCattleImages = [
        faceView,
        leftView,
        rightView,
        muzzleView,
        udderView,
        bottomView,
        farmerView,
        ...(Array.isArray(item.images) ? item.images : []),
        ...(Array.isArray(item.photos) ? item.photos : []),
        ...(typeof item.images === "object" && item.images ? Object.values(item.images) : []),
        item.imageUrl,
        item.image,
      ].filter((u) => typeof u === "string" && u.trim().length > 0 && !u.startsWith("data:"));
      const images = Array.from(new Set(allCattleImages));

      const title = extractCleanString(item.title || item.cattleName || item.name, item.tagNo ? `Cattle #${item.tagNo}` : "Dairy Cattle");
      const breed = extractCleanString(item.breed, "—");
      const species = extractCleanString(item.species || item.animalType, "Cow");
      const rfid = extractCleanString(item.rfid || item.tagNo || item.rfidTag, cattleKey);
      const status = extractCleanString(item.status || (item.onSale ? "On Sale" : "Available"), "On Sale");
      const price = extractPriceFromDoc(item);

      return {
        id: d.id,
        docId: d.id,
        cattleId: cattleKey,
        title,
        cattleName: title,
        breed,
        species,
        rfid,
        tagNo: rfid,
        gender: extractCleanString(item.gender || item.sex, "Female"),
        color: extractCleanString(item.color || item.cattleColor, "—"),
        age: extractCleanString(item.age || item.ageYears || item.ageInMonths || item.ageMonths, "—"),
        weight: extractCleanString(item.weight || item.weightKg, "—"),
        height: extractCleanString(item.height || item.heightCm, "—"),
        milkYield: extractCleanString(item.milkYield || item.dailyYield || item.milkCapacity || item.yield, "—"),
        peakMilkYield: extractCleanString(item.peakMilkYield || item.maxYield, "—"),
        parity: extractCleanString(item.parity || item.lactation || item.lactationNumber || item.calvingCount, "—"),
        pregnant: item.pregnant ?? item.isPregnant ?? null,
        pregnancyMonth: extractCleanString(item.pregnancyMonth || item.pregnancyMonths, "—"),
        healthStatus: extractCleanString(item.healthStatus || item.condition || item.health, "Healthy"),
        vaccinated: Boolean(item.vaccinated || item.vaccinationStatus === "Vaccinated" || item.isVaccinated),
        dewormed: Boolean(item.dewormed || item.dewormingStatus === "Dewormed"),
        insurance: Boolean(item.insurance || item.isInsured),
        insuranceNumber: extractCleanString(item.insuranceNumber || item.policyNumber, "—"),
        fatherTagNo: extractCleanString(item.fatherTagNo || item.sireTag, "—"),
        motherTagNo: extractCleanString(item.motherTagNo || item.damTag, "—"),
        description: extractCleanString(item.description || item.notes || item.about || item.remarks, ""),
        price,
        negotiable: Boolean(item.negotiable || item.isNegotiable),
        status,
        ownerUid,
        ownerName,
        ownerPhone,
        village: extractCleanString(item.village || ownerUser.village || item.location, "—"),
        district: extractCleanString(item.district || ownerUser.district, "—"),
        state: extractCleanString(item.state || ownerUser.state, "—"),
        pincode: extractCleanString(item.pincode || ownerUser.pincode, "—"),
        faceView,
        leftView,
        rightView,
        muzzleView,
        udderView,
        bottomView,
        farmerView,
        images,
        source: "cattle-marketplace",
        createdAt: item.createdAt || item.postedAt || item.timestamp || item.date || null,
        raw: item,
      };
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    console.log(`Fetched and enriched ${listings.length} listings from /cattle-marketplace`);
    const payload = { success: true, count: listings.length, cattle: listings };
    setCache("admin_cattle_marketplace", payload);
    res.json(payload);
  } catch (error) {
    console.error("Error in /api/admin/cattle-marketplace:", error);
    res.status(500).json({ error: error.message, cattle: [] });
  }
});

// REST API to list all Registered Farms from /users/{uid}/roles/farmer/farms & all collections
app.get("/api/admin/farms", async (req, res) => {
  try {
    const cached = getCached("admin_farms", 600000);
    if (cached) return res.json(cached);

    const db = getFirestore();
    const [groupFarmsSnap, usersSnap, cattleDetailsSnap, cattleMarketplaceSnap] = await Promise.all([
      db.collectionGroup("farms").get().catch(() => ({ docs: [] })),
      db.collection("users").get().catch(() => ({ docs: [] })),
      db.collection("cattle_details").get().catch(() => ({ docs: [] })),
      db.collection("cattle-marketplace").get().catch(() => ({ docs: [] })),
    ]);

    // Build users map
    const usersMap = new Map();
    usersSnap.docs.forEach((uDoc) => {
      const uData = uDoc.data();
      usersMap.set(uDoc.id, { id: uDoc.id, ...uData });
      if (uData.uid) usersMap.set(uData.uid, { id: uDoc.id, ...uData });
    });

    // Build cattle count map by owner UID and farm ID
    const cattleByOwner = new Map();
    const cattleByFarm = new Map();

    const processCattleForFarms = (cDoc) => {
      const c = cDoc.data ? cDoc.data() : cDoc;
      const owner = c.ownerUid || c.userId || c.farmerId || c.sellerId || c.postedBy;
      const farm = c.farmId;
      if (owner) {
        cattleByOwner.set(owner, (cattleByOwner.get(owner) || 0) + 1);
      }
      if (farm) {
        cattleByFarm.set(farm, (cattleByFarm.get(farm) || 0) + 1);
      }
    };

    cattleDetailsSnap.docs.forEach(processCattleForFarms);
    cattleMarketplaceSnap.docs.forEach(processCattleForFarms);

    const farmsMap = new Map();

    const addFarm = (f, sourcePath, defaultOwner = {}) => {
      if (!f) return;
      const farmKey = f.farmId || f.id;
      if (!farmKey) return;
      if (farmsMap.has(farmKey)) return;

      const ownerUid = f.userId || f.ownerUid || defaultOwner.id || defaultOwner.uid || "";
      const ownerName = f.ownerName || f.farmerName || defaultOwner.name || defaultOwner.displayName || "Registered Farmer";
      const farmPhone = f.farmPhoneNumber || f.farmerPhoneNumber || f.phone || defaultOwner.phoneNumber || defaultOwner.phone || "—";

      const realCattleCount = cattleByFarm.get(farmKey) || cattleByOwner.get(ownerUid) || Number(f.numberOfAnimals || f.cattleCount || 0);

      farmsMap.set(farmKey, {
        id: farmKey,
        farmId: farmKey,
        name: f.name || f.farmName || (ownerName ? `${ownerName}'s Dairy Farm` : "Registered Dairy Farm"),
        ownerUid,
        ownerName,
        farmPhoneNumber: farmPhone,
        animal: f.animal || "Cow / Cattle",
        farmTechnique: f.farmTechnique || "Modern Dairy Management",
        numberOfEmployees: f.numberOfEmployees || "1 - 2 Workers",
        farmEquipmentList: Array.isArray(f.farmEquipmentList) ? f.farmEquipmentList : [],
        village: f.village || defaultOwner.village || "—",
        taluk: f.taluk || defaultOwner.taluk || "—",
        postoffice: f.postoffice || defaultOwner.postoffice || "—",
        district: f.district || defaultOwner.district || "—",
        state: f.state || defaultOwner.state || "—",
        pincode: f.pincode || defaultOwner.pincode || "—",
        country: f.country || defaultOwner.country || "🇮🇳 India",
        address: f.address || defaultOwner.address || "—",
        latitude: f.latitude || null,
        longitude: f.longitude || null,
        veterinaryName: f.veterinaryName || null,
        veterinarianPhoneNumber: f.veterinarianPhoneNumber || null,
        imagePath: f.imagePath || f.imageUrl || null,
        sourcePath,
        cattleCount: realCattleCount,
        status: f.status || "Active",
        createdAt: f.createdAt || defaultOwner.createdAt || null,
      });
    };

    // 1. Process all farms from collectionGroup("farms")
    groupFarmsSnap.docs.forEach((fd) => {
      const fData = fd.data();
      const path = fd.ref.path;
      const pathSegments = path.split("/");

      let ownerUid = fData.ownerUid || fData.userId || "";
      if (!ownerUid && pathSegments[0] === "users" && pathSegments[1]) {
        ownerUid = pathSegments[1];
      } else if (!ownerUid && pathSegments[0] === "farmers" && pathSegments[1]) {
        ownerUid = pathSegments[1];
      }

      const defaultOwner = usersMap.get(ownerUid) || {};
      addFarm({ id: fd.id, ...fData }, path, { id: ownerUid, ...defaultOwner });
    });

    // 2. Also check explicit farm objects inside users documents (if any)
    usersSnap.docs.forEach((uDoc) => {
      const uData = uDoc.data();
      const uId = uDoc.id;
      if (uData.farms && typeof uData.farms === "object") {
        const farmObj = Array.isArray(uData.farms) ? uData.farms : [uData.farms];
        farmObj.forEach((fo, idx) => {
          if (fo && (fo.farmName || fo.name || fo.animal)) {
            addFarm({ id: fo.id || fo.farmId || `user-farm-${uId}-${idx}`, ...fo }, `/users/${uId}`, { id: uId, ...uData });
          }
        });
      }
    });

    const sortedFarms = Array.from(farmsMap.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    console.log(`[Backend /api/admin/farms] Fetched and enriched ${sortedFarms.length} registered farms via collectionGroup`);
    const payload = { farms: sortedFarms };
    setCache("admin_farms", payload);
    res.json(payload);
  } catch (error) {
    console.error("Error in /api/admin/farms:", error);
    res.status(500).json({ error: error.message, farms: [] });
  }
});

// Generic REST API endpoint for Firestore collectionGroup querying
app.get("/api/admin/collection-group/:collectionId", async (req, res) => {
  try {
    const { collectionId } = req.params;
    const db = getFirestore();

    if (collectionId === "farms") {
      const snap = await db.collectionGroup("farms").get().catch(() => ({ docs: [] }));
      const data = snap.docs.map((d) => ({ id: d.id, _path: d.ref.path, ...d.data() }));
      return res.json({ success: true, count: data.length, data, farms: data });
    }

    if (collectionId === "cattle" || collectionId === "cattles") {
      const [snap1, snap2] = await Promise.all([
        db.collectionGroup("cattles").get().catch(() => ({ docs: [] })),
        db.collectionGroup("cattle").get().catch(() => ({ docs: [] })),
      ]);
      const map = new Map();
      snap1.docs.forEach((d) => map.set(d.id, { id: d.id, _path: d.ref.path, ...d.data() }));
      snap2.docs.forEach((d) => map.set(d.id, { id: d.id, _path: d.ref.path, ...d.data() }));
      const data = Array.from(map.values());
      return res.json({ success: true, count: data.length, data, cattle: data });
    }

    const snap = await db.collectionGroup(collectionId).get().catch(() => ({ docs: [] }));
    const data = snap.docs.map((d) => ({ id: d.id, _path: d.ref.path, ...d.data() }));
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error(`Error in /api/admin/collection-group/${req.params.collectionId}:`, error);
    res.status(500).json({ error: error.message, data: [] });
  }
});

// REST API to list all Payments, Transactions & Commissions aggregated across orders
app.get("/api/admin/payments", async (req, res) => {
  try {
    const cached = getCached("admin_payments", 600000);
    if (cached) return res.json(cached);

    const db = getFirestore();
    const defaultBucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET || "auth-b404a.appspot.com";
    const bucket = getStorage().bucket(defaultBucketName);

    const [pSnap, cSnap, rSnap, tSnap, paySnap, usersSnap, invoiceFiles] = await Promise.all([
      db.collection("ProductOrders").get().catch(() => ({ docs: [] })),
      db.collection("CattleOrders").get().catch(() => ({ docs: [] })),
      db.collection("received_orders").get().catch(() => ({ docs: [] })),
      db.collection("token-advance").get().catch(() => ({ docs: [] })),
      db.collection("payments").get().catch(() => ({ docs: [] })),
      db.collection("users").get().catch(() => ({ docs: [] })),
      listFilesUnderPrefix(bucket, "invoices/").catch(() => []),
    ]);

    // Map invoices
    const invoiceMap = new Map();
    invoiceFiles.forEach((f) => {
      if (f.name && f.name.endsWith(".pdf") && f.url) {
        const parts = f.name.split("/");
        const fileName = parts[parts.length - 1].replace(/\.pdf$/i, "").toLowerCase();
        const folderName = (parts[1] || "").toLowerCase();
        if (folderName) invoiceMap.set(folderName, f.url);
        if (fileName) invoiceMap.set(fileName, f.url);
      }
    });

    // Map users
    const usersMap = new Map();
    usersSnap.docs.forEach((d) => {
      const uData = d.data();
      usersMap.set(d.id.toLowerCase(), { id: d.id, ...uData });
      if (uData.uid) usersMap.set(uData.uid.toLowerCase(), { id: d.id, ...uData });
    });

    const transactions = [];
    const seenTxnIds = new Set();

    // 1. Process Product Orders into Transactions
    pSnap.docs.forEach((doc) => {
      const po = { id: doc.id, ...doc.data() };
      const orderKey = po.orderId || po.id;
      const txnId = `TXN-PRD-${orderKey}`;
      if (seenTxnIds.has(txnId)) return;
      seenTxnIds.add(txnId);

      const uId = (po.userId || po.customerId || po.buyerId || "").toLowerCase();
      const userProfile = usersMap.get(uId) || {};

      const partyName =
        po.shippingAddress?.name ||
        po.buyerName ||
        userProfile.name ||
        userProfile.displayName ||
        (uId ? `Customer (${uId.slice(0, 8)}...)` : "Marketplace Buyer");

      const partyPhone =
        po.shippingAddress?.phone ||
        userProfile.phoneNumber ||
        userProfile.phone ||
        po.phoneNumber ||
        "—";

      const items = Array.isArray(po.items) ? po.items : [];
      const itemsTotal = items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
      const shippingFee = Number(po.shippingFee || 0);
      const discount = Number(po.discount || 0);
      const totalAmount = Number(po.totalAmount || (itemsTotal > 0 ? itemsTotal + shippingFee - discount : (po.price || po.amount || 0)));

      const invKey = (orderKey || "").toLowerCase();
      const invNoKey = (po.invoiceNumber || po.invoiceNo || "").toLowerCase();
      const invoiceUrl = invoiceMap.get(invKey) || invoiceMap.get(invNoKey) || po.invoiceUrl || null;

      const statusLower = (po.status || "").toLowerCase();
      let txnStatus = "Paid";
      if (statusLower.includes("cancel") || statusLower.includes("fail")) txnStatus = "Failed";
      else if (statusLower.includes("pend") || statusLower.includes("process")) txnStatus = "Pending";

      transactions.push({
        id: txnId,
        transactionId: txnId,
        orderId: orderKey,
        userId: po.userId || userProfile.id || null,
        party: partyName,
        partyPhone,
        type: "Product Purchase",
        category: "E-Commerce Store",
        method: po.paymentMethod || "UPI / Online Payment",
        amount: totalAmount,
        seller: po.sellerName || "iHerd Marketplace Store",
        itemsCount: items.length || 1,
        items,
        status: txnStatus,
        invoiceNumber: po.invoiceNumber || po.invoiceNo || (invoiceUrl ? `INV-${orderKey.slice(-8)}` : "—"),
        invoiceUrl,
        createdAt: po.createdAt || po.date || null,
      });
    });

    // 2. Process Cattle Orders into Transactions
    const cattleDocs = [...cSnap.docs, ...rSnap.docs];
    cattleDocs.forEach((doc) => {
      const co = { id: doc.id, ...doc.data() };
      const orderKey = co.orderId || co.id;
      const txnId = `TXN-CTL-${orderKey}`;
      if (seenTxnIds.has(txnId)) return;
      seenTxnIds.add(txnId);

      const buyerUid = (co.userId || co.buyerId || co.farmerId || "").toLowerCase();
      const sellerUid = (co.sellerId || co.ownerUid || "").toLowerCase();

      const buyerUser = usersMap.get(buyerUid) || {};
      const sellerUser = usersMap.get(sellerUid) || {};

      const partyName =
        co.shippingAddress?.name ||
        co.buyerName ||
        buyerUser.name ||
        buyerUser.displayName ||
        (buyerUid ? `Buyer (${buyerUid.slice(0, 8)}...)` : "Livestock Buyer");

      const partyPhone =
        co.shippingAddress?.phone ||
        buyerUser.phoneNumber ||
        co.phoneNumber ||
        "—";

      const totalAmount = Number(co.price || co.totalAmount || co.amount || 0);

      const invKey = (orderKey || "").toLowerCase();
      const invNoKey = (co.invoiceNo || co.invoiceNumber || "").toLowerCase();
      const invoiceUrl = invoiceMap.get(invKey) || invoiceMap.get(invNoKey) || co.invoiceUrl || null;

      const statusLower = (co.status || "").toLowerCase();
      let txnStatus = "Paid";
      if (statusLower.includes("cancel") || statusLower.includes("fail")) txnStatus = "Failed";
      else if (statusLower.includes("pend") || statusLower.includes("escrow")) txnStatus = "Pending";

      transactions.push({
        id: txnId,
        transactionId: txnId,
        orderId: orderKey,
        userId: co.userId || buyerUser.id || null,
        sellerId: co.sellerId || sellerUser.id || null,
        party: partyName,
        partyPhone,
        type: "Cattle Order / Purchase",
        category: "Livestock Marketplace",
        method: co.paymentMethod || "Bank Escrow / UPI",
        amount: totalAmount,
        seller: co.sellerName || co.owner || sellerUser.name || "Verified Farmer",
        cattleName: co.cattleName || co.name || "Livestock Cattle",
        breed: co.breed || "Amritmahal",
        status: txnStatus,
        invoiceNumber: co.invoiceNo || co.invoiceNumber || (invoiceUrl ? `INV-${orderKey.slice(-8)}` : "—"),
        invoiceUrl,
        createdAt: co.createdAt || co.date || null,
      });
    });

    // 3. Process Token Advances
    tSnap.docs.forEach((doc) => {
      if (doc.id === "token-advance" && !doc.data().userId && !doc.data().farmerId) return;
      const tok = { id: doc.id, ...doc.data() };
      const orderKey = tok.orderId || tok.id;
      const txnId = `TXN-TOK-${orderKey}`;
      if (seenTxnIds.has(txnId)) return;
      seenTxnIds.add(txnId);

      const uId = (tok.userId || tok.farmerId || tok.uid || "").toLowerCase();
      const userProfile = usersMap.get(uId) || {};

      const partyName = userProfile.name || userProfile.displayName || tok.name || (uId ? `Farmer (${uId.slice(0, 8)}...)` : "Farmer");
      const partyPhone = userProfile.phoneNumber || tok.phone || "—";
      const amount = Number(tok.amount || tok.advanceAmount || tok.tokenAmount || 0);

      const invKey = (orderKey || "").toLowerCase();
      const invoiceUrl = invoiceMap.get(invKey) || tok.invoiceUrl || null;

      transactions.push({
        id: txnId,
        transactionId: txnId,
        orderId: orderKey,
        userId: tok.userId || userProfile.id || null,
        party: partyName,
        partyPhone,
        type: "Token Advance Deposit",
        category: "Livestock Reservation",
        method: "UPI / Direct Advance",
        amount,
        seller: "Platform Escrow",
        status: tok.status === "Approved" || tok.status === "Paid" ? "Paid" : "Pending",
        invoiceNumber: tok.invoiceNumber || (invoiceUrl ? `INV-${orderKey.slice(-8)}` : "—"),
        invoiceUrl,
        createdAt: tok.createdAt || tok.date || null,
      });
    });

    // 4. Also append any direct payments docs
    paySnap.docs.forEach((doc) => {
      const p = { id: doc.id, ...doc.data() };
      if (!seenTxnIds.has(doc.id)) {
        seenTxnIds.add(doc.id);
        transactions.push({
          id: doc.id,
          transactionId: p.transactionId || doc.id,
          orderId: p.orderId || doc.id,
          party: p.party || p.name || p.userName || "User",
          partyPhone: p.phone || "—",
          type: p.type || "General Payment",
          category: p.category || "Financial",
          method: p.method || p.paymentMethod || "Online",
          amount: Number(p.amount || 0),
          seller: p.seller || "iHerd Admin",
          status: p.status || "Paid",
          invoiceNumber: p.invoiceNumber || "—",
          invoiceUrl: p.invoiceUrl || null,
          createdAt: p.createdAt || p.date || null,
        });
      }
    });

    // Sort newest transactions first
    transactions.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    console.log(`Fetched and enriched ${transactions.length} total payment transactions`);
    const payload = {
      payments: transactions,
      summary: {
        totalTransactions: transactions.length,
        totalVolume: transactions.reduce((sum, t) => sum + t.amount, 0),
        paidCount: transactions.filter((t) => t.status === "Paid").length,
        pendingCount: transactions.filter((t) => t.status === "Pending").length,
        failedCount: transactions.filter((t) => t.status === "Failed").length,
      },
    };
    setCache("admin_payments", payload);
    res.json(payload);
  } catch (error) {
    console.error("Error in /api/admin/payments:", error);
    res.status(500).json({ error: error.message, payments: [], summary: {} });
  }
});

// REST API to get and update Token Advance rates
app.get("/api/admin/token-advance", async (req, res) => {
  try {
    const cached = getCached("admin_token_advance", 600000);
    if (cached) return res.json(cached);

    const db = getFirestore();
    const snap = await db.collection("token-advance").get();
    const docs = [];
    let rates = { cow: 200, buffalo: 250, goat: 100, sheep: 50 };

    snap.forEach((doc) => {
      const data = doc.data();
      docs.push({ id: doc.id, ...data });
      if (doc.id === "token-advance" || doc.id === "default") {
        rates = { ...rates, ...data };
      }
    });

    const payload = { rates, items: docs };
    setCache("admin_token_advance", payload);
    res.json(payload);
  } catch (error) {
    console.error("Error in /api/admin/token-advance GET:", error);
    res.status(500).json({ error: error.message, rates: { cow: 200, buffalo: 250, goat: 100, sheep: 50 }, items: [] });
  }
});

app.post("/api/admin/token-advance", async (req, res) => {
  try {
    const db = getFirestore();
    const { cow, buffalo, goat, sheep, ...otherRates } = req.body;
    const docId = req.body.id || "token-advance";
    
    const updateData = {
      cow: Number(cow) || 0,
      buffalo: Number(buffalo) || 0,
      goat: Number(goat) || 0,
      sheep: Number(sheep) || 0,
      ...otherRates,
      updatedAt: new Date().toISOString(),
    };

    await db.collection("token-advance").doc(docId).set(updateData, { merge: true });
    clearCache("admin_token_advance");
    console.log(`Updated token advance rates in doc ${docId}:`, updateData);
    res.json({ success: true, rates: updateData });
  } catch (error) {
    console.error("Error in /api/admin/token-advance POST:", error);
    res.status(500).json({ error: error.message });
  }
});

// REST API for Coupons
app.get("/api/admin/coupons", async (req, res) => {
  try {
    const cached = getCached("admin_coupons", 600000);
    if (cached) return res.json(cached);

    const db = getFirestore();
    const snap = await db.collection("product_marketplace").doc("main").collection("coupons_code").get();
    const coupons = [];
    
    snap.forEach((doc) => {
      const data = doc.data();
      let expiresAtFormatted = null;
      if (data.expiresAt) {
        if (data.expiresAt.toDate) {
          expiresAtFormatted = data.expiresAt.toDate().toISOString();
        } else if (data.expiresAt._seconds) {
          expiresAtFormatted = new Date(data.expiresAt._seconds * 1000).toISOString();
        } else if (data.expiresAt.seconds) {
          expiresAtFormatted = new Date(data.expiresAt.seconds * 1000).toISOString();
        } else {
          expiresAtFormatted = data.expiresAt;
        }
      }

      coupons.push({
        id: doc.id,
        ...data,
        expiresAtFormatted,
        usedCount: Array.isArray(data.usedUserIds) ? data.usedUserIds.filter(Boolean).length : 0,
      });
    });

    const payload = { coupons };
    setCache("admin_coupons", payload);
    res.json(payload);
  } catch (error) {
    console.error("Error in /api/admin/coupons GET:", error);
    res.status(500).json({ error: error.message, coupons: [] });
  }
});

app.post("/api/admin/coupons", async (req, res) => {
  try {
    const db = getFirestore();
    const {
      code,
      type = "PERCENT",
      value = 0,
      minOrder = 0,
      maxDiscount = 1000,
      active = true,
      expiresAt,
      allowedFlow = "PRODUCT",
      excludedProductIds = [],
      productIds = [],
      usedUserIds,
      includeUsedUserIds,
    } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: "Coupon code is required" });
    }

    const docId = code.trim().toUpperCase();
    const couponData = {
      code: code.trim(),
      type: type.toUpperCase(),
      value: Number(value) || 0,
      minOrder: Number(minOrder) || 0,
      maxDiscount: Number(maxDiscount) || 0,
      active: Boolean(active),
      allowedFlow,
      excludedProductIds: Array.isArray(excludedProductIds) ? excludedProductIds : [],
      productIds: Array.isArray(productIds) ? productIds : [],
      updatedAt: new Date().toISOString(),
    };

  // For coupon Code used Selection 
    if (Array.isArray(usedUserIds)) {
      couponData.usedUserIds = usedUserIds;
    } else if (includeUsedUserIds) {
      couponData.usedUserIds = [];
    }

    if (expiresAt) {
      couponData.expiresAt = new Date(expiresAt);
    }

    await db.collection("product_marketplace").doc("main").collection("coupons_code").doc(docId).set(couponData, { merge: true });
    clearCache("admin_coupons");
    console.log(`Created/Updated coupon: ${docId}`);
    res.json({ success: true, id: docId, coupon: couponData });
  } catch (error) {
    console.error("Error in /api/admin/coupons POST:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/admin/coupons/:id", async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    
    if (updateData.expiresAt && typeof updateData.expiresAt === "string") {
      updateData.expiresAt = new Date(updateData.expiresAt);
    }

    await db.collection("product_marketplace").doc("main").collection("coupons_code").doc(id).set(updateData, { merge: true });
    clearCache("admin_coupons");
    console.log(`Updated coupon: ${id}`);
    res.json({ success: true, id, updated: updateData });
  } catch (error) {
    console.error(`Error in /api/admin/coupons/${req.params.id} PUT:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/admin/coupons/:id", async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    await db.collection("product_marketplace").doc("main").collection("coupons_code").doc(id).delete();
    clearCache("admin_coupons");
    console.log(`Deleted coupon: ${id}`);
    res.json({ success: true, id });
  } catch (error) {
    console.error(`Error in /api/admin/coupons/${req.params.id} DELETE:`, error);
    res.status(500).json({ error: error.message });
  }
});

// REST API for Best Sellers & Product Marketplace
app.get("/api/admin/best-sellers", async (req, res) => {
  try {
    const cached = getCached("admin_best_sellers", 600000);
    if (cached) return res.json(cached);

    const db = getFirestore();
    const [pSnap, bsSnap] = await Promise.all([
      db.collection("product_marketplace").doc("main").collection("products").get().catch(() => ({ docs: [] })),
      db.collection("product_marketplace").doc("main").collection("best_seller").get().catch(() => ({ docs: [] })),
    ]);

    const bestSellerIds = new Set();
    bsSnap.docs?.forEach((d) => bestSellerIds.add(d.id));

    const products = [];
    pSnap.docs?.forEach((doc) => {
      const data = doc.data();
      const isBs = Boolean(data.bestSeller || data.isBestSeller || bestSellerIds.has(doc.id));
      if (isBs) {
        products.push({ id: doc.id, ...data, bestSeller: true });
      }
    });

    const payload = { bestSellers: products, totalCount: products.length };
    setCache("admin_best_sellers", payload);
    res.json(payload);
  } catch (error) {
    console.error("Error in /api/admin/best-sellers GET:", error);
    res.status(500).json({ error: error.message, bestSellers: [] });
  }
});

app.post("/api/admin/best-sellers/toggle", async (req, res) => {
  try {
    const db = getFirestore();
    const { productId, isBestSeller } = req.body;
    
    if (!productId) {
      return res.status(400).json({ error: "productId is required" });
    }

    const prodRef = db.collection("product_marketplace").doc("main").collection("products").doc(productId);
    const prodDoc = await prodRef.get();
    
    if (!prodDoc.exists) {
      return res.status(404).json({ error: "Product not found" });
    }

    const prodData = prodDoc.data();
    const newStatus = isBestSeller !== undefined ? Boolean(isBestSeller) : !prodData.bestSeller;

    // Update product document
    await prodRef.update({
      bestSeller: newStatus,
      isBestSeller: newStatus,
      updatedAt: new Date().toISOString(),
    });

    // Also sync to best_seller collection
    const bsRef = db.collection("product_marketplace").doc("main").collection("best_seller").doc(productId);
    if (newStatus) {
      await bsRef.set({
        ...prodData,
        id: productId,
        bestSeller: true,
        isBestSeller: true,
        featuredAt: new Date().toISOString(),
      }, { merge: true });
    } else {
      await bsRef.delete().catch(() => {});
    }

    clearCache("admin_products");
    clearCache();
    console.log(`Toggled bestSeller for ${productId} to ${newStatus}`);
    res.json({ success: true, productId, bestSeller: newStatus });
  } catch (error) {
    console.error("Error in /api/admin/best-sellers/toggle:", error);
    res.status(500).json({ error: error.message });
  }
});

// REST API: Register a seller with Admin SDK
app.post("/api/admin/sellers", async (req, res) => {
  try {
    const db = getFirestore();
    const sellerData = req.body;
    if (!sellerData) return res.status(400).json({ error: "Missing seller data payload" });
    const docRef = await db.collection("sellers").add({
      ...sellerData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    clearCache();
    res.json({ success: true, id: docRef.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST API: Register a veterinarian with Admin SDK
app.post("/api/admin/vets", async (req, res) => {
  try {
    const db = getFirestore();
    const vetData = req.body;
    if (!vetData) return res.status(400).json({ error: "Missing vet data payload" });
    const docRef = await db.collection("vets").add({
      ...vetData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    clearCache();
    res.json({ success: true, id: docRef.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST API for Products CRUD
app.get("/api/admin/products", async (req, res) => {
  try {
    if (!req.query.refresh && !req.query.force) {
      const cached = getCached("admin_products", 600000);
      if (cached) return res.json(cached);
    }

    const db = getFirestore();
    const snap = await db.collection("product_marketplace").doc("main").collection("products").get();
    const products = [];
    snap.forEach((doc) => {
      products.push({ id: doc.id, ...doc.data() });
    });
    const payload = { products, total: products.length };
    setCache("admin_products", payload);
    res.json(payload);
  } catch (error) {
    console.error("Error in /api/admin/products GET:", error);
    res.status(500).json({ error: error.message, products: [] });
  }
});

const normalizeToMultiLangMap = (val) => {
  if (!val) return { en: "", hi: "", kn: "", mr: "", pa: "", ta: "", id: "" };
  if (typeof val === "object" && !Array.isArray(val)) {
    const base = val.en || val.hi || Object.values(val)[0] || "";
    return {
      en: val.en || base,
      hi: val.hi || base,
      kn: val.kn || base,
      mr: val.mr || base,
      pa: val.pa || base,
      ta: val.ta || base,
      id: val.id || base,
    };
  }
  const str = String(val);
  return { en: str, hi: str, kn: str, mr: str, pa: str, ta: str, id: str };
};

app.post("/api/admin/products", async (req, res) => {
  try {
    const db = getFirestore();
    const { id, name, price, mrp, categoryId, subCategoryId, stock, quantity, quantityUnit, weight, weightUnit, description, instructionsToUse, gst, sellerName, sellerType, thumbnailUrl, imageUrls, bestSeller, status } = req.body;

    const prodId = id || `PRD-${Date.now()}`;
    const productData = {
      id: prodId,
      name: normalizeToMultiLangMap(name),
      price: Number(price) || 0,
      mrp: Number(mrp) || Number(price) || 0,
      categoryId: categoryId || "cat_disease_management",
      subCategoryId: subCategoryId || "subcat_breeding_detection",
      stock: Number(stock) || 100,
      quantity: Number(quantity) || 1,
      quantityUnit: normalizeToMultiLangMap(quantityUnit || "Unit"),
      weight: Number(weight) || 0,
      weightUnit: normalizeToMultiLangMap(weightUnit || "g"),
      description: normalizeToMultiLangMap(description),
      instructionsToUse: normalizeToMultiLangMap(instructionsToUse),
      gst: Number(gst) || 0,
      sellerName: normalizeToMultiLangMap(sellerName || "iHerd Official"),
      sellerType: sellerType || "seller",
      thumbnailUrl: thumbnailUrl || null,
      imageUrls: Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : thumbnailUrl ? [thumbnailUrl] : [],
      bestSeller: Boolean(bestSeller),
      isBestSeller: Boolean(bestSeller),
      isActive: req.body.isActive === undefined ? true : Boolean(req.body.isActive),
      status: status || "Approved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (req.body.deliveryConfig === null) {
      delete productData.deliveryConfig;
    } else if (req.body.deliveryConfig) {
      productData.deliveryConfig = req.body.deliveryConfig;
    }

    await db.collection("product_marketplace").doc("main").collection("products").doc(prodId).set(productData, { merge: true });

    if (productData.bestSeller) {
      await db.collection("product_marketplace").doc("main").collection("best_seller").doc(prodId).set({ ...productData, featuredAt: new Date().toISOString() }, { merge: true });
    }

    clearCache("admin_products");
    clearCache("admin_best_sellers");

    console.log(`Created/Updated product ${prodId}`);
    res.json({ success: true, id: prodId, product: productData });
  } catch (error) {
    console.error("Error in /api/admin/products POST:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/admin/products/:id", async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    const body = req.body;
    
    const updateData = {
      ...body,
      updatedAt: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = normalizeToMultiLangMap(body.name);
    if (body.sellerName !== undefined) updateData.sellerName = normalizeToMultiLangMap(body.sellerName);
    if (body.description !== undefined) updateData.description = normalizeToMultiLangMap(body.description);
    if (body.instructionsToUse !== undefined) updateData.instructionsToUse = normalizeToMultiLangMap(body.instructionsToUse);
    if (body.quantityUnit !== undefined) updateData.quantityUnit = normalizeToMultiLangMap(body.quantityUnit);
    if (body.weightUnit !== undefined) updateData.weightUnit = normalizeToMultiLangMap(body.weightUnit);

    if (body.price !== undefined) updateData.price = Number(body.price);
    if (body.mrp !== undefined) updateData.mrp = Number(body.mrp);
    if (body.stock !== undefined) updateData.stock = Number(body.stock);
    if (body.quantity !== undefined) updateData.quantity = Number(body.quantity);
    if (body.weight !== undefined) updateData.weight = Number(body.weight);
    if (body.gst !== undefined) updateData.gst = Number(body.gst);
    if (body.bestSeller !== undefined) {
      updateData.bestSeller = Boolean(body.bestSeller);
      updateData.isBestSeller = Boolean(body.bestSeller);
    }
    if (body.isActive !== undefined) {
      updateData.isActive = Boolean(body.isActive);
    }
    if (body.thumbnailUrl === "") updateData.thumbnailUrl = null;

    if (body.deliveryConfig === null) {
      updateData.deliveryConfig = FieldValue.delete();
    }

    const prodRef = db.collection("product_marketplace").doc("main").collection("products").doc(id);
    await prodRef.set(updateData, { merge: true });

    // Sync with best_seller collection
    const bsRef = db.collection("product_marketplace").doc("main").collection("best_seller").doc(id);
    if (updateData.bestSeller) {
      const snap = await prodRef.get();
      await bsRef.set({ ...snap.data(), featuredAt: new Date().toISOString() }, { merge: true });
    } else if (body.bestSeller === false) {
      await bsRef.delete().catch(() => {});
    }

    clearCache("admin_products");
    clearCache("admin_best_sellers");

    console.log(`Updated product ${id}: price=${updateData.price}, bestSeller=${updateData.bestSeller}`);
    res.json({ success: true, id, updated: updateData });
  } catch (error) {
    console.error(`Error in /api/admin/products/${req.params.id} PUT:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Quick Price Only Update for Marketplace Products
app.patch("/api/admin/products/:id/price", async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    const { price, mrp } = req.body;
    if (!id || price === undefined) {
      return res.status(400).json({ error: "Missing product ID or price" });
    }
    const prodRef = db.collection("product_marketplace").doc("main").collection("products").doc(id);
    const existing = await prodRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "Product not found" });
    }
    const update = {
      price: Number(price),
      updatedAt: new Date().toISOString(),
    };
    if (mrp !== undefined && !isNaN(Number(mrp))) update.mrp = Number(mrp);

    await prodRef.set(update, { merge: true });

    // Also sync price in best_seller collection if it is featured
    const bsRef = db.collection("product_marketplace").doc("main").collection("best_seller").doc(id);
    const bsSnap = await bsRef.get();
    if (bsSnap.exists) {
      await bsRef.set(update, { merge: true });
    }

    clearCache();
    res.json({ success: true, message: "Product price updated successfully", id, price: Number(price), mrp: update.mrp });
  } catch (err) {
    console.error("Error updating product price:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/products/:id", async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    
    await db.collection("product_marketplace").doc("main").collection("products").doc(id).delete();
    await db.collection("product_marketplace").doc("main").collection("best_seller").doc(id).delete().catch(() => {});
    
    clearCache("admin_products");
    clearCache("admin_best_sellers");
    
    console.log(`Deleted product ${id}`);
    res.json({ success: true, id });
  } catch (error) {
    console.error(`Error in /api/admin/products/${req.params.id} DELETE:`, error);
    res.status(500).json({ error: error.message });
  }
});



// Generic admin fallback endpoint to read collections when browser Firestore permissions are restricted
app.get("/api/admin/collection/*path", async (req, res) => {
  try {
    const collPath = Array.isArray(req.params.path) ? req.params.path.join("/") : (req.params.path || req.params[0] || "");
    if (!collPath) return res.status(400).json({ error: "Path is required" });
    const db = getFirestore();
    const snapshot = await db.collection(collPath).get();
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json({ data, count: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

// ==========================================
// BANNER MANAGEMENT API (Offer Banners & Ads Banners)
// Collections: /banners/offer_banners/items & /banners/ads_banners/items
// ==========================================

// 1. Fetch Banners (Offer Banners, Ads Banners, or All)
app.get("/api/admin/banners", async (req, res) => {
  try {
    const { type } = req.query; // 'offer_banners' | 'ads_banners' | undefined
    const cacheKey = `admin_banners_${type || "all"}`;
    const cached = getCached(cacheKey, 600000);
    if (cached) return res.json(cached);

    const db = getFirestore();

    const fetchCollection = async (bannerType) => {
      const snap = await db.collection("banners").doc(bannerType).collection("items").get().catch(() => ({ docs: [] }));
      return snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          bannerType,
          actionType: d.actionType || "screen",
          actionValue: d.actionValue || "",
          imageUrl: d.imageUrl || d.image || "",
          isActive: d.isActive !== undefined ? Boolean(d.isActive) : true,
          priority: typeof d.priority === "number" ? d.priority : parseInt(d.priority, 10) || 1,
          profiles: Array.isArray(d.profiles) ? d.profiles : (d.profiles ? [d.profiles] : ["farmer", "vet", "seller"]),
          title: d.title || doc.id,
          createdAt: d.createdAt || d.timestamp || null,
          updatedAt: d.updatedAt || null,
          raw: d,
        };
      });
    };

    if (type === "offer_banners") {
      const offers = await fetchCollection("offer_banners");
      offers.sort((a, b) => (a.priority || 999) - (b.priority || 999));
      const payload = { banners: offers, count: offers.length, type: "offer_banners" };
      setCache(cacheKey, payload);
      return res.json(payload);
    }

    if (type === "ads_banners") {
      const ads = await fetchCollection("ads_banners");
      ads.sort((a, b) => (a.priority || 999) - (b.priority || 999));
      const payload = { banners: ads, count: ads.length, type: "ads_banners" };
      setCache(cacheKey, payload);
      return res.json(payload);
    }

    const [offers, ads] = await Promise.all([
      fetchCollection("offer_banners"),
      fetchCollection("ads_banners"),
    ]);

    const combined = [...offers, ...ads].sort((a, b) => (a.priority || 999) - (b.priority || 999));
    const payload = {
      banners: combined,
      offerBanners: offers,
      adsBanners: ads,
      count: combined.length,
    };
    setCache(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    console.error("Error in GET /api/admin/banners:", err);
    res.status(500).json({ error: err.message, banners: [] });
  }
});

// 2. Create or Update Banner in /banners/{type}/items/{id}
app.post("/api/admin/banners", async (req, res) => {
  try {
    const {
      id,
      bannerType = "offer_banners",
      imageUrl,
      actionType = "screen",
      actionValue = "",
      priority = 1,
      isActive = true,
      profiles = ["farmer", "vet", "seller"],
      title,
    } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: "imageUrl is required" });
    }

    const normalizedType = bannerType === "ads_banners" ? "ads_banners" : "offer_banners";
    const docId = (id && String(id).trim()) ? String(id).trim() : `banner_${Date.now()}`;

    const db = getFirestore();
    const docRef = db.collection("banners").doc(normalizedType).collection("items").doc(docId);

    const payload = {
      actionType: String(actionType || (normalizedType === "offer_banners" ? "product" : "screen")).trim(),
      actionValue: String(actionValue || "").trim(),
      imageUrl: String(imageUrl).trim(),
      isActive: Boolean(isActive),
      priority: Number(priority) || 1,
    };

    if (normalizedType === "ads_banners") {
      payload.profiles = Array.isArray(profiles) ? profiles : ["farmer", "vet", "seller"];
    }

    await docRef.set(payload, { merge: true });

    res.json({
      success: true,
      message: `Banner ${docId} saved successfully in /banners/${normalizedType}/items/${docId}`,
      banner: { id: docId, bannerType: normalizedType, ...payload },
    });
  } catch (err) {
    console.error("Error in POST /api/admin/banners:", err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Update Banner by ID
app.put("/api/admin/banners/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const normalizedType = type === "ads_banners" ? "ads_banners" : "offer_banners";
    const docId = String(id).trim();

    const db = getFirestore();
    const docRef = db.collection("banners").doc(normalizedType).collection("items").doc(docId);

    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData.bannerType;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    if (updateData.priority !== undefined) updateData.priority = Number(updateData.priority) || 1;
    if (updateData.isActive !== undefined) updateData.isActive = Boolean(updateData.isActive);

    await docRef.set(updateData, { merge: true });

    res.json({
      success: true,
      message: `Banner ${docId} updated in /banners/${normalizedType}/items/${docId}`,
    });
  } catch (err) {
    console.error("Error in PUT /api/admin/banners:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Delete Banner by ID
app.delete("/api/admin/banners/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const normalizedType = type === "ads_banners" ? "ads_banners" : "offer_banners";
    const docId = String(id).trim();

    const db = getFirestore();
    await db.collection("banners").doc(normalizedType).collection("items").doc(docId).delete();

    res.json({
      success: true,
      message: `Banner ${docId} deleted from /banners/${normalizedType}/items/${docId}`,
    });
  } catch (err) {
    console.error("Error in DELETE /api/admin/banners:", err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Upload Banner Image to Firebase Storage Bucket
app.post("/api/admin/upload-banner-image", async (req, res) => {
  try {
    const {
      base64,
      filename = "banner.png",
      contentType = "image/png",
      bannerType = "offer_banners",
    } = req.body;

    if (!base64) {
      return res.status(400).json({ error: "base64 image data is required" });
    }

    const normalizedType = bannerType === "ads_banners" ? "ads_banners" : "offer_banners";
    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    const storage = getStorage();
    const bucket = storage.bucket();

    const safeFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const storagePath = `banners/${normalizedType}/${safeFilename}`;
    const file = bucket.file(storagePath);

    const uuid = require("crypto").randomUUID();
    await file.save(buffer, {
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: uuid,
        },
      },
    });
    await file.makePublic().catch(() => {});

    const bucketName = bucket.name;
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${uuid}`;

    res.json({
      success: true,
      url: downloadUrl,
      storagePath,
      filename: safeFilename,
    });
  } catch (err) {
    console.error("Error in /api/admin/upload-banner-image:", err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Universal Upload Image for Products, Combos, and Media
app.post("/api/admin/upload-image", async (req, res) => {
  try {
    const {
      base64,
      filename = "image.png",
      contentType = "image/png",
      folder = "combos/images",
    } = req.body;

    if (!base64) {
      return res.status(400).json({ error: "base64 image data is required" });
    }

    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    const defaultBucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET || "auth-b404a.appspot.com";
    const storage = getStorage();
    const bucket = storage.bucket(defaultBucketName);

    const safeFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const cleanFolder = (folder || "marketplace").replace(/^\/+|\/+$/g, "");
    const storagePath = `${cleanFolder}/${safeFilename}`;
    const file = bucket.file(storagePath);

    const uuid = require("crypto").randomUUID();
    await file.save(buffer, {
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: uuid,
        },
      },
    });
    await file.makePublic().catch(() => {});

    const bucketName = bucket.name || defaultBucketName;
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${uuid}`;

    console.log(`[Upload Image] Successfully saved to ${storagePath} -> ${downloadUrl}`);
    res.json({
      success: true,
      url: downloadUrl,
      storagePath,
      filename: safeFilename,
    });
  } catch (err) {
    console.error("Error in /api/admin/upload-image:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 1. SHIPPING CONFIG API
// Document: product_marketplace/main/shipping_config/config
// ==========================================
app.get("/api/admin/shipping-config", async (req, res) => {
  try {
    const db = getFirestore();
    const docRef = db.doc("product_marketplace/main/shipping_config/config");
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Shipping configuration document not found", config: null });
    }
    res.json({ success: true, config: snap.data() });
  } catch (err) {
    console.error("Error fetching shipping config:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post(["/api/admin/shipping-config", "/api/admin/shipping-config/update"], async (req, res) => {
  try {
    const db = getFirestore();
    const { zones, pricing, delivery_time } = req.body;
    if (!zones || !pricing) {
      return res.status(400).json({ error: "Invalid payload: zones and pricing are required" });
    }
    const docRef = db.doc("product_marketplace/main/shipping_config/config");
    const updatePayload = {
      zones,
      pricing,
      delivery_time: delivery_time || {},
      updatedAt: new Date().toISOString(),
    };
    await docRef.set(updatePayload, { merge: true });
    clearCache();
    res.json({ success: true, message: "Shipping configuration updated successfully", config: updatePayload });
  } catch (err) {
    console.error("Error updating shipping config:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. COMBOS PRODUCTS API
// Collection: product_marketplace/main/combos
// ==========================================
app.get("/api/admin/combos", async (req, res) => {
  try {
    const db = getFirestore();
    const snap = await db.collection("product_marketplace").doc("main").collection("combos").get();
    const combos = [];
    snap.forEach((doc) => {
      combos.push({ id: doc.id, ...doc.data() });
    });
    res.json({ success: true, combos, total: combos.length });
  } catch (err) {
    console.error("Error fetching combos:", err);
    res.status(500).json({ error: err.message, combos: [] });
  }
});

app.post("/api/admin/combos", async (req, res) => {
  try {
    const db = getFirestore();
    const data = req.body;
    if (!data) return res.status(400).json({ error: "Missing combo data payload" });

    const comboId = data.id || `COMBO--${Date.now()}`;
    const payload = {
      ...data,
      id: comboId,
      name: typeof data.name === "object" ? data.name : normalizeToMultiLangMap(data.name),
      price: Number(data.price) || 0,
      mrp: Number(data.mrp) || Number(data.price) || 0,
      gst: Number(data.gst) !== undefined && !isNaN(Number(data.gst)) ? Number(data.gst) : 5,
      quantity: Number(data.quantity) || 1,
      quantityUnit: typeof data.quantityUnit === "object" ? data.quantityUnit : normalizeToMultiLangMap(data.quantityUnit || "Unit"),
      weight: Number(data.weight) || 0,
      weightUnit: typeof data.weightUnit === "object" ? data.weightUnit : normalizeToMultiLangMap(data.weightUnit || "g"),
      categoryId: data.categoryId || "cat_disease_management",
      subCategoryId: data.subCategoryId || "subcat_disease_detection",
      isActive: data.isActive !== false,
      bestSeller: Boolean(data.bestSeller),
      thumbnailUrl: data.thumbnailUrl || (Array.isArray(data.imageUrls) ? data.imageUrls[0] : "") || "",
      imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls.filter(Boolean) : (data.thumbnailUrl ? [data.thumbnailUrl] : []),
      sellerType: data.sellerType || "seller",
      sellerLogo: data.sellerLogo || "",
      sellerName: typeof data.sellerName === "object" ? data.sellerName : normalizeToMultiLangMap(data.sellerName || "iHerd Official"),
      best_before: typeof data.best_before === "object" ? data.best_before : normalizeToMultiLangMap(data.best_before || "2 Years"),
      description: typeof data.description === "object" ? data.description : normalizeToMultiLangMap(data.description || ""),
      specification: typeof data.specification === "object" ? data.specification : { specification: normalizeToMultiLangMap(data.specification || "") },
      instructionsToUse: typeof data.instructionsToUse === "object" ? data.instructionsToUse : { en: [String(data.instructionsToUse || "")] },
      productIngredients: typeof data.productIngredients === "object" ? data.productIngredients : { en: [String(data.productIngredients || "")] },
      storageCondition: typeof data.storageCondition === "object" ? data.storageCondition : { en: ["Room Temperature [25°C]"] },
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection("product_marketplace").doc("main").collection("combos").doc(comboId).set(payload, { merge: true });
    clearCache();
    res.json({ success: true, message: "Combo product created successfully", id: comboId, combo: payload });
  } catch (err) {
    console.error("Error creating combo product:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/combos/:id", async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    const data = req.body;
    if (!id || !data) return res.status(400).json({ error: "Missing combo ID or update data" });

    const docRef = db.collection("product_marketplace").doc("main").collection("combos").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "Combo product not found" });
    }

    const payload = {
      ...data,
      id,
      updatedAt: new Date().toISOString(),
    };
    if (data.price !== undefined) payload.price = Number(data.price);
    if (data.mrp !== undefined) payload.mrp = Number(data.mrp);
    if (data.gst !== undefined) payload.gst = Number(data.gst);
    if (data.weight !== undefined) payload.weight = Number(data.weight);
    if (data.quantity !== undefined) payload.quantity = Number(data.quantity);
    if (data.isActive !== undefined) payload.isActive = Boolean(data.isActive);
    if (data.bestSeller !== undefined) payload.bestSeller = Boolean(data.bestSeller);
    if (data.name && typeof data.name === "object") payload.name = data.name;
    if (data.description && typeof data.description === "object") payload.description = data.description;
    if (data.best_before && typeof data.best_before === "object") payload.best_before = data.best_before;
    if (data.instructionsToUse && typeof data.instructionsToUse === "object") payload.instructionsToUse = data.instructionsToUse;
    if (data.productIngredients && typeof data.productIngredients === "object") payload.productIngredients = data.productIngredients;
    if (data.storageCondition && typeof data.storageCondition === "object") payload.storageCondition = data.storageCondition;
    if (data.specification && typeof data.specification === "object") payload.specification = data.specification;
    if (data.sellerName && typeof data.sellerName === "object") payload.sellerName = data.sellerName;
    if (data.quantityUnit && typeof data.quantityUnit === "object") payload.quantityUnit = data.quantityUnit;
    if (data.weightUnit && typeof data.weightUnit === "object") payload.weightUnit = data.weightUnit;
    if (Array.isArray(data.imageUrls)) payload.imageUrls = data.imageUrls;

    await docRef.set(payload, { merge: true });
    clearCache();
    res.json({ success: true, message: "Combo product updated successfully", id, combo: payload });
  } catch (err) {
    console.error("Error updating combo product:", err);
    res.status(500).json({ error: err.message });
  }
});

// Quick Price Only Update for Combo Products
app.patch("/api/admin/combos/:id/price", async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    const { price, mrp } = req.body;
    if (!id || price === undefined) {
      return res.status(400).json({ error: "Missing combo ID or price" });
    }
    const docRef = db.collection("product_marketplace").doc("main").collection("combos").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "Combo product not found" });
    }
    const update = {
      price: Number(price),
      updatedAt: new Date().toISOString(),
    };
    if (mrp !== undefined && !isNaN(Number(mrp))) update.mrp = Number(mrp);

    await docRef.set(update, { merge: true });
    clearCache();
    res.json({ success: true, message: "Combo price updated successfully", id, price: Number(price), mrp: update.mrp });
  } catch (err) {
    console.error("Error updating combo price:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/combos/:id", async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing combo ID" });

    await db.collection("product_marketplace").doc("main").collection("combos").doc(id).delete();
    clearCache();
    res.json({ success: true, message: "Combo product deleted successfully", id });
  } catch (err) {
    console.error("Error deleting combo product:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. PASHUPRENEUR COURSES API
// Collection: pashuprenuer_courses (with pashupreneur_courses alias)
// ==========================================
const PASHUPRENEUR_ROUTES = [
  "/api/admin/pashuprenuer-courses",
  "/api/admin/pashupreneur-courses",
];
const PASHUPRENEUR_ID_ROUTES = [
  "/api/admin/pashuprenuer-courses/:id",
  "/api/admin/pashupreneur-courses/:id",
];

app.get(PASHUPRENEUR_ROUTES, async (req, res) => {
  try {
    const db = getFirestore();
    const snap = await db.collection("pashuprenuer_courses").get();
    const courses = [];
    snap.forEach((doc) => {
      courses.push({ id: doc.id, ...doc.data() });
    });
    // Sort by order ascending
    courses.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    res.json({ success: true, courses, total: courses.length });
  } catch (err) {
    console.error("Error fetching pashuprenuer courses:", err);
    res.status(500).json({ error: err.message, courses: [] });
  }
});

app.post(PASHUPRENEUR_ROUTES, async (req, res) => {
  try {
    const db = getFirestore();
    const data = req.body;
    if (!data) return res.status(400).json({ error: "Missing course data payload" });

    const courseId = data.id || `course_${Date.now()}`;
    const payload = {
      ...data,
      id: courseId,
      order: Number(data.order) || 1,
      youtubeUrl: data.youtubeUrl || "",
      isActive: data.isActive !== false,
      title: data.title || "",
      description: data.description || "",
      updatedAt: new Date().toISOString(),
    };

    // Save directly to Firestore using Firebase Admin SDK (full permissions)
    await db.collection("pashuprenuer_courses").doc(courseId).set(payload, { merge: true });
    clearCache();
    console.log(`[Pashupreneur] Successfully saved course "${courseId}" to Firestore`);
    res.json({ success: true, message: "Pashupreneur course created successfully", id: courseId, course: payload });
  } catch (err) {
    console.error("Error creating pashuprenuer course:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put(PASHUPRENEUR_ID_ROUTES, async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    const data = req.body;
    if (!id || !data) return res.status(400).json({ error: "Missing course ID or update payload" });

    const docRef = db.collection("pashuprenuer_courses").doc(id);
    const payload = {
      ...data,
      id,
      updatedAt: new Date().toISOString(),
    };
    if (data.order !== undefined) payload.order = Number(data.order);
    if (data.isActive !== undefined) payload.isActive = Boolean(data.isActive);
    if (data.title !== undefined) payload.title = String(data.title);
    if (data.description !== undefined) payload.description = String(data.description);
    if (data.youtubeUrl !== undefined) payload.youtubeUrl = String(data.youtubeUrl);

    await docRef.set(payload, { merge: true });
    clearCache();
    console.log(`[Pashupreneur] Successfully updated course "${id}" in Firestore`);
    res.json({ success: true, message: "Pashupreneur course saved successfully", id, course: payload });
  } catch (err) {
    console.error("Error updating pashuprenuer course:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete(PASHUPRENEUR_ID_ROUTES, async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing course ID" });

    await db.collection("pashuprenuer_courses").doc(id).delete();
    clearCache();
    console.log(`[Pashupreneur] Successfully deleted course "${id}" from Firestore`);
    res.json({ success: true, message: "Pashupreneur course deleted successfully", id });
  } catch (err) {
    console.error("Error deleting pashuprenuer course:", err);
    res.status(500).json({ error: err.message });
  }
});

// High-Speed Image Proxy (handles Google Drive thumbnail CDN requests cleanly)
app.get("/api/admin/proxy-image", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { url } = req.query;
  if (!url) return res.status(400).send("Missing url query param");

  let targetUrl = String(url).trim();
  const driveMatch =
    targetUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    targetUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    targetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    targetUrl = `https://lh3.googleusercontent.com/d/${driveMatch[1]}=s800`;
  }

  const https = require("https");
  const http = require("http");
  const client = targetUrl.startsWith("https") ? https : http;

  client.get(targetUrl, { headers: { "User-Agent": "Mozilla/5.0" } }, (proxyRes) => {
    if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      return https.get(proxyRes.headers.location, { headers: { "User-Agent": "Mozilla/5.0" } }, (redirRes) => {
        if (redirRes.statusCode >= 400) {
          return res.status(redirRes.statusCode).send("Image fetch error");
        }
        res.setHeader("Content-Type", redirRes.headers["content-type"] || "image/png");
        res.setHeader("Cache-Control", "public, max-age=86400");
        redirRes.pipe(res);
      }).on("error", (err) => res.status(502).send(err.message));
    }
    if (proxyRes.statusCode >= 400) {
      return res.status(proxyRes.statusCode).send("Image fetch error");
    }
    res.setHeader("Content-Type", proxyRes.headers["content-type"] || "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    proxyRes.pipe(res);
  }).on("error", (err) => {
    res.status(502).send(err.message);
  });
});

// ==========================================
// Product Marketplace Categories & Subcategories APIs
// Stored in:
// - /product_marketplace/main/categories/{id}
// - /product_marketplace/main/subcategories/{id}
// ==========================================

// Helper: Normalize direct image URL (converts Google Drive links to raw image streams)
function normalizeDirectImageUrl(raw) {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  const driveMatch =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}=s800`;
  }
  return trimmed;
}

// Helper: Normalize multilingual map for category/subcategory names
function normalizeCategoryNameMap(val, fallbackName = "") {
  if (typeof val === "object" && val !== null) {
    const en = String(val.en || fallbackName).trim();
    return {
      en: en,
      hi: String(val.hi || en).trim(),
      id: String(val.id || en).trim(),
      kn: String(val.kn || en).trim(),
      mr: String(val.mr || en).trim(),
      pa: String(val.pa || en).trim(),
      ta: String(val.ta || en).trim(),
    };
  }
  const s = String(val || fallbackName).trim();
  return {
    en: s,
    hi: s,
    id: s,
    kn: s,
    mr: s,
    pa: s,
    ta: s,
  };
}

// 1. GET /api/admin/categories
app.get("/api/admin/categories", async (req, res) => {
  try {
    const db = getFirestore();
    const snap = await db.collection("product_marketplace").doc("main").collection("categories").get();
    const categories = snap.docs.map((doc) => {
      const data = doc.data();
      const rawImg = data.image || data.imageUrl || data.icon || data.iconUrl || data.categoryImage || "";
      const directImg = normalizeDirectImageUrl(rawImg);
      return {
        id: doc.id,
        ...data,
        image: directImg,
        imageUrl: directImg,
        icon: directImg,
        iconUrl: directImg,
        categoryImage: directImg,
        name: normalizeCategoryNameMap(data.name, doc.id),
        order: typeof data.order === "number" ? data.order : parseInt(data.order, 10) || 0,
      };
    });
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json({ success: true, count: categories.length, categories });
  } catch (error) {
    console.error("Error in GET /api/admin/categories:", error);
    res.status(500).json({ error: error.message, categories: [] });
  }
});

// 2. POST /api/admin/categories (Create or Update)
app.post("/api/admin/categories", async (req, res) => {
  try {
    const db = getFirestore();
    const body = req.body || {};
    const catId = String(body.id || "").trim();
    if (!catId) {
      return res.status(400).json({ error: "Category ID (e.g. cat_breeding) is required." });
    }

    const rawImg = body.image || body.imageUrl || body.icon || body.iconUrl || body.categoryImage || "";
    const directImg = normalizeDirectImageUrl(rawImg);

    const payload = {
      id: catId,
      image: directImg,
      imageUrl: directImg,
      icon: directImg,
      iconUrl: directImg,
      categoryImage: directImg,
      name: normalizeCategoryNameMap(body.name, body.name?.en || catId),
      order: typeof body.order === "number" ? body.order : parseInt(body.order, 10) || 0,
      updatedAt: new Date().toISOString(),
    };

    if (!body.isUpdate) {
      payload.createdAt = new Date().toISOString();
    }

    // Save to primary /product_marketplace/main/categories
    const docRef = db.collection("product_marketplace").doc("main").collection("categories").doc(catId);
    await docRef.set(payload, { merge: true });

    // Also mirror to root /categories and /product_categories in case mobile app reads there
    try {
      await db.collection("categories").doc(catId).set(payload, { merge: true });
      await db.collection("product_categories").doc(catId).set(payload, { merge: true });
    } catch (_) {}

    console.log(`Saved category ${catId} to /product_marketplace/main/categories (with image: ${directImg ? "yes" : "none"})`);
    res.json({ success: true, message: `Category "${catId}" saved successfully`, category: payload });
  } catch (error) {
    console.error("Error in POST /api/admin/categories:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. DELETE /api/admin/categories/:id
app.delete("/api/admin/categories/:id", async (req, res) => {
  try {
    const db = getFirestore();
    const catId = req.params.id;
    await db.collection("product_marketplace").doc("main").collection("categories").doc(catId).delete();
    try {
      await db.collection("categories").doc(catId).delete();
      await db.collection("product_categories").doc(catId).delete();
    } catch (_) {}
    console.log(`Deleted category ${catId} from /product_marketplace/main/categories`);
    res.json({ success: true, message: `Category "${catId}" deleted successfully` });
  } catch (error) {
    console.error("Error in DELETE /api/admin/categories/:id:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. GET /api/admin/subcategories
app.get("/api/admin/subcategories", async (req, res) => {
  try {
    const db = getFirestore();
    const snap = await db.collection("product_marketplace").doc("main").collection("subcategories").get();
    const subcategories = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        name: normalizeCategoryNameMap(data.name, doc.id),
        order: typeof data.order === "number" ? data.order : parseInt(data.order, 10) || 0,
      };
    });
    subcategories.sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json({ success: true, count: subcategories.length, subcategories });
  } catch (error) {
    console.error("Error in GET /api/admin/subcategories:", error);
    res.status(500).json({ error: error.message, subcategories: [] });
  }
});

// 5. POST /api/admin/subcategories (Create or Update)
app.post("/api/admin/subcategories", async (req, res) => {
  try {
    const db = getFirestore();
    const body = req.body || {};
    const subId = String(body.id || "").trim();
    const catId = String(body.categoryId || "").trim();

    if (!subId) {
      return res.status(400).json({ error: "Subcategory ID (e.g. subcat_ai_equipment) is required." });
    }
    if (!catId) {
      return res.status(400).json({ error: "Parent categoryId (e.g. cat_breeding) is required." });
    }

    const payload = {
      id: subId,
      categoryId: catId,
      name: normalizeCategoryNameMap(body.name, body.name?.en || subId),
      order: typeof body.order === "number" ? body.order : parseInt(body.order, 10) || 0,
      updatedAt: new Date().toISOString(),
    };

    if (!body.isUpdate) {
      payload.createdAt = new Date().toISOString();
    }

    const docRef = db.collection("product_marketplace").doc("main").collection("subcategories").doc(subId);
    await docRef.set(payload, { merge: true });

    console.log(`Saved subcategory ${subId} under ${catId} to /product_marketplace/main/subcategories`);
    res.json({ success: true, message: `Subcategory "${subId}" saved successfully`, subcategory: payload });
  } catch (error) {
    console.error("Error in POST /api/admin/subcategories:", error);
    res.status(500).json({ error: error.message });
  }
});

// 6. DELETE /api/admin/subcategories/:id
app.delete("/api/admin/subcategories/:id", async (req, res) => {
  try {
    const db = getFirestore();
    const subId = req.params.id;
    await db.collection("product_marketplace").doc("main").collection("subcategories").doc(subId).delete();
    console.log(`Deleted subcategory ${subId} from /product_marketplace/main/subcategories`);
    res.json({ success: true, message: `Subcategory "${subId}" deleted successfully` });
  } catch (error) {
    console.error("Error in DELETE /api/admin/subcategories/:id:", error);
    res.status(500).json({ error: error.message });
  }
});

// Global error handling middleware (catches client socket aborts and ECONNRESET cleanly)
app.use((err, req, res, next) => {
  if (err && (err.code === "ECONNRESET" || err.message === "aborted" || err.type === "request.aborted")) {
    // Client closed or reloaded the browser before response finished — safely ignore
    return;
  }
  console.error("Unhandled error in request:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// Protect Node.js process from crashing on client connection drops or socket resets
process.on("uncaughtException", (err) => {
  if (err && (err.code === "ECONNRESET" || err.message === "aborted")) {
    return; // Safely ignore client-side aborts / browser reloads
  }
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  if (reason && (reason.code === "ECONNRESET" || reason.message === "aborted")) {
    return;
  }
  console.warn("Unhandled Rejection:", reason);
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend server running on http://127.0.0.1:${PORT}`);
  
  // Safe initial pre-warm without memory leak interval
  setTimeout(() => {
    fetchAndProcessAdminUsers(false)
      .then((users) => console.log(`[Cache] Ready with ${users.length} users`))
      .catch((err) => console.warn(`[Cache] Pre-load note:`, err.message));
  }, 1000);
});

// Handle premature client disconnection at HTTP socket layer cleanly
server.on("clientError", (err, socket) => {
  if (err.code === "ECONNRESET" || !socket.writable) {
    return;
  }
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});




