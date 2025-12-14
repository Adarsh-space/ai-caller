import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageCircle, Search, Send, Bot, User, MoreVertical, Tag, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { WAConversation, WAMessage } from "@shared/schema";

export default function WhatsAppPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<WAConversation | null>(null);
  const [newMessage, setNewMessage] = useState("");

  const { data: conversations, isLoading: conversationsLoading } = useQuery<WAConversation[]>({
    queryKey: ["/api/whatsapp/conversations"],
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<WAMessage[]>({
    queryKey: ["/api/whatsapp/conversations", selectedConversation?.id, "messages"],
    enabled: !!selectedConversation,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      return apiRequest("POST", `/api/whatsapp/conversations/${selectedConversation?.id}/messages`, { text });
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", selectedConversation?.id, "messages"] });
    },
  });

  const toggleAIModeMutation = useMutation({
    mutationFn: async (aiMode: boolean) => {
      return apiRequest("PATCH", `/api/whatsapp/conversations/${selectedConversation?.id}`, { aiMode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
    },
  });

  const filteredConversations = conversations?.filter((conv) =>
    conv.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.userPhone.includes(searchQuery)
  );

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;
    sendMessageMutation.mutate(newMessage);
  };

  return (
    <div className="h-full flex">
      <div className="w-80 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold flex items-center gap-2" data-testid="text-page-title">
            <MessageCircle className="h-5 w-5" />
            WhatsApp Inbox
          </h1>
        </div>
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-conversations"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {conversationsLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3">
                  <Skeleton className="h-14 w-full" />
                </div>
              ))}
            </div>
          ) : filteredConversations && filteredConversations.length > 0 ? (
            <div className="space-y-1 p-2">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-md cursor-pointer hover-elevate",
                    selectedConversation?.id === conv.id && "bg-accent"
                  )}
                  onClick={() => setSelectedConversation(conv)}
                  data-testid={`conversation-${conv.id}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-chart-2 text-white text-sm">
                      {conv.userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{conv.userName}</p>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(conv.lastMessageAt, { addSuffix: false })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{conv.userPhone}</p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {conv.aiMode && (
                        <Badge variant="secondary" className="text-xs">
                          <Bot className="h-3 w-3 mr-1" />
                          AI
                        </Badge>
                      )}
                      {conv.humanTakeover && (
                        <Badge variant="outline" className="text-xs">
                          <User className="h-3 w-3 mr-1" />
                          Human
                        </Badge>
                      )}
                      {conv.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No conversations yet</p>
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="p-4 border-b flex items-center justify-between gap-4 bg-background">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-chart-2 text-white">
                    {selectedConversation.userName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedConversation.userName}</p>
                  <p className="text-sm text-muted-foreground">{selectedConversation.userPhone}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="ai-mode"
                    checked={selectedConversation.aiMode}
                    onCheckedChange={(checked) => toggleAIModeMutation.mutate(checked)}
                    data-testid="switch-ai-mode"
                  />
                  <Label htmlFor="ai-mode" className="text-sm">AI Mode</Label>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid="button-more-options">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Tag className="h-4 w-4 mr-2" />
                      Add Tag
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reset AI Context
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4 bg-muted/20">
              {messagesLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className={cn("h-16 w-2/3", i % 2 === 0 ? "" : "ml-auto")} />
                  ))}
                </div>
              ) : messages && messages.length > 0 ? (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex flex-col max-w-[70%]",
                        msg.from === "USER" ? "items-start" : "items-end ml-auto"
                      )}
                      data-testid={`message-${msg.id}`}
                    >
                      <div
                        className={cn(
                          "rounded-lg px-4 py-2",
                          msg.from === "USER"
                            ? "bg-muted text-foreground"
                            : msg.from === "AI"
                            ? "bg-primary text-primary-foreground"
                            : "bg-chart-2 text-white"
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-xs text-muted-foreground">
                          {format(msg.timestamp, "h:mm a")}
                        </span>
                        {msg.from !== "USER" && (
                          <span className="text-xs text-muted-foreground">
                            {msg.from === "AI" ? "AI replied" : "Human replied"}
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs capitalize">
                          {msg.deliveryStatus.toLowerCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <p>No messages yet</p>
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t bg-background">
              <div className="flex items-end gap-2">
                <Textarea
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="min-h-[80px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  data-testid="button-send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a conversation to view messages</p>
            </div>
          </div>
        )}
      </div>

      {selectedConversation && (
        <div className="w-72 border-l p-4 bg-muted/30">
          <h3 className="font-semibold mb-4">Contact Details</h3>
          <div className="space-y-4">
            <div className="text-center">
              <Avatar className="h-16 w-16 mx-auto">
                <AvatarFallback className="bg-chart-2 text-white text-xl">
                  {selectedConversation.userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="font-medium mt-2">{selectedConversation.userName}</p>
              <p className="text-sm text-muted-foreground">{selectedConversation.userPhone}</p>
            </div>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={selectedConversation.status === "OPEN" ? "default" : "secondary"}>
                    {selectedConversation.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">AI Mode</p>
                  <p className="font-medium">{selectedConversation.aiMode ? "Enabled" : "Disabled"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Human Takeover</p>
                  <p className="font-medium">{selectedConversation.humanTakeover ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Credits Used</p>
                  <p className="font-medium">{selectedConversation.creditsDeductedThisWindow.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>

            {selectedConversation.tags.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {selectedConversation.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
