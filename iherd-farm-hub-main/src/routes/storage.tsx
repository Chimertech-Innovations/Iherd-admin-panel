import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/admin/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Image,
  FileText,
  ShoppingBag,
  User,
  Search,
  Download,
  ExternalLink,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/csvExport";

import { getApiBaseUrl } from "@/lib/apiClient";

export const Route = createFileRoute("/storage")({
  head: () => ({ meta: [{ title: "Storage — iHerd Admin" }] }),
  component: StoragePage,
});

async function fetchStorage() {
  const apiBase = await getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/admin/storage`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileLabel(name: string) {
  return name.split("/").pop() || name;
}

function isImage(contentType: string) {
  return contentType.startsWith("image/");
}

interface StorageFile {
  name: string;
  size: number;
  contentType: string;
  updated: string | null;
  url: string;
}

function FileGrid({ files, query }: { files: StorageFile[]; query: string }) {
  const filtered = useMemo(
    () => files.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    [files, query],
  );

  if (filtered.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        {files.length === 0 ? "No files found in this storage path." : "No files match your search."}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
      {filtered.map((f, i) => (
        <Card key={i} className="rounded-xl overflow-hidden p-0 group hover:shadow-md transition-shadow">
          {/* Preview */}
          <div className="relative h-28 bg-muted flex items-center justify-center overflow-hidden">
            {isImage(f.contentType) ? (
              <img
                src={f.url}
                alt={fileLabel(f.name)}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <FileText className="h-10 w-10 text-muted-foreground" />
            )}
            {/* Hover actions */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="grid h-8 w-8 place-items-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                title="Open"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={f.url}
                download={fileLabel(f.name)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>
            </div>
          </div>
          {/* Meta */}
          <div className="p-2">
            <div className="text-xs font-medium truncate" title={fileLabel(f.name)}>
              {fileLabel(f.name)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{formatBytes(f.size)}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function StoragePage() {
  const [query, setQuery] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["adminStorage"],
    queryFn: fetchStorage,
    staleTime: 30_000,
  });

  const totals = data?.totals ?? { userImages: 0, invoices: 0, cattleMarketplace: 0, marketplace: 0, total: 0 };

  const kpis = [
    { label: "User Images", value: totals.userImages, icon: User, tint: "bg-primary/10 text-primary" },
    { label: "Invoices", value: totals.invoices, icon: FileText, tint: "bg-info/10 text-info" },
    { label: "Cattle Media", value: totals.cattleMarketplace, icon: Image, tint: "bg-success/10 text-success" },
    { label: "Marketplace Media", value: totals.marketplace, icon: ShoppingBag, tint: "bg-warning/10 text-warning-foreground" },
  ];

  const allStorageFiles: StorageFile[] = [
    ...(data?.userImages ?? []),
    ...(data?.invoices ?? []),
    ...(data?.cattleMarketplace ?? []),
    ...(data?.marketplace ?? []),
  ];

  const handleExportStorage = () => {
    exportToCsv({
      filename: `iherd_storage_files_${new Date().toISOString().slice(0, 10)}`,
      data: allStorageFiles,
      columns: [
        { header: "File Name", accessor: (f: StorageFile) => fileLabel(f.name) },
        { header: "Storage Path", accessor: "name" },
        { header: "Content Type", accessor: "contentType" },
        { header: "File Size", accessor: (f: StorageFile) => formatBytes(f.size) },
        { header: "Last Updated", accessor: (f: StorageFile) => f.updated ? new Date(f.updated).toLocaleString() : "—" },
        { header: "Download URL", accessor: "url" },
      ],
    });
  };

  return (
    <div>
      <PageHeader
        title="Storage"
        description="All files stored in Firebase Storage across UserImages, invoices, cattle-marketplace and marketplace paths."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportStorage}
              disabled={isLoading || allStorageFiles.length === 0}
              className="gap-1.5"
              title={`Export ${allStorageFiles.length} storage file references to CSV`}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HardDrive className="h-4 w-4" />
              {isLoading ? "Loading…" : `${totals.total} total files`}
            </div>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${k.tint}`}>
                <k.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{k.label}</div>
                <div className="text-xl font-semibold tracking-tight">
                  {isLoading ? "…" : k.value}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files by name…"
          className="pl-9"
        />
      </div>

      {error || data?.error ? (
        <Card className="p-8 rounded-2xl border-destructive/20 bg-destructive/5 text-center">
          <p className="text-destructive font-semibold text-base">Storage Access Restricted</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            {data?.error?.message || String(error)}
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            💡 To enable Storage viewing: in Firebase/Google Cloud IAM, ensure your Service Account has the <strong>Storage Admin</strong> or <strong>Storage Object Viewer</strong> role.
          </p>
        </Card>
      ) : (
        <Tabs defaultValue="userImages">
          <TabsList className="mb-5">
            <TabsTrigger value="userImages">
              User Images {!isLoading && `(${totals.userImages})`}
            </TabsTrigger>
            <TabsTrigger value="cattleMarketplace">
              Cattle Media {!isLoading && `(${totals.cattleMarketplace})`}
            </TabsTrigger>
            <TabsTrigger value="marketplace">
              Marketplace Media {!isLoading && `(${totals.marketplace})`}
            </TabsTrigger>
            <TabsTrigger value="invoices">
              Invoices {!isLoading && `(${totals.invoices})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="userImages">
            {isLoading ? <LoadingSkeleton /> : <FileGrid files={data?.userImages ?? []} query={query} />}
          </TabsContent>
          <TabsContent value="cattleMarketplace">
            {isLoading ? <LoadingSkeleton /> : <FileGrid files={data?.cattleMarketplace ?? []} query={query} />}
          </TabsContent>
          <TabsContent value="marketplace">
            {isLoading ? <LoadingSkeleton /> : <FileGrid files={data?.marketplace ?? []} query={query} />}
          </TabsContent>
          <TabsContent value="invoices">
            {isLoading ? <LoadingSkeleton /> : <FileGrid files={data?.invoices ?? []} query={query} />}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <Card key={i} className="rounded-xl overflow-hidden p-0 animate-pulse">
          <div className="h-28 bg-muted" />
          <div className="p-2 space-y-1.5">
            <div className="h-3 bg-muted rounded w-3/4" />
            <div className="h-2.5 bg-muted rounded w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  );
}
