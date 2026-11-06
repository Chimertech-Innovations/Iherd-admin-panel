import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileUp,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Package,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import {
  parseCsvRaw,
  validateBulkProducts,
  validateBulkCombos,
  downloadSampleCsv,
  CsvValidationError,
  CsvImportResult,
} from "@/lib/csvBulkImporter";
import { getLocalizedText } from "@/lib/utils";

interface BulkCsvUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "products" | "combos";
  onSaveBatch: (items: any[]) => Promise<void>;
  categories?: any[];
}

export function BulkCsvUploadDialog({
  open,
  onOpenChange,
  type,
  onSaveBatch,
  categories = [],
}: BulkCsvUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null);

  const resetState = () => {
    setFileName("");
    setImportResult(null);
    setIsSaving(false);
    setSaveProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Invalid file format. Please upload a .csv file.");
      return;
    }

    setFileName(file.name);
    setIsProcessingFile(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || "");
        const { headers, rows } = parseCsvRaw(text);

        if (rows.length === 0) {
          toast.error("The selected CSV file is empty or has no data rows.");
          setImportResult({
            success: false,
            totalRows: 0,
            validRows: 0,
            errors: [
              {
                row: 1,
                field: "CSV File",
                message: "No data rows found in CSV file.",
                suggestion: "Download our sample CSV template, fill in your product data, and re-upload.",
              },
            ],
            data: [],
          });
          setIsProcessingFile(false);
          return;
        }

        // Run strict validation with headers checking
        const result =
          type === "products"
            ? validateBulkProducts(rows, categories, headers)
            : validateBulkCombos(rows, categories, headers);

        setImportResult(result);

        if (result.success) {
          toast.success(`CSV verified! All ${result.data.length} items passed strict validation.`);
        } else {
          toast.error(
            `CSV validation failed with ${result.errors.length} error(s). Strict mode active: 0 items will be added until resolved.`
          );
        }
      } catch (err: any) {
        toast.error(`Error parsing CSV file: ${err.message}`);
      } finally {
        setIsProcessingFile(false);
      }
    };

    reader.onerror = () => {
      toast.error("Failed to read the selected CSV file.");
      setIsProcessingFile(false);
    };

    reader.readAsText(file, "UTF-8");
  };

  const handleConfirmImport = async () => {
    if (!importResult || !importResult.success || importResult.data.length === 0) {
      toast.error("Cannot import: CSV has validation errors or no valid items.");
      return;
    }

    setIsSaving(true);
    setSaveProgress({ current: 0, total: importResult.data.length });

    try {
      await onSaveBatch(importResult.data);
      toast.success(`Successfully imported and published ${importResult.data.length} items to Firebase!`);
      onOpenChange(false);
      resetState();
    } catch (err: any) {
      toast.error(`Failed to complete bulk import: ${err.message}`);
    } finally {
      setIsSaving(false);
      setSaveProgress(null);
    }
  };

  const entityTitle = type === "products" ? "Product" : "Combo Product";

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!isSaving) {
          onOpenChange(val);
          if (!val) resetState();
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Bulk CSV Import for {entityTitle}s
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Upload multiple {type} at once with strict validation. If any field is missing or invalid, 0 items are added until corrected.
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadSampleCsv(type)}
              className="rounded-xl text-xs gap-1.5 border-dashed hover:border-primary"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>Download Sample CSV Template</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-3">
          {/* File Upload Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-3xl p-6 text-center transition-all ${
              importResult?.success
                ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10"
                : importResult && !importResult.success
                ? "border-destructive bg-destructive/5"
                : "border-border/80 hover:border-primary/50 bg-muted/20"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleFileChange}
              disabled={isSaving || isProcessingFile}
              className="hidden"
              id="bulk-csv-input"
            />
            <label htmlFor="bulk-csv-input" className="cursor-pointer flex flex-col items-center justify-center gap-2">
              <div className="h-12 w-12 rounded-2xl bg-card border shadow-xs flex items-center justify-center text-primary">
                <FileUp className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-primary hover:underline">
                  Click to select CSV file
                </span>
                <span className="text-xs text-muted-foreground"> or drag and drop your spreadsheet here</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                Supports standard RFC-4180 UTF-8 CSVs exported from Excel, Google Sheets, or LibreOffice
              </p>
            </label>

            {fileName && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-card border text-xs font-mono font-medium shadow-2xs">
                <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                <span>{fileName}</span>
                {importResult?.success && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
                    {importResult.data.length} valid rows
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* ERROR ALERT MODAL / BANNER: Strict Mode Reject Notice */}
          {importResult && !importResult.success && (
            <Card className="p-4 rounded-2xl border-destructive/60 bg-destructive/10 space-y-3">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-destructive flex items-center gap-2">
                    Bulk Upload Aborted: {importResult.errors.length} Missing / Invalid Field(s) Detected
                  </h4>
                  <p className="text-xs text-foreground leading-relaxed">
                    <strong>Strict All-or-Nothing Rule:</strong> Exactly <strong>0 {entityTitle}s</strong> have been saved to Firebase. Please fix the missing data fields in the rows listed below in your CSV file and re-upload.
                  </p>
                </div>
              </div>

              {/* Detailed Row-by-Row Error Table */}
              <div className="max-h-60 overflow-y-auto rounded-xl border border-destructive/30 bg-card">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-16 text-xs font-bold">Row #</TableHead>
                      <TableHead className="w-32 text-xs font-bold">Field Name</TableHead>
                      <TableHead className="text-xs font-bold">Error Description</TableHead>
                      <TableHead className="text-xs font-bold">How to Fix</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResult.errors.map((err, eIdx) => (
                      <TableRow key={eIdx} className="hover:bg-destructive/5 text-xs">
                        <TableCell className="font-mono font-bold text-destructive">
                          {err.row === 1 ? "CSV Column" : `Row ${err.row}`}
                        </TableCell>
                        <TableCell className="font-mono font-semibold text-foreground">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] text-destructive">
                            {err.field}
                          </code>
                        </TableCell>
                        <TableCell className="text-foreground">{err.message}</TableCell>
                        <TableCell className="text-muted-foreground font-medium">{err.suggestion}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* SUCCESS PREVIEW TABLE: Shows items ready to be imported */}
          {importResult && importResult.success && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <div>
                    <h5 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      All {importResult.data.length} {entityTitle}s Passed Strict Validation!
                    </h5>
                    <p className="text-[11px] text-muted-foreground">
                      Review preview below. Click "Confirm & Save to Firebase" to publish all items.
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-0.5">
                  Ready to Publish ({importResult.data.length})
                </Badge>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-2xl border bg-card">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead className="text-xs font-bold">Image</TableHead>
                      <TableHead className="text-xs font-bold">ID / SKU</TableHead>
                      <TableHead className="text-xs font-bold">{entityTitle} Name</TableHead>
                      <TableHead className="text-xs font-bold">Category</TableHead>
                      <TableHead className="text-xs font-bold text-right">Selling Price</TableHead>
                      <TableHead className="text-xs font-bold text-right">MRP</TableHead>
                      <TableHead className="text-xs font-bold text-right">Weight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResult.data.map((item, iIdx) => (
                      <TableRow key={iIdx} className="text-xs">
                        <TableCell>
                          {item.thumbnailUrl ? (
                            <img
                              src={item.thumbnailUrl}
                              alt={getLocalizedText(item.name)}
                              className="h-9 w-9 rounded-lg object-cover border"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                              <Package className="h-4 w-4" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground font-semibold">
                          {item.id}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {getLocalizedText(item.name)}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground text-[11px]">
                          {item.categoryId}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">
                          ₹{Number(item.price).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground line-through">
                          ₹{Number(item.mrp).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px]">
                          {item.weight} {typeof item.weightUnit === "object" ? item.weightUnit.en : item.weightUnit || "g"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Quick Guidance / Required Field Cheatsheet */}
          <div className="p-3.5 rounded-2xl border bg-muted/15 space-y-2">
            <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5 text-primary" />
              Strict CSV Schema Requirements ({entityTitle}s)
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-muted-foreground">
              <div className="p-2 rounded-xl bg-card border">
                <span className="font-mono font-bold text-foreground">name_en</span>
                <p>Required English product/combo name</p>
              </div>
              <div className="p-2 rounded-xl bg-card border">
                <span className="font-mono font-bold text-foreground">price & mrp</span>
                <p>Numbers &gt; 0; MRP must be &gt; price</p>
              </div>
              <div className="p-2 rounded-xl bg-card border">
                <span className="font-mono font-bold text-foreground">categoryId</span>
                <p>Valid category ID (e.g. cat_breeding)</p>
              </div>
              <div className="p-2 rounded-xl bg-card border">
                <span className="font-mono font-bold text-foreground">weight & weightUnit</span>
                <p>Numeric weight &gt; 0 (e.g. 500, g)</p>
              </div>
              <div className="p-2 rounded-xl bg-card border">
                <span className="font-mono font-bold text-foreground">{type === "products" ? "description_en" : "desc_en"}</span>
                <p>Required description text</p>
              </div>
              <div className="p-2 rounded-xl bg-card border">
                <span className="font-mono font-bold text-foreground">thumbnailUrl</span>
                <p>Direct image URL or Google Drive link</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t flex items-center justify-between sm:justify-between w-full">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleConfirmImport}
            disabled={!importResult || !importResult.success || isSaving || importResult.data.length === 0}
            className="rounded-xl bg-primary text-primary-foreground font-bold text-xs px-5 shadow-sm"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Publishing to Firebase...
              </>
            ) : (
              <>
                Confirm & Save All ({importResult?.data?.length || 0} Items) to Firebase
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

