import { vi } from "vitest";

// Mock the entire db module
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }),
    getUserProducts: vi.fn().mockResolvedValue([]),
    getProductById: vi.fn().mockResolvedValue(null),
    createProduct: vi.fn().mockResolvedValue({ id: 1 }),
    getUserSubscription: vi.fn().mockResolvedValue(null),
    getCertificateByNumber: vi.fn().mockResolvedValue(null),
    listNfts: vi.fn().mockResolvedValue([]),
    listCollections: vi.fn().mockResolvedValue([]),
    getActiveAuctions: vi.fn().mockResolvedValue([]),
    getReferralByCode: vi.fn().mockResolvedValue(null),
    getWhiteLabelByApiKey: vi.fn().mockResolvedValue(null),
    getAutopilotConfig: vi.fn().mockResolvedValue(null),
    getRecentDecisions: vi.fn().mockResolvedValue([]),
    getUserEmailCampaigns: vi.fn().mockResolvedValue([]),
    getPendingDrafts: vi.fn().mockResolvedValue([]),
    getUserReferrals: vi.fn().mockResolvedValue([]),
    getAffiliateByUserId: vi.fn().mockResolvedValue(null),
    getAllAbTests: vi.fn().mockResolvedValue([]),
    getDashboardMetrics: vi.fn().mockResolvedValue({
      totalProducts: 0,
      totalAuthentications: 0,
      totalCertificates: 0,
      subscription: null,
    }),
    getAdminDashboardMetrics: vi.fn().mockResolvedValue({
      totalUsers: 0,
      totalProducts: 0,
      totalAuthentications: 0,
      totalCertificates: 0,
      totalSubscriptions: 0,
    }),
    getAllUsers: vi.fn().mockResolvedValue([]),
    getOpenFraudAlerts: vi.fn().mockResolvedValue([]),
    getAllHealthScores: vi.fn().mockResolvedValue([]),
    getRecentActivity: vi.fn().mockResolvedValue([]),
    getSubscriptionAnalytics: vi.fn().mockResolvedValue({
      total: 0, active: 0, cancelled: 0, pastDue: 0
    }),
    getRevenueAnalytics: vi.fn().mockResolvedValue([]),
    getWhiteLabelClients: vi.fn().mockResolvedValue([]),
    getServiceOrdersByUser: vi.fn().mockResolvedValue([]),
    getAllServiceOrders: vi.fn().mockResolvedValue([]),
    updateServiceOrderStatus: vi.fn().mockResolvedValue(undefined),
    createNotification: vi.fn().mockResolvedValue({ id: 1 }),
    getUserNotifications: vi.fn().mockResolvedValue([]),
    getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
    markNotificationRead: vi.fn().mockResolvedValue(undefined),
    markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
    deleteNotification: vi.fn().mockResolvedValue(undefined),
    createLead: vi.fn().mockResolvedValue({ id: 1 }),
    logActivity: vi.fn().mockResolvedValue(undefined),
    updateSubscriptionUsage: vi.fn().mockResolvedValue(undefined),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    createCertificate: vi.fn().mockResolvedValue({ id: 1 }),
    createAuthentication: vi.fn().mockResolvedValue({ id: 1 }),
    createQrCode: vi.fn().mockResolvedValue({ id: 1 }),
    getProductQrCodes: vi.fn().mockResolvedValue([]),
    incrementScanCount: vi.fn().mockResolvedValue(undefined),
    claimWebhookEvent: vi.fn().mockResolvedValue(true),
    markWebhookEventProcessed: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock character-service as well since it also uses getDb
vi.mock("./character-service", () => ({
  getNetworkStats: vi.fn().mockResolvedValue({ agents: 0, verifications: 0, qronCirculating: 0 }),
  getAgentLeaderboard: vi.fn().mockResolvedValue([]),
  getUserGenerations: vi.fn().mockResolvedValue([]),
  getUserCharacterAssets: vi.fn().mockResolvedValue([]),
  getAgentByUser: vi.fn().mockResolvedValue(null),
  rewardAgentForVerification: vi.fn().mockResolvedValue(undefined),
}));

// Mock scheduled-jobs as well
vi.mock("./scheduled-jobs", () => ({
  getJobHistory: vi.fn().mockResolvedValue([]),
  runJobManually: vi.fn().mockResolvedValue({ success: true }),
  executeJob: vi.fn().mockResolvedValue({ success: true }),
  REGISTERED_JOBS: [],
}));
