import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  RefreshCw,
  Download,
  FileText,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { VoucherWithRelations, PettyCashFund } from "@shared/schema";

function formatCurrency(amount: string | number): string {
  return parseFloat(String(amount)).toLocaleString("en-US", {
    style: "currency",
    currency: "PHP",
  });
}

export default function Replenishment() {
  const { toast } = useToast();
  const [selectedVouchers, setSelectedVouchers] = useState<number[]>([]);

  const { data: fund, isLoading: fundLoading } = useQuery<PettyCashFund>({
    queryKey: ["/api/fund"],
  });

  const { data: vouchers, isLoading: vouchersLoading } = useQuery<VoucherWithRelations[]>({
    queryKey: ["/api/vouchers", { status: "approved" }],
  });

  const approvedVouchers = vouchers?.filter((v) => v.status === "approved") || [];

  const selectedVoucherData = approvedVouchers.filter((v) =>
    selectedVouchers.includes(v.id)
  );

  const totals = selectedVoucherData.reduce(
    (acc, v) => ({
      amount: acc.amount + parseFloat(v.amount),
      vat: acc.vat + parseFloat(v.vatAmount || "0"),
      withheld: acc.withheld + parseFloat(v.amountWithheld || "0"),
      netAmount: acc.netAmount + parseFloat(v.amountNetOfVat || v.amount),
    }),
    { amount: 0, vat: 0, withheld: 0, netAmount: 0 }
  );

  const createReplenishment = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/replenishment-requests", {
        voucherIds: selectedVouchers,
        totalAmount: totals.amount.toString(),
        totalVat: totals.vat.toString(),
        totalWithheld: totals.withheld.toString(),
        totalNetAmount: totals.netAmount.toString(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Replenishment Requested",
        description: "Your replenishment request has been submitted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fund"] });
      queryClient.invalidateQueries({ queryKey: ["/api/replenishment-requests"] });
      setSelectedVouchers([]);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create replenishment request.",
        variant: "destructive",
      });
    },
  });

  const toggleVoucher = (id: number) => {
    setSelectedVouchers((prev) =>
      prev.includes(id) ? prev.filter((vid) => vid !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedVouchers.length === approvedVouchers.length) {
      setSelectedVouchers([]);
    } else {
      setSelectedVouchers(approvedVouchers.map((v) => v.id));
    }
  };

  const handleExportReport = () => {
    if (selectedVoucherData.length === 0) return;

    const headers = [
      "Voucher #",
      "Date",
      "Payee",
      "Description",
      "Amount",
      "Net of VAT",
      "VAT",
      "Withheld",
      "Account Code",
    ];

    const rows = selectedVoucherData.map((v) => [
      v.voucherNumber,
      format(new Date(v.date), "yyyy-MM-dd"),
      v.payee,
      v.description,
      v.amount,
      v.amountNetOfVat || "",
      v.vatAmount || "",
      v.amountWithheld || "",
      v.chartOfAccount?.code || "",
    ]);

    const summaryRows = [
      [],
      ["", "", "", "TOTALS:", totals.amount.toFixed(2), totals.netAmount.toFixed(2), totals.vat.toFixed(2), totals.withheld.toFixed(2), ""],
      [],
      ["Replenishment Amount Needed:", totals.amount.toFixed(2)],
    ];

    const csvContent = [headers, ...rows, ...summaryRows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `replenishment-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Replenishment</h1>
          <p className="text-muted-foreground mt-1">
            Generate petty cash replenishment report
          </p>
        </div>
      </div>

      {fundLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : fund && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Imprest Amount
              </p>
              <p className="font-mono text-2xl font-semibold mt-2" data-testid="text-imprest-amount">
                {formatCurrency(fund.imprestAmount)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Current Balance
              </p>
              <p className="font-mono text-2xl font-semibold mt-2" data-testid="text-current-balance">
                {formatCurrency(fund.currentBalance)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Total Disbursed
              </p>
              <p className="font-mono text-2xl font-semibold mt-2" data-testid="text-total-disbursed">
                {formatCurrency(parseFloat(fund.imprestAmount) - parseFloat(fund.currentBalance))}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Selected for Replenishment
              </p>
              <p className="font-mono text-2xl font-semibold mt-2" data-testid="text-selected-total">
                {formatCurrency(totals.amount)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg font-medium">Approved Vouchers</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportReport}
              disabled={selectedVouchers.length === 0}
              data-testid="button-export-report"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  disabled={selectedVouchers.length === 0 || createReplenishment.isPending}
                  data-testid="button-request-replenishment"
                >
                  {createReplenishment.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Request Replenishment
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Replenishment Request</AlertDialogTitle>
                  <AlertDialogDescription>
                    You are about to request replenishment for {selectedVouchers.length} vouchers
                    totaling {formatCurrency(totals.amount)}. This will mark these vouchers as
                    replenished and reset the fund balance.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => createReplenishment.mutate()}>
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent>
          {vouchersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : approvedVouchers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={
                          selectedVouchers.length === approvedVouchers.length &&
                          approvedVouchers.length > 0
                        }
                        onCheckedChange={toggleAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead className="w-[120px]">Voucher #</TableHead>
                    <TableHead className="w-[100px]">Date</TableHead>
                    <TableHead>Payee</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Net of VAT</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Withheld</TableHead>
                    <TableHead className="w-[100px]">Account</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedVouchers.map((voucher) => (
                    <TableRow
                      key={voucher.id}
                      className={selectedVouchers.includes(voucher.id) ? "bg-muted/50" : ""}
                      data-testid={`row-replenishment-voucher-${voucher.id}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedVouchers.includes(voucher.id)}
                          onCheckedChange={() => toggleVoucher(voucher.id)}
                          data-testid={`checkbox-voucher-${voucher.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {voucher.voucherNumber}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(voucher.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">{voucher.payee}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(voucher.amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {voucher.amountNetOfVat ? formatCurrency(voucher.amountNetOfVat) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {voucher.vatAmount ? formatCurrency(voucher.vatAmount) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {voucher.amountWithheld ? formatCurrency(voucher.amountWithheld) : "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {voucher.chartOfAccount?.code || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No approved vouchers available for replenishment</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedVouchers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Replenishment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Total Amount
                </p>
                <p className="font-mono text-xl font-semibold mt-1" data-testid="text-summary-total-amount">
                  {formatCurrency(totals.amount)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Total VAT
                </p>
                <p className="font-mono text-xl font-semibold mt-1" data-testid="text-summary-total-vat">
                  {formatCurrency(totals.vat)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Total Withheld
                </p>
                <p className="font-mono text-xl font-semibold mt-1" data-testid="text-summary-total-withheld">
                  {formatCurrency(totals.withheld)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Net Amount
                </p>
                <p className="font-mono text-xl font-semibold mt-1" data-testid="text-summary-net-amount">
                  {formatCurrency(totals.netAmount)}
                </p>
              </div>
            </div>
            <div className="mt-6 p-4 rounded-md bg-primary/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">Replenishment Amount Needed</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    To restore fund to imprest amount
                  </p>
                </div>
                <p className="font-mono text-2xl font-semibold text-primary" data-testid="text-replenishment-needed">
                  {formatCurrency(totals.amount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
