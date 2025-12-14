import {
  type User, type InsertUser,
  type Tenant, type InsertTenant,
  type Agent, type InsertAgent,
  type Intent, type InsertIntent,
  type Campaign, type InsertCampaign,
  type Lead, type InsertLead,
  type Call, type InsertCall,
  type WAConnection,
  type WAConversation, type InsertWAConversation,
  type WAMessage, type InsertWAMessage,
  type Wallet,
  type Transaction, type InsertTransaction,
  type DNCEntry, type InsertDNCEntry,
  type PlatformSettings,
  type DashboardStats,
  type AdminDashboardStats,
  type TenantPhone, type InsertTenantPhone,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getUsersByTenant(tenantId: string): Promise<User[]>;

  // Tenants
  getTenant(id: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant | undefined>;
  getAllTenants(): Promise<Tenant[]>;

  // Agents
  getAgent(id: string): Promise<Agent | undefined>;
  getAgentsByTenant(tenantId: string): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined>;
  deleteAgent(id: string): Promise<boolean>;

  // Intents
  getIntentsByAgent(agentId: string): Promise<Intent[]>;
  createIntent(intent: InsertIntent): Promise<Intent>;
  updateIntent(id: string, updates: Partial<Intent>): Promise<Intent | undefined>;
  deleteIntent(id: string): Promise<boolean>;

  // Campaigns
  getCampaign(id: string): Promise<Campaign | undefined>;
  getCampaignsByTenant(tenantId: string): Promise<Campaign[]>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;

  // Leads
  getLeadsByCampaign(campaignId: string): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  createLeads(leads: InsertLead[]): Promise<Lead[]>;
  updateLead(id: string, updates: Partial<Lead>): Promise<Lead | undefined>;

  // Calls
  getCall(id: string): Promise<Call | undefined>;
  getCallsByTenant(tenantId: string, filters?: { agentId?: string; campaignId?: string; status?: string; from?: number; to?: number }): Promise<Call[]>;
  createCall(call: InsertCall): Promise<Call>;
  updateCall(id: string, updates: Partial<Call>): Promise<Call | undefined>;

  // WhatsApp Connection
  getWAConnection(tenantId: string): Promise<WAConnection | undefined>;
  setWAConnection(connection: WAConnection): Promise<WAConnection>;

  // WhatsApp Conversations
  getWAConversation(id: string): Promise<WAConversation | undefined>;
  getWAConversationsByTenant(tenantId: string): Promise<WAConversation[]>;
  createWAConversation(conv: InsertWAConversation): Promise<WAConversation>;
  updateWAConversation(id: string, updates: Partial<WAConversation>): Promise<WAConversation | undefined>;

  // WhatsApp Messages
  getWAMessagesByConversation(conversationId: string): Promise<WAMessage[]>;
  createWAMessage(message: InsertWAMessage): Promise<WAMessage>;

  // Wallet
  getWallet(tenantId: string): Promise<Wallet | undefined>;
  updateWallet(tenantId: string, updates: Partial<Wallet>): Promise<Wallet | undefined>;
  createWallet(tenantId: string): Promise<Wallet>;

  // Transactions
  getTransactionsByTenant(tenantId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;

  // DNC
  getDNCByTenant(tenantId: string): Promise<DNCEntry[]>;
  createDNCEntry(entry: InsertDNCEntry): Promise<DNCEntry>;
  deleteDNCEntry(id: string): Promise<boolean>;
  checkDNC(tenantId: string, phone: string): Promise<DNCEntry | undefined>;

  // Platform Settings
  getPlatformSettings(): Promise<PlatformSettings>;
  updatePlatformSettings(updates: Partial<PlatformSettings>): Promise<PlatformSettings>;

  // Dashboard
  getDashboardStats(tenantId: string): Promise<DashboardStats>;
  getAdminDashboardStats(): Promise<AdminDashboardStats>;

  // Credit Deduction
  deductCredits(tenantId: string, amount: number, description: string, type?: string): Promise<{ success: boolean; newBalance: number; error?: string }>;
  getWAConversationByPhone(tenantId: string, phone: string): Promise<WAConversation | undefined>;
  getLead(id: string): Promise<Lead | undefined>;
  getCallByProviderRef(providerRef: string): Promise<Call | undefined>;

  // Tenant Phone Numbers
  getTenantPhonesByTenant(tenantId: string): Promise<TenantPhone[]>;
  getTenantPhone(id: string): Promise<TenantPhone | undefined>;
  createTenantPhone(phone: InsertTenantPhone): Promise<TenantPhone>;
  updateTenantPhone(id: string, updates: Partial<TenantPhone>): Promise<TenantPhone | undefined>;
  deleteTenantPhone(id: string): Promise<boolean>;
  getDefaultOutboundPhone(tenantId: string): Promise<TenantPhone | undefined>;
  getDefaultInboundPhone(tenantId: string): Promise<TenantPhone | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private tenants: Map<string, Tenant> = new Map();
  private agents: Map<string, Agent> = new Map();
  private intents: Map<string, Intent> = new Map();
  private campaigns: Map<string, Campaign> = new Map();
  private leads: Map<string, Lead> = new Map();
  private calls: Map<string, Call> = new Map();
  private waConnections: Map<string, WAConnection> = new Map();
  private waConversations: Map<string, WAConversation> = new Map();
  private waMessages: Map<string, WAMessage> = new Map();
  private wallets: Map<string, Wallet> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private dncEntries: Map<string, DNCEntry> = new Map();
  private tenantPhones: Map<string, TenantPhone> = new Map();
  private platformSettings: PlatformSettings = {
    killSwitchCalls: false,
    killSwitchWhatsApp: false,
    allowedCountries: ["US", "GB", "IN", "CA", "AU"],
    maintenanceMode: false,
  };

  constructor() {
    this.seedData();
  }

  private seedData() {
    const tenantId = "tenant-1";
    const userId = "user-1";
    const now = Date.now();

    // Create demo tenant
    const tenant: Tenant = {
      id: tenantId,
      name: "Acme Corp",
      businessCountry: "US",
      currency: "USD",
      timezone: "America/New_York",
      planId: "GROWTH",
      status: "ACTIVE",
      ownerUid: userId,
      pricingRegion: "US",
      createdAt: now - 30 * 24 * 60 * 60 * 1000,
    };
    this.tenants.set(tenantId, tenant);

    // Create demo user
    const user: User = {
      id: userId,
      tenantId,
      email: "demo@acmecorp.com",
      password: "demo123",
      name: "John Doe",
      role: "OWNER",
      status: "ACTIVE",
      createdAt: now - 30 * 24 * 60 * 60 * 1000,
      lastLoginAt: now,
    };
    this.users.set(userId, user);

    // Create wallet
    const wallet: Wallet = {
      tenantId,
      creditsBalance: 5000,
      creditsUsedThisMonth: 1250,
      lastUpdatedAt: now,
    };
    this.wallets.set(tenantId, wallet);

    // Create demo agents
    const agents: Agent[] = [
      {
        id: "agent-1",
        tenantId,
        name: "Sales Assistant",
        status: "ACTIVE",
        language: "en-US",
        timezone: "America/New_York",
        instructions: "You are a friendly sales assistant helping customers learn about our products.",
        greeting: "Hello! Thank you for calling Acme Corp. How can I help you today?",
        fallbackMessage: "I'm sorry, I didn't quite understand that. Could you please repeat?",
        rules: { noLegal: true, noMedical: true, confirmBookings: true, handoffOnConfusion: true },
        voice: { provider: "elevenlabs", voiceId: "voice-1", speed: 1.0, pitch: 0 },
        latencyMode: "BALANCED",
        createdAt: now - 20 * 24 * 60 * 60 * 1000,
        updatedAt: now - 5 * 24 * 60 * 60 * 1000,
      },
      {
        id: "agent-2",
        tenantId,
        name: "Support Bot",
        status: "ACTIVE",
        language: "en-US",
        timezone: "America/New_York",
        instructions: "You are a customer support specialist helping resolve issues.",
        greeting: "Hi there! I'm here to help with any support questions.",
        fallbackMessage: "Let me connect you to a human representative.",
        rules: { noLegal: true, noMedical: true, confirmBookings: false, handoffOnConfusion: true },
        voice: { provider: "native", voiceId: "voice-2", speed: 1.1, pitch: 2 },
        latencyMode: "FAST",
        createdAt: now - 15 * 24 * 60 * 60 * 1000,
        updatedAt: now - 2 * 24 * 60 * 60 * 1000,
      },
      {
        id: "agent-3",
        tenantId,
        name: "Appointment Scheduler",
        status: "PAUSED",
        language: "en-US",
        timezone: "America/New_York",
        instructions: "You help customers schedule appointments.",
        greeting: "Hello! I can help you schedule an appointment.",
        fallbackMessage: "I'm having trouble understanding. Let me transfer you.",
        rules: { noLegal: true, noMedical: false, confirmBookings: true, handoffOnConfusion: false },
        voice: { provider: "elevenlabs", voiceId: "voice-3", speed: 0.9, pitch: -2 },
        latencyMode: "NATURAL",
        createdAt: now - 10 * 24 * 60 * 60 * 1000,
        updatedAt: now - 1 * 24 * 60 * 60 * 1000,
      },
    ];
    agents.forEach(a => this.agents.set(a.id, a));

    // Create demo campaigns
    const campaigns: Campaign[] = [
      {
        id: "campaign-1",
        tenantId,
        agentId: "agent-1",
        name: "Q4 Sales Outreach",
        status: "RUNNING",
        schedule: { startAt: now - 5 * 24 * 60 * 60 * 1000, endAt: now + 25 * 24 * 60 * 60 * 1000, daysOfWeek: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
        maxCallsPerMinute: 5,
        retryPolicy: { maxRetries: 3, retryDelaySec: 3600 },
        meetingLink: "https://meet.google.com/abc-defg-hij",
        totalLeads: 500,
        calledLeads: 234,
        createdAt: now - 5 * 24 * 60 * 60 * 1000,
      },
      {
        id: "campaign-2",
        tenantId,
        agentId: "agent-2",
        name: "Customer Satisfaction Survey",
        status: "PAUSED",
        schedule: { startAt: now - 10 * 24 * 60 * 60 * 1000, endAt: now + 20 * 24 * 60 * 60 * 1000, daysOfWeek: [1, 2, 3, 4, 5], startHour: 10, endHour: 18 },
        maxCallsPerMinute: 3,
        retryPolicy: { maxRetries: 2, retryDelaySec: 7200 },
        totalLeads: 200,
        calledLeads: 150,
        createdAt: now - 10 * 24 * 60 * 60 * 1000,
      },
      {
        id: "campaign-3",
        tenantId,
        agentId: "agent-1",
        name: "Product Launch Announcement",
        status: "DRAFT",
        schedule: { startAt: now + 7 * 24 * 60 * 60 * 1000, endAt: now + 14 * 24 * 60 * 60 * 1000, daysOfWeek: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
        maxCallsPerMinute: 10,
        retryPolicy: { maxRetries: 2, retryDelaySec: 1800 },
        totalLeads: 1000,
        calledLeads: 0,
        createdAt: now - 2 * 24 * 60 * 60 * 1000,
      },
    ];
    campaigns.forEach(c => this.campaigns.set(c.id, c));

    // Create demo calls
    const callStatuses = ["COMPLETED", "COMPLETED", "COMPLETED", "FAILED", "NO_ANSWER", "BUSY"] as const;
    const outcomes = ["INTERESTED", "NOT_INTERESTED", "CALLBACK", "VOICEMAIL", "COMPLETED"] as const;
    for (let i = 0; i < 25; i++) {
      const call: Call = {
        id: `call-${i + 1}`,
        tenantId,
        agentId: agents[i % 3].id,
        campaignId: i < 15 ? campaigns[i % 2].id : undefined,
        direction: i % 5 === 0 ? "INBOUND" : "OUTBOUND",
        to: `+1555${String(1000000 + i).slice(-7)}`,
        from: "+15551234567",
        status: callStatuses[i % callStatuses.length],
        startedAt: now - (i * 2 * 60 * 60 * 1000),
        endedAt: now - (i * 2 * 60 * 60 * 1000) + (90 + i * 10) * 1000,
        durationSec: 90 + i * 10,
        outcome: callStatuses[i % callStatuses.length] === "COMPLETED" ? outcomes[i % outcomes.length] : undefined,
        recordingPath: callStatuses[i % callStatuses.length] === "COMPLETED" ? `/recordings/call-${i + 1}.mp3` : undefined,
        transcriptSummary: callStatuses[i % callStatuses.length] === "COMPLETED" ? "Customer expressed interest in product demo." : undefined,
        destinationCountry: "US",
        usage: { creditsDeducted: Math.floor(10 + i * 2), telephonyCostEstimate: 0.05 + i * 0.01 },
      };
      this.calls.set(call.id, call);
    }

    // Create demo WhatsApp conversations
    const waConvs: WAConversation[] = [
      {
        id: "wa-conv-1",
        tenantId,
        userPhone: "+15559871234",
        userName: "Alice Johnson",
        status: "OPEN",
        lastMessageAt: now - 5 * 60 * 1000,
        aiMode: true,
        humanTakeover: false,
        tags: ["sales", "high-priority"],
        conversationWindowStart: now - 12 * 60 * 60 * 1000,
        creditsDeductedThisWindow: 5,
      },
      {
        id: "wa-conv-2",
        tenantId,
        userPhone: "+15558765432",
        userName: "Bob Smith",
        status: "OPEN",
        lastMessageAt: now - 30 * 60 * 1000,
        aiMode: false,
        humanTakeover: true,
        tags: ["support"],
        conversationWindowStart: now - 6 * 60 * 60 * 1000,
        creditsDeductedThisWindow: 3,
        assignedToUid: userId,
      },
      {
        id: "wa-conv-3",
        tenantId,
        userPhone: "+15551112222",
        userName: "Carol Williams",
        status: "CLOSED",
        lastMessageAt: now - 2 * 24 * 60 * 60 * 1000,
        aiMode: true,
        humanTakeover: false,
        tags: ["inquiry"],
        conversationWindowStart: now - 3 * 24 * 60 * 60 * 1000,
        creditsDeductedThisWindow: 8,
      },
    ];
    waConvs.forEach(c => this.waConversations.set(c.id, c));

    // Create demo WhatsApp messages
    const waMessages: WAMessage[] = [
      { id: "wa-msg-1", conversationId: "wa-conv-1", tenantId, from: "USER", text: "Hi, I'm interested in your product.", timestamp: now - 60 * 60 * 1000, deliveryStatus: "READ" },
      { id: "wa-msg-2", conversationId: "wa-conv-1", tenantId, from: "AI", text: "Hello Alice! Thank you for your interest. Which product are you looking at?", timestamp: now - 55 * 60 * 1000, deliveryStatus: "DELIVERED" },
      { id: "wa-msg-3", conversationId: "wa-conv-1", tenantId, from: "USER", text: "The enterprise plan. Can you tell me more?", timestamp: now - 10 * 60 * 1000, deliveryStatus: "READ" },
      { id: "wa-msg-4", conversationId: "wa-conv-1", tenantId, from: "AI", text: "Our Enterprise plan includes unlimited agents, priority support, and custom integrations. Would you like to schedule a demo?", timestamp: now - 5 * 60 * 1000, deliveryStatus: "DELIVERED" },
      { id: "wa-msg-5", conversationId: "wa-conv-2", tenantId, from: "USER", text: "I need help with my billing issue.", timestamp: now - 2 * 60 * 60 * 1000, deliveryStatus: "READ" },
      { id: "wa-msg-6", conversationId: "wa-conv-2", tenantId, from: "AI", text: "I understand you have a billing concern. Let me connect you with a human agent.", timestamp: now - 1.5 * 60 * 60 * 1000, deliveryStatus: "DELIVERED" },
      { id: "wa-msg-7", conversationId: "wa-conv-2", tenantId, from: "HUMAN", text: "Hi Bob, I'm John from our billing team. How can I help?", timestamp: now - 60 * 60 * 1000, deliveryStatus: "DELIVERED" },
      { id: "wa-msg-8", conversationId: "wa-conv-2", tenantId, from: "USER", text: "I was charged twice last month.", timestamp: now - 30 * 60 * 1000, deliveryStatus: "READ" },
    ];
    waMessages.forEach(m => this.waMessages.set(m.id, m));

    // Create demo transactions
    const txns: Transaction[] = [
      { id: "txn-1", tenantId, type: "SUBSCRIPTION_RENEWAL", creditsDelta: 5000, amount: 99.00, currency: "USD", provider: "stripe", providerRef: "pi_123", description: "Growth Plan - Monthly Renewal", createdAt: now - 30 * 24 * 60 * 60 * 1000 },
      { id: "txn-2", tenantId, type: "USAGE", creditsDelta: -500, amount: 0, currency: "USD", description: "Voice calls - Week 1", createdAt: now - 23 * 24 * 60 * 60 * 1000 },
      { id: "txn-3", tenantId, type: "TOPUP", creditsDelta: 1000, amount: 25.00, currency: "USD", provider: "stripe", providerRef: "pi_456", description: "Credit Top-up", createdAt: now - 15 * 24 * 60 * 60 * 1000 },
      { id: "txn-4", tenantId, type: "USAGE", creditsDelta: -750, amount: 0, currency: "USD", description: "Voice calls - Week 2-3", createdAt: now - 7 * 24 * 60 * 60 * 1000 },
    ];
    txns.forEach(t => this.transactions.set(t.id, t));

    // Create DNC entries
    const dncEntries: DNCEntry[] = [
      { id: "dnc-1", tenantId, phone: "+15551234567", channels: { call: true, whatsapp: true }, createdAt: now - 10 * 24 * 60 * 60 * 1000, source: "manual" },
      { id: "dnc-2", tenantId, phone: "+15559876543", channels: { call: true, whatsapp: false }, createdAt: now - 5 * 24 * 60 * 60 * 1000, source: "user_request" },
    ];
    dncEntries.forEach(d => this.dncEntries.set(d.id, d));

    // WhatsApp connection
    this.waConnections.set(tenantId, {
      tenantId,
      status: "CONNECTED",
      wabaId: "waba-123",
      phoneNumberId: "phone-456",
      businessPhone: "+15551234567",
      wabaCountry: "US",
      connectedAt: now - 20 * 24 * 60 * 60 * 1000,
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id, createdAt: Date.now() };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async getUsersByTenant(tenantId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(u => u.tenantId === tenantId);
  }

  // Tenants
  async getTenant(id: string): Promise<Tenant | undefined> {
    return this.tenants.get(id);
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const id = randomUUID();
    const tenant: Tenant = { ...insertTenant, id, createdAt: Date.now() };
    this.tenants.set(id, tenant);
    return tenant;
  }

  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant | undefined> {
    const tenant = this.tenants.get(id);
    if (!tenant) return undefined;
    const updated = { ...tenant, ...updates };
    this.tenants.set(id, updated);
    return updated;
  }

  async getAllTenants(): Promise<Tenant[]> {
    return Array.from(this.tenants.values());
  }

  // Agents
  async getAgent(id: string): Promise<Agent | undefined> {
    return this.agents.get(id);
  }

  async getAgentsByTenant(tenantId: string): Promise<Agent[]> {
    return Array.from(this.agents.values()).filter(a => a.tenantId === tenantId);
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const id = randomUUID();
    const now = Date.now();
    const agent: Agent = { ...insertAgent, id, createdAt: now, updatedAt: now };
    this.agents.set(id, agent);
    return agent;
  }

  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined> {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    const updated = { ...agent, ...updates, updatedAt: Date.now() };
    this.agents.set(id, updated);
    return updated;
  }

  async deleteAgent(id: string): Promise<boolean> {
    return this.agents.delete(id);
  }

  // Intents
  async getIntentsByAgent(agentId: string): Promise<Intent[]> {
    return Array.from(this.intents.values()).filter(i => i.agentId === agentId);
  }

  async createIntent(insertIntent: InsertIntent): Promise<Intent> {
    const id = randomUUID();
    const intent: Intent = { ...insertIntent, id };
    this.intents.set(id, intent);
    return intent;
  }

  async updateIntent(id: string, updates: Partial<Intent>): Promise<Intent | undefined> {
    const intent = this.intents.get(id);
    if (!intent) return undefined;
    const updated = { ...intent, ...updates };
    this.intents.set(id, updated);
    return updated;
  }

  async deleteIntent(id: string): Promise<boolean> {
    return this.intents.delete(id);
  }

  // Campaigns
  async getCampaign(id: string): Promise<Campaign | undefined> {
    return this.campaigns.get(id);
  }

  async getCampaignsByTenant(tenantId: string): Promise<Campaign[]> {
    return Array.from(this.campaigns.values()).filter(c => c.tenantId === tenantId);
  }

  async createCampaign(insertCampaign: InsertCampaign): Promise<Campaign> {
    const id = randomUUID();
    const campaign: Campaign = { ...insertCampaign, id, createdAt: Date.now(), totalLeads: 0, calledLeads: 0 };
    this.campaigns.set(id, campaign);
    return campaign;
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | undefined> {
    const campaign = this.campaigns.get(id);
    if (!campaign) return undefined;
    const updated = { ...campaign, ...updates };
    this.campaigns.set(id, updated);
    return updated;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    return this.campaigns.delete(id);
  }

  // Leads
  async getLeadsByCampaign(campaignId: string): Promise<Lead[]> {
    return Array.from(this.leads.values()).filter(l => l.campaignId === campaignId);
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = randomUUID();
    const lead: Lead = { ...insertLead, id, attempts: 0 };
    this.leads.set(id, lead);
    return lead;
  }

  async createLeads(insertLeads: InsertLead[]): Promise<Lead[]> {
    const leads: Lead[] = [];
    for (const insertLead of insertLeads) {
      const lead = await this.createLead(insertLead);
      leads.push(lead);
    }
    return leads;
  }

  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    if (!lead) return undefined;
    const updated = { ...lead, ...updates };
    this.leads.set(id, updated);
    return updated;
  }

  // Calls
  async getCall(id: string): Promise<Call | undefined> {
    return this.calls.get(id);
  }

  async getCallsByTenant(tenantId: string, filters?: { agentId?: string; campaignId?: string; status?: string; from?: number; to?: number }): Promise<Call[]> {
    let calls = Array.from(this.calls.values()).filter(c => c.tenantId === tenantId);
    if (filters?.agentId) calls = calls.filter(c => c.agentId === filters.agentId);
    if (filters?.campaignId) calls = calls.filter(c => c.campaignId === filters.campaignId);
    if (filters?.status) calls = calls.filter(c => c.status === filters.status);
    if (filters?.from) calls = calls.filter(c => c.startedAt >= filters.from!);
    if (filters?.to) calls = calls.filter(c => c.startedAt <= filters.to!);
    return calls.sort((a, b) => b.startedAt - a.startedAt);
  }

  async createCall(insertCall: InsertCall): Promise<Call> {
    const id = randomUUID();
    const call: Call = { ...insertCall, id };
    this.calls.set(id, call);
    return call;
  }

  async updateCall(id: string, updates: Partial<Call>): Promise<Call | undefined> {
    const call = this.calls.get(id);
    if (!call) return undefined;
    const updated = { ...call, ...updates };
    this.calls.set(id, updated);
    return updated;
  }

  // WhatsApp Connection
  async getWAConnection(tenantId: string): Promise<WAConnection | undefined> {
    return this.waConnections.get(tenantId);
  }

  async setWAConnection(connection: WAConnection): Promise<WAConnection> {
    this.waConnections.set(connection.tenantId, connection);
    return connection;
  }

  // WhatsApp Conversations
  async getWAConversation(id: string): Promise<WAConversation | undefined> {
    return this.waConversations.get(id);
  }

  async getWAConversationsByTenant(tenantId: string): Promise<WAConversation[]> {
    return Array.from(this.waConversations.values())
      .filter(c => c.tenantId === tenantId)
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }

  async createWAConversation(conv: InsertWAConversation): Promise<WAConversation> {
    const id = randomUUID();
    const conversation: WAConversation = { ...conv, id };
    this.waConversations.set(id, conversation);
    return conversation;
  }

  async updateWAConversation(id: string, updates: Partial<WAConversation>): Promise<WAConversation | undefined> {
    const conv = this.waConversations.get(id);
    if (!conv) return undefined;
    const updated = { ...conv, ...updates };
    this.waConversations.set(id, updated);
    return updated;
  }

  // WhatsApp Messages
  async getWAMessagesByConversation(conversationId: string): Promise<WAMessage[]> {
    return Array.from(this.waMessages.values())
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async createWAMessage(insertMessage: InsertWAMessage): Promise<WAMessage> {
    const id = randomUUID();
    const message: WAMessage = { ...insertMessage, id };
    this.waMessages.set(id, message);
    return message;
  }

  // Wallet
  async getWallet(tenantId: string): Promise<Wallet | undefined> {
    return this.wallets.get(tenantId);
  }

  async updateWallet(tenantId: string, updates: Partial<Wallet>): Promise<Wallet | undefined> {
    const wallet = this.wallets.get(tenantId);
    if (!wallet) return undefined;
    const updated = { ...wallet, ...updates, lastUpdatedAt: Date.now() };
    this.wallets.set(tenantId, updated);
    return updated;
  }

  async createWallet(tenantId: string): Promise<Wallet> {
    const wallet: Wallet = {
      tenantId,
      creditsBalance: 0,
      creditsUsedThisMonth: 0,
      lastUpdatedAt: Date.now(),
    };
    this.wallets.set(tenantId, wallet);
    return wallet;
  }

  // Transactions
  async getTransactionsByTenant(tenantId: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(t => t.tenantId === tenantId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async createTransaction(insertTxn: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = { ...insertTxn, id, createdAt: Date.now() };
    this.transactions.set(id, transaction);
    return transaction;
  }

  // DNC
  async getDNCByTenant(tenantId: string): Promise<DNCEntry[]> {
    return Array.from(this.dncEntries.values())
      .filter(d => d.tenantId === tenantId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async createDNCEntry(insertEntry: InsertDNCEntry): Promise<DNCEntry> {
    const id = randomUUID();
    const entry: DNCEntry = { ...insertEntry, id, createdAt: Date.now() };
    this.dncEntries.set(id, entry);
    return entry;
  }

  async deleteDNCEntry(id: string): Promise<boolean> {
    return this.dncEntries.delete(id);
  }

  async checkDNC(tenantId: string, phone: string): Promise<DNCEntry | undefined> {
    return Array.from(this.dncEntries.values()).find(d => d.tenantId === tenantId && d.phone === phone);
  }

  // Platform Settings
  async getPlatformSettings(): Promise<PlatformSettings> {
    return this.platformSettings;
  }

  async updatePlatformSettings(updates: Partial<PlatformSettings>): Promise<PlatformSettings> {
    this.platformSettings = { ...this.platformSettings, ...updates };
    return this.platformSettings;
  }

  // Dashboard
  async getDashboardStats(tenantId: string): Promise<DashboardStats> {
    const calls = Array.from(this.calls.values()).filter(c => c.tenantId === tenantId);
    const agents = Array.from(this.agents.values()).filter(a => a.tenantId === tenantId);
    const campaigns = Array.from(this.campaigns.values()).filter(c => c.tenantId === tenantId);
    const conversations = Array.from(this.waConversations.values()).filter(c => c.tenantId === tenantId);
    const wallet = this.wallets.get(tenantId);

    return {
      totalCalls: calls.length,
      totalMinutes: Math.round(calls.reduce((sum, c) => sum + c.durationSec, 0) / 60),
      totalWhatsAppConversations: conversations.length,
      creditsUsed: wallet?.creditsUsedThisMonth || 0,
      creditsRemaining: wallet?.creditsBalance || 0,
      activeAgents: agents.filter(a => a.status === "ACTIVE").length,
      activeCampaigns: campaigns.filter(c => c.status === "RUNNING").length,
    };
  }

  async getAdminDashboardStats(): Promise<AdminDashboardStats> {
    const tenants = Array.from(this.tenants.values());
    const transactions = Array.from(this.transactions.values());
    const wallets = Array.from(this.wallets.values());

    const totalRevenue = transactions
      .filter(t => t.type === "SUBSCRIPTION_RENEWAL" || t.type === "TOPUP")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalCreditsIssued = transactions
      .filter(t => t.creditsDelta > 0)
      .reduce((sum, t) => sum + t.creditsDelta, 0);

    const totalCreditsConsumed = wallets.reduce((sum, w) => sum + w.creditsUsedThisMonth, 0);

    return {
      totalTenants: tenants.length,
      activeTenants: tenants.filter(t => t.status === "ACTIVE").length,
      trialTenants: tenants.filter(t => t.status === "TRIAL").length,
      totalRevenue,
      totalCreditsIssued,
      totalCreditsConsumed,
      estimatedApiCost: totalCreditsConsumed * 0.01,
      grossMargin: totalRevenue > 0 ? ((totalRevenue - totalCreditsConsumed * 0.01) / totalRevenue) * 100 : 0,
    };
  }

  // Credit Deduction
  async deductCredits(tenantId: string, amount: number, description: string, type: string = "USAGE"): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const wallet = this.wallets.get(tenantId);
    if (!wallet) {
      return { success: false, newBalance: 0, error: "Wallet not found" };
    }

    if (wallet.creditsBalance < amount) {
      return { success: false, newBalance: wallet.creditsBalance, error: "Insufficient credits" };
    }

    const newBalance = wallet.creditsBalance - amount;
    const updated: Wallet = {
      ...wallet,
      creditsBalance: newBalance,
      creditsUsedThisMonth: wallet.creditsUsedThisMonth + amount,
      lastUpdatedAt: Date.now(),
    };
    this.wallets.set(tenantId, updated);

    await this.createTransaction({
      tenantId,
      type: type as "USAGE" | "TOPUP" | "SUBSCRIPTION_RENEWAL" | "REFUND" | "MANUAL_ADJUSTMENT",
      creditsDelta: -amount,
      amount: 0,
      currency: "USD",
      description,
    });

    return { success: true, newBalance };
  }

  async getWAConversationByPhone(tenantId: string, phone: string): Promise<WAConversation | undefined> {
    return Array.from(this.waConversations.values()).find(c => c.tenantId === tenantId && c.userPhone === phone);
  }

  async getLead(id: string): Promise<Lead | undefined> {
    return this.leads.get(id);
  }

  async getCallByProviderRef(providerRef: string): Promise<Call | undefined> {
    return Array.from(this.calls.values()).find(c => c.usage?.providerRef === providerRef);
  }

  // Tenant Phone Numbers
  async getTenantPhonesByTenant(tenantId: string): Promise<TenantPhone[]> {
    return Array.from(this.tenantPhones.values()).filter(p => p.tenantId === tenantId);
  }

  async getTenantPhone(id: string): Promise<TenantPhone | undefined> {
    return this.tenantPhones.get(id);
  }

  async createTenantPhone(insertPhone: InsertTenantPhone): Promise<TenantPhone> {
    const id = randomUUID();
    const phone: TenantPhone = {
      ...insertPhone,
      id,
      createdAt: Date.now(),
      attempts: 0,
    };
    this.tenantPhones.set(id, phone);
    return phone;
  }

  async updateTenantPhone(id: string, updates: Partial<TenantPhone>): Promise<TenantPhone | undefined> {
    const phone = this.tenantPhones.get(id);
    if (!phone) return undefined;
    const updated = { ...phone, ...updates };
    this.tenantPhones.set(id, updated);
    return updated;
  }

  async deleteTenantPhone(id: string): Promise<boolean> {
    return this.tenantPhones.delete(id);
  }

  async getDefaultOutboundPhone(tenantId: string): Promise<TenantPhone | undefined> {
    return Array.from(this.tenantPhones.values()).find(
      p => p.tenantId === tenantId && p.isDefaultOutbound && p.status === "VERIFIED"
    );
  }

  async getDefaultInboundPhone(tenantId: string): Promise<TenantPhone | undefined> {
    return Array.from(this.tenantPhones.values()).find(
      p => p.tenantId === tenantId && p.isDefaultInbound && p.status === "VERIFIED"
    );
  }
}

export const storage = new MemStorage();
