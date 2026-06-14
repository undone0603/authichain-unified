import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock referral/core direct DB calls ───────────────────────────────────────
vi.mock("./referral/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./referral/core")>();
  return {
    ...actual,
    trackReferralClick: vi.fn(async () => undefined),
    getReferralStats: vi.fn(async () => ({
      totalReferrals: 0, convertedReferrals: 0, pendingReferrals: 0,
      totalCommission: 0, conversionRate: 0,
    })),
  };
});

// ─── Mock marketplace/db direct DB calls ─────────────────────────────────────
vi.mock("./marketplace/db", async () => ({
  listModels: vi.fn(async () => []),
  getModelById: vi.fn(async () => undefined),
  createModel: vi.fn(async () => ({ id: 1 })),
  purchaseModel: vi.fn(async () => ({ id: 1 })),
  getUserPurchases: vi.fn(async () => []),
  addReview: vi.fn(async () => ({ id: 1 })),
  getModelReviews: vi.fn(async () => []),
}));

// ─── Mock db module (Drizzle proxy) for bonuses direct db usage ───────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const mockDrizzle: any = {
    select: () => ({ from: () => ({ where: () => [], orderBy: () => [], limit: () => [] }) }),
    insert: () => ({ values: () => [{ insertId: 1 }] }),
    update: () => ({ set: () => ({ where: () => undefined }) }),
    delete: () => ({ where: () => undefined }),
  };
  return {
    ...actual,
    db: mockDrizzle,
    getReferralByCode: async () => undefined,
    getUserReferrals: async () => [],
    getAffiliateByUserId: async () => undefined,
    getUserReferralCommissions: async () => [],
  };
});

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@authichain.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    stripeCustomerId: null,
    walletAddress: null,
    avatarUrl: null,
    company: null,
    title: null,
    phone: null,
    onboardingCompleted: 0,
    paddleCustomerId: null,
    points: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("New Modularized Routers (dev branch merge)", () => {
  // ── Referral Router ──────────────────────────────────────────────────
  describe("referral", () => {
    it("requires auth for generateCode", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.referral.generateCode()).rejects.toThrow();
    });

    it("requires auth for getStats", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.referral.getStats()).rejects.toThrow();
    });

    it("requires auth for getHistory", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.referral.getHistory()).rejects.toThrow();
    });

    it("validate is public and returns invalid for non-existent code", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.referral.validate({ code: "FAKE-CODE-999" });
      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
    });

    it("trackClick is public", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.referral.trackClick({
        referralCode: "TEST-CODE",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      });
      expect(result).toEqual({ success: true });
    });

    it("getHistory returns array for authenticated user", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.referral.getHistory();
      expect(Array.isArray(result)).toBe(true);
    });

    it("getStats returns stats for authenticated user", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const stats = await caller.referral.getStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty("totalReferrals");
      expect(stats).toHaveProperty("convertedReferrals");
      expect(stats).toHaveProperty("conversionRate");
    });
  });

  // ── Affiliate Router ─────────────────────────────────────────────────
  describe("affiliate", () => {
    it("requires auth for getStatus", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.affiliate.getStatus()).rejects.toThrow();
    });

    it("requires auth for getStats", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.affiliate.getStats()).rejects.toThrow();
    });

    it("getStatus returns null/undefined or profile for authenticated user", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.affiliate.getStatus();
      // New user should have no affiliate profile yet
      expect(result == null || typeof result === "object").toBe(true);
    });

    it("getReferrals returns array for authenticated user", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.affiliate.getReferrals();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ── Bonuses Router ───────────────────────────────────────────────────
  describe("bonuses", () => {
    it("requires auth for getUserBonuses", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.bonuses.getUserBonuses()).rejects.toThrow();
    });

    it("getUserBonuses returns array for authenticated user", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.bonuses.getUserBonuses();
      expect(Array.isArray(result)).toBe(true);
    });

    it("requires admin for createUserBonuses", async () => {
      const caller = appRouter.createCaller(createAuthContext("user"));
      await expect(
        caller.bonuses.createUserBonuses({
          userId: 1,
          bonusType: "signup",
          bonusName: "Welcome Bonus",
          bonusValue: 100,
        })
      ).rejects.toThrow();
    });
  });

  // ── Marketplace Router ───────────────────────────────────────────────
  describe("marketplace", () => {
    it("listModels is public", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.marketplace.listModels({});
      expect(Array.isArray(result)).toBe(true);
    });

    it("requires auth for myPurchases", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.marketplace.myPurchases()).rejects.toThrow();
    });

    it("myPurchases returns array for authenticated user", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.marketplace.myPurchases();
      expect(Array.isArray(result)).toBe(true);
    });

    it("getReviews is public", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.marketplace.getReviews({ modelId: 1 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("requires admin for createModel", async () => {
      const caller = appRouter.createCaller(createAuthContext("user"));
      await expect(
        caller.marketplace.createModel({
          name: "Test Model",
          price: 100,
        })
      ).rejects.toThrow();
    });
  });
});
