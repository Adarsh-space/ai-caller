/**
 * SignalWire Integration - Voice Telephony
 * Handles outbound/inbound calls, WebSocket audio streaming, call state management
 */

import { EventEmitter } from "events";

// Configuration from environment
const config = {
  projectId: process.env.SIGNALWIRE_PROJECT_ID || "",
  token: process.env.SIGNALWIRE_TOKEN || "",
  spaceUrl: process.env.SIGNALWIRE_SPACE_URL || "",
};

export interface CallOptions {
  to: string;
  from: string;
  agentId: string;
  tenantId: string;
  campaignId?: string;
  webhookUrl: string;
}

export interface CallState {
  callId: string;
  status: "initiated" | "ringing" | "answered" | "completed" | "failed";
  direction: "inbound" | "outbound";
  to: string;
  from: string;
  startedAt: number;
  endedAt?: number;
  durationSec: number;
  recordingUrl?: string;
}

export interface SignalWireConfig {
  projectId: string;
  token: string;
  spaceUrl: string;
}

class SignalWireClient extends EventEmitter {
  private config: SignalWireConfig;
  private activeCalls: Map<string, CallState> = new Map();

  constructor() {
    super();
    this.config = config;
  }

  isConfigured(): boolean {
    return !!(this.config.projectId && this.config.token && this.config.spaceUrl);
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.config.projectId}:${this.config.token}`).toString("base64");
    return `Basic ${credentials}`;
  }

  private getApiUrl(path: string): string {
    return `https://${this.config.spaceUrl}/api/laml/2010-04-01/Accounts/${this.config.projectId}${path}`;
  }

  /**
   * Initiate an outbound call
   */
  async makeCall(options: CallOptions): Promise<CallState> {
    if (!this.isConfigured()) {
      throw new Error("SignalWire not configured. Please provide API credentials.");
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const callState: CallState = {
      callId,
      status: "initiated",
      direction: "outbound",
      to: options.to,
      from: options.from,
      startedAt: Date.now(),
      durationSec: 0,
    };

    this.activeCalls.set(callId, callState);

    try {
      const params = new URLSearchParams();
      params.append("To", options.to);
      params.append("From", options.from);
      params.append("Url", options.webhookUrl);
      params.append("StatusCallback", `${options.webhookUrl}/status`);
      params.append("StatusCallbackEvent", "initiated");
      params.append("StatusCallbackEvent", "ringing");
      params.append("StatusCallbackEvent", "answered");
      params.append("StatusCallbackEvent", "completed");
      params.append("Record", "true");
      params.append("RecordingStatusCallback", `${options.webhookUrl}/recording`);

      const response = await fetch(this.getApiUrl("/Calls.json"), {
        method: "POST",
        headers: {
          "Authorization": this.getAuthHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SignalWire API error: ${error}`);
      }

      const data = await response.json();
      callState.callId = data.sid;
      callState.status = "ringing";
      this.activeCalls.set(data.sid, callState);
      this.emit("callInitiated", callState);

      return callState;
    } catch (error) {
      callState.status = "failed";
      this.emit("callFailed", { callState, error });
      throw error;
    }
  }

  /**
   * Handle inbound call webhook
   */
  handleInboundCall(webhookData: any): { callId: string; twiml: string } {
    const callId = webhookData.CallSid;
    const callState: CallState = {
      callId,
      status: "ringing",
      direction: "inbound",
      to: webhookData.To,
      from: webhookData.From,
      startedAt: Date.now(),
      durationSec: 0,
    };

    this.activeCalls.set(callId, callState);
    this.emit("inboundCall", callState);

    // Return TwiML to connect to WebSocket for real-time audio
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/ws/call/${callId}">
      <Parameter name="callId" value="${callId}" />
    </Stream>
  </Connect>
</Response>`;

    return { callId, twiml };
  }

  /**
   * Generate TwiML for outbound call connection
   */
  generateCallTwiML(callId: string, streamUrl: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="callId" value="${callId}" />
    </Stream>
  </Connect>
</Response>`;
  }

  /**
   * Handle call status callback
   */
  handleStatusCallback(webhookData: any): CallState | undefined {
    const callId = webhookData.CallSid;
    const callState = this.activeCalls.get(callId);

    if (!callState) return undefined;

    const statusMap: Record<string, CallState["status"]> = {
      "initiated": "initiated",
      "ringing": "ringing",
      "in-progress": "answered",
      "completed": "completed",
      "busy": "failed",
      "failed": "failed",
      "no-answer": "failed",
    };

    callState.status = statusMap[webhookData.CallStatus] || callState.status;

    if (callState.status === "completed" || callState.status === "failed") {
      callState.endedAt = Date.now();
      callState.durationSec = parseInt(webhookData.CallDuration || "0", 10);
      this.emit("callEnded", callState);
    } else if (callState.status === "answered") {
      this.emit("callAnswered", callState);
    }

    return callState;
  }

  /**
   * Handle recording status callback
   */
  handleRecordingCallback(webhookData: any): void {
    const callId = webhookData.CallSid;
    const callState = this.activeCalls.get(callId);

    if (callState && webhookData.RecordingUrl) {
      callState.recordingUrl = webhookData.RecordingUrl;
      this.emit("recordingReady", { callId, recordingUrl: webhookData.RecordingUrl });
    }
  }

  /**
   * End an active call
   */
  async endCall(callId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("SignalWire not configured");
    }

    const response = await fetch(this.getApiUrl(`/Calls/${callId}.json`), {
      method: "POST",
      headers: {
        "Authorization": this.getAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        Status: "completed",
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to end call: ${await response.text()}`);
    }

    const callState = this.activeCalls.get(callId);
    if (callState) {
      callState.status = "completed";
      callState.endedAt = Date.now();
      this.emit("callEnded", callState);
    }
  }

  /**
   * Send DTMF tones during a call
   */
  async sendDTMF(callId: string, digits: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("SignalWire not configured");
    }

    await fetch(this.getApiUrl(`/Calls/${callId}.json`), {
      method: "POST",
      headers: {
        "Authorization": this.getAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        Twiml: `<Response><Play digits="${digits}"/></Response>`,
      }),
    });
  }

  /**
   * Get active call state
   */
  getCallState(callId: string): CallState | undefined {
    return this.activeCalls.get(callId);
  }

  /**
   * Get all active calls
   */
  getActiveCalls(): CallState[] {
    return Array.from(this.activeCalls.values()).filter(
      (c) => c.status !== "completed" && c.status !== "failed"
    );
  }

  /**
   * Cleanup completed calls from memory
   */
  cleanupCompletedCalls(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    Array.from(this.activeCalls.entries()).forEach(([callId, callState]) => {
      if (callState.endedAt && now - callState.endedAt > maxAge) {
        this.activeCalls.delete(callId);
      }
    });
  }
}

// Export singleton instance
export const signalwire = new SignalWireClient();
