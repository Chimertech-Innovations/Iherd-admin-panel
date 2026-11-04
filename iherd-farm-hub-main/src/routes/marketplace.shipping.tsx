import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Truck,
  IndianRupee,
  Weight,
  Clock,
  MapPin,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  X,
  Edit,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useShippingConfig, type ShippingConfig, type ZonePricing, type ShippingSlab } from "@/hooks/useFirebaseData";

export const Route = createFileRoute("/marketplace/shipping")({
  head: () => ({ meta: [{ title: "Shipping Configuration — iHerd Admin" }] }),
  component: ShippingConfigPage,
});

const ALL_INDIAN_STATES = [
  { code: "AP", name: "Andhra Pradesh" },
  { code: "AR", name: "Arunachal Pradesh" },
  { code: "AS", name: "Assam" },
  { code: "BR", name: "Bihar" },
  { code: "CG", name: "Chhattisgarh" },
  { code: "GA", name: "Goa" },
  { code: "GJ", name: "Gujarat" },
  { code: "HR", name: "Haryana" },
  { code: "HP", name: "Himachal Pradesh" },
  { code: "JH", name: "Jharkhand" },
  { code: "KA", name: "Karnataka" },
  { code: "KL", name: "Kerala" },
  { code: "MP", name: "Madhya Pradesh" },
  { code: "MH", name: "Maharashtra" },
  { code: "MN", name: "Manipur" },
  { code: "ML", name: "Meghalaya" },
  { code: "MZ", name: "Mizoram" },
  { code: "NL", name: "Nagaland" },
  { code: "OD", name: "Odisha" },
  { code: "PB", name: "Punjab" },
  { code: "RJ", name: "Rajasthan" },
  { code: "SK", name: "Sikkim" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "TS", name: "Telangana" },
  { code: "TR", name: "Tripura" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "UK", name: "Uttarakhand" },
  { code: "WB", name: "West Bengal" },
  { code: "AN", name: "Andaman & Nicobar" },
  { code: "CH", name: "Chandigarh" },
  { code: "DN", name: "Dadra & Nagar Haveli and Daman & Diu" },
  { code: "DL", name: "Delhi" },
  { code: "JK", name: "Jammu & Kashmir" },
  { code: "LA", name: "Ladakh" },
  { code: "LD", name: "Lakshadweep" },
  { code: "PY", name: "Puducherry" },
];

const ZONE_LABELS: Record<string, { title: string; color: string; desc: string }> = {
  tamil_nadu: { title: "Tamil Nadu & Puducherry", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", desc: "Local intrastate fast shipping" },
  south_india: { title: "South India", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20", desc: "Kerala, Karnataka, Andhra Pradesh, Telangana" },
  central_india: { title: "Central & West India", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20", desc: "Maharashtra, Delhi, Gujarat, West Bengal" },
  rest_of_india: { title: "Rest of India", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20", desc: "Northern & Central state territories" },
  north_east_india: { title: "North East India", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20", desc: "Assam, Sikkim, Meghalaya, Tripura & borders" },
  islands: { title: "Islands (Remote)", color: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20", desc: "Andaman & Nicobar, Lakshadweep" },
};

function ShippingConfigPage() {
  const { config, isLoading, refetch, updateConfig } = useShippingConfig();

  const [activeZone, setActiveZone] = useState<string>("tamil_nadu");
  const [localConfig, setLocalConfig] = useState<ShippingConfig | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [addSlabOpen, setAddSlabOpen] = useState(false);

  // State Code Adding
  const [selectedStateToAdd, setSelectedStateToAdd] = useState("");
  const [customStateCode, setCustomStateCode] = useState("");

  // New slab form
  const [newMin, setNewMin] = useState("");
  const [newMax, setNewMax] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [isSubmittingSlab, setIsSubmittingSlab] = useState(false);

  // Helper: Deduplicate weight slabs so identical [min, max] ranges never repeat
  const deduplicateSlabs = (slabs: ShippingSlab[]): ShippingSlab[] => {
    const seen = new Map<string, ShippingSlab>();
    for (const slab of slabs) {
      const key = `${Number(slab.min)}-${Number(slab.max)}`;
      seen.set(key, slab);
    }
    return Array.from(seen.values()).sort((a, b) => Number(a.min) - Number(b.min));
  };

  useEffect(() => {
    if (config && config.pricing) {
      const copy: ShippingConfig = JSON.parse(JSON.stringify(config));
      if (copy.pricing) {
        Object.keys(copy.pricing).forEach((zKey) => {
          if (Array.isArray(copy.pricing[zKey]?.slabs)) {
            copy.pricing[zKey].slabs = deduplicateSlabs(copy.pricing[zKey].slabs);
          }
        });
      }
      setLocalConfig(copy);
    }
  }, [config]);

  const rawPricing = localConfig?.pricing?.[activeZone];
  const currentPricing: ZonePricing = {
    extraPricePerKg: rawPricing?.extraPricePerKg ?? 100,
    slabs: deduplicateSlabs(rawPricing?.slabs || []),
  };

  const currentDeliveryTime = localConfig?.delivery_time?.[activeZone] || {
    en: "Delivery in 3–5 days",
    hi: "3–5 दिनों में डिलीवरी",
    ta: "3–5 நாட்களில் டெலிவரி",
  };

  const rawStates = localConfig?.zones?.[activeZone] || [];
  const currentStates: string[] = Array.from(new Set(rawStates));

  // Helper: Find which zone currently contains a given state code
  const findZoneForState = (code: string): string | null => {
    if (!localConfig?.zones) return null;
    for (const [zKey, stList] of Object.entries(localConfig.zones)) {
      if (Array.isArray(stList) && stList.includes(code)) {
        return zKey;
      }
    }
    return null;
  };

  // Move a state directly into any target zone (pure string array, preserves data types)
  const handleMoveState = (code: string, targetZone: string) => {
    const stCode = code.trim().toUpperCase();
    if (!stCode || !targetZone) return;

    setLocalConfig((prev) => {
      if (!prev) return prev;
      const copy: ShippingConfig = JSON.parse(JSON.stringify(prev));
      if (!copy.zones) copy.zones = {};

      // 1. Remove from all existing zones
      Object.keys(copy.zones).forEach((zKey) => {
        if (Array.isArray(copy.zones[zKey])) {
          copy.zones[zKey] = copy.zones[zKey].filter((s: string) => s !== stCode);
        }
      });

      // 2. Add to target zone with Set deduplication (pure string array)
      const existing = copy.zones[targetZone] || [];
      copy.zones[targetZone] = Array.from(new Set([...existing, stCode]));
      return copy;
    });

    const targetTitle = ZONE_LABELS[targetZone]?.title || targetZone;
    toast.success(`Moved ${stCode} to "${targetTitle}". Click "Save Zone Changes" to apply!`);
  };

  // Add state code to the active zone
  const handleAddStateCode = (codeToAdd: string) => {
    const code = codeToAdd.trim().toUpperCase();
    if (!code) return;
    if (currentStates.includes(code)) {
      toast.info(`State code ${code} is already in this zone.`);
      return;
    }

    setLocalConfig((prev) => {
      if (!prev) return prev;
      const copy: ShippingConfig = JSON.parse(JSON.stringify(prev));
      if (!copy.zones) copy.zones = {};

      // 1. Remove this state code from any other zones so it only maps to one zone
      Object.keys(copy.zones).forEach((zKey) => {
        if (zKey !== activeZone && Array.isArray(copy.zones[zKey])) {
          copy.zones[zKey] = copy.zones[zKey].filter((s: string) => s !== code);
        }
      });

      // 2. Add to the active zone with strict Set deduplication
      const existing = copy.zones[activeZone] || [];
      copy.zones[activeZone] = Array.from(new Set([...existing, code]));
      return copy;
    });

    toast.success(`Mapped ${code} to ${ZONE_LABELS[activeZone]?.title || activeZone}. Click "Save Zone Changes" to apply.`);
    setSelectedStateToAdd("");
    setCustomStateCode("");
  };

  // Remove state code from active zone
  const handleRemoveStateCode = (codeToRemove: string) => {
    setLocalConfig((prev) => {
      if (!prev) return prev;
      const copy: ShippingConfig = JSON.parse(JSON.stringify(prev));
      if (!copy.zones) copy.zones = {};
      const states = Array.from(new Set(copy.zones[activeZone] || [])).filter((s) => s !== codeToRemove);
      copy.zones[activeZone] = states;
      return copy;
    });
    toast.info(`Removed ${codeToRemove}. Click "Save Zone Changes" to persist.`);
  };

  const handleExtraPriceChange = (val: string) => {
    if (!localConfig) return;
    const num = Number(val) || 0;
    setLocalConfig((prev) => {
      if (!prev) return prev;
      const copy = { ...prev };
      if (!copy.pricing[activeZone]) {
        copy.pricing[activeZone] = { extraPricePerKg: num, slabs: [] };
      } else {
        copy.pricing[activeZone] = { ...copy.pricing[activeZone], extraPricePerKg: num };
      }
      return copy;
    });
  };

  const handleDeliveryTimeChange = (lang: string, val: string) => {
    if (!localConfig) return;
    setLocalConfig((prev) => {
      if (!prev) return prev;
      const copy = { ...prev };
      if (!copy.delivery_time) copy.delivery_time = {};
      if (!copy.delivery_time[activeZone]) copy.delivery_time[activeZone] = {};
      copy.delivery_time[activeZone] = { ...copy.delivery_time[activeZone], [lang]: val };
      return copy;
    });
  };

  const handleSlabPriceChange = (index: number, newPriceVal: string) => {
    if (!localConfig) return;
    const priceNum = Number(newPriceVal) || 0;
    setLocalConfig((prev) => {
      if (!prev) return prev;
      const copy: ShippingConfig = JSON.parse(JSON.stringify(prev));
      const slabs = deduplicateSlabs(copy.pricing[activeZone]?.slabs || []);
      if (slabs[index]) {
        slabs[index] = { ...slabs[index], price: priceNum };
        if (!copy.pricing[activeZone]) copy.pricing[activeZone] = { extraPricePerKg: 100, slabs: [] };
        copy.pricing[activeZone].slabs = slabs;
      }
      return copy;
    });
  };

  const handleDeleteSlab = (index: number) => {
    if (!localConfig) return;
    setLocalConfig((prev) => {
      if (!prev) return prev;
      const copy: ShippingConfig = JSON.parse(JSON.stringify(prev));
      const slabs = deduplicateSlabs(copy.pricing[activeZone]?.slabs || []);
      slabs.splice(index, 1);
      if (!copy.pricing[activeZone]) copy.pricing[activeZone] = { extraPricePerKg: 100, slabs: [] };
      copy.pricing[activeZone].slabs = slabs;
      return copy;
    });
    toast.info("Slab removed. Click Save Zone Changes to apply.");
  };

  const handleAddSlab = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingSlab) return;

    const minNum = Number(newMin);
    const maxNum = Number(newMax);
    const priceNum = Number(newPrice);

    if (isNaN(minNum) || isNaN(maxNum) || isNaN(priceNum) || minNum < 0 || maxNum <= minNum || priceNum < 0) {
      toast.error("Please enter valid weight ranges and price.");
      return;
    }

    if (!localConfig) return;
    setIsSubmittingSlab(true);

    setLocalConfig((prev) => {
      if (!prev) return prev;
      const copy: ShippingConfig = JSON.parse(JSON.stringify(prev));
      if (!copy.pricing) copy.pricing = {};
      if (!copy.pricing[activeZone]) copy.pricing[activeZone] = { extraPricePerKg: 100, slabs: [] };

      const existingSlabs = copy.pricing[activeZone].slabs || [];
      // Replace existing slab if identical [min, max] range exists instead of duplicating!
      const filtered = existingSlabs.filter((s) => !(Number(s.min) === minNum && Number(s.max) === maxNum));
      filtered.push({ min: minNum, max: maxNum, price: priceNum });
      filtered.sort((a, b) => Number(a.min) - Number(b.min));

      copy.pricing[activeZone].slabs = filtered;
      return copy;
    });

    setAddSlabOpen(false);
    setNewMin("");
    setNewMax("");
    setNewPrice("");
    setIsSubmittingSlab(false);
    toast.success(`Weight slab ${minNum}kg–${maxNum}kg (₹${priceNum}) added. Click Save Zone Changes to apply.`);
  };

  const handleSaveAll = async () => {
    if (!localConfig) return;
    try {
      const sanitized: ShippingConfig = JSON.parse(JSON.stringify(localConfig));
      if (sanitized.zones) {
        Object.keys(sanitized.zones).forEach((zKey) => {
          sanitized.zones[zKey] = Array.from(new Set(sanitized.zones[zKey] || []));
        });
      }
      if (sanitized.pricing) {
        Object.keys(sanitized.pricing).forEach((zKey) => {
          if (Array.isArray(sanitized.pricing[zKey]?.slabs)) {
            sanitized.pricing[zKey].slabs = deduplicateSlabs(sanitized.pricing[zKey].slabs);
          }
        });
      }
      await updateConfig.mutateAsync(sanitized);
      setSuccessModalOpen(true);
      toast.success("Shipping configuration updated successfully in Firebase!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update shipping configuration");
    }
  };

  const zonesList = Object.keys(localConfig?.pricing || ZONE_LABELS);

  // Find states not yet in this zone
  const availableStates = ALL_INDIAN_STATES.filter((s) => !currentStates.includes(s.code));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Shipping Fees & Regional Zones"
        description="Configure dynamic delivery charges, mapped state codes, and weight-based shipping slabs stored in /product_marketplace/main/shipping_config/config."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="gap-2 rounded-xl"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={updateConfig.isPending || !localConfig}
              className="gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
            >
              <Save className="h-4 w-4" />
              {updateConfig.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        }
      />

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 rounded-2xl border bg-card/50 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 grid place-items-center shrink-0">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Configured Zones</div>
            <div className="text-xl font-bold text-foreground">{zonesList.length} Regional Zones</div>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border bg-card/50 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
            <Weight className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Active Zone Slabs</div>
            <div className="text-xl font-bold text-foreground">{currentPricing.slabs.length} Weight Tiers</div>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border bg-card/50 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center shrink-0">
            <IndianRupee className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Extra Price per Kg</div>
            <div className="text-xl font-bold text-foreground">₹{currentPricing.extraPricePerKg} / kg</div>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border bg-card/50 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 grid place-items-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Est. Delivery Time</div>
            <div className="text-sm font-bold text-foreground truncate max-w-[170px]">
              {currentDeliveryTime.en || "—"}
            </div>
          </div>
        </Card>
      </div>

      {/* Main Grid: Zone Selector & Zone Details */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Zone Picker Tabs */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Select Shipping Region
          </div>
          <div className="space-y-2">
            {zonesList.map((zKey) => {
              const meta = ZONE_LABELS[zKey] || {
                title: zKey.replace(/_/g, " ").toUpperCase(),
                color: "bg-muted text-foreground border-border",
                desc: "Regional territory",
              };
              const isSelected = activeZone === zKey;
              const slabCount = localConfig?.pricing?.[zKey]?.slabs?.length || 0;
              const extraKg = localConfig?.pricing?.[zKey]?.extraPricePerKg || 0;
              const mappedCount = localConfig?.zones?.[zKey]?.length || 0;

              return (
                <div
                  key={zKey}
                  onClick={() => setActiveZone(zKey)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                    isSelected
                      ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/30"
                      : "bg-card hover:bg-muted/30 border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm text-foreground flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${isSelected ? "bg-primary" : "bg-muted-foreground/40"}`} />
                      {meta.title}
                    </div>
                    <Badge variant="outline" className={`text-[10px] font-semibold border ${meta.color}`}>
                      {zKey}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{meta.desc}</p>
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                    <span>{mappedCount} States &bull; {slabCount} Slabs</span>
                    <span className="font-mono font-semibold text-foreground">₹{extraKg}/kg extra</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Zone Pricing Slabs, State Codes & Timelines */}
        <div className="lg:col-span-8 space-y-5">
          {/* Zone Header Banner & MAPPED STATE CODES EDITOR */}
          <Card className="p-5 rounded-2xl border bg-card shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {ZONE_LABELS[activeZone]?.title || activeZone}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Firestore Key: <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">zones.{activeZone}</code>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddSlabOpen(true)}
                  className="rounded-xl text-xs gap-1.5 font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Weight Slab
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveAll}
                  disabled={updateConfig.isPending || !localConfig}
                  className="rounded-xl text-xs gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs px-3.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {updateConfig.isPending ? "Saving..." : "Save Zone Changes"}
                </Button>
              </div>
            </div>

            {/* MAPPED STATE CODES SECTION - EDITABLE! */}
            <div className="space-y-2.5 pt-3 border-t border-border/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  Mapped State Codes in this Zone ({currentStates.length} States):
                </Label>
                <span className="text-[11px] text-muted-foreground">Click ⇄ to transfer zone &bull; Click &times; to remove</span>
              </div>

              {/* State Badges with Transfer and Remove (x) */}
              <div className="flex flex-wrap gap-2 p-3 rounded-2xl border bg-muted/20 min-h-[50px] items-center">
                {currentStates.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">No states currently assigned to this zone.</span>
                ) : (
                  currentStates.map((st) => {
                    const match = ALL_INDIAN_STATES.find((s) => s.code === st);
                    return (
                      <span
                        key={st}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-xl bg-background border border-border shadow-xs text-xs font-mono font-bold text-foreground group"
                      >
                        <span>{st}</span>
                        {match && <span className="font-sans font-normal text-[11px] text-muted-foreground">({match.name})</span>}
                        
                        {/* 1-Click Zone Switcher Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="h-4 w-4 rounded-md hover:bg-blue-500/20 text-muted-foreground hover:text-blue-600 grid place-items-center transition-colors"
                              title={`Click to transfer ${st} to another Zone`}
                            >
                              <ArrowRightLeft className="h-2.5 w-2.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="rounded-xl text-xs w-60 z-50">
                            <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                              Move {st} to Zone:
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {Object.entries(ZONE_LABELS).map(([zKey, zMeta]) => (
                              <DropdownMenuItem
                                key={zKey}
                                disabled={zKey === activeZone}
                                onClick={() => handleMoveState(st, zKey)}
                                className="text-xs flex items-center justify-between cursor-pointer py-1.5"
                              >
                                <span className="font-semibold">{zMeta.title}</span>
                                {zKey === activeZone ? (
                                  <span className="text-[10px] text-muted-foreground font-mono">(Current)</span>
                                ) : (
                                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Move here &rarr;</span>
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <button
                          type="button"
                          onClick={() => handleRemoveStateCode(st)}
                          className="h-4 w-4 rounded-full hover:bg-rose-500/20 text-muted-foreground hover:text-rose-600 grid place-items-center transition-colors ml-0.5"
                          title={`Remove ${st}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })
                )}
              </div>

              {/* Add State to Zone Controls */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {/* Predefined State Dropdown with Current Zone Label */}
                <div className="flex-1 min-w-[200px]">
                  <Select value={selectedStateToAdd} onValueChange={(val) => {
                    setSelectedStateToAdd(val);
                    if (val) handleAddStateCode(val);
                  }}>
                    <SelectTrigger className="rounded-xl text-xs h-9">
                      <SelectValue placeholder="+ Select State to Add or Move to this Zone..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl max-h-56">
                      {availableStates.map((st) => {
                        const inZone = findZoneForState(st.code);
                        return (
                          <SelectItem key={st.code} value={st.code} className="text-xs font-mono">
                            <div className="flex items-center justify-between w-full gap-2">
                              <span>{st.code} — {st.name}</span>
                              {inZone && (
                                <span className="text-[10px] text-muted-foreground font-sans italic">
                                  ({ZONE_LABELS[inZone]?.title || inZone})
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Code Input */}
                <div className="flex items-center gap-1.5">
                  <Input
                    placeholder="Custom Code (e.g. DL)"
                    value={customStateCode}
                    onChange={(e) => setCustomStateCode(e.target.value.toUpperCase())}
                    className="w-36 h-9 rounded-xl font-mono text-xs uppercase"
                    maxLength={4}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddStateCode(customStateCode)}
                    disabled={!customStateCode.trim()}
                    className="rounded-xl h-9 text-xs gap-1 font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              </div>

              {/* Quick Save Zone Action Bar */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="text-muted-foreground text-[11px]">
                    After moving or adding states, click <strong className="text-foreground">Save Zone Changes</strong> to write directly to Firestore.
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveAll}
                  disabled={updateConfig.isPending || !localConfig}
                  className="h-7 text-xs px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shrink-0"
                >
                  <Save className="h-3 w-3" />
                  {updateConfig.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>

            {/* Extra per kg rate & Delivery Timeline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border/50">
              <div className="space-y-1.5">
                <Label htmlFor="extraKg" className="text-xs font-semibold flex items-center gap-1.5">
                  Extra Price per Additional Kg (₹)
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Label>
                <div className="relative">
                  <IndianRupee className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="extraKg"
                    type="number"
                    min="0"
                    value={currentPricing.extraPricePerKg}
                    onChange={(e) => handleExtraPriceChange(e.target.value)}
                    className="pl-9 rounded-xl font-mono text-sm font-semibold"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Charged for every 1 kg exceeding max slab limit.</p>
              </div>

              {/* Delivery timeline input */}
              <div className="space-y-1.5">
                <Label htmlFor="delTimeEn" className="text-xs font-semibold flex items-center gap-1.5">
                  Estimated Delivery Time (English)
                </Label>
                <div className="relative">
                  <Clock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="delTimeEn"
                    value={currentDeliveryTime.en || ""}
                    onChange={(e) => handleDeliveryTimeChange("en", e.target.value)}
                    placeholder="e.g. Delivery in 2–4 days"
                    className="pl-9 rounded-xl text-sm"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Displayed to customers on product & checkout pages.</p>
              </div>
            </div>
          </Card>

          {/* Slabs Table */}
          <Card className="rounded-2xl border overflow-hidden shadow-sm">
            <div className="p-4 bg-muted/20 border-b flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-foreground">Weight-Based Price Slabs</h4>
                <p className="text-xs text-muted-foreground">Flat shipping cost calculated by order parcel gross weight</p>
              </div>
              <Badge variant="outline" className="text-xs font-semibold">
                {currentPricing.slabs.length} Tiers Defined
              </Badge>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-muted/10 text-xs">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Min Weight (kg)</TableHead>
                  <TableHead>Max Weight (kg)</TableHead>
                  <TableHead>Weight Range</TableHead>
                  <TableHead>Shipping Fee (₹)</TableHead>
                  <TableHead className="w-20 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentPricing.slabs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-xs text-muted-foreground">
                      No weight slabs defined for this zone. Click "Add Weight Slab" to configure.
                    </TableCell>
                  </TableRow>
                ) : (
                  currentPricing.slabs.map((slab, i) => (
                    <TableRow key={i} className="text-xs hover:bg-muted/10">
                      <TableCell className="text-center font-mono font-medium text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-mono font-semibold">{slab.min} kg</TableCell>
                      <TableCell className="font-mono font-semibold">{slab.max} kg</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[11px] font-mono">
                          {slab.min} kg — {slab.max} kg
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="relative max-w-[140px]">
                          <IndianRupee className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="number"
                            min="0"
                            value={slab.price}
                            onChange={(e) => handleSlabPriceChange(i, e.target.value)}
                            className="h-8 pl-7 font-mono font-bold text-xs rounded-lg text-emerald-600 dark:text-emerald-400"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSlab(i)}
                          className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                          title="Delete slab"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="p-3 bg-muted/10 border-t flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Edits to states and slabs apply in this session. Click <strong>Save Configuration</strong> above to write to Firebase.
              </span>
            </div>
          </Card>
        </div>
      </div>

      {/* Add Slab Dialog Modal */}
      <Dialog open={addSlabOpen} onOpenChange={setAddSlabOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                <Plus className="h-4 w-4" />
              </div>
              Add Shipping Weight Slab
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define a new weight range tier and its fixed delivery rate for <strong>{ZONE_LABELS[activeZone]?.title}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSlab} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="slabMin" className="text-xs font-semibold">Min Weight (kg) *</Label>
                <Input
                  id="slabMin"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 0.5"
                  value={newMin}
                  onChange={(e) => setNewMin(e.target.value)}
                  required
                  className="rounded-xl font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slabMax" className="text-xs font-semibold">Max Weight (kg) *</Label>
                <Input
                  id="slabMax"
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="e.g. 1.0"
                  value={newMax}
                  onChange={(e) => setNewMax(e.target.value)}
                  required
                  className="rounded-xl font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slabPrice" className="text-xs font-semibold">Shipping Price (₹) *</Label>
              <div className="relative">
                <IndianRupee className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="slabPrice"
                  type="number"
                  min="0"
                  placeholder="e.g. 120"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  required
                  className="pl-9 rounded-xl font-mono font-semibold text-xs text-emerald-600"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAddSlabOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingSlab} className="rounded-xl bg-primary text-primary-foreground font-semibold">
                {isSubmittingSlab ? "Adding..." : "Add Slab Tier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sticky Bottom Save Action Bar */}
      <div className="sticky bottom-4 z-30 flex items-center justify-between gap-4 p-4 rounded-2xl bg-card/95 backdrop-blur-md border border-border/80 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
            <Save className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Save Shipping Configuration to Firebase</div>
            <div className="text-[11px] text-muted-foreground">
              Writes updated zone state mappings, weight slabs, and delivery times to <code className="font-mono text-[10px] bg-muted px-1 rounded">product_marketplace/main/shipping_config/config</code>
            </div>
          </div>
        </div>
        <Button
          onClick={handleSaveAll}
          disabled={updateConfig.isPending || !localConfig}
          className="rounded-xl px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm shrink-0"
        >
          <Save className="h-4 w-4" />
          {updateConfig.isPending ? "Saving..." : "Save Configuration"}
        </Button>
      </div>

      {/* Success Confirmation Modal Popup */}
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-2">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            Updated Successfully!
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            Shipping fees, mapped state codes, and weight slabs have been updated successfully in Firebase at:
            <code className="block mt-2 font-mono text-[11px] bg-muted/60 p-2 rounded-xl text-foreground">
              /product_marketplace/main/shipping_config/config
            </code>
          </DialogDescription>
          <DialogFooter className="mt-4 sm:justify-center">
            <Button
              onClick={() => setSuccessModalOpen(false)}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6"
            >
              Done & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}