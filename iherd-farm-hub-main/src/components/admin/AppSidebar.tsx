import { Link, useRouterState } from "@tanstack/react-router";
import iherdLogo from "@/assets/iherd-logo-new.png.asset.json";
import {
  LayoutDashboard,
  Users,
  Store,
  ShoppingBag,
  Package,
  Wallet,
  Bell,
  BarChart3,
  Megaphone,
  LifeBuoy,
  Settings,
  Building,
  Beef,
  UserCircle,
  FileText,
  Stethoscope,
  HardDrive,
  Ticket,
  Flame,
  Coins,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

const main = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
];
const people = [
  { title: "App Users", url: "/users", icon: UserCircle },
  { title: "Farmers", url: "/farmers", icon: Users },
  { title: "Registered Farms", url: "/farms", icon: Building },
  { title: "Cattle Register", url: "/cattle", icon: Beef },
  { title: "Sellers", url: "/sellers", icon: Store },
  { title: "Veterinarians", url: "/vets", icon: Stethoscope },
];
const marketplace = [
  { title: "Product Marketplace", url: "/marketplace/products", icon: ShoppingBag },
  { title: "Cattle Marketplace", url: "/marketplace/cattle", icon: ShoppingBag },
  { title: "Best Sellers", url: "/marketplace/best-sellers", icon: Flame },
  { title: "Coupon Codes", url: "/marketplace/coupons", icon: Ticket },
];
const orders = [
  { title: "Product Orders", url: "/orders/products", icon: Package },
  { title: "Cattle Orders", url: "/orders/cattle", icon: Package },
  { title: "Order Invoices", url: "/invoices", icon: FileText },
];
const ops = [
  { title: "Payments", url: "/payments", icon: Wallet },
  { title: "Token Advance", url: "/token-advance", icon: Coins },
  { title: "Banners & Ads", url: "/banners", icon: Megaphone },
  { title: "Customer Issues", url: "/support", icon: LifeBuoy },
];
const system = [
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Storage", url: "/storage", icon: HardDrive },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];
const account = [
  { title: "Profile", url: "/profile", icon: UserCircle },
  { title: "Settings", url: "/settings", icon: Settings },
];


function Group({ label, items }: { label: string; items: typeof main }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((it) => {
            const active = it.url === "/dashboard" ? path === "/dashboard" : path.startsWith(it.url);
            return (
              <SidebarMenuItem key={it.url}>
                <SidebarMenuButton asChild isActive={active} tooltip={it.title}>
                  <Link to={it.url} className="flex items-center gap-3">
                    <it.icon className="h-4 w-4 shrink-0" />
                    <span>{it.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile } = useAuth();

  const displayName = profile?.name || "Admin User";
  const displayRole = profile?.role || "Admin";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-2">
          <img
            src="https://play-lh.googleusercontent.com/cfoVS1sVUQ7GcwUxpvEhDNghb5ax2l0_Z7TwA4ktRmMj2KytuT8Cd50ELbIwjl4UO5P9hAjmKHu535SOF-4Pufw=w480-h960-rw"
            alt="iHerd logo"
            className="h-9 w-auto shrink-0 object-contain"
          />
          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-base font-bold tracking-tight">iHerd</span>
              <span className="truncate text-xs text-muted-foreground">Admin console</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <Group label="Overview" items={main} />
        <Group label="People" items={people} />
        <Group label="Marketplace" items={marketplace} />
        <Group label="Order Management" items={orders} />
        <Group label="Operations" items={ops} />
        <Group label="System" items={system} />
        <Group label="Account" items={account} />
      </SidebarContent>
      <SidebarFooter className="border-t">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground text-xs font-semibold">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{displayName}</span>
              <span className="truncate text-xs text-muted-foreground">{displayRole}</span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
