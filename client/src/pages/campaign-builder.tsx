import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ArrowLeft,
  Save,
  Upload,
  Calendar,
  Clock,
  Link as LinkIcon,
  Users,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Campaign, Agent } from "@shared/schema";
import { format, addDays } from "date-fns";

const campaignFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  agentId: z.string().min(1, "Agent is required"),
  schedule: z.object({
    startAt: z.number(),
    endAt: z.number(),
    daysOfWeek: z.array(z.number()),
    startHour: z.number(),
    endHour: z.number(),
  }),
  maxCallsPerMinute: z.number().min(1).max(10),
  retryPolicy: z.object({
    maxRetries: z.number().min(0).max(5),
    retryDelaySec: z.number().min(60).max(3600),
  }),
  meetingLink: z.string().optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "RUNNING", "PAUSED", "COMPLETED"]),
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

const defaultValues: CampaignFormValues = {
  name: "",
  agentId: "",
  schedule: {
    startAt: Date.now(),
    endAt: addDays(Date.now(), 7).getTime(),
    daysOfWeek: [1, 2, 3, 4, 5],
    startHour: 9,
    endHour: 18,
  },
  maxCallsPerMinute: 2,
  retryPolicy: {
    maxRetries: 2,
    retryDelaySec: 300,
  },
  meetingLink: "",
  status: "DRAFT",
};

export default function CampaignBuilderPage() {
  const [, params] = useRoute("/campaigns/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [leadsFile, setLeadsFile] = useState<File | null>(null);
  const [leadsCount, setLeadsCount] = useState(0);
  const isNew = params?.id === "new";
  const campaignId = isNew ? null : params?.id;

  const { data: campaign, isLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (campaign) {
      form.reset({
        name: campaign.name,
        agentId: campaign.agentId,
        schedule: campaign.schedule,
        maxCallsPerMinute: campaign.maxCallsPerMinute,
        retryPolicy: campaign.retryPolicy,
        meetingLink: campaign.meetingLink || "",
        status: campaign.status,
      });
      setLeadsCount(campaign.totalLeads);
    }
  }, [campaign, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: CampaignFormValues) => {
      const result = isNew
        ? await apiRequest("POST", "/api/campaigns", data)
        : await apiRequest("PATCH", `/api/campaigns/${campaignId}`, data);
      
      if (leadsFile && result.id) {
        const formData = new FormData();
        formData.append("file", leadsFile);
        await fetch(`/api/campaigns/${result.id}/leads`, {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
          body: formData,
        });
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: isNew ? "Campaign created successfully" : "Campaign updated successfully" });
      navigate("/campaigns");
    },
    onError: () => {
      toast({ title: "Failed to save campaign", variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLeadsFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim());
        setLeadsCount(Math.max(0, lines.length - 1));
      };
      reader.readAsText(file);
    }
  };

  if (isLoading && !isNew) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/campaigns")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            {isNew ? "Create Campaign" : "Edit Campaign"}
          </h1>
          <p className="text-muted-foreground">Configure your outbound calling campaign</p>
        </div>
        <Button
          onClick={form.handleSubmit((data) => saveMutation.mutate(data))}
          disabled={saveMutation.isPending}
          data-testid="button-save-campaign"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Campaign
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Details</CardTitle>
                <CardDescription>Basic information and agent selection</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="December Sales Batch" data-testid="input-campaign-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AI Agent</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-agent">
                            <SelectValue placeholder="Select an agent" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Choose which AI agent will make the calls</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="meetingLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meeting Link (Optional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            className="pl-10"
                            placeholder="https://meet.google.com/xxx or https://zoom.us/j/xxx"
                            data-testid="input-meeting-link"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Google Meet or Zoom link for appointment scheduling
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <FormLabel>Upload Leads (CSV)</FormLabel>
                  <div className="border-2 border-dashed rounded-md p-6 text-center">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                      id="leads-upload"
                      data-testid="input-leads-file"
                    />
                    <label htmlFor="leads-upload" className="cursor-pointer">
                      {leadsFile ? (
                        <div className="space-y-2">
                          <FileSpreadsheet className="h-10 w-10 mx-auto text-chart-2" />
                          <p className="font-medium">{leadsFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {leadsCount} leads found
                          </p>
                        </div>
                      ) : leadsCount > 0 ? (
                        <div className="space-y-2">
                          <Users className="h-10 w-10 mx-auto text-muted-foreground" />
                          <p className="font-medium">{leadsCount} leads uploaded</p>
                          <p className="text-sm text-muted-foreground">
                            Click to upload new file
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                          <p className="font-medium">Upload CSV file</p>
                          <p className="text-sm text-muted-foreground">
                            Format: name, phone, metadata...
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Schedule & Pacing</CardTitle>
                <CardDescription>When and how fast to make calls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="schedule.startHour"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Hour</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(parseInt(v))}
                          value={field.value.toString()}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-start-hour">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from({ length: 24 }).map((_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i.toString().padStart(2, "0")}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="schedule.endHour"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Hour</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(parseInt(v))}
                          value={field.value.toString()}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-end-hour">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from({ length: 24 }).map((_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i.toString().padStart(2, "0")}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="maxCallsPerMinute"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Calls Per Minute</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(parseInt(v))}
                        value={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-calls-per-min">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 10].map((n) => (
                            <SelectItem key={n} value={n.toString()}>
                              {n} {n === 1 ? "call" : "calls"} per minute
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Maximum concurrent call rate</FormDescription>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="retryPolicy.maxRetries"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Retries</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(parseInt(v))}
                          value={field.value.toString()}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-max-retries">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[0, 1, 2, 3].map((n) => (
                              <SelectItem key={n} value={n.toString()}>
                                {n} {n === 1 ? "retry" : "retries"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="retryPolicy.retryDelaySec"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Retry Delay</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(parseInt(v))}
                          value={field.value.toString()}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-retry-delay">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="60">1 minute</SelectItem>
                            <SelectItem value="300">5 minutes</SelectItem>
                            <SelectItem value="600">10 minutes</SelectItem>
                            <SelectItem value="1800">30 minutes</SelectItem>
                            <SelectItem value="3600">1 hour</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="p-4 rounded-md bg-muted space-y-2">
                  <h4 className="font-medium">Estimated Credits</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Leads:</span>
                    <span>{leadsCount || campaign?.totalLeads || 0}</span>
                    <span className="text-muted-foreground">Est. per call:</span>
                    <span>~10 credits</span>
                    <span className="text-muted-foreground">Total estimated:</span>
                    <span className="font-medium text-primary">
                      {((leadsCount || campaign?.totalLeads || 0) * 10).toLocaleString()} credits
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
    </div>
  );
}
