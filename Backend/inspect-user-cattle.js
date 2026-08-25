require("dotenv").config();
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));
initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id || "auth-b404a"
});

const db = getFirestore();

async function inspectProfileAndCattle() {
  const targetUid = "RDcMebe8tkRfri4F14cwvaj5pj33";
  console.log("=== INSPECTING USER:", targetUid, "===");

  // 1. Search in all collections for targetUid
  const rootCollections = await db.listCollections();
  for (const col of rootCollections) {
    try {
      const snap = await col.get();
      const matchingDocs = snap.docs.filter(d => {
        const idMatch = d.id.toLowerCase() === targetUid.toLowerCase();
        const str = JSON.stringify(d.data()).toLowerCase();
        return idMatch || str.includes(targetUid.toLowerCase()) || str.includes("simbu") || str.includes("42561216101000005") || str.includes("iqfryu720mpczk8ceixv");
      });

      if (matchingDocs.length > 0) {
        console.log(`\n>>> MATCH IN COLLECTION: "${col.id}" (${matchingDocs.length} docs)`);
        matchingDocs.forEach(d => {
          console.log(`[${col.id}/${d.id}]:`, JSON.stringify(d.data(), null, 2));
        });
      }
    } catch (err) {
      console.log(`Error checking collection ${col.id}:`, err.message);
    }
  }

  // 2. Check subcollections under users doc if any
  try {
    const userSnap = await db.collection("users").get();
    for (const uDoc of userSnap.docs) {
      if (uDoc.id.toLowerCase() === targetUid.toLowerCase() || (uDoc.data().uid && uDoc.data().uid.toLowerCase() === targetUid.toLowerCase())) {
        console.log("\n>>> FOUND USER DOC:", uDoc.id, JSON.stringify(uDoc.data(), null, 2));
        const subcols = await uDoc.ref.listCollections();
        console.log("Subcollections under users/" + uDoc.id + ":", subcols.map(c => c.id));
        for (const sub of subcols) {
          const sSnap = await sub.get();
          console.log(`Subcollection ${sub.id} (${sSnap.docs.length} docs):`);
          sSnap.docs.forEach(sd => console.log(`  - [${sub.id}/${sd.id}]:`, JSON.stringify(sd.data(), null, 2)));
        }
      }
    }
  } catch (e) {
    console.log("Subcollection check error:", e.message);
  }
}

inspectProfileAndCattle().catch(console.error);
