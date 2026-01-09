import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Search, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { canCreateVouchers } from "@/lib/roleUtils";
import type { ChartOfAccount } from "@shared/schema";

export default function ChartOfAccounts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(
    null
  );
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
  });

  const { data: accounts, isLoading } = useQuery<ChartOfAccount[]>({
    queryKey: ["/api/chart-of-accounts"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/chart-of-accounts", data);
    },
    onSuccess: () => {
      toast({
        title: "Account Created",
        description: "Chart of account has been created successfully.",
      });
      setCreateOpen(false);
      setFormData({ code: "", name: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/chart-of-accounts"] });
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
          title: "Creation Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return await apiRequest("PATCH", `/api/chart-of-accounts/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Account Updated",
        description: "Chart of account has been updated successfully.",
      });
      setEditOpen(false);
      setSelectedAccount(null);
      setFormData({ code: "", name: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/chart-of-accounts"] });
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
          title: "Update Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/chart-of-accounts/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Account Deleted",
        description: "Chart of account has been deleted successfully.",
      });
      setDeleteOpen(false);
      setSelectedAccount(null);
      queryClient.invalidateQueries({ queryKey: ["/api/chart-of-accounts"] });
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

  const handleCreate = () => {
    if (!formData.code || !formData.name) {
      toast({
        title: "Validation Error",
        description: "Code and name are required.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedAccount || !formData.code || !formData.name) {
      toast({
        title: "Validation Error",
        description: "Code and name are required.",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({ id: selectedAccount.id, data: formData });
  };

  const handleDelete = () => {
    if (selectedAccount) {
      deleteMutation.mutate(selectedAccount.id);
    }
  };

  const openEditDialog = (account: ChartOfAccount) => {
    setSelectedAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      description: account.description || "",
    });
    setEditOpen(true);
  };

  const openDeleteDialog = (account: ChartOfAccount) => {
    setSelectedAccount(account);
    setDeleteOpen(true);
  };

  const filteredAccounts = accounts?.filter(
    (account) =>
      account.code.toLowerCase().includes(search.toLowerCase()) ||
      account.name.toLowerCase().includes(search.toLowerCase()) ||
      (account.description &&
        account.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Chart of Accounts</h1>
          <p className="text-muted-foreground mt-1">
            Manage chart of accounts for voucher categorization
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          data-testid="button-create-account"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-lg font-medium">Accounts</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, name, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-accounts"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-muted rounded-md animate-pulse"
                />
              ))}
            </div>
          ) : filteredAccounts && filteredAccounts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono text-sm">
                        {account.code}
                      </TableCell>
                      <TableCell className="font-medium">
                        {account.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[300px] truncate">
                        {account.description || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(account)}
                            data-testid={`button-edit-account-${account.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(account)}
                            data-testid={`button-delete-account-${account.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-4">No accounts found</p>
              <Button onClick={() => setCreateOpen(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Chart of Account</DialogTitle>
            <DialogDescription>
              Add a new chart of account for voucher categorization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-code">Code *</Label>
              <Input
                id="create-code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                placeholder="e.g., 1001"
                data-testid="input-create-code"
              />
            </div>
            <div>
              <Label htmlFor="create-name">Name *</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Office Supplies"
                data-testid="input-create-name"
              />
            </div>
            <div>
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description..."
                data-testid="textarea-create-description"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Chart of Account</DialogTitle>
            <DialogDescription>
              Update the chart of account details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-code">Code *</Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                placeholder="e.g., 1001"
                data-testid="input-edit-code"
              />
            </div>
            <div>
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Office Supplies"
                data-testid="input-edit-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description..."
                data-testid="textarea-edit-description"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chart of Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedAccount?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
