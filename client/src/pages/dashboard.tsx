import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  TrendingDown,
  FileText,
  Clock,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import type { PettyCashFund, VoucherWithRelations } from "@shared/schema";
import { format } from "date-fns";

function formatCurrency(amount: string | number): string {
  return parseFloat(String(amount)).toLocaleString("en-US", {
    style: "currency",
    currency: "PHP",
  });
}

function getStatusVariant(
  status: string
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

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  isLoading,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div
            className="font-mono text-2xl font-semibold"
            data-testid={`text-stat-${title.toLowerCase().replace(/\s/g, "-")}`}
          >
            {value}
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isCashManager = user?.role === "preparer" || user?.role === "admin";

  const { data: fund, isLoading: fundLoading } = useQuery<PettyCashFund>({
    queryKey: ["/api/fund"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalDisbursed: string;
    pendingCount: number;
    approvedCount: number;
  }>({
    queryKey: ["/api/vouchers/stats"],
  });

  const { data: recentVouchers, isLoading: vouchersLoading } = useQuery<
    VoucherWithRelations[]
  >({
    queryKey: ["/api/vouchers", { limit: 5 }],
  });

  const depletionPercentage = fund
    ? (1 - parseFloat(fund.currentBalance) / parseFloat(fund.imprestAmount)) *
      100
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user?.firstName || "User"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/vouchers/new">
            <Button data-testid="button-new-disbursement">
              <Plus className="h-4 w-4 mr-2" />
              New Disbursement
            </Button>
          </Link>
          {isCashManager && (
            <Link href="/replenishment">
              <Button variant="outline" data-testid="button-replenishment">
                <RefreshCw className="h-4 w-4 mr-2" />
                Request Replenishment
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Current Balance"
          value={fund ? formatCurrency(fund.currentBalance) : "-"}
          icon={Wallet}
          description={
            fund
              ? `${(100 - depletionPercentage).toFixed(1)}% remaining`
              : undefined
          }
          isLoading={fundLoading}
        />
        <StatCard
          title="Imprest Amount"
          value={fund ? formatCurrency(fund.imprestAmount) : "-"}
          icon={TrendingDown}
          description="Target fund level"
          isLoading={fundLoading}
        />
        <StatCard
          title="Total Disbursed"
          value={stats ? formatCurrency(stats.totalDisbursed) : "-"}
          icon={FileText}
          description={`${stats?.approvedCount || 0} approved vouchers`}
          isLoading={statsLoading}
        />
        <StatCard
          title="Pending Approvals"
          value={stats?.pendingCount?.toString() || "0"}
          icon={Clock}
          description="Awaiting review"
          isLoading={statsLoading}
        />
      </div>

      {fund && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">
              Fund Depletion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={100 - depletionPercentage} className="h-3" />
            <div className="flex items-center justify-between text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Remaining</p>
                <p
                  className="font-mono font-semibold"
                  data-testid="text-remaining-balance"
                >
                  {formatCurrency(fund.currentBalance)}
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-muted-foreground">Disbursed</p>
                <p
                  className="font-mono font-semibold"
                  data-testid="text-disbursed-amount"
                >
                  {formatCurrency(
                    parseFloat(fund.imprestAmount) -
                      parseFloat(fund.currentBalance)
                  )}
                </p>
              </div>
            </div>
            {depletionPercentage >= 75 && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
                <TrendingDown className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Fund is {depletionPercentage.toFixed(0)}% depleted. Consider
                  requesting replenishment.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg font-medium">
            Recent Disbursements
          </CardTitle>
          <Link href="/vouchers">
            <Button
              variant="ghost"
              size="sm"
              data-testid="link-view-all-vouchers"
            >
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {vouchersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : recentVouchers && recentVouchers.length > 0 ? (
            <div className="space-y-4">
              {recentVouchers.map((voucher) => (
                <div
                  key={voucher.id}
                  className="flex items-center gap-4 p-3 rounded-md hover-elevate"
                  data-testid={`row-voucher-${voucher.id}`}
                >
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {voucher.payee}
                      </span>
                      <Badge variant={getStatusVariant(voucher.status)}>
                        {voucher.status === "approved" && (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        )}
                        {voucher.status === "rejected" && (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {voucher.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {voucher.voucherNumber} -{" "}
                      {voucher.items?.[0]?.description || ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold">
                      {formatCurrency(voucher.totalAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(voucher.date), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No disbursements yet</p>
              <Link href="/vouchers/new">
                <Button
                  variant="outline"
                  className="mt-4"
                  data-testid="button-create-first-voucher"
                >
                  Create First Voucher
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
