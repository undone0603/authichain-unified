import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleStripeWebhook } from './stripe';
import * as db from '../db';
import Stripe from 'stripe';

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

vi.mock('../db', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
  logAutomationAudit: vi.fn().mockResolvedValue(undefined),
  recordRevenue: vi.fn().mockResolvedValue(undefined),
  upsertStripeSubscription: vi.fn().mockResolvedValue(undefined),
  setSubscriptionStatusByStripeId: vi.fn().mockResolvedValue(undefined),
  getSubscriptionByStripeSubscriptionId: vi.fn().mockResolvedValue(null),
  createSystemNotification: vi.fn().mockResolvedValue(undefined),
  claimWebhookEvent: vi.fn(),
  markWebhookEventProcessed: vi.fn(),
}));

// Setup Stripe mock
const mockStripe = {
  webhooks: {
    constructEvent: vi.fn(),
  },
  customers: {
    retrieve: vi.fn().mockResolvedValue({ id: 'cus_123', metadata: { user_id: '1' } }),
  },
};

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => mockStripe),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(type: string, id: string, data: object) {
  return { id, type, data: { object: data } };
}

const RAW_BODY = Buffer.from("{}");
const SIG = "stripe-sig";

describe('Stripe Webhook Idempotency & Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
  });

  it('should process the event on the first call and ignore the second call', async () => {
    const mockEvent = makeEvent('customer.subscription.created', 'evt_123', {
      id: 'sub_123',
      status: 'active',
      customer: 'cus_123',
      items: { data: [] },
    });
    mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

    // 1. First call: claim succeeds
    vi.mocked(db.claimWebhookEvent).mockResolvedValue({ id: 1 });
    
    const result1 = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result1.duplicate).toBeUndefined();
    expect(db.claimWebhookEvent).toHaveBeenCalled();

    // 2. Second call: claim fails (duplicate)
    vi.mocked(db.claimWebhookEvent).mockResolvedValue(null);
    
    const result2 = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result2.duplicate).toBe(true);
    expect(db.markWebhookEventProcessed).toHaveBeenCalledTimes(1); // Only for the first call
  });

  it("handles customer.subscription.created without throwing", async () => {
    const mockEvent = makeEvent("customer.subscription.created", "evt_sub_001", {
        id: "sub_abc",
        status: "active",
        customer: "cus_123",
        metadata: {},
        items: { data: [{ price: { id: "price_starter", unit_amount: 4900 } }] },
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
      });
    mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
    
    vi.mocked(db.claimWebhookEvent).mockResolvedValue({ id: 1 });
    
    const result = await handleStripeWebhook(RAW_BODY, SIG);
    expect(result.received).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
