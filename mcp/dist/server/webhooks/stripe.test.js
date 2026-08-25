import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleStripeWebhook } from './stripe';
import * as db from '../db';
// Mock DB helpers
vi.mock('../db', () => ({
    logActivity: vi.fn(),
    logAutomationAudit: vi.fn(),
    recordRevenue: vi.fn(),
    upsertStripeSubscription: vi.fn(),
    setSubscriptionStatusByStripeId: vi.fn(),
    getSubscriptionByStripeSubscriptionId: vi.fn(),
    createSystemNotification: vi.fn(),
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
describe('Stripe Webhook Idempotency', () => {
    const mockEvent = {
        id: 'evt_123',
        type: 'customer.subscription.created',
        data: { object: { id: 'sub_123', customer: 'cus_123', status: 'active', items: { data: [] } } },
    };
    const mockRawBody = Buffer.from(JSON.stringify(mockEvent));
    const mockSig = 'signature';
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
        mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
    });
    it('should process the event on the first call and ignore the second call', async () => {
        // 1. First call: claim succeeds
        vi.mocked(db.claimWebhookEvent).mockResolvedValue({ id: 1 });
        const result1 = await handleStripeWebhook(mockRawBody, mockSig);
        expect(result1.duplicate).toBeUndefined();
        expect(db.claimWebhookEvent).toHaveBeenCalled();
        // 2. Second call: claim fails (duplicate)
        vi.mocked(db.claimWebhookEvent).mockResolvedValue(null);
        const result2 = await handleStripeWebhook(mockRawBody, mockSig);
        expect(result2.duplicate).toBe(true);
        expect(db.markWebhookEventProcessed).toHaveBeenCalledTimes(1); // Only for the first call
    });
});
