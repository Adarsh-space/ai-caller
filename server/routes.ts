import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertAgentSchema,
  insertCampaignSchema,
  insertLeadSchema,
  insertWAMessageSchema,
  insertTransactionSchema,
  insertDNCEntrySchema,
} from "@shared/schema";
import { z } from "zod";
import { getIntegrationStatus, signalwire, callOrchestrator, whatsapp, razorpay, PLANS, TOPUP_OPTIONS } from "./integrations";
import crypto from "crypto";

// Simple session simulation - in production use proper session management
interface AuthenticatedRequest extends Request {
  user?: { id: string; tenantId: string; role: string };
}

// Auth middleware
const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.slice(7);
  // Simple token format: userId:tenantId
  const [userId, tenantId] = token.split(":");
  const user = await storage.getUser(userId);
  if (!user || user.tenantId !== tenantId) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.user = { id: user.id, tenantId: user.tenantId, role: user.role };
  next();
};

// Admin check middleware
const adminMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "OWNER" && req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ============= AUTH =============
  
  // Login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Update last login
      await storage.updateUser(user.id, { lastLoginAt: Date.now() });

      // Get wallet
      const wallet = await storage.getWallet(user.tenantId);

      // Simple token: userId:tenantId
      const token = `${user.id}:${user.tenantId}`;

      res.json({
        user: { ...user, password: undefined },
        tenant,
        wallet,
        token,
      });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Register
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name, businessName, businessCountry } = req.body;

      // Check if user exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Create tenant first
      const tenant = await storage.createTenant({
        name: businessName || "My Business",
        businessCountry: businessCountry || "US",
        currency: "USD",
        timezone: "America/New_York",
        planId: "STARTER",
        status: "TRIAL",
        ownerUid: "", // Will update after creating user
        pricingRegion: "US",
      });

      // Create user
      const user = await storage.createUser({
        tenantId: tenant.id,
        email,
        password,
        name,
        role: "OWNER",
        status: "ACTIVE",
      });

      // Update tenant with owner
      await storage.updateTenant(tenant.id, { ownerUid: user.id });

      // Create wallet with trial credits
      await storage.createWallet(tenant.id);
      await storage.updateWallet(tenant.id, { creditsBalance: 100 });

      // Create initial transaction
      await storage.createTransaction({
        tenantId: tenant.id,
        type: "MANUAL_ADJUSTMENT",
        creditsDelta: 100,
        amount: 0,
        currency: "USD",
        description: "Trial credits",
      });

      const token = `${user.id}:${tenant.id}`;

      res.json({
        user: { ...user, password: undefined },
        tenant,
        token,
      });
    } catch (error) {
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Get current user
  app.get("/api/auth/me", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.id);
      const tenant = await storage.getTenant(req.user!.tenantId);

      if (!user || !tenant) {
        return res.status(404).json({ error: "Not found" });
      }

      const wallet = await storage.getWallet(req.user!.tenantId);

      res.json({
        user: { ...user, password: undefined },
        tenant,
        wallet,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // ============= DASHBOARD =============
  
  app.get("/api/dashboard/stats", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await storage.getDashboardStats(req.user!.tenantId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // ============= AGENTS =============
  
  app.get("/api/agents", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const agents = await storage.getAgentsByTenant(req.user!.tenantId);
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: "Failed to get agents" });
    }
  });

  app.get("/api/agents/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent || agent.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      res.status(500).json({ error: "Failed to get agent" });
    }
  });

  app.post("/api/agents", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertAgentSchema.parse({ ...req.body, tenantId: req.user!.tenantId });
      const agent = await storage.createAgent(data);
      res.json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  app.patch("/api/agents/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent || agent.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Agent not found" });
      }
      const updated = await storage.updateAgent(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent || agent.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Agent not found" });
      }
      await storage.deleteAgent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  // ============= AGENT INTENTS =============

  app.get("/api/agents/:id/intents", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent || agent.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Agent not found" });
      }
      const intents = await storage.getIntentsByAgent(req.params.id);
      res.json(intents);
    } catch (error) {
      res.status(500).json({ error: "Failed to get intents" });
    }
  });

  app.post("/api/agents/:id/intents", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent || agent.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      const { name, triggers, response, escalateToHuman } = req.body;
      const intent = await storage.createIntent({
        agentId: req.params.id,
        tenantId: req.user!.tenantId,
        name,
        triggers: triggers || [],
        responseTemplate: response || "",
        escalateToHuman: escalateToHuman || false,
      });
      res.json(intent);
    } catch (error) {
      res.status(500).json({ error: "Failed to create intent" });
    }
  });

  app.delete("/api/agents/:agentId/intents/:intentId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const agent = await storage.getAgent(req.params.agentId);
      if (!agent || agent.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Agent not found" });
      }
      await storage.deleteIntent(req.params.intentId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete intent" });
    }
  });

  // ============= VOICE PREVIEW =============

  app.get("/api/voice/status", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      res.json({ 
        configured: !!apiKey,
        provider: "elevenlabs"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get voice status" });
    }
  });

  // ============= TELEPHONY STATUS =============

  app.get("/api/telephony/status", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const configured = signalwire.isConfigured();
      let phoneNumbers: string[] = [];
      
      if (configured && process.env.SIGNALWIRE_PHONE_NUMBER) {
        phoneNumbers = [process.env.SIGNALWIRE_PHONE_NUMBER];
      }
      
      res.json({ 
        configured,
        phoneNumbers,
        provider: "signalwire"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get telephony status" });
    }
  });

  // ============= TENANT PHONE NUMBERS =============

  app.get("/api/telephony/phone-numbers", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const phones = await storage.getTenantPhonesByTenant(req.user!.tenantId);
      res.json(phones);
    } catch (error) {
      res.status(500).json({ error: "Failed to get phone numbers" });
    }
  });

  app.post("/api/telephony/phone-numbers/start", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { phoneNumber, label } = req.body;
      
      if (!phoneNumber || typeof phoneNumber !== "string") {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const normalizedPhone = phoneNumber.replace(/\s+/g, "").trim();
      if (!/^\+?[1-9]\d{6,14}$/.test(normalizedPhone)) {
        return res.status(400).json({ error: "Invalid phone number format" });
      }

      const existingPhones = await storage.getTenantPhonesByTenant(req.user!.tenantId);
      const duplicate = existingPhones.find(p => p.phoneNumber === normalizedPhone && p.status === "VERIFIED");
      if (duplicate) {
        return res.status(400).json({ error: "This phone number is already verified" });
      }

      const existingPending = existingPhones.find(p => p.phoneNumber === normalizedPhone && p.status === "PENDING");
      if (existingPending) {
        await storage.deleteTenantPhone(existingPending.id);
      }

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = Date.now() + 10 * 60 * 1000;

      const phone = await storage.createTenantPhone({
        tenantId: req.user!.tenantId,
        phoneNumber: normalizedPhone,
        label: label || undefined,
        status: "PENDING",
        otpCode,
        otpExpiresAt,
        isDefaultOutbound: false,
        isDefaultInbound: false,
      });

      console.log(`[OTP] Phone ${normalizedPhone} verification code: ${otpCode}`);

      res.json({ 
        id: phone.id, 
        phoneNumber: phone.phoneNumber,
        message: "Verification code sent (check server logs for demo)" 
      });
    } catch (error) {
      console.error("Start verification error:", error);
      res.status(500).json({ error: "Failed to start phone verification" });
    }
  });

  app.post("/api/telephony/phone-numbers/verify", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { phoneId, otpCode } = req.body;
      
      if (!phoneId || !otpCode) {
        return res.status(400).json({ error: "Phone ID and OTP code are required" });
      }

      const phone = await storage.getTenantPhone(phoneId);
      if (!phone || phone.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Phone number not found" });
      }

      if (phone.status === "VERIFIED") {
        return res.status(400).json({ error: "Phone already verified" });
      }

      if (phone.attempts >= 5) {
        await storage.updateTenantPhone(phoneId, { status: "FAILED" });
        return res.status(400).json({ error: "Too many attempts. Please start over." });
      }

      if (!phone.otpExpiresAt || Date.now() > phone.otpExpiresAt) {
        await storage.updateTenantPhone(phoneId, { status: "EXPIRED" });
        return res.status(400).json({ error: "OTP has expired. Please request a new one." });
      }

      if (phone.otpCode !== otpCode) {
        await storage.updateTenantPhone(phoneId, { attempts: (phone.attempts || 0) + 1 });
        return res.status(400).json({ error: "Invalid OTP code" });
      }

      const existingPhones = await storage.getTenantPhonesByTenant(req.user!.tenantId);
      const hasDefault = existingPhones.some(p => p.status === "VERIFIED" && p.isDefaultOutbound);

      const updatedPhone = await storage.updateTenantPhone(phoneId, {
        status: "VERIFIED",
        verifiedAt: Date.now(),
        otpCode: undefined,
        otpExpiresAt: undefined,
        isDefaultOutbound: !hasDefault,
        isDefaultInbound: !hasDefault,
      });

      res.json({ success: true, phone: updatedPhone });
    } catch (error) {
      console.error("Verify phone error:", error);
      res.status(500).json({ error: "Failed to verify phone number" });
    }
  });

  app.patch("/api/telephony/phone-numbers/:id/default", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type } = req.body;
      if (!type || !["outbound", "inbound"].includes(type)) {
        return res.status(400).json({ error: "Type must be 'outbound' or 'inbound'" });
      }

      const phone = await storage.getTenantPhone(req.params.id);
      if (!phone || phone.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Phone number not found" });
      }

      if (phone.status !== "VERIFIED") {
        return res.status(400).json({ error: "Only verified phones can be set as default" });
      }

      const allPhones = await storage.getTenantPhonesByTenant(req.user!.tenantId);
      for (const p of allPhones) {
        if (p.id !== phone.id) {
          if (type === "outbound" && p.isDefaultOutbound) {
            await storage.updateTenantPhone(p.id, { isDefaultOutbound: false });
          }
          if (type === "inbound" && p.isDefaultInbound) {
            await storage.updateTenantPhone(p.id, { isDefaultInbound: false });
          }
        }
      }

      const updates = type === "outbound" 
        ? { isDefaultOutbound: true } 
        : { isDefaultInbound: true };
      const updatedPhone = await storage.updateTenantPhone(req.params.id, updates);

      res.json(updatedPhone);
    } catch (error) {
      res.status(500).json({ error: "Failed to set default phone number" });
    }
  });

  app.delete("/api/telephony/phone-numbers/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const phone = await storage.getTenantPhone(req.params.id);
      if (!phone || phone.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Phone number not found" });
      }

      if (phone.isDefaultOutbound || phone.isDefaultInbound) {
        return res.status(400).json({ error: "Cannot delete default phone. Set another number as default first." });
      }

      await storage.deleteTenantPhone(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete phone number" });
    }
  });

  app.post("/api/voice/preview", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { voiceId, text } = req.body;
      
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: "ElevenLabs API key not configured" });
      }

      const elevenLabsVoiceMap: Record<string, string> = {
        rachel: "21m00Tcm4TlvDq8ikWAM",
        josh: "TxGEqnHWrfWFTfGW9XjX",
        emily: "LcfcDJNUP1GQjkzn1xUU",
        sam: "yoZ06aMxZJJ28mfd3POQ",
        priya: "oWAxZDx7w5VEj9dCyTzz",
        adam: "pNInz6obpgDQGcFmaJgB",
        bella: "EXAVITQu4vr4xnSDxMaL",
        charlie: "IKne3meq5aSn9XLyUdCD",
        domi: "AZnzlk1XvdvUeBnXmlld",
        elli: "MF3mGyEYCl7XYWbV9V6O",
        antoni: "ErXwobaYiN019PkySvjV",
        arnold: "VR6AewLTigWG4xSOukaG",
      };

      const elevenLabsVoiceId = elevenLabsVoiceMap[voiceId] || elevenLabsVoiceMap.rachel;
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: text || "Hello, this is a voice preview.",
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs error:", errorText);
        return res.status(500).json({ error: "Failed to generate voice" });
      }

      const audioBuffer = await response.arrayBuffer();
      res.setHeader("Content-Type", "audio/mpeg");
      res.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error("Voice preview error:", error);
      res.status(500).json({ error: "Failed to generate voice preview" });
    }
  });

  // ============= CAMPAIGNS =============
  
  app.get("/api/campaigns", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaigns = await storage.getCampaignsByTenant(req.user!.tenantId);
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ error: "Failed to get campaigns" });
    }
  });

  app.get("/api/campaigns/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ error: "Failed to get campaign" });
    }
  });

  app.post("/api/campaigns", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertCampaignSchema.parse({ ...req.body, tenantId: req.user!.tenantId });
      const campaign = await storage.createCampaign(data);
      res.json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  app.patch("/api/campaigns/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const updated = await storage.updateCampaign(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update campaign" });
    }
  });

  app.delete("/api/campaigns/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      await storage.deleteCampaign(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });

  // Upload leads to campaign
  app.post("/api/campaigns/:id/leads", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const { leads } = req.body as { leads: Array<{ phone: string; name: string; metadata?: Record<string, string> }> };
      if (!Array.isArray(leads)) {
        return res.status(400).json({ error: "Leads must be an array" });
      }

      const insertLeads = leads.map(l => ({
        campaignId: campaign.id,
        tenantId: req.user!.tenantId,
        phone: l.phone,
        name: l.name,
        status: "PENDING" as const,
        metadata: l.metadata,
      }));

      const createdLeads = await storage.createLeads(insertLeads);
      await storage.updateCampaign(campaign.id, { 
        totalLeads: campaign.totalLeads + createdLeads.length 
      });

      res.json({ count: createdLeads.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to upload leads" });
    }
  });

  app.get("/api/campaigns/:id/leads", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const leads = await storage.getLeadsByCampaign(req.params.id);
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to get leads" });
    }
  });

  // ============= CALLS =============
  
  app.get("/api/calls", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { agentId, campaignId, status, from, to } = req.query;
      const calls = await storage.getCallsByTenant(req.user!.tenantId, {
        agentId: agentId as string,
        campaignId: campaignId as string,
        status: status as string,
        from: from ? parseInt(from as string) : undefined,
        to: to ? parseInt(to as string) : undefined,
      });
      res.json(calls);
    } catch (error) {
      res.status(500).json({ error: "Failed to get calls" });
    }
  });

  app.get("/api/calls/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const call = await storage.getCall(req.params.id);
      if (!call || call.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Call not found" });
      }
      res.json(call);
    } catch (error) {
      res.status(500).json({ error: "Failed to get call" });
    }
  });

  // ============= WHATSAPP =============
  
  app.get("/api/whatsapp/connection", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const connection = await storage.getWAConnection(req.user!.tenantId);
      res.json(connection || { tenantId: req.user!.tenantId, status: "DISCONNECTED" });
    } catch (error) {
      res.status(500).json({ error: "Failed to get connection" });
    }
  });

  app.get("/api/whatsapp/conversations", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const conversations = await storage.getWAConversationsByTenant(req.user!.tenantId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to get conversations" });
    }
  });

  app.get("/api/whatsapp/conversations/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const conv = await storage.getWAConversation(req.params.id);
      if (!conv || conv.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conv);
    } catch (error) {
      res.status(500).json({ error: "Failed to get conversation" });
    }
  });

  app.patch("/api/whatsapp/conversations/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const conv = await storage.getWAConversation(req.params.id);
      if (!conv || conv.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const updated = await storage.updateWAConversation(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  app.get("/api/whatsapp/conversations/:id/messages", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const conv = await storage.getWAConversation(req.params.id);
      if (!conv || conv.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await storage.getWAMessagesByConversation(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  app.post("/api/whatsapp/conversations/:id/messages", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const conv = await storage.getWAConversation(req.params.id);
      if (!conv || conv.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const message = await storage.createWAMessage({
        conversationId: req.params.id,
        tenantId: req.user!.tenantId,
        from: "HUMAN",
        text: req.body.text,
        timestamp: Date.now(),
        deliveryStatus: "SENT",
      });

      await storage.updateWAConversation(req.params.id, { 
        lastMessageAt: Date.now() 
      });

      res.json(message);
    } catch (error) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // ============= BILLING =============
  
  app.get("/api/wallet", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const wallet = await storage.getWallet(req.user!.tenantId);
      res.json(wallet || { tenantId: req.user!.tenantId, creditsBalance: 0, creditsUsedThisMonth: 0, lastUpdatedAt: Date.now() });
    } catch (error) {
      res.status(500).json({ error: "Failed to get wallet" });
    }
  });

  app.get("/api/billing/transactions", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const transactions = await storage.getTransactionsByTenant(req.user!.tenantId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get transactions" });
    }
  });

  app.post("/api/billing/topup", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { credits } = req.body;
      const priceMap: Record<number, number> = { 100: 10, 500: 45, 1000: 85, 2500: 200 };
      const amount = priceMap[credits] || Math.round(credits * 0.1);
      
      const transaction = await storage.createTransaction({
        tenantId: req.user!.tenantId,
        type: "TOPUP",
        creditsDelta: credits,
        amount,
        currency: "USD",
        provider: "stripe",
        providerRef: `sim_${Date.now()}`,
        description: `Credit top-up: ${credits} credits`,
      });

      const wallet = await storage.getWallet(req.user!.tenantId);
      await storage.updateWallet(req.user!.tenantId, {
        creditsBalance: (wallet?.creditsBalance || 0) + credits,
      });

      res.json({ transaction, success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to process top-up" });
    }
  });

  app.get("/api/billing/subscription", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenant = await storage.getTenant(req.user!.tenantId);
      const subscription = {
        planId: tenant?.planId || "STARTER",
        status: "ACTIVE",
        nextBillingAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        startedAt: tenant?.createdAt || Date.now(),
      };
      res.json(subscription);
    } catch (error) {
      res.status(500).json({ error: "Failed to get subscription" });
    }
  });

  app.post("/api/billing/change-plan", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { planId } = req.body;
      const validPlans = ["STARTER", "GROWTH", "BUSINESS"];
      if (!validPlans.includes(planId)) {
        return res.status(400).json({ error: "Invalid plan" });
      }
      
      await storage.updateTenant(req.user!.tenantId, { planId });
      
      const planCredits: Record<string, number> = { STARTER: 500, GROWTH: 2000, BUSINESS: 5000 };
      const wallet = await storage.getWallet(req.user!.tenantId);
      await storage.updateWallet(req.user!.tenantId, {
        creditsBalance: (wallet?.creditsBalance || 0) + planCredits[planId],
      });
      
      await storage.createTransaction({
        tenantId: req.user!.tenantId,
        type: "SUBSCRIPTION_RENEWAL",
        creditsDelta: planCredits[planId],
        amount: planId === "STARTER" ? 49 : planId === "GROWTH" ? 149 : 399,
        currency: "USD",
        provider: "stripe",
        providerRef: `plan_${Date.now()}`,
        description: `Plan changed to ${planId}`,
      });
      
      res.json({ success: true, planId });
    } catch (error) {
      res.status(500).json({ error: "Failed to change plan" });
    }
  });

  // ============= COMPLIANCE =============
  
  app.get("/api/compliance/dnc", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const entries = await storage.getDNCByTenant(req.user!.tenantId);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to get DNC list" });
    }
  });

  app.post("/api/compliance/dnc", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertDNCEntrySchema.parse({ ...req.body, tenantId: req.user!.tenantId });
      const entry = await storage.createDNCEntry(data);
      res.json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to add DNC entry" });
    }
  });

  app.delete("/api/compliance/dnc/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.deleteDNCEntry(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete DNC entry" });
    }
  });

  // ============= SETTINGS =============
  
  app.patch("/api/settings/user", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await storage.updateUser(req.user!.id, req.body);
      res.json({ ...updated, password: undefined });
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.patch("/api/settings/tenant", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await storage.updateTenant(req.user!.tenantId, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update tenant" });
    }
  });

  app.get("/api/settings/team", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const users = await storage.getUsersByTenant(req.user!.tenantId);
      res.json(users.map(u => ({ ...u, password: undefined })));
    } catch (error) {
      res.status(500).json({ error: "Failed to get team" });
    }
  });

  // ============= ADMIN =============
  
  app.get("/api/admin/stats", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await storage.getAdminDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get admin stats" });
    }
  });

  app.get("/api/admin/tenants", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenants = await storage.getAllTenants();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ error: "Failed to get tenants" });
    }
  });

  app.patch("/api/admin/tenants/:id", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await storage.updateTenant(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update tenant" });
    }
  });

  app.get("/api/admin/settings", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const settings = await storage.getPlatformSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  app.patch("/api/admin/settings", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await storage.updatePlatformSettings(req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // ============= INTEGRATIONS =============
  
  app.get("/api/integrations/status", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const status = getIntegrationStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get integration status" });
    }
  });

  app.get("/api/billing/plans", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      res.json({ plans: PLANS, topups: TOPUP_OPTIONS });
    } catch (error) {
      res.status(500).json({ error: "Failed to get plans" });
    }
  });

  // ============= CALL INITIATION =============
  
  app.post("/api/calls/initiate", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { agentId, phone, campaignId, leadId } = req.body;
      
      const agent = await storage.getAgent(agentId);
      if (!agent || agent.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Agent not found" });
      }

      const wallet = await storage.getWallet(req.user!.tenantId);
      if (!wallet || wallet.creditsBalance < 10) {
        return res.status(402).json({ error: "Insufficient credits" });
      }

      const isDNC = await storage.checkDNC(req.user!.tenantId, phone);
      if (isDNC) {
        return res.status(400).json({ error: "Number is on Do-Not-Call list" });
      }

      const settings = await storage.getPlatformSettings();
      if (settings.killSwitchCalls) {
        return res.status(503).json({ error: "Calling is temporarily disabled" });
      }

      // Get tenant's verified default outbound phone for display/tracking
      const defaultPhone = await storage.getDefaultOutboundPhone(req.user!.tenantId);
      const displayFromNumber = defaultPhone?.phoneNumber || process.env.SIGNALWIRE_PHONE_NUMBER || "+15551234567";
      
      // SignalWire requires using a provisioned number for actual calls
      const signalwireFromNumber = process.env.SIGNALWIRE_PHONE_NUMBER || "+15551234567";
      
      const call = await storage.createCall({
        tenantId: req.user!.tenantId,
        agentId,
        campaignId,
        direction: "OUTBOUND",
        to: phone,
        from: displayFromNumber,
        status: "INITIATED",
        startedAt: Date.now(),
        durationSec: 0,
        destinationCountry: "US",
        usage: { creditsDeducted: 0, telephonyCostEstimate: 0 },
      });

      if (leadId) {
        await storage.updateLead(leadId, { status: "CALLED" });
      }

      // Initiate actual call via SignalWire if configured
      if (signalwire.isConfigured()) {
        try {
          // Use request host or override env var for webhook URL
          const baseUrl = process.env.APP_BASE_URL 
            || `${req.protocol}://${req.get('host')}`;
          
          const callState = await signalwire.makeCall({
            to: phone,
            from: signalwireFromNumber,
            agentId,
            tenantId: req.user!.tenantId,
            campaignId,
            webhookUrl: `${baseUrl}/webhooks/signalwire/voice`,
          });

          // Update call record with SignalWire call ID in externalId field
          await storage.updateCall(call.id, { 
            status: "RINGING",
            externalId: callState.callId,
          });

          res.json({ callId: call.id, swCallId: callState.callId, status: "ringing" });
        } catch (swError) {
          console.error("SignalWire call error:", swError);
          await storage.updateCall(call.id, { status: "FAILED" });
          res.json({ callId: call.id, status: "failed", error: "Failed to connect call" });
        }
      } else {
        // SignalWire not configured - return simulated response
        res.json({ callId: call.id, status: "initiated", simulated: true });
      }
    } catch (error) {
      console.error("Call initiation error:", error);
      res.status(500).json({ error: "Failed to initiate call" });
    }
  });

  app.post("/api/calls/:id/end", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const call = await storage.getCall(req.params.id);
      if (!call || call.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Call not found" });
      }

      const endedAt = Date.now();
      const durationSec = Math.round((endedAt - call.startedAt) / 1000);
      const creditsToDeduct = Math.ceil(durationSec / 60) * 2;

      await storage.deductCredits(req.user!.tenantId, creditsToDeduct, `Voice call: ${durationSec}s`);

      const updated = await storage.updateCall(req.params.id, {
        status: "COMPLETED",
        endedAt,
        durationSec,
        usage: { creditsDeducted: creditsToDeduct, telephonyCostEstimate: durationSec * 0.001 },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to end call" });
    }
  });

  // ============= CREDIT DEDUCTION =============

  app.post("/api/credits/deduct", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { amount, description } = req.body;
      const result = await storage.deductCredits(req.user!.tenantId, amount, description);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to deduct credits" });
    }
  });

  app.get("/api/credits/balance", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const wallet = await storage.getWallet(req.user!.tenantId);
      res.json({ 
        balance: wallet?.creditsBalance || 0, 
        usedThisMonth: wallet?.creditsUsedThisMonth || 0 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get balance" });
    }
  });

  // ============= WEBHOOKS =============

  app.post("/webhooks/signalwire", async (req: Request, res: Response) => {
    try {
      const { CallSid, CallStatus, CallDuration, To, From } = req.body;
      
      const call = await storage.getCallByProviderRef(CallSid);
      if (call) {
        let status: "COMPLETED" | "FAILED" | "BUSY" | "NO_ANSWER" = "COMPLETED";
        if (CallStatus === "failed") status = "FAILED";
        if (CallStatus === "busy") status = "BUSY";
        if (CallStatus === "no-answer") status = "NO_ANSWER";
        
        const durationSec = parseInt(CallDuration) || 0;
        const creditsToDeduct = Math.ceil(durationSec / 60) * 2;

        if (status === "COMPLETED" && durationSec > 0) {
          await storage.deductCredits(call.tenantId, creditsToDeduct, `Voice call to ${To}: ${durationSec}s`);
        }

        await storage.updateCall(call.id, {
          status,
          endedAt: Date.now(),
          durationSec,
          usage: { creditsDeducted: creditsToDeduct, telephonyCostEstimate: durationSec * 0.001 },
        });
      }

      res.status(200).send("");
    } catch (error) {
      console.error("SignalWire webhook error:", error);
      res.status(200).send("");
    }
  });

  app.post("/webhooks/signalwire/voice", async (req: Request, res: Response) => {
    try {
      res.type("text/xml");
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Connect>
            <Stream url="wss://${req.headers.host}/ws/call-audio" />
          </Connect>
        </Response>`);
    } catch (error) {
      console.error("SignalWire voice webhook error:", error);
      res.status(500).send("");
    }
  });

  app.get("/webhooks/whatsapp", async (req: Request, res: Response) => {
    try {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        res.status(200).send(challenge);
      } else {
        res.status(403).send("Forbidden");
      }
    } catch (error) {
      res.status(500).send("Error");
    }
  });

  app.post("/webhooks/whatsapp", async (req: Request, res: Response) => {
    try {
      const entry = req.body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      
      if (value?.messages?.[0]) {
        const message = value.messages[0];
        const contact = value.contacts?.[0];
        const fromPhone = message.from;
        const text = message.text?.body || "";
        const userName = contact?.profile?.name || "Unknown";

        const tenants = await storage.getAllTenants();
        for (const tenant of tenants) {
          const connection = await storage.getWAConnection(tenant.id);
          if (connection?.status === "CONNECTED") {
            let conversation = await storage.getWAConversationByPhone(tenant.id, fromPhone);
            
            if (!conversation) {
              conversation = await storage.createWAConversation({
                tenantId: tenant.id,
                userPhone: fromPhone,
                userName,
                status: "OPEN",
                lastMessageAt: Date.now(),
                aiMode: true,
                humanTakeover: false,
                tags: [],
                conversationWindowStart: Date.now(),
                creditsDeductedThisWindow: 0,
              });
            }

            await storage.createWAMessage({
              conversationId: conversation.id,
              tenantId: tenant.id,
              from: "USER",
              text,
              timestamp: Date.now(),
              deliveryStatus: "DELIVERED",
            });

            await storage.updateWAConversation(conversation.id, { lastMessageAt: Date.now() });

            await storage.deductCredits(tenant.id, 1, `WhatsApp message from ${fromPhone}`);
            break;
          }
        }
      }

      res.status(200).send("EVENT_RECEIVED");
    } catch (error) {
      console.error("WhatsApp webhook error:", error);
      res.status(200).send("EVENT_RECEIVED");
    }
  });

  app.post("/webhooks/razorpay", async (req: Request, res: Response) => {
    try {
      const signature = req.headers["x-razorpay-signature"] as string;
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
      
      const payload = JSON.stringify(req.body);
      const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      
      if (signature !== expectedSig && secret) {
        return res.status(401).json({ error: "Invalid signature" });
      }

      const event = req.body.event;
      const payment = req.body.payload?.payment?.entity;
      const subscription = req.body.payload?.subscription?.entity;

      if (event === "payment.captured" && payment) {
        const notes = payment.notes || {};
        const tenantId = notes.tenantId;
        const credits = parseInt(notes.credits) || 0;

        if (tenantId && credits > 0) {
          const wallet = await storage.getWallet(tenantId);
          if (wallet) {
            await storage.updateWallet(tenantId, {
              creditsBalance: wallet.creditsBalance + credits,
            });

            await storage.createTransaction({
              tenantId,
              type: "TOPUP",
              creditsDelta: credits,
              amount: payment.amount / 100,
              currency: payment.currency,
              provider: "razorpay",
              providerRef: payment.id,
              description: `Credit top-up: ${credits} credits`,
            });
          }
        }
      }

      if (event === "subscription.activated" && subscription) {
        const notes = subscription.notes || {};
        const tenantId = notes.tenantId;
        const planId = notes.planId;

        if (tenantId && planId) {
          await storage.updateTenant(tenantId, { 
            planId, 
            status: "ACTIVE",
          });
        }
      }

      res.status(200).json({ status: "ok" });
    } catch (error) {
      console.error("Razorpay webhook error:", error);
      res.status(200).json({ status: "ok" });
    }
  });

  // ============= SUBSCRIPTION ENDPOINTS =============

  app.post("/api/billing/subscribe", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { planId } = req.body;
      
      if (!PLANS[planId as keyof typeof PLANS]) {
        return res.status(400).json({ error: "Invalid plan" });
      }

      res.json({ 
        message: "Subscription endpoint ready",
        planId,
        note: "Razorpay integration requires API keys to be configured"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create subscription" });
    }
  });

  app.post("/api/billing/create-topup-order", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { optionId } = req.body;
      
      const option = TOPUP_OPTIONS.find(o => o.credits === parseInt(optionId));
      if (!option) {
        return res.status(400).json({ error: "Invalid top-up option" });
      }

      res.json({
        orderId: `order_${Date.now()}`,
        amount: option.priceINR,
        credits: option.credits,
        currency: "INR",
        note: "Razorpay integration requires API keys to be configured"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  return httpServer;
}
