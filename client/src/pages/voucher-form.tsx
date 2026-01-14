import { useForm, useFieldArray } from "react-hook-form";
import { useState } from "react";
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
import {
  CalendarIcon,
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
  File,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import type { User, ChartOfAccount } from "@shared/schema";

const voucherFormSchema = z.object({
  voucherNumber: z.string().min(1, "Voucher number is required"),
  date: z.date({ required_error: "Date is required" }),
  payee: z.string().min(1, "Payee is required"),
  items: z
    .array(
      z.object({
        description: z.string().min(1, "Description is required"),
        amount: z
          .string()
          .min(1, "Amount is required")
          .refine(
            (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
            "Amount must be a positive number"
          ),
        vatAmount: z.string().optional(),
        amountWithheld: z.string().optional(),
        chartOfAccountId: z.string().optional(),
      })
    )
    .min(1, "At least one item is required"),
});

type VoucherFormValues = z.infer<typeof voucherFormSchema>;

export default function VoucherForm() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [attachments, setAttachments] = useState<File[]>([]);

  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
    setAttachments: React.Dispatch<React.SetStateAction<File[]>>,
    toast: any
  ) => {
    const files = Array.from(event.target.files || []);
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
    ];

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    files.forEach((file) => {
      if (file.size > maxSize) {
        invalidFiles.push(`${file.name}: File size exceeds 10MB`);
      } else if (!allowedTypes.includes(file.type)) {
        invalidFiles.push(
          `${file.name}: Invalid file type. Only PDF, PNG, JPG allowed`
        );
      } else {
        validFiles.push(file);
      }
    });

    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid Files",
        description: invalidFiles.join("\n"),
        variant: "destructive",
      });
    }

    if (validFiles.length > 0) {
      setAttachments((prev) => [...prev, ...validFiles]);
    }

    // Reset the input
    event.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: chartOfAccounts, isLoading: coaLoading } = useQuery<
    ChartOfAccount[]
  >({
    queryKey: ["/api/chart-of-accounts"],
  });

  const approvers = users?.filter(
    (u) => u.role === "admin" || u.role === "preparer" || u.role === "approver"
  );

  const form = useForm<VoucherFormValues>({
    resolver: zodResolver(voucherFormSchema),
    defaultValues: {
      voucherNumber: "",
      date: new Date(),
      payee: "",
      items: [
        {
          description: "",
          amount: "",
          vatAmount: "",
          amountWithheld: "",
          chartOfAccountId: undefined,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const createVoucher = useMutation({
    mutationFn: async (data: VoucherFormValues) => {
      const payload = {
        voucherNumber: data.voucherNumber,
        date: data.date.toISOString(),
        payee: data.payee,
        items: data.items.map((item) => ({
          description: item.description,
          amount: item.amount,
          vatAmount: item.vatAmount || null,
          amountWithheld: item.amountWithheld || null,
          chartOfAccountId: item.chartOfAccountId
            ? parseInt(item.chartOfAccountId)
            : null,
        })),
        status: "pending",
      };
      const voucherResponse = await apiRequest(
        "POST",
        "/api/vouchers",
        payload
      );
      const voucher = await voucherResponse.json();

      // Upload attachments if any
      if (attachments.length > 0) {
        for (const file of attachments) {
          const formData = new FormData();
          formData.append("file", file);
          const attachmentResponse = await fetch(
            `/api/vouchers/${voucher.id}/attachments`,
            {
              method: "POST",
              body: formData,
              credentials: "include",
            }
          );
          if (!attachmentResponse.ok) {
            throw new Error("Failed to upload attachment");
          }
        }
      }

      return voucher;
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

  return (
    <div className="space-y-6 mx-auto max-w-3xl">
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
          {/* Header Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">
                Voucher Header
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="voucherNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voucher # *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter voucher number"
                        {...field}
                        data-testid="input-voucher-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                            {field.value
                              ? format(field.value, "PPP")
                              : "Pick a date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="start">
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
            </CardContent>
          </Card>

          {/* Line Items Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium">
                  Line Items
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      description: "",
                      amount: "",
                      vatAmount: "",
                      amountWithheld: "",
                      chartOfAccountId: "",
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="border rounded-lg p-4 space-y-4 relative"
                >
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 text-destructive hover:text-destructive"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Description *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter description of this item"
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.amount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount *</FormLabel>
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
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.vatAmount`}
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
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.amountWithheld`}
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
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.chartOfAccountId`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chart of Account</FormLabel>
                          {coaLoading ? (
                            <Skeleton className="h-10 w-full" />
                          ) : (
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select account code" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {chartOfAccounts?.map((coa) => (
                                  <SelectItem
                                    key={coa.id}
                                    value={coa.id.toString()}
                                  >
                                    <span className="font-mono">
                                      {coa.code}
                                    </span>{" "}
                                    - {coa.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Supporting Documents Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">
                Supporting Documents (Optional)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload receipts, invoices, or other supporting documents
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      className="cursor-pointer"
                      onClick={() =>
                        document.getElementById("file-upload")?.click()
                      }
                    >
                      <span className="mt-2 block text-sm font-medium text-gray-900">
                        Upload files
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        PDF, PNG, JPG up to 10MB each
                      </span>
                    </Button>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) =>
                        handleFileSelect(e, setAttachments, toast)
                      }
                    />
                  </div>
                </div>
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Selected Files:</h4>
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                    >
                      <div className="flex items-center space-x-2">
                        <File className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-900">
                          {file.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Total Amount Display */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Total Amount:</span>
                <span className="text-2xl font-bold text-primary">
                  PHP{" "}
                  {form
                    .watch("items")
                    ?.reduce((total, item) => {
                      const amount = parseFloat(item?.amount || "0");
                      return total + amount;
                    }, 0)
                    .toFixed(2) || "0.00"}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-4 pb-6">
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
