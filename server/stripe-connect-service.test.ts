import { describe, expect, it, vi, beforeEach } from "vitest";
import * as stripeConnect from "./stripe-connect-service";
import { getStripe } from "./stripe-service";
import * as db from "./db";

// Mock stripe-service to control the Stripe instance
vi.mock("./stripe-service", () => ({
  getStripe: vi.fn(),
}));

// Mock db is already handled by test-setup.ts, but we can override if needed
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn(),
    logActivity: vi.fn(),
  };
});

describe("Stripe Connect Service (v2)", () => {
  let mockStripe: any;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStripe = {
      rawRequest: vi.fn(),
      checkout: {
        sessions: {
          create: vi.fn(),
        },
      },
      products: {
        create: vi.fn(),
      },
      setupIntents: {
        create: vi.fn(),
      },
      subscriptions: {
        create: vi.fn(),
      },
    };

    mockDb = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    };

    (getStripe as any).mockReturnValue(mockStripe);
    (db.getDb as any).mockResolvedValue(mockDb);
  });

  describe("provisionVendorAccount", () => {
    it("should create a v2 core account and persist the ID", async () => {
      const mockAccountId = "acct_123";
      mockStripe.rawRequest.mockResolvedValue({
        toJSON: () => ({ body: JSON.stringify({ id: mockAccountId }) })
      });
      mockDb.where.mockResolvedValue([{ insertId: 1 }]);

      const result = await stripeConnect.provisionVendorAccount(1, "Test account", "testaccount@example.com", "US");

      expect(mockStripe.rawRequest).toHaveBeenCalledWith("POST", "/v2/core/accounts",
        expect.objectContaining({
          display_name: "Test account",
          contact_email: "testaccount@example.com",
          identity: expect.objectContaining({ country: "US" }),
        }),
        expect.anything(),
      );
      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toBe(mockAccountId);
    });
  });

  describe("generateOnboardingLink", () => {
    it("should create an account link for onboarding", async () => {
      const mockUrl = "https://stripe.com/onboard/123";
      mockStripe.rawRequest.mockResolvedValue({
        toJSON: () => ({ body: JSON.stringify({ url: mockUrl }) })
      });

      const result = await stripeConnect.generateOnboardingLink("acct_123");

      expect(mockStripe.rawRequest).toHaveBeenCalledWith("POST", "/v2/core/account_links", expect.objectContaining({
        account: "acct_123",
        use_case: expect.objectContaining({ type: "account_onboarding" }),
      }));
      expect(result).toBe(mockUrl);
    });
  });

  describe("createVendorCheckoutSession", () => {
    it("should create a checkout session on behalf of a connected account", async () => {
      const mockUrl = "https://checkout.stripe.com/pay/123";
      mockStripe.checkout.sessions.create.mockResolvedValue({ url: mockUrl });

      const result = await stripeConnect.createVendorCheckoutSession("acct_123", "usd");

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "payment",
          line_items: [expect.objectContaining({ 
            price_data: expect.objectContaining({
               unit_amount: 100000 
            })
          })],
        }),
        expect.objectContaining({ stripeAccount: "acct_123" })
      );
      expect(result).toBe(mockUrl);
    });
  });

  describe("createPlatformSubscriptionPlan", () => {
    it("should create a product with default price data", async () => {
      const mockProduct = { id: "prod_123", default_price: "price_123" };
      mockStripe.products.create.mockResolvedValue(mockProduct);

      const result = await stripeConnect.createPlatformSubscriptionPlan("usd");

      expect(mockStripe.products.create).toHaveBeenCalledWith(expect.objectContaining({
        name: "Platform subscription",
        default_price_data: expect.objectContaining({ currency: "usd", unit_amount: 1000 }),
      }));
      expect(result).toEqual(mockProduct);
    });
  });

  describe("attachBalancePaymentMethod", () => {
    it("should create a SetupIntent for stripe_balance", async () => {
      const mockPM = "pm_123";
      mockStripe.setupIntents.create.mockResolvedValue({ payment_method: mockPM });

      const result = await stripeConnect.attachBalancePaymentMethod("acct_123");

      expect(mockStripe.setupIntents.create).toHaveBeenCalledWith(expect.objectContaining({
        payment_method_types: ["stripe_balance"],
        customer_account: "acct_123",
      }));
      expect(result).toBe(mockPM);
    });
  });

  describe("subscribeVendorToPlatform", () => {
    it("should create a subscription using the balance payment method", async () => {
      const mockSub = { id: "sub_123" };
      mockStripe.subscriptions.create.mockResolvedValue(mockSub);

      const result = await stripeConnect.subscribeVendorToPlatform("acct_123", "pm_123", "price_123");

      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // Stripe V2 (Dahlia) Connect uses customer_account + items, not customer
          customer_account: "acct_123",
          default_payment_method: "pm_123",
          items: [{ price: "price_123", quantity: 1 }],
          payment_settings: { payment_method_types: ["stripe_balance"] },
        }),
        expect.objectContaining({
          idempotencyKey: expect.any(String),
        }),
      );
      expect(result).toEqual(mockSub);
    });
  });
});
