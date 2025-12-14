/**
 * Call Orchestrator - Connects all voice services
 * SignalWire (telephony) + Deepgram (STT) + OpenAI (AI) + ElevenLabs (TTS)
 * 
 * Implements:
 * - Real-time conversation management
 * - Barge-in support (interrupt AI while speaking)
 * - Silence detection
 * - Credit deduction
 * - Call quality monitoring
 */

import { EventEmitter } from "events";
import WebSocket from "ws";
import OpenAI from "openai";
import { signalwire, type CallState } from "./signalwire";
import { createDeepgramSTT, type DeepgramSTTClient, type TranscriptResult } from "./deepgram";
import { elevenlabs, VOICE_PRESETS } from "./elevenlabs";

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

export interface AgentConfig {
  id: string;
  name: string;
  language: string;
  instructions: string;
  greeting: string;
  fallbackMessage: string;
  voiceId: string;
  latencyMode: "FAST" | "BALANCED" | "NATURAL";
  rules: {
    noLegal: boolean;
    noMedical: boolean;
    confirmBookings: boolean;
    handoffOnConfusion: boolean;
  };
}

export interface CallSession {
  callId: string;
  tenantId: string;
  agentId: string;
  campaignId?: string;
  agent: AgentConfig;
  callState: CallState;
  conversationHistory: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  creditsUsed: number;
  startTime: number;
  isSpeaking: boolean;
  isListening: boolean;
  silenceStart?: number;
  lastUserSpeech?: number;
  outcome?: string;
  transcriptSummary: string[];
}

interface AudioBuffer {
  chunks: Buffer[];
  totalDuration: number;
}

class CallOrchestrator extends EventEmitter {
  private activeSessions: Map<string, CallSession> = new Map();
  private sttClients: Map<string, DeepgramSTTClient> = new Map();
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private ttsQueue: Map<string, Buffer[]> = new Map();
  
  // Configuration
  private readonly SILENCE_THRESHOLD_MS = 1500; // 1.5 seconds of silence = end of turn
  private readonly MAX_CALL_DURATION_SEC = 600; // 10 minutes max
  private readonly CREDITS_PER_MINUTE = 5; // Credits charged per minute

  /**
   * Initialize a new call session
   */
  async initializeSession(
    callId: string,
    tenantId: string,
    agentId: string,
    agent: AgentConfig,
    campaignId?: string
  ): Promise<CallSession> {
    const session: CallSession = {
      callId,
      tenantId,
      agentId,
      campaignId,
      agent,
      callState: signalwire.getCallState(callId) || {
        callId,
        status: "initiated",
        direction: "outbound",
        to: "",
        from: "",
        startedAt: Date.now(),
        durationSec: 0,
      },
      conversationHistory: [
        {
          role: "system",
          content: this.buildSystemPrompt(agent),
        },
      ],
      creditsUsed: 0,
      startTime: Date.now(),
      isSpeaking: false,
      isListening: false,
      transcriptSummary: [],
    };

    this.activeSessions.set(callId, session);
    this.audioBuffers.set(callId, { chunks: [], totalDuration: 0 });
    this.ttsQueue.set(callId, []);

    // Initialize STT client for this session
    const stt = createDeepgramSTT();
    this.sttClients.set(callId, stt);

    // Set up STT event handlers
    this.setupSTTHandlers(callId, stt, session);

    // Connect to Deepgram
    if (stt.isConfigured()) {
      await stt.connect({
        language: agent.language || "en-US",
        model: agent.latencyMode === "FAST" ? "nova-2" : "nova-2-general",
        endpointing: agent.latencyMode === "FAST" ? 200 : 300,
      });
    }

    this.emit("sessionInitialized", { callId, session });
    return session;
  }

  private buildSystemPrompt(agent: AgentConfig): string {
    const rules: string[] = [];
    if (agent.rules.noLegal) rules.push("Never provide legal advice");
    if (agent.rules.noMedical) rules.push("Never provide medical advice");
    if (agent.rules.confirmBookings) rules.push("Always confirm booking details before finalizing");
    if (agent.rules.handoffOnConfusion) rules.push("If confused for more than 2 exchanges, offer to connect to a human");

    return `You are ${agent.name}, an AI voice assistant on a phone call.

INSTRUCTIONS:
${agent.instructions}

RULES:
${rules.map((r) => `- ${r}`).join("\n")}

IMPORTANT VOICE GUIDELINES:
1. Keep responses SHORT (1-2 sentences max for phone)
2. Speak naturally with conversational fillers like "Sure", "Let me check", "Got it"
3. Use simple, clear language
4. Ask one question at a time
5. Confirm understanding before moving on
6. If user is silent, politely check if they're still there

When unsure, use this fallback: "${agent.fallbackMessage}"

Start the conversation with a warm greeting.`;
  }

  private setupSTTHandlers(callId: string, stt: DeepgramSTTClient, session: CallSession): void {
    stt.on("transcript", (result: TranscriptResult) => {
      if (!result.text) return;
      
      session.lastUserSpeech = Date.now();
      session.silenceStart = undefined;
      session.isListening = true;

      this.emit("userSpeaking", { callId, text: result.text, isFinal: result.isFinal });
    });

    stt.on("finalTranscript", async (result: TranscriptResult) => {
      if (!result.text.trim()) return;

      session.transcriptSummary.push(`User: ${result.text}`);
      this.emit("userTranscript", { callId, text: result.text });

      // Process user input and generate response
      await this.processUserInput(callId, result.text);
    });

    stt.on("speechEnd", () => {
      session.isListening = false;
      session.silenceStart = Date.now();
    });

    stt.on("error", (error) => {
      this.emit("sttError", { callId, error });
    });
  }

  /**
   * Handle incoming audio from the call
   */
  async handleAudioInput(callId: string, audioData: Buffer): Promise<void> {
    const session = this.activeSessions.get(callId);
    if (!session) return;

    const stt = this.sttClients.get(callId);
    if (!stt || !stt.connected()) return;

    // If AI is speaking and user starts talking, implement barge-in
    if (session.isSpeaking) {
      // Check for voice activity (simple energy detection)
      const hasVoice = this.detectVoiceActivity(audioData);
      if (hasVoice) {
        this.handleBargeIn(callId);
      }
    }

    // Send audio to Deepgram for transcription
    try {
      stt.sendAudio(audioData);
    } catch (error) {
      this.emit("audioError", { callId, error });
    }

    // Check for silence timeout
    if (session.silenceStart) {
      const silenceDuration = Date.now() - session.silenceStart;
      if (silenceDuration > this.SILENCE_THRESHOLD_MS && !session.isSpeaking) {
        session.silenceStart = undefined;
        // Could trigger a prompt like "Are you still there?"
      }
    }

    // Update call duration and credits
    this.updateCallCredits(session);
  }

  private detectVoiceActivity(audioData: Buffer): boolean {
    // Simple energy-based VAD
    // For production, use a proper VAD library
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += Math.abs(audioData[i] - 128);
    }
    const avgEnergy = sum / audioData.length;
    return avgEnergy > 10; // Threshold for voice activity
  }

  private handleBargeIn(callId: string): void {
    const session = this.activeSessions.get(callId);
    if (!session) return;

    // Stop current TTS playback
    session.isSpeaking = false;
    this.ttsQueue.set(callId, []);
    
    this.emit("bargeIn", { callId });
  }

  /**
   * Process user input and generate AI response
   */
  private async processUserInput(callId: string, userText: string): Promise<void> {
    const session = this.activeSessions.get(callId);
    if (!session) return;

    // Add user message to history
    session.conversationHistory.push({
      role: "user",
      content: userText,
    });

    // Generate AI response
    const response = await this.generateResponse(session);
    if (!response) return;

    // Add AI response to history
    session.conversationHistory.push({
      role: "assistant",
      content: response,
    });
    session.transcriptSummary.push(`AI: ${response}`);

    // Convert to speech and play
    await this.speakResponse(callId, response);
  }

  private async generateResponse(session: CallSession): Promise<string | null> {
    try {
      // Limit conversation history for context window
      const recentHistory = session.conversationHistory.slice(-10);

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini", // Fast model for low latency
        messages: recentHistory as any,
        max_tokens: 150, // Keep responses short for voice
        temperature: 0.7,
      });

      const content = completion.choices[0]?.message?.content;
      
      // Track token usage for billing
      const tokensUsed = completion.usage?.total_tokens || 0;
      session.creditsUsed += Math.ceil(tokensUsed / 100); // Rough credit conversion

      return content || session.agent.fallbackMessage;
    } catch (error) {
      this.emit("aiError", { callId: session.callId, error });
      return session.agent.fallbackMessage;
    }
  }

  /**
   * Convert text to speech and send to call
   */
  private async speakResponse(callId: string, text: string): Promise<void> {
    const session = this.activeSessions.get(callId);
    if (!session) return;

    session.isSpeaking = true;
    this.emit("aiSpeaking", { callId, text });

    try {
      if (!elevenlabs.isConfigured()) {
        // Fallback: just emit the text without TTS
        this.emit("ttsNotConfigured", { callId, text });
        session.isSpeaking = false;
        return;
      }

      // Stream TTS for lower latency
      const voiceId = session.agent.voiceId || VOICE_PRESETS.RACHEL;
      
      for await (const chunk of elevenlabs.textToSpeechStream({
        voiceId,
        text,
        outputFormat: "ulaw_8000", // Telephony format
        latencyOptimization: session.agent.latencyMode === "FAST" ? 4 : 3,
      })) {
        // Check if barge-in occurred
        if (!session.isSpeaking) {
          break;
        }

        this.emit("audioOutput", { callId, audio: chunk });
      }
    } catch (error) {
      this.emit("ttsError", { callId, error });
    } finally {
      session.isSpeaking = false;
      this.emit("aiFinishedSpeaking", { callId });
    }
  }

  /**
   * Update call credits based on duration
   */
  private updateCallCredits(session: CallSession): void {
    const durationSec = (Date.now() - session.startTime) / 1000;
    const durationMin = Math.ceil(durationSec / 60);
    const newCredits = durationMin * this.CREDITS_PER_MINUTE;
    
    if (newCredits > session.creditsUsed) {
      const delta = newCredits - session.creditsUsed;
      session.creditsUsed = newCredits;
      this.emit("creditsDeducted", {
        callId: session.callId,
        tenantId: session.tenantId,
        credits: delta,
        totalCredits: session.creditsUsed,
      });
    }

    // Check max duration
    if (durationSec >= this.MAX_CALL_DURATION_SEC) {
      this.endCall(session.callId, "max_duration");
    }
  }

  /**
   * Send greeting when call is answered
   */
  async sendGreeting(callId: string): Promise<void> {
    const session = this.activeSessions.get(callId);
    if (!session) return;

    const greeting = session.agent.greeting;
    session.conversationHistory.push({
      role: "assistant",
      content: greeting,
    });
    session.transcriptSummary.push(`AI: ${greeting}`);

    await this.speakResponse(callId, greeting);
  }

  /**
   * End the call session
   */
  async endCall(callId: string, reason: string = "completed"): Promise<{
    durationSec: number;
    creditsUsed: number;
    transcriptSummary: string;
  }> {
    const session = this.activeSessions.get(callId);
    if (!session) {
      return { durationSec: 0, creditsUsed: 0, transcriptSummary: "" };
    }

    // Clean up STT client
    const stt = this.sttClients.get(callId);
    if (stt) {
      stt.disconnect();
      this.sttClients.delete(callId);
    }

    // Calculate final stats
    const durationSec = Math.floor((Date.now() - session.startTime) / 1000);
    const transcriptSummary = session.transcriptSummary.join("\n");

    // End the actual call
    try {
      await signalwire.endCall(callId);
    } catch (error) {
      // Call may already be ended
    }

    // Clean up
    this.activeSessions.delete(callId);
    this.audioBuffers.delete(callId);
    this.ttsQueue.delete(callId);

    this.emit("callEnded", {
      callId,
      tenantId: session.tenantId,
      durationSec,
      creditsUsed: session.creditsUsed,
      reason,
    });

    return {
      durationSec,
      creditsUsed: session.creditsUsed,
      transcriptSummary,
    };
  }

  /**
   * Get active session
   */
  getSession(callId: string): CallSession | undefined {
    return this.activeSessions.get(callId);
  }

  /**
   * Get all active sessions for a tenant
   */
  getTenantSessions(tenantId: string): CallSession[] {
    return Array.from(this.activeSessions.values()).filter(
      (s) => s.tenantId === tenantId
    );
  }

  /**
   * Get total active calls
   */
  getActiveCallCount(): number {
    return this.activeSessions.size;
  }
}

// Export singleton instance
export const callOrchestrator = new CallOrchestrator();
