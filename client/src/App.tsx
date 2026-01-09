import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import AuthPage from "@/pages/auth";
import Dashboard from "@/pages/dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import Vouchers from "@/pages/vouchers";
import VoucherForm from "@/pages/voucher-form";
import Approvals from "@/pages/approvals";
import Replenishment from "@/pages/replenishment";
import UsersPage from "@/pages/users";
import SettingsPage from "@/pages/settings";
import AuditLog from "@/pages/audit-log";
import Budgets from "@/pages/budgets";
import Reports from "@/pages/reports";
import ChartOfAccounts from "@/pages/chart-of-accounts";
import {
  hasAdminAccess,
  canManageUsers,
  canApproveVouchers,
  canCreateVouchers,
} from "@/lib/roleUtils";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const sidebarStyle = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                data-testid="button-logout"
                onClick={() => setLogoutConfirmOpen(true)}
              >
                <LogOut className="h-4 w-4" />
              </Button>
              <AlertDialog
                open={logoutConfirmOpen}
                onOpenChange={setLogoutConfirmOpen}
              >
                <AlertDialogContent>
                  <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to log out? You will need to log in
                    again to access your account.
                  </AlertDialogDescription>
                  <div className="flex gap-2 justify-end">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          const response = await fetch("/api/logout", {
                            method: "POST",
                            credentials: "include",
                          });
                          if (!response.ok) {
                            throw new Error("Logout failed");
                          }
                          // Invalidate all queries to clear cache
                          await queryClient.invalidateQueries();
                          queryClient.setQueryData(["/api/auth/user"], null);
                          toast({
                            title: "Logged out",
                            description:
                              "You have been successfully logged out.",
                          });
                          setLogoutConfirmOpen(false);
                        } catch (e) {
                          console.error("Logout failed:", e);
                          toast({
                            title: "Logout failed",
                            description:
                              "An error occurred while logging out. Please try again.",
                            variant: "destructive",
                          });
                          queryClient.setQueryData(["/api/auth/user"], null);
                        } finally {
                          navigate("/");
                        }
                      }}
                    >
                      Logout
                    </AlertDialogAction>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6 md:p-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/auth" component={AuthPage} />
        <Route component={Landing} />
      </Switch>
    );
  }

  const isAdmin = hasAdminAccess(user?.role || "");
  const isPreparer = user?.role === "preparer";
  const isApprover = user?.role === "approver";

  return (
    <AuthenticatedLayout>
      <Switch>
        {/* Dashboard Routes - Role Specific */}
        {isAdmin && <Route path="/" component={AdminDashboard} />}
        {(isPreparer || isApprover) && <Route path="/" component={Dashboard} />}

        {/* Vouchers Routes - Preparer & Approver Only */}
        {(isPreparer || isApprover) && (
          <Route path="/vouchers" component={Vouchers} />
        )}

        {/* Preparer Routes */}
        {isPreparer && <Route path="/vouchers/new" component={VoucherForm} />}
        {isPreparer && (
          <Route path="/chart-of-accounts" component={ChartOfAccounts} />
        )}
        {isPreparer && (
          <Route path="/replenishment" component={Replenishment} />
        )}
        {isPreparer && <Route path="/budgets" component={Budgets} />}
        {isPreparer && <Route path="/reports" component={Reports} />}

        {/* Approver Routes */}
        {isApprover && <Route path="/approvals" component={Approvals} />}
        {isApprover && <Route path="/audit-log" component={AuditLog} />}

        {/* Admin Routes */}
        {isAdmin && <Route path="/users" component={UsersPage} />}
        {isAdmin && <Route path="/settings" component={SettingsPage} />}
        {isAdmin && <Route path="/audit-log" component={AuditLog} />}

        <Route component={NotFound} />
      </Switch>
    </AuthenticatedLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="pcashmanager-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
