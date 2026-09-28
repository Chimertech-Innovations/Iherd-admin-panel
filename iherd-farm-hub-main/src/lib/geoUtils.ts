// Comprehensive Geo Utilities for iHerd Admin Live Map
// Includes Coordinate Parsing, Indian Agricultural Hubs Geocoding Dictionary,
// Pincode & Taluk Resolution, Deterministic Jitter, and Haversine Distance Calculation.

export interface GeoEntity {
  id: string;
  type: "farm" | "farmer" | "vet" | "seller" | "cattle";
  title: string;
  subtitle: string;
  phone?: string;
  email?: string;
  locationName: string;
  state?: string;
  district?: string;
  city?: string;
  village?: string;
  taluk?: string;
  address?: string;
  latitude: number;
  longitude: number;
  isExactCoordinate: boolean;
  avatar?: string;
  image?: string;
  badge?: string;
  status?: string;
  rating?: number;
  cattleCount?: number;
  price?: number;
  ownerName?: string;
  ownerUid?: string;
  animal?: string;
  farmTechnique?: string;
  numberOfEmployees?: string;
  numberOfAnimals?: string;
  farmEquipmentList?: string[];
  veterinaryName?: string;
  veterinarianPhoneNumber?: string;
  details?: Record<string, any>;
  linkUrl?: string;
  createdAt?: number;
}

// Haversine formula to compute great-circle distance between two points in km
export function getHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Comprehensive Coordinates Dictionary for Indian States, UTs, Districts, Taluks, and Cities
const INDIAN_LOCATIONS_MAP: Record<string, { lat: number; lng: number }> = {
  // --- States & UTs ---
  punjab: { lat: 31.1471, lng: 75.3412 },
  haryana: { lat: 29.0588, lng: 76.0856 },
  rajasthan: { lat: 27.0238, lng: 74.2179 },
  gujarat: { lat: 22.2587, lng: 71.1924 },
  maharashtra: { lat: 19.7515, lng: 75.7139 },
  "uttar pradesh": { lat: 26.8467, lng: 80.9462 },
  up: { lat: 26.8467, lng: 80.9462 },
  "madhya pradesh": { lat: 22.9734, lng: 78.6569 },
  mp: { lat: 22.9734, lng: 78.6569 },
  karnataka: { lat: 15.3173, lng: 75.7139 },
  "tamil nadu": { lat: 11.1271, lng: 78.6569 },
  tn: { lat: 11.1271, lng: 78.6569 },
  "andhra pradesh": { lat: 15.9129, lng: 79.74 },
  ap: { lat: 15.9129, lng: 79.74 },
  telangana: { lat: 18.1124, lng: 79.0193 },
  bihar: { lat: 25.0961, lng: 85.3131 },
  "west bengal": { lat: 22.9868, lng: 87.855 },
  wb: { lat: 22.9868, lng: 87.855 },
  odisha: { lat: 20.9517, lng: 85.0985 },
  kerala: { lat: 10.8505, lng: 76.2711 },
  jharkhand: { lat: 23.6102, lng: 85.2799 },
  assam: { lat: 26.2006, lng: 92.9376 },
  chhattisgarh: { lat: 21.2787, lng: 81.8661 },
  uttarakhand: { lat: 30.0668, lng: 79.0193 },
  "himachal pradesh": { lat: 31.1048, lng: 77.1734 },
  hp: { lat: 31.1048, lng: 77.1734 },
  delhi: { lat: 28.6139, lng: 77.209 },
  "jammu & kashmir": { lat: 33.7782, lng: 76.5762 },
  jk: { lat: 33.7782, lng: 76.5762 },
  goa: { lat: 15.2993, lng: 74.124 },

  // --- Tamil Nadu Districts, Taluks & Hubs ---
  salem: { lat: 11.6643, lng: 78.146 },
  mettur: { lat: 11.7963, lng: 77.8011 },
  attur: { lat: 11.5977, lng: 78.5986 },
  kadayampatty: { lat: 11.8324, lng: 78.1077 },
  danishpettai: { lat: 11.8324, lng: 78.1077 },
  navapatti: { lat: 11.7963, lng: 77.8011 },
  keeripatti: { lat: 11.5543, lng: 78.6183 },
  palamedu: { lat: 11.8324, lng: 78.1077 },
  theni: { lat: 10.0104, lng: 77.4768 },
  cumbum: { lat: 9.7348, lng: 77.2818 },
  villupuram: { lat: 11.9401, lng: 79.4861 },
  viluppuram: { lat: 11.9401, lng: 79.4861 },
  gingee: { lat: 12.253, lng: 79.4187 },
  nagandur: { lat: 12.18, lng: 79.45 },
  erode: { lat: 11.341, lng: 77.7172 },
  gobichettipalayam: { lat: 11.4549, lng: 77.4379 },
  gobi: { lat: 11.4549, lng: 77.4379 },
  ottarkarattupalayam: { lat: 11.4549, lng: 77.4379 },
  krishnagiri: { lat: 12.5186, lng: 78.2137 },
  hosur: { lat: 12.7409, lng: 77.8253 },
  kuttigoundanur: { lat: 12.5186, lng: 78.2137 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  perambur: { lat: 13.1114, lng: 80.2443 },
  namakkal: { lat: 11.2189, lng: 78.1674 },
  tiruchengode: { lat: 11.3789, lng: 77.8933 },
  coimbatore: { lat: 11.0168, lng: 76.9558 },
  madurai: { lat: 9.9252, lng: 78.1198 },
  trichy: { lat: 10.7905, lng: 78.7047 },
  tiruchirappalli: { lat: 10.7905, lng: 78.7047 },
  thanjavur: { lat: 10.787, lng: 79.1378 },
  dindigul: { lat: 10.3673, lng: 77.9803 },
  tirunelveli: { lat: 8.7139, lng: 77.7567 },
  vellore: { lat: 12.9165, lng: 79.1325 },
  dharmapuri: { lat: 12.1211, lng: 78.1582 },

  // --- Karnataka Districts, Taluks & Hubs ---
  chikkaballapur: { lat: 13.4355, lng: 77.7275 },
  chintamani: { lat: 13.4026, lng: 78.0569 },
  atturu: { lat: 13.4355, lng: 77.7275 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  kolar: { lat: 13.1367, lng: 78.1291 },
  mysuru: { lat: 12.2958, lng: 76.6394 },
  mandya: { lat: 12.5218, lng: 76.8951 },
  tumakuru: { lat: 13.3409, lng: 77.1006 },
  tumkur: { lat: 13.3409, lng: 77.1006 },
  shivamogga: { lat: 13.9299, lng: 75.5681 },
  shimoga: { lat: 13.9299, lng: 75.5681 },
  hassan: { lat: 13.0033, lng: 76.1004 },
  davangere: { lat: 14.4644, lng: 75.9218 },
  dharwad: { lat: 15.4589, lng: 75.0078 },
  belagavi: { lat: 15.8497, lng: 74.4977 },

  // --- Maharashtra Districts, Taluks & Hubs ---
  aurangabad: { lat: 19.8762, lng: 75.3433 },
  "chhatrapati sambhajinagar": { lat: 19.8762, lng: 75.3433 },
  sambhajinagar: { lat: 19.8762, lng: 75.3433 },
  gandheli: { lat: 19.83, lng: 75.38 },
  ahmadnagar: { lat: 19.0948, lng: 74.748 },
  ahmednagar: { lat: 19.0948, lng: 74.748 },
  sangamner: { lat: 19.5768, lng: 74.209 },
  shirdi: { lat: 19.7645, lng: 74.4762 },
  pune: { lat: 18.5204, lng: 73.8567 },
  nashik: { lat: 19.9975, lng: 73.7898 },
  kolhapur: { lat: 16.705, lng: 74.2433 },
  satara: { lat: 17.6805, lng: 74.0183 },
  solapur: { lat: 17.6599, lng: 75.9064 },
  jalgaon: { lat: 21.0077, lng: 75.5626 },
  nagpur: { lat: 21.1458, lng: 79.0882 },

  // --- Rajasthan Districts & Hubs ---
  sikar: { lat: 27.6094, lng: 75.1399 },
  rashidpura: { lat: 27.6094, lng: 75.1399 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  jodhpur: { lat: 26.2389, lng: 73.0243 },
  bikaner: { lat: 28.0229, lng: 73.3119 },
  udaipur: { lat: 24.5854, lng: 73.7125 },
  alwar: { lat: 27.553, lng: 76.6346 },
  nagaur: { lat: 27.1983, lng: 73.7493 },
  jhunjhunu: { lat: 28.1289, lng: 75.3995 },
  kota: { lat: 25.2138, lng: 75.8648 },

  // --- Gujarat Hubs ---
  anand: { lat: 22.5645, lng: 72.9289 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  surat: { lat: 21.1702, lng: 72.8311 },
  rajkot: { lat: 22.3039, lng: 70.8022 },
  vadodara: { lat: 22.3072, lng: 73.1812 },
  mehsana: { lat: 23.588, lng: 72.3693 },

  // --- Punjab & Haryana Hubs ---
  ludhiana: { lat: 30.901, lng: 75.8573 },
  amritsar: { lat: 31.634, lng: 74.8723 },
  patiala: { lat: 30.3398, lng: 76.3869 },
  jalandhar: { lat: 31.326, lng: 75.5762 },
  bathinda: { lat: 30.211, lng: 74.9455 },
  karnal: { lat: 29.6857, lng: 76.9905 },
  hisar: { lat: 29.1492, lng: 75.7217 },
  rohtak: { lat: 28.8955, lng: 76.6066 },
  kurukshetra: { lat: 29.9695, lng: 76.8783 },
  ambala: { lat: 30.3782, lng: 76.7767 },

  // --- Other Major States & Cities ---
  lucknow: { lat: 26.8467, lng: 80.9462 },
  mathura: { lat: 27.4924, lng: 77.6737 },
  varanasi: { lat: 25.3176, lng: 82.9739 },
  kanpur: { lat: 26.4499, lng: 80.3319 },
  meerut: { lat: 28.9845, lng: 77.7064 },
  agra: { lat: 27.1767, lng: 78.0081 },
  gorakhpur: { lat: 26.7606, lng: 83.3732 },
  bareilly: { lat: 28.367, lng: 79.4304 },
  indore: { lat: 22.7196, lng: 75.8577 },
  bhopal: { lat: 23.2599, lng: 77.4126 },
  jabalpur: { lat: 23.1815, lng: 79.9864 },
  gwalior: { lat: 26.2183, lng: 78.1828 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  vijayawada: { lat: 16.5062, lng: 80.648 },
  guntur: { lat: 16.3067, lng: 80.4365 },
  visakhapatnam: { lat: 17.6868, lng: 83.2185 },
  patna: { lat: 25.5941, lng: 85.1376 },
  muzaffarpur: { lat: 26.1209, lng: 85.3647 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  siliguri: { lat: 26.7271, lng: 88.3953 },
  bhubaneswar: { lat: 20.2961, lng: 85.8245 },
  cuttack: { lat: 20.4625, lng: 85.8828 },
  ranchi: { lat: 23.3441, lng: 85.3096 },
  guwahati: { lat: 26.1445, lng: 91.7362 },
  raipur: { lat: 21.2514, lng: 81.6296 },
  dehradun: { lat: 30.3165, lng: 78.0322 },
  shimla: { lat: 31.1048, lng: 77.1734 },
  srinagar: { lat: 34.0837, lng: 74.7973 },
  jammu: { lat: 32.7266, lng: 74.857 },
};

// Pincode prefix dictionary for instant regional geocoding in India
const PINCODE_PREFIX_MAP: Record<string, { lat: number; lng: number }> = {
  "600": { lat: 13.0827, lng: 80.2707 }, // Chennai
  "605": { lat: 11.9401, lng: 79.4861 }, // Villupuram / Puducherry
  "625": { lat: 10.0104, lng: 77.4768 }, // Theni / Madurai
  "635": { lat: 12.5186, lng: 78.2137 }, // Krishnagiri / Hosur
  "636": { lat: 11.6643, lng: 78.146 }, // Salem / Mettur / Attur
  "637": { lat: 11.2189, lng: 78.1674 }, // Namakkal
  "638": { lat: 11.341, lng: 77.7172 }, // Erode / Gobichettipalayam
  "641": { lat: 11.0168, lng: 76.9558 }, // Coimbatore
  "560": { lat: 12.9716, lng: 77.5946 }, // Bengaluru
  "562": { lat: 13.4355, lng: 77.7275 }, // Chikkaballapur
  "422": { lat: 19.5768, lng: 74.209 }, // Sangamner / Ahmednagar / Nashik
  "431": { lat: 19.8762, lng: 75.3433 }, // Aurangabad (Chhatrapati Sambhajinagar)
  "332": { lat: 27.6094, lng: 75.1399 }, // Sikar (Rajasthan)
  "302": { lat: 26.9124, lng: 75.7873 }, // Jaipur
  "141": { lat: 30.901, lng: 75.8573 }, // Ludhiana
  "132": { lat: 29.6857, lng: 76.9905 }, // Karnal
  "110": { lat: 28.6139, lng: 77.209 }, // New Delhi
  "226": { lat: 26.8467, lng: 80.9462 }, // Lucknow
  "380": { lat: 23.0225, lng: 72.5714 }, // Ahmedabad
};

// Deterministic small hash-based jitter so items in the same district don't overlap completely
function getDeterministicOffset(seed: string): { latOffset: number; lngOffset: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const angle = ((Math.abs(hash) % 360) * Math.PI) / 180;
  const radius = 0.012 + ((Math.abs(hash >> 3) % 40) / 1200); // ~1.2km to 4.5km
  return {
    latOffset: Math.sin(angle) * radius,
    lngOffset: Math.cos(angle) * radius,
  };
}

// Clean number parser for coordinate floats
function parseNumber(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") {
    return isNaN(val) ? null : val;
  }
  if (typeof val === "string") {
    const cleaned = val.trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// Extract exact or geocoded coordinates from any object or field candidates
export function resolveCoordinates(
  entity: any,
  seedKey: string
): { lat: number; lng: number; isExact: boolean } | null {
  if (!entity) return null;

  // Flatten nested objects (e.g. u.vet, u.veterinarian, u.seller, u.farmer, u.address, u.location)
  const vet = entity.vet || entity.veterinarian || {};
  const seller = entity.seller || {};
  const farmer = entity.farmer || {};
  const addressObj = entity.address && typeof entity.address === "object" ? entity.address : {};
  const locObj = entity.location && typeof entity.location === "object" ? entity.location : {};

  // 1. Direct latitude & longitude fields
  let latCandidate =
    entity.latitude ??
    entity.lat ??
    vet.latitude ??
    vet.lat ??
    seller.latitude ??
    seller.lat ??
    farmer.latitude ??
    farmer.lat ??
    entity.coords?.latitude ??
    entity.coords?.lat ??
    locObj.latitude ??
    locObj.lat ??
    locObj._latitude ??
    entity._latitude;

  let lngCandidate =
    entity.longitude ??
    entity.lng ??
    vet.longitude ??
    vet.lng ??
    seller.longitude ??
    seller.lng ??
    farmer.longitude ??
    farmer.lng ??
    entity.coords?.longitude ??
    entity.coords?.lng ??
    locObj.longitude ??
    locObj.lng ??
    locObj._longitude ??
    entity._longitude;

  // If string contains comma like "28.6139, 77.2090"
  if (typeof latCandidate === "string" && latCandidate.includes(",") && !lngCandidate) {
    const parts = latCandidate.split(",");
    latCandidate = parts[0];
    lngCandidate = parts[1];
  }

  const latNum = parseNumber(latCandidate);
  const lngNum = parseNumber(lngCandidate);

  // Validate real world bounds
  if (
    latNum !== null &&
    lngNum !== null &&
    latNum >= -90 &&
    latNum <= 90 &&
    lngNum >= -180 &&
    lngNum <= 180 &&
    !(latNum === 0 && lngNum === 0)
  ) {
    return { lat: latNum, lng: lngNum, isExact: true };
  }

  // 2. Geocode from location text fields (taluk, district, city, state, village, address, pincode)
  const pincodes = [
    entity.pincode,
    vet.pincode,
    seller.pincode,
    farmer.pincode,
    addressObj.pincode,
  ]
    .filter(Boolean)
    .map((p) => String(p).trim());

  for (const pin of pincodes) {
    const prefix = pin.substring(0, 3);
    if (PINCODE_PREFIX_MAP[prefix]) {
      const base = PINCODE_PREFIX_MAP[prefix];
      const offset = getDeterministicOffset(seedKey || pin);
      return {
        lat: base.lat + offset.latOffset,
        lng: base.lng + offset.lngOffset,
        isExact: false,
      };
    }
  }

  // Candidates list in order of geographical precision (Taluk/Village/City -> District -> State)
  const candidates = [
    vet.taluk,
    seller.taluk,
    farmer.taluk,
    entity.taluk,
    vet.village,
    seller.village,
    farmer.village,
    entity.village,
    vet.city,
    seller.city,
    farmer.city,
    entity.city,
    vet.district,
    seller.district,
    farmer.district,
    entity.district,
    vet.address,
    seller.address,
    farmer.address,
    typeof entity.address === "string" ? entity.address : "",
    vet.state,
    seller.state,
    farmer.state,
    entity.state,
    entity.locationName,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim());

  for (const raw of candidates) {
    // Check direct or partial dictionary match
    for (const [key, coords] of Object.entries(INDIAN_LOCATIONS_MAP)) {
      if (raw === key || raw.includes(key) || key.includes(raw)) {
        const offset = getDeterministicOffset(seedKey || raw);
        return {
          lat: coords.lat + offset.latOffset,
          lng: coords.lng + offset.lngOffset,
          isExact: false,
        };
      }
    }
  }

  // 3. Fallback: Southern / Central regional distribution (not clustered in Delhi)
  const fallbackCenters = [
    { lat: 11.1271, lng: 78.6569 }, // Tamil Nadu center
    { lat: 15.3173, lng: 75.7139 }, // Karnataka center
    { lat: 19.7515, lng: 75.7139 }, // Maharashtra center
    { lat: 27.0238, lng: 74.2179 }, // Rajasthan center
    { lat: 31.1471, lng: 75.3412 }, // Punjab center
  ];
  let hashNum = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hashNum += seedKey.charCodeAt(i);
  }
  const chosenFallback = fallbackCenters[hashNum % fallbackCenters.length];
  const defaultOffset = getDeterministicOffset(seedKey || "fallback");
  return {
    lat: chosenFallback.lat + defaultOffset.latOffset * 2,
    lng: chosenFallback.lng + defaultOffset.lngOffset * 2,
    isExact: false,
  };
}
