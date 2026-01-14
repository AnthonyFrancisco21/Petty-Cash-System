import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Wallet, Edit, Plus } from "lucide-react";
import type { PettyCashFund } from "@shared/schema";

interface FundFormData {
  imprestAmount: string;
  currentBalance: string;
}

export default function PettyCashFundPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fundFormData, setFundFormData] = useState<FundFormData>({
    imprestAmount: "",
    currentBalance: "",
  });
  const [isCreateFundOpen, setIsCreateFundOpen] = useState(false);
  const [isEditFundOpen, setIsEditFundOpen] = useState(false);
  const [editFundFormData, setEditFundFormData] = useState<FundFormData>({
    imprestAmount: "",
    currentBalance: "",
  });

  // Fetch petty cash fund
  const { data: fund, isLoading: fundLoading } = useQuery<PettyCashFund>({
    queryKey: ["/api/fund"],
  });

  // Set edit form data when fund changes or dialog opens
  useEffect(() => {
    if (fund && isEditFundOpen) {
      setEditFundFormData({
        imprestAmount: fund.imprestAmount.toString(),
        currentBalance: fund.currentBalance.toString(),
      });
    }
  }, [fund, isEditFundOpen]);

  // Create fund mutation
  const createFundMutation = useMutation({
    mutationFn: async (data: FundFormData) => {
      const response = await fetch("/api/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imprestAmount: parseFloat(data.imprestAmount),
          currentBalance: parseFloat(data.currentBalance),
        }),
      });
      if (!response.ok) throw new Error("Failed to create fund");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Petty cash fund created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/fund"] });
      setIsCreateFundOpen(false);
      setFundFormData({ imprestAmount: "", currentBalance: "" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create fund. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update fund mutation
  const updateFundMutation = useMutation({
    mutationFn: async (data: FundFormData) => {
      const response = await fetch("/api/fund", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imprestAmount: parseFloat(data.imprestAmount),
          currentBalance: parseFloat(data.currentBalance),
        }),
      });
      if (!response.ok) throw new Error("Failed to update fund");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Petty cash fund updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/fund"] });
      setIsEditFundOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update fund. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (fundLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">
          Loading petty cash fund...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Petty Cash Fund Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage the petty cash fund settings and balances
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Petty Cash Fund Management
          </CardTitle>
          <div className="flex gap-2">
            {!fund && (
              <Dialog
                open={isCreateFundOpen}
                onOpenChange={setIsCreateFundOpen}
              >
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Fund
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Petty Cash Fund</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="imprestAmount">Imprest Amount</Label>
                      <Input
                        id="imprestAmount"
                        type="number"
                        step="0.01"
                        value={fundFormData.imprestAmount}
                        onChange={(e) =>
                          setFundFormData({
                            ...fundFormData,
                            imprestAmount: e.target.value,
                          })
                        }
                        placeholder="Enter imprest amount"
                      />
                    </div>
                    <div>
                      <Label htmlFor="currentBalance">Current Balance</Label>
                      <Input
                        id="currentBalance"
                        type="number"
                        step="0.01"
                        value={fundFormData.currentBalance}
                        onChange={(e) =>
                          setFundFormData({
                            ...fundFormData,
                            currentBalance: e.target.value,
                          })
                        }
                        placeholder="Enter current balance"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setIsCreateFundOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => createFundMutation.mutate(fundFormData)}
                        disabled={createFundMutation.isPending}
                      >
                        {createFundMutation.isPending
                          ? "Creating..."
                          : "Create Fund"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {fund && (
              <Dialog open={isEditFundOpen} onOpenChange={setIsEditFundOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Fund
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Petty Cash Fund</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="editImprestAmount">Imprest Amount</Label>
                      <Input
                        id="editImprestAmount"
                        type="number"
                        step="0.01"
                        value={editFundFormData.imprestAmount}
                        onChange={(e) =>
                          setEditFundFormData({
                            ...editFundFormData,
                            imprestAmount: e.target.value,
                          })
                        }
                        placeholder="Enter imprest amount"
                      />
                    </div>
                    <div>
                      <Label htmlFor="editCurrentBalance">
                        Current Balance
                      </Label>
                      <Input
                        id="editCurrentBalance"
                        type="number"
                        step="0.01"
                        value={editFundFormData.currentBalance}
                        onChange={(e) =>
                          setEditFundFormData({
                            ...editFundFormData,
                            currentBalance: e.target.value,
                          })
                        }
                        placeholder="Enter current balance"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setIsEditFundOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() =>
                          updateFundMutation.mutate(editFundFormData)
                        }
                        disabled={updateFundMutation.isPending}
                      >
                        {updateFundMutation.isPending
                          ? "Updating..."
                          : "Update Fund"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {fund ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-2xl font-mono font-semibold">
                  ₱{parseFloat(fund.currentBalance).toFixed(2)}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Imprest Amount</p>
                <p className="text-2xl font-mono font-semibold">
                  ₱{parseFloat(fund.imprestAmount).toFixed(2)}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                No petty cash fund configured
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a fund to start managing petty cash disbursements
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
