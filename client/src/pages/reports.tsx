import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Download, Calendar, FileSpreadsheet, TrendingUp, TrendingDown } from "lucide-react";

interface ReportSummary {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalAmount: string;
    totalVat: string;
    totalWithheld: string;
    totalNetAmount: string;
    voucherCount: number;
  };
  byAccount: Array<{
    code: string;
    name: string;
    amount: number;
    vat: number;
    withheld: number;
    netAmount: number;
    count: number;
  }>;
  byMonth: Array<{
    month: string;
    amount: number;
    vat: number;
    withheld: number;
    netAmount: number;
    count: number;
  }>;
}

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
  }).format(num);
}

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return format(date, "MMMM yyyy");
}

export default function Reports() {
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: report, isLoading, refetch } = useQuery<ReportSummary>({
    queryKey: ["/api/reports/disbursement-summary", { startDate, endDate }],
  });

  const exportAccountSummaryCSV = () => {
    if (!report?.byAccount?.length) return;

    const headers = ["Account Code", "Account Name", "Amount", "VAT", "Withheld", "Net Amount", "Count"];
    const rows = report.byAccount.map((item) => [
      item.code,
      item.name,
      item.amount.toFixed(2),
      item.vat.toFixed(2),
      item.withheld.toFixed(2),
      item.netAmount.toFixed(2),
      item.count,
    ]);

    const totalRow = [
      "TOTAL",
      "",
      report.summary.totalAmount,
      report.summary.totalVat,
      report.summary.totalWithheld,
      report.summary.totalNetAmount,
      report.summary.voucherCount,
    ];

    const csvContent = [headers, ...rows, totalRow]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disbursement-by-account-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportMonthlySummaryCSV = () => {
    if (!report?.byMonth?.length) return;

    const headers = ["Month", "Amount", "VAT", "Withheld", "Net Amount", "Voucher Count"];
    const rows = report.byMonth.map((item) => [
      formatMonth(item.month),
      item.amount.toFixed(2),
      item.vat.toFixed(2),
      item.withheld.toFixed(2),
      item.netAmount.toFixed(2),
      item.count,
    ]);

    const totalRow = [
      "TOTAL",
      report.summary.totalAmount,
      report.summary.totalVat,
      report.summary.totalWithheld,
      report.summary.totalNetAmount,
      report.summary.voucherCount,
    ];

    const csvContent = [headers, ...rows, totalRow]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disbursement-by-month-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Financial Reports
          </h1>
          <p className="text-muted-foreground mt-1">
            Disbursement summary and period comparisons
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Report Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-report-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-report-end-date"
              />
            </div>
            <Button onClick={() => refetch()} data-testid="button-generate-report">
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Disbursed</CardDescription>
                <CardTitle className="text-2xl font-mono" data-testid="text-total-disbursed">
                  {formatCurrency(report.summary.totalAmount)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {report.summary.voucherCount} vouchers
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total VAT</CardDescription>
                <CardTitle className="text-2xl font-mono" data-testid="text-total-vat">
                  {formatCurrency(report.summary.totalVat)}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Withheld</CardDescription>
                <CardTitle className="text-2xl font-mono" data-testid="text-total-withheld">
                  {formatCurrency(report.summary.totalWithheld)}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Net Amount</CardDescription>
                <CardTitle className="text-2xl font-mono" data-testid="text-total-net">
                  {formatCurrency(report.summary.totalNetAmount)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Tabs defaultValue="by-account" className="space-y-4">
            <TabsList>
              <TabsTrigger value="by-account" data-testid="tab-by-account">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                By Account
              </TabsTrigger>
              <TabsTrigger value="by-month" data-testid="tab-by-month">
                <TrendingUp className="h-4 w-4 mr-2" />
                By Month
              </TabsTrigger>
            </TabsList>

            <TabsContent value="by-account">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="text-lg">Disbursement by Account</CardTitle>
                      <CardDescription>
                        Breakdown by chart of account code
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      onClick={exportAccountSummaryCSV}
                      disabled={!report.byAccount?.length}
                      data-testid="button-export-by-account"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account Code</TableHead>
                          <TableHead>Account Name</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">VAT</TableHead>
                          <TableHead className="text-right">Withheld</TableHead>
                          <TableHead className="text-right">Net Amount</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.byAccount?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              No data for the selected period
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {report.byAccount?.map((item) => (
                              <TableRow key={item.code} data-testid={`row-account-${item.code}`}>
                                <TableCell className="font-mono font-medium">
                                  {item.code}
                                </TableCell>
                                <TableCell>{item.name}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(item.amount)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(item.vat)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(item.withheld)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(item.netAmount)}
                                </TableCell>
                                <TableCell className="text-right">{item.count}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-medium">
                              <TableCell colSpan={2}>Total</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(report.summary.totalAmount)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(report.summary.totalVat)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(report.summary.totalWithheld)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(report.summary.totalNetAmount)}
                              </TableCell>
                              <TableCell className="text-right">
                                {report.summary.voucherCount}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="by-month">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="text-lg">Monthly Disbursement</CardTitle>
                      <CardDescription>
                        Month-by-month breakdown
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      onClick={exportMonthlySummaryCSV}
                      disabled={!report.byMonth?.length}
                      data-testid="button-export-by-month"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">VAT</TableHead>
                          <TableHead className="text-right">Withheld</TableHead>
                          <TableHead className="text-right">Net Amount</TableHead>
                          <TableHead className="text-right">Vouchers</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.byMonth?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              No data for the selected period
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {report.byMonth?.map((item, index) => {
                              const prevMonth = report.byMonth?.[index - 1];
                              const trend = prevMonth
                                ? ((item.amount - prevMonth.amount) / prevMonth.amount) * 100
                                : 0;

                              return (
                                <TableRow key={item.month} data-testid={`row-month-${item.month}`}>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      {formatMonth(item.month)}
                                      {index > 0 && (
                                        <span
                                          className={`text-xs flex items-center ${
                                            trend > 0 ? "text-destructive" : trend < 0 ? "text-green-600" : ""
                                          }`}
                                        >
                                          {trend > 0 ? (
                                            <TrendingUp className="h-3 w-3" />
                                          ) : trend < 0 ? (
                                            <TrendingDown className="h-3 w-3" />
                                          ) : null}
                                          {trend !== 0 && `${Math.abs(trend).toFixed(1)}%`}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatCurrency(item.amount)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatCurrency(item.vat)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatCurrency(item.withheld)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatCurrency(item.netAmount)}
                                  </TableCell>
                                  <TableCell className="text-right">{item.count}</TableCell>
                                </TableRow>
                              );
                            })}
                            <TableRow className="bg-muted/50 font-medium">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(report.summary.totalAmount)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(report.summary.totalVat)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(report.summary.totalWithheld)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(report.summary.totalNetAmount)}
                              </TableCell>
                              <TableCell className="text-right">
                                {report.summary.voucherCount}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
