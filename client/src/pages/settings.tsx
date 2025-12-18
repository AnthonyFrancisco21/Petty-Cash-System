import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Settings, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { PettyCashFund, ChartOfAccount } from "@shared/schema";
import { useState } from "react";

const fundSettingsSchema = z.object({
  imprestAmount: z.string().min(1, "Imprest amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Amount must be a positive number"
  ),
});

const chartOfAccountSchema = z.object({
  code: z.string().min(1, "Account code is required"),
  name: z.string().min(1, "Account name is required"),
  description: z.string().optional(),
});

type FundSettingsValues = z.infer<typeof fundSettingsSchema>;
type ChartOfAccountValues = z.infer<typeof chartOfAccountSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const [coaDialogOpen, setCoaDialogOpen] = useState(false);

  const { data: fund, isLoading: fundLoading } = useQuery<PettyCashFund>({
    queryKey: ["/api/fund"],
  });

  const { data: chartOfAccounts, isLoading: coaLoading } = useQuery<ChartOfAccount[]>({
    queryKey: ["/api/chart-of-accounts"],
  });

  const fundForm = useForm<FundSettingsValues>({
    resolver: zodResolver(fundSettingsSchema),
    defaultValues: {
      imprestAmount: fund?.imprestAmount || "",
    },
    values: {
      imprestAmount: fund?.imprestAmount || "",
    },
  });

  const coaForm = useForm<ChartOfAccountValues>({
    resolver: zodResolver(chartOfAccountSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
    },
  });

  const updateFund = useMutation({
    mutationFn: async (data: FundSettingsValues) => {
      if (fund) {
        return await apiRequest("PATCH", `/api/fund/${fund.id}`, {
          imprestAmount: data.imprestAmount,
        });
      } else {
        return await apiRequest("POST", "/api/fund", {
          imprestAmount: data.imprestAmount,
          currentBalance: data.imprestAmount,
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Fund settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/fund"] });
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
        description: "Failed to save fund settings.",
        variant: "destructive",
      });
    },
  });

  const createCoa = useMutation({
    mutationFn: async (data: ChartOfAccountValues) => {
      return await apiRequest("POST", "/api/chart-of-accounts", data);
    },
    onSuccess: () => {
      toast({
        title: "Account Created",
        description: "Chart of account has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chart-of-accounts"] });
      coaForm.reset();
      setCoaDialogOpen(false);
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
        description: "Failed to create chart of account.",
        variant: "destructive",
      });
    },
  });

  const deleteCoa = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/chart-of-accounts/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Account Deleted",
        description: "Chart of account has been deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chart-of-accounts"] });
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
        description: "Failed to delete chart of account.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure petty cash fund and chart of accounts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Fund Configuration</CardTitle>
          <CardDescription>
            Set the imprest amount for your petty cash fund
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fundLoading ? (
            <Skeleton className="h-10 w-full max-w-xs" />
          ) : (
            <Form {...fundForm}>
              <form
                onSubmit={fundForm.handleSubmit((data) => updateFund.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={fundForm.control}
                  name="imprestAmount"
                  render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <FormLabel>Imprest Amount</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            PHP
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="pl-12 text-right font-mono"
                            {...field}
                            data-testid="input-imprest-amount"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        The target amount for your petty cash fund
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={updateFund.isPending}
                  data-testid="button-save-fund"
                >
                  {updateFund.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-medium">Chart of Accounts</CardTitle>
            <CardDescription>
              Manage account codes for expense categorization
            </CardDescription>
          </div>
          <Dialog open={coaDialogOpen} onOpenChange={setCoaDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-account">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Chart of Account</DialogTitle>
                <DialogDescription>
                  Create a new account code for expense categorization
                </DialogDescription>
              </DialogHeader>
              <Form {...coaForm}>
                <form
                  onSubmit={coaForm.handleSubmit((data) => createCoa.mutate(data))}
                  className="space-y-4"
                >
                  <FormField
                    control={coaForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., 6010"
                            className="font-mono"
                            {...field}
                            data-testid="input-account-code"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={coaForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Office Supplies"
                            {...field}
                            data-testid="input-account-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={coaForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Brief description"
                            {...field}
                            data-testid="input-account-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createCoa.isPending}
                      data-testid="button-create-account"
                    >
                      {createCoa.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Create Account
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {coaLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : chartOfAccounts && chartOfAccounts.length > 0 ? (
            <div className="space-y-2">
              {chartOfAccounts.map((coa) => (
                <div
                  key={coa.id}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                  data-testid={`row-account-${coa.id}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm font-medium bg-background px-2 py-1 rounded">
                      {coa.code}
                    </span>
                    <div>
                      <p className="font-medium">{coa.name}</p>
                      {coa.description && (
                        <p className="text-sm text-muted-foreground">
                          {coa.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteCoa.mutate(coa.id)}
                    disabled={deleteCoa.isPending}
                    data-testid={`button-delete-account-${coa.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Settings className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No chart of accounts defined</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add account codes to categorize your disbursements
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
