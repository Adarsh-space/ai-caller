import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { CreditWidget } from "@/components/credit-widget";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";

import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import AgentsPage from "@/pages/agents";
import AgentBuilderPage from "@/pages/agent-builder";
import CampaignsPage from "@/pages/campaigns";
import CampaignBuilderPage from "@/pages/campaign-builder";
import CallsPage from "@/pages/calls";
import WhatsAppPage from "@/pages/whatsapp";
import BillingPage from "@/pages/billing";
import CompliancePage from "@/pages/compliance";
import AdminPage from "@/pages/admin";
import SettingsPage from "@/pages/settings";

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route path="/agents">
        <ProtectedRoute component={AgentsPage} />
      </Route>
      <Route path="/agents/new">
        <ProtectedRoute component={AgentBuilderPage} />
      </Route>
      <Route path="/agents/:id">
        <ProtectedRoute component={AgentBuilderPage} />
      </Route>
      <Route path="/campaigns">
        <ProtectedRoute component={CampaignsPage} />
      </Route>
      <Route path="/campaigns/new">
        <ProtectedRoute component={CampaignBuilderPage} />
      </Route>
      <Route path="/campaigns/:id">
        <ProtectedRoute component={CampaignBuilderPage} />
      </Route>
      <Route path="/calls">
        <ProtectedRoute component={CallsPage} />
      </Route>
      <Route path="/whatsapp">
        <ProtectedRoute component={WhatsAppPage} />
      </Route>
      <Route path="/billing">
        <ProtectedRoute component={BillingPage} />
      </Route>
      <Route path="/compliance">
        <ProtectedRoute component={CompliancePage} />
      </Route>
      <Route path="/admin">
        <ProtectedRoute component={AdminPage} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Router />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 px-4 py-2 border-b bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <CreditWidget />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <AuthenticatedLayout />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
