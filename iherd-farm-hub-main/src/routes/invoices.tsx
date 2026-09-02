import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { storage } from "@/lib/firebase";
import { ref, listAll, getMetadata, getDownloadURL } from "firebase/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/PageHeader";
import { FileText, Download, Eye, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csvExport";
import { getApiBaseUrlSync } from "@/lib/apiClient";

export const Route = createFileRoute("/invoices")({
  head: () => ({ meta: [{ title: "Invoices — iHerd Admin" }] }),
  component: InvoicesPage,
});



interface InvoiceItem {
  name: string;
  url: string;
  size: string;
  updated: string;
  path: string;
}

function formatBytes(bytes: number, decimals = 2) {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    const isMockKey = !import.meta.env.VITE_FIREBASE_API_KEY || 
                      import.meta.env.VITE_FIREBASE_API_KEY === "mock-api-key" || 
                      import.meta.env.VITE_FIREBASE_API_KEY.includes("YOUR_ACTUAL");

    if (isMockKey) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    try {
      const invoicesRef = ref(storage, "invoices");
      const res = await listAll(invoicesRef);
      
      const allItems: InvoiceItem[] = [];

      // 1. Direct files inside /invoices
      const directItems = await Promise.all(
        res.items.map(async (itemRef) => {
          const url = await getDownloadURL(itemRef);
          const meta = await getMetadata(itemRef);
          return {
            name: itemRef.name,
            url,
            size: formatBytes(meta.size),
            updated: meta.updated,
            path: itemRef.fullPath,
          };
        })
      );
      allItems.push(...directItems);

      // 2. Files nested inside folder prefixes (like invoices/ORDER-1784875996158/)
      await Promise.all(
        res.prefixes.map(async (folderRef) => {
          try {
            const folderRes = await listAll(folderRef);
            const folderItems = await Promise.all(
              folderRes.items.map(async (itemRef) => {
                const url = await getDownloadURL(itemRef);
                const meta = await getMetadata(itemRef);
                return {
                  name: itemRef.name,
                  url,
                  size: formatBytes(meta.size),
                  updated: meta.updated,
                  path: itemRef.fullPath,
                };
              })
            );
            allItems.push(...folderItems);
          } catch (err) {
            console.error("Error listing folder files:", err);
          }
        })
      );
      
      setInvoices(allItems.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime()));
    } catch (error: any) {
      console.warn("Client Firebase Storage permission restricted, trying Admin Backend API fallback:", error);
      try {
        const apiBase = getApiBaseUrlSync();
        const res = await fetch(`${apiBase}/api/admin/storage`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.invoices)) {
            const formatted: InvoiceItem[] = data.invoices.map((inv: any) => ({
              name: inv.name.split("/").pop() || inv.name,
              url: inv.url,
              size: formatBytes(inv.size),
              updated: inv.updated || new Date().toISOString(),
              path: inv.name,
            }));
            setInvoices(formatted.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime()));
            return;
          }
        }
      } catch (backendErr) {
        console.error("Backend storage invoices fetch error:", backendErr);
      }
      toast.error("Failed to retrieve storage invoices.");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleOpenDetail = (inv: InvoiceItem) => {
    setSelectedInvoice(inv);
    setDetailOpen(true);
  };

  const filteredInvoices = invoices.filter((inv) =>
    inv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportInvoices = () => {
    const dataToExport = filteredInvoices.length > 0 ? filteredInvoices : invoices;
    exportToCsv({
      filename: `iherd_invoices_${new Date().toISOString().slice(0, 10)}`,
      data: dataToExport,
      columns: [
        { header: "Invoice File Name", accessor: "name" },
        { header: "Storage Path", accessor: "path" },
        { header: "File Size", accessor: "size" },
        { header: "Uploaded / Updated Date", accessor: (inv: any) => new Date(inv.updated).toLocaleString() },
        { header: "Download URL", accessor: "url" },
      ],
    });
  };

  return (
    <div>
      <PageHeader
        title="Order Invoices"
        description="Generated PDF invoices stored in Firebase Storage"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportInvoices}
              disabled={loading || invoices.length === 0}
              className="gap-1.5"
              title={`Export ${filteredInvoices.length} invoices to CSV`}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={fetchInvoices} className="gap-1.5" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        }
      />

      <Card className="rounded-2xl overflow-hidden p-4 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice files..."
              className="pl-9"
            />
            <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Listing files from Firebase Storage...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center text-muted-foreground py-20">
            No invoices found in storage.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-medium">
                  <th className="p-4">File Name</th>
                  <th className="p-4">Storage Path</th>
                  <th className="p-4">Size</th>
                  <th className="p-4">Uploaded At</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.name} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium flex items-center gap-2">
                      <FileText className="h-4.5 w-4.5 text-primary" />
                      {inv.name}
                    </td>
                    <td className="p-4 text-muted-foreground text-xs font-mono">{inv.path}</td>
                    <td className="p-4">{inv.size}</td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(inv.updated).toLocaleString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDetail(inv)}
                          className="gap-1.5"
                        >
                          <Eye className="h-3.5 w-3.5" /> View Details
                        </Button>
                        <Button
                          size="sm"
                          asChild
                          className="bg-gradient-to-br from-primary to-primary-glow"
                        >
                          <a href={inv.url} download={inv.name} className="gap-1.5 flex items-center">
                            <Download className="h-3.5 w-3.5" /> Download
                          </a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Invoice Detail Viewer Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl rounded-2xl p-6 overflow-y-auto max-h-[90vh]">
          {selectedInvoice && (
            <div className="space-y-4">
              <DialogHeader className="border-b pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary font-bold text-lg">
                    <FileText className="h-5 w-5" />
                    <span>{selectedInvoice.name}</span>
                  </div>
                </div>
                <DialogTitle className="mt-2 text-xl font-bold">Storage Invoice Viewer</DialogTitle>
                <DialogDescription>
                  File Path: {selectedInvoice.path} | Size: {selectedInvoice.size}
                </DialogDescription>
              </DialogHeader>

              {/* PDF Viewer Iframe */}
              <div className="border rounded-xl overflow-hidden bg-muted/20 h-[600px] w-full">
                {selectedInvoice.url !== "#" ? (
                  <iframe 
                    src={selectedInvoice.url} 
                    className="w-full h-full border-none"
                    title="Invoice PDF Viewer"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Unable to load PDF preview link.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t pt-4 text-xs">
                <Button variant="outline" size="sm" asChild>
                  <a href={selectedInvoice.url} target="_blank" rel="noopener noreferrer" className="gap-1 flex items-center">
                    <Eye className="h-3.5 w-3.5" /> Open in New Tab
                  </a>
                </Button>
                <Button size="sm" asChild className="bg-gradient-to-br from-primary to-primary-glow">
                  <a href={selectedInvoice.url} download={selectedInvoice.name} className="gap-1 flex items-center">
                    <Download className="h-3.5 w-3.5" /> Download PDF
                  </a>
                </Button>
                <DialogClose asChild>
                  <Button size="sm" variant="secondary">Close</Button>
                </DialogClose>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
