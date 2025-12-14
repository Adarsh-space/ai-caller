import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = 
  | "active" | "connected" | "success" | "completed"
  | "pending" | "scheduled" | "trial" | "warning"
  | "failed" | "disconnected" | "error" | "suspended"
  | "inactive" | "paused" | "draft" | "default";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<StatusType, string> = {
  active: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  connected: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  success: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  completed: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  pending: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  scheduled: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  trial: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  warning: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  disconnected: "bg-destructive/10 text-destructive border-destructive/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  suspended: "bg-destructive/10 text-destructive border-destructive/20",
  inactive: "bg-muted text-muted-foreground border-muted",
  paused: "bg-muted text-muted-foreground border-muted",
  draft: "bg-muted text-muted-foreground border-muted",
  default: "bg-muted text-muted-foreground border-muted",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace(/_/g, "") as StatusType;
  const style = statusStyles[normalizedStatus] || statusStyles.default;
  
  return (
    <Badge 
      variant="outline" 
      className={cn("font-medium border", style, className)}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
