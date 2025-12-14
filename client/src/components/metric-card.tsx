import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = "text-primary",
  className,
}: MetricCardProps) {
  const TrendIcon = change === undefined ? null : change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const trendColor = change === undefined ? "" : change > 0 ? "text-chart-2" : change < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change !== undefined && (
              <div className={cn("flex items-center gap-1 text-xs", trendColor)}>
                {TrendIcon && <TrendIcon className="h-3 w-3" />}
                <span>{change > 0 ? "+" : ""}{change}%</span>
                {changeLabel && <span className="text-muted-foreground">vs {changeLabel}</span>}
              </div>
            )}
          </div>
          <div className={cn("p-3 rounded-md bg-muted", iconColor)}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
