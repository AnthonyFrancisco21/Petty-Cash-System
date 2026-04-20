import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Upload,
  Paperclip,
  Trash2,
  Eye,
  User,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import XLSX from "xlsx-js-style";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { canCreateVouchers } from "@/lib/roleUtils";
import type { VoucherWithRelations, VoucherAttachment } from "@shared/schema";

function formatCurrency(amount: string | number): string {
  return parseFloat(String(amount)).toLocaleString("en-US", {
    style: "currency",
    currency: "PHP",
  });
}

function getStatusIcon(status: string) {
  switch (status) {
    case "approved":
      return <CheckCircle className="h-3 w-3" />;
    case "rejected":
      return <XCircle className="h-3 w-3" />;
    case "pending":
      return <Clock className="h-3 w-3" />;
    default:
      return null;
  }
}

function getStatusVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "approved":
      return "default";
    case "pending":
      return "secondary";
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
}

// ─── Determine the tax type label for display ───────────────
function getTaxLabel(item: any): string {
  const nonVat = parseFloat(String(item.nonVatAmount || "0"));
  const vatBase = parseFloat(String(item.amount || "0"));
  if (nonVat > 0 && vatBase > 0) return "Mixed";
  if (vatBase > 0) return "Vatable";
  return "Non-VAT";
}

interface VoucherDetailDialogProps {
  voucher: VoucherWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewAttachment: (attachment: any) => void;
}

function VoucherDetailDialog({
  voucher,
  open,
  onOpenChange,
  onViewAttachment,
}: VoucherDetailDialogProps): JSX.Element | null {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: attachments, isLoading: attachmentsLoading } = useQuery<
    VoucherAttachment[]
  >({
    queryKey: [`/api/vouchers/${voucher?.id}/attachments`],
    enabled: !!voucher,
  });

  const uploadAttachment = useMutation({
    mutationFn: async (file: File) => {
      if (!voucher) throw new Error("No voucher selected");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/vouchers/${voucher.id}/attachments`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Attachment Uploaded",
        description: "The file has been attached to this voucher.",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/vouchers/${voucher?.id}/attachments`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vouchers"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => (window.location.href = "/api/login"), 500);
      } else {
        toast({
          title: "Upload Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: async (attachmentId: number) => {
      if (!voucher) throw new Error("No voucher selected");
      return await apiRequest(
        "DELETE",
        `/api/vouchers/${voucher.id}/attachments/${attachmentId}`,
      );
    },
    onSuccess: () => {
      toast({
        title: "Attachment Deleted",
        description: "The file has been removed from this voucher.",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/vouchers/${voucher?.id}/attachments`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vouchers"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => (window.location.href = "/api/login"), 500);
      } else {
        toast({
          title: "Delete Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAttachment.mutate(file);
      e.target.value = "";
    }
  };

  const canManageAttachments =
    user &&
    (user.role === "admin" ||
      user.role === "preparer" ||
      (voucher && voucher.requestedById === user.id));

  // ============================================================
  // EXCEL EXPORT
  // ============================================================
  // Accounting logic (Philippine BIR context):
  //
  //   DEBIT:
  //     • Expense / Cost / Asset account  = nonVatAmount + vatableBase (total base)
  //     • Input VAT                        = vatAmount
  //
  //   CREDIT:
  //     • Petty Cash (Cash)                = netCashOut (total base + vat − ewt)
  //     • EWT Payable                      = amountWithheld
  //
  //   Balance check: Debits = Credits
  //     (base + vat) = (base + vat − ewt) + ewt  ✓
  //
  //   Each item now carries:
  //     item.nonVatAmount  → non-vatable portion base (new DB column)
  //     item.amount        → vatable base (back-calculated from gross)
  //     item.vatAmount     → input VAT extracted from vatable gross
  //     item.amountWithheld → EWT withheld on totalBase
  // ============================================================
  const handleExportExcel = () => {
    if (!voucher) return;

    // ── Style definitions ──
    const thinBorder = { style: "thin", color: { rgb: "000000" } };
    const borderAll = {
      top: thinBorder,
      bottom: thinBorder,
      left: thinBorder,
      right: thinBorder,
    };

    const sNormal = {
      font: { name: "Calibri", sz: 11 },
      border: borderAll,
      alignment: { vertical: "center", horizontal: "left", wrapText: true },
    };
    const sHeader = {
      font: { name: "Calibri", sz: 11, bold: true },
      fill: { fgColor: { rgb: "D9D9D9" } },
      border: borderAll,
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
    };
    const sHeaderGreen = {
      font: { name: "Calibri", sz: 14, bold: true },
      fill: { fgColor: { rgb: "92D050" } },
      border: borderAll,
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
    };
    const sBold = {
      font: { name: "Calibri", sz: 11, bold: true },
      border: borderAll,
      alignment: { vertical: "center", horizontal: "left", wrapText: true },
    };
    const sCenter = {
      font: { name: "Calibri", sz: 11 },
      border: borderAll,
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
    };
    const sRight = {
      font: { name: "Calibri", sz: 11 },
      border: borderAll,
      alignment: { vertical: "center", horizontal: "right", wrapText: true },
    };
    const sRightRed = {
      font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FF0000" } },
      border: borderAll,
      alignment: { vertical: "center", horizontal: "right", wrapText: true },
    };
    const sRightBold = {
      font: { name: "Calibri", sz: 11, bold: true },
      border: borderAll,
      alignment: { vertical: "center", horizontal: "right", wrapText: true },
    };

    const c = (v: any, s = sNormal) => ({
      v: v !== undefined && v !== null ? v : "",
      s,
    });

    // ── Data preparation ──
    const dynamicCompanyName = voucher.companyName || "M P I";
    const allParticulars =
      "petty cash c/o " +
      (voucher.requester ? voucher.requester.firstName : "");

    // Voucher-level category (new field). Fall back to item-level if old data.
    const voucherCategory =
      (voucher as any).category ||
      (voucher.items?.[0] as any)?.category ||
      "Exp";

    let totalVat = 0;
    let totalEwt = 0;

    // ── Map items: now each item has both a vatable base AND a non-vat amount ──
    const mappedItems: {
      description: string;
      vatableBase: number; // item.amount (purely vatable base)
      nonVatAmount: number; // item.nonVatAmount (new column)
      vat: number;
      ewt: number;
    }[] = [];

    voucher.items?.forEach((item: any) => {
      const vatableBase = parseFloat(String(item.amount || "0"));
      const nonVatAmt = parseFloat(String(item.nonVatAmount || "0"));
      const itemVat = parseFloat(String(item.vatAmount || "0"));
      const itemEwt = parseFloat(String(item.amountWithheld || "0"));

      totalVat += itemVat;
      totalEwt += itemEwt;

      mappedItems.push({
        description: item.description || "",
        vatableBase,
        nonVatAmount: nonVatAmt,
        vat: itemVat,
        ewt: itemEwt,
      });
    });

    // Totals
    const totalVatableBase = mappedItems.reduce((s, i) => s + i.vatableBase, 0);
    const totalNonVatBase = mappedItems.reduce((s, i) => s + i.nonVatAmount, 0);
    const totalBaseAmount = totalVatableBase + totalNonVatBase;
    const netCashOut = totalBaseAmount + totalVat - totalEwt;
    const totalDebits = totalBaseAmount + totalVat;
    const totalCredits = netCashOut + totalEwt;

    const fmtDate = (d: any) => (d ? format(new Date(d), "dd-MMM-yy") : "");
    const fmtMoney = (m: number | string) =>
      m ? Number(m).toFixed(2) : "0.00";

    const requester = voucher.requester ? voucher.requester.firstName : "";
    const approver = voucher.approver ? voucher.approver.firstName : "";

    // ── Category section label for Excel ──
    const categoryLabels: Record<string, string> = {
      Exp: "Exp",
      Cost: "Cost",
      Asset: "Asset",
    };
    const sectionLabel = categoryLabels[voucherCategory] ?? "Exp/WIP";

    // ── Build Excel grid ──
    let wsData: any[] = [
      // ROW 0
      [
        c("Bank", sHeader),
        c("Voucher No.", sHeader),
        c(dynamicCompanyName, sHeaderGreen),
        c("", sHeaderGreen),
        c("Prepd", sHeader),
        c("Apprvd", sHeader),
      ],
      // ROW 1
      [
        c("B-1", sCenter),
        c(voucher.voucherNumber, sCenter),
        c("", sNormal),
        c("", sNormal),
        c(requester, sCenter),
        c(approver, sCenter),
      ],
      // ROW 2
      [
        c("Date", sHeader),
        c("Chk No", sHeader),
        c("Payee", sHeader),
        c("Particulars", sHeader),
        c("Doc Ref", sHeader),
        c("Amount", sHeader),
      ],
      // ROW 3
      [
        c(fmtDate(voucher.date), sCenter),
        c("", sNormal),
        c(voucher.payee, sCenter),
        c(allParticulars, sCenter),
        c("", sNormal),
        c(fmtMoney(netCashOut), sRightRed),
      ],
      // ROW 4 — Accounting headers
      [
        c("Tr Type", sHeader),
        c("", sNormal),
        c("", sNormal),
        c("", sNormal),
        c("Debit", sHeader),
        c("Credit", sHeader),
      ],
      // ROW 5 — Cash (credit)
      [
        c("[ ] Check", sNormal),
        c("", sNormal),
        c("ASSETS", sBold),
        c("Cash", sNormal),
        c("", sNormal),
        c(fmtMoney(netCashOut), sRight),
      ],
      // ROW 6 — VAT Input (debit)
      [
        c("[X] Pcash", sNormal),
        c("", sNormal),
        c("", sNormal),
        c("VAT-input", sNormal),
        c(fmtMoney(totalVat), sRight),
        c("", sNormal),
      ],
      // ROW 7 — EWT Payable (credit)
      [
        c("[ ] DM", sNormal),
        c("", sNormal),
        c("LIABILITIES", sBold),
        c("EWT Payable", sNormal),
        c("", sNormal),
        c(fmtMoney(totalEwt), sRight),
      ],
      // ROW 8 — Breakdown header
      [
        c("[ ] MC", sNormal),
        c("Breakdown", sHeader),
        c("", sNormal),
        c("", sNormal),
        c("", sNormal),
        c("", sNormal),
      ],
      // ROW 9 — Column labels
      [
        c("", sNormal),
        c("Vatable Base", sCenter),
        c("Non-VAT", sCenter),
        c("Total", sCenter),
        c("", sNormal),
        c("", sNormal),
      ],
      // ROW 10 — Category header (e.g. "Exp/WIP" or "Cost/WIP" or "Asset")
      [
        c(sectionLabel, sHeader),
        c("", sNormal),
        c("", sNormal),
        c("", sNormal),
        c("", sNormal),
        c("", sNormal),
      ],
    ];

    // ── Line items under the category section ──
    let subtotalVatable = 0;
    let subtotalNonVat = 0;

    if (mappedItems.length === 0) {
      // Safety placeholder
      wsData.push([
        c("(no items)", sNormal),
        c("-", sRight),
        c("-", sRight),
        c("-", sRight),
        c("", sNormal),
        c("", sNormal),
      ]);
    } else {
      mappedItems.forEach((item) => {
        subtotalVatable += item.vatableBase;
        subtotalNonVat += item.nonVatAmount;
        const rowTotal = item.vatableBase + item.nonVatAmount;
        wsData.push([
          c(item.description, sNormal),
          c(item.vatableBase > 0 ? fmtMoney(item.vatableBase) : "-", sRight),
          c(item.nonVatAmount > 0 ? fmtMoney(item.nonVatAmount) : "-", sRight),
          c(rowTotal > 0 ? fmtMoney(rowTotal) : "-", sRight),
          c("", sNormal),
          c("", sNormal),
        ]);
      });
    }

    // Subtotal row
    const subtotalRow = subtotalVatable + subtotalNonVat;
    wsData.push([
      c(`Subt ${sectionLabel}`, sBold),
      c(subtotalVatable > 0 ? fmtMoney(subtotalVatable) : "-", sRight),
      c(subtotalNonVat > 0 ? fmtMoney(subtotalNonVat) : "-", sRight),
      c(fmtMoney(subtotalRow), sRight),
      c(fmtMoney(subtotalRow), sRight), // Debit column (expense/asset debit)
      c("", sNormal),
    ]);

    // TOTAL row
    wsData.push([
      c("TOTAL", sHeader),
      c("", sNormal),
      c("", sNormal),
      c("", sNormal),
      c(fmtMoney(totalDebits), sRightBold),
      c(fmtMoney(totalCredits), sRightBold),
    ]);

    // ── Create workbook ──
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(wsData);

    // Merges
    sheet["!merges"] = [
      { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } }, // Company name row 1
      { s: { r: 1, c: 2 }, e: { r: 1, c: 3 } }, // Company name row 2
      { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } }, // Tr Type header
      { s: { r: 8, c: 1 }, e: { r: 8, c: 3 } }, // Breakdown label
    ];

    // Column widths
    sheet["!cols"] = [
      { wch: 22 }, // A: Description / category label
      { wch: 18 }, // B: Vatable column
      { wch: 18 }, // C: Non-VAT column
      { wch: 18 }, // D: Total column
      { wch: 15 }, // E: Debit
      { wch: 15 }, // F: Credit
    ];

    XLSX.utils.book_append_sheet(workbook, sheet, "Voucher");
    XLSX.writeFile(workbook, `Voucher-${voucher.voucherNumber}.xlsx`);
  };

  if (!voucher) return null;

  // ── Build voucher-level totals for detail view ──
  let dlgTotalNonVat = 0;
  let dlgTotalVatableBase = 0;
  let dlgTotalVat = 0;
  let dlgTotalEwt = 0;

  voucher.items?.forEach((item: any) => {
    dlgTotalNonVat += parseFloat(String(item.nonVatAmount || "0"));
    dlgTotalVatableBase += parseFloat(String(item.amount || "0"));
    dlgTotalVat += parseFloat(String(item.vatAmount || "0"));
    dlgTotalEwt += parseFloat(String(item.amountWithheld || "0"));
  });

  const dlgGross = dlgTotalNonVat + dlgTotalVatableBase + dlgTotalVat;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-col items-start gap-3">
            <div className="flex justify-start mb-4">
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>
            </div>
            <span className="font-mono">{voucher.voucherNumber}</span>
            <Badge variant={getStatusVariant(voucher.status)}>
              {getStatusIcon(voucher.status)}
              <span className="ml-1">{voucher.status}</span>
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Voucher details and attached documents
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Payee</p>
              <p className="font-medium">{voucher.payee}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {format(new Date(voucher.date), "MMMM d, yyyy")}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Category</p>
              <Badge variant="outline">
                {(voucher as any).category === "Cost"
                  ? "Cost / WIP"
                  : (voucher as any).category === "Asset"
                    ? "Asset"
                    : "Expense"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Net Cash to Vendor
              </p>
              <p className="font-mono font-semibold text-lg">
                {formatCurrency(voucher.totalAmount)}
              </p>
            </div>
          </div>

          <Separator />

          {/* Line items */}
          <div>
            <h3 className="font-medium mb-3">Line Items</h3>
            <div className="space-y-3">
              {voucher.items?.map((item: any, index: number) => {
                const vatableBase = parseFloat(String(item.amount || "0"));
                const nonVatAmt = parseFloat(String(item.nonVatAmount || "0"));
                const itemVat = parseFloat(String(item.vatAmount || "0"));
                const itemEwt = parseFloat(String(item.amountWithheld || "0"));
                const itemGross = nonVatAmt + vatableBase + itemVat;
                const itemNet = itemGross - itemEwt;
                const taxLabel = getTaxLabel(item);

                return (
                  <div key={index} className="p-3 bg-muted/50 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{item.description}</p>
                      <Badge variant="outline" className="text-xs">
                        {taxLabel}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {nonVatAmt > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Non-VAT Amount:
                          </span>
                          <span className="font-mono">
                            {formatCurrency(nonVatAmt)}
                          </span>
                        </div>
                      )}
                      {vatableBase > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Vatable Base:
                          </span>
                          <span className="font-mono">
                            {formatCurrency(vatableBase)}
                          </span>
                        </div>
                      )}
                      {itemVat > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Input VAT:
                          </span>
                          <span className="font-mono">
                            {formatCurrency(itemVat)}
                          </span>
                        </div>
                      )}
                      {itemEwt > 0 && (
                        <div className="flex justify-between text-red-500">
                          <span>EWT Withheld:</span>
                          <span className="font-mono">
                            −{formatCurrency(itemEwt)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between border-t pt-1 font-medium col-span-2">
                        <span>Gross / Net to Vendor:</span>
                        <span className="font-mono">
                          {formatCurrency(itemGross)} /{" "}
                          {formatCurrency(itemNet)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Voucher-level totals in detail view */}
            {voucher.items && voucher.items.length > 1 && (
              <div className="mt-3 p-3 bg-muted rounded-md text-sm space-y-1">
                {dlgTotalNonVat > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Non-VAT Base:</span>
                    <span className="font-mono">
                      {formatCurrency(dlgTotalNonVat)}
                    </span>
                  </div>
                )}
                {dlgTotalVatableBase > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Vatable Base:</span>
                    <span className="font-mono">
                      {formatCurrency(dlgTotalVatableBase)}
                    </span>
                  </div>
                )}
                {dlgTotalVat > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Input VAT:</span>
                    <span className="font-mono">
                      {formatCurrency(dlgTotalVat)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>Total Gross:</span>
                  <span className="font-mono">{formatCurrency(dlgGross)}</span>
                </div>
                {dlgTotalEwt > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Total EWT:</span>
                    <span className="font-mono">
                      −{formatCurrency(dlgTotalEwt)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Requester / Approver */}
          <div className="grid grid-cols-2 gap-4">
            {voucher.requester && (
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Requested By
                </p>
                <p className="font-medium">
                  {voucher.requester.firstName} {voucher.requester.lastName}
                </p>
              </div>
            )}
            {voucher.approver && (
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Approved By
                </p>
                <p className="font-medium">
                  {voucher.approver.firstName} {voucher.approver.lastName}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments
              </h3>
              {canManageAttachments && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadAttachment.isPending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadAttachment.isPending ? "Uploading..." : "Upload"}
                  </Button>
                </>
              )}
            </div>

            {attachmentsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : attachments && attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-md w-full overflow-hidden"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p
                          className="font-medium text-sm truncate"
                          title={attachment.fileName}
                        >
                          {attachment.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {format(
                            new Date(attachment.uploadedAt),
                            "MMM d, yyyy h:mm a",
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onViewAttachment(attachment)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canManageAttachments && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteAttachment.mutate(attachment.id)}
                          disabled={deleteAttachment.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No attachments yet</p>
                {canManageAttachments && (
                  <p className="text-sm mt-1">
                    Upload receipts or invoices to support this voucher
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Attachment viewer dialog (unchanged) ────────────────────
function AttachmentViewerDialog({
  attachment,
  open,
  onOpenChange,
}: {
  attachment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!attachment) return null;

  const isImage = attachment.fileType?.startsWith("image/");
  const isPDF = attachment.fileType === "application/pdf";
  const viewUrl = `/api/attachments/${attachment.id}/view`;
  const downloadUrl = `/api/attachments/${attachment.id}/download`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 gap-0 flex flex-col bg-background overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b flex-none">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="text-base font-medium truncate">
              {attachment.fileName}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 pr-8">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex"
              onClick={() => window.open(viewUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open New Tab
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => window.open(downloadUrl, "_blank")}
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 w-full relative overflow-hidden bg-muted/20">
          {isImage ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={viewUrl}
                alt={attachment.fileName}
                className="max-w-full max-h-full w-auto h-auto object-contain rounded shadow-sm"
              />
            </div>
          ) : isPDF ? (
            <iframe
              src={viewUrl}
              className="w-full h-full border-0"
              title={attachment.fileName}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="bg-muted p-6 rounded-full mb-4">
                <FileText className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Preview Unavailable</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                This file type cannot be previewed. Download it to view.
              </p>
              <Button onClick={() => window.open(downloadUrl, "_blank")}>
                <Download className="h-4 w-4 mr-2" />
                Download File
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Vouchers page ───────────────────────────────────────
export default function Vouchers() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedVoucher, setSelectedVoucher] =
    useState<VoucherWithRelations | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isAttachmentViewerOpen, setIsAttachmentViewerOpen] = useState(false);
  const [attachmentToView, setAttachmentToView] = useState<any>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<VoucherWithRelations[][]>([]);
  const [offset, setOffset] = useState(0);
  const limit = 10;

  const {
    data: pageData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<VoucherWithRelations[]>({
    queryKey: ["/api/vouchers", statusFilter, limit, offset],
    staleTime: 0,
    queryFn: async (): Promise<VoucherWithRelations[]> => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      const res = await fetch(`/api/vouchers?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch vouchers");
      return await res.json();
    },
  });

  useEffect(() => {
    if (pageData && Array.isArray(pageData)) {
      if (offset === 0) {
        setPages([pageData]);
      } else {
        setPages((p) => [...p, pageData]);
      }
    }
  }, [pageData, offset, statusFilter]);

  useEffect(() => {
    setOffset(0);
  }, [statusFilter]);

  const vouchers = pages.flatMap((p) => p) || [];

  const handleRowClick = (voucher: VoucherWithRelations) => {
    setSelectedVoucher(voucher);
    setDetailOpen(true);
  };

  const handleViewAttachment = (attachment: any) => {
    setAttachmentToView(attachment);
    setIsAttachmentViewerOpen(true);
  };

  const filteredVouchers = vouchers?.filter((v: VoucherWithRelations) => {
    const matchesSearch =
      v.payee.toLowerCase().includes(search.toLowerCase()) ||
      v.voucherNumber.toLowerCase().includes(search.toLowerCase()) ||
      v.items?.some((item) =>
        item.description.toLowerCase().includes(search.toLowerCase()),
      ) ||
      false;
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    if (!filteredVouchers || filteredVouchers.length === 0) return;

    const headers = [
      "Voucher #",
      "Date",
      "Payee",
      "Category",
      "Description",
      "Non-VAT Base",
      "Vatable Base",
      "VAT",
      "EWT",
      "Status",
      "Approver",
    ];

    const rows = filteredVouchers.map((v: VoucherWithRelations) => [
      v.voucherNumber,
      format(new Date(v.date), "yyyy-MM-dd"),
      v.payee,
      (v as any).category || "",
      v.items?.map((item) => item.description).join("; ") || "",
      v.items
        ?.reduce(
          (sum, item) =>
            sum + parseFloat(String((item as any).nonVatAmount || "0")),
          0,
        )
        .toFixed(2),
      v.items
        ?.reduce((sum, item) => sum + parseFloat(String(item.amount || "0")), 0)
        .toFixed(2),
      v.items
        ?.reduce(
          (sum, item) => sum + parseFloat(String(item.vatAmount || "0")),
          0,
        )
        .toFixed(2),
      v.items
        ?.reduce(
          (sum, item) => sum + parseFloat(String(item.amountWithheld || "0")),
          0,
        )
        .toFixed(2),
      v.status,
      v.approver ? `${v.approver.firstName} ${v.approver.lastName}` : "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row: any[]) =>
        row.map((cell: any) => `"${String(cell)}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vouchers-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">
            {user?.role === "approver" ? "Vouchers for Review" : "Vouchers"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {user?.role === "approver"
              ? "Review vouchers created by preparers"
              : user?.role === "preparer"
                ? "Manage petty cash disbursement vouchers"
                : "View all vouchers"}
          </p>
        </div>
        {canCreateVouchers(user?.role || "") && (
          <Link href="/vouchers/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Voucher
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-lg font-medium">
              Disbursement Register
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!filteredVouchers || filteredVouchers.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by payee, voucher #, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="replenished">Replenished</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isError ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                Error loading vouchers: {error?.message || "Unknown error"}
              </p>
              <Button onClick={() => refetch()} variant="outline">
                Try Again
              </Button>
            </div>
          ) : isLoading && pages.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredVouchers && filteredVouchers.length > 0 ? (
            <div
              ref={listRef}
              onScroll={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                const atBottom =
                  el.scrollHeight - el.scrollTop <= el.clientHeight + 100;
                if (atBottom && !isFetching) {
                  const lastPage = pages[pages.length - 1];
                  if (lastPage && lastPage.length === limit) {
                    setOffset((o) => o + limit);
                  }
                }
              }}
              className="max-h-[60vh] overflow-auto"
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Voucher #</TableHead>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead>Payee</TableHead>
                      <TableHead className="w-[80px]">Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[100px]">Attachments</TableHead>
                      <TableHead className="text-right">Net Amount</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVouchers.map((voucher: VoucherWithRelations) => (
                      <TableRow
                        key={voucher.id}
                        className="hover-elevate cursor-pointer"
                        onClick={() => handleRowClick(voucher)}
                      >
                        <TableCell className="font-mono text-sm">
                          {voucher.voucherNumber}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(voucher.date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {voucher.payee}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {(voucher as any).category || "Exp"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {voucher.items?.[0]?.description || ""}
                        </TableCell>
                        <TableCell className="text-sm">
                          {voucher.attachmentCount &&
                          voucher.attachmentCount > 0
                            ? voucher.attachmentCount
                            : "None"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(voucher.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(voucher.status)}>
                            {getStatusIcon(voucher.status)}
                            <span className="ml-1">{voucher.status}</span>
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {isFetching && offset > 0 && (
                <div className="p-4 text-center">Loading more vouchers...</div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-4">No vouchers found</p>
              {canCreateVouchers(user?.role || "") && (
                <Link href="/vouchers/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Voucher
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <VoucherDetailDialog
        voucher={selectedVoucher}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onViewAttachment={handleViewAttachment}
      />

      <AttachmentViewerDialog
        attachment={attachmentToView}
        open={isAttachmentViewerOpen}
        onOpenChange={setIsAttachmentViewerOpen}
      />
    </div>
  );
}
