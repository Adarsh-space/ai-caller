/**
 * Deepgram Integration - Real-time Speech-to-Text
 * Handles WebSocket STT with streaming transcription
 */

import { EventEmitter } from "events";
import WebSocket from "ws";

const config = {
  apiKey: process.env.DEEPGRAM_API_KEY || "",
};

export interface TranscriptResult {
  text: string;
  isFinal: boolean;
  confidence: number;
  words: Array<{ word: string; start: number; end: number; confidence: number }>;
  speechFinal: boolean; // True when speaker has finished speaking (endpoint detected)
}

export interface DeepgramConfig {
  language?: string;
  model?: string;
  punctuate?: boolean;
  interimResults?: boolean;
  endpointing?: number; // Silence duration in ms to detect end of speech
  utteranceEndMs?: number;
  vadEvents?: boolean;
  encoding?: string;
  sampleRate?: number;
}

class DeepgramSTTClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private currentConfig: DeepgramConfig = {};

  isConfigured(): boolean {
    return !!config.apiKey;
  }

  /**
   * Connect to Deepgram WebSocket for real-time transcription
   */
  async connect(options: DeepgramConfig = {}): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("Deepgram not configured. Please provide API key.");
    }

    this.currentConfig = {
      language: options.language || "en-US",
      model: options.model || "nova-2",
      punctuate: options.punctuate ?? true,
      interimResults: options.interimResults ?? true,
      endpointing: options.endpointing ?? 300, // 300ms silence = end of utterance
      utteranceEndMs: options.utteranceEndMs ?? 1000,
      vadEvents: options.vadEvents ?? true,
      encoding: options.encoding || "mulaw",
      sampleRate: options.sampleRate || 8000,
    };

    const queryParams = new URLSearchParams({
      language: this.currentConfig.language!,
      model: this.currentConfig.model!,
      punctuate: String(this.currentConfig.punctuate),
      interim_results: String(this.currentConfig.interimResults),
      endpointing: String(this.currentConfig.endpointing),
      utterance_end_ms: String(this.currentConfig.utteranceEndMs),
      vad_events: String(this.currentConfig.vadEvents),
      encoding: this.currentConfig.encoding!,
      sample_rate: String(this.currentConfig.sampleRate),
    });

    const wsUrl = `wss://api.deepgram.com/v1/listen?${queryParams.toString()}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl, {
        headers: {
          Authorization: `Token ${config.apiKey}`,
        },
      });

      this.ws.on("open", () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit("connected");
        resolve();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on("close", (code, reason) => {
        this.isConnected = false;
        this.emit("disconnected", { code, reason: reason.toString() });
        
        // Attempt reconnect if not intentional close
        if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(this.currentConfig), 1000 * this.reconnectAttempts);
        }
      });

      this.ws.on("error", (error) => {
        this.emit("error", error);
        if (!this.isConnected) {
          reject(error);
        }
      });
    });
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      // Handle different message types
      if (message.type === "Results") {
        const result = this.parseTranscriptResult(message);
        if (result.text) {
          this.emit("transcript", result);
          
          if (result.isFinal) {
            this.emit("finalTranscript", result);
          } else {
            this.emit("interimTranscript", result);
          }

          if (result.speechFinal) {
            this.emit("speechEnd", result);
          }
        }
      } else if (message.type === "SpeechStarted") {
        this.emit("speechStart");
      } else if (message.type === "UtteranceEnd") {
        this.emit("utteranceEnd");
      } else if (message.type === "Metadata") {
        this.emit("metadata", message);
      } else if (message.type === "Error") {
        this.emit("error", new Error(message.description || "Deepgram error"));
      }
    } catch (error) {
      this.emit("error", error);
    }
  }

  private parseTranscriptResult(message: any): TranscriptResult {
    const channel = message.channel;
    const alternatives = channel?.alternatives || [];
    const bestAlternative = alternatives[0] || {};

    return {
      text: bestAlternative.transcript || "",
      isFinal: message.is_final === true,
      confidence: bestAlternative.confidence || 0,
      words: (bestAlternative.words || []).map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
      })),
      speechFinal: message.speech_final === true,
    };
  }

  /**
   * Send audio data to Deepgram for transcription
   */
  sendAudio(audioData: Buffer | ArrayBuffer): void {
    if (!this.isConnected || !this.ws) {
      throw new Error("Not connected to Deepgram");
    }

    this.ws.send(audioData);
  }

  /**
   * Signal that audio stream is complete
   */
  finishStream(): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({ type: "CloseStream" }));
    }
  }

  /**
   * Keep connection alive
   */
  keepAlive(): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({ type: "KeepAlive" }));
    }
  }

  /**
   * Disconnect from Deepgram
   */
  disconnect(): void {
    if (this.ws) {
      this.finishStream();
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if connected
   */
  connected(): boolean {
    return this.isConnected;
  }
}

/**
 * Factory function to create new Deepgram STT instances
 * Each call session should have its own instance
 */
export function createDeepgramSTT(): DeepgramSTTClient {
  return new DeepgramSTTClient();
}

// Export class for typing
export { DeepgramSTTClient };
