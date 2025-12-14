/**
 * Integration exports
 * Central hub for all external service integrations
 */

// Voice Calling
export { signalwire, type CallOptions, type CallState } from "./signalwire";
export { createDeepgramSTT, type DeepgramSTTClient, type TranscriptResult, type DeepgramConfig } from "./deepgram";
export { elevenlabs, VOICE_PRESETS, type TTSOptions, type VoiceSettings, type Voice } from "./elevenlabs";
export { callOrchestrator, type AgentConfig, type CallSession } from "./call-orchestrator";

// WhatsApp
export { whatsapp, type WhatsAppMessage, type WhatsAppContact, type SendMessageOptions, type IntentConfig } from "./whatsapp";

// Payments
export { razorpay, PLANS, TOPUP_OPTIONS, type PlanConfig, type OrderResult, type SubscriptionResult } from "./razorpay";

// Utility to check all integration status
export function getIntegrationStatus(): Record<string, { configured: boolean; name: string }> {
  return {
    signalwire: {
      name: "SignalWire (Voice Calls)",
      configured: !!(process.env.SIGNALWIRE_PROJECT_ID && process.env.SIGNALWIRE_TOKEN),
    },
    deepgram: {
      name: "Deepgram (Speech-to-Text)",
      configured: !!process.env.DEEPGRAM_API_KEY,
    },
    elevenlabs: {
      name: "ElevenLabs (Text-to-Speech)",
      configured: !!process.env.ELEVENLABS_API_KEY,
    },
    openai: {
      name: "OpenAI (AI Brain)",
      configured: !!process.env.OPENAI_API_KEY,
    },
    whatsapp: {
      name: "WhatsApp Cloud API",
      configured: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    },
    razorpay: {
      name: "Razorpay (Payments)",
      configured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    },
  };
}
