import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PiggyBank, Plus, AlertTriangle, TrendingUp, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ChartOfAccount } from "@shared/schema";

interface BudgetWithDetails {
  id: number;
  chartOfAccountId: number;
  budgetAmount: string;
  period: string;
  startDate: string;
  endDate: string;
  alertThreshold: string;
  chartOfAccount?: ChartOfAccount;
  currentSpending: string;
  percentageUsed: string;
}

const budgetFormSchema = z.object({
  chartOfAccountId: z.string().min(1, "Please select an account"),
  budgetAmount: z.string().min(1, "Budget amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Amount must be a positive number"
  ),
  period: z.string().min(1, "Period is required"),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date({ required_error: "End date is required" }),
  alertThreshold: z.string().default("80"),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
  }).format(num);
}

export default function Budgets() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: budgets, isLoading: budgetsLoading } = useQuery<BudgetWithDetails[]>({
    queryKey: ["/api/budgets"],
  });

  const { data: accounts, isLoading: accountsLoading } = useQuery<ChartOfAccount[]>({
    queryKey: ["/api/chart-of-accounts"],
  });

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      chartOfAccountId: "",
      budgetAmount: "",
      period: "monthly",
      alertThreshold: "80",
    },
  });

  const createBudget = useMutation({
    mutationFn: async (data: BudgetFormValues) => {
      return await apiRequest("POST", "/api/budgets", {
        ...data,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Budget Created",
        description: "The budget has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setIsDialogOpen(false);
      form.reset();
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
        description: "Failed to create budget.",
        variant: "destructive",
      });
    },
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/budgets/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Budget Deleted",
        description: "The budget has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
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
        description: "Failed to delete budget.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BudgetFormValues) => {
    createBudget.mutate(data);
  };

  const isLoading = budgetsLoading || accountsLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const overBudgetCount = budgets?.filter(
    (b) => parseFloat(b.percentageUsed) >= parseFloat(b.alertThreshold)
  ).length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <PiggyBank className="h-6 w-6" />
            Budget Tracking
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor spending limits by chart of account
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-budget">
              <Plus className="h-4 w-4 mr-2" />
              Add Budget
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Budget</DialogTitle>
              <DialogDescription>
                Set a spending limit for a chart of account
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="chartOfAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chart of Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-budget-account">
                            <SelectValue placeholder="Select an account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accounts?.map((account) => (
                            <SelectItem
                              key={account.id}
                              value={account.id.toString()}
                            >
                              {account.code} - {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="budgetAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          data-testid="input-budget-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="period"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-budget-period">
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                            data-testid="input-budget-start-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                            data-testid="input-budget-end-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="alertThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alert Threshold (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          placeholder="80"
                          {...field}
                          data-testid="input-alert-threshold"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createBudget.isPending}
                  data-testid="button-submit-budget"
                >
                  {createBudget.isPending ? "Creating..." : "Create Budget"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {overBudgetCount > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Budget Alert</p>
                <p className="text-sm text-muted-foreground">
                  {overBudgetCount} budget(s) have exceeded their alert threshold
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets?.map((budget) => {
          const percentageUsed = parseFloat(budget.percentageUsed);
          const isOverThreshold = percentageUsed >= parseFloat(budget.alertThreshold);
          const isOverBudget = percentageUsed >= 100;

          return (
            <Card
              key={budget.id}
              className={isOverBudget ? "border-destructive" : isOverThreshold ? "border-yellow-500" : ""}
              data-testid={`card-budget-${budget.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {budget.chartOfAccount?.code || "Unknown"}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {budget.chartOfAccount?.name || "Unknown Account"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteBudget.mutate(budget.id)}
                    disabled={deleteBudget.isPending}
                    data-testid={`button-delete-budget-${budget.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Spent</span>
                    <span className="font-mono font-medium">
                      {formatCurrency(budget.currentSpending)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Budget</span>
                    <span className="font-mono font-medium">
                      {formatCurrency(budget.budgetAmount)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Progress
                    value={Math.min(percentageUsed, 100)}
                    className={`h-2 ${isOverBudget ? "[&>div]:bg-destructive" : isOverThreshold ? "[&>div]:bg-yellow-500" : ""}`}
                  />
                  <div className="flex justify-between items-center">
                    <Badge
                      variant={isOverBudget ? "destructive" : isOverThreshold ? "secondary" : "outline"}
                    >
                      {percentageUsed.toFixed(1)}% used
                    </Badge>
                    <span className="text-xs text-muted-foreground capitalize">
                      {budget.period}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground pt-2 border-t">
                  {format(new Date(budget.startDate), "MMM d")} -{" "}
                  {format(new Date(budget.endDate), "MMM d, yyyy")}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {budgets?.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="pt-6 text-center text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No budgets set up yet</p>
              <p className="text-sm mt-1">Create a budget to track spending limits</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
