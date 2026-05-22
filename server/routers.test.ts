import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// In-memory store so db-writing tests work without a real database.
const store = vi.hoisted(() => {
  const notifications: any[] = [];
  let notifId = 1;
  let leadId = 1;
  return {
    notifications,
    nextNotifId: () => notifId++,
    nextLeadId: () => leadId++,
    reset: () => { notifications.length = 0; notifId = 1; leadId = 1; },
  };
});

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createNotification: vi.fn(async (data: any) => {
      const id = store.nextNotifId();
      store.notifications.push({ ...data, id, createdAt: new Date() });
      return { id };
    }),
    getUserNotifications: vi.fn(async (userId: number, limit = 50) => {
      return store.notifications.filter((n: any) => n.userId === userId).slice(0, limit);
    }),
    getUnreadNotificationCount: vi.fn(async (userId: number) => {
      return store.notifications.filter((n: any) => n.userId === userId && n.isRead === 0).length;
    }),
    markNotificationRead: vi.fn(async (id: number, userId: number) => {
      const n = store.notifications.find((n: any) => n.id === id && n.userId === userId);
      if (n) n.isRead = 1;
    }),
    markAllNotificationsRead: vi.fn(async (userId: number) => {
      store.notifications.filter((n: any) => n.userId === userId).forEach((n: any) => { n.isRead = 1; });
    }),
    deleteNotification: vi.fn(async (id: number, userId: number) => {
      const idx = store.notifications.findIndex((n: any) => n.id === id && n.userId === userId);
      if (idx >= 0) store.notifications.splice(idx, 1);
    }),
    createLead: vi.fn(async (_data: any) => ({ id: store.nextLeadId() })),
    // certificates
    getCertificateByNumber: vi.fn(async () => null),
    // nft
    listNfts: vi.fn(async () => []),
    listCollections: vi.fn(async () => []),
    getActiveAuctions: vi.fn(async () => []),
    // referral
    getReferralByCode: vi.fn(async () => undefined),
    getUserReferrals: vi.fn(async () => []),
    // white-label
    getWhiteLabelByApiKey: vi.fn(async () => null),
    // subscriptions
    getUserSubscription: vi.fn(async () => null),
    // autopilot
    getAutopilotConfig: vi.fn(async () => null),
    getRecentDecisions: vi.fn(async () => []),
    // email campaigns/drafts
    getUserEmailCampaigns: vi.fn(async () => []),
    getPendingDrafts: vi.fn(async () => []),
    // affiliate
    getAffiliateByUserId: vi.fn(async () => null),
    // ab testing
    getAllAbTests: vi.fn(async () => []),
    // dashboard
    getDashboardMetrics: vi.fn(async () => ({ totalProducts: 0, totalAuthentications: 0, totalCertificates: 0, totalNfts: 0 })),
    // admin
    getAdminDashboardMetrics: vi.fn(async () => ({ totalUsers: 0, totalProducts: 0, totalAuthentications: 0, totalRevenue: 0, totalLeads: 0, totalNfts: 0 })),
    getAllUsers: vi.fn(async () => []),
    getRevenueAnalytics: vi.fn(async () => []),
    getSubscriptionAnalytics: vi.fn(async () => []),
    getOpenFraudAlerts: vi.fn(async () => []),
    getAllHealthScores: vi.fn(async () => []),
    getRecentActivity: vi.fn(async () => []),
    getWhiteLabelClients: vi.fn(async () => []),
    // qrcode
    getProductById: vi.fn(async () => null),
    getProductQrCodes: vi.fn(async () => []),
    incrementScanCount: vi.fn(async () => {}),
    createQrCode: vi.fn(async () => ({ id: 1 })),
    // make getDb return null so character/scheduler null-guards activate
    getDb: vi.fn(async () => null),
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
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as any;

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
  beforeEach(() => store.reset());

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
      const result = await caller.referral.validate({ code: "FAKE-CODE-123" });
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
      await expect(caller.referral.getHistory()).rejects.toThrow();
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
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.autopilot.getStatus();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("mode");
      expect(result).toHaveProperty("recentDecisions");
    });

    it("autopilot.getDecisions returns array", async () => {
      const ctx = createAuthContext("admin");
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
      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.emailDrafts.listPending();
      expect(Array.isArray(result)).toBe(true);
    });

    it("referrals.myReferrals returns array", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.referral.getHistory();
      expect(Array.isArray(result)).toBe(true);
    });

    it("affiliates.myProfile returns null or profile", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.affiliate.getStatus();
      expect(result === null || result === undefined || typeof result === "object").toBe(true);
    });

    it("abTesting.list returns array", async () => {
      const ctx = createAuthContext("admin");
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
        name: "Test", walletAddress: "0x123", contractAddress: "0x456",
      })).rejects.toThrow();
    });

    it("blockchain.mintCertificateNFT requires authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.blockchain.mintCertificateNFT({
        productId: 1, certificateNumber: "CERT-001",
        walletAddress: "0x123", contractAddress: "0x456",
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

    it("blockchain.deployedContract returns contract address from env", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.blockchain.deployedContract();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("address");
      expect(result).toHaveProperty("chainId", 80002);
      expect(result).toHaveProperty("chain", "Polygon Amoy");
      expect(result).toHaveProperty("deployed");
      // Verify the contract address is set from VITE_AUTHICHAIN_CONTRACT_ADDRESS env
      if (process.env.VITE_AUTHICHAIN_CONTRACT_ADDRESS) {
        expect(result.address).toBe(process.env.VITE_AUTHICHAIN_CONTRACT_ADDRESS);
        expect(result.deployed).toBe(true);
        expect(result.explorer).toContain("amoy.polygonscan.com");
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

  describe("notifications router", () => {
    it("notifications.list requires authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.notifications.list()).rejects.toThrow();
    });

    it("notifications.unreadCount requires authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.notifications.unreadCount()).rejects.toThrow();
    });

    it("notifications.markAllRead requires authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.notifications.markAllRead()).rejects.toThrow();
    });

    it("notifications.list returns array for authenticated user", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.notifications.list({ limit: 10 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("notifications.unreadCount returns count object", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.notifications.unreadCount();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("count");
      expect(typeof result.count).toBe("number");
    });

    it("notifications.markAllRead returns success", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.notifications.markAllRead();
      expect(result).toEqual({ success: true });
    });

    it("notifications.create creates a notification", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.notifications.create({
        title: "Test Notification",
        message: "This is a test notification from vitest",
        type: "system",
        actionUrl: "/dashboard",
      });
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it("notifications.create then list shows the notification", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      // Create a notification
      await caller.notifications.create({
        title: "Visible Test",
        message: "Should appear in list",
        type: "authentication",
      });
      // List should contain it
      const list = await caller.notifications.list({ limit: 50 });
      const found = list.find((n: any) => n.title === "Visible Test");
      expect(found).toBeDefined();
      expect(found?.message).toBe("Should appear in list");
      expect(found?.type).toBe("authentication");
      expect(found?.isRead).toBe(0);
    });

    it("notifications.markRead marks a specific notification as read", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      // Create a notification
      const created = await caller.notifications.create({
        title: "Mark Read Test",
        message: "Will be marked read",
        type: "payment",
      });
      // Mark it as read
      const markResult = await caller.notifications.markRead({ id: created.id });
      expect(markResult).toEqual({ success: true });
      // Verify it's read
      const list = await caller.notifications.list({ limit: 50 });
      const found = list.find((n: any) => n.id === created.id);
      expect(found?.isRead).toBe(1);
    });

    it("notifications.delete removes a notification", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      // Create a notification
      const created = await caller.notifications.create({
        title: "Delete Test",
        message: "Will be deleted",
        type: "alert",
      });
      // Delete it
      const deleteResult = await caller.notifications.delete({ id: created.id });
      expect(deleteResult).toEqual({ success: true });
      // Verify it's gone
      const list = await caller.notifications.list({ limit: 50 });
      const found = list.find((n: any) => n.id === created.id);
      expect(found).toBeUndefined();
    });

    it("notifications.unreadCount reflects actual unread count", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      // Get initial count
      const initial = await caller.notifications.unreadCount();
      // Create a notification
      await caller.notifications.create({
        title: "Count Test",
        message: "Increases unread count",
        type: "nft",
      });
      // Count should increase
      const after = await caller.notifications.unreadCount();
      expect(after.count).toBeGreaterThanOrEqual(initial.count + 1);
    });
  });

  // ─── Scheduler Tests ──────────────────────────────────────────────────────
  describe("scheduler", () => {
    it("requires admin role to list jobs", async () => {
      const caller = appRouter.createCaller(createAuthContext("user"));
      await expect(caller.scheduler.listJobs()).rejects.toThrow();
    });

    it("allows admin to list registered jobs", async () => {
      const caller = appRouter.createCaller(createAuthContext("admin"));
      const jobs = await caller.scheduler.listJobs();
      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBeGreaterThanOrEqual(1);
      expect(jobs[0]).toHaveProperty("name");
      expect(jobs[0]).toHaveProperty("description");
      expect(jobs[0]).toHaveProperty("schedule");
      expect(jobs[0]).toHaveProperty("enabled");
    });

    it("returns all 8 registered maintenance jobs", async () => {
      const caller = appRouter.createCaller(createAuthContext("admin"));
      const jobs = await caller.scheduler.listJobs();
      const jobNames = jobs.map((j: any) => j.name);
      expect(jobNames).toContain("subscription-health-check");
      expect(jobNames).toContain("certificate-expiry-check");
      expect(jobNames).toContain("lead-nurturing");
      expect(jobNames).toContain("database-cleanup");
      expect(jobNames).toContain("weekly-analytics-digest");
      expect(jobNames).toContain("hubspot-crm-sync");
      expect(jobNames).toContain("customer-health-score");
      expect(jobNames).toContain("fraud-detection-sweep");
    });

    it("requires admin role to get job history", async () => {
      const caller = appRouter.createCaller(createAuthContext("user"));
      await expect(caller.scheduler.getHistory({ limit: 10 })).rejects.toThrow();
    });

    it("allows admin to get job history", async () => {
      const caller = appRouter.createCaller(createAuthContext("admin"));
      const history = await caller.scheduler.getHistory({ limit: 10 });
      expect(Array.isArray(history)).toBe(true);
    });

    it("requires admin role to run jobs manually", async () => {
      const caller = appRouter.createCaller(createAuthContext("user"));
      await expect(caller.scheduler.runManually({ jobName: "database-cleanup" })).rejects.toThrow();
    });

    it("rejects running non-existent jobs", async () => {
      const caller = appRouter.createCaller(createAuthContext("admin"));
      await expect(caller.scheduler.runManually({ jobName: "nonexistent-job" })).rejects.toThrow();
    });

    it("allows admin to manually trigger database-cleanup job", async () => {
      const caller = appRouter.createCaller(createAuthContext("admin"));
      const result = await caller.scheduler.runManually({ jobName: "database-cleanup" });
      expect(result).toBeDefined();
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("message");
    });
  });

  // ── AuthiCharacter System ──────────────────────────────────────────
  describe("character", () => {
    it("requires auth for character generation", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(
        caller.character.generate({ archetype: "guardian" })
      ).rejects.toThrow();
    });

    it("requires auth for agent creation", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(
        caller.character.createAgent({ characterAssetId: 1, agentName: "TestAgent", agentType: "guardian" })
      ).rejects.toThrow();
    });

    it("returns network stats", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const stats = await caller.character.networkStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty("totalAgents");
      expect(stats).toHaveProperty("totalVerifications");
      expect(stats).toHaveProperty("totalQRONDistributed");
    });

    it("returns leaderboard", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const leaderboard = await caller.character.leaderboard({ limit: 10 });
      expect(leaderboard).toBeDefined();
      expect(Array.isArray(leaderboard)).toBe(true);
    });

    it("returns empty generations for new user", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const gens = await caller.character.myGenerations();
      expect(gens).toBeDefined();
      expect(Array.isArray(gens)).toBe(true);
    });

    it("returns empty assets for new user", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const assets = await caller.character.myAssets();
      expect(assets).toBeDefined();
      expect(Array.isArray(assets)).toBe(true);
    });

    it("returns null agent for new user", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const agent = await caller.character.myAgent();
      expect(agent).toBeNull();
    });

    it("validates archetype input on generate", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await expect(
        caller.character.generate({ archetype: "invalid_archetype" as any })
      ).rejects.toThrow();
    });
  });

  describe("analytics", () => {
    it("requires auth for myStats", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.analytics.myStats()).rejects.toThrow();
    });

    it("returns aggregated stats for authenticated user (empty when db unavailable)", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const stats = await caller.analytics.myStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe("object");
    });
  });

  describe("personalization", () => {
    it("getPersonalizedContent returns null when db unavailable", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.personalization.getPersonalizedContent({
        sessionId: "test-session-123",
      });
      expect(result).toBeNull();
    });
  });

  describe("products", () => {
    it("list requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.products.list()).rejects.toThrow();
    });
    it("getById requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.products.getById({ id: 1 })).rejects.toThrow();
    });
  });

  describe("payments", () => {
    it("list requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.payments.list()).rejects.toThrow();
    });
    it("createStripe requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.payments.createStripe({ amount: "100", currency: "usd" })).rejects.toThrow();
    });
  });

  describe("services", () => {
    it("catalog is public and returns array", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.services.catalog();
      expect(Array.isArray(result)).toBe(true);
    });
    it("myOrders requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.services.myOrders()).rejects.toThrow();
    });
    it("allOrders requires admin", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await expect(caller.services.allOrders()).rejects.toThrow();
    });
  });

  describe("staking", () => {
    it("list requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.staking.list()).rejects.toThrow();
    });
  });

  describe("feedback", () => {
    it("myFeedback requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.feedback.myFeedback()).rejects.toThrow();
    });
  });

  describe("missions", () => {
    it("list requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.missions.list({ status: "IN_PROGRESS" as any })).rejects.toThrow();
    });
  });

  describe("tasks", () => {
    it("list requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.tasks.list({ missionId: "test-id" })).rejects.toThrow();
    });
  });

  describe("stripeConnect", () => {
    it("provisionAccount requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.stripeConnect.provisionAccount({ country: "US" })).rejects.toThrow();
    });
  });

  describe("heygen", () => {
    it("avatars requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.heygen.avatars()).rejects.toThrow();
    });
  });

  describe("marketplace", () => {
    it("purchaseModel requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.marketplace.purchaseModel({ modelId: 1 })).rejects.toThrow();
    });
    it("myPurchases requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.marketplace.myPurchases()).rejects.toThrow();
    });
  });

  describe("ai", () => {
    it("chat requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.ai.chat({ messages: [{ role: "user", content: "hello" }] })).rejects.toThrow();
    });
  });

  describe("bonuses", () => {
    it("getUserBonuses requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.bonuses.getUserBonuses()).rejects.toThrow();
    });
    it("claimBonus requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.bonuses.claimBonus({ bonusId: 1 })).rejects.toThrow();
    });
  });

  describe("govchain", () => {
    it("stats is public", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.govchain.stats();
      expect(result).toBeDefined();
    });
    it("issuePassport requires admin", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await expect(caller.govchain.issuePassport({ documentId: "doc1", claims: {}, recipientEmail: "a@b.com" })).rejects.toThrow();
    });
  });

  describe("supplyChain", () => {
    it("getEvents requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.supplyChain.getEvents({ productId: 1 })).rejects.toThrow();
    });
    it("addEvent requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.supplyChain.addEvent({ productId: 1, eventType: "shipped", location: "NYC", notes: "" })).rejects.toThrow();
    });
  });

  describe("devTeam", () => {
    it("writeCode requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.devTeam.writeCode({ missionId: "m1", prompt: "add feature" })).rejects.toThrow();
    });
    it("tasks requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.devTeam.tasks({ missionId: "m1" })).rejects.toThrow();
    });
  });

  describe("macrohard", () => {
    it("status requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.macrohard.status()).rejects.toThrow();
    });
    it("sync requires admin", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await expect(caller.macrohard.sync({ entity: "products" })).rejects.toThrow();
    });
  });

  describe("sales", () => {
    it("calculateRoi is public", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.sales.calculateRoi({
        numProducts: 100,
        complianceHoursPerMonth: 10,
        hourlyRate: 50,
        existingTechCosts: 5000,
        industry: "retail",
      });
      expect(result).toBeDefined();
      expect(typeof result.year1Savings).toBe("number");
    });
  });

  describe("metrc", () => {
    it("stats is public", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.metrc.stats();
      expect(result).toBeDefined();
      expect(typeof result.activeLicenses).toBe("number");
    });
    it("sync requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.metrc.sync({ licenseNumber: "LIC-123" })).rejects.toThrow();
    });
  });

  describe("authenticate", () => {
    it("analyze requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.authenticate.analyze({ productId: 1, imageUrl: "https://example.com/img.jpg" })).rejects.toThrow();
    });
    it("history requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.authenticate.history()).rejects.toThrow();
    });
  });

  describe("qrcode", () => {
    it("generate requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.qrcode.generate({ productId: 1 })).rejects.toThrow();
    });
    it("generateStorymode requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.qrcode.generateStorymode({ productId: 1 })).rejects.toThrow();
    });
    it("scan returns NOT_FOUND when product missing", async () => {
      const db = await import("./db");
      vi.mocked(db.getProductById).mockResolvedValueOnce(null as any);
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.qrcode.scan({ productId: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("scan returns hashVerification=null when no hash supplied", async () => {
      const db = await import("./db");
      const fakeProduct = { id: 1, name: "Test", userId: 1 } as any;
      vi.mocked(db.getProductById).mockResolvedValueOnce(fakeProduct);
      vi.mocked(db.getProductQrCodes).mockResolvedValueOnce([]);
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.qrcode.scan({ productId: 1 });
      expect(result.product).toEqual(fakeProduct);
      expect(result.hashVerification).toBeNull();
    });
  });

  describe("hubspot", () => {
    it("status requires auth", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.hubspot.status()).rejects.toThrow();
    });
  });

  describe("system", () => {
    it("health is public and returns ok", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.system.health({ timestamp: Date.now() });
      expect(result.ok).toBe(true);
    });
    it("notifyOwner requires admin", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await expect(caller.system.notifyOwner({ title: "t", content: "c" })).rejects.toThrow();
    });
  });
});
