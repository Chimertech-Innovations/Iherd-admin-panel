const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccount = require("./serviceAccountKey.json");
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function inspectBanners() {
  console.log("--- Inspecting /banners/offer_banners/items ---");
  const offersSnap = await db.collection("banners").doc("offer_banners").collection("items").get();
  console.log("Offer banners count:", offersSnap.size);
  offersSnap.forEach(d => console.log("ID:", d.id, "Data:", d.data()));

  console.log("\n--- Inspecting /banners/ads_banners/items ---");
  const adsSnap = await db.collection("banners").doc("ads_banners").collection("items").get();
  console.log("Ads banners count:", adsSnap.size);
  adsSnap.forEach(d => console.log("ID:", d.id, "Data:", d.data()));
}

inspectBanners().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
