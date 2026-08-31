import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Filter, Plus, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "./PageHeader";
import { StatusBadge } from "./StatusBadge";

import { getLocalizedText } from "@/lib/utils";

import { exportToCsv, type CsvColumn } from "@/lib/csvExport";

export type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
  exportValue?: (row: T) => any;
};

export type KPI = {
  label: string;
  value: string | number;
  hint?: string;
  change?: string;
  up?: boolean;
};

export function DataPage<T extends Record<string, any>>({
  title,
  description,
  data,
  columns,
  statusKey = "status",
  filters = [],
  statusOptions,
  kpis,
  stats,
  searchPlaceholder = "Search...",
  searchKeys,
  primaryAction = "Add new",
  onPrimaryAction,
  rowHref,
  isLoading = false,
  exportFilename,
  onExport,
  customExportColumns,
}: {
  title: string;
  description?: string;
  data: T[];
  columns: Column<T>[];
  statusKey?: string;
  filters?: string[];
  statusOptions?: string[];
  kpis?: KPI[];
  stats?: KPI[];
  searchPlaceholder?: string;
  searchKeys?: string[];
  primaryAction?: ReactNode;
  onPrimaryAction?: () => void;
  rowHref?: (row: T) => string | undefined;
  isLoading?: boolean;
  exportFilename?: string;
  onExport?: (exportData: T[]) => void;
  customExportColumns?: CsvColumn<T>[];
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const effectiveKpis = kpis || stats;
  const effectiveFilters = (statusOptions && statusOptions.length > 0) ? statusOptions : filters;

  const filtered = useMemo(() => {
    return data.filter((row) => {
      const matchQ = q
        ? (searchKeys && searchKeys.length > 0
            ? searchKeys.some((k) => getLocalizedText(row[k]).toLowerCase().includes(q.toLowerCase()))
            : Object.values(row).some((v) =>
                getLocalizedText(v).toLowerCase().includes(q.toLowerCase())
              ))
        : true;
      const rowStatus = getLocalizedText(row[statusKey]).toLowerCase();
      const matchF = filter === "all" ? true : rowStatus === filter.toLowerCase();
      return matchQ && matchF;
    });
  }, [data, q, filter, statusKey, searchKeys]);

  const handleExport = () => {
    if (onExport) {
      onExport(filtered.length > 0 ? filtered : data);
      return;
    }

    const filename = exportFilename || title.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const exportCols: CsvColumn<T>[] = customExportColumns || columns
      .filter((c) => c.key !== "actions" && c.label !== "Actions")
      .map((c) => ({
        header: c.label,
        key: String(c.key),
        accessor: c.exportValue || ((row: T) => {
          if (c.key in row) return row[c.key as keyof T];
          return "";
        }),
      }));

    exportToCsv({
      filename: `${filename}_${new Date().toISOString().slice(0, 10)}`,
      data: filtered.length > 0 ? filtered : data,
      columns: exportCols,
    });
  };

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExport}
              disabled={isLoading || data.length === 0}
              title={`Export ${filtered.length} rows as CSV`}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            {typeof primaryAction === "string" ? (
              <Button size="sm" onClick={onPrimaryAction} className="gap-1.5 bg-gradient-to-br from-primary to-primary-glow">
                <Plus className="h-4 w-4" /> {primaryAction}
              </Button>
            ) : (
              primaryAction
            )}
          </>
        }
      />

      {effectiveKpis && effectiveKpis.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {effectiveKpis.map((k) => (
            <Card key={k.label} className="p-4 rounded-2xl relative overflow-hidden">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {k.label}
              </div>
              {isLoading ? (
                <div className="h-8 w-24 bg-muted/70 rounded-lg mt-2 animate-pulse" />
              ) : (
                <div className="mt-1 text-2xl font-bold text-foreground">{k.value}</div>
              )}
              {(k.hint || k.change) && (
                <div className={`text-xs mt-1 ${k.change ? (k.up ? 'text-emerald-500 font-medium' : 'text-muted-foreground') : 'text-muted-foreground'}`}>
                  {k.change || k.hint}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card className="rounded-2xl overflow-hidden relative">
        {/* Animated Loading Bar Indicator */}
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary/20 overflow-hidden z-20">
            <div className="h-full bg-primary animate-pulse w-full" />
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 border-b sm:flex sm:flex-wrap">
          <div className="relative min-w-0 sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
            {effectiveFilters.length > 0 && (
              <Select value={filter} onValueChange={setFilter} disabled={isLoading}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {effectiveFilters.map((f) => (
                    <SelectItem key={f} value={f.toLowerCase()}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {columns.map((c) => (
                  <TableHead key={String(c.key)} className={c.className}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // 5 Shimmer Skeleton Rows
                Array.from({ length: 6 }).map((_, rIdx) => (
                  <TableRow key={rIdx} className="animate-pulse">
                    {columns.map((c, cIdx) => (
                      <TableCell key={cIdx} className={c.className}>
                        <div
                          className="h-5 bg-muted/60 rounded-md animate-pulse"
                          style={{
                            width: `${Math.max(40, 85 - (cIdx * 12 + rIdx * 7) % 45)}%`,
                          }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length > 0 ? (
                filtered.map((row, i) => {
                  const href = rowHref?.(row);
                  return (
                    <TableRow
                      key={i}
                      className={href ? "cursor-pointer" : ""}
                      onClick={
                        href
                          ? (e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest("a,button,input,select,[role=button]")) return;
                              navigate({ to: href });
                            }
                          : undefined
                      }
                    >
                      {columns.map((c) => (
                        <TableCell key={String(c.key)} className={c.className}>
                          {c.render
                            ? c.render(row)
                            : c.key === statusKey
                            ? <StatusBadge status={getLocalizedText(row[c.key])} />
                            : getLocalizedText(row[c.key as keyof T])}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center text-muted-foreground py-12"
                  >
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <span className="text-sm font-medium">No results found</span>
                      <span className="text-xs text-muted-foreground">Try adjusting your search or filters</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t p-4 text-sm text-muted-foreground">
          <span>
            {isLoading ? (
              <span className="inline-flex items-center gap-2 text-xs font-medium text-primary">
                <span className="h-2 w-2 rounded-full bg-primary animate-ping" /> Loading live data...
              </span>
            ) : (
              <>
                Showing <b className="text-foreground">{filtered.length}</b> of{" "}
                <b className="text-foreground">{data.length}</b>
              </>
            )}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={isLoading || filtered.length === 0}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={isLoading || filtered.length === 0}>
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
