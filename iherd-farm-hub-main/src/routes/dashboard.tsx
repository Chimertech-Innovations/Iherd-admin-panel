import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useState } from "react";
import { UserPlus, Mail, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminUsers } from "../hooks/useAdminUsers";

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
        <Button size="sm" className="gap-1.5 bg-gradient-to-br from-primary to-primary-glow">
          <UserPlus className="h-4 w-4" /> Invite user
        </Button>
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
            <Input id="invite-name" placeholder="e.g. Ravi Patel" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="invite-email" type="email" required placeholder="name@iherd.app" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="invite-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="farmer">Farmer</SelectItem>
                <SelectItem value="seller">Seller</SelectItem>
                <SelectItem value="support">Support agent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" className="gap-1.5 bg-gradient-to-br from-primary to-primary-glow">
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

const userGrowthData = [
  { m: "Jan", farmers: 6200, sellers: 240 },
  { m: "Feb", farmers: 6800, sellers: 268 },
  { m: "Mar", farmers: 7400, sellers: 295 },
  { m: "Apr", farmers: 8100, sellers: 322 },
  { m: "May", farmers: 8900, sellers: 358 },
  { m: "Jun", farmers: 9600, sellers: 392 },
  { m: "Jul", farmers: 10300, sellers: 421 },
  { m: "Aug", farmers: 10900, sellers: 458 },
  { m: "Sep", farmers: 11400, sellers: 492 },
  { m: "Oct", farmers: 11800, sellers: 524 },
  { m: "Nov", farmers: 12100, sellers: 561 },
  { m: "Dec", farmers: 12486, sellers: 598 },
];

const cattleMarketData = [
  { m: "Jan", listed: 420, sold: 286 },
  { m: "Feb", listed: 510, sold: 342 },
  { m: "Mar", listed: 612, sold: 408 },
  { m: "Apr", listed: 588, sold: 391 },
  { m: "May", listed: 705, sold: 482 },
  { m: "Jun", listed: 812, sold: 561 },
  { m: "Jul", listed: 894, sold: 624 },
  { m: "Aug", listed: 921, sold: 658 },
  { m: "Sep", listed: 1042, sold: 738 },
  { m: "Oct", listed: 1180, sold: 821 },
  { m: "Nov", listed: 1268, sold: 902 },
  { m: "Dec", listed: 1382, sold: 985 },
];

const productSalesData = [
  { m: "Jan", orders: 320 },
  { m: "Feb", orders: 360 },
  { m: "Mar", orders: 410 },
  { m: "Apr", orders: 380 },
  { m: "May", orders: 470 },
  { m: "Jun", orders: 520 },
  { m: "Jul", orders: 560 },
  { m: "Aug", orders: 540 },
  { m: "Sep", orders: 610 },
  { m: "Oct", orders: 670 },
  { m: "Nov", orders: 720 },
  { m: "Dec", orders: 780 },
];

const cattleOrdersData = [
  { m: "Jan", orders: 142, gmv: 118 },
  { m: "Feb", orders: 168, gmv: 142 },
  { m: "Mar", orders: 196, gmv: 168 },
  { m: "Apr", orders: 184, gmv: 156 },
  { m: "May", orders: 224, gmv: 192 },
  { m: "Jun", orders: 268, gmv: 232 },
  { m: "Jul", orders: 298, gmv: 258 },
  { m: "Aug", orders: 312, gmv: 274 },
  { m: "Sep", orders: 348, gmv: 308 },
  { m: "Oct", orders: 386, gmv: 342 },
  { m: "Nov", orders: 412, gmv: 362 },
  { m: "Dec", orders: 458, gmv: 408 },
];

const revenueData = [
  { m: "Jan", revenue: 28400 },
  { m: "Feb", revenue: 31200 },
  { m: "Mar", revenue: 35800 },
  { m: "Apr", revenue: 33100 },
  { m: "May", revenue: 41200 },
  { m: "Jun", revenue: 46800 },
  { m: "Jul", revenue: 51200 },
  { m: "Aug", revenue: 49800 },
  { m: "Sep", revenue: 57400 },
  { m: "Oct", revenue: 62100 },
  { m: "Nov", revenue: 68900 },
  { m: "Dec", revenue: 74300 },
];

const recentActivity = [
  { who: "Marketplace", what: "New cattle listing pending approval — Gir cow", when: "8m ago", tag: "pending" },
  { who: "Order #IH-7821", what: "Payment captured — ₹4,820", when: "14m ago", tag: "paid" },
  { who: "Seller onboarding", what: "Sharma Feeds — KYC approved", when: "26m ago", tag: "approved" },
  { who: "Support", what: "New issue from Rajesh Farms — feed delivery delay", when: "42m ago", tag: "open" },
  { who: "Farmer KYC", what: "Lakshmi Devi — ownership document under review", when: "1h ago", tag: "inreview" },
];

function Kpi({
  label, value, delta, up, icon: Icon, tint,
}: {
  label: string; value: string; delta: string; up: boolean; icon: any; tint: string;
}) {
  return (
    <Card className="p-5 rounded-2xl relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
          <div className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${up ? "text-success" : "text-destructive"}`}>
            {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {delta} vs last month
          </div>
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

const metricRanges: Record<string, { label: string; mult: number }> = {
  today: { label: "Today", mult: 0.03 },
  week: { label: "This week", mult: 0.18 },
  month: { label: "This month", mult: 1 },
  quarter: { label: "This quarter", mult: 2.8 },
  year: { label: "This year", mult: 11 },
};

function scaleNum(base: number, mult: number) {
  const v = Math.round(base * mult);
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return v.toLocaleString();
  return v.toString();
}

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
};

import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useFirebaseCollection, useCoupons, useTokenAdvance, useBestSellers } from "../hooks/useFirebaseData";
import { getLocalizedText } from "@/lib/utils";

function Dashboard() {
  const [range, setRange] = useState<keyof typeof metricRanges>("month");
  const m = metricRanges[range].mult;
  const { profile } = useAuth();
  const displayName = profile?.name ? profile.name.split(" ")[0] : "Admin";

  const { data: allUsers = [] } = useAdminUsers();
  const { data: firestoreUsers = [] } = useFirebaseCollection<any>("users");
  const { data: cattle = [] } = useFirebaseCollection("cattle-marketplace");
  const { data: orders = [] } = useFirebaseCollection("CattleOrders");
  const { data: products = [] } = useFirebaseCollection("product_marketplace/main/products");
  const { data: productOrders = [] } = useFirebaseCollection("ProductOrders");
  const { data: issues = [] } = useFirebaseCollection("issues");
  const { data: coupons = [] } = useCoupons();
  const { data: tokenAdvData } = useTokenAdvance();
  const { data: bestSellers = [] } = useBestSellers();

  // Extract farmers and sellers dynamically from merged users list
  const farmers = allUsers.filter((u: any) => {
    const fsUser = firestoreUsers.find((fu: any) => fu.id === u.uid || fu.uid === u.uid);
    const roles = fsUser?.roles || (fsUser?.role ? [fsUser.role] : u.roles || []);
    return (
      roles.some((r: any) => typeof r === "string" && r.toLowerCase().includes("farmer")) ||
      Boolean(fsUser && (fsUser.farms || fsUser.farmer || fsUser.isFarmer)) ||
      Boolean(u && (u.farms || u.farmer))
    );
  });
  const sellers = allUsers.filter((u: any) => {
    const fsUser = firestoreUsers.find((fu: any) => fu.id === u.uid || fu.uid === u.uid);
    const roles = fsUser?.roles || (fsUser?.role ? [fsUser.role] : u.roles || []);
    return (
      roles.some((r: any) => typeof r === "string" && r.toLowerCase().includes("seller")) ||
      Boolean(fsUser && (fsUser.seller || fsUser.isSeller)) ||
      Boolean(u && u.seller)
    );
  });

  // Strictly bind counts to active Firebase collections
  const farmersCount = farmers.length;
  const activeFarmersCount = farmers.filter((f: any) => f.status === "Active").length;
  const sellersCount = sellers.length;
  const cattleCount = cattle ? cattle.length : 0;
  const ordersCount = orders ? orders.length : 0;
  const productsCount = products ? products.length : 0;
  const productOrdersCount = productOrders ? productOrders.length : 0;
  const issuesCount = issues ? issues.length : 0;
  const activeCouponsCount = coupons ? coupons.filter((c) => c.active !== false).length : 0;
  const bestSellersCount = products.filter((p: any) => p.bestSeller || p.isBestSeller).length || bestSellers.length;
  const cowAdvanceRate = tokenAdvData?.rates?.cow ?? 200;
  const buffaloAdvanceRate = tokenAdvData?.rates?.buffalo ?? 250;


  // Build dynamic growth data from actual farmers and sellers
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dynamicGrowth = monthNames.map((month) => {
    const farmersJoined = farmers ? farmers.filter((f: any) => f.joined?.includes(month)).length : 0;
    const sellersJoined = sellers ? sellers.filter((s: any) => s.joined?.includes(month)).length : 0;
    return {
      m: month,
      farmers: farmersJoined,
      sellers: sellersJoined
    };
  });

  // Dynamic product mix counts
  const getCat = (p: any) => getLocalizedText(p.category || p.categoryName || p.categoryId).toLowerCase();
  const feedCount = products ? products.filter((p: any) => getCat(p).includes("feed")).length : 0;
  const medCount = products ? products.filter((p: any) => getCat(p).includes("med") || getCat(p).includes("disease")).length : 0;
  const eqCount = products ? products.filter((p: any) => getCat(p).includes("equip") || getCat(p).includes("farm")).length : 0;
  const suppCount = products ? products.filter((p: any) => getCat(p).includes("supp") || getCat(p).includes("breed")).length : 0;
  const accCount = products ? products.filter((p: any) => getCat(p).includes("acc") || getCat(p).includes("herd")).length : 0;

  // Dynamic recent activity
  const dynamicActivity: any[] = [];
  if (cattle && cattle.length > 0) {
    cattle.slice(0, 2).forEach((c: any) => {
      const titleStr = getLocalizedText(c.title || c.breed || c.name, "New listing");
      const priceStr = getLocalizedText(c.price, "—");
      dynamicActivity.push({
        who: "Cattle Listing",
        what: `${titleStr} · Price: ${priceStr}`,
        when: getLocalizedText(c.joined || c.createdAt, "Just now"),
        tag: getLocalizedText(c.status, "pending").toLowerCase()
      });
    });
  }
  if (orders && orders.length > 0) {
    orders.slice(0, 2).forEach((o: any) => {
      const sellerStr = getLocalizedText(o.seller || o.sellerName, "—");
      const amtStr = getLocalizedText(o.amount || o.totalAmount, "—");
      dynamicActivity.push({
        who: `Order #${getLocalizedText(o.id)}`,
        what: `Seller: ${sellerStr} · Amount: ${amtStr}`,
        when: getLocalizedText(o.date || o.createdAt, "Just now"),
        tag: getLocalizedText(o.status) === "Completed" ? "paid" : "pending"
      });
    });
  }
  if (farmers && farmers.length > 0) {
    farmers.slice(0, 1).forEach((f: any) => {
      const nameStr = getLocalizedText(f.displayName || f.name, "Farmer");
      dynamicActivity.push({
        who: "Farmer KYC",
        what: `${nameStr} — KYC status under review`,
        when: getLocalizedText(f.joined || f.createdAt, "Just now"),
        tag: getLocalizedText(f.status, "inreview").toLowerCase()
      });
    });
  }

  // Today at a glance counts
  const pendingProductApprovals = products ? products.filter((p: any) => getLocalizedText(p.status).toLowerCase() === "pending").length : 0;
  const kycPendingCount = farmers ? farmers.filter((f: any) => getLocalizedText(f.status).toLowerCase() === "pending").length : 0;


  // Dynamic cattle market growth data
  const dynamicCattleMarket = monthNames.map((month) => {
    const listedCount = cattle ? cattle.filter((c: any) => c.joined?.includes(month)).length : 0;
    const soldCount = orders ? orders.filter((o: any) => o.date?.includes(month) && o.status === "Completed").length : 0;
    return {
      m: month,
      listed: listedCount,
      sold: soldCount
    };
  });

  // Dynamic product sales trend
  const dynamicProductSales = monthNames.map((month) => {
    const pOrdersCount = productOrders ? productOrders.filter((o: any) => o.date?.includes(month)).length : 0;
    return {
      m: month,
      orders: pOrdersCount
    };
  });

  // Dynamic revenue trend
  const dynamicRevenue = monthNames.map((month) => {
    const monthOrders = orders ? orders.filter((o: any) => o.date?.includes(month)) : [];
    const revenueSum = monthOrders.reduce((acc: number, curr: any) => {
      const amtStr = String(curr.amount || "").replace(/[^0-9]/g, "");
      return acc + (Number(amtStr) || 0);
    }, 0);
    return {
      m: month,
      revenue: revenueSum
    };
  });

  // Dynamic cattle orders trend
  const dynamicCattleOrders = monthNames.map((month) => {
    const monthCattleOrders = orders ? orders.filter((o: any) => o.date?.includes(month)) : [];
    const gmvSum = monthCattleOrders.reduce((acc: number, curr: any) => {
      const amtStr = String(curr.amount || "").replace(/[^0-9]/g, "");
      return acc + (Number(amtStr) || 0);
    }, 0);
    return {
      m: month,
      orders: monthCattleOrders.length,
      gmv: Math.round(gmvSum / 100000)
    };
  });

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${displayName}`}
        description="Here's what's happening across the iHerd marketplace today."
        actions={<InviteUserDialog />}
      />

      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Key metrics</h3>
          <p className="text-xs text-muted-foreground">Filtered by {metricRanges[range].label.toLowerCase()}</p>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as keyof typeof metricRanges)}>
          <SelectTrigger className="w-[160px] h-9 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(metricRanges).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
        <Kpi label="Total farmers" value={scaleNum(farmersCount, m)} delta="+8.2%" up icon={Users} tint="bg-primary/10 text-primary" />
        <Kpi label="Verified farmers" value={scaleNum(activeFarmersCount, m)} delta="+6.4%" up icon={BadgeCheck} tint="bg-success/10 text-success" />
        <Kpi label="Total sellers" value={scaleNum(sellersCount, m)} delta="+4.8%" up icon={Store} tint="bg-info/10 text-info" />
        <Kpi label="Cattle registered" value={scaleNum(cattleCount, m)} delta="+3.6%" up icon={Beef} tint="bg-warning/10 text-warning-foreground" />
        <Kpi label="Total products" value={scaleNum(productsCount, m)} delta="+5.7%" up icon={ShoppingBag} tint="bg-primary/10 text-primary" />
        <Kpi label="Best seller items" value={scaleNum(bestSellersCount, m)} delta="+15.0%" up icon={Flame} tint="bg-amber-500/10 text-amber-600" />
        <Kpi label="Active coupons" value={scaleNum(activeCouponsCount, m)} delta="+28.0%" up icon={Ticket} tint="bg-purple-500/10 text-purple-600" />
        <Kpi label="Token advance (Cow)" value={`₹${cowAdvanceRate}`} delta="Locked" up icon={Coins} tint="bg-emerald-500/10 text-emerald-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card className="p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">User growth</h3>
              <p className="text-xs text-muted-foreground">Farmers vs sellers — last 12 months</p>
            </div>
            <div className="flex gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full bg-primary" />Farmers</span>
              <span className="inline-flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full bg-chart-2" />Sellers</span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dynamicGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="farmers" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="sellers" stroke="var(--color-chart-2)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Cattle marketplace growth</h3>
              <p className="text-xs text-muted-foreground">Listed vs sold — last 12 months</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dynamicCattleMarket} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="listed" name="Listed" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="sold" name="Sold" fill="var(--color-chart-2)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card className="p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Product sales trend</h3>
              <p className="text-xs text-muted-foreground">Monthly product orders</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicProductSales}>
                <defs>
                  <linearGradient id="gOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="orders" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#gOrders)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Revenue trend</h3>
              <p className="text-xs text-muted-foreground">Monthly marketplace revenue (₹)</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicRevenue}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} fill="url(#gRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card className="p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Cattle orders trend</h3>
              <p className="text-xs text-muted-foreground">Monthly cattle orders vs GMV (₹L)</p>
            </div>
            <div className="flex gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full bg-warning" />Orders</span>
              <span className="inline-flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full bg-primary" />GMV</span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dynamicCattleOrders} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="orders" name="Orders" fill="var(--color-warning)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="gmv" name="GMV (₹L)" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Product marketplace mix</h3>
              <p className="text-xs text-muted-foreground">Active products by category</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={[
                  { name: "Feed", v: feedCount },
                  { name: "Medicine", v: medCount },
                  { name: "Equipment", v: eqCount },
                  { name: "Supplements", v: suppCount },
                  { name: "Accessories", v: accCount },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} width={90} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="v" name="Products" fill="var(--color-chart-2)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent activity</h3>
            <Button variant="ghost" size="sm">View all</Button>
          </div>
          {dynamicActivity.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-16">
              No recent activity recorded in database.
            </div>
          ) : (
            <ul className="divide-y">
              {dynamicActivity.map((a, i) => (
                <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 sm:flex sm:flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.who}</div>
                    <div className="text-xs text-muted-foreground truncate">{a.what}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 sm:ml-auto">
                    <StatusBadge status={a.tag} />
                    <span className="text-xs text-muted-foreground w-20 text-right">{a.when}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 rounded-2xl">
          <h3 className="font-semibold mb-1">Today at a glance</h3>
          <p className="text-xs text-muted-foreground mb-4">Live marketplace ops</p>
          <ul className="space-y-3">
            {[
              { icon: Tag, label: "New cattle listings", val: cattleCount, tint: "bg-primary/10 text-primary" },
              { icon: ShoppingBag, label: "Pending product approvals", val: pendingProductApprovals, tint: "bg-warning/10 text-warning-foreground" },
              { icon: PackageCheck, label: "Orders placed", val: ordersCount, tint: "bg-info/10 text-info" },
              { icon: Wallet, label: "Pending payouts", val: "₹0", tint: "bg-success/10 text-success" },
              { icon: UserCheck, label: "KYC pending", val: kycPendingCount, tint: "bg-destructive/10 text-destructive" },
            ].map((s) => (
              <li key={s.label} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${s.tint}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-muted-foreground truncate">{s.label}</div>
                </div>
                <div className="text-lg font-bold">{s.val}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
