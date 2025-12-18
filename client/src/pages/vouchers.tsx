import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  Plus,
  Search,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import type { VoucherWithRelations } from "@shared/schema";

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

function getStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
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

export default function Vouchers() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: vouchers, isLoading } = useQuery<VoucherWithRelations[]>({
    queryKey: ["/api/vouchers", { status: statusFilter !== "all" ? statusFilter : undefined }],
  });

  const filteredVouchers = vouchers?.filter((v) => {
    const matchesSearch =
      v.payee.toLowerCase().includes(search.toLowerCase()) ||
      v.voucherNumber.toLowerCase().includes(search.toLowerCase()) ||
      v.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    if (!filteredVouchers || filteredVouchers.length === 0) return;

    const headers = [
      "Voucher #",
      "Date",
      "Payee",
      "Description",
      "Amount",
      "Invoice #",
      "Net of VAT",
      "VAT",
      "Withheld",
      "Status",
      "Requested By",
      "Approved By",
    ];

    const rows = filteredVouchers.map((v) => [
      v.voucherNumber,
      format(new Date(v.date), "yyyy-MM-dd"),
      v.payee,
      v.description,
      v.amount,
      v.invoiceNumber || "",
      v.amountNetOfVat || "",
      v.vatAmount || "",
      v.amountWithheld || "",
      v.status,
      v.requester ? `${v.requester.firstName} ${v.requester.lastName}` : "",
      v.approver ? `${v.approver.firstName} ${v.approver.lastName}` : "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
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
          <h1 className="text-3xl font-semibold">Vouchers</h1>
          <p className="text-muted-foreground mt-1">
            Manage petty cash disbursement vouchers
          </p>
        </div>
        <Link href="/vouchers/new">
          <Button data-testid="button-new-voucher">
            <Plus className="h-4 w-4 mr-2" />
            New Voucher
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-lg font-medium">Disbursement Register</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!filteredVouchers || filteredVouchers.length === 0}
              data-testid="button-export-csv"
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
                data-testid="input-search-vouchers"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
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

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredVouchers && filteredVouchers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Voucher #</TableHead>
                    <TableHead className="w-[100px]">Date</TableHead>
                    <TableHead>Payee</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[120px]">Requested By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVouchers.map((voucher) => (
                    <TableRow
                      key={voucher.id}
                      className="hover-elevate"
                      data-testid={`row-voucher-${voucher.id}`}
                    >
                      <TableCell className="font-mono text-sm">
                        {voucher.voucherNumber}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(voucher.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">{voucher.payee}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {voucher.description}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(voucher.amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {voucher.vatAmount ? formatCurrency(voucher.vatAmount) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {voucher.amountNetOfVat ? formatCurrency(voucher.amountNetOfVat) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(voucher.status)} size="sm">
                          {getStatusIcon(voucher.status)}
                          <span className="ml-1">{voucher.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {voucher.requester
                          ? `${voucher.requester.firstName} ${voucher.requester.lastName}`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-4">No vouchers found</p>
              <Link href="/vouchers/new">
                <Button data-testid="button-create-voucher-empty">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Voucher
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
