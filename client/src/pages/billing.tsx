import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CreditCard,
  Coins,
  TrendingUp,
  TrendingDown,
  Plus,
  Receipt,
  Crown,
  Check,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Transaction, Subscription, Wallet } from "@shared/schema";

const plans = [
  {
    id: "STARTER",
    name: "Starter",
    price: 49,
    credits: 500,
    features: ["500 credits/month", "2 AI Agents", "Email support", "Basic analytics"],
  },
  {
    id: "GROWTH",
    name: "Growth",
    price: 149,
    credits: 2000,
    features: ["2,000 credits/month", "10 AI Agents", "Priority support", "Advanced analytics", "WhatsApp integration"],
    popular: true,
  },
  {
    id: "BUSINESS",
    name: "Business",
    price: 399,
    credits: 5000,
    features: ["5,000 credits/month", "Unlimited AI Agents", "Dedicated support", "Custom analytics", "API access", "White-label option"],
  },
];

const topupOptions = [
  { credits: 100, price: 10 },
  { credits: 500, price: 45 },
  { credits: 1000, price: 85 },
  { credits: 2500, price: 200 },
];

export default function BillingPage() {
  const { wallet, tenant, refreshAuth } = useAuth();
  const { toast } = useToast();
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedTopup, setSelectedTopup] = useState<number>(500);
  const [selectedPlan, setSelectedPlan] = useState<string>("");

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/billing/transactions"],
  });

  const { data: subscription, isLoading: subscriptionLoading } = useQuery<Subscription>({
    queryKey: ["/api/billing/subscription"],
  });

  const topupMutation = useMutation({
    mutationFn: (credits: number) => {
      const option = topupOptions.find(o => o.credits === credits);
      const amount = option?.price || Math.round(credits * 0.1);
      return apiRequest("POST", "/api/billing/topup", { credits, amount });
    },
    onSuccess: () => {
      toast({ title: "Credits added successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/transactions"] });
      refreshAuth?.();
      setShowTopupModal(false);
    },
    onError: () => {
      toast({ title: "Failed to add credits", variant: "destructive" });
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: (planId: string) => apiRequest("POST", "/api/billing/change-plan", { planId }),
    onSuccess: () => {
      toast({ title: "Plan changed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      refreshAuth?.();
      setShowPlanModal(false);
    },
    onError: () => {
      toast({ title: "Failed to change plan", variant: "destructive" });
    },
  });

  const usagePercent = wallet
    ? Math.min(100, (wallet.creditsUsedThisMonth / (wallet.creditsBalance + wallet.creditsUsedThisMonth)) * 100)
    : 0;

  const transactionColumns = [
    {
      key: "createdAt",
      header: "Date",
      render: (tx: Transaction) => (
        <span className="text-sm">{format(tx.createdAt, "MMM d, yyyy")}</span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (tx: Transaction) => {
        const typeStyles: Record<string, { icon: typeof TrendingUp; color: string }> = {
          SUBSCRIPTION_RENEWAL: { icon: Crown, color: "text-chart-5" },
          TOPUP: { icon: Plus, color: "text-chart-2" },
          USAGE: { icon: TrendingDown, color: "text-destructive" },
          REFUND: { icon: ArrowDownRight, color: "text-chart-4" },
          MANUAL_ADJUSTMENT: { icon: ArrowUpRight, color: "text-chart-1" },
        };
        const style = typeStyles[tx.type] || typeStyles.USAGE;
        const Icon = style.icon;
        return (
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", style.color)} />
            <span className="capitalize">{tx.type.replace(/_/g, " ").toLowerCase()}</span>
          </div>
        );
      },
    },
    {
      key: "description",
      header: "Description",
      render: (tx: Transaction) => <span className="text-sm">{tx.description}</span>,
    },
    {
      key: "creditsDelta",
      header: "Credits",
      render: (tx: Transaction) => (
        <span className={cn("font-medium", tx.creditsDelta >= 0 ? "text-chart-2" : "text-destructive")}>
          {tx.creditsDelta >= 0 ? "+" : ""}{tx.creditsDelta}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (tx: Transaction) =>
        tx.amount > 0 ? (
          <span className="font-medium">
            {tx.currency} {tx.amount.toFixed(2)}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Billing & Credits</h1>
        <p className="text-muted-foreground">Manage your subscription and credits</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Credit Balance
            </CardTitle>
            <CardDescription>Your current credit status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!wallet ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="flex items-end justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm text-muted-foreground">Available Credits</p>
                    <p className="text-4xl font-bold">{wallet.creditsBalance.toLocaleString()}</p>
                  </div>
                  <Button onClick={() => setShowTopupModal(true)} data-testid="button-topup">
                    <Plus className="h-4 w-4 mr-2" />
                    Top Up Credits
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Monthly Usage</span>
                    <span>{wallet.creditsUsedThisMonth.toLocaleString()} credits used</span>
                  </div>
                  <Progress value={usagePercent} className="h-2" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptionLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="space-y-4">
                <div>
                  <Badge variant="default" className="mb-2">
                    {tenant?.planId || "STARTER"}
                  </Badge>
                  <p className="text-2xl font-bold">
                    ${plans.find((p) => p.id === tenant?.planId)?.price || 49}/mo
                  </p>
                </div>
                {subscription && (
                  <div className="text-sm text-muted-foreground">
                    <p>Next billing: {format(subscription.nextBillingAt, "MMM d, yyyy")}</p>
                    <p>Status: <span className="capitalize">{subscription.status.toLowerCase()}</span></p>
                  </div>
                )}
                <Button variant="outline" className="w-full" onClick={() => { setSelectedPlan(tenant?.planId || ""); setShowPlanModal(true); }} data-testid="button-change-plan">
                  Change Plan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={cn(plan.popular && "border-primary")}
            >
              <CardHeader>
                {plan.popular && (
                  <Badge variant="default" className="w-fit mb-2">
                    Most Popular
                  </Badge>
                )}
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">${plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-chart-2" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={tenant?.planId === plan.id ? "secondary" : plan.popular ? "default" : "outline"}
                  className="w-full"
                  disabled={tenant?.planId === plan.id}
                  onClick={() => { setSelectedPlan(plan.id); setShowPlanModal(true); }}
                  data-testid={`button-select-${plan.id.toLowerCase()}`}
                >
                  {tenant?.planId === plan.id ? "Current Plan" : "Select Plan"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>Recent billing and credit transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={transactionColumns}
            data={transactions || []}
            isLoading={transactionsLoading}
            emptyMessage="No transactions yet"
          />
        </CardContent>
      </Card>

      <Dialog open={showTopupModal} onOpenChange={setShowTopupModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Top Up Credits
            </DialogTitle>
            <DialogDescription>
              Select a credit package to add to your account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <RadioGroup value={selectedTopup.toString()} onValueChange={(v) => setSelectedTopup(parseInt(v))}>
              <div className="grid grid-cols-2 gap-4">
                {topupOptions.map((option) => (
                  <div key={option.credits} className="relative">
                    <RadioGroupItem
                      value={option.credits.toString()}
                      id={`topup-${option.credits}`}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={`topup-${option.credits}`}
                      className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 cursor-pointer peer-data-[state=checked]:border-primary"
                    >
                      <span className="text-2xl font-bold">{option.credits}</span>
                      <span className="text-sm text-muted-foreground">credits</span>
                      <span className="mt-2 font-semibold">${option.price}</span>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTopupModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => topupMutation.mutate(selectedTopup)} 
              disabled={topupMutation.isPending}
              data-testid="button-confirm-topup"
            >
              {topupMutation.isPending ? "Processing..." : `Buy ${selectedTopup} Credits`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Change Plan
            </DialogTitle>
            <DialogDescription>
              Select a new plan for your account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
              <div className="space-y-3">
                {plans.map((plan) => (
                  <div key={plan.id} className="relative">
                    <RadioGroupItem
                      value={plan.id}
                      id={`plan-${plan.id}`}
                      className="peer sr-only"
                      disabled={tenant?.planId === plan.id}
                    />
                    <Label
                      htmlFor={`plan-${plan.id}`}
                      className={cn(
                        "flex items-center justify-between rounded-md border-2 border-muted bg-popover p-4 cursor-pointer peer-data-[state=checked]:border-primary",
                        tenant?.planId === plan.id && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div>
                        <span className="font-semibold">{plan.name}</span>
                        {tenant?.planId === plan.id && (
                          <Badge variant="secondary" className="ml-2">Current</Badge>
                        )}
                        <p className="text-sm text-muted-foreground">{plan.credits} credits/month</p>
                      </div>
                      <span className="text-xl font-bold">${plan.price}/mo</span>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlanModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => changePlanMutation.mutate(selectedPlan)} 
              disabled={changePlanMutation.isPending || !selectedPlan || selectedPlan === tenant?.planId}
              data-testid="button-confirm-plan"
            >
              {changePlanMutation.isPending ? "Processing..." : "Change Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
