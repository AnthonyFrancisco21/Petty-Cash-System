import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Settings,
  Shield,
  Database,
  Server,
  Key,
  Clock,
  Activity,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import type { User, AuditLog } from "@shared/schema";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  systemHealth: string;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  isLoading,
}: {
  title: string;
  value: string | number;
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
          <div className="font-mono text-2xl font-semibold">{value}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: auditLogs = [], isLoading: logsLoading } = useQuery<AuditLog[]>(
    {
      queryKey: ["/api/audit-logs"],
    }
  );

  // Calculate stats
  const totalUsers = users.length;
  const admins = users.filter((u) => u.role === "admin").length;
  const preparers = users.filter((u) => u.role === "preparer").length;
  const approvers = users.filter((u) => u.role === "approver").length;

  // Get recent activity
  const recentActivity = auditLogs.slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          System administration and technical management
        </p>
      </div>

      {/* System Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={totalUsers}
          icon={Users}
          description="Total system users"
          isLoading={usersLoading}
        />
        <StatCard
          title="Administrators"
          value={admins}
          icon={Shield}
          description="Admin accounts"
          isLoading={usersLoading}
        />
        <StatCard
          title="Preparers"
          value={preparers}
          icon={Database}
          description="Active preparers"
          isLoading={usersLoading}
        />
        <StatCard
          title="Approvers"
          value={approvers}
          icon={Key}
          description="Active approvers"
          isLoading={usersLoading}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>Manage system users and roles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Users</span>
                <Badge variant="outline">{totalUsers}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Role Distribution</span>
                <Badge variant="secondary">
                  {admins}A • {preparers}P • {approvers}A
                </Badge>
              </div>
            </div>
            <Link href="/users">
              <Button className="w-full">
                <Users className="h-4 w-4 mr-2" />
                Manage Users
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Settings
            </CardTitle>
            <CardDescription>Configure system parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">System Status</span>
                <Badge variant="default" className="bg-green-600">
                  <Activity className="h-3 w-3 mr-1" />
                  Operational
                </Badge>
              </div>
            </div>
            <Link href="/settings">
              <Button className="w-full">
                <Settings className="h-4 w-4 mr-2" />
                System Config
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent System Activity
          </CardTitle>
          <CardDescription>Latest system events and changes</CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between border-b pb-3 last:border-0"
                >
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-medium">
                      {log.entityType}: {log.action}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.description || `${log.entityType} ${log.action}`}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge variant="outline" className="text-xs">
                      {log.action}
                    </Badge>
                    <p className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {format(new Date(log.timestamp), "MMM d, HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No recent activity</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Database Status</p>
              <Badge variant="default" className="bg-blue-600">
                Connected
              </Badge>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">API Status</p>
              <Badge variant="default" className="bg-green-600">
                Operational
              </Badge>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Last Backup</p>
              <p className="text-sm font-medium">
                {format(new Date(), "MMM d, yyyy HH:mm")}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">System Version</p>
              <p className="text-sm font-medium">1.0.0</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
