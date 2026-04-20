import { useForm, useFieldArray } from "react-hook-form";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import {
  CalendarIcon,
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
  File,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import type { User, ChartOfAccount } from "@shared/schema";

// ============================================================
// SCHEMA
// ============================================================
// Category is now at the VOUCHER level — one category per voucher.
// Each item has TWO open amount fields simultaneously:
//   nonVatAmount       → the non-vatable portion of the receipt
//   vatableGrossAmount → the gross amount including VAT (e.g. 1,120 for a 1,000 + 12% VAT)
//
// Tax type is auto-determined by what the user fills in:
//   • only nonVatAmount filled      → purely Non-VAT
//   • only vatableGrossAmount filled → purely Vatable
//   • both filled                   → Mixed (one receipt, two portions)
// ============================================================

const voucherFormSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  voucherNumber: z.string().min(1, "Voucher number is required"),
  date: z.date({ required_error: "Date is required" }),
  payee: z.string().min(1, "Payee is required"),
  // ✅ Category lives at the voucher level, not per-item
  category: z.enum(["Exp", "Cost", "Asset"]).default("Exp"),
  items: z
    .array(
      z
        .object({
          description: z.string().min(1, "Description is required"),
          // Non-vatable portion — leave blank if receipt has no non-vat amount
          nonVatAmount: z.string().optional(),
          // Gross amount INCLUDING VAT — leave blank if nothing is vatable
          vatableGrossAmount: z.string().optional(),
          // VAT rate, only relevant if vatableGrossAmount > 0
          vatPercent: z.string().optional(),
          // EWT is computed on the total base (nonVat + vatableBase)
          ewtPercent: z.string().optional(),
          chartOfAccountId: z.string().optional(),
        })
        .refine(
          (item) => {
            const nonVat = parseFloat(item.nonVatAmount || "0");
            const vatableGross = parseFloat(item.vatableGrossAmount || "0");
            return nonVat > 0 || vatableGross > 0;
          },
          {
            message:
              "Each item needs at least one amount: Non-VAT and/or Vatable Gross.",
          },
        ),
    )
    .min(1, "At least one item is required"),
});

type VoucherFormValues = z.infer<typeof voucherFormSchema>;

// ============================================================
// MATH HELPER
// ============================================================
// The preparer enters what is on the official receipt (OR):
//   • For non-vat purchases: the face value (e.g. 500 for taxi)
//   • For vatable purchases: the GROSS on the OR (e.g. 1,120 = 1,000 base + 120 VAT)
//   • For mixed: both of the above
//
// We back-calculate the vatable base: vatableBase = vatableGross / (1 + vat%)
// EWT is applied on the TOTAL BASE = nonVat + vatableBase
// ============================================================
const computeItemMath = (item: any) => {
  const nonVat = parseFloat(item?.nonVatAmount || "0");
  const vatableGross = parseFloat(item?.vatableGrossAmount || "0");
  const vatP = parseFloat(item?.vatPercent || "12");
  const ewtP = parseFloat(item?.ewtPercent || "0");

  // Back-calculate vatable base from gross
  const vatableBase = vatableGross > 0 ? vatableGross / (1 + vatP / 100) : 0;
  const vat = vatableGross - vatableBase;
  const totalBase = nonVat + vatableBase; // total pre-tax base (for EWT)
  const ewt = (totalBase * ewtP) / 100;
  // Net cash = what the vendor actually receives
  const netCash = nonVat + vatableGross - ewt;

  // Determine the display label for the badge
  const hasNonVat = nonVat > 0;
  const hasVatable = vatableGross > 0;
  const taxLabel =
    hasNonVat && hasVatable
      ? "Mixed (VAT + Non-VAT)"
      : hasVatable
        ? "Vatable"
        : "Non-VAT";

  return { nonVat, vatableBase, vat, totalBase, ewt, netCash, taxLabel };
};

// ============================================================
// COMPONENT
// ============================================================
export default function VoucherForm() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const maxSize = 10 * 1024 * 1024;
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
        invalidFiles.push(`${file.name}: Exceeds 10MB limit`);
      } else if (!allowedTypes.includes(file.type)) {
        invalidFiles.push(`${file.name}: Only PDF, PNG, JPG allowed`);
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
    event.target.value = "";
  };

  const removeAttachment = (index: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== index));

  const { data: chartOfAccounts, isLoading: coaLoading } = useQuery<
    ChartOfAccount[]
  >({
    queryKey: ["/api/chart-of-accounts"],
  });

  const form = useForm<VoucherFormValues>({
    resolver: zodResolver(voucherFormSchema),
    defaultValues: {
      companyName: "",
      voucherNumber: "",
      date: new Date(),
      payee: "",
      category: "Exp",
      items: [
        {
          description: "",
          nonVatAmount: "",
          vatableGrossAmount: "",
          vatPercent: "12",
          ewtPercent: "0",
          chartOfAccountId: "",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // ============================================================
  // MUTATION — build payload and submit
  // ============================================================
  const createVoucher = useMutation({
    mutationFn: async (data: VoucherFormValues) => {
      const payload = {
        companyName: data.companyName,
        voucherNumber: data.voucherNumber,
        date: data.date.toISOString(),
        payee: data.payee,
        category: data.category, // ← voucher-level category
        items: data.items.map((item) => {
          const { nonVat, vatableBase, vat, ewt } = computeItemMath(item);
          return {
            description: item.description,
            // ← nonVatAmount is the non-vatable base amount
            nonVatAmount: nonVat > 0 ? nonVat.toFixed(2) : null,
            // ← amount is now STRICTLY the vatable base (for the DB)
            amount: vatableBase.toFixed(2),
            vatAmount: vat > 0 ? vat.toFixed(2) : null,
            amountWithheld: ewt > 0 ? ewt.toFixed(2) : null,
            chartOfAccountId: item.chartOfAccountId
              ? parseInt(item.chartOfAccountId)
              : null,
          };
        }),
        status: "pending",
      };

      const voucherResponse = await apiRequest(
        "POST",
        "/api/vouchers",
        payload,
      );
      const voucher = await voucherResponse.json();

      if (attachments.length > 0) {
        for (const file of attachments) {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch(`/api/vouchers/${voucher.id}/attachments`, {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          if (!res.ok) throw new Error("Failed to upload attachment");
        }
      }

      return voucher;
    },
    onSuccess: () => {
      toast({
        title: "Voucher Created",
        description: "The petty cash voucher has been submitted for approval.",
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
        description:
          (error as any)?.message || "Failed to create voucher. Try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: VoucherFormValues) => createVoucher.mutate(data);

  // Live watch for summary computations
  const watchItems = form.watch("items");
  const watchCategory = form.watch("category");

  let totalNonVatBase = 0;
  let totalVatableBase = 0;
  let totalVat = 0;
  let totalEwt = 0;
  let totalNetCash = 0;

  watchItems?.forEach((item) => {
    const { nonVat, vatableBase, vat, ewt, netCash } = computeItemMath(item);
    totalNonVatBase += nonVat;
    totalVatableBase += vatableBase;
    totalVat += vat;
    totalEwt += ewt;
    totalNetCash += netCash;
  });

  const totalGross = totalNonVatBase + totalVatableBase + totalVat;

  const categoryLabel: Record<string, string> = {
    Exp: "Expense",
    Cost: "Cost / WIP",
    Asset: "Asset",
  };

  return (
    <div className="space-y-6 mx-auto max-w-3xl">
      {/* Page title */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/vouchers")}
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
          {/* ─── VOUCHER HEADER ─────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">
                Voucher Header
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Company Name */}
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem className="lg:col-span-4">
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Voucher Number */}
              <FormField
                control={form.control}
                name="voucherNumber"
                render={({ field }) => (
                  <FormItem className="lg:col-span-2">
                    <FormLabel>Voucher # *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. PCV-2501-0001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="lg:col-span-2">
                    <FormLabel>Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground",
                            )}
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

              {/* Payee */}
              <FormField
                control={form.control}
                name="payee"
                render={({ field }) => (
                  <FormItem className="lg:col-span-3">
                    <FormLabel>Payee (Vendor / Supplier) *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter payee name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ✅ CATEGORY — moved here from the per-item level */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="lg:col-span-1">
                    <FormLabel>Category *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Exp">Expense</SelectItem>
                        <SelectItem value="Cost">Cost / WIP</SelectItem>
                        <SelectItem value="Asset">Asset</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ─── LINE ITEMS ──────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-medium">
                    Line Items
                    <Badge
                      variant="outline"
                      className="ml-2 text-xs font-normal"
                    >
                      {categoryLabel[watchCategory] ?? watchCategory}
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the amount from the Official Receipt. Fill only the
                    fields that apply to each line.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      description: "",
                      nonVatAmount: "",
                      vatableGrossAmount: "",
                      vatPercent: "12",
                      ewtPercent: "0",
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
              {/* Legend */}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 border">
                <span className="flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  <strong>Non-VAT Amount</strong> — the portion with no VAT
                  (e.g. transport, government fees)
                </span>
                <span className="flex items-center gap-1">
                  <strong>Vatable Gross</strong> — the OR total including VAT
                  (e.g. ₱1,120 for a ₱1,000 + 12% VAT purchase)
                </span>
              </div>

              {fields.map((field, index) => {
                const currentItem = watchItems?.[index];
                const { nonVat, vatableBase, vat, ewt, netCash, taxLabel } =
                  computeItemMath(currentItem);
                const hasVatable =
                  parseFloat(currentItem?.vatableGrossAmount || "0") > 0;

                return (
                  <div
                    key={field.id}
                    className="border rounded-lg p-4 space-y-4 relative"
                  >
                    {/* Remove button */}
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-destructive hover:text-destructive z-10"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Item number + auto-detected tax type badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Item {index + 1}
                      </span>
                      {(parseFloat(currentItem?.nonVatAmount || "0") > 0 ||
                        parseFloat(currentItem?.vatableGrossAmount || "0") >
                          0) && (
                        <Badge
                          variant={
                            taxLabel === "Mixed (VAT + Non-VAT)"
                              ? "default"
                              : taxLabel === "Vatable"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-xs"
                        >
                          {taxLabel}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Description — full width */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.description`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-12">
                            <FormLabel>Description *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. Travel & Transportation, Office Supplies"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* ─── NON-VAT AMOUNT ─── */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.nonVatAmount`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-6">
                            <FormLabel className="text-muted-foreground">
                              Non-VAT Amount
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                  ₱
                                </span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  className="pl-7 text-right font-mono"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <p className="text-xs text-muted-foreground mt-1">
                              Leave blank if none
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* ─── VATABLE GROSS AMOUNT ─── */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.vatableGrossAmount`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-6">
                            <FormLabel className="text-muted-foreground">
                              Vatable Gross (incl. VAT)
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                  ₱
                                </span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  className="pl-7 text-right font-mono"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            {hasVatable && vatableBase > 0 ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                Base ₱{vatableBase.toFixed(2)} + VAT ₱
                                {vat.toFixed(2)}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-1">
                                Leave blank if none
                              </p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* ─── VAT % — only shown when vatable gross has a value ─── */}
                      {hasVatable && (
                        <FormField
                          control={form.control}
                          name={`items.${index}.vatPercent`}
                          render={({ field }) => (
                            <FormItem className="md:col-span-4">
                              <FormLabel>VAT Rate (%)</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    placeholder="12"
                                    className="pr-8 text-right font-mono"
                                    {...field}
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    %
                                  </span>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* ─── EWT % ─── */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.ewtPercent`}
                        render={({ field }) => (
                          <FormItem
                            className={
                              hasVatable ? "md:col-span-4" : "md:col-span-6"
                            }
                          >
                            <FormLabel>EWT (%)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  placeholder="0"
                                  className="pr-8 text-right font-mono"
                                  {...field}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                  %
                                </span>
                              </div>
                            </FormControl>
                            {parseFloat(currentItem?.ewtPercent || "0") > 0 &&
                              ewt > 0 && (
                                <p className="text-xs text-red-500 mt-1">
                                  Withheld: ₱{ewt.toFixed(2)}
                                </p>
                              )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* ─── CHART OF ACCOUNT ─── */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.chartOfAccountId`}
                        render={({ field }) => (
                          <FormItem
                            className={
                              hasVatable ? "md:col-span-4" : "md:col-span-6"
                            }
                          >
                            <FormLabel>Account Code</FormLabel>
                            {coaLoading ? (
                              <Skeleton className="h-10 w-full" />
                            ) : (
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select account" />
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
                                      — {coa.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* ─── Per-item net summary ─── */}
                      {(parseFloat(currentItem?.nonVatAmount || "0") > 0 ||
                        parseFloat(currentItem?.vatableGrossAmount || "0") >
                          0) && (
                        <div className="md:col-span-12 flex justify-end">
                          <div className="text-xs text-right text-muted-foreground space-y-0.5">
                            <div>
                              Gross:{" "}
                              <span className="font-mono font-medium text-foreground">
                                ₱
                                {(
                                  nonVat +
                                  parseFloat(
                                    currentItem?.vatableGrossAmount || "0",
                                  )
                                ).toFixed(2)}
                              </span>
                            </div>
                            {ewt > 0 && (
                              <div className="text-red-500">
                                EWT: −₱{ewt.toFixed(2)}
                              </div>
                            )}
                            <div className="font-medium text-foreground">
                              Net to Vendor: ₱{netCash.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* ─── SUPPORTING DOCUMENTS ────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">
                Supporting Documents
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (Optional)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <div className="text-center">
                  <Upload className="mx-auto h-10 w-10 text-gray-400" />
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      className="cursor-pointer"
                      onClick={() =>
                        document.getElementById("file-upload")?.click()
                      }
                    >
                      <span className="text-sm font-medium text-gray-900">
                        Upload receipts / invoices
                      </span>
                    </Button>
                    <p className="text-xs text-gray-500 mt-1">
                      PDF, PNG, JPG — up to 10MB each
                    </p>
                    <input
                      id="file-upload"
                      type="file"
                      className="sr-only"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileSelect}
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

          {/* ─── SUMMARY (Cash Disbursement) ─────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">
                Summary — Cash Disbursement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {/* Non-VAT base */}
                <div className="flex justify-between text-muted-foreground">
                  <span>Non-VAT Base Amount:</span>
                  <span className="font-mono">
                    ₱{totalNonVatBase.toFixed(2)}
                  </span>
                </div>

                {/* Vatable Base */}
                <div className="flex justify-between text-muted-foreground">
                  <span>Vatable Base Amount:</span>
                  <span className="font-mono">
                    ₱{totalVatableBase.toFixed(2)}
                  </span>
                </div>

                {/* VAT */}
                <div className="flex justify-between text-muted-foreground border-b pb-2">
                  <span>Total Input VAT (+):</span>
                  <span className="font-mono">₱{totalVat.toFixed(2)}</span>
                </div>

                {/* Gross */}
                <div className="flex justify-between font-medium">
                  <span>Total Gross Expense:</span>
                  <span className="font-mono">₱{totalGross.toFixed(2)}</span>
                </div>

                {/* EWT */}
                {totalEwt > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Total EWT Withheld (−):</span>
                    <span className="font-mono">₱{totalEwt.toFixed(2)}</span>
                  </div>
                )}

                {/* Net Cash to Vendor */}
                <div className="pt-4 border-t flex justify-between items-center">
                  <span className="text-base font-semibold">
                    Net Cash to Vendor:
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    ₱{totalNetCash.toFixed(2)}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground pt-1">
                  This amount will be deducted from the petty cash fund.
                  {totalEwt > 0 &&
                    " EWT withheld (₱" +
                      totalEwt.toFixed(2) +
                      ") is a separate BIR payable."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/vouchers")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createVoucher.isPending}>
              {createVoucher.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Submit Voucher
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
