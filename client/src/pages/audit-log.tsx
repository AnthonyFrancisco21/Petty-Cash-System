import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { History, Search, Filter, Download, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import type { User } from "@shared/schema";

interface AuditLogEntry {
  id: number;
  entityType: string;
  entityId: string;
  action: string;
  oldValue: any;
  newValue: any;
  userId: string | null;
  ipAddress: string | null;
  timestamp: string;
  description: string | null;
  user?: User | null;
}

export default function AuditLog() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");

  const {
    data: logsData,
    isLoading,
    refetch,
  } = useQuery<{ logs: AuditLogEntry[]; total: number }>({
    queryKey: ["/api/audit-logs"],
  });

  useEffect(() => {
    if (logsData === undefined && !isLoading) {
      toast({
        title: "Unauthorized",
        description: "You don't have permission to view audit logs.",
        variant: "destructive",
      });
      setTimeout(() => setLocation("/"), 500);
    }
  }, [logsData, isLoading, toast, setLocation]);

  const filteredLogs = logsData?.logs?.filter((log: AuditLogEntry) => {
    const matchesSearch =
      log.description?.toLowerCase().includes(search.toLowerCase()) ||
      log.entityId.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase());
    const matchesEntity =
      entityFilter === "all" || log.entityType === entityFilter;
    return matchesSearch && matchesEntity;
  });

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "created":
        return "default";
      case "approved":
        return "default";
      case "rejected":
        return "destructive";
      case "updated":
        return "secondary";
      case "deleted":
        return "destructive";
      case "attachment_added":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "voucher":
        return "V";
      case "fund":
        return "F";
      case "budget":
        return "B";
      case "replenishment":
        return "R";
      case "user":
        return "U";
      default:
        return "?";
    }
  };

  const exportToCSV = () => {
    if (!filteredLogs?.length) return;

    const headers = [
      "Timestamp",
      "User",
      "Entity Type",
      "Entity ID",
      "Action",
      "Description",
    ];
    const rows = filteredLogs.map((log) => [
      format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss"),
      log.user ? `${log.user.firstName} ${log.user.lastName}` : "System",
      log.entityType,
      log.entityId,
      log.action,
      log.description || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
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
            <History className="h-6 w-6" />
            Audit Trail
          </h1>
          <p className="text-muted-foreground mt-1">
            Track all changes and modifications in the system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            data-testid="button-refresh-logs"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={!filteredLogs?.length}
            data-testid="button-export-logs"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity Log</CardTitle>
          <CardDescription>
            {logsData?.total || 0} entries found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-logs"
              />
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger
                className="w-[180px]"
                data-testid="select-entity-filter"
              >
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="voucher">Vouchers</SelectItem>
                <SelectItem value="fund">Fund</SelectItem>
                <SelectItem value="budget">Budgets</SelectItem>
                <SelectItem value="replenishment">Replenishment</SelectItem>
                <SelectItem value="user">Users</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[150px]">User</TableHead>
                  <TableHead className="w-[100px]">Entity</TableHead>
                  <TableHead className="w-[100px]">Action</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs?.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No audit log entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs?.map((log) => (
                    <TableRow
                      key={log.id}
                      data-testid={`row-audit-log-${log.id}`}
                    >
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.timestamp), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        {log.user ? (
                          <span className="text-sm">
                            {log.user.firstName} {log.user.lastName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            System
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-xs font-medium">
                            {getEntityIcon(log.entityType)}
                          </div>
                          <span className="text-sm capitalize">
                            {log.entityType}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getActionBadgeVariant(log.action)}
                          className="capitalize"
                        >
                          {log.action.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.description ||
                          `${log.action} ${log.entityType} #${log.entityId}`}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
