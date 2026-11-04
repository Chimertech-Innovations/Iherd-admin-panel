import { type ReactNode, useState, useEffect, useMemo } from "react";
import {
  Bell,
  Search,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Settings as SettingsIcon,
  Home,
  Users,
  Landmark,
  Store,
  Stethoscope,
  Beef,
  ShoppingBag,
  PackageCheck,
  Ticket,
  MapPin,
  ExternalLink,
  Check,
  History,
} from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { AppSidebar } from "./AppSidebar";
import { NotificationBellPopover } from "./NotificationBellPopover";
import { useAuth } from "@/hooks/useAuth";

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const routerPath = useRouterState({
    select: (s) => s.location.pathname,
  });
  const { profile, logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [headerQuery, setHeaderQuery] = useState("");
  const [lastSelected, setLastSelected] = useState<{ path: string; label: string } | null>(() => {
    try {
      const stored = sessionStorage.getItem("iherd_last_selected_search");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate({ to: "/login" });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleHeaderSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && headerQuery.trim()) {
      navigate({ to: "/users" });
      setSearchOpen(false);
    }
  };

  const handleNavigate = (path: string, label: string) => {
    const item = { path, label };
    setLastSelected(item);
    try {
      sessionStorage.setItem("iherd_last_selected_search", JSON.stringify(item));
    } catch (e) {
      // ignore
    }
    setSearchOpen(false);
    navigate({ to: path as any });
  };

  const isItemActive = (path: string) => {
    return lastSelected?.path === path || routerPath === path;
  };

  const displayName = profile?.name || "Admin User";
  const displayEmail = profile?.email || "";
  const displayRole = profile?.role || "Admin";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/40">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
            <SidebarTrigger />
            <div className="relative hidden lg:block flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search farmers, sellers, cattle, orders... (Ctrl + K)"
                value={headerQuery}
                onChange={(e) => setHeaderQuery(e.target.value)}
                onKeyDown={handleHeaderSearchSubmit}
                onClick={() => setSearchOpen(true)}
                className="pl-9 pr-16 bg-muted/60 border-transparent focus-visible:bg-background cursor-pointer"
              />
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                aria-label="Search"
                onClick={() => setSearchOpen(true)}
                className="lg:hidden grid h-10 w-10 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition-colors"
              >
                <Search className="h-4.5 w-4.5 text-foreground/80" />
              </button>
              <NotificationBellPopover />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-xl bg-muted/60 hover:bg-muted transition-colors py-1.5 pl-1.5 pr-2.5"
                  >
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground text-xs font-semibold">
                      {initials}
                    </div>
                    <div className="hidden sm:block text-left leading-tight">
                      <div className="text-xs font-semibold text-foreground">{displayName}</div>
                      <div className="text-[10px] text-muted-foreground">{displayRole}</div>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>
                    <div className="text-sm font-medium">{displayName}</div>
                    <div className="text-xs text-muted-foreground">{displayEmail}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                    <UserIcon className="mr-2 h-4 w-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                    <SettingsIcon className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>

      {/* Global Quick Search & Command Dialog */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Type a search query or jump to a section..." />
        <CommandList>
          <CommandEmpty>No matching records or pages found.</CommandEmpty>

          {lastSelected && (
            <>
              <CommandGroup heading="Previously Selected">
                <CommandItem
                  onSelect={() => handleNavigate(lastSelected.path, lastSelected.label)}
                  className="bg-primary/10 text-primary font-semibold border border-primary/20 cursor-pointer"
                >
                  <History className="mr-2 h-4 w-4 text-primary" />
                  <span>{lastSelected.label}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] bg-primary/20 text-primary border-primary/30 flex items-center gap-1 font-bold">
                    <Check className="h-3 w-3" /> Selected
                  </Badge>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Quick Record Search">
            <CommandItem
              onSelect={() => handleNavigate("/users", "Farmers & Users Directory")}
              className={cn("cursor-pointer", isItemActive("/users") && "bg-primary/10 text-primary font-bold dark:bg-primary/20")}
            >
              <Users className="mr-2 h-4 w-4 text-primary" />
              <span>Search in Farmers & Users Directory</span>
              {isItemActive("/users") && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </CommandItem>
            <CommandItem
              onSelect={() => handleNavigate("/orders/products", "Product Orders")}
              className={cn("cursor-pointer", isItemActive("/orders/products") && "bg-primary/10 text-primary font-bold dark:bg-primary/20")}
            >
              <PackageCheck className="mr-2 h-4 w-4 text-primary" />
              <span>Search in Product Orders</span>
              {isItemActive("/orders/products") && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </CommandItem>
            <CommandItem
              onSelect={() => handleNavigate("/marketplace/cattle", "Cattle Marketplace")}
              className={cn("cursor-pointer", isItemActive("/marketplace/cattle") && "bg-primary/10 text-primary font-bold dark:bg-primary/20")}
            >
              <Beef className="mr-2 h-4 w-4 text-primary" />
              <span>Search in Cattle Marketplace</span>
              {isItemActive("/marketplace/cattle") && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </CommandItem>
            <CommandItem
              onSelect={() => handleNavigate("/marketplace/products", "Products Catalog")}
              className={cn("cursor-pointer", isItemActive("/marketplace/products") && "bg-primary/10 text-primary font-bold dark:bg-primary/20")}
            >
              <ShoppingBag className="mr-2 h-4 w-4 text-primary" />
              <span>Search in Products Catalog</span>
              {isItemActive("/marketplace/products") && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Platform Navigation">
            <CommandItem
              onSelect={() => handleNavigate("/dashboard", "Dashboard & Analytics")}
              className={cn("cursor-pointer", isItemActive("/dashboard") && "bg-primary/10 text-primary font-bold dark:bg-primary/20")}
            >
              <Home className="mr-2 h-4 w-4" />
              <span>Dashboard & Analytics</span>
              {isItemActive("/dashboard") && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </CommandItem>
            <CommandItem
              onSelect={() => handleNavigate("/farmers", "Farmers & Milk Producers")}
              className={cn("cursor-pointer", isItemActive("/farmers") && "bg-primary/10 text-primary font-bold dark:bg-primary/20")}
            >
              <Users className="mr-2 h-4 w-4" />
              <span>Farmers & Milk Producers</span>
              {isItemActive("/farmers") && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </CommandItem>
            <CommandItem
              onSelect={() => handleNavigate("/farms", "Registered Dairy Farms")}
              className={cn("cursor-pointer", isItemActive("/farms") && "bg-primary/10 text-primary font-bold dark:bg-primary/20")}
            >
              <Landmark className="mr-2 h-4 w-4" />
              <span>Registered Dairy Farms</span>
              {isItemActive("/farms") && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </CommandItem>
            <CommandItem
              onSelect={() => handleNavigate("/sellers", "Marketplace Sellers")}
              className={cn("cursor-pointer", isItemActive("/sellers") && "bg-primary/10 text-primary font-bold dark:bg-primary/20")}
            >
              <Store className="mr-2 h-4 w-4" />
              <span>Marketplace Sellers</span>
              {isItemActive("/sellers") && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </CommandItem>
            <CommandItem
              onSelect={() => handleNavigate("/vets", "Veterinarians & Doctors")}
              className={cn("cursor-pointer", isItemActive("/vets") && "bg-primary/10 text-primary font-bold dark:bg-primary/20")}
            >
              <Stethoscope className="mr-2 h-4 w-4" />
              <span>Veterinarians & Doctors</span>
              {isItemActive("/vets") && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </CommandItem>
            <CommandItem
              onSelect={() => handleNavigate("/orders/products", "Product Orders")}
              className={cn("cursor-pointer", isItemActive("/orders/products") && "bg-primary/10 text-primary font-bold dark:bg-primary/20")}
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              <span>Product Orders</span>
              {isItemActive("/orders/products") && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </CommandItem>
            <CommandItem
              onSelect={() => handleNavigate("/orders/cattle", "Cattle Token Orders")}
              className={cn("cursor-pointer", isItemActive("/orders/cattle") && "bg-primary/10 text-primary font-bold dark:bg-primary/20")}
            >
              <Beef className="mr-2 h-4 w-4" />
              <span>Cattle Token Orders</span>
              {isItemActive("/orders/cattle") && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </CommandItem>
            <CommandItem
              onSelect={() => handleNavigate("/marketplace/coupons", "Coupons & Offers")}
              className={cn("cursor-pointer", isItemActive("/marketplace/coupons") && "bg-primary/10 text-primary font-bold dark:bg-primary/20")}
            >
              <Ticket className="mr-2 h-4 w-4" />
              <span>Coupons & Offers</span>
              {isItemActive("/marketplace/coupons") && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </CommandItem>
            <CommandItem
              onSelect={() => handleNavigate("/map", "GIS Interactive Map")}
              className={cn("cursor-pointer", isItemActive("/map") && "bg-primary/10 text-primary font-bold dark:bg-primary/20")}
            >
              <MapPin className="mr-2 h-4 w-4" />
              <span>GIS Interactive Map</span>
              {isItemActive("/map") && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </SidebarProvider>
  );
}
