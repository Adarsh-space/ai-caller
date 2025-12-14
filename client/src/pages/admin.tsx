import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ShieldCheck,
  Users,
  DollarSign,
  Coins,
  TrendingUp,
  AlertTriangle,
  Power,
  Search,
  MoreVertical,
  Eye,
  Pause,
  Edit,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/metric-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { AdminDashboardStats, Tenant, PlatformSettings } from "@shared/schema";

export default function AdminPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [creditAdjustment, setCreditAdjustment] = useState("");

  const { data: stats, isLoading: statsLoading } = useQuery<AdminDashboardStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: tenants, isLoading: tenantsLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants"],
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<PlatformSettings>({
    queryKey: ["/api/admin/settings"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<PlatformSettings>) => {
      return apiRequest("PATCH", "/api/admin/settings", newSettings);
    },
    onSuccess: () => {
      toast({ title: "Settings updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
    },
    onError: () => {
      toast({ title: "Failed to update settings", variant: "destructive" });
    },
  });

  const adjustCreditsMutation = useMutation({
    mutationFn: async ({ tenantId, credits }: { tenantId: string; credits: number }) => {
      return apiRequest("POST", `/api/admin/tenants/${tenantId}/credits`, { credits });
    },
    onSuccess: () => {
      toast({ title: "Credits adjusted" });
      setSelectedTenant(null);
      setCreditAdjustment("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
    },
    onError: () => {
      toast({ title: "Failed to adjust credits", variant: "destructive" });
    },
  });

  const filteredTenants = tenants?.filter((tenant) =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tenantColumns = [
    {
      key: "name",
      header: "Business Name",
      render: (tenant: Tenant) => <span className="font-medium">{tenant.name}</span>,
    },
    {
      key: "planId",
      header: "Plan",
      render: (tenant: Tenant) => <Badge variant="outline">{tenant.planId}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      render: (tenant: Tenant) => <StatusBadge status={tenant.status} />,
    },
    {
      key: "businessCountry",
      header: "Country",
      render: (tenant: Tenant) => <span>{tenant.businessCountry}</span>,
    },
    {
      key: "createdAt",
      header: "Created",
      render: (tenant: Tenant) => (
        <span className="text-sm text-muted-foreground">
          {format(tenant.createdAt, "MMM d, yyyy")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (tenant: Tenant) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-actions-${tenant.id}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelectedTenant(tenant)}>
              <Edit className="h-4 w-4 mr-2" />
              Adjust Credits
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              <Pause className="h-4 w-4 mr-2" />
              Suspend
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <ShieldCheck className="h-6 w-6" />
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">Platform-wide overview and controls</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Tenants"
          value={stats?.totalTenants || 0}
          icon={Users}
          iconColor="text-chart-1"
        />
        <MetricCard
          title="Active Tenants"
          value={stats?.activeTenants || 0}
          icon={Users}
          iconColor="text-chart-2"
        />
        <MetricCard
          title="Total Revenue"
          value={`$${(stats?.totalRevenue || 0).toLocaleString()}`}
          icon={DollarSign}
          iconColor="text-chart-4"
        />
        <MetricCard
          title="Gross Margin"
          value={`${(stats?.grossMargin || 0).toFixed(1)}%`}
          icon={TrendingUp}
          iconColor="text-chart-5"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Credits Issued"
          value={(stats?.totalCreditsIssued || 0).toLocaleString()}
          icon={Coins}
          iconColor="text-chart-1"
        />
        <MetricCard
          title="Credits Consumed"
          value={(stats?.totalCreditsConsumed || 0).toLocaleString()}
          icon={Coins}
          iconColor="text-chart-3"
        />
        <MetricCard
          title="API Cost (Est.)"
          value={`$${(stats?.estimatedApiCost || 0).toLocaleString()}`}
          icon={DollarSign}
          iconColor="text-destructive"
        />
        <MetricCard
          title="Trial Tenants"
          value={stats?.trialTenants || 0}
          icon={Users}
          iconColor="text-chart-4"
        />
      </div>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Emergency Controls
          </CardTitle>
          <CardDescription>
            Kill switches for platform-wide service control
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center justify-between gap-4 p-4 rounded-md border">
              <div className="flex items-center gap-3">
                <Power className="h-5 w-5 text-destructive" />
                <div>
                  <Label className="font-medium">Kill Calls</Label>
                  <p className="text-xs text-muted-foreground">Stop all outbound calls</p>
                </div>
              </div>
              <Switch
                checked={settings?.killSwitchCalls}
                onCheckedChange={(checked) =>
                  updateSettingsMutation.mutate({ killSwitchCalls: checked })
                }
                data-testid="switch-kill-calls"
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-4 rounded-md border">
              <div className="flex items-center gap-3">
                <Power className="h-5 w-5 text-destructive" />
                <div>
                  <Label className="font-medium">Kill WhatsApp</Label>
                  <p className="text-xs text-muted-foreground">Stop all WhatsApp AI</p>
                </div>
              </div>
              <Switch
                checked={settings?.killSwitchWhatsApp}
                onCheckedChange={(checked) =>
                  updateSettingsMutation.mutate({ killSwitchWhatsApp: checked })
                }
                data-testid="switch-kill-whatsapp"
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-4 rounded-md border">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-chart-4" />
                <div>
                  <Label className="font-medium">Maintenance Mode</Label>
                  <p className="text-xs text-muted-foreground">Show maintenance page</p>
                </div>
              </div>
              <Switch
                checked={settings?.maintenanceMode}
                onCheckedChange={(checked) =>
                  updateSettingsMutation.mutate({ maintenanceMode: checked })
                }
                data-testid="switch-maintenance"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Tenants
          </CardTitle>
          <CardDescription>All registered businesses on the platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tenants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>

          <DataTable
            columns={tenantColumns}
            data={filteredTenants || []}
            isLoading={tenantsLoading}
            emptyMessage="No tenants found"
          />
        </CardContent>
      </Card>

      <Dialog open={!!selectedTenant} onOpenChange={() => setSelectedTenant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Credits</DialogTitle>
            <DialogDescription>
              Adjust credits for {selectedTenant?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="credits">Credit Adjustment</Label>
              <Input
                id="credits"
                type="number"
                placeholder="Enter positive or negative amount"
                value={creditAdjustment}
                onChange={(e) => setCreditAdjustment(e.target.value)}
                data-testid="input-credits"
              />
              <p className="text-xs text-muted-foreground">
                Use negative numbers to deduct credits
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTenant(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedTenant && creditAdjustment) {
                  adjustCreditsMutation.mutate({
                    tenantId: selectedTenant.id,
                    credits: parseInt(creditAdjustment),
                  });
                }
              }}
              disabled={!creditAdjustment || adjustCreditsMutation.isPending}
              data-testid="button-save-credits"
            >
              Apply Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
