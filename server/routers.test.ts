import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@authichain.com",
    name: "Test User",
    loginMethod: "manus",
    role,
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

describe("AuthiChain Unified Platform Routers", () => {
  describe("auth.me", () => {
    it("returns null for unauthenticated users", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).toBeNull();
    });

    it("returns user data for authenticated users", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).toBeDefined();
      expect(result?.openId).toBe("test-user-001");
      expect(result?.email).toBe("test@authichain.com");
      expect(result?.role).toBe("user");
    });
  });

  describe("auth.logout", () => {
    it("clears session and returns success", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.logout();
      expect(result).toEqual({ success: true });
    });
  });

  describe("certificates.verify (public)", () => {
    it("returns invalid for non-existent certificate", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.certificates.verify({ certificateNumber: "NONEXISTENT-CERT-123" });
      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
    });
  });

  describe("nft.list (public)", () => {
    it("returns an array of NFTs", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.nft.list({ limit: 10 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("nft.collections.list (public)", () => {
    it("returns an array of collections", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.nft.collections.list();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("nft.auctions.list (public)", () => {
    it("returns an array of active auctions", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.nft.auctions.list();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("referrals.validate (public)", () => {
    it("returns invalid for non-existent referral code", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.referrals.validate({ code: "FAKE-CODE-123" });
      expect(result.valid).toBe(false);
    });
  });

  describe("whiteLabel.validateApiKey (public)", () => {
    it("returns invalid for non-existent API key", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.whiteLabel.validateApiKey({ apiKey: "wl_fake_key_123" });
      expect(result.valid).toBe(false);
    });
  });

  describe("marketing.createLead (public)", () => {
    it("creates a lead with valid email", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.marketing.createLead({
        email: `test-${Date.now()}@example.com`,
        name: "Test Lead",
        company: "Test Corp",
        source: "website",
      });
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });
  });

  describe("protected routes require authentication", () => {
    it("subscription.current throws UNAUTHORIZED for unauthenticated", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.subscription.current()).rejects.toThrow();
    });

    it("autopilot.getStatus throws UNAUTHORIZED for unauthenticated", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.autopilot.getStatus()).rejects.toThrow();
    });

    it("emailCampaigns.list throws UNAUTHORIZED for unauthenticated", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.emailCampaigns.list()).rejects.toThrow();
    });

    it("referrals.myReferrals throws UNAUTHORIZED for unauthenticated", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.referrals.myReferrals()).rejects.toThrow();
    });
  });

  describe("admin routes require admin role", () => {
    it("admin.metrics throws for non-admin user", async () => {
      const ctx = createAuthContext("user");
      const caller = appRouter.createCaller(ctx);
      await expect(caller.admin.metrics()).rejects.toThrow();
    });

    it("admin.users throws for non-admin user", async () => {
      const ctx = createAuthContext("user");
      const caller = appRouter.createCaller(ctx);
      await expect(caller.admin.users()).rejects.toThrow();
    });

    it("whiteLabel.list throws for non-admin user", async () => {
      const ctx = createAuthContext("user");
      const caller = appRouter.createCaller(ctx);
      await expect(caller.whiteLabel.list()).rejects.toThrow();
    });
  });

  describe("authenticated user operations", () => {
    it("subscription.current returns null or subscription", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.subscription.current();
      // May be null if no subscription exists
      expect(result === null || result === undefined || typeof result === "object").toBe(true);
    });

    it("autopilot.getStatus returns status object", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.autopilot.getStatus();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("mode");
      expect(result).toHaveProperty("recentDecisions");
    });

    it("autopilot.getDecisions returns array", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.autopilot.getDecisions({ limit: 5 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("emailCampaigns.list returns array", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.emailCampaigns.list();
      expect(Array.isArray(result)).toBe(true);
    });

    it("emailDrafts.listPending returns array", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.emailDrafts.listPending();
      expect(Array.isArray(result)).toBe(true);
    });

    it("referrals.myReferrals returns array", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.referrals.myReferrals();
      expect(Array.isArray(result)).toBe(true);
    });

    it("affiliates.myProfile returns null or profile", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.affiliates.myProfile();
      expect(result === null || result === undefined || typeof result === "object").toBe(true);
    });

    it("abTesting.list returns array", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.abTesting.list();
      expect(Array.isArray(result)).toBe(true);
    });

    it("dashboard.metrics returns metrics object", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.dashboard.metrics();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("totalProducts");
      expect(result).toHaveProperty("totalAuthentications");
    });
  });

  describe("blockchain router", () => {
    it("blockchain.status returns connection status (public)", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.blockchain.status();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("connected");
      expect(result).toHaveProperty("clientId");
      expect(result).toHaveProperty("chain");
    });

    it("blockchain.uploadToIPFS requires authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.blockchain.uploadToIPFS({ name: "Test" })).rejects.toThrow();
    });

    it("blockchain.mintNFT requires authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.blockchain.mintNFT({
        name: "Test", walletAddress: "0x123", contractAddress: "0x456", privateKey: "0x789",
      })).rejects.toThrow();
    });

    it("blockchain.mintCertificateNFT requires authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.blockchain.mintCertificateNFT({
        productId: 1, certificateNumber: "CERT-001",
        walletAddress: "0x123", contractAddress: "0x456", privateKey: "0x789",
      })).rejects.toThrow();
    });

    it("blockchain.getNFTBalance is public", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      // This will fail at the thirdweb call level, but proves the route is accessible
      try {
        await caller.blockchain.getNFTBalance({ contractAddress: "0x0000000000000000000000000000000000000000", walletAddress: "0x0000000000000000000000000000000000000000" });
      } catch (e: any) {
        // Expected to fail due to invalid contract, but should not be an auth error
        expect(e.message).not.toContain("login");
      }
    });

    it("blockchain.getContractSupply is public", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      try {
        await caller.blockchain.getContractSupply({ contractAddress: "0x0000000000000000000000000000000000000000" });
      } catch (e: any) {
        expect(e.message).not.toContain("login");
      }
    });
  });

  describe("admin operations with admin role", () => {
    it("admin.metrics returns platform metrics", async () => {
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.admin.metrics();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("totalUsers");
      expect(result).toHaveProperty("totalProducts");
      expect(result).toHaveProperty("totalAuthentications");
      expect(result).toHaveProperty("totalRevenue");
    });

    it("admin.users returns array of users", async () => {
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.admin.users();
      expect(Array.isArray(result)).toBe(true);
    });

    it("admin.fraudAlerts returns array", async () => {
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.admin.fraudAlerts();
      expect(Array.isArray(result)).toBe(true);
    });

    it("admin.healthScores returns array", async () => {
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.admin.healthScores();
      expect(Array.isArray(result)).toBe(true);
    });

    it("admin.activity returns array", async () => {
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.admin.activity({ limit: 10 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("admin.subscriptions returns array", async () => {
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.admin.subscriptions();
      expect(Array.isArray(result)).toBe(true);
    });

    it("admin.revenue returns array", async () => {
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.admin.revenue();
      expect(Array.isArray(result)).toBe(true);
    });

    it("whiteLabel.list returns array", async () => {
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.whiteLabel.list();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
