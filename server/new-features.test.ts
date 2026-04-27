import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Shared in-memory store ───────────────────────────────────────────────────
const store = vi.hoisted(() => {
  let seq = 200;
  const bonuses: any[] = [];
  return {
    bonuses,
    nextId: () => ++seq,
    reset: () => { bonuses.length = 0; seq = 200; },
  };
});

// ─── Stable mock function refs (vi.hoisted ensures same identity in factory & tests) ───
const dbMocks = vi.hoisted(() => ({
  getUserReferrals: vi.fn(async () => [] as any[]),
  getReferralByCode: vi.fn(async () => undefined as any),
  createReferral: vi.fn(async () => ({ id: 201 })),
  getAffiliateByUserId: vi.fn(async () => undefined as any),
  createAffiliate: vi.fn(async (_data: any) => ({ id: 202 })),
  getAffiliateCommissions: vi.fn(async () => [] as any[]),
  getPendingDrafts: vi.fn(async () => [] as any[]),
  createEmailDraft: vi.fn(async () => ({ id: 203 })),
  updateDraftStatus: vi.fn(async () => undefined as any),
  sendApprovalEmail: vi.fn(async () => undefined as any),
  getUserSubscription: vi.fn(async () => null as any),
}));

// ─── Mock ./db ────────────────────────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();

  // Minimal chainable db proxy so bonuses/marketplace code doesn't throw
  const mockDb: any = {
    select: () => ({
      from: (_table: any) => ({
        where: () => ({
          // Always return the first stored bonus (empty when store is reset)
          limit: () => store.bonuses.slice(0, 1),
        }),
        orderBy: () => [],
      }),
    }),
    insert: (_table: any) => ({
      values: (data: any) => {
        const id = store.nextId();
        store.bonuses.push({ ...data, id });
        const result = [{ ...data, id, insertId: id }];
        return { returning: () => result, then: (fn: any) => fn(result) };
      },
    }),
    update: () => ({ set: () => ({ where: () => undefined }) }),
  };

  return {
    ...actual,
    db: mockDb,
    // Use stable hoisted refs so test assertions see the same function the router calls
    ...dbMocks,
    // createReferral and createAffiliate need store.nextId, override with store-aware fns
    createReferral: vi.fn(async () => ({ id: store.nextId() })),
    createAffiliate: vi.fn(async (_data: any) => ({ id: store.nextId() })),
    createEmailDraft: vi.fn(async () => ({ id: store.nextId() })),
  };
});

// ─── Mock ./referral/core ─────────────────────────────────────────────────────
vi.mock("./referral/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./referral/core")>();
  return {
    ...actual, // keeps COMMISSION_RATES, AFFILIATE_BONUS_TIERS, generateReferralCode, generateAffiliateCode
    createReferralCode: vi.fn(async (referrerId: number) => ({
      id: 300 + referrerId,
      referralCode: `REF-${referrerId}-TESTXX`,
    })),
    trackReferralClick: vi.fn(async () => undefined),
    completeReferral: vi.fn(async () => undefined),
    getReferralStats: vi.fn(async () => ({
      totalReferrals: 5,
      convertedReferrals: 2,
      pendingReferrals: 3,
      totalCommission: 30.0,
      conversionRate: 40,
    })),
  };
});

// ─── Mock ./marketplace/db ────────────────────────────────────────────────────
vi.mock("./marketplace/db", async () => ({
  listModels: vi.fn(async () => [
    { id: 1, name: "Authenticator Pro", category: "vision", price: 1999, status: "active", downloads: 42, rating: "4.80", reviewCount: 10, creatorId: 99 },
    { id: 2, name: "Chain Verifier",    category: "nlp",    price: 999,  status: "active", downloads: 18, rating: "4.20", reviewCount: 5,  creatorId: 99 },
  ]),
  getModelById: vi.fn(async (id: number) =>
    id === 1
      ? { id: 1, name: "Authenticator Pro", price: 1999, status: "active", creatorId: 99 }
      : undefined
  ),
  createModel:    vi.fn(async () => ({ id: 500 })),
  purchaseModel:  vi.fn(async () => ({ id: 600 })),
  getUserPurchases: vi.fn(async () => []),
  addReview:      vi.fn(async () => ({ id: 700 })),
  getModelReviews: vi.fn(async () => [
    { id: 1, modelId: 1, userId: 5, rating: 5, review: "Excellent!", createdAt: new Date() },
  ]),
}));

// ─── Mock ./email/smtp ────────────────────────────────────────────────────────
vi.mock("./email/smtp", async () => ({
  sendEmail:               vi.fn(async () => undefined),
  sendBulkEmails:          vi.fn(async () => ({ sent: 0, failed: 0 })),
  replaceTemplateVariables: (t: string) => t,
  textToHtml:              (t: string) => `<p>${t}</p>`,
  sendSequenceEmail:       vi.fn(async () => undefined),
  verifySMTPConfig:        vi.fn(async () => true),
}));

// ─── Context helpers ──────────────────────────────────────────────────────────
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1, openId: "test-user-001", email: "test@authichain.com",
    name: "Test User", loginMethod: "manus", role, stripeCustomerId: null,
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("New Features", () => {
  beforeEach(() => {
    store.reset();
    vi.clearAllMocks();
  });

  // ── Referral router ─────────────────────────────────────────────────────────
  describe("referral router", () => {
    describe("public endpoints", () => {
      it("referral.validate is public and returns invalid for unknown code", async () => {
        const result = await appRouter.createCaller(createPublicContext()).referral.validate({ code: "BOGUS-123" });
        expect(result.valid).toBe(false);
        expect(result.referral).toBeUndefined();
      });

      it("referral.trackClick is public and returns success", async () => {
        const result = await appRouter.createCaller(createPublicContext()).referral.trackClick({ referralCode: "REF-1-ABC", landingPage: "/signup" });
        expect(result).toEqual({ success: true });
      });
    });

    describe("auth guards", () => {
      it("referral.generateCode requires auth", async () => {
        await expect(appRouter.createCaller(createPublicContext()).referral.generateCode()).rejects.toThrow();
      });
      it("referral.getHistory requires auth", async () => {
        await expect(appRouter.createCaller(createPublicContext()).referral.getHistory()).rejects.toThrow();
      });
      it("referral.getStats requires auth", async () => {
        await expect(appRouter.createCaller(createPublicContext()).referral.getStats()).rejects.toThrow();
      });
      it("referral.complete requires auth", async () => {
        await expect(appRouter.createCaller(createPublicContext()).referral.complete({ referralCode: "X", referredEmail: "a@b.com" })).rejects.toThrow();
      });
    });

    describe("authenticated operations", () => {
      it("referral.generateCode returns id and referralCode", async () => {
        const result = await appRouter.createCaller(createAuthContext()).referral.generateCode();
        expect(result).toHaveProperty("id");
        expect(result).toHaveProperty("referralCode");
        expect(result.referralCode).toMatch(/^REF-/);
      });

      it("referral.getHistory returns an array", async () => {
        const result = await appRouter.createCaller(createAuthContext()).referral.getHistory();
        expect(Array.isArray(result)).toBe(true);
      });

      it("referral.getStats returns correct shape", async () => {
        const result = await appRouter.createCaller(createAuthContext()).referral.getStats();
        expect(result).toHaveProperty("totalReferrals");
        expect(result).toHaveProperty("convertedReferrals");
        expect(result).toHaveProperty("pendingReferrals");
        expect(result).toHaveProperty("totalCommission");
        expect(result).toHaveProperty("conversionRate");
        expect(result.totalReferrals).toBe(5);
        expect(result.conversionRate).toBe(40);
      });

      it("referral.complete returns success", async () => {
        const result = await appRouter.createCaller(createAuthContext()).referral.complete({
          referralCode: "REF-9-ABCDEF",
          referredEmail: "referred@example.com",
          tier: "professional",
        });
        expect(result.success).toBe(true);
      });
    });
  });

  // ── Affiliate router ────────────────────────────────────────────────────────
  describe("affiliate router", () => {
    describe("auth guards", () => {
      it("affiliate.getStatus requires auth",      async () => { await expect(appRouter.createCaller(createPublicContext()).affiliate.getStatus()).rejects.toThrow(); });
      it("affiliate.getStats requires auth",       async () => { await expect(appRouter.createCaller(createPublicContext()).affiliate.getStats()).rejects.toThrow(); });
      it("affiliate.submitApplication requires auth", async () => { await expect(appRouter.createCaller(createPublicContext()).affiliate.submitApplication({})).rejects.toThrow(); });
      it("affiliate.getReferrals requires auth",   async () => { await expect(appRouter.createCaller(createPublicContext()).affiliate.getReferrals()).rejects.toThrow(); });
    });

    describe("authenticated operations", () => {
      it("affiliate.getStatus returns undefined when not enrolled", async () => {
        const result = await appRouter.createCaller(createAuthContext()).affiliate.getStatus();
        expect(result == null).toBe(true);
      });

      it("affiliate.getStats returns null when not enrolled", async () => {
        const result = await appRouter.createCaller(createAuthContext()).affiliate.getStats();
        expect(result).toBeNull();
      });

      it("affiliate.getReferrals returns array", async () => {
        const result = await appRouter.createCaller(createAuthContext()).affiliate.getReferrals();
        expect(Array.isArray(result)).toBe(true);
      });

      it("affiliate.submitApplication creates affiliate for new user", async () => {
        const result = await appRouter.createCaller(createAuthContext()).affiliate.submitApplication({ paypalEmail: "user@paypal.com" });
        expect(result.success).toBe(true);
        expect((result as any).affiliateCode).toMatch(/^AFF-/);
        expect((result as any).id).toBeDefined();
      });

      it("affiliate.submitApplication reports already-enrolled when affiliate exists", async () => {
        const { getAffiliateByUserId } = await import("./db");
        vi.mocked(getAffiliateByUserId).mockResolvedValueOnce({
          id: 10, userId: 1, affiliateCode: "AFF-1-EXISTING", status: "active",
          commissionRate: "10.00", totalEarnings: "0", pendingPayout: "0",
          totalReferrals: 0, totalConversions: 0, payoutMethod: null, payoutDetails: null,
          createdAt: new Date(), updatedAt: new Date(),
          tier: "basic" as any, activeReferrals: 0, paypalEmail: null,
        });
        const result = await appRouter.createCaller(createAuthContext()).affiliate.submitApplication({});
        expect(result.success).toBe(false);
        expect((result as any).message).toMatch(/already/i);
      });

      it("affiliate.getStats returns stats object when enrolled", async () => {
        const { getAffiliateByUserId, getAffiliateCommissions } = await import("./db");
        vi.mocked(getAffiliateByUserId).mockResolvedValueOnce({
          id: 10, userId: 1, affiliateCode: "AFF-1-GOLD", status: "active",
          commissionRate: "15.00", totalEarnings: "250.00", pendingPayout: "50.00",
          totalReferrals: 12, totalConversions: 5, payoutMethod: "paypal", payoutDetails: null,
          createdAt: new Date(), updatedAt: new Date(),
          tier: "gold" as any, activeReferrals: 3, paypalEmail: "gold@paypal.com",
        });
        vi.mocked(getAffiliateCommissions).mockResolvedValueOnce([
          { id: 1, affiliateId: 10, paymentId: null, amount: "50.00", status: "pending", paidAt: null, createdAt: new Date() },
        ]);
        const result = await appRouter.createCaller(createAuthContext()).affiliate.getStats();
        expect(result).not.toBeNull();
        expect(result!.totalEarned).toBe(250);
        expect(result!.commissions).toHaveLength(1);
        expect(result!.affiliate.affiliateCode).toBe("AFF-1-GOLD");
      });
    });
  });

  // ── Bonuses router ──────────────────────────────────────────────────────────
  describe("bonuses router", () => {
    describe("auth / admin guards", () => {
      it("bonuses.getUserBonuses requires auth", async () => {
        await expect(appRouter.createCaller(createPublicContext()).bonuses.getUserBonuses()).rejects.toThrow();
      });
      it("bonuses.claimBonus requires auth", async () => {
        await expect(appRouter.createCaller(createPublicContext()).bonuses.claimBonus({ bonusId: 1 })).rejects.toThrow();
      });
      it("bonuses.createUserBonuses requires admin", async () => {
        await expect(appRouter.createCaller(createAuthContext("user")).bonuses.createUserBonuses({
          userId: 2, bonusType: "referral", bonusName: "Bonus", bonusValue: 1000,
        })).rejects.toThrow();
      });
    });

    describe("authenticated operations", () => {
      it("bonuses.claimBonus throws for non-existent bonus", async () => {
        // mock returns [] so bonus is undefined → "Bonus not found"
        await expect(appRouter.createCaller(createAuthContext()).bonuses.claimBonus({ bonusId: 99999 })).rejects.toThrow("Bonus not found");
      });

      it("bonuses.createUserBonuses returns id for admin", async () => {
        const result = await appRouter.createCaller(createAuthContext("admin")).bonuses.createUserBonuses({
          userId: 2, bonusType: "milestone", bonusName: "10 Referrals", bonusValue: 2500, tier: "professional",
        });
        expect(result).toHaveProperty("id");
        expect(typeof result.id).toBe("number");
      });
    });
  });

  // ── Marketplace router ──────────────────────────────────────────────────────
  describe("marketplace router", () => {
    describe("public endpoints", () => {
      it("marketplace.listModels returns array with correct shape", async () => {
        const result = await appRouter.createCaller(createPublicContext()).marketplace.listModels({});
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty("name", "Authenticator Pro");
        expect(result[0]).toHaveProperty("price");
        expect(result[0]).toHaveProperty("rating");
      });

      it("marketplace.listModels supports limit and category", async () => {
        const result = await appRouter.createCaller(createPublicContext()).marketplace.listModels({ category: "vision", limit: 5 });
        expect(Array.isArray(result)).toBe(true);
      });

      it("marketplace.getModel returns model for id=1", async () => {
        const result = await appRouter.createCaller(createPublicContext()).marketplace.getModel({ id: 1 });
        expect(result).toBeDefined();
        expect(result?.name).toBe("Authenticator Pro");
      });

      it("marketplace.getModel returns undefined for unknown id", async () => {
        const result = await appRouter.createCaller(createPublicContext()).marketplace.getModel({ id: 99999 });
        expect(result).toBeUndefined();
      });

      it("marketplace.getReviews returns array", async () => {
        const result = await appRouter.createCaller(createPublicContext()).marketplace.getReviews({ modelId: 1 });
        expect(Array.isArray(result)).toBe(true);
        expect(result[0]).toHaveProperty("rating", 5);
      });
    });

    describe("auth / admin guards", () => {
      it("marketplace.createModel requires admin", async () => {
        await expect(appRouter.createCaller(createAuthContext("user")).marketplace.createModel({ name: "X", price: 0 })).rejects.toThrow();
      });
      it("marketplace.purchaseModel requires auth", async () => {
        await expect(appRouter.createCaller(createPublicContext()).marketplace.purchaseModel({ modelId: 1 })).rejects.toThrow();
      });
      it("marketplace.myPurchases requires auth", async () => {
        await expect(appRouter.createCaller(createPublicContext()).marketplace.myPurchases()).rejects.toThrow();
      });
      it("marketplace.addReview requires auth", async () => {
        await expect(appRouter.createCaller(createPublicContext()).marketplace.addReview({ modelId: 1, rating: 5 })).rejects.toThrow();
      });
    });

    describe("authenticated operations", () => {
      it("marketplace.createModel returns id for admin", async () => {
        const result = await appRouter.createCaller(createAuthContext("admin")).marketplace.createModel({
          name: "New Vision Model", price: 2999, category: "vision", description: "Detects counterfeits",
        });
        expect(result).toHaveProperty("id", 500);
      });

      it("marketplace.purchaseModel returns id for known model", async () => {
        const result = await appRouter.createCaller(createAuthContext()).marketplace.purchaseModel({ modelId: 1 });
        expect(result).toHaveProperty("id", 600);
      });

      it("marketplace.purchaseModel throws for unknown model", async () => {
        const { getModelById } = await import("./marketplace/db");
        vi.mocked(getModelById).mockResolvedValueOnce(undefined);
        await expect(appRouter.createCaller(createAuthContext()).marketplace.purchaseModel({ modelId: 99999 })).rejects.toThrow("Model not found");
      });

      it("marketplace.myPurchases returns array", async () => {
        const result = await appRouter.createCaller(createAuthContext()).marketplace.myPurchases();
        expect(Array.isArray(result)).toBe(true);
      });

      it("marketplace.addReview returns id", async () => {
        const result = await appRouter.createCaller(createAuthContext()).marketplace.addReview({ modelId: 1, rating: 4, review: "Very useful" });
        expect(result).toHaveProperty("id", 700);
      });
    });
  });

  // ── Email drafts router ─────────────────────────────────────────────────────
  describe("emailDrafts router", () => {
    describe("auth guards", () => {
      it("emailDrafts.listPending requires auth", async () => {
        await expect(appRouter.createCaller(createPublicContext()).emailDrafts.listPending()).rejects.toThrow();
      });
      it("emailDrafts.create requires auth", async () => {
        await expect(appRouter.createCaller(createPublicContext()).emailDrafts.create({
          prospectEmail: "x@x.com", subject: "Hi", body: "Hello",
        })).rejects.toThrow();
      });
      it("emailDrafts.approve requires auth", async () => {
        await expect(appRouter.createCaller(createPublicContext()).emailDrafts.approve({ id: 1 })).rejects.toThrow();
      });
      it("emailDrafts.reject requires auth", async () => {
        await expect(appRouter.createCaller(createPublicContext()).emailDrafts.reject({ id: 1 })).rejects.toThrow();
      });
    });

    describe("authenticated operations", () => {
      it("emailDrafts.listPending returns array", async () => {
        const result = await appRouter.createCaller(createAuthContext()).emailDrafts.listPending();
        expect(Array.isArray(result)).toBe(true);
      });

      it("emailDrafts.create returns draft id", async () => {
        const result = await appRouter.createCaller(createAuthContext()).emailDrafts.create({
          prospectEmail: "ceo@bigco.com",
          prospectName: "Big CEO",
          prospectCompany: "BigCo",
          subject: "AuthiChain for BigCo",
          body: "<p>Hello, let's talk about authentication...</p>",
        });
        expect(result).toHaveProperty("id");
      });

      it("emailDrafts.reject returns success", async () => {
        const result = await appRouter.createCaller(createAuthContext()).emailDrafts.reject({ id: 1, notes: "Off-topic" });
        expect(result).toEqual({ success: true });
      });

      it("emailDrafts.bulkApprove returns count matching input ids", async () => {
        const result = await appRouter.createCaller(createAuthContext()).emailDrafts.bulkApprove({ ids: [10, 11, 12] });
        expect(result.success).toBe(true);
        expect(result.count).toBe(3);
      });

      it("emailDrafts.approve does NOT send email when draft is not in pending list", async () => {
        // getPendingDrafts returns [] by default — draft 999 not found, no email sent
        await appRouter.createCaller(createAuthContext()).emailDrafts.approve({ id: 999 });
        const { sendEmail } = await import("./email/smtp");
        expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
      });

      it("emailDrafts.approve DOES send email when draft is in pending list", async () => {
        dbMocks.getPendingDrafts.mockResolvedValueOnce([{
          id: 42, prospectEmail: "lead@bigcorp.com", subject: "Our Partnership",
          body: "<p>Hello!</p>", prospectName: "Alice",
          prospectCompany: null, prospectTitle: null, industry: null,
          status: "pending", templateUsed: null, generatedBy: "ai_manager",
          approvedBy: null, approvedAt: null, sentAt: null, notes: null, createdAt: new Date(),
        }]);
        await appRouter.createCaller(createAuthContext()).emailDrafts.approve({ id: 42 });
        expect(dbMocks.getPendingDrafts).toHaveBeenCalled();
        expect(dbMocks.updateDraftStatus).toHaveBeenCalledWith(42, "approved", 1);
        expect(dbMocks.sendApprovalEmail).toHaveBeenCalledOnce();
        expect(dbMocks.sendApprovalEmail).toHaveBeenCalledWith(
          "lead@bigcorp.com",
          "Our Partnership",
          "<p>Hello!</p>",
        );
      });
    });
  });

  // ── Paddle checkout ─────────────────────────────────────────────────────────
  describe("subscription.createPaddleCheckout", () => {
    it("requires auth", async () => {
      await expect(appRouter.createCaller(createPublicContext()).subscription.createPaddleCheckout({
        plan: "starter", successUrl: "https://app.authichain.com/success",
      })).rejects.toThrow();
    });

    it("throws BAD_REQUEST when Paddle price env var not set", async () => {
      // Paddle price env vars are not configured in test env
      await expect(appRouter.createCaller(createAuthContext()).subscription.createPaddleCheckout({
        plan: "starter", billing: "monthly", successUrl: "https://app.authichain.com/success",
      })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  // ── referral/core pure helpers ───────────────────────────────────────────────
  describe("referral/core pure helpers", () => {
    it("COMMISSION_RATES has the four expected tiers", async () => {
      const { COMMISSION_RATES } = await import("./referral/core");
      expect(COMMISSION_RATES.starter).toBe(0.10);
      expect(COMMISSION_RATES.professional).toBe(0.15);
      expect(COMMISSION_RATES.enterprise).toBe(0.20);
      expect(COMMISSION_RATES.agency).toBe(0.25);
    });

    it("AFFILIATE_BONUS_TIERS is a non-empty array with correct shape", async () => {
      const { AFFILIATE_BONUS_TIERS } = await import("./referral/core");
      expect(Array.isArray(AFFILIATE_BONUS_TIERS)).toBe(true);
      expect(AFFILIATE_BONUS_TIERS.length).toBeGreaterThanOrEqual(3);
      for (const tier of AFFILIATE_BONUS_TIERS) {
        expect(tier).toHaveProperty("threshold");
        expect(tier).toHaveProperty("bonus");
        expect(tier).toHaveProperty("tier");
        expect(typeof tier.threshold).toBe("number");
        expect(typeof tier.bonus).toBe("number");
      }
    });

    it("AFFILIATE_BONUS_TIERS thresholds are ascending", async () => {
      const { AFFILIATE_BONUS_TIERS } = await import("./referral/core");
      for (let i = 1; i < AFFILIATE_BONUS_TIERS.length; i++) {
        expect(AFFILIATE_BONUS_TIERS[i].threshold).toBeGreaterThan(AFFILIATE_BONUS_TIERS[i - 1].threshold);
      }
    });

    it("generateReferralCode returns unique codes for different users", async () => {
      const { generateReferralCode } = await import("./referral/core");
      const c1 = generateReferralCode(1);
      const c2 = generateReferralCode(2);
      const c3 = generateReferralCode(1);
      expect(c1).toMatch(/^REF-1-/);
      expect(c2).toMatch(/^REF-2-/);
      expect(c1).not.toBe(c3); // nanoid ensures uniqueness
    });

    it("generateAffiliateCode returns unique codes with correct prefix", async () => {
      const { generateAffiliateCode } = await import("./referral/core");
      const c1 = generateAffiliateCode(7);
      const c2 = generateAffiliateCode(7);
      expect(c1).toMatch(/^AFF-7-/);
      expect(c2).toMatch(/^AFF-7-/);
      expect(c1).not.toBe(c2);
    });
  });
});
