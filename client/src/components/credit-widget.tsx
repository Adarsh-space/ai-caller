import { Coins, TrendingDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/lib/auth-context";
import { Link } from "wouter";

export function CreditWidget() {
  const { wallet, tenant } = useAuth();

  if (!wallet || !tenant) return null;

  const usagePercent = wallet.creditsUsedThisMonth > 0 
    ? Math.min((wallet.creditsUsedThisMonth / (wallet.creditsBalance + wallet.creditsUsedThisMonth)) * 100, 100)
    : 0;

  const formatCredits = (credits: number) => {
    if (credits >= 1000) {
      return `${(credits / 1000).toFixed(1)}k`;
    }
    return credits.toLocaleString();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-3"
          data-testid="button-credit-widget"
        >
          <Coins className="h-4 w-4 text-chart-4" />
          <span className="font-semibold">{formatCredits(wallet.creditsBalance)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Credit Balance</h4>
            <span className="text-2xl font-bold text-chart-2">
              {wallet.creditsBalance.toLocaleString()}
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Used this month</span>
              <span className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-chart-5" />
                {wallet.creditsUsedThisMonth.toLocaleString()}
              </span>
            </div>
            <Progress value={usagePercent} className="h-2" />
          </div>

          <div className="pt-2 border-t">
            <Link href="/billing">
              <Button className="w-full" size="sm" data-testid="button-topup">
                <Plus className="h-4 w-4 mr-2" />
                Top Up Credits
              </Button>
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
