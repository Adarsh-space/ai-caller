import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, PhoneIncoming, PhoneOutgoing, Play, FileText, Search, Filter, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import type { Call, Agent } from "@shared/schema";

export default function CallsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  const { data: calls, isLoading } = useQuery<Call[]>({
    queryKey: ["/api/calls"],
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const getAgentName = (agentId: string) => {
    return agents?.find((a) => a.id === agentId)?.name || "Unknown Agent";
  };

  const filteredCalls = calls?.filter((call) => {
    const matchesSearch =
      call.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.from.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || call.status === statusFilter;
    const matchesOutcome = outcomeFilter === "all" || call.outcome === outcomeFilter;
    const matchesDirection = directionFilter === "all" || call.direction === directionFilter;
    return matchesSearch && matchesStatus && matchesOutcome && matchesDirection;
  });

  const inboundCount = calls?.filter(c => c.direction === "INBOUND").length || 0;
  const outboundCount = calls?.filter(c => c.direction === "OUTBOUND").length || 0;

  const columns = [
    {
      key: "startedAt",
      header: "Date & Time",
      render: (call: Call) => (
        <div>
          <p className="font-medium">{format(call.startedAt, "MMM d, yyyy")}</p>
          <p className="text-sm text-muted-foreground">{format(call.startedAt, "h:mm a")}</p>
        </div>
      ),
    },
    {
      key: "direction",
      header: "Direction",
      render: (call: Call) => (
        <Badge variant="outline" className="font-normal">
          {call.direction === "INBOUND" ? "Inbound" : "Outbound"}
        </Badge>
      ),
    },
    {
      key: "to",
      header: "Phone",
      render: (call: Call) => (
        <div>
          <p className="font-medium">{call.direction === "OUTBOUND" ? call.to : call.from}</p>
          <p className="text-sm text-muted-foreground">{call.destinationCountry}</p>
        </div>
      ),
    },
    {
      key: "agentId",
      header: "Agent",
      render: (call: Call) => <span>{getAgentName(call.agentId)}</span>,
    },
    {
      key: "durationSec",
      header: "Duration",
      render: (call: Call) => {
        const mins = Math.floor(call.durationSec / 60);
        const secs = call.durationSec % 60;
        return <span>{mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}</span>;
      },
    },
    {
      key: "status",
      header: "Status",
      render: (call: Call) => <StatusBadge status={call.status} />,
    },
    {
      key: "outcome",
      header: "Outcome",
      render: (call: Call) => (call.outcome ? <StatusBadge status={call.outcome} /> : <span className="text-muted-foreground">-</span>),
    },
    {
      key: "usage",
      header: "Credits",
      render: (call: Call) => (
        <span className="font-medium">{call.usage.creditsDeducted.toFixed(2)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (call: Call) => (
        <div className="flex items-center gap-1">
          {call.recordingPath && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
              }}
              data-testid={`button-play-${call.id}`}
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCall(call);
            }}
            data-testid={`button-transcript-${call.id}`}
          >
            <FileText className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Call Logs</h1>
          <p className="text-muted-foreground">View and manage all call recordings</p>
        </div>
        <Button variant="outline" data-testid="button-export">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Tabs value={directionFilter} onValueChange={setDirectionFilter} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3" data-testid="tabs-direction">
          <TabsTrigger value="all" className="flex items-center gap-2" data-testid="tab-all">
            <Phone className="h-4 w-4" />
            All ({calls?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="INBOUND" className="flex items-center gap-2" data-testid="tab-inbound">
            <PhoneIncoming className="h-4 w-4" />
            Inbound ({inboundCount})
          </TabsTrigger>
          <TabsTrigger value="OUTBOUND" className="flex items-center gap-2" data-testid="tab-outbound">
            <PhoneOutgoing className="h-4 w-4" />
            Outbound ({outboundCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {directionFilter === "INBOUND" ? (
              <PhoneIncoming className="h-5 w-5" />
            ) : directionFilter === "OUTBOUND" ? (
              <PhoneOutgoing className="h-5 w-5" />
            ) : (
              <Phone className="h-5 w-5" />
            )}
            {directionFilter === "INBOUND" ? "Inbound Calls" : directionFilter === "OUTBOUND" ? "Outbound Calls" : "All Calls"}
          </CardTitle>
          <CardDescription>
            {filteredCalls?.length || 0} calls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="ANSWERED">Answered</SelectItem>
                <SelectItem value="NO_ANSWER">No Answer</SelectItem>
                <SelectItem value="BUSY">Busy</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-outcome">
                <SelectValue placeholder="Outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                <SelectItem value="INTERESTED">Interested</SelectItem>
                <SelectItem value="NOT_INTERESTED">Not Interested</SelectItem>
                <SelectItem value="CALLBACK">Callback</SelectItem>
                <SelectItem value="VOICEMAIL">Voicemail</SelectItem>
                <SelectItem value="DNC">Do Not Call</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={filteredCalls || []}
            isLoading={isLoading}
            emptyMessage="No calls found"
            onRowClick={(call) => setSelectedCall(call)}
          />
        </CardContent>
      </Card>

      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Call Details
            </DialogTitle>
            <DialogDescription>
              {selectedCall && format(selectedCall.startedAt, "MMMM d, yyyy 'at' h:mm a")}
            </DialogDescription>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Direction</p>
                  <p className="font-medium">{selectedCall.direction}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone Number</p>
                  <p className="font-medium">
                    {selectedCall.direction === "OUTBOUND" ? selectedCall.to : selectedCall.from}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{selectedCall.durationSec}s</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <StatusBadge status={selectedCall.status} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outcome</p>
                  {selectedCall.outcome ? (
                    <StatusBadge status={selectedCall.outcome} />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Credits Used</p>
                  <p className="font-medium">{selectedCall.usage.creditsDeducted.toFixed(2)}</p>
                </div>
              </div>

              {selectedCall.transcriptSummary && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Transcript Summary</p>
                  <ScrollArea className="h-48 rounded-md border p-4">
                    <p className="text-sm whitespace-pre-wrap">{selectedCall.transcriptSummary}</p>
                  </ScrollArea>
                </div>
              )}

              {selectedCall.recordingPath && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Recording</p>
                  <div className="flex items-center gap-4 p-4 rounded-md bg-muted">
                    <Button variant="default" data-testid="button-play-recording">
                      <Play className="h-4 w-4 mr-2" />
                      Play Recording
                    </Button>
                    <Button variant="outline" data-testid="button-download-recording">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
