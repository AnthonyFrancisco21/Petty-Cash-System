import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FileText,
  RefreshCw,
  Users,
  Settings,
  Wallet,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import type { PettyCashFund } from "@shared/schema";

const mainNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Vouchers", url: "/vouchers", icon: FileText },
  { title: "Replenishment", url: "/replenishment", icon: RefreshCw },
];

const adminNavItems = [
  { title: "Users", url: "/users", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
];

function getRoleLabel(role: string): string {
  switch (role) {
    case "cash_manager":
      return "Cash Manager";
    case "approver":
      return "Approver";
    case "admin":
      return "Admin";
    default:
      return "Requester";
  }
}

function getRoleVariant(role: string): "default" | "secondary" | "outline" {
  switch (role) {
    case "cash_manager":
    case "admin":
      return "default";
    case "approver":
      return "secondary";
    default:
      return "outline";
  }
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const { data: fund } = useQuery<PettyCashFund>({
    queryKey: ["/api/fund"],
    retry: false,
  });

  const isAdmin = user?.role === "admin" || user?.role === "cash_manager";
  const depletionPercentage = fund
    ? (1 - parseFloat(fund.currentBalance) / parseFloat(fund.imprestAmount)) * 100
    : 0;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold">P CashManager</span>
            <span className="text-xs text-muted-foreground">Petty Cash System</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {fund && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupLabel>Fund Status</SidebarGroupLabel>
            <SidebarGroupContent className="px-2">
              <div className="rounded-md bg-sidebar-accent p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Balance
                  </span>
                  <span className="font-mono text-sm font-semibold" data-testid="text-sidebar-balance">
                    {parseFloat(fund.currentBalance).toLocaleString("en-US", {
                      style: "currency",
                      currency: "PHP",
                    })}
                  </span>
                </div>
                <Progress value={100 - depletionPercentage} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{(100 - depletionPercentage).toFixed(1)}% remaining</span>
                  <span>
                    of{" "}
                    {parseFloat(fund.imprestAmount).toLocaleString("en-US", {
                      style: "currency",
                      currency: "PHP",
                    })}
                  </span>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        {user && (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage
                src={user.profileImageUrl || undefined}
                alt={`${user.firstName} ${user.lastName}`}
                className="object-cover"
              />
              <AvatarFallback>
                {user.firstName?.[0]}
                {user.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium truncate" data-testid="text-user-name">
                {user.firstName} {user.lastName}
              </span>
              <Badge
                variant={getRoleVariant(user.role)}
                className="w-fit text-xs"
                data-testid="badge-user-role"
              >
                {getRoleLabel(user.role)}
              </Badge>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
