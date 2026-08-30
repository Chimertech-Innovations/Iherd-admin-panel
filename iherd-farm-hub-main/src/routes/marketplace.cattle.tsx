import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Beef,
  Camera,
  ExternalLink,
  Eye,
  Info,
  Maximize2,
  RefreshCw,
  User,
  MapPin,
  Phone,
  ShieldCheck,
  Building,
  Tag,
  Clock,
  Sparkles,
} from "lucide-react";
import { useFirebaseCollection } from "../hooks/useFirebaseData";
import { getLocalizedText } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/marketplace/cattle")({
  head: () => ({ meta: [{ title: "Cattle Register & Marketplace — iHerd Admin" }] }),
  component: CattleMarketplacePage,
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

function CattleMarketplacePage() {
  const [backendCattle, setBackendCattle] = useState<any[]>([]);
  const [backendLoading, setBackendLoading] = useState(true);
  const [selectedCattleDetail, setSelectedCattleDetail] = useState<any | null>(null);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Client Firebase `cattle-marketplace` collection
  const { data: cmList = [], isLoading: cmLoading } = useFirebaseCollection<any>("cattle-marketplace");

  // Only map documents from `cattle-marketplace`
  const allCattle = useMemo(() => {
    const cattleMap = new Map<string, any>();

    cmList.forEach((c: any) => {
      const key = c.cattleId || c.rfid || c.tagNo || c.id;
      if (!key) return;
      cattleMap.set(key, {
        ...c,
        id: key,
        cattleId: key,
        title: getLocalizedText(c.title || c.cattleName || c.breed || (c.tagNo ? `Cattle #${c.tagNo}` : "Dairy Cattle")),
        breed: getLocalizedText(c.breed?.key || c.breed || "—"),
        species: getLocalizedText(c.species?.key || c.species || "Cow"),
        rfid: getLocalizedText(c.rfid || c.tagNo, key),
        tagNo: getLocalizedText(c.tagNo || c.rfid, key),
        gender: getLocalizedText(c.gender, "Female"),
        color: getLocalizedText(c.color, "—"),
        age: getLocalizedText(c.age, "—"),
        weight: getLocalizedText(c.weight, "—"),
        height: getLocalizedText(c.height, "—"),
        status: getLocalizedText(c.status, "On Sale"),
        price: Number(c.price || c.value || 0),
        milkYield: getLocalizedText(c.milkYield || c.dailyYield, "—"),
        parity: getLocalizedText(c.parity || c.lactation, "—"),
        ownerName: getLocalizedText(c.sellerName || c.ownerName || c.postedBy, "Farmer / Seller"),
        ownerPhone: getLocalizedText(c.phone || c.sellerPhone || c.phoneNumber, "—"),
        ownerUid: getLocalizedText(c.sellerId || c.ownerUid || c.userId, ""),
        state: getLocalizedText(c.state, "—"),
        village: getLocalizedText(c.village || c.location, "—"),
        images: (c.images && Array.isArray(c.images) && c.images.length > 0) ? c.images : [c.imageUrl, c.faceViewImagePath].filter(Boolean),
        source: "cattle-marketplace",
        createdAt: c.createdAt || c.postedAt || null,
      });
    });

    return Array.from(cattleMap.values()).sort(
      (a, b) => parseTime(b.createdAt) - parseTime(a.createdAt)
    );
  }, [cmList]);

  const isLoading = cmLoading && allCattle.length === 0;

  const onSaleCount = allCattle.filter(c => (getLocalizedText(c.status) || "").toLowerCase().includes("sale") || c.price > 0).length;
  const verifiedRfidCount = allCattle.filter(c => c.rfid && c.rfid !== "—" && !c.rfid.startsWith("cattle-")).length;
  const activeCount = allCattle.filter(c => (getLocalizedText(c.status) || "").toLowerCase() === "active").length;

  return (
    <div className="space-y-6">
      <DataPage
        title="Live Cattle Register & Marketplace"
        description="Comprehensive records of all registered livestock, RFID verification tags, multi-angle camera proofs, and live marketplace listings."
        primaryAction=""
        isLoading={isLoading}
        filters={["All", "Active", "On Sale", "Verified RFID"]}
        statusKey="filterCategory"
        kpis={[
          { label: "Total Cattle Registered", value: isLoading ? "…" : allCattle.length.toLocaleString() },
          { label: "On Marketplace Sale", value: isLoading ? "…" : onSaleCount.toLocaleString() },
          { label: "Active Livestock", value: isLoading ? "…" : activeCount.toLocaleString() },
          { label: "Verified RFID Tags", value: isLoading ? "…" : verifiedRfidCount.toLocaleString() },
        ]}
        data={allCattle.map(c => {
          const mainImg = c.faceView || c.leftView || (Array.isArray(c.images) && c.images[0]) || c.imageUrl || c.image;
          const filterCategory = c.rfid && c.rfid !== "—" && !c.rfid.startsWith("cattle-")
            ? "Verified RFID"
            : (getLocalizedText(c.status) || "").toLowerCase().includes("sale")
            ? "On Sale"
            : "Active";

          return {
            ...c,
            mainImg,
            filterCategory,
            formattedDate: formatDate(c.createdAt),
            displayPrice: c.price ? `₹${Number(c.price).toLocaleString()}` : "—",
          };
        })}
        columns={[
          {
            key: "cattleName",
            label: "Cattle & Breed",
            render: (r) => (
              <div className="flex items-center gap-3">
                {r.mainImg ? (
                  <img
                    src={r.mainImg}
                    alt={r.title}
                    className="h-11 w-11 rounded-xl object-cover ring-1 ring-border/60 shrink-0 cursor-pointer hover:scale-105 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPreviewImage({ url: r.mainImg, title: `${r.title} - Front View` });
                    }}
                  />
                ) : (
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Beef className="h-5 w-5" />
                  </div>
                )}
                <div className="space-y-0.5">
                  <div className="font-bold text-sm text-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => setSelectedCattleDetail(r)}>
                    {r.title}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{r.breed}</span>
                    <span>•</span>
                    <span>{r.species}</span>
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "rfid",
            label: "RFID Tag No",
            render: (r) => (
              <div className="space-y-0.5">
                <span className="font-mono text-xs font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded-lg border border-border/50 select-all">
                  {r.rfid || "—"}
                </span>
                <div className="text-[10px] text-muted-foreground font-mono">ID: {r.cattleId || r.id}</div>
              </div>
            ),
          },
          {
            key: "ownerName",
            label: "Owner / Farm",
            render: (r) => (
              <div className="space-y-0.5">
                <div className="font-semibold text-xs text-foreground flex items-center gap-1">
                  <User className="h-3 w-3 text-primary shrink-0" />
                  <span>{r.ownerName}</span>
                </div>
                {r.ownerPhone !== "—" && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span>{r.ownerPhone}</span>
                  </div>
                )}
                {r.village !== "—" && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span>{r.village}, {r.state}</span>
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "milkYield",
            label: "Milk Yield",
            render: (r) => (
              <div>
                <span className="font-bold text-xs text-foreground">{r.milkYield !== "—" ? `${r.milkYield} L/day` : "—"}</span>
                {r.parity && r.parity !== "—" && (
                  <div className="text-[10px] text-muted-foreground">Lactation: {r.parity}</div>
                )}
              </div>
            ),
          },
          {
            key: "price",
            label: "Price / Value",
            render: (r) => (
              <div className="font-black text-sm text-primary">
                {r.displayPrice}
              </div>
            ),
          },
          {
            key: "createdAt",
            label: "Registered Time",
            render: (r) => (
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>{r.formattedDate}</span>
                </div>
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{r.source}</div>
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
                  title="View full specifications & camera proofs"
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

      {/* Full Cattle Detail Modal */}
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
                <StatusBadge status={selectedCattleDetail?.status || "Active"} />
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedCattleDetail && (
            <div className="space-y-6 pt-2">
              {/* Photo Proofs Grid */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-primary" /> Multi-Angle Camera Proofs & Verification Photos
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Face View", url: selectedCattleDetail.faceView },
                    { label: "Left View", url: selectedCattleDetail.leftView },
                    { label: "Right View", url: selectedCattleDetail.rightView },
                    { label: "Muzzle View", url: selectedCattleDetail.muzzleView },
                    { label: "Udder View", url: selectedCattleDetail.udderView },
                    { label: "Top / Bottom", url: selectedCattleDetail.bottomView },
                    { label: "Farmer Proof", url: selectedCattleDetail.farmerView },
                    ...(Array.isArray(selectedCattleDetail.images) ? selectedCattleDetail.images.slice(0, 4).map((img: string, idx: number) => ({ label: `Photo #${idx + 1}`, url: img })) : []),
                  ].filter((p, idx, self) => !!p.url && self.findIndex(t => t.url === p.url) === idx).map((p, i) => (
                    <div
                      key={i}
                      className="group rounded-2xl overflow-hidden border border-border/60 bg-muted/40 cursor-pointer hover:shadow-md transition-all flex flex-col"
                      onClick={() => setSelectedPreviewImage({ url: p.url, title: `${selectedCattleDetail.title} - ${p.label}` })}
                    >
                      <div className="h-28 bg-muted overflow-hidden relative">
                        <img src={p.url} alt={p.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Eye className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="p-2 text-center text-xs font-semibold bg-card truncate">{p.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Complete Specifications Grid */}
              <div className="space-y-3 bg-muted/20 p-5 rounded-2xl border border-border/40">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Full Livestock Technical Specifications
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Cattle Name / Tag:</span>
                    <strong className="text-foreground">{selectedCattleDetail.title}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Species:</span>
                    <strong className="text-foreground">{selectedCattleDetail.species || "Cow"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Breed:</span>
                    <strong className="text-foreground">{selectedCattleDetail.breed || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">RFID Tag Number:</span>
                    <strong className="font-mono text-foreground">{selectedCattleDetail.rfid || selectedCattleDetail.tagNo || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Gender:</span>
                    <strong className="text-foreground capitalize">{selectedCattleDetail.gender || "Female"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Color:</span>
                    <strong className="text-foreground">{selectedCattleDetail.color || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Age:</span>
                    <strong className="text-foreground">{selectedCattleDetail.age ? `${selectedCattleDetail.age} months / yrs` : "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Milk Yield:</span>
                    <strong className="text-foreground font-bold">{selectedCattleDetail.milkYield ? `${selectedCattleDetail.milkYield} L/day` : "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Parity / Lactation:</span>
                    <strong className="text-foreground">{selectedCattleDetail.parity || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Weight:</span>
                    <strong className="text-foreground">{selectedCattleDetail.weight || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Height:</span>
                    <strong className="text-foreground">{selectedCattleDetail.height || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Market Value / Price:</span>
                    <strong className="text-primary font-bold text-sm">₹{Number(selectedCattleDetail.price || selectedCattleDetail.value || 0).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Father Tag No:</span>
                    <strong className="text-foreground">{selectedCattleDetail.fatherTagNo || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Mother Tag No:</span>
                    <strong className="text-foreground">{selectedCattleDetail.motherTagNo || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Insurance Verified:</span>
                    <strong className="text-foreground">{selectedCattleDetail.insurance ? "✅ Insured" : "No"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Registration Time:</span>
                    <strong className="text-foreground">{formatDate(selectedCattleDetail.createdAt)}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Farm ID:</span>
                    <strong className="font-mono text-foreground text-[11px] truncate block">{selectedCattleDetail.farmId || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Owner / Farmer UID:</span>
                    <strong className="font-mono text-foreground text-[11px] truncate block">{selectedCattleDetail.ownerUid || "—"}</strong>
                  </div>
                </div>
              </div>

              {/* Owner card & link */}
              {selectedCattleDetail.ownerUid && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border/50 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-foreground">{selectedCattleDetail.ownerName}</div>
                      <div className="text-xs text-muted-foreground">{selectedCattleDetail.ownerPhone} • {selectedCattleDetail.village}, {selectedCattleDetail.state}</div>
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

      {/* Image Preview Modal */}
      <Dialog open={!!selectedPreviewImage} onOpenChange={(open) => !open && setSelectedPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold truncate">{selectedPreviewImage?.title}</DialogTitle>
          </DialogHeader>
          {selectedPreviewImage && (
            <div className="space-y-4">
              <div className="max-h-[70vh] rounded-2xl overflow-hidden bg-black/5 flex items-center justify-center">
                <img
                  src={selectedPreviewImage.url}
                  alt={selectedPreviewImage.title}
                  className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono truncate max-w-md">
                  {selectedPreviewImage.url}
                </span>
                <Button asChild size="sm" className="gap-1.5">
                  <a href={selectedPreviewImage.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" /> Open Full Image
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
