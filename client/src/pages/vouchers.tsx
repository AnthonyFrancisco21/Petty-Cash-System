import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Upload,
  Paperclip,
  Trash2,
  Eye,
  User,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { canCreateVouchers } from "@/lib/roleUtils";
import type { VoucherWithRelations, VoucherAttachment } from "@shared/schema";

function formatCurrency(amount: string | number): string {
  return parseFloat(String(amount)).toLocaleString("en-US", {
    style: "currency",
    currency: "PHP",
  });
}

function getStatusIcon(status: string) {
  switch (status) {
    case "approved":
      return <CheckCircle className="h-3 w-3" />;
    case "rejected":
      return <XCircle className="h-3 w-3" />;
    case "pending":
      return <Clock className="h-3 w-3" />;
    default:
      return null;
  }
}

function getStatusVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "approved":
      return "default";
    case "pending":
      return "secondary";
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
}

interface VoucherDetailDialogProps {
  voucher: VoucherWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function VoucherDetailDialog({
  voucher,
  open,
  onOpenChange,
}: VoucherDetailDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: attachments, isLoading: attachmentsLoading } = useQuery<
    VoucherAttachment[]
  >({
    queryKey: [`/api/vouchers/${voucher?.id}/attachments`],
    enabled: !!voucher,
  });

  const uploadAttachment = useMutation({
    mutationFn: async (file: File) => {
      if (!voucher) throw new Error("No voucher selected");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/vouchers/${voucher.id}/attachments`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Attachment Uploaded",
        description: "The file has been attached to this voucher.",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/vouchers/${voucher?.id}/attachments`],
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => (window.location.href = "/api/login"), 500);
      } else {
        toast({
          title: "Upload Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: async (attachmentId: number) => {
      if (!voucher) throw new Error("No voucher selected");
      return await apiRequest(
        "DELETE",
        `/api/vouchers/${voucher.id}/attachments/${attachmentId}`
      );
    },
    onSuccess: () => {
      toast({
        title: "Attachment Deleted",
        description: "The file has been removed from this voucher.",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/vouchers/${voucher?.id}/attachments`],
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => (window.location.href = "/api/login"), 500);
      } else {
        toast({
          title: "Delete Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAttachment.mutate(file);
      e.target.value = "";
    }
  };

  const canManageAttachments =
    user &&
    (user.role === "admin" ||
      user.role === "preparer" ||
      (voucher && voucher.requestedById === user.id));

  if (!voucher) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono">{voucher.voucherNumber}</span>
            <Badge variant={getStatusVariant(voucher.status)}>
              {getStatusIcon(voucher.status)}
              <span className="ml-1">{voucher.status}</span>
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Voucher details and attached documents
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Payee</p>
              <p className="font-medium">{voucher.payee}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {format(new Date(voucher.date), "MMMM d, yyyy")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="font-mono font-semibold text-lg">
                {formatCurrency(voucher.totalAmount)}
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-medium mb-3">Voucher Items</h3>
            <div className="space-y-3">
              {voucher.items?.map((item, index) => (
                <div key={index} className="p-3 bg-muted/50 rounded-md">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Description
                      </p>
                      <p className="font-medium">{item.description}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <p className="font-mono">{formatCurrency(item.amount)}</p>
                    </div>
                    {item.vatAmount && (
                      <div>
                        <p className="text-sm text-muted-foreground">VAT</p>
                        <p className="font-mono">
                          {formatCurrency(item.vatAmount)}
                        </p>
                      </div>
                    )}
                    {item.amountWithheld && (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Withheld
                        </p>
                        <p className="font-mono">
                          {formatCurrency(item.amountWithheld)}
                        </p>
                      </div>
                    )}
                    {item.invoiceNumber && (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Invoice Number
                        </p>
                        <p className="font-mono">{item.invoiceNumber}</p>
                      </div>
                    )}
                    {item.chartOfAccount && (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Chart of Account
                        </p>
                        <p className="font-medium">
                          <span className="font-mono text-muted-foreground">
                            {item.chartOfAccount.code}
                          </span>
                          {" - "}
                          {item.chartOfAccount.name}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            {voucher.requester && (
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Requested By
                </p>
                <p className="font-medium">
                  {voucher.requester.firstName} {voucher.requester.lastName}
                </p>
              </div>
            )}
            {voucher.approver && (
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Approved By
                </p>
                <p className="font-medium">
                  {voucher.approver.firstName} {voucher.approver.lastName}
                </p>
              </div>
            )}
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments
              </h3>
              {canManageAttachments && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                    data-testid="input-upload-attachment"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadAttachment.isPending}
                    data-testid="button-upload-attachment"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadAttachment.isPending ? "Uploading..." : "Upload"}
                  </Button>
                </>
              )}
            </div>

            {attachmentsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : attachments && attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                    data-testid={`attachment-${attachment.id}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {attachment.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(
                            new Date(attachment.uploadedAt),
                            "MMM d, yyyy h:mm a"
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          window.open(
                            `/api/attachments/${attachment.id}/download`,
                            "_blank"
                          )
                        }
                        data-testid={`button-view-attachment-${attachment.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canManageAttachments && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAttachment.mutate(attachment.id)}
                          disabled={deleteAttachment.isPending}
                          data-testid={`button-delete-attachment-${attachment.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No attachments yet</p>
                {canManageAttachments && (
                  <p className="text-sm mt-1">
                    Upload receipts or invoices to support this voucher
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Vouchers() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedVoucher, setSelectedVoucher] =
    useState<VoucherWithRelations | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<VoucherWithRelations[][]>([]);
  const [offset, setOffset] = useState(0);
  const limit = 10;

  const {
    data: pageData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<VoucherWithRelations[]>({
    queryKey: ["/api/vouchers", statusFilter, limit, offset],
    staleTime: 0,
    queryFn: async (): Promise<VoucherWithRelations[]> => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      const res = await fetch(`/api/vouchers?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch vouchers");
      return await res.json();
    },
  });

  // FIX: Added statusFilter to dependency array so it updates even if data is cached
  useEffect(() => {
    if (pageData && Array.isArray(pageData)) {
      if (offset === 0) {
        setPages([pageData]);
      } else {
        setPages((p) => [...p, pageData]);
      }
    }
  }, [pageData, offset, statusFilter]);

  // FIX: Removed setPages([]) to prevent race condition clearing data
  useEffect(() => {
    setOffset(0);
  }, [statusFilter]);

  const vouchers = pages.flatMap((p) => p) || [];

  const handleRowClick = (voucher: VoucherWithRelations) => {
    setSelectedVoucher(voucher);
    setDetailOpen(true);
  };

  const filteredVouchers = vouchers?.filter((v: VoucherWithRelations) => {
    const matchesSearch =
      v.payee.toLowerCase().includes(search.toLowerCase()) ||
      v.voucherNumber.toLowerCase().includes(search.toLowerCase()) ||
      v.items?.some((item) =>
        item.description.toLowerCase().includes(search.toLowerCase())
      ) ||
      false;

    // Note: The API already filters by status, but we keep this for consistency with search
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    if (!filteredVouchers || filteredVouchers.length === 0) return;

    const headers = [
      "Voucher #",
      "Date",
      "Payee",
      "Description",
      "Amount",
      "Invoice #",
      "Net of VAT",
      "VAT",
      "Withheld",
      "Status",
      "Requested By",
      "Approved By",
    ];

    const rows = filteredVouchers.map((v: VoucherWithRelations) => [
      v.voucherNumber,
      format(new Date(v.date), "yyyy-MM-dd"),
      v.payee,
      v.items?.map((item) => item.description).join("; ") || "",
      v.totalAmount,
      v.items?.map((item) => item.invoiceNumber || "").join("; ") || "",
      "", // Net of VAT - not used in new structure
      v.items
        ?.reduce((sum, item) => sum + parseFloat(item.vatAmount || "0"), 0)
        .toString() || "",
      v.items
        ?.reduce((sum, item) => sum + parseFloat(item.amountWithheld || "0"), 0)
        .toString() || "",
      v.status,
      v.requester ? `${v.requester.firstName} ${v.requester.lastName}` : "",
      v.approver ? `${v.approver.firstName} ${v.approver.lastName}` : "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vouchers-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">
            {user?.role === "approver" ? "Vouchers for Review" : "Vouchers"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {user?.role === "approver"
              ? "Review vouchers created by preparers"
              : user?.role === "preparer"
              ? "Manage petty cash disbursement vouchers"
              : "View all vouchers"}
          </p>
        </div>
        {canCreateVouchers(user?.role || "") && (
          <Link href="/vouchers/new">
            <Button data-testid="button-new-voucher">
              <Plus className="h-4 w-4 mr-2" />
              New Voucher
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-lg font-medium">
              Disbursement Register
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!filteredVouchers || filteredVouchers.length === 0}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by payee, voucher #, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-vouchers"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                className="w-[180px]"
                data-testid="select-status-filter"
              >
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="replenished">Replenished</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isError ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                Error loading vouchers: {error?.message || "Unknown error"}
              </p>
              <Button onClick={() => refetch()} variant="outline">
                Try Again
              </Button>
            </div>
          ) : isLoading && pages.length === 0 ? (
            // Show skeleton only if we have no data at all yet
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredVouchers && filteredVouchers.length > 0 ? (
            <div
              ref={listRef}
              onScroll={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                const atBottom =
                  el.scrollHeight - el.scrollTop <= el.clientHeight + 100;
                if (atBottom && !isFetching) {
                  // load next page if last page had full results
                  const lastPage = pages[pages.length - 1];
                  if (lastPage && lastPage.length === limit) {
                    setOffset((o) => o + limit);
                  }
                }
              }}
              className="max-h-[60vh] overflow-auto"
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Voucher #</TableHead>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead>Payee</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[120px]">Requested By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVouchers.map((voucher: VoucherWithRelations) => (
                      <TableRow
                        key={voucher.id}
                        className="hover-elevate cursor-pointer"
                        onClick={() => handleRowClick(voucher)}
                        data-testid={`row-voucher-${voucher.id}`}
                      >
                        <TableCell className="font-mono text-sm">
                          {voucher.voucherNumber}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(voucher.date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {voucher.payee}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {voucher.items?.[0]?.description || ""}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(voucher.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(voucher.status)}>
                            {getStatusIcon(voucher.status)}
                            <span className="ml-1">{voucher.status}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {voucher.requester
                            ? `${voucher.requester.firstName} ${voucher.requester.lastName}`
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {isFetching && offset > 0 && (
                <div className="p-4 text-center">Loading more vouchers...</div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-4">No vouchers found</p>
              {canCreateVouchers(user?.role || "") && (
                <Link href="/vouchers/new">
                  <Button data-testid="button-create-voucher-empty">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Voucher
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <VoucherDetailDialog
        voucher={selectedVoucher}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
