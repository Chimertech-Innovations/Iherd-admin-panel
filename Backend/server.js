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

app.use(express.json());

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

const { getFirestore } = require("firebase-admin/firestore");
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

// REST API: list all Firebase Storage files across all known paths
app.get("/api/admin/storage", async (req, res) => {
  try {
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
    let success = false;
    let lastError = null;

    // Try candidate bucket names
    for (const bName of Array.from(new Set(candidateBuckets))) {
      try {
        const testBucket = getStorage().bucket(bName);
        const [files] = await testBucket.getFiles({ maxResults: 1 });
        bucket = testBucket;
        success = true;
        console.log(`Successfully connected to Storage Bucket: ${bName}`);
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
        totals: { userImages: 0, invoices: 0, cattleMarketplace: 0, marketplace: 0, total: 0 }
      });
    }

    [userImages, invoices, cattleMarketplace, marketplace] = await Promise.all([
      listFilesUnderPrefix(bucket, "UserImages/"),
      listFilesUnderPrefix(bucket, "invoices/"),
      listFilesUnderPrefix(bucket, "cattle-marketplace/"),
      listFilesUnderPrefix(bucket, "marketplace/"),
    ]);

    res.json({
      userImages,
      invoices,
      cattleMarketplace,
      marketplace,
      totals: {
        userImages: userImages.length,
        invoices: invoices.length,
        cattleMarketplace: cattleMarketplace.length,
        marketplace: marketplace.length,
        total: userImages.length + invoices.length + cattleMarketplace.length + marketplace.length,
      },
    });
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
    const db = getFirestore();
    const auth = getAuth();
    const phone = req.query.phone || "";
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);

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
      nestedFarms.push(fData);

      // Check cattles under this farm doc
      try {
        const cattleSnap = await fDoc.ref.collection("cattles").get();
        cattleSnap.docs.forEach((cd) => {
          const cData = cd.data();
          nestedCattles.push({
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
          });
        });
      } catch (e) {
        console.warn(`Error fetching cattles under farm ${fDoc.id}:`, e.message);
      }
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

          cattleOrders.push({
            id: o.id,
            orderId: o.orderId || o.id,
            type: isSale ? "Cattle Sale (Received)" : "Cattle Purchase",
            isSale,
            cattleName: o.cattleName || o.name || "Cattle",
            breed: o.breed || "—",
            species: o.species || "Cow",
            price: Number(o.price || o.totalAmount || o.amount || 0),
            totalAmount: Number(o.price || o.totalAmount || o.amount || 0),
            status: o.status || "Completed",
            invoiceNumber: o.invoiceNo || o.invoiceNumber || (invoiceUrl ? `INV-${orderKey.slice(-8)}` : "—"),
            invoiceUrl,
            image: o.image || o.faceViewImage || o.leftViewImage || o.rightViewImage || null,
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

    // 8. Fetch Token Advances (Filter out system settings documents)
    let tokenAdvances = [];
    try {
      const [tSnap, userSubTA] = await Promise.all([
        db.collection("token-advance").get().catch(() => ({ docs: [] })),
        db.collection("users").doc(resolvedDocId).collection("token_advance").get().catch(() => ({ docs: [] })),
      ]);

      const allTADocs = [...tSnap.docs, ...userSubTA.docs];
      allTADocs.forEach((doc) => {
        if (doc.id === "token-advance" && !doc.data().userId && !doc.data().farmerId) {
          // Skip global settings doc
          return;
        }

        const t = { id: doc.id, ...doc.data() };
        const u = (t.userId || t.farmerId || t.uid || "").toLowerCase();
        let match = u === userId.toLowerCase() || u === resolvedDocId.toLowerCase();
        if (!match && resolvedPhone) {
          const tPhone = (t.phone || t.phoneNumber || "").replace(/\D/g, "").slice(-10);
          if (tPhone && tPhone === resolvedPhone) match = true;
        }

        if (match) {
          const invKey = (t.orderId || t.id || "").toLowerCase();
          const invoiceUrl = invoiceMap.get(invKey) || t.invoiceUrl || null;

          tokenAdvances.push({
            id: t.id,
            orderId: t.orderId || t.id,
            cattleType: t.cattleType || t.animal || "Livestock",
            amount: Number(t.amount || t.advanceAmount || t.tokenAmount || 0),
            status: t.status || "Approved",
            invoiceNumber: t.invoiceNumber || t.invoiceNo || (invoiceUrl ? `INV-${t.id.slice(-8)}` : "—"),
            invoiceUrl,
            createdAt: t.createdAt || t.date || null,
            updatedAt: t.updatedAt || null,
          });
        }
      });
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

    // 8. Fetch Storage Files
    let storageFiles = [];
    try {
      const defaultBucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET || "auth-b404a.appspot.com";
      const bucket = getStorage().bucket(defaultBucketName);
      const prefixes = Array.from(
        new Set([
          `UserImages/${userId}`,
          `UserImages/${resolvedDocId}`,
          `cattle-marketplace/${userId}`,
          `cattle-marketplace/${resolvedDocId}`,
          `marketplace/${userId}`,
          `marketplace/${resolvedDocId}`,
          `farmers/${userId}`,
          `farmers/${resolvedDocId}`,
          `farms/${userId}`,
          `farms/${resolvedDocId}`,
          `documents/${userId}`,
          `documents/${resolvedDocId}`,
          `kyc/${userId}`,
          `kyc/${resolvedDocId}`,
          `invoices/${userId}`,
          `invoices/${resolvedDocId}`,
        ])
      );
      const nestedFiles = await Promise.all(prefixes.map((p) => listFilesUnderPrefix(bucket, p)));
      const allFiles = nestedFiles.flat();
      const filesMap = new Map();
      allFiles.forEach((file) => {
        if (!file || !file.name) return;
        const lower = file.name.toLowerCase();
        const matchUid = lower.includes(userId.toLowerCase()) || lower.includes(resolvedDocId.toLowerCase());
        const matchPh = resolvedPhone && resolvedPhone.length >= 8 && lower.includes(resolvedPhone);
        if (matchUid || matchPh) {
          if (!filesMap.has(file.name)) {
            filesMap.set(file.name, file);
          }
        }
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

    res.json({
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
    });
  } catch (error) {
    console.error("Error in /api/admin/user-full-data:", error);
    res.status(500).json({ error: error.message });
  }
});

// REST API: Save or update custom farm data for a user
app.post("/api/admin/user-farm-data/:userId", async (req, res) => {
  try {
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

    res.json({ success: true, message: "Farm data updated successfully", farmId, data: cleanData });
  } catch (error) {
    console.error("Error updating farm data:", error);
    res.status(500).json({ error: error.message });
  }
});

// REST API to list all Firebase Authentication users
app.get(["/api/admin/users", "/get/api/admin/users"], async (req, res) => {
  try {
    const auth = getAuth();
    const db = getFirestore();
    
    // Prefetch all Firestore user documents, farms subcollections, and cattle to extract full farmer profiles
    const [fsSnapshot, farmsSnapshot, cattleSnapshot] = await Promise.all([
      db.collection("users").get(),
      db.collectionGroup("farms").get().catch(() => ({ forEach: () => {} })),
      db.collection("cattle_details").get().catch(() => ({ forEach: () => {} })),
    ]);

    const fsUsersMap = {};
    fsSnapshot.forEach((doc) => {
      fsUsersMap[doc.id] = doc.data();
    });

    const farmOwnersMap = {};
    farmsSnapshot.forEach((doc) => {
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
    cattleSnapshot.forEach((doc) => {
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

    let authUsers = [];
    let nextPageToken = undefined;

    // Define the list users operation as a Promise
    const listUsersPromise = (async () => {
      do {
        const listUsersResult = await auth.listUsers(1000, nextPageToken);
        const batch = listUsersResult.users.map((userRecord) => {
          const fsUser = fsUsersMap[userRecord.uid] || {};
          const farmMeta = farmOwnersMap[userRecord.uid] || {};
          const cattleMeta = cattleOwnersMap[userRecord.uid] || {};
          const farmerProfile = fsUser.farmer || {};

          const resolvedName =
            (farmMeta.name && farmMeta.name !== "User" && farmMeta.name !== "Farmer") ? farmMeta.name :
            (cattleMeta.name && cattleMeta.name !== "User" && cattleMeta.name !== "Farmer") ? cattleMeta.name :
            (farmerProfile.name && farmerProfile.name !== "User" && farmerProfile.name !== "Farmer") ? farmerProfile.name :
            (farmerProfile.farmerName && farmerProfile.farmerName !== "User") ? farmerProfile.farmerName :
            (fsUser.farmerName && fsUser.farmerName !== "User") ? fsUser.farmerName :
            (fsUser.fullName && fsUser.fullName !== "User") ? fsUser.fullName :
            (fsUser.name && fsUser.name !== "User") ? fsUser.name :
            (fsUser.displayName && fsUser.displayName !== "User") ? fsUser.displayName :
            (userRecord.displayName && userRecord.displayName !== "User") ? userRecord.displayName :
            (farmMeta.phone ? `Farmer (${farmMeta.phone})` : (userRecord.phoneNumber ? `Farmer (${userRecord.phoneNumber})` : `Farmer #${userRecord.uid.slice(-6).toUpperCase()}`));

          const resolvedPhone =
            (userRecord.phoneNumber && userRecord.phoneNumber !== "—") ? userRecord.phoneNumber :
            (fsUser.phoneNumber && fsUser.phoneNumber !== "—") ? fsUser.phoneNumber :
            (fsUser.phone && fsUser.phone !== "—") ? fsUser.phone :
            (farmMeta.phone && farmMeta.phone !== "—") ? farmMeta.phone :
            (cattleMeta.phone && cattleMeta.phone !== "—") ? cattleMeta.phone :
            (farmerProfile.farmerPhoneNumber && farmerProfile.farmerPhoneNumber !== "—") ? farmerProfile.farmerPhoneNumber :
            "—";

          const roles = fsUser.roles || (fsUser.role ? [fsUser.role] : (farmMeta.name || farmMeta.farmName ? ["Farmer"] : ["User"]));
          
          return {
            uid: userRecord.uid,
            email: userRecord.email || fsUser.email || null,
            phoneNumber: resolvedPhone,
            displayName: resolvedName,
            name: resolvedName,
            roles: roles,
            createdAt: userRecord.metadata.creationTime || fsUser.createdAt || null,
            lastLoginAt: userRecord.metadata.lastSignInTime || fsUser.updatedAt || null,
            farms: fsUser.farms || (farmMeta.farmName ? { name: farmMeta.farmName, id: farmMeta.farmId } : null),
            farmer: {
              ...farmerProfile,
              name: resolvedName,
              farmerPhoneNumber: resolvedPhone,
              village: farmMeta.village || cattleMeta.village || farmerProfile.village || fsUser.village || "—",
              district: farmMeta.district || cattleMeta.district || farmerProfile.district || fsUser.district || "—",
              state: farmMeta.state || cattleMeta.state || farmerProfile.state || fsUser.state || "—",
              farmName: farmMeta.farmName || farmerProfile.farmName || null,
            },
            isFarmer: roles.some((r) => String(r).toLowerCase().includes("farmer")) || Boolean(farmMeta.farmName || farmMeta.name),
            status: fsUser.status || "Active",
            seller: fsUser.seller || null,
            veterinarian: fsUser.veterinarian || fsUser.vet || null,
          };
        });
        
        authUsers = authUsers.concat(batch);
        nextPageToken = listUsersResult.pageToken;
      } while (nextPageToken);
      return authUsers;
    })();

    // 6-second timeout promise
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout calling Firebase Auth Service")), 6000)
    );

    // Race list users against a 6-second timeout
    let result = [];
    try {
      result = await Promise.race([listUsersPromise, timeoutPromise]);
    } catch (authError) {
      console.warn("Auth list users failed or timed out, returning Firestore profiles directly:", authError.message);
      // Fallback: Map all users from Firestore map
      result = Object.keys(fsUsersMap).map((uid) => {
        const fsUser = fsUsersMap[uid];
        const farmMeta = farmOwnersMap[uid] || {};
        const cattleMeta = cattleOwnersMap[uid] || {};
        const farmerProfile = fsUser.farmer || {};

        const resolvedName =
          (farmMeta.name && farmMeta.name !== "User" && farmMeta.name !== "Farmer") ? farmMeta.name :
          (cattleMeta.name && cattleMeta.name !== "User" && cattleMeta.name !== "Farmer") ? cattleMeta.name :
          (farmerProfile.name && farmerProfile.name !== "User" && farmerProfile.name !== "Farmer") ? farmerProfile.name :
          (farmerProfile.farmerName && farmerProfile.farmerName !== "User") ? farmerProfile.farmerName :
          (fsUser.farmerName && fsUser.farmerName !== "User") ? fsUser.farmerName :
          (fsUser.fullName && fsUser.fullName !== "User") ? fsUser.fullName :
          (fsUser.name && fsUser.name !== "User") ? fsUser.name :
          (fsUser.displayName && fsUser.displayName !== "User") ? fsUser.displayName :
          (farmMeta.phone ? `Farmer (${farmMeta.phone})` : (fsUser.phoneNumber ? `Farmer (${fsUser.phoneNumber})` : `Farmer #${uid.slice(-6).toUpperCase()}`));

        const resolvedPhone =
          (fsUser.phoneNumber && fsUser.phoneNumber !== "—") ? fsUser.phoneNumber :
          (fsUser.phone && fsUser.phone !== "—") ? fsUser.phone :
          (farmMeta.phone && farmMeta.phone !== "—") ? farmMeta.phone :
          (cattleMeta.phone && cattleMeta.phone !== "—") ? cattleMeta.phone :
          "—";

        const roles = fsUser.roles || (fsUser.role ? [fsUser.role] : (farmMeta.name || farmMeta.farmName ? ["Farmer"] : ["User"]));
        return {
          uid: uid,
          email: fsUser.email || null,
          phoneNumber: resolvedPhone,
          displayName: resolvedName,
          name: resolvedName,
          roles: roles,
          createdAt: fsUser.createdAt ? (fsUser.createdAt.seconds ? fsUser.createdAt.seconds * 1000 : fsUser.createdAt) : null,
          lastLoginAt: fsUser.updatedAt ? (fsUser.updatedAt.seconds ? fsUser.updatedAt.seconds * 1000 : fsUser.updatedAt) : null,
          farms: fsUser.farms || (farmMeta.farmName ? { name: farmMeta.farmName, id: farmMeta.farmId } : null),
          farmer: {
            ...farmerProfile,
            name: resolvedName,
            farmerPhoneNumber: resolvedPhone,
            village: farmMeta.village || cattleMeta.village || farmerProfile.village || fsUser.village || "—",
            district: farmMeta.district || cattleMeta.district || farmerProfile.district || fsUser.district || "—",
            state: farmMeta.state || cattleMeta.state || farmerProfile.state || fsUser.state || "—",
            farmName: farmMeta.farmName || farmerProfile.farmName || null,
          },
          isFarmer: roles.some((r) => String(r).toLowerCase().includes("farmer")) || Boolean(farmMeta.farmName || farmMeta.name),
          status: fsUser.status || "Active",
          seller: fsUser.seller || null,
          veterinarian: fsUser.veterinarian || fsUser.vet || null,
        };
      });
    }

    // Sort all users by creation/registration time descending (latest first)
    result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    res.json({ users: result });
  } catch (error) {
    console.error("Error in /api/admin/users:", error);
    res.status(500).json({ error: error.message });
  }
});

// REST API to list all Product Orders (bypasses client security rules)
app.get("/api/admin/product-orders", async (req, res) => {
  try {
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
          sellerName: po.sellerName || po.shopName || "iHerd Marketplace Store",
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

    console.log(`Fetched and enriched ${sortedOrders.length} product orders`);
    res.json({ orders: sortedOrders });
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
    const db = getFirestore();
    const defaultBucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET || "auth-b404a.appspot.com";
    const bucket = getStorage().bucket(defaultBucketName);

    const [cSnap, rSnap, legacySnap, usersSnap, invoiceFiles] = await Promise.all([
      db.collection("CattleOrders").get().catch(() => ({ docs: [] })),
      db.collection("received_orders").get().catch(() => ({ docs: [] })),
      db.collection("cattle_orders").get().catch(() => ({ docs: [] })),
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
      const orderKey = o.orderId || o.id;
      if (ordersMap.has(orderKey)) return;

      const buyerUid = (o.userId || o.buyerId || o.farmerId || "").toLowerCase();
      const sellerUid = (o.sellerId || o.ownerUid || "").toLowerCase();

      const buyerUser = usersMap.get(buyerUid) || {};
      const sellerUser = usersMap.get(sellerUid) || {};

      const buyerName =
        o.shippingAddress?.name ||
        o.buyerName ||
        o.userName ||
        buyerUser.name ||
        buyerUser.displayName ||
        (buyerUid ? `Buyer (${buyerUid.slice(0, 8)}...)` : "Buyer");

      const buyerPhone =
        o.shippingAddress?.phone ||
        o.phoneNumber ||
        o.phone ||
        buyerUser.phoneNumber ||
        buyerUser.phone ||
        "—";

      const buyerLocation =
        o.buyerLocation ||
        (o.shippingAddress ? [o.shippingAddress.line1, o.shippingAddress.line2, o.shippingAddress.district, o.shippingAddress.state, o.shippingAddress.pincode].filter(Boolean).join(", ") : "—");

      const sellerName =
        o.sellerName ||
        o.owner ||
        sellerUser.name ||
        sellerUser.displayName ||
        "Verified Farmer / Seller";

      const totalAmount = Number(o.price || o.totalAmount || o.amount || 0);

      const invKey = (orderKey || "").toLowerCase();
      const invNoKey = (o.invoiceNo || o.invoiceNumber || "").toLowerCase();
      const invoiceUrl = invoiceMap.get(invKey) || invoiceMap.get(invNoKey) || o.invoiceUrl || null;

      ordersMap.set(orderKey, {
        ...o,
        id: orderKey,
        orderId: orderKey,
        userId: o.userId || buyerUser.id || null,
        sellerId: o.sellerId || sellerUser.id || null,
        cattleName: o.cattleName || o.name || "Livestock Cattle",
        breed: o.breed || "Amritmahal",
        species: o.species || "Cow",
        image: o.image || o.faceViewImage || o.leftViewImage || o.rightViewImage || null,
        buyerName,
        buyerPhone,
        buyerLocation,
        sellerName,
        price: totalAmount,
        totalAmount,
        amount: totalAmount,
        invoiceNumber: o.invoiceNo || o.invoiceNumber || (invoiceUrl ? `INV-${orderKey.slice(-8)}` : "—"),
        invoiceUrl,
        status: o.status || "Ordered",
        createdAt: o.createdAt || o.date || null,
        updatedAt: o.updatedAt || null,
      });
    };

    cSnap.docs?.forEach(addDoc);
    rSnap.docs?.forEach(addDoc);
    legacySnap.docs?.forEach(addDoc);

    const sortedOrders = Array.from(ordersMap.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    console.log(`Fetched and enriched ${sortedOrders.length} cattle orders`);
    res.json({ orders: sortedOrders });
  } catch (error) {
    console.error("Error in /api/admin/cattle-orders:", error);
    res.status(500).json({ error: error.message, orders: [] });
  }
});

// REST API to list all Cattle Register Details from cattle_details & cattle-marketplace
app.get("/api/admin/cattle", async (req, res) => {
  try {
    const db = getFirestore();
    const [cdSnap, cmSnap, usersSnap] = await Promise.all([
      db.collection("cattle_details").get().catch(() => ({ docs: [] })),
      db.collection("cattle-marketplace").get().catch(() => ({ docs: [] })),
      db.collection("users").get().catch(() => ({ docs: [] })),
    ]);

    const usersMap = new Map();
    usersSnap.docs.forEach((d) => {
      const uData = d.data();
      usersMap.set(d.id, { id: d.id, ...uData });
      if (uData.uid) usersMap.set(uData.uid, { id: d.id, ...uData });
    });

    const cattleMap = new Map();

    const processCattleItem = (item, sourceName) => {
      if (!item) return;
      const cattleKey = item.cattleId || item.rfid || item.tagNo || item.id;
      if (!cattleKey) return;

      const ownerUid = item.ownerUid || item.sellerId || item.farmerId || item.userId || item.uid || item.postedBy || "";
      const ownerUser = usersMap.get(ownerUid) || {};

      const ownerName =
        item.ownerName ||
        item.sellerName ||
        item.farmerName ||
        ownerUser.name ||
        ownerUser.displayName ||
        (ownerUid ? `Farmer (${ownerUid.slice(0, 8)}...)` : "iHerd Farmer");

      const ownerPhone =
        item.sellerPhone ||
        item.phone ||
        item.phoneNumber ||
        ownerUser.phoneNumber ||
        ownerUser.phone ||
        "—";

      const faceView = item.faceViewImagePath || item.faceView || item.face || (Array.isArray(item.images) && item.images[0]) || item.imageUrl || null;
      const leftView = item.leftViewImagePath || item.leftView || (Array.isArray(item.images) && item.images[1]) || null;
      const rightView = item.rightViewImagePath || item.rightView || (Array.isArray(item.images) && item.images[2]) || null;
      const muzzleView = item.muzzleViewImagePath || item.muzzleView || null;
      const udderView = item.udderViewImagePath || item.udderView || null;
      const bottomView = item.topViewImagePath || item.bottomView || item.topview || null;
      const farmerView = item.farmerViewImagePath || item.farmerView || null;

      const title = item.cattleName || item.title || item.name || (item.tagNo ? `Cattle #${item.tagNo}` : "Dairy Cattle");
      const breed = item.breed?.key || item.breed || "—";
      const species = item.species || "Cow";
      const rfid = item.rfid || item.tagNo || cattleKey;
      const status = item.status || (item.onSale ? "On Sale" : "Active");
      const price = item.price || item.value || item.marketValue || 0;

      const rawDate = item.createdAt || item.registeredAt || item.date || null;

      const enriched = {
        id: cattleKey,
        cattleId: cattleKey,
        title,
        cattleName: title,
        breed,
        species,
        rfid,
        tagNo: rfid,
        gender: item.gender || "female",
        color: item.color || "—",
        age: item.age || "—",
        weight: item.weight || "—",
        height: item.height || "—",
        milkYield: item.milkYield || item.dailyYield || "—",
        parity: item.parity || item.lactation || "—",
        price: Number(price) || 0,
        value: item.value || price || "—",
        fatherTagNo: item.fatherTagNo || "—",
        motherTagNo: item.motherTagNo || "—",
        insurance: Boolean(item.insurance),
        status,
        ownerUid,
        ownerName,
        ownerPhone,
        farmId: item.farmId || "—",
        farmName: item.farmName || "—",
        village: item.village || ownerUser.village || "—",
        district: item.district || ownerUser.district || "—",
        state: item.state || ownerUser.state || "—",
        faceView,
        leftView,
        rightView,
        muzzleView,
        udderView,
        bottomView,
        farmerView,
        images: [faceView, leftView, rightView, muzzleView, udderView, bottomView, farmerView].filter(Boolean),
        source: sourceName,
        createdAt: rawDate,
      };

      if (!cattleMap.has(cattleKey)) {
        cattleMap.set(cattleKey, enriched);
      } else {
        cattleMap.set(cattleKey, { ...cattleMap.get(cattleKey), ...enriched });
      }
    };

    cdSnap.docs.forEach((d) => processCattleItem({ id: d.id, ...d.data() }, "cattle_details"));
    cmSnap.docs.forEach((d) => processCattleItem({ id: d.id, ...d.data() }, "cattle-marketplace"));

    // Also fetch nested farm cattles from users
    for (const uDoc of usersSnap.docs) {
      try {
        const uId = uDoc.id;
        const farmsSnap = await db.collection("users").doc(uId).collection("roles").doc("farmer").collection("farms").get().catch(() => ({ docs: [] }));
        for (const fDoc of farmsSnap.docs) {
          const catSnap = await fDoc.ref.collection("cattles").get().catch(() => ({ docs: [] }));
          catSnap.docs.forEach((cd) => {
            processCattleItem({ id: cd.id, ownerUid: uId, farmId: fDoc.id, farmName: fDoc.data()?.name, ...cd.data() }, "nested_farm_cattle");
          });
        }
      } catch (e) {}
    }

    const sortedCattle = Array.from(cattleMap.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    console.log(`Fetched and enriched ${sortedCattle.length} cattle register records`);
    res.json({ cattle: sortedCattle });
  } catch (error) {
    console.error("Error in /api/admin/cattle:", error);
    res.status(500).json({ error: error.message, cattle: [] });
  }
});

// REST API to list all Registered Farms from /users/{uid}/roles/farmer/farms & all collections
app.get("/api/admin/farms", async (req, res) => {
  try {
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
    res.json({ farms: sortedFarms });
  } catch (error) {
    console.error("Error in /api/admin/farms:", error);
    res.status(500).json({ error: error.message, farms: [] });
  }
});

// REST API to list all Payments, Transactions & Commissions aggregated across orders
app.get("/api/admin/payments", async (req, res) => {
  try {
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
    res.json({
      payments: transactions,
      summary: {
        totalTransactions: transactions.length,
        totalVolume: transactions.reduce((sum, t) => sum + t.amount, 0),
        paidCount: transactions.filter((t) => t.status === "Paid").length,
        pendingCount: transactions.filter((t) => t.status === "Pending").length,
        failedCount: transactions.filter((t) => t.status === "Failed").length,
      },
    });
  } catch (error) {
    console.error("Error in /api/admin/payments:", error);
    res.status(500).json({ error: error.message, payments: [], summary: {} });
  }
});

// REST API to get and update Token Advance rates
app.get("/api/admin/token-advance", async (req, res) => {
  try {
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

    res.json({ rates, items: docs });
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

    res.json({ coupons });
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

    res.json({ bestSellers: products, totalCount: products.length });
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

    console.log(`Toggled bestSeller for ${productId} to ${newStatus}`);
    res.json({ success: true, productId, bestSeller: newStatus });
  } catch (error) {
    console.error("Error in /api/admin/best-sellers/toggle:", error);
    res.status(500).json({ error: error.message });
  }
});

// REST API for Products CRUD
app.get("/api/admin/products", async (req, res) => {
  try {
    const db = getFirestore();
    const snap = await db.collection("product_marketplace").doc("main").collection("products").get();
    const products = [];
    snap.forEach((doc) => {
      products.push({ id: doc.id, ...doc.data() });
    });
    res.json({ products, total: products.length });
  } catch (error) {
    console.error("Error in /api/admin/products GET:", error);
    res.status(500).json({ error: error.message, products: [] });
  }
});

const normalizeToMultiLangMap = (val) => {
  if (!val) return { en: "", hi: "", kn: "", mr: "", pa: "", ta: "" };
  if (typeof val === "object" && !Array.isArray(val)) {
    return {
      en: val.en || val.hi || Object.values(val)[0] || "",
      hi: val.hi || val.en || Object.values(val)[0] || "",
      kn: val.kn || val.en || val.hi || "",
      mr: val.mr || val.en || val.hi || "",
      pa: val.pa || val.en || val.hi || "",
      ta: val.ta || val.en || val.hi || "",
    };
  }
  const str = String(val);
  return { en: str, hi: str, kn: str, mr: str, pa: str, ta: str };
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
      status: status || "Approved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection("product_marketplace").doc("main").collection("products").doc(prodId).set(productData, { merge: true });

    if (productData.bestSeller) {
      await db.collection("product_marketplace").doc("main").collection("best_seller").doc(prodId).set({ ...productData, featuredAt: new Date().toISOString() }, { merge: true });
    }

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
    }
    if (body.thumbnailUrl === "") updateData.thumbnailUrl = null;

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

    console.log(`Updated product ${id}: price=${updateData.price}, bestSeller=${updateData.bestSeller}`);
    res.json({ success: true, id, updated: updateData });
  } catch (error) {
    console.error(`Error in /api/admin/products/${req.params.id} PUT:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/admin/products/:id", async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    
    await db.collection("product_marketplace").doc("main").collection("products").doc(id).delete();
    await db.collection("product_marketplace").doc("main").collection("best_seller").doc(id).delete().catch(() => {});
    
    console.log(`Deleted product ${id}`);
    res.json({ success: true, id });
  } catch (error) {
    console.error(`Error in /api/admin/products/${req.params.id} DELETE:`, error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Banners & Advertisements Management API
// ==========================================
app.get("/api/admin/banners", async (req, res) => {
  try {
    const db = getFirestore();
    const snap = await db.collection("banners").get();
    const banners = [];
    snap.forEach((doc) => {
      banners.push({ id: doc.id, ...doc.data() });
    });
    // Sort by priority ascending
    banners.sort((a, b) => (Number(a.priority) || 999) - (Number(b.priority) || 999));
    res.json({ banners, total: banners.length });
  } catch (error) {
    console.error("Error in /api/admin/banners GET:", error);
    res.status(500).json({ error: error.message, banners: [] });
  }
});

app.post("/api/admin/banners", async (req, res) => {
  try {
    const db = getFirestore();
    const { id, imageUrl, actionType, actionValue, priority, isActive } = req.body;

    let docId = id ? id.trim() : "";
    if (!docId) {
      const snap = await db.collection("banners").get();
      docId = `banner${snap.size + 1}`;
    }

    const bannerData = {
      imageUrl: imageUrl || "",
      actionType: actionType || "product",
      actionValue: actionValue || "",
      priority: Number(priority) || 1,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      updatedAt: new Date().toISOString(),
    };

    await db.collection("banners").doc(docId).set(bannerData, { merge: true });
    console.log(`Created/Updated banner ${docId}:`, bannerData);
    res.json({ success: true, id: docId, banner: bannerData });
  } catch (error) {
    console.error("Error in /api/admin/banners POST:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/admin/banners/:id", async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    const body = req.body;

    const bannerData = {
      updatedAt: new Date().toISOString(),
    };

    if (body.imageUrl !== undefined) bannerData.imageUrl = String(body.imageUrl);
    if (body.actionType !== undefined) bannerData.actionType = String(body.actionType);
    if (body.actionValue !== undefined) bannerData.actionValue = String(body.actionValue);
    if (body.priority !== undefined) bannerData.priority = Number(body.priority);
    if (body.isActive !== undefined) bannerData.isActive = Boolean(body.isActive);

    await db.collection("banners").doc(id).set(bannerData, { merge: true });
    console.log(`Updated banner ${id}:`, bannerData);
    res.json({ success: true, id, updated: bannerData });
  } catch (error) {
    console.error(`Error in /api/admin/banners/${req.params.id} PUT:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/admin/banners/:id/toggle", async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    const { isActive } = req.body;

    const docRef = db.collection("banners").doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Banner not found" });
    }

    const currentStatus = docSnap.data().isActive;
    const newStatus = isActive !== undefined ? Boolean(isActive) : !currentStatus;

    await docRef.update({
      isActive: newStatus,
      updatedAt: new Date().toISOString(),
    });

    console.log(`Toggled isActive for banner ${id} to ${newStatus}`);
    res.json({ success: true, id, isActive: newStatus });
  } catch (error) {
    console.error(`Error in /api/admin/banners/${req.params.id}/toggle:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/admin/banners/:id", async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    await db.collection("banners").doc(id).delete();
    console.log(`Deleted banner ${id}`);
    res.json({ success: true, id });
  } catch (error) {
    console.error(`Error in /api/admin/banners/${req.params.id} DELETE:`, error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});




