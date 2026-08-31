import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { FileText, Download } from "lucide-react";
import { exportToCsv } from "@/lib/csvExport";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — iHerd Admin" }] }),
  component: Reports,
});

const growth = [
  { m: "Jan", farmers: 8200, sellers: 220, vets: 45 },
  { m: "Feb", farmers: 8740, sellers: 234, vets: 52 },
  { m: "Mar", farmers: 9320, sellers: 248, vets: 61 },
  { m: "Apr", farmers: 9810, sellers: 261, vets: 70 },
  { m: "May", farmers: 10420, sellers: 274, vets: 82 },
  { m: "Jun", farmers: 11080, sellers: 289, vets: 94 },
  { m: "Jul", farmers: 11620, sellers: 302, vets: 108 },
  { m: "Aug", farmers: 12486, sellers: 318, vets: 125 },
];

const region = [
  { r: "Gujarat", v: 184 },
  { r: "UP", v: 142 },
  { r: "Punjab", v: 128 },
  { r: "Karnataka", v: 118 },
  { r: "Maharashtra", v: 102 },
  { r: "Kerala", v: 84 },
];

const reports = [
  { id: "rev", name: "Monthly revenue summary", desc: "Aggregated platform commission & marketplace volume" },
  { id: "seller", name: "Seller performance report", desc: "Top vendors, fulfillments & fulfillment ratings" },
  { id: "mod", name: "Marketplace moderation log", desc: "Flagged listings, approved items & audit logs" },
  { id: "payout", name: "Payout reconciliation", desc: "Settlements, bank transfers & pending dues" },
  { id: "cattle", name: "Cattle listings audit", desc: "RFID tags, veterinary verifications & traded cattle" },
];

function Reports() {
  const handleExportAll = () => {
    exportToCsv({
      filename: `iherd_platform_reports_${new Date().toISOString().slice(0, 10)}`,
      data: growth,
      columns: [
        { header: "Month", accessor: "m" },
        { header: "Registered Farmers", accessor: "farmers" },
        { header: "Registered Sellers", accessor: "sellers" },
        { header: "Verified Veterinarians", accessor: "vets" },
      ],
    });
  };

  const handleExportReport = (r: typeof reports[0]) => {
    if (r.id === "rev") {
      exportToCsv({
        filename: `monthly_revenue_summary_${new Date().toISOString().slice(0, 10)}`,
        data: [
          { month: "Aug 2026", grossGMV: 4850000, netCommission: 242500, orders: 1420, activeFarmers: 12486 },
          { month: "Jul 2026", grossGMV: 4320000, netCommission: 216000, orders: 1280, activeFarmers: 11620 },
          { month: "Jun 2026", grossGMV: 3950000, netCommission: 197500, orders: 1150, activeFarmers: 11080 },
          { month: "May 2026", grossGMV: 3600000, netCommission: 180000, orders: 1020, activeFarmers: 10420 },
        ],
        columns: [
          { header: "Month", accessor: "month" },
          { header: "Gross GMV (INR)", accessor: "grossGMV" },
          { header: "Platform Commission (INR)", accessor: "netCommission" },
          { header: "Total Orders", accessor: "orders" },
          { header: "Active Farmers", accessor: "activeFarmers" },
        ],
      });
    } else if (r.id === "cattle") {
      exportToCsv({
        filename: `cattle_listings_audit_${new Date().toISOString().slice(0, 10)}`,
        data: region.map((reg) => ({
          region: reg.r,
          totalListings: reg.v * 12,
          verifiedCattle: Math.round(reg.v * 10.5),
          milkYieldAvg: "14.2 L/day",
        })),
        columns: [
          { header: "State / Region", accessor: "region" },
          { header: "Total Cattle Listed", accessor: "totalListings" },
          { header: "Verified RFID Tagged", accessor: "verifiedCattle" },
          { header: "Average Milk Yield", accessor: "milkYieldAvg" },
        ],
      });
    } else {
      exportToCsv({
        filename: `${r.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}`,
        data: region.map((reg, idx) => ({
          id: `REC-${1000 + idx}`,
          title: `${r.name} - ${reg.r}`,
          state: reg.r,
          volume: reg.v * 50,
          status: "Audited & Verified",
          generatedDate: new Date().toLocaleDateString(),
        })),
        columns: [
          { header: "Record ID", accessor: "id" },
          { header: "Report Title", accessor: "title" },
          { header: "Region / State", accessor: "state" },
          { header: "Volume / Metrics", accessor: "volume" },
          { header: "Status", accessor: "status" },
          { header: "Generated Date", accessor: "generatedDate" },
        ],
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Reports & analytics"
        description="Download platform metrics, monthly revenue trends, seller performances, and audit logs."
        actions={
          <Button onClick={handleExportAll} size="sm" className="gap-1.5 bg-gradient-to-br from-primary to-primary-glow font-medium shadow-sm">
            <Download className="h-4 w-4" /> Export All Summary
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card className="p-5 rounded-2xl">
          <h3 className="font-semibold">Platform growth</h3>
          <p className="text-xs text-muted-foreground mb-3">Farmers, sellers and vets over time</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="farmers" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="sellers" stroke="var(--color-chart-2)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5 rounded-2xl">
          <h3 className="font-semibold">New farmers by region</h3>
          <p className="text-xs text-muted-foreground mb-3">Last 30 days</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={region} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis dataKey="r" type="category" stroke="var(--color-muted-foreground)" fontSize={12} width={90} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                <Bar dataKey="v" fill="var(--color-primary)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5 rounded-2xl">
        <h3 className="font-semibold mb-3">Saved Reports Details</h3>
        <ul className="divide-y">
          {reports.map((r) => (
            <li key={r.name} className="flex items-center gap-3 py-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.desc} · Generated weekly</div>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleExportReport(r)}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
