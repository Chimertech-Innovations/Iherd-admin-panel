import { createFileRoute, Link } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { User, MapPin, Phone, Building, ExternalLink } from "lucide-react";
import { useVerifiedDirectory } from "@/hooks/useVerifiedDirectory";

export const Route = createFileRoute("/farmers/")({
  head: () => ({ meta: [{ title: "Farmers Directory — iHerd Admin" }] }),
  component: FarmersPage,
});

function FarmersPage() {
  const { farmers: allFarmers, isLoading } = useVerifiedDirectory();

  const totalFarmers = allFarmers.length;
  const activeFarmers = allFarmers.filter((f) => f.status.toLowerCase() === "active" || !f.status).length;
  const farmersWithFarms = allFarmers.filter((f) => f.hasFarm).length;
  const farmersWithCattle = allFarmers.filter((f) => f.cattleCount > 0).length;

  return (
    <div className="space-y-6">
      <DataPage
        title="Farmers Directory"
        description="All registered farmers, contact info, locations, and linked farm and livestock records."
        exportFilename="iherd_farmers_directory"
        isLoading={isLoading}
        rowHref={(r) => `/users/${r.uid}?tab=farmer`}
        customExportColumns={[
          { header: "Farmer Name", accessor: "name" },
          { header: "Farmer UID", accessor: "uid" },
          { header: "Phone Number", accessor: "phone" },
          { header: "Village", accessor: "village" },
          { header: "District", accessor: "district" },
          { header: "State", accessor: "state" },
          { header: "Registered Farm Name", accessor: (r) => r.registeredFarmName || "None" },
          { header: "Tracked Cattle Count", accessor: "cattleCount" },
          { header: "Registration Date", accessor: "joined" },
          { header: "Status", accessor: "status" },
        ]}
        stats={[
          {
            label: "Total Registered Farmers",
            value: isLoading ? "…" : String(totalFarmers),
            change: `${activeFarmers} registered farmers`,
            up: true,
          },
          {
            label: "Farmers with Registered Farms",
            value: isLoading ? "…" : String(farmersWithFarms),
            change: "Have registered farms",
            up: true,
          },
          {
            label: "Farmers with Cattle",
            value: isLoading ? "…" : String(farmersWithCattle),
            change: "Have livestock tracked",
            up: true,
          },
          {
            label: "Verification Rate",
            value: isLoading ? "…" : (totalFarmers > 0 ? `${Math.round((activeFarmers / totalFarmers) * 100)}%` : "0%"),
            change: "Verified accounts",
            up: true,
          },
        ]}
        searchKeys={["name", "phone", "village", "district", "state", "registeredFarmName"]}
        searchPlaceholder="Search farmers by name, phone, village, or state..."
        data={allFarmers}
        columns={[
          {
            key: "name",
            label: "Farmer Profile",
            render: (r) => (
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                  <User className="h-4 w-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <Link
                    to="/users/$userId"
                    params={{ userId: r.uid }}
                    search={{ tab: "farmer" } as any}
                    className="font-bold text-xs text-foreground hover:text-primary transition-colors truncate block"
                  >
                    {r.name}
                  </Link>
                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                    UID: {r.uid}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "phone",
            label: "Contact",
            render: (r) => (
              <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                <Phone className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                <span>{r.phone || "—"}</span>
              </div>
            ),
          },
          {
            key: "village",
            label: "Location",
            render: (r) => {
              const parts = [r.village, r.district, r.state].filter((x) => x && x !== "—");
              return (
                <div className="space-y-0.5 max-w-[200px]">
                  <div className="flex items-center gap-1 text-xs text-foreground font-medium truncate">
                    <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                    <span className="truncate">{r.village || "—"}</span>
                  </div>
                  {parts.length > 1 && (
                    <div className="text-[11px] text-muted-foreground pl-4 truncate">
                      {[r.district, r.state].filter((x) => x && x !== "—").join(", ") || r.state || "—"}
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            key: "registeredFarmName",
            label: "Registered Farm",
            render: (r) =>
              r.registeredFarmName ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground max-w-[180px] truncate">
                  <Building className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{r.registeredFarmName}</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">No Farm Registered</span>
              ),
          },
          {
            key: "cattleCount",
            label: "Livestock Count",
            render: (r) => (
              <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                <span className={r.cattleCount > 0 ? "text-primary font-bold" : "text-muted-foreground"}>
                  {r.cattleCount}
                </span>
                <span className="text-muted-foreground text-[11px] font-normal">Tracked</span>
              </div>
            ),
          },
          {
            key: "joined",
            label: "Joined Date",
            render: (r) => (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {r.joined}
              </span>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            align: "right",
            render: (r) => (
              <Link
                to="/users/$userId"
                params={{ userId: r.uid }}
                search={{ tab: "farmer" } as any}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary hover:text-primary-foreground hover:bg-primary rounded-lg transition-colors border border-primary/20"
              >
                <span>View Profile</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
