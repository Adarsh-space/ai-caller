/**
 * Razorpay Integration - Payment Processing
 * Handles subscriptions, one-time payments, and webhooks
 */

import crypto from "crypto";
import { EventEmitter } from "events";

const config = {
  keyId: process.env.RAZORPAY_KEY_ID || "",
  keySecret: process.env.RAZORPAY_KEY_SECRET || "",
};

export interface PlanConfig {
  planId: string;
  name: string;
  priceINR: number; // In rupees
  credits: number;
  interval: "monthly" | "yearly";
}

// Pre-configured plans
export const PLANS: Record<string, PlanConfig> = {
  STARTER: {
    planId: "STARTER",
    name: "Starter",
    priceINR: 1999,
    credits: 2000,
    interval: "monthly",
  },
  GROWTH: {
    planId: "GROWTH",
    name: "Growth",
    priceINR: 4999,
    credits: 5000,
    interval: "monthly",
  },
  BUSINESS: {
    planId: "BUSINESS",
    name: "Business",
    priceINR: 8999,
    credits: 9000,
    interval: "monthly",
  },
};

// Top-up options
export const TOPUP_OPTIONS = [
  { credits: 500, priceINR: 500 },
  { credits: 1000, priceINR: 900 },
  { credits: 2500, priceINR: 2000 },
  { credits: 5000, priceINR: 3500 },
];

export interface Customer {
  id: string;
  name: string;
  email: string;
  contact: string;
  gstin?: string;
}

export interface OrderResult {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  notes: Record<string, string>;
}

export interface SubscriptionResult {
  subscriptionId: string;
  planId: string;
  status: string;
  shortUrl: string;
  keyId: string;
}

export interface WebhookEvent {
  event: string;
  payload: {
    payment?: { entity: PaymentEntity };
    subscription?: { entity: SubscriptionEntity };
    order?: { entity: OrderEntity };
  };
}

export interface PaymentEntity {
  id: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  invoice_id?: string;
  method: string;
  captured: boolean;
  email: string;
  contact: string;
  notes: Record<string, string>;
  created_at: number;
}

export interface SubscriptionEntity {
  id: string;
  plan_id: string;
  status: string;
  current_start: number;
  current_end: number;
  charge_at: number;
  total_count: number;
  paid_count: number;
  customer_id: string;
  notes: Record<string, string>;
}

export interface OrderEntity {
  id: string;
  amount: number;
  currency: string;
  status: string;
  notes: Record<string, string>;
}

class RazorpayClient extends EventEmitter {
  private baseUrl = "https://api.razorpay.com/v1";
  private razorpayPlanIds: Map<string, string> = new Map(); // Maps our plan IDs to Razorpay plan IDs

  isConfigured(): boolean {
    return !!(config.keyId && config.keySecret);
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
    return `Basic ${credentials}`;
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("Razorpay not configured. Please provide API credentials.");
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Razorpay API error: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Create or get a Razorpay plan for subscriptions
   */
  async getOrCreatePlan(planConfig: PlanConfig): Promise<string> {
    // Check cache first
    const cachedPlanId = this.razorpayPlanIds.get(planConfig.planId);
    if (cachedPlanId) return cachedPlanId;

    // Create new plan in Razorpay
    const data = await this.request("/plans", {
      method: "POST",
      body: JSON.stringify({
        period: planConfig.interval === "monthly" ? "monthly" : "yearly",
        interval: 1,
        item: {
          name: planConfig.name,
          amount: planConfig.priceINR * 100, // Convert to paise
          currency: "INR",
          description: `${planConfig.name} Plan - ${planConfig.credits} credits/month`,
        },
        notes: {
          planId: planConfig.planId,
          credits: String(planConfig.credits),
        },
      }),
    });

    this.razorpayPlanIds.set(planConfig.planId, data.id);
    return data.id;
  }

  /**
   * Create a customer in Razorpay
   */
  async createCustomer(customer: Omit<Customer, "id">): Promise<Customer> {
    const data = await this.request("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: customer.name,
        email: customer.email,
        contact: customer.contact,
        gstin: customer.gstin,
        fail_existing: "0", // Return existing customer if email matches
      }),
    });

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      contact: data.contact,
      gstin: data.gstin,
    };
  }

  /**
   * Create a subscription for a tenant
   */
  async createSubscription(
    tenantId: string,
    planId: string,
    customer: Omit<Customer, "id">
  ): Promise<SubscriptionResult> {
    const planConfig = PLANS[planId];
    if (!planConfig) {
      throw new Error(`Invalid plan ID: ${planId}`);
    }

    // Get or create Razorpay plan
    const razorpayPlanId = await this.getOrCreatePlan(planConfig);

    // Create customer
    const razorpayCustomer = await this.createCustomer(customer);

    // Create subscription
    const data = await this.request("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: razorpayPlanId,
        customer_id: razorpayCustomer.id,
        total_count: 120, // 10 years
        quantity: 1,
        customer_notify: 1,
        notes: {
          tenantId,
          planId,
          credits: String(planConfig.credits),
        },
      }),
    });

    return {
      subscriptionId: data.id,
      planId,
      status: data.status,
      shortUrl: data.short_url,
      keyId: config.keyId,
    };
  }

  /**
   * Create an order for one-time top-up payment
   */
  async createTopupOrder(tenantId: string, credits: number, amountINR: number): Promise<OrderResult> {
    const data = await this.request("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: amountINR * 100, // Convert to paise
        currency: "INR",
        receipt: `topup_${tenantId}_${Date.now()}`,
        notes: {
          tenantId,
          credits: String(credits),
          type: "topup",
        },
      }),
    });

    return {
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      keyId: config.keyId,
      notes: data.notes,
    };
  }

  /**
   * Verify Razorpay webhook signature
   */
  verifyWebhookSignature(body: string, signature: string, secret?: string): boolean {
    const webhookSecret = secret || config.keySecret;
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Verify payment signature (for frontend callback verification)
   */
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", config.keySecret)
      .update(body)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Process webhook event
   */
  processWebhook(event: WebhookEvent): {
    type: "subscription_activated" | "subscription_charged" | "subscription_cancelled" | "payment_captured" | "payment_failed" | "unknown";
    tenantId?: string;
    credits?: number;
    subscriptionId?: string;
    paymentId?: string;
    amount?: number;
  } {
    const eventType = event.event;

    switch (eventType) {
      case "subscription.activated": {
        const subscription = event.payload.subscription?.entity;
        if (!subscription) return { type: "unknown" };
        
        const tenantId = subscription.notes?.tenantId;
        const credits = parseInt(subscription.notes?.credits || "0", 10);
        
        this.emit("subscriptionActivated", { tenantId, subscriptionId: subscription.id, credits });
        return {
          type: "subscription_activated",
          tenantId,
          credits,
          subscriptionId: subscription.id,
        };
      }

      case "subscription.charged":
      case "invoice.paid": {
        const subscription = event.payload.subscription?.entity;
        const payment = event.payload.payment?.entity;
        
        const tenantId = subscription?.notes?.tenantId || payment?.notes?.tenantId;
        const credits = parseInt(subscription?.notes?.credits || payment?.notes?.credits || "0", 10);
        
        this.emit("subscriptionCharged", { tenantId, credits, paymentId: payment?.id });
        return {
          type: "subscription_charged",
          tenantId,
          credits,
          subscriptionId: subscription?.id,
          paymentId: payment?.id,
          amount: payment?.amount,
        };
      }

      case "subscription.cancelled": {
        const subscription = event.payload.subscription?.entity;
        const tenantId = subscription?.notes?.tenantId;
        
        this.emit("subscriptionCancelled", { tenantId, subscriptionId: subscription?.id });
        return {
          type: "subscription_cancelled",
          tenantId,
          subscriptionId: subscription?.id,
        };
      }

      case "payment.captured": {
        const payment = event.payload.payment?.entity;
        if (!payment) return { type: "unknown" };
        
        const tenantId = payment.notes?.tenantId;
        const credits = parseInt(payment.notes?.credits || "0", 10);
        const isTopup = payment.notes?.type === "topup";
        
        if (isTopup && credits > 0) {
          this.emit("topupCaptured", { tenantId, credits, paymentId: payment.id, amount: payment.amount });
        }
        
        return {
          type: "payment_captured",
          tenantId,
          credits: isTopup ? credits : undefined,
          paymentId: payment.id,
          amount: payment.amount,
        };
      }

      case "payment.failed": {
        const payment = event.payload.payment?.entity;
        const tenantId = payment?.notes?.tenantId;
        
        this.emit("paymentFailed", { tenantId, paymentId: payment?.id });
        return {
          type: "payment_failed",
          tenantId,
          paymentId: payment?.id,
        };
      }

      default:
        return { type: "unknown" };
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, cancelAtCycleEnd: boolean = true): Promise<void> {
    await this.request(`/subscriptions/${subscriptionId}/cancel`, {
      method: "POST",
      body: JSON.stringify({
        cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0,
      }),
    });
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<SubscriptionEntity> {
    return this.request(`/subscriptions/${subscriptionId}`);
  }

  /**
   * Capture a payment (for orders that need manual capture)
   */
  async capturePayment(paymentId: string, amount: number): Promise<PaymentEntity> {
    return this.request(`/payments/${paymentId}/capture`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  }

  /**
   * Get payment details
   */
  async getPayment(paymentId: string): Promise<PaymentEntity> {
    return this.request(`/payments/${paymentId}`);
  }

  /**
   * Issue a refund
   */
  async createRefund(
    paymentId: string,
    amount: number,
    reason: string
  ): Promise<{ refundId: string; status: string }> {
    const data = await this.request(`/payments/${paymentId}/refund`, {
      method: "POST",
      body: JSON.stringify({
        amount,
        notes: { reason },
      }),
    });

    return {
      refundId: data.id,
      status: data.status,
    };
  }

  /**
   * Get Razorpay key ID for frontend checkout
   */
  getKeyId(): string {
    return config.keyId;
  }
}

// Export singleton instance
export const razorpay = new RazorpayClient();
