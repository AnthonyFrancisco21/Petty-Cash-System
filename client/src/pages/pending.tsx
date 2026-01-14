import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Shield, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function PendingPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleLogout = async () => {
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
        description: "You have been successfully logged out.",
      });
      navigate("/");
    } catch (e) {
      console.error("Logout failed:", e);
      toast({
        title: "Logout failed",
        description: "An error occurred while logging out. Please try again.",
        variant: "destructive",
      });
      queryClient.setQueryData(["/api/auth/user"], null);
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
              <Clock className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">P CashManager</span>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              Account Pending Approval
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Welcome,{" "}
                <span className="font-medium text-foreground">
                  {user?.firstName} {user?.lastName}
                </span>
                !
              </p>
              <p className="text-sm text-muted-foreground">
                Your account has been created successfully, but you need to wait
                for admin approval before you can access the system.
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-medium text-amber-800 dark:text-amber-200">
                    What happens next?
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    An administrator will review your account and assign you the
                    appropriate role (Preparer, Approver, or Admin). You will
                    receive access once approved.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-4">
                Please check back later or contact your system administrator if
                you have questions.
              </p>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full"
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Secure petty cash management system
        </p>
      </div>
    </div>
  );
}
