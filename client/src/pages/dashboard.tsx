import { useQuery } from "@tanstack/react-query";
import { Phone, MessageCircle, Coins, Bot, Megaphone, Clock, TrendingUp, Users } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import type { DashboardStats, Call, Campaign } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function DashboardPage() {
  const { tenant, wallet } = useAuth();
  const token = localStorage.getItem("authToken");

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    enabled: !!token,
  });

  const { data: recentCalls, isLoading: callsLoading } = useQuery<Call[]>({
    queryKey: ["/api/calls", { limit: 5 }],
    enabled: !!token,
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns", { limit: 5 }],
    enabled: !!token,
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {tenant?.name || "Loading..."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <MetricCard
              title="Total Calls"
              value={stats?.totalCalls?.toLocaleString() || "0"}
              change={12}
              changeLabel="last week"
              icon={Phone}
              iconColor="text-chart-1"
            />
            <MetricCard
              title="Call Minutes"
              value={`${stats?.totalMinutes?.toLocaleString() || "0"} min`}
              change={8}
              changeLabel="last week"
              icon={Clock}
              iconColor="text-chart-2"
            />
            <MetricCard
              title="WhatsApp Chats"
              value={stats?.totalWhatsAppConversations?.toLocaleString() || "0"}
              change={-3}
              changeLabel="last week"
              icon={MessageCircle}
              iconColor="text-chart-2"
            />
            <MetricCard
              title="Credits Balance"
              value={wallet?.creditsBalance?.toLocaleString() || "0"}
              icon={Coins}
              iconColor="text-chart-4"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Agents"
          value={stats?.activeAgents || 0}
          icon={Bot}
          iconColor="text-chart-3"
        />
        <MetricCard
          title="Active Campaigns"
          value={stats?.activeCampaigns || 0}
          icon={Megaphone}
          iconColor="text-chart-5"
        />
        <MetricCard
          title="Credits Used"
          value={stats?.creditsUsed?.toLocaleString() || "0"}
          icon={TrendingUp}
          iconColor="text-destructive"
        />
        <MetricCard
          title="Credits Remaining"
          value={stats?.creditsRemaining?.toLocaleString() || "0"}
          icon={Coins}
          iconColor="text-chart-2"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Recent Calls
            </CardTitle>
            <CardDescription>Latest call activity</CardDescription>
          </CardHeader>
          <CardContent>
            {callsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentCalls && recentCalls.length > 0 ? (
              <div className="space-y-4">
                {recentCalls.slice(0, 5).map((call) => (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    data-testid={`call-item-${call.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Phone className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{call.to}</p>
                        <p className="text-sm text-muted-foreground">
                          {call.durationSec}s • {call.direction}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={call.status} />
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(call.startedAt, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No calls yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Active Campaigns
            </CardTitle>
            <CardDescription>Running campaigns status</CardDescription>
          </CardHeader>
          <CardContent>
            {campaignsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : campaigns && campaigns.length > 0 ? (
              <div className="space-y-4">
                {campaigns.slice(0, 5).map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    data-testid={`campaign-item-${campaign.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-chart-5/10 flex items-center justify-center">
                        <Megaphone className="h-4 w-4 text-chart-5" />
                      </div>
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {campaign.calledLeads}/{campaign.totalLeads} leads
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={campaign.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No campaigns yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
