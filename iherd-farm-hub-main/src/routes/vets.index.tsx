import { createFileRoute, Link } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { Stethoscope, Phone } from "lucide-react";
import { useVerifiedDirectory } from "@/hooks/useVerifiedDirectory";

export const Route = createFileRoute("/vets/")({
  head: () => ({ meta: [{ title: "Veterinarians — iHerd Admin" }] }),
  component: VetsPage,
});

function VetsPage() {
  const { vets, isLoading } = useVerifiedDirectory();

  const totalVets = vets.length;

  return (
    <div className="space-y-6">
      <DataPage
        title="Veterinarian Management"
        description="Approve certifications, qualifications, and manage veterinary doctors across iHerd."
        isLoading={isLoading}
        searchPlaceholder="Search doctors by name, clinic, phone, or location..."
        searchKeys={["name", "clinic", "phone", "qualification", "city", "state"]}
        filters={["Pending Verification", "Inactive"]}
        statusKey="status"
        kpis={[
          { label: "Total Doctors", value: isLoading ? "…" : totalVets.toLocaleString(), change: "Registered practitioners", up: true }
        ]}
        data={vets}
        rowHref={(row) => `/users/${row.id}`}
        columns={[
          {
            key: "name",
            label: "Doctor Name",
            render: (row) => (
              <Link
                to="/users/$userId"
                params={{ userId: row.id }}
                className="flex items-center gap-3 min-w-0 group"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-600 font-bold text-xs border border-blue-500/20 group-hover:scale-105 transition-transform">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                    {row.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                    <span>{row.qualification}</span>
                    {row.experience !== "—" && (
                      <>
                        <span>•</span>
                        <span>{row.experience}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ),
          },
          {
            key: "phone",
            label: "Contact Phone",
            render: (row) => (
              <div className="flex items-center gap-1 text-xs font-medium">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{row.phone || "—"}</span>
              </div>
            ),
          },
          {
            key: "clinic",
            label: "Clinic / Institution",
            render: (row) => (
              <div className="text-xs text-foreground max-w-[200px] truncate">
                {row.clinic}
              </div>
            ),
          },
          {
            key: "location",
            label: "Location",
            render: (row) => (
              <span className="text-xs text-muted-foreground">
                {row.city !== "—" ? `${row.city}, ${row.state}` : row.state || "—"}
              </span>
            ),
          },
          {
            key: "joined",
            label: "Joined Date",
            render: (row) => <span className="text-xs text-muted-foreground">{row.joined}</span>,
          },
        ]}
      />
    </div>
  );
}
