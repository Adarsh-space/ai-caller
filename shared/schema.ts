import { z } from "zod";

// ============= ENUMS =============
export const UserRole = z.enum(["OWNER", "ADMIN", "AGENT", "VIEWER"]);
export type UserRole = z.infer<typeof UserRole>;

export const TenantStatus = z.enum(["ACTIVE", "SUSPENDED", "TRIAL"]);
export type TenantStatus = z.infer<typeof TenantStatus>;

export const AgentStatus = z.enum(["ACTIVE", "PAUSED", "DRAFT"]);
export type AgentStatus = z.infer<typeof AgentStatus>;

export const CampaignStatus = z.enum(["DRAFT", "SCHEDULED", "RUNNING", "PAUSED", "COMPLETED"]);
export type CampaignStatus = z.infer<typeof CampaignStatus>;

export const LeadStatus = z.enum(["PENDING", "CALLED", "FAILED", "DO_NOT_CALL", "SCHEDULED"]);
export type LeadStatus = z.infer<typeof LeadStatus>;

export const CallDirection = z.enum(["INBOUND", "OUTBOUND"]);
export type CallDirection = z.infer<typeof CallDirection>;

export const CallStatus = z.enum(["INITIATED", "RINGING", "ANSWERED", "COMPLETED", "FAILED", "BUSY", "NO_ANSWER"]);
export type CallStatus = z.infer<typeof CallStatus>;

export const CallOutcome = z.enum(["INTERESTED", "NOT_INTERESTED", "CALLBACK", "VOICEMAIL", "WRONG_NUMBER", "DNC", "COMPLETED"]);
export type CallOutcome = z.infer<typeof CallOutcome>;

export const ConversationStatus = z.enum(["OPEN", "CLOSED"]);
export type ConversationStatus = z.infer<typeof ConversationStatus>;

export const MessageFrom = z.enum(["USER", "AI", "HUMAN"]);
export type MessageFrom = z.infer<typeof MessageFrom>;

export const TransactionType = z.enum(["SUBSCRIPTION_RENEWAL", "TOPUP", "MANUAL_ADJUSTMENT", "REFUND", "USAGE"]);
export type TransactionType = z.infer<typeof TransactionType>;

export const PlanId = z.enum(["STARTER", "GROWTH", "BUSINESS"]);
export type PlanId = z.infer<typeof PlanId>;

// ============= CORE ENTITIES =============

// User (tenant team member)
export const userSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string().email(),
  password: z.string(),
  name: z.string(),
  role: UserRole,
  status: z.enum(["ACTIVE", "INACTIVE"]),
  createdAt: z.number(),
  lastLoginAt: z.number().optional(),
});
export type User = z.infer<typeof userSchema>;
export const insertUserSchema = userSchema.omit({ id: true, createdAt: true, lastLoginAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;

// Tenant (customer business)
export const tenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  businessCountry: z.string(),
  currency: z.string(),
  timezone: z.string(),
  planId: PlanId,
  status: TenantStatus,
  ownerUid: z.string(),
  pricingRegion: z.string(),
  createdAt: z.number(),
});
export type Tenant = z.infer<typeof tenantSchema>;
export const insertTenantSchema = tenantSchema.omit({ id: true, createdAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;

// ============= AI CALLING =============

// Voice Agent configuration
export const agentVoiceSchema = z.object({
  provider: z.enum(["elevenlabs", "native"]),
  voiceId: z.string(),
  speed: z.number().min(0.5).max(2),
  pitch: z.number().min(-10).max(10),
});
export type AgentVoice = z.infer<typeof agentVoiceSchema>;

export const agentRulesSchema = z.object({
  noLegal: z.boolean(),
  noMedical: z.boolean(),
  confirmBookings: z.boolean(),
  handoffOnConfusion: z.boolean(),
});
export type AgentRules = z.infer<typeof agentRulesSchema>;

export const agentSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  status: AgentStatus,
  language: z.string(),
  timezone: z.string(),
  instructions: z.string(),
  greeting: z.string(),
  fallbackMessage: z.string(),
  rules: agentRulesSchema,
  voice: agentVoiceSchema,
  latencyMode: z.enum(["FAST", "BALANCED", "NATURAL"]),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Agent = z.infer<typeof agentSchema>;
export const insertAgentSchema = agentSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAgent = z.infer<typeof insertAgentSchema>;

// Agent Intent
export const intentSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  tenantId: z.string(),
  name: z.string(),
  triggers: z.array(z.string()),
  responseTemplate: z.string(),
  escalateToHuman: z.boolean(),
});
export type Intent = z.infer<typeof intentSchema>;
export const insertIntentSchema = intentSchema.omit({ id: true });
export type InsertIntent = z.infer<typeof insertIntentSchema>;

// Campaign
export const campaignScheduleSchema = z.object({
  startAt: z.number(),
  endAt: z.number(),
  daysOfWeek: z.array(z.number()),
  startHour: z.number(),
  endHour: z.number(),
});
export type CampaignSchedule = z.infer<typeof campaignScheduleSchema>;

export const retryPolicySchema = z.object({
  maxRetries: z.number(),
  retryDelaySec: z.number(),
});
export type RetryPolicy = z.infer<typeof retryPolicySchema>;

export const campaignSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  agentId: z.string(),
  name: z.string(),
  status: CampaignStatus,
  schedule: campaignScheduleSchema,
  maxCallsPerMinute: z.number(),
  retryPolicy: retryPolicySchema,
  meetingLink: z.string().optional(),
  totalLeads: z.number(),
  calledLeads: z.number(),
  createdAt: z.number(),
});
export type Campaign = z.infer<typeof campaignSchema>;
export const insertCampaignSchema = campaignSchema.omit({ id: true, createdAt: true, totalLeads: true, calledLeads: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

// Campaign Lead
export const leadSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  tenantId: z.string(),
  phone: z.string(),
  name: z.string(),
  status: LeadStatus,
  attempts: z.number(),
  lastCallId: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  scheduledAt: z.number().optional(),
});
export type Lead = z.infer<typeof leadSchema>;
export const insertLeadSchema = leadSchema.omit({ id: true, attempts: true, lastCallId: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;

// Call Log
export const callUsageSchema = z.object({
  creditsDeducted: z.number(),
  telephonyCostEstimate: z.number(),
});
export type CallUsage = z.infer<typeof callUsageSchema>;

export const callSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  agentId: z.string(),
  campaignId: z.string().optional(),
  direction: CallDirection,
  to: z.string(),
  from: z.string(),
  status: CallStatus,
  startedAt: z.number(),
  endedAt: z.number().optional(),
  durationSec: z.number(),
  outcome: CallOutcome.optional(),
  recordingPath: z.string().optional(),
  transcriptSummary: z.string().optional(),
  destinationCountry: z.string(),
  usage: callUsageSchema,
  externalId: z.string().optional(),
});
export type Call = z.infer<typeof callSchema>;
export const insertCallSchema = callSchema.omit({ id: true });
export type InsertCall = z.infer<typeof insertCallSchema>;

// ============= TENANT PHONE NUMBERS =============

export const PhoneVerificationStatus = z.enum(["PENDING", "VERIFIED", "FAILED", "EXPIRED"]);
export type PhoneVerificationStatus = z.infer<typeof PhoneVerificationStatus>;

export const tenantPhoneSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  phoneNumber: z.string(),
  label: z.string().optional(),
  status: PhoneVerificationStatus,
  otpCode: z.string().optional(),
  otpExpiresAt: z.number().optional(),
  attempts: z.number().default(0),
  verifiedAt: z.number().optional(),
  isDefaultOutbound: z.boolean().default(false),
  isDefaultInbound: z.boolean().default(false),
  createdAt: z.number(),
});
export type TenantPhone = z.infer<typeof tenantPhoneSchema>;
export const insertTenantPhoneSchema = tenantPhoneSchema.omit({ id: true, createdAt: true, verifiedAt: true, attempts: true });
export type InsertTenantPhone = z.infer<typeof insertTenantPhoneSchema>;

// ============= WHATSAPP =============

// WhatsApp Connection
export const waConnectionSchema = z.object({
  tenantId: z.string(),
  status: z.enum(["CONNECTED", "DISCONNECTED"]),
  wabaId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  businessPhone: z.string().optional(),
  wabaCountry: z.string().optional(),
  connectedAt: z.number().optional(),
});
export type WAConnection = z.infer<typeof waConnectionSchema>;

// WhatsApp Conversation
export const waConversationSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userPhone: z.string(),
  userName: z.string(),
  status: ConversationStatus,
  lastMessageAt: z.number(),
  aiMode: z.boolean(),
  humanTakeover: z.boolean(),
  tags: z.array(z.string()),
  conversationWindowStart: z.number(),
  creditsDeductedThisWindow: z.number(),
  assignedToUid: z.string().optional(),
});
export type WAConversation = z.infer<typeof waConversationSchema>;
export const insertWAConversationSchema = waConversationSchema.omit({ id: true });
export type InsertWAConversation = z.infer<typeof insertWAConversationSchema>;

// WhatsApp Message
export const waMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  tenantId: z.string(),
  from: MessageFrom,
  text: z.string(),
  timestamp: z.number(),
  deliveryStatus: z.enum(["SENT", "DELIVERED", "READ"]),
});
export type WAMessage = z.infer<typeof waMessageSchema>;
export const insertWAMessageSchema = waMessageSchema.omit({ id: true });
export type InsertWAMessage = z.infer<typeof insertWAMessageSchema>;

// ============= BILLING =============

// Wallet
export const walletSchema = z.object({
  tenantId: z.string(),
  creditsBalance: z.number(),
  creditsUsedThisMonth: z.number(),
  lastUpdatedAt: z.number(),
});
export type Wallet = z.infer<typeof walletSchema>;

// Transaction
export const transactionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  type: TransactionType,
  creditsDelta: z.number(),
  amount: z.number(),
  currency: z.string(),
  provider: z.string().optional(),
  providerRef: z.string().optional(),
  description: z.string(),
  createdAt: z.number(),
  createdBy: z.string().optional(),
});
export type Transaction = z.infer<typeof transactionSchema>;
export const insertTransactionSchema = transactionSchema.omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// Subscription
export const subscriptionSchema = z.object({
  tenantId: z.string(),
  provider: z.string(),
  subscriptionId: z.string(),
  planId: PlanId,
  status: z.enum(["ACTIVE", "PAST_DUE", "CANCELLED"]),
  nextBillingAt: z.number(),
  lastInvoiceId: z.string().optional(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

// ============= COMPLIANCE =============

// DNC (Do Not Call) List
export const dncEntrySchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  phone: z.string(),
  channels: z.object({
    call: z.boolean(),
    whatsapp: z.boolean(),
  }),
  createdAt: z.number(),
  source: z.string(),
});
export type DNCEntry = z.infer<typeof dncEntrySchema>;
export const insertDNCEntrySchema = dncEntrySchema.omit({ id: true, createdAt: true });
export type InsertDNCEntry = z.infer<typeof insertDNCEntrySchema>;

// ============= PRICING =============

export const planPricingSchema = z.object({
  price: z.number(),
  credits: z.number(),
});
export type PlanPricing = z.infer<typeof planPricingSchema>;

export const regionPricingSchema = z.object({
  currency: z.string(),
  creditPrice: z.number(),
  plans: z.object({
    STARTER: planPricingSchema,
    GROWTH: planPricingSchema,
    BUSINESS: planPricingSchema,
  }),
});
export type RegionPricing = z.infer<typeof regionPricingSchema>;

export const pricingConfigSchema = z.object({
  id: z.string(),
  effectiveFrom: z.number(),
  regions: z.record(regionPricingSchema),
});
export type PricingConfig = z.infer<typeof pricingConfigSchema>;

// ============= ADMIN =============

// Platform Settings
export const platformSettingsSchema = z.object({
  killSwitchCalls: z.boolean(),
  killSwitchWhatsApp: z.boolean(),
  allowedCountries: z.array(z.string()),
  maintenanceMode: z.boolean(),
});
export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

// Usage Daily
export const usageDailySchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  date: z.string(),
  callMinutes: z.number(),
  whatsappConversations: z.number(),
  openaiTokens: z.number(),
  creditsConsumed: z.number(),
  estimatedCost: z.number(),
});
export type UsageDaily = z.infer<typeof usageDailySchema>;

// ============= API RESPONSES =============

export const authResponseSchema = z.object({
  user: userSchema,
  tenant: tenantSchema,
  token: z.string(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const dashboardStatsSchema = z.object({
  totalCalls: z.number(),
  totalMinutes: z.number(),
  totalWhatsAppConversations: z.number(),
  creditsUsed: z.number(),
  creditsRemaining: z.number(),
  activeAgents: z.number(),
  activeCampaigns: z.number(),
});
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

export const adminDashboardStatsSchema = z.object({
  totalTenants: z.number(),
  activeTenants: z.number(),
  trialTenants: z.number(),
  totalRevenue: z.number(),
  totalCreditsIssued: z.number(),
  totalCreditsConsumed: z.number(),
  estimatedApiCost: z.number(),
  grossMargin: z.number(),
});
export type AdminDashboardStats = z.infer<typeof adminDashboardStatsSchema>;
