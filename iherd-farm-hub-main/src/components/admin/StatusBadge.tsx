import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  active: "bg-success/15 text-success border-success/20",
  approved: "bg-success/15 text-success border-success/20",
  paid: "bg-success/15 text-success border-success/20",
  completed: "bg-success/15 text-success border-success/20",
  online: "bg-success/15 text-success border-success/20",
  pending: "bg-warning/15 text-warning-foreground border-warning/30",
  inreview: "bg-warning/15 text-warning-foreground border-warning/30",
  processing: "bg-info/15 text-info border-info/20",
  scheduled: "bg-info/15 text-info border-info/20",
  shipped: "bg-info/15 text-info border-info/20",
  ongoing: "bg-info/15 text-info border-info/20",
  open: "bg-info/15 text-info border-info/20",
  rejected: "bg-destructive/15 text-destructive border-destructive/20",
  cancelled: "bg-destructive/15 text-destructive border-destructive/20",
  failed: "bg-destructive/15 text-destructive border-destructive/20",
  suspended: "bg-destructive/15 text-destructive border-destructive/20",
  closed: "bg-muted text-muted-foreground border-border",
  offline: "bg-muted text-muted-foreground border-border",
  draft: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status }: { status?: any }) {
  const label = typeof status === "string" ? status : status ? String(status) : "Active";
  const key = label.toLowerCase().replace(/[\s_-]+/g, "");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        styles[key] ?? "bg-muted text-muted-foreground border-border"
      )}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
