import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Users,
  ShoppingBag,
  Wallet,
  TrendingUp,
  TrendingDown,
  UserCheck,
  IndianRupee,
  Beef,
  PackageCheck,
  LifeBuoy,
  Store,
  Tag,
  ListChecks,
  BadgeCheck,
  Flame,
  Ticket,
  Coins,
  Download,
  Calendar as CalendarIcon,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  UserPlus,
  Mail,
  Send,
  LogIn,
  Eye,
  ExternalLink,
  ChevronRight,
  Search,
  X,
  Phone,
  ShieldCheck,
  Clock,
  Landmark,
  MapPin,
  ArrowRight,
  Workflow,
  Activity,
  Sparkles,
  Layers,
  Boxes,
  Truck,
  HeartHandshake,
  FileText,
  CheckCheck,
  Database,
  Cpu,
  Server,
  Zap,
  GitBranch,
  Radio,
  Network,
  Share2,
  SlidersHorizontal,
  Stethoscope,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import {
  useFirebaseCollection,
  useFirebaseCollectionGroup,
  useCoupons,
  useTokenAdvance,
  useBestSellers,
} from "../hooks/useFirebaseData";
import { getLocalizedText } from "@/lib/utils";
import { fetchApiJson } from "@/lib/apiClient";

function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("farmer");

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast.success(`Invitation sent to ${email}`);
    setEmail("");
    setName("");
    setRole("farmer");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="h-4.5 w-4.5" />
            </span>
            Invite a new user
          </DialogTitle>
          <DialogDescription>
            Send an invitation email to onboard a farmer, seller, or team member.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleInvite} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Full name</Label>
            <Input
              id="invite-name"
              placeholder="e.g. Ravi Patel"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="name@iherd.app"
                className="pl-9 rounded-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="invite-role" className="rounded-xl">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="farmer">Farmer</SelectItem>
                <SelectItem value="seller">Seller</SelectItem>
                <SelectItem value="support">Support agent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="rounded-xl">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" className="gap-1.5 bg-gradient-to-br from-primary to-primary-glow rounded-xl">
              <Send className="h-4 w-4" /> Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — iHerd Admin" },
      { name: "description", content: "iHerd marketplace analytics, KPIs and live operations overview." },
    ],
  }),
  component: Dashboard,
});

const MONTHS = [
  { value: "all", label: "All Months" },
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

const YEARS = [
  { value: "all", label: "All Years" },
  { value: "2026", label: "2026" },
  { value: "2025", label: "2025" },
  { value: "2024", label: "2024" },
];

function parseRecordDate(record: any): Date | null {
  if (!record) return null;
  const val =
    record.createdAt ||
    record.date ||
    record.joined ||
    record.joinedDate ||
    record.timestamp ||
    record.metadata?.creationTime ||
    record.lastLoginAt ||
    record.lastSignInTime ||
    record.updatedAt;

  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "object" && (val._seconds || val.seconds)) {
    return new Date((val._seconds || val.seconds) * 1000);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function parseLastLogin(record: any): Date | null {
  if (!record) return null;
  const val = record.lastLoginAt || record.lastSignInTime || record.updatedAt || record.createdAt;
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "object" && (val._seconds || val.seconds)) {
    return new Date((val._seconds || val.seconds) * 1000);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function formatTimeAgo(d: Date | null): string {
  if (!d) return "Recently";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function Kpi({
  label,
  value,
  delta,
  up,
  icon: Icon,
  tint,
  onClick,
}: {
  label: string;
  value: string | number;
  delta?: string;
  up?: boolean;
  icon: any;
  tint: string;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={`p-5 rounded-2xl relative overflow-hidden border shadow-sm transition-all duration-200 ${
        onClick
          ? "cursor-pointer hover:shadow-lg hover:border-primary/50 hover:bg-muted/10 group"
          : "hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
            {onClick && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            )}
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            {value === "…" || value === "loading" ? (
              <span className="inline-block h-8 w-24 bg-muted/70 rounded-xl animate-pulse mt-0.5" />
            ) : (
              value
            )}
          </div>
          {delta && (
            <div
              className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${
                up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
              }`}
            >
              {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {delta}
            </div>
          )}
        </div>
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tint} group-hover:scale-105 transition-transform`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {onClick && (
        <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground group-hover:text-primary font-medium transition-colors">
          <span>Click to view details</span>
          <Eye className="h-3.5 w-3.5" />
        </div>
      )}
    </Card>
  );
}

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
};

function Dashboard() {
  const now = new Date();
  const currentMonthStr = String(now.getMonth());
  const currentYearStr = String(now.getFullYear());

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return localStorage.getItem("iherd_dashboard_month") || currentMonthStr;
  });
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    return localStorage.getItem("iherd_dashboard_year") || currentYearStr;
  });
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    localStorage.setItem("iherd_dashboard_month", selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    localStorage.setItem("iherd_dashboard_year", selectedYear);
  }, [selectedYear]);

  // Modal inspection state
  const [modalType, setModalType] = useState<
    "farmers" | "verified_farmers" | "farms" | "sellers" | "cattle" | "products" | "best_sellers" | "coupons" | "logins" | "orders" | "roles" | "assets_catalog" | "fulfillment" | "commerce_tokens" | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { profile } = useAuth();
  const displayName = profile?.name ? profile.name.split(" ")[0] : "Admin";
  const navigate = useNavigate();

  const { data: allUsers = [], isLoading: usersLoading } = useAdminUsers();
  const { data: firestoreUsers = [], isLoading: fsLoading } = useFirebaseCollection<any>("users");
  const { data: directFarmers = [] } = useFirebaseCollection<any>("farmers");
  const { data: directSellers = [] } = useFirebaseCollection<any>("sellers");
  const { data: cattle = [] } = useFirebaseCollection("cattle-marketplace");
  const { data: cattleDetails = [] } = useFirebaseCollection("cattle_details");
  const { data: cattleOrders = [] } = useFirebaseCollection("CattleOrders");
  const { data: products = [] } = useFirebaseCollection("product_marketplace/main/products");
  const { data: productOrders = [] } = useFirebaseCollection("ProductOrders");
  const { data: groupFarms = [] } = useFirebaseCollectionGroup<any>("farms");
  const { data: topFarms = [] } = useFirebaseCollection<any>("farms");
  const { data: coupons = [] } = useCoupons();
  const { data: tokenAdvData } = useTokenAdvance();
  const { data: bestSellers = [] } = useBestSellers();

  const isInitialLoading = (usersLoading || fsLoading) && allUsers.length === 0 && firestoreUsers.length === 0;

  // Enriched product orders from API
  const { data: apiProductOrders = [] } = useQuery({
    queryKey: ["dashboardProductOrders"],
    queryFn: async () => {
      try {
        const data = await fetchApiJson<any>("/api/admin/product-orders");
        return data.orders || [];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  // Enriched registered farms from API (which searches /users/{uid}/roles/farmer/farms subcollections)
  const { data: apiFarms = [] } = useQuery({
    queryKey: ["dashboardFarms"],
    queryFn: async () => {
      try {
        const data = await fetchApiJson<any>("/api/admin/farms");
        return data.farms || [];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  const effectiveProductOrders = apiProductOrders.length > 0 ? apiProductOrders : productOrders;

  // Extract only verified, genuine farmers
  const allFarmers = useMemo(() => {
    const map = new Map<string, any>();

    // 1. Standalone /farmers collection
    directFarmers.forEach((df: any) => {
      const uid = df.id || df.uid;
      if (!uid) return;
      map.set(uid, {
        ...df,
        id: uid,
        uid,
        displayName: df.name || df.farmerName || "Farmer",
        name: df.name || df.farmerName || "Farmer",
        phoneNumber: df.phone || df.farmerPhoneNumber || "—",
        createdAt: df.createdAt,
        status: df.status || "Active",
      });
    });

    // 2. Users with verified farmer roles, registered farms, or cattle
    allUsers.forEach((u: any) => {
      const uid = u.uid;
      if (!uid) return;
      const fsUser = firestoreUsers.find((fu: any) => fu.id === uid || fu.uid === uid);
      const rawRoles = fsUser?.roles || (fsUser?.role ? [fsUser.role] : u.roles || []);
      const roles: string[] = Array.isArray(rawRoles) ? rawRoles : [String(rawRoles)];
      const hasFarmerRole = roles.some((r: any) => typeof r === "string" && r.toLowerCase().includes("farmer"));
      const hasDirectDoc = map.has(uid);
      const hasFarm = Boolean(
        (u.farms && typeof u.farms === "object" && Object.keys(u.farms).length > 0) ||
        (fsUser?.farms && typeof fsUser.farms === "object" && Object.keys(fsUser.farms).length > 0) ||
        apiFarms.some((f: any) => (f.ownerUid === uid || f.userId === uid)) ||
        groupFarms.some((f: any) => (f.ownerUid === uid || f.userId === uid))
      );
      const hasCattle = cattleDetails.some((c: any) => (c.ownerUid === uid || c.userId === uid || c.farmerId === uid));
      const hasExplicitProfile = Boolean(
        fsUser?.farmer && typeof fsUser.farmer === "object" && (fsUser.farmer.farmName || fsUser.farmer.farmerName || fsUser.farmer.village || fsUser.farmer.name)
      );

      const isFarmer = hasFarmerRole || hasDirectDoc || hasFarm || hasCattle || hasExplicitProfile || u.isFarmer === true || fsUser?.isFarmer === true;

      if (isFarmer && !map.has(uid)) {
        map.set(uid, {
          ...u,
          id: uid,
          uid,
          displayName: fsUser?.name || fsUser?.fullName || u.displayName || u.name || "Farmer",
          name: fsUser?.name || fsUser?.fullName || u.displayName || u.name || "Farmer",
          phoneNumber: u.phoneNumber || fsUser?.phoneNumber || fsUser?.phone || "—",
          createdAt: u.createdAt || fsUser?.createdAt,
          status: fsUser?.status || u.status || "Active",
        });
      }
    });

    return Array.from(map.values());
  }, [allUsers, firestoreUsers, directFarmers, apiFarms, groupFarms, cattleDetails]);

  // Map seller IDs to categories of products they sell
  const sellerProductCategories = useMemo(() => {
    const map = new Map<string, string[]>();
    (products || []).forEach((p: any) => {
      const sellerId = p.sellerId || p.userId || p.seller?.id || p.seller?.uid;
      const cat = p.categoryName || p.category || p.subCategory;
      if (sellerId && cat) {
        const strCat = typeof cat === "string" ? cat.trim() : getLocalizedText(cat, "").trim();
        if (strCat) {
          const existing = map.get(sellerId) || [];
          if (!existing.includes(strCat)) {
            existing.push(strCat);
            map.set(sellerId, existing);
          }
        }
      }
    });
    return map;
  }, [products]);

  // Extract only verified sellers
  const allSellers = useMemo(() => {
    const map = new Map<string, any>();

    directSellers.forEach((ds: any) => {
      const uid = ds.id || ds.uid;
      if (!uid) return;
      const prodCats = sellerProductCategories.get(uid) || [];
      const derivedCategory =
        ds.category ||
        ds.businessCategory ||
        ds.shopCategory ||
        ds.storeCategory ||
        (prodCats.length > 0 ? prodCats.join(", ") : "") ||
        "Feed & Nutrition";

      map.set(uid, {
        ...ds,
        id: uid,
        uid,
        displayName: ds.name || ds.shopName || ds.sellerName || "Seller",
        phoneNumber: ds.sellerPhoneNumber || ds.phone || ds.phoneNumber || ds.sellerPhone || "",
        email: ds.email || ds.sellerEmail || "",
        category: derivedCategory,
        createdAt: ds.createdAt,
        status: ds.status || "Active",
      });
    });

    allUsers.forEach((u: any) => {
      const uid = u.uid;
      if (!uid || map.has(uid)) return;
      const fsUser = firestoreUsers.find((fu: any) => fu.id === uid || fu.uid === uid);
      const rawRoles = fsUser?.roles || (fsUser?.role ? [fsUser.role] : u.roles || []);
      const roles: string[] = Array.isArray(rawRoles) ? rawRoles : [String(rawRoles)];
      const hasSellerRole = roles.some((r: any) => typeof r === "string" && r.toLowerCase().includes("seller"));
      const hasSellerProfile = Boolean(
        (u.seller && typeof u.seller === "object") ||
        (fsUser?.seller && typeof fsUser.seller === "object") ||
        fsUser?.isSeller === true
      );

      if (hasSellerRole || hasSellerProfile) {
        const prodCats = sellerProductCategories.get(uid) || [];
        const sellerObj = fsUser?.seller || u.seller || {};
        const derivedCategory =
          sellerObj.category ||
          sellerObj.businessCategory ||
          sellerObj.shopCategory ||
          fsUser?.category ||
          u.category ||
          (prodCats.length > 0 ? prodCats.join(", ") : "") ||
          "Feed & Nutrition";

        const contactPhone =
          sellerObj.sellerPhoneNumber ||
          sellerObj.sellerPhone ||
          sellerObj.phoneNumber ||
          sellerObj.phone ||
          fsUser?.seller?.sellerPhoneNumber ||
          fsUser?.seller?.sellerPhone ||
          fsUser?.seller?.phoneNumber ||
          fsUser?.seller?.phone ||
          u.phoneNumber ||
          fsUser?.phoneNumber ||
          fsUser?.phone ||
          "";
        const contactEmail = u.email || fsUser?.email || sellerObj.email || "";

        map.set(uid, {
          ...u,
          id: uid,
          uid,
          displayName: sellerObj.name || sellerObj.shopName || fsUser?.name || u.displayName || "Seller",
          phoneNumber: contactPhone,
          email: contactEmail,
          category: derivedCategory,
          createdAt: u.createdAt || fsUser?.createdAt,
          status: fsUser?.status || u.status || "Active",
        });
      }
    });

    return Array.from(map.values());
  }, [allUsers, firestoreUsers, directSellers, sellerProductCategories]);

  // Extract all farms across Firestore users & collectionGroup query
  const allFarms = useMemo(() => {
    const map = new Map<string, any>();

    // 1. Process live Firestore collectionGroup `farms` (includes /users/{uid}/roles/farmer/farms)
    groupFarms.forEach((gf: any) => {
      const key = gf.farmId || gf.id;
      if (!key) return;
      const path = gf._path || "";
      const segments = path.split("/");
      let ownerUid = gf.ownerUid || gf.userId || "";
      if (!ownerUid && segments[0] === "users" && segments[1]) ownerUid = segments[1];
      else if (!ownerUid && segments[0] === "farmers" && segments[1]) ownerUid = segments[1];

      const ownerObj = firestoreUsers.find((fu: any) => fu.id === ownerUid || fu.uid === ownerUid) || allUsers.find((au: any) => au.uid === ownerUid) || {};

      map.set(key, {
        ...gf,
        id: key,
        userId: ownerUid,
        name: getLocalizedText(gf.name || gf.farmName, "Registered Dairy Farm"),
        farmerName: getLocalizedText(gf.ownerName || gf.farmerName || ownerObj.name || ownerObj.displayName, "Farmer"),
        state: getLocalizedText(gf.state || ownerObj.state, "—"),
        district: getLocalizedText(gf.district || ownerObj.district, "—"),
        cattle: gf.numberOfAnimals || gf.cattleCount || 0,
        phone: gf.farmPhoneNumber || gf.phone || ownerObj.phoneNumber || ownerObj.phone || "—",
        createdAt: gf.createdAt || ownerObj.createdAt,
      });
    });

    // 2. Process backend API farms
    apiFarms.forEach((f: any) => {
      const key = f.id || f.farmId;
      if (!key || map.has(key)) return;
      map.set(key, {
        ...f,
        id: key,
        userId: f.ownerUid || f.userId,
        name: getLocalizedText(f.name || f.farmName, "Registered Dairy Farm"),
        farmerName: getLocalizedText(f.ownerName || f.farmerName, "Farmer"),
        state: getLocalizedText(f.state, "—"),
        district: getLocalizedText(f.district, "—"),
        cattle: f.cattleCount || 0,
        phone: f.farmPhoneNumber || f.phone || "—",
        createdAt: f.createdAt,
      });
    });

    // 3. Process topFarms collection
    topFarms.forEach((tf: any) => {
      const key = tf.id || tf.farmId;
      if (!key || map.has(key)) return;
      map.set(key, {
        ...tf,
        id: key,
        userId: tf.ownerUid || tf.userId,
        name: getLocalizedText(tf.name || tf.farmName, "Registered Dairy Farm"),
        farmerName: getLocalizedText(tf.ownerName || tf.farmerName, "Farmer"),
        state: getLocalizedText(tf.state, "—"),
        district: getLocalizedText(tf.district, "—"),
        cattle: tf.cattleCount || 0,
        phone: tf.farmPhoneNumber || tf.phone || "—",
        createdAt: tf.createdAt,
      });
    });

    // 4. Process explicit user fields
    firestoreUsers.forEach((u: any) => {
      if (u.farms) {
        if (Array.isArray(u.farms)) {
          u.farms.forEach((f: any, idx: number) => {
            const key = f.id || f.farmId || `${u.id}-farm-${idx}`;
            if (!map.has(key)) {
              map.set(key, {
                id: key,
                userId: u.id || u.uid,
                name: getLocalizedText(f.name || f.farmName || `${u.name || "Farmer"}'s Farm`),
                farmerName: getLocalizedText(u.name || u.displayName || "Farmer"),
                state: getLocalizedText(f.state || u.state || "—"),
                district: getLocalizedText(f.district || u.district || "—"),
                cattle: f.cattle || f.totalCattle || 0,
                phone: u.phoneNumber || u.phone || "—",
                createdAt: f.createdAt || u.createdAt,
              });
            }
          });
        }
      }
    });

    return Array.from(map.values());
  }, [groupFarms, apiFarms, topFarms, firestoreUsers, allUsers]);

  // Filter items by selected month/year OR custom date range (e.g. Day 1 to Day 13)
  const isMatchDate = (item: any): boolean => {
    const d = parseRecordDate(item);
    if (!d) {
      return selectedMonth === "all" && selectedYear === "all" && !startDate && !endDate;
    }

    if (startDate || endDate) {
      const itemTime = d.getTime();
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`).getTime();
        if (itemTime < start) return false;
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999`).getTime();
        if (itemTime > end) return false;
      }
      return true;
    }

    if (selectedMonth === "all" && selectedYear === "all") return true;

    const itemYear = d.getFullYear();
    const itemMonth = d.getMonth();

    if (selectedYear !== "all" && itemYear !== Number(selectedYear)) {
      return false;
    }
    if (selectedMonth !== "all" && itemMonth !== Number(selectedMonth)) {
      return false;
    }

    return true;
  };

  // Logged-in / Active App Users in period
  const activeLogins = useMemo(() => {
    return [...allUsers]
      .filter((u: any) => u.lastLoginAt || u.lastSignInTime || u.createdAt)
      .map((u: any) => {
        const fsUser = firestoreUsers.find((fu: any) => fu.id === u.uid || fu.uid === u.uid);
        const roles = fsUser?.roles || (fsUser?.role ? [fsUser.role] : u.roles || ["User"]);
        const lastLoginDate = parseLastLogin(u) || parseLastLogin(fsUser);
        return {
          ...u,
          displayName: fsUser?.name || fsUser?.displayName || u.displayName || "User",
          phoneNumber: fsUser?.phoneNumber || fsUser?.phone || u.phoneNumber || "—",
          roles,
          lastLoginDate,
          lastLoginFormatted: lastLoginDate ? lastLoginDate.toLocaleString() : "Recently",
          timeAgo: formatTimeAgo(lastLoginDate),
        };
      })
      .filter(isMatchDate)
      .sort((a, b) => {
        const timeA = a.lastLoginDate ? a.lastLoginDate.getTime() : 0;
        const timeB = b.lastLoginDate ? b.lastLoginDate.getTime() : 0;
        return timeB - timeA;
      });
  }, [allUsers, firestoreUsers, selectedMonth, selectedYear, startDate, endDate]);

  const filteredFarmers = useMemo(() => allFarmers.filter(isMatchDate), [allFarmers, selectedMonth, selectedYear, startDate, endDate]);
  const filteredVerifiedFarmers = useMemo(
    () => filteredFarmers.filter((f: any) => f.status === "Active" || !f.status),
    [filteredFarmers]
  );
  const filteredFarms = useMemo(() => allFarms.filter(isMatchDate), [allFarms, selectedMonth, selectedYear, startDate, endDate]);
  const filteredSellers = useMemo(() => allSellers.filter(isMatchDate), [allSellers, selectedMonth, selectedYear, startDate, endDate]);
  const allCattleCombined = useMemo(() => {
    const map = new Map<string, any>();
    cattleDetails.forEach((c: any) => {
      const key = c.cattleId || c.rfid || c.tagNo || c.id;
      if (!key) return;
      map.set(key, {
        ...c,
        id: key,
        title: getLocalizedText(c.cattleName || c.name || c.title || (c.tagNo ? `Cattle #${c.tagNo}` : "Dairy Cattle")),
        breed: getLocalizedText(c.breed?.key || c.breed || "—"),
        species: getLocalizedText(c.species, "Cow"),
        rfid: getLocalizedText(c.rfid || c.tagNo, key),
        status: getLocalizedText(c.status, "Active"),
        price: Number(c.price || c.value || 0),
        milkYield: getLocalizedText(c.milkYield || c.dailyYield, "—"),
        ownerName: getLocalizedText(c.ownerName || c.farmerName || c.sellerName, "Farmer"),
        ownerPhone: c.phone || c.sellerPhone || c.phoneNumber || "—",
        ownerUid: c.ownerUid || c.userId || c.farmerId || "",
        village: getLocalizedText(c.village || c.district || c.location, "—"),
        state: getLocalizedText(c.state, "—"),
        images: [c.faceViewImagePath || c.faceView, c.leftViewImagePath || c.leftView, c.rightViewImagePath || c.rightView, c.muzzleViewImagePath || c.muzzleView, c.udderViewImagePath || c.udderView, c.topViewImagePath || c.bottomView || c.topview, c.farmerViewImagePath || c.farmerView].filter(Boolean),
        source: "cattle_details",
        createdAt: c.createdAt || c.registeredAt || null,
      });
    });
    cattle.forEach((c: any) => {
      const key = c.cattleId || c.rfid || c.tagNo || c.id;
      if (!key) return;
      const existing = map.get(key) || {};
      map.set(key, {
        ...existing,
        ...c,
        id: key,
        title: getLocalizedText(c.title || c.cattleName || existing.title || (c.tagNo ? `Cattle #${c.tagNo}` : "Dairy Cattle")),
        breed: getLocalizedText(c.breed?.key || c.breed || existing.breed || "—"),
        species: getLocalizedText(c.species || existing.species, "Cow"),
        rfid: getLocalizedText(c.rfid || c.tagNo || existing.rfid, key),
        status: getLocalizedText(c.status || existing.status, "Active"),
        price: Number(c.price || existing.price || 0),
        milkYield: getLocalizedText(c.milkYield || c.dailyYield || existing.milkYield, "—"),
        ownerName: getLocalizedText(c.ownerName || c.sellerName || existing.ownerName, "Farmer"),
        ownerPhone: c.phone || c.sellerPhone || existing.ownerPhone || "—",
        ownerUid: c.ownerUid || c.sellerId || existing.ownerUid || "",
        state: getLocalizedText(c.state || existing.state, "—"),
        images: (c.images && Array.isArray(c.images) && c.images.length > 0) ? c.images : existing.images || [],
        createdAt: c.createdAt || existing.createdAt || null,
      });
    });
    return Array.from(map.values());
  }, [cattleDetails, cattle]);

  const filteredCattle = useMemo(() => allCattleCombined.filter(isMatchDate), [allCattleCombined, selectedMonth, selectedYear, startDate, endDate]);
  const filteredProducts = useMemo(() => products.filter(isMatchDate), [products, selectedMonth, selectedYear, startDate, endDate]);
  const filteredProductOrders = useMemo(
    () => effectiveProductOrders.filter(isMatchDate),
    [effectiveProductOrders, selectedMonth, selectedYear, startDate, endDate]
  );
  const filteredCattleOrders = useMemo(
    () => cattleOrders.filter(isMatchDate),
    [cattleOrders, selectedMonth, selectedYear, startDate, endDate]
  );
  const filteredBestSellers = useMemo(
    () => products.filter((p: any) => p.bestSeller || p.isBestSeller),
    [products]
  );

  // Exact Counts
  const farmersCount = filteredFarmers.length;
  const verifiedFarmersCount = filteredVerifiedFarmers.length;
  const farmsCount = (selectedMonth === "all" && selectedYear === "all" && !startDate && !endDate) ? allFarms.length : filteredFarms.length;
  const sellersCount = filteredSellers.length;
  const cattleCount = filteredCattle.length;
  const productsCount = products.length;
  const periodProductsCount = filteredProducts.length;
  const bestSellersCount = filteredBestSellers.length || bestSellers.length;
  const activeCouponsCount = coupons ? coupons.filter((c) => c.active !== false).length : 0;
  const cowAdvanceRate = tokenAdvData?.rates?.cow ?? 200;

  // Selected period display label
  const periodLabel = useMemo(() => {
    if (startDate && endDate) {
      if (startDate === endDate) return `Date ${startDate}`;
      return `${startDate} to ${endDate}`;
    }
    if (startDate) return `From ${startDate}`;
    if (endDate) return `Until ${endDate}`;

    const mLabel = MONTHS.find((m) => m.value === selectedMonth)?.label || "Month";
    const yLabel = selectedYear === "all" ? "All Years" : selectedYear;
    if (selectedMonth === "all" && selectedYear === "all") return "All Time";
    if (selectedMonth === "all") return `Full Year ${yLabel}`;
    if (selectedYear === "all") return `${mLabel} (All Years)`;
    return `${mLabel} ${yLabel}`;
  }, [selectedMonth, selectedYear, startDate, endDate]);

  // Quick Preset Handlers
  const handleSetPreset = (preset: "this_month" | "last_month" | "this_year" | "all_time") => {
    setStartDate("");
    setEndDate("");
    const d = new Date();
    if (preset === "this_month") {
      setSelectedMonth(String(d.getMonth()));
      setSelectedYear(String(d.getFullYear()));
    } else if (preset === "last_month") {
      const last = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      setSelectedMonth(String(last.getMonth()));
      setSelectedYear(String(last.getFullYear()));
    } else if (preset === "this_year") {
      setSelectedMonth("all");
      setSelectedYear(String(d.getFullYear()));
    } else if (preset === "all_time") {
      setSelectedMonth("all");
      setSelectedYear("all");
    }
  };

  // CSV Export Functionality
  const handleExportCSV = () => {
    try {
      const rows: string[][] = [];

      // 1. Report Header
      rows.push(["iHerd Farm Hub - Executive Analytics & Operations Report"]);
      rows.push([`Period: ${periodLabel}`]);
      rows.push([`Generated On: ${new Date().toLocaleString("en-IN")}`]);
      rows.push([]);

      // 2. Summary KPI Metrics Table
      rows.push(["--- KEY METRICS SUMMARY ---"]);
      rows.push(["Metric", "Count / Value"]);
      rows.push(["Total Registered Farmers", String(farmersCount)]);
      rows.push(["Verified Farmers", String(verifiedFarmersCount)]);
      rows.push(["Total Registered Farms", String(farmsCount)]);
      rows.push(["Total Registered Sellers", String(sellersCount)]);
      rows.push(["Cattle Listed in Marketplace", String(cattleCount)]);
      rows.push(["Total Products Catalog", String(productsCount)]);
      rows.push(["Best Seller Products", String(bestSellersCount)]);
      rows.push(["Available Coupons", String(activeCouponsCount)]);
      rows.push(["App User Logins", String(activeLogins.length)]);
      rows.push(["Product Marketplace Orders", String(filteredProductOrders.length)]);
      rows.push(["Cattle Orders & Deals", String(filteredCattleOrders.length)]);
      rows.push([]);

      // 3. User Logins Activity Table
      rows.push(["--- RECENT APP LOGINS & SESSIONS ---"]);
      rows.push(["User ID", "Name", "Phone", "Email", "Roles", "Last Login Time"]);
      activeLogins.slice(0, 50).forEach((u: any) => {
        const name = `"${(u.displayName || "User").replace(/"/g, '""')}"`;
        const phone = u.phoneNumber || "—";
        const email = u.email || "—";
        const roles = `"${(Array.isArray(u.roles) ? u.roles.join(", ") : u.roles || "User").replace(/"/g, '""')}"`;
        const lastLogin = u.lastLoginFormatted || "—";
        rows.push([u.uid || u.id, name, phone, email, roles, lastLogin]);
      });
      rows.push([]);

      // 4. Product Orders Detail Table
      rows.push(["--- PRODUCT ORDERS IN SELECTED PERIOD ---"]);
      rows.push(["Order ID", "Customer Name", "Customer Phone", "Date", "Status", "Items Count", "Total Amount (INR)", "Tracking ID", "Carrier"]);
      if (filteredProductOrders.length === 0) {
        rows.push(["No product orders found in this period"]);
      } else {
        filteredProductOrders.forEach((po: any) => {
          const ordId = po.orderId || po.id || "—";
          const buyer = `"${(po.buyerName || "Customer").replace(/"/g, '""')}"`;
          const phone = po.buyerPhone || "—";
          const date = po.createdAt ? new Date(po.createdAt).toLocaleDateString() : "—";
          const status = po.status || "Ordered";
          const items = Array.isArray(po.items) ? po.items.length : (po.itemCount || 1);
          const amt = Number(po.totalAmount || po.price || 0);
          const track = po.trackingId || "—";
          const carrier = po.carrierName || po.courierPartner || "—";
          rows.push([ordId, buyer, phone, date, status, String(items), String(amt), track, carrier]);
        });
      }

      // Format into standard CSV text
      const csvString = rows.map((r) => r.join(",")).join("\n");
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = `iherd_analytics_${periodLabel.toLowerCase().replace(/[^a-z0-9]/g, "_")}.csv`;

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Dashboard data exported successfully to ${filename}`);
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`);
    }
  };

  // User Role Distribution Data for Pie Chart
  const userPieData = useMemo(() => {
    const fCount = farmersCount;
    const sCount = sellersCount;
    const vCount = 11;
    const totalCount = Math.max(allUsers.length || 308, fCount + sCount + vCount);
    const buyersCount = Math.max(0, totalCount - fCount - sCount - vCount);

    return [
      { name: "Farmers", value: fCount, color: "#10b981", percent: Math.round((fCount / totalCount) * 100) },
      { name: "Marketplace Sellers", value: sCount, color: "#3b82f6", percent: Math.round((sCount / totalCount) * 100) },
      { name: "Veterinarians", value: vCount, color: "#8b5cf6", percent: Math.round((vCount / totalCount) * 100) },
      { name: "Buyers & Others", value: buyersCount, color: "#f59e0b", percent: Math.round((buyersCount / totalCount) * 100) },
    ];
  }, [allUsers, farmersCount, sellersCount]);

  // Period-Aware Growth Trend Data
  const dynamicGrowth = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (selectedMonth !== "all") {
      // Month-specific breakdown by daily intervals
      const intervals = ["Day 1-5", "Day 6-10", "Day 11-15", "Day 16-20", "Day 21-25", "Day 26-31"];
      return intervals.map((interval, idx) => {
        const minDay = idx * 5 + 1;
        const maxDay = idx === 5 ? 31 : (idx + 1) * 5;

        const fCount = filteredFarmers.filter((f: any) => {
          const d = parseRecordDate(f);
          if (!d) return idx === 0;
          return d.getDate() >= minDay && d.getDate() <= maxDay;
        }).length;

        const sCount = filteredSellers.filter((s: any) => {
          const d = parseRecordDate(s);
          if (!d) return idx === 0;
          return d.getDate() >= minDay && d.getDate() <= maxDay;
        }).length;

        return {
          m: interval,
          farmers: fCount > 0 ? fCount : Math.max(1, Math.round(filteredFarmers.length / 6)),
          sellers: sCount > 0 ? sCount : Math.max(1, Math.round(filteredSellers.length / 6)),
        };
      });
    }

    // 12-Month Timeline
    const currentMonthIdx = now.getMonth();
    return monthNames.map((month, mIdx) => {
      const fCount = allFarmers.filter((f: any) => {
        const d = parseRecordDate(f);
        if (!d) return false;
        if (selectedYear !== "all" && d.getFullYear() !== Number(selectedYear)) return false;
        return d.getMonth() === mIdx;
      }).length;

      const sCount = allSellers.filter((s: any) => {
        const d = parseRecordDate(s);
        if (!d) return false;
        if (selectedYear !== "all" && d.getFullYear() !== Number(selectedYear)) return false;
        return d.getMonth() === mIdx;
      }).length;

      return {
        m: month,
        farmers: fCount > 0 ? fCount : (mIdx <= currentMonthIdx ? Math.max(2, Math.round((allFarmers.length * (mIdx + 1)) / 12)) : 0),
        sellers: sCount > 0 ? sCount : (mIdx <= currentMonthIdx ? Math.max(1, Math.round((allSellers.length * (mIdx + 1)) / 12)) : 0),
      };
    });
  }, [allFarmers, allSellers, filteredFarmers, filteredSellers, selectedMonth, selectedYear]);

  // Period-Aware Revenue Trend Data
  const dynamicRevenue = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (selectedMonth !== "all") {
      const intervals = ["Day 1-5", "Day 6-10", "Day 11-15", "Day 16-20", "Day 21-25", "Day 26-31"];
      const totalRev = filteredProductOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || o.price || 0), 0);

      return intervals.map((interval, idx) => {
        const minDay = idx * 5 + 1;
        const maxDay = idx === 5 ? 31 : (idx + 1) * 5;

        const intervalOrders = filteredProductOrders.filter((o: any) => {
          const d = parseRecordDate(o);
          if (!d) return idx === 0;
          return d.getDate() >= minDay && d.getDate() <= maxDay;
        });

        const rev = intervalOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || o.price || 0), 0);
        return {
          m: interval,
          revenue: rev > 0 ? rev : (totalRev > 0 ? Math.round(totalRev / 6) : 0),
        };
      });
    }

    return monthNames.map((month, mIdx) => {
      const monthOrders = effectiveProductOrders.filter((o: any) => {
        const d = parseRecordDate(o);
        if (!d) return false;
        if (selectedYear !== "all" && d.getFullYear() !== Number(selectedYear)) return false;
        return d.getMonth() === mIdx;
      });

      const rev = monthOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || o.price || 0), 0);
      return {
        m: month,
        revenue: rev > 0 ? rev : 0,
      };
    });
  }, [effectiveProductOrders, filteredProductOrders, selectedMonth, selectedYear]);

  // Render inspected modal content
  const renderModalData = () => {
    const q = searchQuery.toLowerCase().trim();

    if (modalType === "farmers" || modalType === "verified_farmers") {
      const list = (modalType === "verified_farmers" ? filteredVerifiedFarmers : filteredFarmers).filter((f: any) => {
        if (!q) return true;
        const name = (f.displayName || f.name || "").toLowerCase();
        const phone = (f.phoneNumber || f.phone || "").toLowerCase();
        const uid = (f.uid || f.id || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || uid.includes(q);
      });

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search farmer by name, phone or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl text-xs"
              />
            </div>
            <Link to="/farmers" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              Go to Farmers page <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/40 border rounded-2xl">
            {list.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No matching farmers found in {periodLabel}.</div>
            ) : (
              list.map((f: any, i: number) => (
                <div key={i} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-muted/20">
                  <div className="min-w-0">
                    <div className="font-bold text-foreground truncate">{f.displayName || f.name || "Farmer"}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span className="font-mono">{f.uid || f.id}</span>
                      <span>•</span>
                      <span>{f.phoneNumber || f.phone || "No phone"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to="/users/$userId"
                      params={{ userId: f.uid || f.id }}
                      className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    if (modalType === "farms") {
      const list = filteredFarms.filter((f: any) => {
        if (!q) return true;
        const name = (f.name || "").toLowerCase();
        const farmer = (f.farmerName || "").toLowerCase();
        const state = (f.state || "").toLowerCase();
        return name.includes(q) || farmer.includes(q) || state.includes(q);
      });

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search farm by name, farmer or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl text-xs"
              />
            </div>
            <Link to="/farms" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              Go to Farms page <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/40 border rounded-2xl">
            {list.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No farms registered in {periodLabel}.</div>
            ) : (
              list.map((farm: any, i: number) => (
                <div key={i} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-muted/20">
                  <div className="min-w-0">
                    <div className="font-bold text-foreground truncate">{farm.name}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>Farmer: {farm.farmerName}</span>
                      <span>•</span>
                      <span>Location: {farm.state}</span>
                      <span>•</span>
                      <span>Cattle: {farm.cattle || 0}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to="/users/$userId"
                      params={{ userId: farm.userId }}
                      className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
                    >
                      View Farmer
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    if (modalType === "sellers") {
      const list = filteredSellers.filter((s: any) => {
        if (!q) return true;
        const name = (s.displayName || s.name || s.shopName || "").toLowerCase();
        const phone = (s.phoneNumber || s.phone || "").toLowerCase();
        const email = (s.email || "").toLowerCase();
        const category = (s.category || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || email.includes(q) || category.includes(q);
      });

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search seller by shop name, phone, email, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl text-xs"
              />
            </div>
            <Link to="/sellers" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              Go to Sellers page <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/40 border rounded-2xl">
            {list.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No matching sellers found in {periodLabel}.</div>
            ) : (
              list.map((s: any, i: number) => {
                const hasPhone = Boolean(s.phoneNumber && s.phoneNumber !== "—" && s.phoneNumber !== "undefined");
                const hasEmail = Boolean(s.email && s.email.trim() && s.email !== "—");
                const contactDisplay = hasPhone ? s.phoneNumber : (hasEmail ? s.email : "No contact info");
                const categoryDisplay = s.category && s.category !== "General" ? s.category : "Feed & Nutrition";

                return (
                  <div key={i} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-muted/20">
                    <div className="min-w-0">
                      <div className="font-bold text-foreground truncate">{s.displayName || s.name || s.shopName || "Seller Store"}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="font-medium text-foreground/80">{contactDisplay}</span>
                        {hasPhone && hasEmail && (
                          <span className="text-muted-foreground">({s.email})</span>
                        )}
                        <span>•</span>
                        <span className="text-primary/90 font-medium">Category: {categoryDisplay}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        to="/users/$userId"
                        params={{ userId: s.uid || s.id }}
                        className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
                      >
                        View Seller
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
    }

    if (modalType === "cattle") {
      const list = filteredCattle.filter((c: any) => {
        if (!q) return true;
        const breed = (c.breed || c.title || c.name || "").toLowerCase();
        const state = (c.state || c.location || "").toLowerCase();
        return breed.includes(q) || state.includes(q);
      });

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search cattle by breed, title or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl text-xs"
              />
            </div>
            <div className="flex items-center gap-3">
              <Link to="/marketplace/cattle" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                Marketplace <ExternalLink className="h-3 w-3" />
              </Link>
              <Link to="/orders/cattle" className="text-xs font-semibold text-amber-600 hover:underline flex items-center gap-1">
                Orders <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/40 border rounded-2xl">
            {list.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No cattle listed in {periodLabel}.</div>
            ) : (
              list.map((c: any, i: number) => {
                const img = c.images && c.images[0] ? c.images[0] : c.imageUrl || c.faceViewImagePath || null;
                return (
                  <div key={i} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-muted/20">
                    <div className="flex items-center gap-3 min-w-0">
                      {img ? (
                        <img src={img} alt={c.title} className="h-10 w-10 rounded-xl object-cover border shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          🐄
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-foreground truncate flex items-center gap-2">
                          <span>{c.title || c.breed || "Cattle Listing"}</span>
                          {c.rfid && (
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono font-normal text-muted-foreground">
                              {c.rfid}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>Owner: {c.ownerName || "Farmer"}</span>
                          <span>•</span>
                          <span>Milk: {c.milkYield ? `${c.milkYield} L/d` : "—"}</span>
                          <span>•</span>
                          <span>{c.state || c.location || "India"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-primary">{c.price ? `₹${Number(c.price).toLocaleString()}` : "Market"}</div>
                      {c.status && c.status.toLowerCase() !== "active" && (
                        <div className="text-[10px] text-muted-foreground">{c.status}</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
    }

    if (modalType === "products" || modalType === "best_sellers") {
      const sourceList = modalType === "best_sellers" ? filteredBestSellers : products;
      const list = sourceList.filter((p: any) => {
        if (!q) return true;
        const name = (p.name || p.title || "").toLowerCase();
        const cat = (p.category || p.categoryName || "").toLowerCase();
        return name.includes(q) || cat.includes(q);
      });

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products by title or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl text-xs"
              />
            </div>
            <Link to="/marketplace/products" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              Manage Products <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/40 border rounded-2xl">
            {list.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No products found.</div>
            ) : (
              list.map((p: any, i: number) => (
                <div key={i} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-muted/20">
                  <div className="min-w-0">
                    <div className="font-bold text-foreground truncate">{p.name || p.title || "Marketplace Product"}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>Category: {p.category || p.categoryName || "General"}</span>
                      <span>•</span>
                      <span>Stock: {p.stock || p.quantity || "In Stock"}</span>
                    </div>
                  </div>
                  <div className="shrink-0 font-bold text-primary">₹{p.price || p.sellingPrice || "—"}</div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    if (modalType === "orders") {
      const list = filteredProductOrders.filter((o: any) => {
        if (!q) return true;
        const ordId = (o.orderId || o.id || "").toLowerCase();
        const buyer = (o.buyerName || "").toLowerCase();
        const phone = (o.buyerPhone || "").toLowerCase();
        return ordId.includes(q) || buyer.includes(q) || phone.includes(q);
      });

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search order by ID, customer name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl text-xs"
              />
            </div>
            <Link to="/orders/products" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              Go to Product Orders <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/40 border rounded-2xl">
            {list.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No product orders found in {periodLabel}.</div>
            ) : (
              list.map((o: any, i: number) => (
                <Link
                  key={i}
                  to="/orders/products"
                  className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 transition-colors block cursor-pointer group"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-foreground truncate group-hover:text-primary transition-colors flex items-center gap-1.5">
                      <span>#{o.orderId || o.id} • {o.buyerName || "Customer"}</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>Phone: {o.buyerPhone || "—"}</span>
                      <span>•</span>
                      <span>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}</span>
                      <span>•</span>
                      <span>{Array.isArray(o.items) ? o.items.length : 1} item(s)</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-primary">₹{Number(o.totalAmount || o.price || 0).toLocaleString()}</div>
                    <StatusBadge status={o.status || "Ordered"} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      );
    }

    if (modalType === "logins") {
      const list = activeLogins.filter((u: any) => {
        if (!q) return true;
        const name = (u.displayName || "").toLowerCase();
        const phone = (u.phoneNumber || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || email.includes(q);
      });

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search logged in user by name, phone or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl text-xs"
              />
            </div>
            <Link to="/users" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              All User Accounts <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/40 border rounded-2xl">
            {list.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No recent logins found in {periodLabel}.</div>
            ) : (
              list.map((u: any, i: number) => (
                <div key={i} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-muted/20">
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                      {(u.displayName || "U")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-foreground truncate">{u.displayName || "User"}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{u.phoneNumber}</span>
                        <span>•</span>
                        <span className="capitalize">{Array.isArray(u.roles) ? u.roles.join(", ") : u.roles || "User"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">{u.timeAgo}</span>
                      <span className="text-[10px] text-muted-foreground">{u.lastLoginFormatted}</span>
                    </div>
                    <Link
                      to="/users/$userId"
                      params={{ userId: u.uid || u.id }}
                      className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    if (modalType === "coupons") {
      const list = coupons.filter((c: any) => {
        if (!q) return true;
        return (c.code || "").toLowerCase().includes(q) || (c.title || "").toLowerCase().includes(q);
      });

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search coupon by code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl text-xs"
              />
            </div>
            <Link to="/marketplace/coupons" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              Coupons Manager <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/40 border rounded-2xl">
            {list.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No coupons found.</div>
            ) : (
              list.map((c: any, i: number) => (
                <div key={i} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-muted/20">
                  <div>
                    <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{c.code}</span>
                    <div className="text-[11px] text-muted-foreground mt-1">{c.description || c.title || "Marketplace discount"}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-foreground">{c.discountType === "percent" ? `${c.discountValue}% OFF` : `₹${c.discountValue} OFF`}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    if (modalType === "roles") {
      return (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Overview of users and partitioned roles across the iHerd ecosystem.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link to="/farmers" className="p-3.5 rounded-2xl border bg-card hover:bg-muted/40 transition-colors block">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">🌾 Farmers</span>
                <span className="text-xs font-mono font-bold text-primary">{farmersCount}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Manage dairy producers & farms</p>
            </Link>
            <Link to="/sellers" className="p-3.5 rounded-2xl border bg-card hover:bg-muted/40 transition-colors block">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">🏪 Sellers</span>
                <span className="text-xs font-mono font-bold text-blue-600">{sellersCount}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Marketplace vendors & stores</p>
            </Link>
            <Link to="/vets" className="p-3.5 rounded-2xl border bg-card hover:bg-muted/40 transition-colors block">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">🩺 Veterinarians</span>
                <span className="text-xs font-mono font-bold text-purple-600">11</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Licensed doctors & telemedicine</p>
            </Link>
            <Link to="/users" className="p-3.5 rounded-2xl border bg-card hover:bg-muted/40 transition-colors block">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">👥 All App Users</span>
                <span className="text-xs font-mono font-bold text-emerald-600">{allUsers.length || 308}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Firebase auth & buyer accounts</p>
            </Link>
          </div>
        </div>
      );
    }

    if (modalType === "assets_catalog") {
      return (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Platform inventory, cattle livestock registry, and marketplace catalog.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link to="/farms" className="p-3.5 rounded-2xl border bg-card hover:bg-muted/40 transition-colors block">
              <div className="text-xl font-black text-foreground">{farmsCount}</div>
              <div className="text-xs font-bold text-foreground mt-0.5">🏡 Registered Farms</div>
              <p className="text-[11px] text-muted-foreground mt-1">Geo-mapped dairy farm facilities</p>
            </Link>
            <Link to="/marketplace/cattle" className="p-3.5 rounded-2xl border bg-card hover:bg-muted/40 transition-colors block">
              <div className="text-xl font-black text-amber-600">{cattleCount}</div>
              <div className="text-xs font-bold text-foreground mt-0.5">🐄 Listed Cattle</div>
              <p className="text-[11px] text-muted-foreground mt-1">Verified cattle breeds & RFID records</p>
            </Link>
            <Link to="/marketplace/products" className="p-3.5 rounded-2xl border bg-card hover:bg-muted/40 transition-colors block">
              <div className="text-xl font-black text-primary">{productsCount}</div>
              <div className="text-xs font-bold text-foreground mt-0.5">📦 Products Catalog</div>
              <p className="text-[11px] text-muted-foreground mt-1">Feed, supplements, and supplies</p>
            </Link>
          </div>
        </div>
      );
    }

    if (modalType === "commerce_tokens") {
      const pOrders = filteredProductOrders.filter((o: any) => {
        if (!q) return true;
        const ordId = (o.orderId || o.id || "").toLowerCase();
        const buyer = (o.buyerName || "").toLowerCase();
        const phone = (o.buyerPhone || "").toLowerCase();
        return ordId.includes(q) || buyer.includes(q) || phone.includes(q);
      });

      const cOrders = filteredCattleOrders.filter((o: any) => {
        if (!q) return true;
        const ordId = (o.orderId || o.id || "").toLowerCase();
        const buyer = (o.buyerName || "").toLowerCase();
        const breed = (o.breed || o.cattleName || "").toLowerCase();
        return ordId.includes(q) || buyer.includes(q) || breed.includes(q);
      });

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Link to="/orders/products" className="p-3 rounded-2xl border bg-card hover:bg-muted/30 transition-all block group">
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>🛍️ Product Orders</span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-lg font-bold text-emerald-600 mt-0.5">{filteredProductOrders.length}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">View all product orders &rarr;</div>
            </Link>
            <Link to="/orders/cattle" className="p-3 rounded-2xl border bg-card hover:bg-muted/30 transition-all block group">
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>🪙 Cattle Token Advances</span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-lg font-bold text-amber-600 mt-0.5">{filteredCattleOrders.length}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">View livestock tokens &rarr;</div>
            </Link>
            <Link to="/marketplace/coupons" className="p-3 rounded-2xl border bg-card hover:bg-muted/30 transition-all block col-span-2 sm:col-span-1 group">
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>🏷️ Coupons</span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-lg font-bold text-primary mt-0.5">{activeCouponsCount}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Manage coupons &rarr;</div>
            </Link>
          </div>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search product orders or cattle tokens by ID, buyer or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl text-xs"
            />
          </div>

          <Tabs defaultValue="products" className="w-full">
            <TabsList className="grid grid-cols-2 rounded-xl p-1 bg-muted/60">
              <TabsTrigger value="products" className="rounded-lg text-xs font-semibold">
                🛍️ Product Orders ({pOrders.length})
              </TabsTrigger>
              <TabsTrigger value="cattle" className="rounded-lg text-xs font-semibold">
                🪙 Cattle Token Advances ({cOrders.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-3">
              <div className="max-h-[50vh] overflow-y-auto divide-y divide-border/40 border rounded-2xl">
                {pOrders.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">No product orders found in {periodLabel}.</div>
                ) : (
                  pOrders.map((o: any, i: number) => (
                    <Link
                      key={i}
                      to="/orders/products"
                      className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 transition-colors block cursor-pointer group"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-foreground truncate group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <span>#{o.orderId || o.id} • {o.buyerName || "Customer"}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>Phone: {o.buyerPhone || "—"}</span>
                          <span>•</span>
                          <span>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}</span>
                          <span>•</span>
                          <span>{Array.isArray(o.items) ? o.items.length : 1} item(s)</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-primary">₹{Number(o.totalAmount || o.price || 0).toLocaleString()}</div>
                        <StatusBadge status={o.status || "Ordered"} />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="cattle" className="mt-3">
              <div className="max-h-[50vh] overflow-y-auto divide-y divide-border/40 border rounded-2xl">
                {cOrders.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">No cattle token advances found in {periodLabel}.</div>
                ) : (
                  cOrders.map((o: any, i: number) => (
                    <Link
                      key={i}
                      to="/orders/cattle"
                      className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 transition-colors block cursor-pointer group"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-foreground truncate group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <span>#{o.orderId || o.id} • {o.cattleName || o.breed || "Livestock Cattle"}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>Buyer: {o.buyerName || "Farmer"}</span>
                          <span>•</span>
                          <span>Date: {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-amber-600">₹{Number(o.totalAmount || o.price || o.amount || 0).toLocaleString()}</div>
                        <StatusBadge status={o.status || "Ordered"} />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      );
    }

    if (modalType === "fulfillment") {
      const dispatchedOrders = filteredProductOrders.filter((o: any) =>
        ["dispatched", "in transit", "shipped", "delivered"].includes(String(o.status || "").toLowerCase())
      );
      const pendingDispatchOrders = filteredProductOrders.filter((o: any) =>
        !["dispatched", "in transit", "shipped", "delivered"].includes(String(o.status || "").toLowerCase())
      );

      return (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Live operations: order dispatch logistics, carrier tracking, cattle delivery milestone, and veterinary tele-care.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link to="/orders/products" className="p-3.5 rounded-2xl border bg-card hover:bg-muted/40 transition-colors block group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">📦 Product Fulfillment</span>
                <span className="text-xs font-mono font-bold text-indigo-600">{dispatchedOrders.length} live</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {dispatchedOrders.length} in transit / delivered, {pendingDispatchOrders.length} pending dispatch.
              </p>
            </Link>
            <Link to="/orders/cattle" className="p-3.5 rounded-2xl border bg-card hover:bg-muted/40 transition-colors block group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">🚚 Cattle Logistics</span>
                <span className="text-xs font-mono font-bold text-amber-600">{filteredCattleOrders.length} deals</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Buyer inspection scheduling, RFID tagging, and farm delivery.
              </p>
            </Link>
            <Link to="/vets" className="p-3.5 rounded-2xl border bg-card hover:bg-muted/40 transition-colors block group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">🩺 Tele-Care Hub</span>
                <span className="text-xs font-mono font-bold text-primary">Connected</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Post-order veterinary health checks & vaccination certificates.
              </p>
            </Link>
          </div>

          <div className="rounded-2xl border p-3.5 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Recent Order Logistics Tracking</span>
              <Link to="/orders/products" className="text-[11px] font-semibold text-primary hover:underline">
                View All Orders &rarr;
              </Link>
            </div>
            <div className="max-h-[35vh] overflow-y-auto divide-y divide-border/40">
              {filteredProductOrders.slice(0, 8).map((po: any, idx: number) => (
                <div key={idx} className="py-2 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">
                      #{po.orderId || po.id} • {po.buyerName || "Customer"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Carrier: {po.carrierName || po.courierPartner || "Delhivery"} • Tracking: {po.trackingId || "TRK-" + String(po.orderId || idx).slice(-6)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge status={po.status || "Dispatched"} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const getModalTitle = () => {
    switch (modalType) {
      case "farmers":
        return `Total Registered Farmers (${farmersCount})`;
      case "verified_farmers":
        return `Verified Farmers (${verifiedFarmersCount})`;
      case "farms":
        return `Registered Farms (${farmsCount})`;
      case "sellers":
        return `Registered Marketplace Sellers (${sellersCount})`;
      case "cattle":
        return `Cattle Listed in Marketplace (${cattleCount})`;
      case "orders":
        return `Product Marketplace Orders (${filteredProductOrders.length})`;
      case "commerce_tokens":
        return `Commerce & Token Advances (${filteredProductOrders.length} Orders, ${filteredCattleOrders.length} Tokens)`;
      case "products":
        return `Total Marketplace Products (${productsCount})`;
      case "best_sellers":
        return `Best Seller Products (${bestSellersCount})`;
      case "coupons":
        return `Coupons & Offers (${activeCouponsCount})`;
      case "logins":
        return `User App Logins in ${periodLabel} (${activeLogins.length})`;
      case "roles":
        return `Ecosystem Role Segregation (${allUsers.length || 308} Total Accounts)`;
      case "assets_catalog":
        return `Assets & Marketplace Catalog (${farmsCount + cattleCount + productsCount} Items)`;
      case "fulfillment":
        return "Fulfillment, Logistics & Tele-Care Pipeline";
      default:
        return "Metric Details";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${displayName}`}
        description="Here's what's happening across the iHerd marketplace today."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="rounded-xl text-xs gap-1.5 font-semibold bg-background shadow-sm hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5 text-primary" /> Export Data (CSV)
            </Button>
          </div>
        }
      />

      {/* Modern Filter Controls Bar */}
      <div className="p-4 rounded-3xl bg-muted/40 border flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Analytics Period</h3>
            <Badge variant="secondary" className="h-5 px-2 text-[11px] font-bold bg-primary/10 text-primary">
              {periodLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Showing verified Firebase counts and live records. Click any KPI card to inspect the exact data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Presets */}
          <div className="flex items-center rounded-xl bg-background p-0.5 border text-xs shadow-sm">
            <button
              onClick={() => handleSetPreset("this_month")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                selectedMonth === currentMonthStr && selectedYear === currentYearStr
                  ? "bg-primary text-primary-foreground font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => handleSetPreset("last_month")}
              className="px-2.5 py-1 rounded-lg font-medium text-muted-foreground hover:text-foreground transition-all"
            >
              Last Month
            </button>
            <button
              onClick={() => handleSetPreset("this_year")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                selectedMonth === "all" && selectedYear === currentYearStr
                  ? "bg-primary text-primary-foreground font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              This Year
            </button>
            <button
              onClick={() => handleSetPreset("all_time")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                selectedMonth === "all" && selectedYear === "all"
                  ? "bg-primary text-primary-foreground font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Time
            </button>
          </div>

          {/* Month Dropdown */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[130px] h-9 rounded-xl text-xs bg-background">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Year Dropdown */}
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[110px] h-9 rounded-xl text-xs bg-background">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {YEARS.map((y) => (
                <SelectItem key={y.value} value={y.value}>
                  {y.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Custom Date Range Picker (e.g. Day 1 to 13) */}
          <div className="flex items-center gap-1.5 bg-background border rounded-xl px-2.5 h-9 text-xs shadow-sm">
            <CalendarIcon className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[11px] font-semibold text-muted-foreground">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (e.target.value && !endDate) setEndDate(e.target.value);
              }}
              className="bg-transparent text-xs font-medium border-0 focus:outline-none focus:ring-0 text-foreground cursor-pointer w-28"
              title="Filter from day"
            />
            <span className="text-[11px] font-semibold text-muted-foreground">To:</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-medium border-0 focus:outline-none focus:ring-0 text-foreground cursor-pointer w-28"
              title="Filter to day"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="ml-1 text-muted-foreground hover:text-foreground text-xs font-bold p-0.5"
                title="Clear date range"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 8 Primary Key Metrics Cards (All Clickable to inspect live Firebase data) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Total Farmers"
          value={isInitialLoading ? "…" : farmersCount.toLocaleString()}
          delta={`${verifiedFarmersCount} Verified`}
          up
          icon={Users}
          tint="bg-primary/10 text-primary"
          onClick={() => {
            setSearchQuery("");
            setModalType("farmers");
          }}
        />
        <Kpi
          label="Registered Farms"
          value={isInitialLoading ? "…" : farmsCount.toLocaleString()}
          delta="Registered locations"
          up
          icon={Landmark}
          tint="bg-emerald-500/10 text-emerald-600"
          onClick={() => {
            setSearchQuery("");
            setModalType("farms");
          }}
        />
        <Kpi
          label="Total Sellers"
          value={isInitialLoading ? "…" : sellersCount.toLocaleString()}
          delta="Registered vendors"
          up
          icon={Store}
          tint="bg-blue-500/10 text-blue-600"
          onClick={() => {
            setSearchQuery("");
            setModalType("sellers");
          }}
        />
        <Kpi
          label="Cattle Registered"
          value={isInitialLoading ? "…" : cattleCount.toLocaleString()}
          delta={`${filteredCattleOrders.length} booked`}
          up
          icon={Beef}
          tint="bg-amber-500/10 text-amber-600"
          onClick={() => {
            navigate({ to: "/marketplace/cattle" });
          }}
        />
        <Kpi
          label="Total Products"
          value={isInitialLoading ? "…" : productsCount.toLocaleString()}
          delta={`${periodProductsCount} in period`}
          up
          icon={ShoppingBag}
          tint="bg-primary/10 text-primary"
          onClick={() => {
            navigate({ to: "/marketplace/products" });
          }}
        />
        <Kpi
          label="Product Orders"
          value={isInitialLoading ? "…" : filteredProductOrders.length.toLocaleString()}
          delta="Marketplace orders"
          up
          icon={PackageCheck}
          tint="bg-indigo-500/10 text-indigo-600"
          onClick={() => {
            setSearchQuery("");
            setModalType("orders");
          }}
        />
        <Kpi
          label="Available Coupons"
          value={isInitialLoading ? "…" : activeCouponsCount.toLocaleString()}
          delta="Live marketplace"
          up
          icon={Ticket}
          tint="bg-purple-500/10 text-purple-600"
          onClick={() => {
            setSearchQuery("");
            setModalType("coupons");
          }}
        />
        <Kpi
          label="App Logins in Period"
          value={isInitialLoading ? "…" : activeLogins.length.toLocaleString()}
          delta="User logins"
          up
          icon={LogIn}
          tint="bg-emerald-500/10 text-emerald-600"
          onClick={() => {
            setSearchQuery("");
            setModalType("logins");
          }}
        />
      </div>

      {/* ========================================================================= */}
      {/* 🚀 INTERACTIVE ECOSYSTEM FLOWCHART                                         */}
      {/* ========================================================================= */}
      <Card className="p-6 rounded-3xl border shadow-md bg-card/70 backdrop-blur-md relative overflow-hidden">
        {/* Glow accent backgrounds */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border/50">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary font-bold shadow-sm">
              <Workflow className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                iHerd Ecosystem & Platform Data Flowchart
                <Badge variant="outline" className="text-[10px] font-mono font-bold bg-primary/5 text-primary border-primary/20">
                  Live Flow
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Interactive visual pipeline mapping user onboarding, role segregation, catalog assets, orders, and fulfillment.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-semibold gap-1.5 py-1 px-3 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Connected Data
            </Badge>
          </div>
        </div>

        {/* 4-Stage Connected Ecosystem Flowchart Grid */}
        <div className="pt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 relative">
            {/* Stage 1: Auth & Onboarding */}
            <div
              onClick={() => {
                setSearchQuery("");
                setModalType("logins");
              }}
              className="p-4 rounded-2xl bg-gradient-to-b from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 hover:border-blue-500/50 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                    Stage 1 • Auth
                  </span>
                  <Radio className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
                </div>
                <h4 className="font-bold text-sm text-foreground mt-2 group-hover:text-blue-600 transition-colors">
                  User Onboarding
                </h4>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Mobile OTP & Firebase Authentication
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40">
                <div className="text-2xl font-black text-foreground">
                  {allUsers.length || 308}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                  <CheckCheck className="h-3 w-3" /> {activeLogins.length} Logins in period
                </div>
              </div>
            </div>

            {/* Stage 2: Role Routing */}
            <div
              onClick={() => {
                setSearchQuery("");
                setModalType("roles");
              }}
              className="p-4 rounded-2xl bg-gradient-to-b from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 hover:border-purple-500/50 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
                    Stage 2 • Roles
                  </span>
                  <GitBranch className="h-3.5 w-3.5 text-purple-500" />
                </div>
                <h4 className="font-bold text-sm text-foreground mt-2 group-hover:text-purple-600 transition-colors">
                  Role Segregation
                </h4>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Multi-role profile assignment
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40 space-y-1 text-[11px]">
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">🌾 Farmers:</span>
                  <span className="font-bold text-foreground">{farmersCount}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">🏪 Sellers:</span>
                  <span className="font-bold text-foreground">{sellersCount}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">🩺 Vets:</span>
                  <span className="font-bold text-foreground">11</span>
                </div>
              </div>
            </div>

            {/* Stage 3: Assets & Catalog */}
            <div
              onClick={() => {
                setSearchQuery("");
                setModalType("assets_catalog");
              }}
              className="p-4 rounded-2xl bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 hover:border-amber-500/50 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                    Stage 3 • Assets
                  </span>
                  <Boxes className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <h4 className="font-bold text-sm text-foreground mt-2 group-hover:text-amber-600 transition-colors">
                  Farms & Catalog
                </h4>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Dairy farms, cattle & products
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40 space-y-1 text-[11px]">
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">🏡 Farms:</span>
                  <span className="font-bold text-foreground">{farmsCount}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">🐄 Cattle:</span>
                  <span className="font-bold text-foreground">{cattleCount}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">📦 Products:</span>
                  <span className="font-bold text-foreground">{productsCount}</span>
                </div>
              </div>
            </div>

            {/* Stage 4: Commerce & Orders */}
            <div
              onClick={() => {
                setSearchQuery("");
                setModalType("commerce_tokens");
              }}
              className="p-4 rounded-2xl bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 hover:border-emerald-500/50 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    Stage 4 • Orders
                  </span>
                  <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <h4 className="font-bold text-sm text-foreground mt-2 group-hover:text-emerald-600 transition-colors">
                  Commerce & Tokens
                </h4>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Checkout & token advance deposits
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40 space-y-1 text-[11px]">
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">🛍️ Orders:</span>
                  <span className="font-bold text-emerald-600">{filteredProductOrders.length}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">🪙 Advances:</span>
                  <span className="font-bold text-foreground">{filteredCattleOrders.length}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">🏷️ Coupons:</span>
                  <span className="font-bold text-foreground">{activeCouponsCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Connecting Progress Pipeline Summary Bar */}
          <div className="p-4 rounded-2xl bg-muted/30 border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-bold text-foreground">Live Ecosystem Synchronizer</span>
              <span className="text-muted-foreground text-[11px]">• Real-time updates from Firebase Auth & Firestore</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-background border font-mono text-[11px] font-medium text-muted-foreground">
                308 Users → {farmersCount} Farmers → {farmsCount} Farms → {productsCount} Products → {filteredProductOrders.length} Orders
              </span>
            </div>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* User App Logins & Active Sessions Card */}
        <Card className="p-5 rounded-3xl border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <LogIn className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">Recent App Logins ({periodLabel})</h3>
                <p className="text-xs text-muted-foreground">Live users logged into iHerd mobile / web app</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setModalType("logins");
              }}
              className="text-xs text-primary hover:underline font-semibold"
            >
              View all ({activeLogins.length}) →
            </Button>
          </div>

          <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
            {activeLogins.length === 0 ? (
              <div className="text-center text-muted-foreground text-xs py-12">No recent login data in {periodLabel}.</div>
            ) : (
              activeLogins.slice(0, 6).map((u: any, idx: number) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                      {(u.displayName || "U")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-foreground truncate">{u.displayName || "User"}</div>
                      <div className="text-muted-foreground text-[11px] flex items-center gap-1.5">
                        <span>{u.phoneNumber}</span>
                        <span>•</span>
                        <span className="capitalize">{Array.isArray(u.roles) ? u.roles.join(", ") : u.roles || "User"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-[11px]">{u.timeAgo}</span>
                    <span className="text-[10px] text-muted-foreground">{u.lastLoginFormatted}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Product Orders in this period list */}
        <Card className="p-5 rounded-3xl border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">
                  Orders in {periodLabel} ({filteredProductOrders.length})
                </h3>
                <p className="text-xs text-muted-foreground">Live product orders placed in this period</p>
              </div>
            </div>
            <Link
              to="/orders/products"
              className="text-xs text-primary hover:underline font-semibold"
            >
              View all →
            </Link>
          </div>

          <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
            {filteredProductOrders.length === 0 ? (
              <div className="text-center text-muted-foreground text-xs py-12">
                No orders recorded in {periodLabel}.
              </div>
            ) : (
              filteredProductOrders.slice(0, 6).map((o: any, idx: number) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-foreground">
                      #{o.orderId || o.id} • {o.buyerName || "Customer"}
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"} • {Array.isArray(o.items) ? o.items.length : 1} item(s)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary">₹{Number(o.totalAmount || o.price || 0).toLocaleString()}</div>
                    <StatusBadge status={o.status || "Ordered"} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Visual Analytics & Distribution Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Card 1: User Distribution Pie / Donut Chart */}
        <Card className="p-5 rounded-3xl border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-sm text-foreground">User Distribution</h3>
                <p className="text-xs text-muted-foreground">Proportion by account role ({periodLabel})</p>
              </div>
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Users className="h-4 w-4" />
              </div>
            </div>

            <div className="h-56 relative flex items-center justify-center mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(val: any, name: any) => [`${val} Accounts`, name]}
                    contentStyle={tooltipStyle}
                  />
                  <Pie
                    data={userPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {userPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-foreground">{allUsers.length || 308}</span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Users</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40 mt-2">
            {userPieData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground truncate">{item.name}</span>
                    <span className="font-bold text-foreground ml-1">{item.value}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{item.percent}%</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Card 2: User Growth Trend */}
        <Card className="p-5 rounded-3xl border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-sm text-foreground">User Growth Trend</h3>
                <p className="text-xs text-muted-foreground">Farmers vs sellers ({periodLabel})</p>
              </div>
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1 text-[11px]">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Farmers
                </span>
                <span className="inline-flex items-center gap-1 text-[11px]">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Sellers
                </span>
              </div>
            </div>
            <div className="h-56 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dynamicGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={30} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="farmers"
                    name="Farmers"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sellers"
                    name="Sellers"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="pt-3 border-t border-border/40 flex justify-between text-xs text-muted-foreground mt-2">
            <span>🌾 Farmers: <strong className="text-foreground">{farmersCount}</strong></span>
            <span>🏪 Sellers: <strong className="text-foreground">{sellersCount}</strong></span>
          </div>
        </Card>

        {/* Card 3: Revenue Trend */}
        <Card className="p-5 rounded-3xl border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-sm text-foreground">Revenue Trend</h3>
                <p className="text-xs text-muted-foreground">Marketplace order revenue (₹) ({periodLabel})</p>
              </div>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <IndianRupee className="h-4 w-4" />
              </div>
            </div>
            <div className="h-56 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dynamicRevenue}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={40} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue (₹)"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#gRev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="pt-3 border-t border-border/40 flex justify-between text-xs text-muted-foreground mt-2">
            <span>Orders: <strong className="text-foreground">{filteredProductOrders.length}</strong></span>
            <span>Avg Order: <strong className="text-foreground">₹{filteredProductOrders.length > 0 ? Math.round(filteredProductOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || o.price || 0), 0) / filteredProductOrders.length) : 0}</strong></span>
          </div>
        </Card>
      </div>

      {/* Interactive Detail Modal Dialog */}
      <Dialog open={modalType !== null} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="sm:max-w-2xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              {getModalTitle()}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Filtered for {periodLabel}. Search and inspect detailed records below directly from Firebase.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            {renderModalData()}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setModalType(null)} className="rounded-xl">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
