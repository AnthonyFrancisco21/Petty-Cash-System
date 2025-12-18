import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarIcon, ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { User, ChartOfAccount } from "@shared/schema";

const voucherFormSchema = z.object({
  date: z.date({ required_error: "Date is required" }),
  payee: z.string().min(1, "Payee is required"),
  description: z.string().min(1, "Description is required"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Amount must be a positive number"
  ),
  invoiceNumber: z.string().optional(),
  amountNetOfVat: z.string().optional(),
  vatAmount: z.string().optional(),
  amountWithheld: z.string().optional(),
  chartOfAccountId: z.string().optional(),
  approvedById: z.string().optional(),
});

type VoucherFormValues = z.infer<typeof voucherFormSchema>;

export default function VoucherForm() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: chartOfAccounts, isLoading: coaLoading } = useQuery<ChartOfAccount[]>({
    queryKey: ["/api/chart-of-accounts"],
  });

  const approvers = users?.filter(
    (u) => u.role === "approver" || u.role === "admin" || u.role === "cash_manager"
  );

  const form = useForm<VoucherFormValues>({
    resolver: zodResolver(voucherFormSchema),
    defaultValues: {
      date: new Date(),
      payee: "",
      description: "",
      amount: "",
      invoiceNumber: "",
      amountNetOfVat: "",
      vatAmount: "",
      amountWithheld: "",
      chartOfAccountId: "",
      approvedById: "",
    },
  });

  const createVoucher = useMutation({
    mutationFn: async (data: VoucherFormValues) => {
      const payload = {
        date: data.date.toISOString(),
        payee: data.payee,
        description: data.description,
        amount: data.amount,
        invoiceNumber: data.invoiceNumber || null,
        amountNetOfVat: data.amountNetOfVat || null,
        vatAmount: data.vatAmount || null,
        amountWithheld: data.amountWithheld || null,
        chartOfAccountId: data.chartOfAccountId ? parseInt(data.chartOfAccountId) : null,
        approvedById: data.approvedById || null,
        status: "pending",
      };
      return await apiRequest("POST", "/api/vouchers", payload);
    },
    onSuccess: () => {
      toast({
        title: "Voucher Created",
        description: "The petty cash voucher has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fund"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vouchers/stats"] });
      navigate("/vouchers");
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
        description: "Failed to create voucher. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: VoucherFormValues) => {
    createVoucher.mutate(data);
  };

  const handleVatCalculation = (netAmount: string, vatAmount: string) => {
    const net = parseFloat(netAmount) || 0;
    const vat = parseFloat(vatAmount) || 0;
    if (net > 0 || vat > 0) {
      form.setValue("amount", (net + vat).toFixed(2));
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/vouchers")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-semibold">New Voucher</h1>
          <p className="text-muted-foreground mt-1">
            Create a new petty cash disbursement voucher
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="button-date-picker"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payee (Particulars) *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter payee name"
                        {...field}
                        data-testid="input-payee"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter description of the disbursement"
                        className="resize-none"
                        {...field}
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Financial Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Amount *</FormLabel>
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
                          data-testid="input-amount"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice / Cash Voucher #</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter invoice number"
                        {...field}
                        data-testid="input-invoice-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amountNetOfVat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount Net of VAT</FormLabel>
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
                          onChange={(e) => {
                            field.onChange(e);
                            handleVatCalculation(e.target.value, form.getValues("vatAmount") || "0");
                          }}
                          data-testid="input-net-of-vat"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vatAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VAT Amount</FormLabel>
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
                          onChange={(e) => {
                            field.onChange(e);
                            handleVatCalculation(form.getValues("amountNetOfVat") || "0", e.target.value);
                          }}
                          data-testid="input-vat-amount"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amountWithheld"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount Withheld</FormLabel>
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
                          data-testid="input-amount-withheld"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="chartOfAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chart of Account</FormLabel>
                    {coaLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-chart-of-account">
                            <SelectValue placeholder="Select account code" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {chartOfAccounts?.map((coa) => (
                            <SelectItem key={coa.id} value={coa.id.toString()}>
                              <span className="font-mono">{coa.code}</span> - {coa.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Approval</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="approvedById"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Approved By</FormLabel>
                    {usersLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-approver">
                            <SelectValue placeholder="Select approver" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {approvers?.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/vouchers")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createVoucher.isPending}
              data-testid="button-submit-voucher"
            >
              {createVoucher.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Voucher
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
