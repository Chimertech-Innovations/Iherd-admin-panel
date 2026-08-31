const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccount = require("./serviceAccountKey.json");
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function run() {
  const collections = await db.listCollections();
  console.log("=== ROOT COLLECTIONS ===");
  for (const col of collections) {
    const snap = await col.get();
    console.log(`Collection: ${col.id} | Doc Count: ${snap.size}`);
  }

  console.log("\n=== INSPECTING DOCUMENTS & LOCATIONS IN DB ===");
  for (const colName of ["users", "farmers", "farms", "sellers", "cattle_details", "addresses", "profiles", "products", "orders", "productOrders"]) {
    try {
      const snap = await db.collection(colName).get();
      if (snap.empty) continue;
      console.log(`\n--- Collection ${colName} (${snap.size} docs) ---`);
      const states = {};
      const roles = {};
      snap.docs.forEach((d, i) => {
        const data = d.data();
        if (i < 3) {
          console.log(`Doc [${d.id}]:`, JSON.stringify(data, null, 2).slice(0, 500));
        }
        const state = data.state || data.address?.state || data.location?.state || data.city || data.district || data.address || data.location || data.pincode;
        if (state) {
          const sStr = typeof state === 'object' ? JSON.stringify(state) : String(state);
          states[sStr] = (states[sStr] || 0) + 1;
        }
        if (data.role || data.roles) {
          const rStr = JSON.stringify(data.role || data.roles);
          roles[rStr] = (roles[rStr] || 0) + 1;
        }
      });
      console.log(`  States summary in ${colName}:`, states);
      console.log(`  Roles summary in ${colName}:`, roles);
    } catch (e) {
      console.log(`Error checking ${colName}:`, e.message);
    }
  }

  console.log("\n=== CHECKING COLLECTION GROUPS ===");
  for (const groupName of ["farms", "cattle_details", "addresses", "cattle", "orders", "productOrders"]) {
    try {
      const snap = await db.collectionGroup(groupName).get();
      console.log(`\nCollectionGroup '${groupName}' total docs: ${snap.size}`);
      if (snap.size > 0) {
        console.log(` Sample group doc path:`, snap.docs[0].ref.path);
        console.log(` Sample group doc data:`, JSON.stringify(snap.docs[0].data()).slice(0, 500));
        const groupStates = {};
        snap.docs.forEach((d, i) => {
          const data = d.data();
          if (i < 3) console.log(` Group Doc [${d.id}]:`, JSON.stringify(data).slice(0, 300));
          const state = data.state || data.address?.state || data.location?.state || data.city || data.district || data.address || data.location;
          if (state) {
            const sStr = typeof state === 'object' ? JSON.stringify(state) : String(state);
            groupStates[sStr] = (groupStates[sStr] || 0) + 1;
          }
        });
        console.log(`  Group states summary in ${groupName}:`, groupStates);
      }
    } catch (e) {
      console.log(`Error checking group ${groupName}:`, e.message);
    }
  }

  process.exit(0);
}

run().catch(console.error);
