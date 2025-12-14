/**
 * ElevenLabs Integration - Text-to-Speech
 * Handles high-quality, human-like voice synthesis with streaming
 */

import { EventEmitter } from "events";

const config = {
  apiKey: process.env.ELEVENLABS_API_KEY || "",
};

export interface VoiceSettings {
  stability: number; // 0-1, higher = more stable/consistent
  similarityBoost: number; // 0-1, higher = more similar to original voice
  style?: number; // 0-1, style exaggeration
  useSpeakerBoost?: boolean;
}

export interface TTSOptions {
  voiceId: string;
  text: string;
  modelId?: string;
  voiceSettings?: VoiceSettings;
  outputFormat?: "mp3_44100_128" | "mp3_22050_32" | "pcm_16000" | "pcm_22050" | "pcm_24000" | "pcm_44100" | "ulaw_8000";
  latencyOptimization?: 0 | 1 | 2 | 3 | 4; // 0 = default, 4 = max optimization
}

export interface Voice {
  voiceId: string;
  name: string;
  category: string;
  description: string;
  previewUrl: string;
  labels: Record<string, string>;
}

// Pre-configured voice IDs for common use cases
export const VOICE_PRESETS = {
  // Professional voices
  RACHEL: "21m00Tcm4TlvDq8ikWAM", // Calm, professional female
  DREW: "29vD33N1CtxCmqQRPOHJ", // Warm, friendly male
  CLYDE: "2EiwWnXFnvU5JabPnv8n", // Deep, authoritative male
  DAVE: "CYw3kZ02Hs0563khs1Fj", // Conversational British male
  
  // Customer service optimized
  EMILY: "LcfcDJNUP1GQjkzn1xUU", // Warm, empathetic female
  ELLI: "MF3mGyEYCl7XYWbV9V6O", // Young, energetic female
  
  // Sales optimized  
  JOSH: "TxGEqnHWrfWFTfGW9XjX", // Confident, persuasive male
  ARNOLD: "VR6AewLTigWG4xSOukaG", // Deep, commanding male
  
  // Multilingual
  ADAM: "pNInz6obpgDQGcFmaJgB", // Neutral, clear male
  ANTONI: "ErXwobaYiN019PkySvjV", // Pleasant, European male
};

class ElevenLabsTTS extends EventEmitter {
  private baseUrl = "https://api.elevenlabs.io/v1";

  isConfigured(): boolean {
    return !!config.apiKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      "xi-api-key": config.apiKey,
      "Content-Type": "application/json",
    };
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<Voice[]> {
    if (!this.isConfigured()) {
      throw new Error("ElevenLabs not configured. Please provide API key.");
    }

    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get voices: ${await response.text()}`);
    }

    const data = await response.json();
    return data.voices.map((v: any) => ({
      voiceId: v.voice_id,
      name: v.name,
      category: v.category,
      description: v.description,
      previewUrl: v.preview_url,
      labels: v.labels || {},
    }));
  }

  /**
   * Generate speech and return audio buffer
   */
  async textToSpeech(options: TTSOptions): Promise<Buffer> {
    if (!this.isConfigured()) {
      throw new Error("ElevenLabs not configured. Please provide API key.");
    }

    const {
      voiceId,
      text,
      modelId = "eleven_turbo_v2_5", // Optimized for low latency
      voiceSettings = { stability: 0.5, similarityBoost: 0.75 },
      outputFormat = "ulaw_8000", // Best for telephony
      latencyOptimization = 3, // High optimization for calls
    } = options;

    const url = `${this.baseUrl}/text-to-speech/${voiceId}?output_format=${outputFormat}&optimize_streaming_latency=${latencyOptimization}`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: voiceSettings.stability,
          similarity_boost: voiceSettings.similarityBoost,
          style: voiceSettings.style,
          use_speaker_boost: voiceSettings.useSpeakerBoost,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs TTS failed: ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Stream speech generation for lower latency
   * Returns an async generator that yields audio chunks
   */
  async *textToSpeechStream(options: TTSOptions): AsyncGenerator<Buffer> {
    if (!this.isConfigured()) {
      throw new Error("ElevenLabs not configured. Please provide API key.");
    }

    const {
      voiceId,
      text,
      modelId = "eleven_turbo_v2_5",
      voiceSettings = { stability: 0.5, similarityBoost: 0.75 },
      outputFormat = "ulaw_8000",
      latencyOptimization = 4, // Max optimization for streaming
    } = options;

    const url = `${this.baseUrl}/text-to-speech/${voiceId}/stream?output_format=${outputFormat}&optimize_streaming_latency=${latencyOptimization}`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: voiceSettings.stability,
          similarity_boost: voiceSettings.similarityBoost,
          style: voiceSettings.style,
          use_speaker_boost: voiceSettings.useSpeakerBoost,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs TTS stream failed: ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get response stream");
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield Buffer.from(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Create a websocket connection for real-time TTS
   * This is the lowest latency option for conversational AI
   */
  createStreamingSession(voiceId: string, modelId: string = "eleven_turbo_v2_5"): WebSocket {
    if (!this.isConfigured()) {
      throw new Error("ElevenLabs not configured. Please provide API key.");
    }

    const WebSocket = require("ws");
    const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${modelId}&output_format=ulaw_8000&optimize_streaming_latency=4`;

    const ws = new WebSocket(wsUrl, {
      headers: {
        "xi-api-key": config.apiKey,
      },
    });

    // Send initial configuration
    ws.on("open", () => {
      ws.send(JSON.stringify({
        text: " ", // Initial empty text to start stream
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
        generation_config: {
          chunk_length_schedule: [120, 160, 250, 290], // Optimized for low latency
        },
      }));
    });

    return ws;
  }

  /**
   * Estimate cost for TTS generation
   * ElevenLabs charges per character
   */
  estimateCost(text: string): { characters: number; estimatedCostUSD: number } {
    const characters = text.length;
    // Approximate cost: ~$0.30 per 1000 characters for turbo model
    const estimatedCostUSD = (characters / 1000) * 0.30;
    return { characters, estimatedCostUSD };
  }

  /**
   * Get user subscription info
   */
  async getSubscriptionInfo(): Promise<{
    characterCount: number;
    characterLimit: number;
    nextResetAt: string;
  }> {
    if (!this.isConfigured()) {
      throw new Error("ElevenLabs not configured");
    }

    const response = await fetch(`${this.baseUrl}/user/subscription`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get subscription info: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      characterCount: data.character_count,
      characterLimit: data.character_limit,
      nextResetAt: data.next_character_count_reset_unix,
    };
  }
}

// Export singleton instance
export const elevenlabs = new ElevenLabsTTS();
