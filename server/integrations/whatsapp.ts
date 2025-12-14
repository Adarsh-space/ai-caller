/**
 * WhatsApp Cloud API Integration
 * Handles messaging, webhook verification, and conversation management
 */

import { EventEmitter } from "events";
import OpenAI from "openai";

const config = {
  token: process.env.WHATSAPP_TOKEN || "",
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "telecaller_webhook_verify",
};

// OpenAI client for AI responses - lazy initialization
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: "text" | "image" | "audio" | "video" | "document" | "location" | "contacts" | "interactive" | "button";
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; mime_type: string; filename: string; caption?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: Array<{ name: { formatted_name: string }; phones: Array<{ phone: string }> }>;
  interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
  button?: { text: string; payload: string };
}

export interface WhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

export interface WebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: WhatsAppContact[];
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface SendMessageOptions {
  to: string;
  text: string;
  replyToMessageId?: string;
}

export interface SendTemplateOptions {
  to: string;
  templateName: string;
  languageCode: string;
  components?: Array<{
    type: "header" | "body" | "button";
    parameters: Array<{ type: string; text?: string; image?: { link: string } }>;
  }>;
}

export interface IntentConfig {
  greeting: string;
  fallbackMessage: string;
  allowedTopics: string[];
  businessInfo: Record<string, any>;
}

// Intent detection types
type Intent = "greeting" | "pricing" | "booking" | "support" | "stop" | "unknown";

class WhatsAppClient extends EventEmitter {
  private baseUrl = "https://graph.facebook.com/v18.0";
  private conversationContexts: Map<string, { intent: Intent; lastQuestion?: string; messages: string[] }> = new Map();

  isConfigured(): boolean {
    return !!(config.token && config.phoneNumberId);
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Verify webhook (GET request from Meta)
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === "subscribe" && token === config.verifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Parse incoming webhook payload
   */
  parseWebhook(payload: WebhookPayload): {
    messages: Array<{ message: WhatsAppMessage; contact: WhatsAppContact; phoneNumberId: string }>;
    statuses: Array<{ id: string; status: string; recipientId: string }>;
  } {
    const result = {
      messages: [] as Array<{ message: WhatsAppMessage; contact: WhatsAppContact; phoneNumberId: string }>,
      statuses: [] as Array<{ id: string; status: string; recipientId: string }>,
    };

    if (payload.object !== "whatsapp_business_account") {
      return result;
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const phoneNumberId = value.metadata.phone_number_id;

        // Process messages
        if (value.messages && value.contacts) {
          for (let i = 0; i < value.messages.length; i++) {
            const message = value.messages[i];
            const contact = value.contacts[i] || value.contacts[0];
            result.messages.push({ message, contact, phoneNumberId });
            this.emit("message", { message, contact, phoneNumberId });
          }
        }

        // Process status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            result.statuses.push({
              id: status.id,
              status: status.status,
              recipientId: status.recipient_id,
            });
            this.emit("status", status);
          }
        }
      }
    }

    return result;
  }

  /**
   * Send a text message
   */
  async sendMessage(options: SendMessageOptions): Promise<{ messageId: string }> {
    if (!this.isConfigured()) {
      throw new Error("WhatsApp not configured. Please provide API credentials.");
    }

    const body: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: options.to,
      type: "text",
      text: { body: options.text },
    };

    if (options.replyToMessageId) {
      body.context = { message_id: options.replyToMessageId };
    }

    const response = await fetch(`${this.baseUrl}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp send failed: ${error}`);
    }

    const data = await response.json();
    return { messageId: data.messages[0].id };
  }

  /**
   * Send a template message (for starting conversations)
   */
  async sendTemplate(options: SendTemplateOptions): Promise<{ messageId: string }> {
    if (!this.isConfigured()) {
      throw new Error("WhatsApp not configured");
    }

    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: options.to,
      type: "template",
      template: {
        name: options.templateName,
        language: { code: options.languageCode },
        components: options.components || [],
      },
    };

    const response = await fetch(`${this.baseUrl}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp template send failed: ${await response.text()}`);
    }

    const data = await response.json();
    return { messageId: data.messages[0].id };
  }

  /**
   * Send interactive buttons
   */
  async sendButtons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<{ messageId: string }> {
    if (!this.isConfigured()) {
      throw new Error("WhatsApp not configured");
    }

    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.slice(0, 3).map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title.substring(0, 20) },
          })),
        },
      },
    };

    const response = await fetch(`${this.baseUrl}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp buttons send failed: ${await response.text()}`);
    }

    const data = await response.json();
    return { messageId: data.messages[0].id };
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    if (!this.isConfigured()) return;

    await fetch(`${this.baseUrl}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  }

  /**
   * Detect user intent from message
   */
  detectIntent(text: string, context?: { lastIntent?: Intent }): Intent {
    const lowerText = text.toLowerCase().trim();

    // Stop/opt-out detection
    if (
      lowerText === "stop" ||
      lowerText.includes("unsubscribe") ||
      lowerText.includes("don't message") ||
      lowerText.includes("opt out") ||
      lowerText.includes("remove me")
    ) {
      return "stop";
    }

    // Greeting detection
    if (
      lowerText === "hi" ||
      lowerText === "hello" ||
      lowerText === "hey" ||
      lowerText.startsWith("hi ") ||
      lowerText.startsWith("hello ") ||
      lowerText === "good morning" ||
      lowerText === "good afternoon" ||
      lowerText === "good evening"
    ) {
      return "greeting";
    }

    // Pricing detection
    if (
      lowerText.includes("price") ||
      lowerText.includes("cost") ||
      lowerText.includes("how much") ||
      lowerText.includes("pricing") ||
      lowerText.includes("rate") ||
      lowerText.includes("plan") ||
      lowerText.includes("subscription")
    ) {
      return "pricing";
    }

    // Booking detection
    if (
      lowerText.includes("book") ||
      lowerText.includes("appointment") ||
      lowerText.includes("schedule") ||
      lowerText.includes("demo") ||
      lowerText.includes("meeting") ||
      lowerText.includes("call back")
    ) {
      return "booking";
    }

    // Support detection
    if (
      lowerText.includes("help") ||
      lowerText.includes("support") ||
      lowerText.includes("issue") ||
      lowerText.includes("problem") ||
      lowerText.includes("not working") ||
      lowerText.includes("billing") ||
      lowerText.includes("refund")
    ) {
      return "support";
    }

    // Follow-up handling
    if (context?.lastIntent && (lowerText === "yes" || lowerText === "okay" || lowerText === "ok" || lowerText === "sure")) {
      return context.lastIntent;
    }

    return "unknown";
  }

  /**
   * Generate AI response based on intent and config
   */
  async generateResponse(
    userMessage: string,
    intent: Intent,
    agentConfig: IntentConfig,
    conversationHistory: string[] = []
  ): Promise<string> {
    // Handle opt-out immediately
    if (intent === "stop") {
      return "Understood. You won't receive further messages from us. If you change your mind, you can message us anytime.";
    }

    // Handle greeting with configured response
    if (intent === "greeting" && conversationHistory.length === 0) {
      return agentConfig.greeting;
    }

    // Build context-aware prompt for OpenAI
    const systemPrompt = `You are a helpful WhatsApp assistant for a business.

STRICT RULES:
1. Keep responses SHORT (max 2-3 sentences for WhatsApp)
2. Be friendly but professional
3. Only discuss these topics: ${agentConfig.allowedTopics.join(", ")}
4. For topics outside scope, use this fallback: "${agentConfig.fallbackMessage}"
5. Never make up information - only use provided business info
6. Ask clarifying questions when unsure
7. Always confirm before taking actions (like booking)

BUSINESS INFO:
${JSON.stringify(agentConfig.businessInfo, null, 2)}

CURRENT INTENT: ${intent}

Respond naturally as a WhatsApp message (no markdown, no bullet points).`;

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-6).map((msg, i) => ({
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: msg,
      })),
      { role: "user", content: userMessage },
    ];

    try {
      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 150, // Keep responses short for WhatsApp
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content || agentConfig.fallbackMessage;
    } catch (error) {
      console.error("OpenAI error:", error);
      return agentConfig.fallbackMessage;
    }
  }

  /**
   * Process incoming message and generate response
   */
  async processMessage(
    message: WhatsAppMessage,
    contact: WhatsAppContact,
    agentConfig: IntentConfig
  ): Promise<{ response: string; intent: Intent; shouldOptOut: boolean }> {
    const userPhone = contact.wa_id;
    const text = message.text?.body || "";

    // Get or create conversation context
    let context = this.conversationContexts.get(userPhone);
    if (!context) {
      context = { intent: "unknown", messages: [] };
      this.conversationContexts.set(userPhone, context);
    }

    // Detect intent
    const intent = this.detectIntent(text, { lastIntent: context.intent });
    context.intent = intent;
    context.messages.push(text);

    // Generate response
    const response = await this.generateResponse(text, intent, agentConfig, context.messages);
    context.messages.push(response);

    // Limit conversation history
    if (context.messages.length > 20) {
      context.messages = context.messages.slice(-10);
    }

    return {
      response,
      intent,
      shouldOptOut: intent === "stop",
    };
  }

  /**
   * Clear conversation context (for opt-out or conversation end)
   */
  clearContext(userPhone: string): void {
    this.conversationContexts.delete(userPhone);
  }

  /**
   * Check if within 24-hour conversation window
   */
  isWithinConversationWindow(lastMessageTimestamp: number): boolean {
    const windowDuration = 24 * 60 * 60 * 1000; // 24 hours
    return Date.now() - lastMessageTimestamp < windowDuration;
  }

  /**
   * Estimate cost for a conversation
   */
  estimateCost(isBusinessInitiated: boolean, country: string = "IN"): { costINR: number; description: string } {
    // Meta WhatsApp pricing (approximate for India)
    if (isBusinessInitiated) {
      return { costINR: 0.85, description: "Business-initiated template message" };
    }
    return { costINR: 0.40, description: "User-initiated conversation (24h window)" };
  }
}

// Export singleton instance
export const whatsapp = new WhatsAppClient();
