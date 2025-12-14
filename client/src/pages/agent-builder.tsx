import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Bot,
  Save,
  ArrowLeft,
  Volume2,
  Play,
  Pause,
  Settings,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  Loader2,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Agent, Intent } from "@shared/schema";

const agentFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  language: z.string(),
  timezone: z.string(),
  instructions: z.string().min(10, "Instructions are required"),
  greeting: z.string().min(5, "Greeting is required"),
  fallbackMessage: z.string().min(5, "Fallback message is required"),
  rules: z.object({
    noLegal: z.boolean(),
    noMedical: z.boolean(),
    confirmBookings: z.boolean(),
    handoffOnConfusion: z.boolean(),
  }),
  voice: z.object({
    provider: z.enum(["elevenlabs", "native"]),
    voiceId: z.string(),
    speed: z.number().min(0.5).max(2),
    pitch: z.number().min(-10).max(10),
  }),
  latencyMode: z.enum(["FAST", "BALANCED", "NATURAL"]),
  status: z.enum(["ACTIVE", "PAUSED", "DRAFT"]),
});

type AgentFormValues = z.infer<typeof agentFormSchema>;

const defaultValues: AgentFormValues = {
  name: "",
  language: "en",
  timezone: "Asia/Kolkata",
  instructions: "You are a polite and professional sales agent...",
  greeting: "Hi, this is a call from our company. Is this a good time to talk?",
  fallbackMessage: "I'm not sure about that. Let me connect you with a human representative.",
  rules: {
    noLegal: true,
    noMedical: true,
    confirmBookings: true,
    handoffOnConfusion: true,
  },
  voice: {
    provider: "elevenlabs",
    voiceId: "rachel",
    speed: 1.0,
    pitch: 0,
  },
  latencyMode: "BALANCED",
  status: "DRAFT",
};

const voices = [
  { id: "rachel", name: "Rachel", accent: "American", gender: "Female" },
  { id: "josh", name: "Josh", accent: "American", gender: "Male" },
  { id: "emily", name: "Emily", accent: "British", gender: "Female" },
  { id: "sam", name: "Sam", accent: "Australian", gender: "Male" },
  { id: "priya", name: "Priya", accent: "Indian", gender: "Female" },
  { id: "adam", name: "Adam", accent: "American", gender: "Male" },
  { id: "bella", name: "Bella", accent: "British", gender: "Female" },
  { id: "charlie", name: "Charlie", accent: "British", gender: "Male" },
  { id: "domi", name: "Domi", accent: "American", gender: "Female" },
  { id: "elli", name: "Elli", accent: "American", gender: "Female" },
  { id: "antoni", name: "Antoni", accent: "American", gender: "Male" },
  { id: "arnold", name: "Arnold", accent: "American", gender: "Male" },
];

const languages = [
  { code: "en-US", name: "English (US)", region: "Americas" },
  { code: "en-GB", name: "English (UK)", region: "Europe" },
  { code: "en-AU", name: "English (Australia)", region: "Oceania" },
  { code: "en-IN", name: "English (India)", region: "Asia" },
  { code: "es-ES", name: "Spanish (Spain)", region: "Europe" },
  { code: "es-MX", name: "Spanish (Mexico)", region: "Americas" },
  { code: "es-AR", name: "Spanish (Argentina)", region: "Americas" },
  { code: "fr-FR", name: "French (France)", region: "Europe" },
  { code: "fr-CA", name: "French (Canada)", region: "Americas" },
  { code: "de-DE", name: "German", region: "Europe" },
  { code: "it-IT", name: "Italian", region: "Europe" },
  { code: "pt-BR", name: "Portuguese (Brazil)", region: "Americas" },
  { code: "pt-PT", name: "Portuguese (Portugal)", region: "Europe" },
  { code: "nl-NL", name: "Dutch", region: "Europe" },
  { code: "pl-PL", name: "Polish", region: "Europe" },
  { code: "ru-RU", name: "Russian", region: "Europe" },
  { code: "tr-TR", name: "Turkish", region: "Asia" },
  { code: "ar-SA", name: "Arabic (Saudi Arabia)", region: "Middle East" },
  { code: "ar-AE", name: "Arabic (UAE)", region: "Middle East" },
  { code: "ar-EG", name: "Arabic (Egypt)", region: "Middle East" },
  { code: "hi-IN", name: "Hindi", region: "Asia" },
  { code: "bn-IN", name: "Bengali", region: "Asia" },
  { code: "ta-IN", name: "Tamil", region: "Asia" },
  { code: "te-IN", name: "Telugu", region: "Asia" },
  { code: "kn-IN", name: "Kannada", region: "Asia" },
  { code: "ml-IN", name: "Malayalam", region: "Asia" },
  { code: "mr-IN", name: "Marathi", region: "Asia" },
  { code: "gu-IN", name: "Gujarati", region: "Asia" },
  { code: "pa-IN", name: "Punjabi", region: "Asia" },
  { code: "zh-CN", name: "Chinese (Mandarin)", region: "Asia" },
  { code: "zh-HK", name: "Chinese (Cantonese)", region: "Asia" },
  { code: "zh-TW", name: "Chinese (Taiwan)", region: "Asia" },
  { code: "ja-JP", name: "Japanese", region: "Asia" },
  { code: "ko-KR", name: "Korean", region: "Asia" },
  { code: "th-TH", name: "Thai", region: "Asia" },
  { code: "vi-VN", name: "Vietnamese", region: "Asia" },
  { code: "id-ID", name: "Indonesian", region: "Asia" },
  { code: "ms-MY", name: "Malay", region: "Asia" },
  { code: "fil-PH", name: "Filipino/Tagalog", region: "Asia" },
  { code: "sw-KE", name: "Swahili", region: "Africa" },
  { code: "he-IL", name: "Hebrew", region: "Middle East" },
  { code: "el-GR", name: "Greek", region: "Europe" },
  { code: "cs-CZ", name: "Czech", region: "Europe" },
  { code: "ro-RO", name: "Romanian", region: "Europe" },
  { code: "hu-HU", name: "Hungarian", region: "Europe" },
  { code: "sv-SE", name: "Swedish", region: "Europe" },
  { code: "no-NO", name: "Norwegian", region: "Europe" },
  { code: "da-DK", name: "Danish", region: "Europe" },
  { code: "fi-FI", name: "Finnish", region: "Europe" },
  { code: "uk-UA", name: "Ukrainian", region: "Europe" },
  { code: "bg-BG", name: "Bulgarian", region: "Europe" },
  { code: "hr-HR", name: "Croatian", region: "Europe" },
  { code: "sk-SK", name: "Slovak", region: "Europe" },
  { code: "sl-SI", name: "Slovenian", region: "Europe" },
  { code: "sr-RS", name: "Serbian", region: "Europe" },
  { code: "ca-ES", name: "Catalan", region: "Europe" },
  { code: "af-ZA", name: "Afrikaans", region: "Africa" },
  { code: "ur-PK", name: "Urdu", region: "Asia" },
  { code: "fa-IR", name: "Persian/Farsi", region: "Middle East" },
];

export default function AgentBuilderPage() {
  const [, params] = useRoute("/agents/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isNew = params?.id === "new";
  const agentId = isNew ? null : params?.id;
  
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showIntentForm, setShowIntentForm] = useState(false);
  const [intentName, setIntentName] = useState("");
  const [intentTriggers, setIntentTriggers] = useState("");
  const [intentResponse, setIntentResponse] = useState("");
  const [intentEscalate, setIntentEscalate] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testCallLoading, setTestCallLoading] = useState(false);

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ["/api/agents", agentId],
    enabled: !!agentId,
  });

  const { data: intents = [] } = useQuery<Intent[]>({
    queryKey: ["/api/agents", agentId, "intents"],
    enabled: !!agentId,
  });

  const { data: voiceStatus } = useQuery<{ configured: boolean; provider: string }>({
    queryKey: ["/api/voice/status"],
  });

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (agent) {
      form.reset({
        name: agent.name,
        language: agent.language,
        timezone: agent.timezone,
        instructions: agent.instructions,
        greeting: agent.greeting,
        fallbackMessage: agent.fallbackMessage,
        rules: agent.rules,
        voice: agent.voice,
        latencyMode: agent.latencyMode,
        status: agent.status,
      });
    }
  }, [agent, form]);

  const saveMutation = useMutation({
    mutationFn: (data: AgentFormValues) =>
      isNew
        ? apiRequest("POST", "/api/agents", data)
        : apiRequest("PATCH", `/api/agents/${agentId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: isNew ? "Agent created successfully" : "Agent updated successfully" });
      navigate("/agents");
    },
    onError: () => {
      toast({ title: "Failed to save agent", variant: "destructive" });
    },
  });

  const createIntentMutation = useMutation({
    mutationFn: (data: { name: string; triggers: string[]; response: string; escalateToHuman: boolean }) =>
      apiRequest("POST", `/api/agents/${agentId}/intents`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "intents"] });
      toast({ title: "Intent created successfully" });
      setShowIntentForm(false);
      setIntentName("");
      setIntentTriggers("");
      setIntentResponse("");
      setIntentEscalate(false);
    },
    onError: () => {
      toast({ title: "Failed to create intent", variant: "destructive" });
    },
  });

  const deleteIntentMutation = useMutation({
    mutationFn: (intentId: string) =>
      apiRequest("DELETE", `/api/agents/${agentId}/intents/${intentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "intents"] });
      toast({ title: "Intent deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete intent", variant: "destructive" });
    },
  });

  const handlePlayVoice = async () => {
    const voiceId = form.getValues("voice.voiceId");
    const greeting = form.getValues("greeting");
    
    if (isPlayingVoice && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingVoice(false);
      return;
    }

    if (!voiceStatus?.configured) {
      toast({ title: "Voice preview not available", description: "ElevenLabs API key not configured", variant: "destructive" });
      return;
    }

    setVoiceLoading(true);
    try {
      const response = await fetch("/api/voice/preview", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
        },
        body: JSON.stringify({ voiceId, text: greeting || "Hello, this is a voice preview test." }),
      });
      
      if (!response.ok) {
        if (response.status === 503) {
          toast({ title: "Voice preview not available", description: "ElevenLabs API key not configured", variant: "destructive" });
        } else {
          toast({ title: "Voice preview failed", description: "Failed to generate audio", variant: "destructive" });
        }
        return;
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlayingVoice(false);
        audioRef.current = null;
      };
      
      await audio.play();
      setIsPlayingVoice(true);
    } catch (error) {
      toast({ title: "Voice preview failed", description: "An error occurred", variant: "destructive" });
    } finally {
      setVoiceLoading(false);
    }
  };

  const handleTestCall = async () => {
    if (!testPhone || !agentId) return;
    
    setTestCallLoading(true);
    try {
      const response = await apiRequest("POST", "/api/calls/initiate", {
        agentId,
        phone: testPhone,
      });
      toast({ title: "Test call initiated", description: "You should receive a call shortly" });
    } catch (error) {
      toast({ title: "Failed to initiate call", variant: "destructive" });
    } finally {
      setTestCallLoading(false);
    }
  };

  const handleCreateIntent = () => {
    if (!intentName || !intentTriggers || !intentResponse) {
      toast({ title: "Please fill all intent fields", variant: "destructive" });
      return;
    }
    createIntentMutation.mutate({
      name: intentName,
      triggers: intentTriggers.split(",").map(t => t.trim()).filter(Boolean),
      response: intentResponse,
      escalateToHuman: intentEscalate,
    });
  };

  const onSubmit = (data: AgentFormValues) => {
    saveMutation.mutate(data);
  };

  if (isLoading && !isNew) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="h-[600px]" />
          <Skeleton className="h-[600px]" />
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/agents")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            {isNew ? "Create Agent" : "Edit Agent"}
          </h1>
          <p className="text-muted-foreground">Configure your AI voice agent</p>
        </div>
        <Button
          onClick={form.handleSubmit(onSubmit)}
          disabled={saveMutation.isPending}
          data-testid="button-save-agent"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Agent
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Agent Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Agent Settings
                </CardTitle>
                <CardDescription>Basic configuration and rules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Sales Agent" data-testid="input-agent-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Language</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-language">
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px]">
                            {languages.map((lang) => (
                              <SelectItem key={lang.code} value={lang.code}>
                                {lang.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="latencyMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Response Speed</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-latency">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="FAST">Fast</SelectItem>
                            <SelectItem value="BALANCED">Balanced</SelectItem>
                            <SelectItem value="NATURAL">Natural</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Instructions</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={4}
                          placeholder="Describe what this agent should do..."
                          data-testid="textarea-instructions"
                        />
                      </FormControl>
                      <FormDescription>Tell the AI how to behave during calls</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <FormLabel>Safety Rules</FormLabel>
                  <FormField
                    control={form.control}
                    name="rules.noLegal"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <FormLabel className="font-normal">Don't answer legal questions</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rules.noMedical"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <FormLabel className="font-normal">Don't answer medical questions</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rules.confirmBookings"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <FormLabel className="font-normal">Confirm before booking</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rules.handoffOnConfusion"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <FormLabel className="font-normal">Transfer to human if confused</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Center Panel - Conversation Flow */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Conversation Flow
                </CardTitle>
                <CardDescription>Define greetings and responses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="greeting"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opening Greeting</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={3}
                          placeholder="Hi, this is..."
                          data-testid="textarea-greeting"
                        />
                      </FormControl>
                      <FormDescription>First message when call connects</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fallbackMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fallback Response</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={3}
                          placeholder="I'm not sure about that..."
                          data-testid="textarea-fallback"
                        />
                      </FormControl>
                      <FormDescription>Used when agent doesn't understand</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <FormLabel>Intent Responses</FormLabel>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={isNew}
                      onClick={() => setShowIntentForm(!showIntentForm)}
                      data-testid="button-add-intent"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Intent
                    </Button>
                  </div>

                  {showIntentForm && (
                    <div className="space-y-3 p-4 rounded-md border bg-muted/30">
                      <Input
                        placeholder="Intent name (e.g., Pricing Inquiry)"
                        value={intentName}
                        onChange={(e) => setIntentName(e.target.value)}
                        data-testid="input-intent-name"
                      />
                      <Input
                        placeholder="Triggers (comma-separated: price, cost, how much)"
                        value={intentTriggers}
                        onChange={(e) => setIntentTriggers(e.target.value)}
                        data-testid="input-intent-triggers"
                      />
                      <Textarea
                        placeholder="Response text..."
                        value={intentResponse}
                        onChange={(e) => setIntentResponse(e.target.value)}
                        rows={2}
                        data-testid="textarea-intent-response"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={intentEscalate}
                            onCheckedChange={setIntentEscalate}
                          />
                          <span className="text-sm">Escalate to human</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowIntentForm(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleCreateIntent}
                            disabled={createIntentMutation.isPending}
                            data-testid="button-save-intent"
                          >
                            {createIntentMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {intents.length === 0 && !showIntentForm ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No intents configured</p>
                      <p className="text-xs">{isNew ? "Save the agent first to add intents" : "Add intents to handle specific topics"}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {intents.map((intent) => (
                        <div key={intent.id} className="p-3 rounded-md border group">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{intent.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {intent.escalateToHuman ? "Escalate" : "Auto"}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => deleteIntentMutation.mutate(intent.id)}
                                data-testid={`button-delete-intent-${intent.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Triggers: {intent.triggers.join(", ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right Panel - Voice & Testing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="h-5 w-5" />
                  Voice & Testing
                </CardTitle>
                <CardDescription>Voice settings and test calls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="voice.provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voice Provider</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-voice-provider">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                          <SelectItem value="native">Native</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="voice.voiceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voice</FormLabel>
                      <div className="flex items-center gap-2">
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-voice" className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {voices.map((voice) => (
                              <SelectItem key={voice.id} value={voice.id}>
                                {voice.name} ({voice.accent}, {voice.gender})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handlePlayVoice}
                          disabled={voiceLoading}
                          data-testid="button-preview-voice"
                        >
                          {voiceLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isPlayingVoice ? (
                            <Square className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <FormDescription>Click play to preview voice with greeting</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="voice.speed"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Speed</FormLabel>
                        <span className="text-sm text-muted-foreground">{field.value}x</span>
                      </div>
                      <FormControl>
                        <Slider
                          value={[field.value]}
                          onValueChange={([v]) => field.onChange(v)}
                          min={0.5}
                          max={2}
                          step={0.1}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="voice.pitch"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Pitch</FormLabel>
                        <span className="text-sm text-muted-foreground">{field.value}</span>
                      </div>
                      <FormControl>
                        <Slider
                          value={[field.value]}
                          onValueChange={([v]) => field.onChange(v)}
                          min={-10}
                          max={10}
                          step={1}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="pt-4 border-t space-y-4">
                  <FormLabel>Test Call</FormLabel>
                  <div className="p-4 rounded-md border border-dashed text-center">
                    <Phone className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Test this agent by calling yourself
                    </p>
                    <Input
                      placeholder="+1 234 567 8900"
                      className="mb-2"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      data-testid="input-test-phone"
                    />
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      disabled={isNew || testCallLoading || !testPhone}
                      onClick={handleTestCall}
                      data-testid="button-test-call"
                    >
                      {testCallLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Start Test Call
                    </Button>
                    {isNew && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Save the agent first to test calls
                      </p>
                    )}
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
