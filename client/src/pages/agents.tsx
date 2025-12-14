import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bot, Plus, Play, Pause, Edit, Trash2, Volume2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Agent } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function AgentsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [deleteAgent, setDeleteAgent] = useState<Agent | null>(null);
  const [testCallAgent, setTestCallAgent] = useState<Agent | null>(null);
  const [testPhone, setTestPhone] = useState("");

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agent deleted successfully" });
      setDeleteAgent(null);
    },
    onError: () => {
      toast({ title: "Failed to delete agent", variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/agents/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agent status updated" });
    },
  });

  const testCallMutation = useMutation({
    mutationFn: ({ agentId, phone }: { agentId: string; phone: string }) =>
      apiRequest("POST", "/api/calls/initiate", { agentId, phone }),
    onSuccess: () => {
      toast({ title: "Test call initiated", description: "The call is being placed now." });
      setTestCallAgent(null);
      setTestPhone("");
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
    },
    onError: () => {
      toast({ title: "Failed to initiate call", variant: "destructive" });
    },
  });

  const handleTestCall = () => {
    if (!testCallAgent || !testPhone.trim()) return;
    testCallMutation.mutate({ agentId: testCallAgent.id, phone: testPhone.trim() });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Agents</h1>
          <p className="text-muted-foreground">Configure your voice AI agents</p>
        </div>
        <Button onClick={() => navigate("/agents/new")} data-testid="button-create-agent">
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      </div>

      {!agents || agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Create your first AI voice agent to start making automated calls"
          actionLabel="Create Agent"
          onAction={() => navigate("/agents/new")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id} className="group" data-testid={`agent-card-${agent.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <CardDescription>{agent.language} • {agent.latencyMode}</CardDescription>
                    </div>
                  </div>
                  <StatusBadge status={agent.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {agent.instructions || "No instructions set"}
                </p>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Volume2 className="h-4 w-4" />
                  <span>{agent.voice.provider} • {agent.voice.voiceId}</span>
                </div>

                <div className="text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(agent.updatedAt, { addSuffix: true })}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  {agent.status === "ACTIVE" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleStatusMutation.mutate({ id: agent.id, status: "PAUSED" })}
                      data-testid={`button-pause-${agent.id}`}
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Pause
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleStatusMutation.mutate({ id: agent.id, status: "ACTIVE" })}
                      data-testid={`button-activate-${agent.id}`}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Activate
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/agents/${agent.id}`)}
                    data-testid={`button-edit-${agent.id}`}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTestCallAgent(agent)}
                    data-testid={`button-test-call-${agent.id}`}
                  >
                    <Phone className="h-4 w-4 mr-1" />
                    Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto text-muted-foreground"
                    onClick={() => setDeleteAgent(agent)}
                    data-testid={`button-delete-${agent.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteAgent} onOpenChange={() => setDeleteAgent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteAgent?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAgent && deleteMutation.mutate(deleteAgent.id)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!testCallAgent} onOpenChange={() => { setTestCallAgent(null); setTestPhone(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Test Call with {testCallAgent?.name}
            </DialogTitle>
            <DialogDescription>
              Enter a phone number to initiate a test call with this AI agent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="test-phone">Phone Number</Label>
              <Input
                id="test-phone"
                placeholder="+1 (555) 123-4567"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                data-testid="input-test-phone"
              />
              <p className="text-sm text-muted-foreground">
                Include country code (e.g., +1 for US)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTestCallAgent(null); setTestPhone(""); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleTestCall} 
              disabled={!testPhone.trim() || testCallMutation.isPending}
              data-testid="button-initiate-test-call"
            >
              {testCallMutation.isPending ? "Calling..." : "Start Call"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
