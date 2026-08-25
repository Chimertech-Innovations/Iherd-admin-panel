import { createFileRoute } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { useFirebaseCollection } from "../hooks/useFirebaseData";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "Customer Issues — iHerd Admin" }] }),
  component: SupportPage,
});

function SupportPage() {
  const { data: issues = [], isLoading } = useFirebaseCollection<any>("issues");

  const open = issues.filter((i: any) => (i.status || "").toLowerCase() === "open").length;
  const pending = issues.filter((i: any) => (i.status || "").toLowerCase() === "pending").length;
  const closed = issues.filter((i: any) => (i.status || "").toLowerCase() === "closed").length;

  return (
    <DataPage
      title="Customer issues"
      description="Customer issues queue across farmers and sellers from Firestore."
      primaryAction=""
      isLoading={isLoading}
      filters={["Open", "Pending", "Closed"]}
      statusKey="status"
      kpis={[
        { label: "Total tickets", value: isLoading ? "…" : issues.length.toLocaleString() },
        { label: "Open", value: isLoading ? "…" : open.toLocaleString() },
        { label: "Pending", value: isLoading ? "…" : pending.toLocaleString() },
        { label: "Closed", value: isLoading ? "…" : closed.toLocaleString() },
      ]}
      data={issues}
      columns={[
        { key: "id", label: "Ticket", render: (r) => <span className="font-mono text-xs">{r.id || r.ticketId || "—"}</span> },
        { key: "from", label: "From", render: (r) => <span>{r.from || r.userName || r.userId || r.name || "—"}</span> },
        { key: "subject", label: "Subject", render: (r) => <span>{r.subject || r.title || r.description || "—"}</span> },
        {
          key: "priority",
          label: "Priority",
          render: (r) => {
            const p = r.priority || "—";
            const c =
              p === "High" ? "bg-destructive/15 text-destructive"
              : p === "Medium" ? "bg-warning/15 text-warning-foreground"
              : "bg-muted text-muted-foreground";
            return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${c}`}>{p}</span>;
          },
        },
        { key: "agent", label: "Agent", render: (r) => <span>{r.agent || r.assignedTo || "—"}</span> },
        { key: "updatedAt", label: "Updated", render: (r) => {
          const d = r.updatedAt?.seconds ? new Date(r.updatedAt.seconds * 1000) : r.updatedAt ? new Date(r.updatedAt) : null;
          return <span className="text-xs">{d ? d.toLocaleString() : (r.updated || "—")}</span>;
        }},
        { key: "status", label: "Status" },
      ]}
    />
  );
}
