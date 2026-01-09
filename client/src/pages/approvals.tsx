import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { VoucherWithRelations } from "@shared/schema";

interface ApprovalAction {
  voucherId: number;
  action: "approve" | "reject";
}

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedAction, setSelectedAction] = useState<ApprovalAction | null>(
    null
  );

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
                <TableRow key={voucher.id}>
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
                      onClick={() =>
                        setSelectedAction({
                          voucherId: voucher.id,
                          action: "approve",
                        })
                      }
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
                      onClick={() =>
                        setSelectedAction({
                          voucherId: voucher.id,
                          action: "reject",
                        })
                      }
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
    </div>
  );
}
