import { createFileRoute } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useFirebaseCollection } from "../hooks/useFirebaseData";

import { getLocalizedText } from "@/lib/utils";

export const Route = createFileRoute("/marketplace/cattle")({
  head: () => ({ meta: [{ title: "Cattle marketplace — iHerd Admin" }] }),
  component: CattleMarketplacePage,
});

function CattleMarketplacePage() {
  const { data: listings = [], isLoading } = useFirebaseCollection<any>("cattle-marketplace");

  const pendingCount = listings.filter(l => (getLocalizedText(l.status) || "").toLowerCase() === "pending").length;
  const approvedCount = listings.filter(l => (getLocalizedText(l.status) || "").toLowerCase() === "approved" || !l.status).length;
  const rejectedCount = listings.filter(l => (getLocalizedText(l.status) || "").toLowerCase() === "rejected").length;

  return (
    <DataPage
      title="Cattle marketplace moderation"
      description="Review and approve cattle listings from the cattle-marketplace collection."
      primaryAction=""
      isLoading={isLoading}
      filters={["Approved", "Pending", "Rejected"]}
      statusKey="status"
      kpis={[
        { label: "Total listings", value: isLoading ? "…" : listings.length.toLocaleString() },
        { label: "Approved / Active", value: isLoading ? "…" : approvedCount.toLocaleString() },
        { label: "Pending review", value: isLoading ? "…" : pendingCount.toLocaleString() },
        { label: "Rejected", value: isLoading ? "…" : rejectedCount.toLocaleString() },
      ]}
      data={listings.map(l => ({
        ...l,
        status: getLocalizedText(l.status, "Approved"),
        title: getLocalizedText(l.title || l.breed || l.cattleType || l.name, "Cattle Listing"),
        seller: getLocalizedText(l.sellerName || l.sellerId || l.postedBy, "—"),
        price: l.price ? (typeof l.price === "number" ? `₹${l.price.toLocaleString()}` : String(l.price).startsWith("₹") ? l.price : `₹${getLocalizedText(l.price)}`) : "—",
        state: getLocalizedText(l.state || l.location || l.district, "—"),
      }))}
      columns={[
        { key: "id", label: "Listing ID", render: (r) => <span className="font-mono text-xs">{getLocalizedText(r.id)}</span> },
        { key: "title", label: "Animal / Breed", render: (r) => (
          <div className="flex items-center gap-2">
            {r.images?.[0] || r.imageUrl ? (
              <img src={r.images?.[0] || r.imageUrl} alt="" className="h-8 w-8 rounded-lg object-cover bg-muted" />
            ) : null}
            <span className="font-medium">{getLocalizedText(r.title)}</span>
          </div>
        )},
        { key: "seller", label: "Seller / Owner" },
        { key: "price", label: "Price", render: (r) => <span className="font-semibold">{getLocalizedText(r.price)}</span> },
        { key: "state", label: "Location" },
        { key: "status", label: "Status" },
        {
          key: "actions",
          label: "",
          render: (r) =>
            r.status === "Pending" ? (
              <div className="flex gap-1.5 justify-end">
                <Button size="sm" variant="outline" className="h-8 px-2 text-success border-success/30 hover:bg-success/10">
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" className="h-8 px-2 text-destructive border-destructive/30 hover:bg-destructive/10">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null,
          className: "text-right",
        },
      ]}
    />
  );
}
