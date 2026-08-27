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

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — iHerd Admin" }] }),
  component: Reports,
});

const growth = [
  { m: "Jan", farmers: 8200, sellers: 220 },
  { m: "Feb", farmers: 8740, sellers: 234 },
  { m: "Mar", farmers: 9320, sellers: 248 },
  { m: "Apr", farmers: 9810, sellers: 261 },
  { m: "May", farmers: 10420, sellers: 274 },
  { m: "Jun", farmers: 11080, sellers: 289 },
  { m: "Jul", farmers: 11620, sellers: 302 },
  { m: "Aug", farmers: 12486, sellers: 318 },
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
  "Monthly revenue summary",
  "Seller performance report",
  "Marketplace moderation log",
  "Payout reconciliation",
  "Cattle listings audit",
];

function Reports() {
  return (
    <div>
      <PageHeader
        title="Reports & analytics"
        description=""
        actions={
          <Button size="sm" className="gap-1.5 bg-gradient-to-br from-primary to-primary-glow">
            <Download className="h-4 w-4" /> Export all
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card className="p-5 rounded-2xl">
          <h3 className="font-semibold">Platform growth</h3>
          <p className="text-xs text-muted-foreground mb-3">Farmers and vets over time</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="farmers" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="vets" stroke="var(--color-chart-2)" strokeWidth={2.5} dot={{ r: 3 }} />
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
            <li key={r} className="flex items-center gap-3 py-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{r}</div>
                <div className="text-xs text-muted-foreground">Generated weekly · last updated 2 days ago</div>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Download className="h-4 w-4" /> CSV
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
