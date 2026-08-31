const path = require("path");
const fs = require("fs");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccount = require("./serviceAccountKey.json");
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function run() {
  console.log("Testing collectionGroup('cattles')...");
  const groupCattles = await db.collectionGroup("cattles").get().catch(e => console.error("group cattles err:", e));
  if (groupCattles) {
    console.log("groupCattles size:", groupCattles.size);
    groupCattles.docs.forEach(d => console.log("Doc:", d.id, "Path:", d.ref.path, "Data:", d.data()));
  }

  console.log("Testing collectionGroup('cattle')...");
  const groupCattle = await db.collectionGroup("cattle").get().catch(e => console.error("group cattle err:", e));
  if (groupCattle) {
    console.log("groupCattle size:", groupCattle.size);
    groupCattle.docs.forEach(d => console.log("Doc:", d.id, "Path:", d.ref.path, "Data:", d.data()));
  }

  console.log("Testing specific user path...");
  const uDoc = db.doc("users/RDcMebe8tkRfri4Fi4cwvaj5pj33/roles/farmer/farms/25icfxnWLKWBuaXEIMyN/cattles/iqfRYU72OmPcZK8CEiXv");
  const snap = await uDoc.get();
  console.log("Specific doc exists?:", snap.exists);
  if (snap.exists) {
    console.log("Data:", snap.data());
  }

  console.log("Testing farm subcollections...");
  const farmRef = db.doc("users/RDcMebe8tkRfri4Fi4cwvaj5pj33/roles/farmer/farms/25icfxnWLKWBuaXEIMyN");
  const farmSnap = await farmRef.get();
  console.log("Farm exists?:", farmSnap.exists, farmSnap.data());
  const cattlesSub = await farmRef.collection("cattles").get();
  console.log("Farm cattles subcollection count:", cattlesSub.size);
  cattlesSub.forEach(d => console.log("Cattle Doc ID:", d.id, d.data()));
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
