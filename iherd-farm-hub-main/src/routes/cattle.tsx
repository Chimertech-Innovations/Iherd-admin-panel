import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Beef,
  Activity,
  User,
  MapPin,
  Phone,
  Clock,
  Eye,
  Maximize2,
  CheckCircle2,
  Calendar,
  ArrowUpDown,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import { useFirebaseCollection } from "../hooks/useFirebaseData";
import { getLocalizedText } from "@/lib/utils";

export const Route = createFileRoute("/cattle")({
  head: () => ({ meta: [{ title: "Cattle Details & Livestock Register — iHerd Admin" }] }),
  component: CattleDetailsPage,
});

function parseTime(val: any): number {
  if (!val) return 0;
  if (typeof val === "number") return val;
  if (val instanceof Date) return val.getTime();
  if (typeof val === "object" && (val._seconds || val.seconds)) {
    return (val._seconds || val.seconds) * 1000;
  }
  const d = new Date(val).getTime();
  return isNaN(d) ? 0 : d;
}

function formatDate(val: any): string {
  const ms = parseTime(val);
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TIME_FILTERS = [
  { label: "All Time", value: "all" },
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "Last 30 Days", value: "30days" },
  { label: "This Year", value: "year" },
];

function isWithinTimeFilter(timestamp: any, filter: string): boolean {
  if (filter === "all") return true;
  const ms = parseTime(timestamp);
  if (!ms) return false;

  const now = Date.now();
  const date = new Date(ms);
  const nowDate = new Date(now);

  if (filter === "today") {
    return (
      date.getDate() === nowDate.getDate() &&
      date.getMonth() === nowDate.getMonth() &&
      date.getFullYear() === nowDate.getFullYear()
    );
  }

  if (filter === "week") {
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    return ms >= oneWeekAgo && ms <= now;
  }

  if (filter === "month") {
    return (
      date.getMonth() === nowDate.getMonth() &&
      date.getFullYear() === nowDate.getFullYear()
    );
  }

  if (filter === "30days") {
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    return ms >= thirtyDaysAgo && ms <= now;
  }

  if (filter === "year") {
    return date.getFullYear() === nowDate.getFullYear();
  }

  return true;
}

function CattleDetailsPage() {
  const [timeFilter, setTimeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [backendCattle, setBackendCattle] = useState<any[]>([]);
  const [backendLoading, setBackendLoading] = useState(true);

  const [selectedCattleDetail, setSelectedCattleDetail] = useState<any | null>(null);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Client Firebase collection
  const { data: cdList = [], isLoading: cdLoading } = useFirebaseCollection<any>("cattle_details");

  const API_BASE =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
    "http://localhost:5000";

  // Fetch backend cattle data
  const fetchData = async () => {
    try {
      setBackendLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/cattle`).catch(() => fetch("/api/admin/cattle"));
      if (res && res.ok) {
        const json = await res.json();
        if (Array.isArray(json.cattle)) setBackendCattle(json.cattle);
      }
    } catch (e) {
      console.warn("Could not fetch /api/admin/cattle:", e);
    } finally {
      setBackendLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map all Cattle from Firestore cattle_details
  const allCattle = useMemo(() => {
    const cattleMap = new Map<string, any>();

    // 1. Process Firestore `cattle_details`
    cdList.forEach((c: any) => {
      const key = c.cattleId || c.rfid || c.tagNo || c.id;
      if (!key) return;
      const faceImg = c.faceViewImagePath || c.faceView || (Array.isArray(c.images) && c.images[0]) || c.imageUrl || null;
      const leftImg = c.leftViewImagePath || c.leftView || (Array.isArray(c.images) && c.images[1]) || null;
      const rightImg = c.rightViewImagePath || c.rightView || (Array.isArray(c.images) && c.images[2]) || null;
      const muzzleImg = c.muzzleViewImagePath || c.muzzleView || null;
      const udderImg = c.udderViewImagePath || c.udderView || null;
      const topImg = c.topViewImagePath || c.bottomView || c.topview || null;
      const farmerImg = c.farmerViewImagePath || c.farmerView || null;

      const imgs = [faceImg, leftImg, rightImg, muzzleImg, udderImg, topImg, farmerImg].filter(Boolean);

      cattleMap.set(key, {
        ...c,
        id: key,
        cattleId: key,
        title: getLocalizedText(c.cattleName || c.name || c.title || (c.tagNo ? `Cattle #${c.tagNo}` : "Dairy Cattle")),
        breed: getLocalizedText(c.breed?.key || c.breed || "—"),
        species: getLocalizedText(c.species?.key || c.species || "Cow"),
        rfid: getLocalizedText(c.rfid || c.tagNo, key),
        tagNo: getLocalizedText(c.tagNo || c.rfid, key),
        gender: getLocalizedText(c.gender, "Female"),
        color: getLocalizedText(c.color, "—"),
        age: getLocalizedText(c.age, "—"),
        weight: getLocalizedText(c.weight, "—"),
        height: getLocalizedText(c.height, "—"),
        milkYield: getLocalizedText(c.milkYield || c.dailyYield, "—"),
        parity: getLocalizedText(c.parity || c.lactation, "—"),
        status: getLocalizedText(c.status, "Active"),
        price: Number(c.price || c.value || c.marketValue || 0),
        value: getLocalizedText(c.value || c.price, "—"),
        fatherTagNo: getLocalizedText(c.fatherTagNo, "—"),
        motherTagNo: getLocalizedText(c.motherTagNo, "—"),
        insurance: Boolean(c.insurance),
        ownerName: getLocalizedText(c.ownerName || c.farmerName || c.sellerName, "Farmer"),
        ownerPhone: getLocalizedText(c.phone || c.sellerPhone || c.phoneNumber, "—"),
        ownerUid: getLocalizedText(c.ownerUid || c.userId || c.farmerId, ""),
        farmId: getLocalizedText(c.farmId, "—"),
        farmName: getLocalizedText(c.farmName, "—"),
        village: getLocalizedText(c.village || c.district || c.location, "—"),
        state: getLocalizedText(c.state, "—"),
        faceView: faceImg,
        leftView: leftImg,
        rightView: rightImg,
        muzzleView: muzzleImg,
        udderView: udderImg,
        topView: topImg,
        farmerView: farmerImg,
        images: imgs,
        source: "cattle_details",
        createdAt: c.createdAt || c.registeredAt || c.date || null,
      });
    });

    // 2. Merge backend cattle
    backendCattle.forEach((bc: any) => {
      const key = bc.id || bc.cattleId;
      if (!key) return;
      const existing = cattleMap.get(key) || {};
      cattleMap.set(key, {
        ...existing,
        ...bc,
        images: (bc.images && Array.isArray(bc.images) && bc.images.length > 0) ? bc.images : existing.images || [],
        createdAt: bc.createdAt || existing.createdAt || null,
      });
    });

    return Array.from(cattleMap.values());
  }, [cdList, backendCattle]);

  // Filtered and Sorted Cattle
  const filteredCattle = useMemo(() => {
    return allCattle
      .filter((c) => isWithinTimeFilter(c.createdAt, timeFilter))
      .sort((a, b) => {
        const timeA = parseTime(a.createdAt);
        const timeB = parseTime(b.createdAt);
        return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
      });
  }, [allCattle, timeFilter, sortOrder]);

  const totalCattleCount = allCattle.length;
  const highYieldCattleCount = allCattle.filter((c) => {
    const yieldNum = parseFloat(String(c.milkYield).replace(/[^0-9.]/g, ""));
    return !isNaN(yieldNum) && yieldNum >= 12;
  }).length;
  const insuredCount = allCattle.filter((c) => c.insurance).length;
  const uniqueOwnersCount = new Set(allCattle.map((c) => c.ownerUid).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      {/* Top Header & Time / Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-4 rounded-3xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Beef className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Cattle Details & Livestock Registry</h2>
            <p className="text-xs text-muted-foreground">
              Live records fetched from Firestore <code className="text-primary font-mono text-[11px]">cattle_details</code>
            </p>
          </div>
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex items-center flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="rounded-xl h-9 text-xs gap-1.5 border-dashed">
            <Link to="/marketplace/cattle">
              <ShoppingBag className="h-3.5 w-3.5 text-primary" />
              <span>Go to Cattle Marketplace</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>

          {/* Time Filter */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-2" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="bg-transparent text-xs font-medium border-0 focus:ring-0 focus:outline-none pr-2 cursor-pointer text-foreground"
            >
              {TIME_FILTERS.map((tf) => (
                <option key={tf.value} value={tf.value} className="bg-popover text-popover-foreground">
                  {tf.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Order Toggle */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
            className="rounded-xl h-9 text-xs gap-1.5 border-dashed"
            title="Toggle Sort Order"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{sortOrder === "newest" ? "Latest First" : "Oldest First"}</span>
          </Button>
        </div>
      </div>

      <DataPage
        title="Cattle Details Directory"
        description="Comprehensive animal specifications, RFID ear tags, verified camera proofs, daily milk yield, and owner information."
        stats={[
          {
            label: "Total Tracked Cattle",
            value: String(totalCattleCount),
            change: "Live in cattle_details",
            up: true,
          },
          {
            label: "High Milk Yield (>12L)",
            value: String(highYieldCattleCount),
            change: "Peak dairy animals",
            up: true,
          },
          {
            label: "Insured Animals",
            value: String(insuredCount),
            change: "With active cover",
            up: true,
          },
          {
            label: "Unique Cattle Owners",
            value: String(uniqueOwnersCount),
            change: "Registered farmers",
            up: true,
          },
        ]}
        searchKeys={["title", "breed", "rfid", "tagNo", "ownerName", "village", "state", "ownerPhone"]}
        searchPlaceholder="Search cattle by RFID, tag number, breed, owner name, or village..."
        statusOptions={["Active", "On Sale", "Verified", "Sold"]}
        data={filteredCattle}
        columns={[
          {
            key: "photo",
            label: "Photo & RFID",
            render: (r) => {
              const img = (r.images && r.images[0]) || r.faceView || r.imageUrl;
              return (
                <div className="flex items-center gap-3">
                  {img ? (
                    <div
                      className="relative h-11 w-11 rounded-2xl overflow-hidden border shadow-sm cursor-pointer shrink-0 hover:opacity-90"
                      onClick={() => setSelectedPreviewImage({ url: img, title: `${r.title} (${r.rfid})` })}
                    >
                      <img src={img} alt={r.title} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Eye className="h-3.5 w-3.5 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="h-11 w-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-base shrink-0 border border-amber-500/20">
                      🐄
                    </div>
                  )}
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold text-xs text-foreground truncate">{r.title}</div>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded border border-primary/20">
                        {r.rfid || r.tagNo || "TAG—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            },
          },
          {
            key: "breed",
            label: "Breed & Species",
            render: (r) => (
              <div className="space-y-0.5 text-xs">
                <div className="font-semibold text-foreground">{r.breed}</div>
                <div className="text-[11px] text-muted-foreground">
                  {r.species} • {r.gender} {r.age !== "—" ? `(${r.age} yrs)` : ""}
                </div>
              </div>
            ),
          },
          {
            key: "milkYield",
            label: "Milk Yield & Specs",
            render: (r) => (
              <div className="space-y-0.5 text-xs">
                <div className="font-bold text-primary flex items-center gap-1">
                  <span>{r.milkYield !== "—" ? `${r.milkYield} L/day` : "—"}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {r.weight !== "—" ? `${r.weight} kg` : ""} {r.parity !== "—" ? `• Lactation #${r.parity}` : ""}
                </div>
              </div>
            ),
          },
          {
            key: "price",
            label: "Market Value",
            render: (r) => (
              <div className="space-y-0.5 text-xs">
                <div className="font-bold text-foreground">
                  {r.price > 0 ? `₹${Number(r.price).toLocaleString()}` : "Market Listed"}
                </div>
                {r.insurance && (
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Insured
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "owner",
            label: "Farmer / Owner",
            render: (r) => (
              <div className="space-y-0.5 text-xs">
                <Link
                  to="/users/$userId"
                  params={{ userId: r.ownerUid }}
                  search={{ tab: "cattle" } as any}
                  className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  <User className="h-3 w-3 text-primary shrink-0" />
                  <span>{r.ownerName}</span>
                </Link>
                <div className="text-[11px] text-muted-foreground">
                  {r.ownerPhone} • {r.state !== "—" ? r.state : "India"}
                </div>
              </div>
            ),
          },
          {
            key: "createdAt",
            label: "Registered Time",
            render: (r) => (
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1 font-medium text-foreground">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>{formatDate(r.createdAt)}</span>
                </div>
              </div>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "actions",
            label: "Actions",
            render: (r) => (
              <div className="flex items-center gap-1.5 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1 rounded-xl"
                  onClick={() => setSelectedCattleDetail(r)}
                  title="View full specs, RFID & camera proofs"
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Full Data
                </Button>
                {r.ownerUid && (
                  <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl" title="Open Farmer Profile">
                    <Link to="/users/$userId" params={{ userId: r.ownerUid }} search={{ tab: "cattle" } as any}>
                      <User className="h-4 w-4 text-muted-foreground hover:text-primary" />
                    </Link>
                  </Button>
                )}
              </div>
            ),
            className: "text-right",
          },
        ]}
      />

      {/* FULL CATTLE DETAIL MODAL */}
      <Dialog open={!!selectedCattleDetail} onOpenChange={(open) => !open && setSelectedCattleDetail(null)}>
        <DialogContent className="max-w-3xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Beef className="h-6 w-6 text-primary" />
                <span>{selectedCattleDetail?.title || "Cattle Details"}</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedCattleDetail?.rfid && (
                  <span className="bg-primary/10 text-primary text-xs font-mono font-bold px-3 py-1 rounded-full border border-primary/20">
                    RFID: {selectedCattleDetail.rfid}
                  </span>
                )}
                {selectedCattleDetail && <StatusBadge status={selectedCattleDetail.status || "Active"} />}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedCattleDetail && (
            <div className="space-y-6 mt-4">
              {/* Photo Views Carousel / Gallery */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-primary" /> Verified Camera Proofs & Perspectives
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Face View", url: selectedCattleDetail.faceView },
                    { label: "Left View", url: selectedCattleDetail.leftView },
                    { label: "Right View", url: selectedCattleDetail.rightView },
                    { label: "Muzzle View", url: selectedCattleDetail.muzzleView },
                    { label: "Udder View", url: selectedCattleDetail.udderView },
                    { label: "Top View", url: selectedCattleDetail.topView },
                    { label: "Farmer View", url: selectedCattleDetail.farmerView },
                  ]
                    .filter((v) => Boolean(v.url))
                    .map((view, i) => (
                      <div
                        key={i}
                        className="group relative rounded-2xl overflow-hidden border aspect-square bg-muted/30 cursor-pointer hover:border-primary transition-all"
                        onClick={() => setSelectedPreviewImage({ url: view.url, title: `${view.label} — ${selectedCattleDetail.title}` })}
                      >
                        <img src={view.url} alt={view.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-center">
                          <span className="text-[11px] font-semibold text-white">{view.label}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Animal Specifications */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Beef className="h-4 w-4 text-primary" /> Physical & Breed Specs
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Breed</span>
                      <span className="font-semibold">{selectedCattleDetail.breed}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Species & Gender</span>
                      <span className="font-semibold">{selectedCattleDetail.species} ({selectedCattleDetail.gender})</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Age & Color</span>
                      <span className="font-semibold">{selectedCattleDetail.age} yrs • {selectedCattleDetail.color}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Weight & Height</span>
                      <span className="font-semibold">{selectedCattleDetail.weight} kg • {selectedCattleDetail.height} cm</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Daily Milk Yield</span>
                      <span className="font-bold text-primary">{selectedCattleDetail.milkYield} L/day</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-primary" /> Registry & Value
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Estimated Value</span>
                      <span className="font-bold text-foreground">
                        {selectedCattleDetail.price > 0 ? `₹${Number(selectedCattleDetail.price).toLocaleString()}` : "Market Listed"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Insurance Status</span>
                      <span className={`font-semibold ${selectedCattleDetail.insurance ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {selectedCattleDetail.insurance ? "✓ Active Insurance" : "No Active Policy"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Sire / Father Tag</span>
                      <span className="font-mono">{selectedCattleDetail.fatherTagNo}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Dam / Mother Tag</span>
                      <span className="font-mono">{selectedCattleDetail.motherTagNo}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Registered Time</span>
                      <span className="font-medium">{formatDate(selectedCattleDetail.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Owner Info & Profile Link */}
              {selectedCattleDetail.ownerUid && (
                <div className="flex items-center justify-between p-3.5 rounded-2xl border bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-foreground">{selectedCattleDetail.ownerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedCattleDetail.ownerPhone} • {selectedCattleDetail.village}, {selectedCattleDetail.state}
                      </div>
                    </div>
                  </div>
                  <Button asChild size="sm" className="gap-1.5 rounded-xl">
                    <Link to="/users/$userId" params={{ userId: selectedCattleDetail.ownerUid }} search={{ tab: "cattle" } as any}>
                      <User className="h-4 w-4" /> Open Full Profile
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* FULL PHOTO ZOOM MODAL */}
      <Dialog open={!!selectedPreviewImage} onOpenChange={(open) => !open && setSelectedPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-4 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold truncate">
              {selectedPreviewImage?.title || "Image Preview"}
            </DialogTitle>
          </DialogHeader>
          {selectedPreviewImage && (
            <div className="rounded-2xl overflow-hidden bg-black/90 flex items-center justify-center max-h-[75vh]">
              <img
                src={selectedPreviewImage.url}
                alt={selectedPreviewImage.title}
                className="max-h-[75vh] w-auto object-contain rounded-xl"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
