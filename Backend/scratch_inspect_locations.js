const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const usersSnap = await db.collection("users").get();
  console.log(`Total users in Firestore: ${usersSnap.size}`);

  const stateCounts = {};
  const cityCounts = {};
  let usersWithLocation = 0;

  usersSnap.docs.forEach(doc => {
    const data = doc.data();
    const farmer = data.farmer || {};
    const seller = data.seller || {};
    const vet = data.veterinarian || {};

    const state = data.state || farmer.state || seller.state || vet.state || data.address?.state || farmer.address?.state || seller.address?.state;
    const city = data.city || farmer.city || seller.city || vet.city || farmer.address || seller.address || data.district || farmer.taluk;
    const pincode = data.pincode || farmer.pincode || seller.pincode || vet.pincode;

    if (state || city || pincode) {
      usersWithLocation++;
    }

    if (state) {
      stateCounts[state] = (stateCounts[state] || 0) + 1;
    }
    if (city) {
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    }
  });

  console.log(`Users with location info: ${usersWithLocation}/${usersSnap.size}`);
  console.log("State Counts:", stateCounts);
  console.log("Top Cities/Districts:", Object.entries(cityCounts).sort((a,b)=>b[1]-a[1]).slice(0, 15));

  // Let's also check subcollections of users
  console.log("\n--- Checking subcollections under users ---");
  for (const doc of usersSnap.docs.slice(0, 20)) {
    const subs = await doc.ref.listCollections();
    if (subs.length > 0) {
      console.log(`User ${doc.id} subcollections:`, subs.map(s => s.id));
      for (const s of subs) {
        const sSnap = await s.get();
        sSnap.docs.forEach(sd => console.log(`  [${s.id}/${sd.id}]:`, JSON.stringify(sd.data()).slice(0, 200)));
      }
    }
  }

  // Also check cattle_details collection locations
  console.log("\n--- Checking cattle_details locations ---");
  const cattleSnap = await db.collection("cattle_details").get();
  const cattleStates = {};
  cattleSnap.docs.forEach(d => {
    const data = d.data();
    const st = data.state || data.location || data.sellerState || data.farmState || data.address;
    if (st) cattleStates[st] = (cattleStates[st] || 0) + 1;
    else console.log("Cattle doc keys:", Object.keys(data), "sample:", JSON.stringify(data).slice(0, 200));
  });
  console.log("Cattle States:", cattleStates);

  // Also check ProductOrders
  console.log("\n--- Checking ProductOrders locations ---");
  const ordersSnap = await db.collection("ProductOrders").get();
  const orderStates = {};
  ordersSnap.docs.forEach(d => {
    const data = d.data();
    const st = data.state || data.shippingAddress?.state || data.address?.state || data.buyerState || data.city;
    if (st) orderStates[st] = (orderStates[st] || 0) + 1;
    else console.log("Order doc sample:", JSON.stringify(data).slice(0, 300));
  });
  console.log("Order States:", orderStates);

  process.exit(0);
}

run().catch(console.error);
