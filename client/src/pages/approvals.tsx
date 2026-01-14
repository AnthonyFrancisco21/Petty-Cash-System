import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import {
  CheckCircle2,
  XCircle,
  FileText,
  Upload,
  Eye,
  Trash2,
  ExternalLink,
  Download,
  Calendar,
  User,
  CheckCircle,
  Paperclip,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import type { VoucherWithRelations, VoucherAttachment } from "@shared/schema";

interface ApprovalAction {
  voucherId: number;
  action: "approve" | "reject";
}

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
  onViewAttachment: (attachment: any) => void;
}

function VoucherDetailDialog({
  voucher,
  open,
  onOpenChange,
  onViewAttachment,
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
      queryClient.invalidateQueries({
        queryKey: ["/api/vouchers"],
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
      queryClient.invalidateQueries({
        queryKey: ["/api/vouchers"],
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
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-md w-full overflow-hidden"
                    data-testid={`attachment-${attachment.id}`}
                  >
                    {/* Left Side Container: Constraints long text */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p
                          className="font-medium text-sm truncate"
                          title={attachment.fileName}
                        >
                          {attachment.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {format(
                            new Date(attachment.uploadedAt),
                            "MMM d, yyyy h:mm a"
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right Side Container: Fixed actions */}
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onViewAttachment(attachment)}
                        data-testid={`button-view-attachment-${attachment.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canManageAttachments && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
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

function AttachmentViewerDialog({
  attachment,
  open,
  onOpenChange,
}: {
  attachment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!attachment) return null;

  const isImage = attachment.fileType?.startsWith("image/");
  const isPDF = attachment.fileType === "application/pdf";
  const viewUrl = `/api/attachments/${attachment.id}/view`;
  const downloadUrl = `/api/attachments/${attachment.id}/download`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 gap-0 flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-none">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="text-base font-medium truncate">
              {attachment.fileName}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 pr-8">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex"
              onClick={() => window.open(viewUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open New Tab
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => window.open(downloadUrl, "_blank")}
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 w-full relative overflow-hidden bg-muted/20">
          {isImage ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={viewUrl}
                alt={attachment.fileName}
                className="max-w-full max-h-full w-auto h-auto object-contain rounded shadow-sm"
              />
            </div>
          ) : isPDF ? (
            <iframe
              src={viewUrl}
              className="w-full h-full border-0"
              title={attachment.fileName}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="bg-muted p-6 rounded-full mb-4">
                <FileText className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Preview Unavailable</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                This file type cannot be previewed directly in the browser.
                Please download the file to view it.
              </p>
              <Button onClick={() => window.open(downloadUrl, "_blank")}>
                <Download className="h-4 w-4 mr-2" />
                Download File
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedAction, setSelectedAction] = useState<ApprovalAction | null>(
    null
  );
  const [selectedVoucher, setSelectedVoucher] =
    useState<VoucherWithRelations | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isAttachmentViewerOpen, setIsAttachmentViewerOpen] = useState(false);
  const [attachmentToView, setAttachmentToView] = useState<any>(null);

  // Fetch pending vouchers
  const { data: vouchers = [], isLoading } = useQuery<VoucherWithRelations[]>({
    queryKey: ["/api/vouchers", "pending"],
    queryFn: async () => {
      const response = await fetch("/api/vouchers?status=pending");
      if (!response.ok) throw new Error("Failed to fetch vouchers");
      return response.json();
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (voucherId: number) => {
      const response = await fetch(`/api/vouchers/${voucherId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to approve voucher");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Approved",
        description: `Voucher ${data.voucherNumber} has been approved.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vouchers"] });
      setSelectedAction(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve voucher. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (voucherId: number) => {
      const response = await fetch(`/api/vouchers/${voucherId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to reject voucher");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Rejected",
        description: `Voucher ${data.voucherNumber} has been rejected.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vouchers"] });
      setSelectedAction(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject voucher. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleApprove = async () => {
    if (selectedAction?.action === "approve" && selectedAction.voucherId) {
      approveMutation.mutate(selectedAction.voucherId);
    }
  };

  const handleReject = async () => {
    if (selectedAction?.action === "reject" && selectedAction.voucherId) {
      rejectMutation.mutate(selectedAction.voucherId);
    }
  };

  const handleRowClick = (voucher: VoucherWithRelations) => {
    setSelectedVoucher(voucher);
    setDetailOpen(true);
  };

  const handleViewAttachment = (attachment: any) => {
    setAttachmentToView(attachment);
    setIsAttachmentViewerOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">
          Loading vouchers...
        </div>
      </div>
    );
  }

  const pendingVouchers = vouchers.filter((v) => v.status === "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pending Approvals</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve or reject pending vouchers
        </p>
      </div>

      {pendingVouchers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No pending vouchers to review</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingVouchers.map((voucher) => (
                <TableRow
                  key={voucher.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => handleRowClick(voucher)}
                >
                  <TableCell className="font-medium">
                    {voucher.voucherNumber}
                  </TableCell>
                  <TableCell>
                    {new Date(voucher.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{voucher.payee}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {voucher.items?.[0]?.description || ""}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₱{parseFloat(voucher.totalAmount).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {voucher.requester?.firstName} {voucher.requester?.lastName}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-200 hover:bg-green-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAction({
                          voucherId: voucher.id,
                          action: "approve",
                        });
                      }}
                      disabled={
                        approveMutation.isPending || rejectMutation.isPending
                      }
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAction({
                          voucherId: voucher.id,
                          action: "reject",
                        });
                      }}
                      disabled={
                        approveMutation.isPending || rejectMutation.isPending
                      }
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Approval Confirmation Dialog */}
      <AlertDialog
        open={selectedAction?.action === "approve"}
        onOpenChange={(open) => {
          if (!open) setSelectedAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Approve Voucher</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to approve this voucher? This action cannot be
            undone.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove}>
              Approve
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rejection Confirmation Dialog */}
      <AlertDialog
        open={selectedAction?.action === "reject"}
        onOpenChange={(open) => {
          if (!open) setSelectedAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Reject Voucher</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to reject this voucher? This action cannot be
            undone.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700"
            >
              Reject
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Voucher Detail Dialog */}
      <VoucherDetailDialog
        voucher={selectedVoucher}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedVoucher(null);
        }}
        onViewAttachment={handleViewAttachment}
      />

      {/* Attachment Viewer Dialog */}
      <AttachmentViewerDialog
        attachment={attachmentToView}
        open={isAttachmentViewerOpen}
        onOpenChange={(open) => {
          setIsAttachmentViewerOpen(open);
          if (!open) setAttachmentToView(null);
        }}
      />
    </div>
  );
}
