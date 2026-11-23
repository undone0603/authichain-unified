import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOT_ADMIN_ERR_MSG } from "@shared/const";
import { ENV } from "../_core/env";
import { EMAIL_CAMPAIGN_SEND_MAX } from "../_core/rate-limit";
import type { TrpcContext } from "../_core/context";
import type { EmailCampaign, User } from "../../src/db/schema";

const CAMPAIGN_ID = "00000000-0000-4000-8000-000000000001";
const TARGET = "jane.doe@acmelabs.com";
const DNC_TARGET = "blocked@example.com";
const ATTACKER = "attacker@evil.com";

type StoredCampaign = EmailCampaign & { targetEmail: string };

const campaign: StoredCampaign = {
  id: CAMPAIGN_ID,
  userId: 1,
  name: "Spring update",
  subject: "Product update",
  body: "Hello, this is a product update from our team.",
  status: "draft",
  sentCount: 0,
  openCount: 0,
  clickCount: 0,
  scheduledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  targetEmail: TARGET,
};

vi.mock("../db", () => ({
  getUserEmailCampaigns: vi.fn(async () => [campaign]),
  updateEmailCampaign: vi.fn(async () => undefined),
  createEmailCampaign: vi.fn(async () => ({ id: CAMPAIGN_ID })),
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
  })),
}));

const { emailCampaignsRouter } = await import("./router");
const db = await import("../db");

function makeUser(role: "user" | "admin", id = 1): User {
  return {
    authUid: null,
    id,
    openId: `test-user-${id}`,
    email: "test@authichain.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    walletAddress: null,
    avatarUrl: null,
    company: null,
    title: null,
    phone: null,
    onboardingCompleted: 0,
    stripeCustomerId: null,
    paddleCustomerId: null,
    points: 0,
    generationsUsed: 0,
    generationsLimit: 0,
    affiliateId: null,
    referredBy: null,
    storyModeEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function makeCtx(role: "user" | "admin" | null, id = 1): TrpcContext {
  return {
    user: role ? makeUser(role, id) : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const sendInput = { campaignId: CAMPAIGN_ID };

async function stubGuardedNetwork() {
  const fetchMock = vi.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ id: "msg_campaign" }),
      }) as unknown as Response
  );
  vi.stubGlobal("fetch", fetchMock);
  const dns = await import("node:dns");
  vi.spyOn(dns.promises, "resolveMx").mockResolvedValue([
    { exchange: "mx", priority: 1 },
  ]);
  return fetchMock;
}

describe("emailCampaigns.send", () => {
  const OLD_ENV = { ...process.env };
  const previousSuppression = ENV.suppressionList;

  beforeEach(() => {
    vi.mocked(db.getUserEmailCampaigns).mockResolvedValue([campaign]);
    vi.mocked(db.updateEmailCampaign).mockClear();
    process.env.RESEND_API_KEY = "re_test";
    process.env.MAILING_ADDRESS = "123 Main St, Detroit MI 48226";
    process.env.OUTREACH_UNSUBSCRIBE_SECRET = "test-optout-secret";
    ENV.suppressionList = "";
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
    ENV.suppressionList = previousSuppression;
    vi.restoreAllMocks();
  });

  it("rejects a signed-in non-admin", async () => {
    const caller = emailCampaignsRouter.createCaller(makeCtx("user"));
    await expect(caller.send(sendInput)).rejects.toThrow(NOT_ADMIN_ERR_MSG);
    expect(db.updateEmailCampaign).not.toHaveBeenCalled();
  });

  it("allows an admin to send through the guarded path", async () => {
    const fetchMock = await stubGuardedNetwork();
    const caller = emailCampaignsRouter.createCaller(makeCtx("admin"));
    const result = await caller.send(sendInput);

    expect(result).toEqual({ success: true, messageId: "msg_campaign" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(db.updateEmailCampaign).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      expect.objectContaining({
        status: "sent",
        targetEmail: TARGET,
        providerMessageId: "msg_campaign",
      })
    );
  });

  it("skips a DNC-listed stored recipient without calling Resend", async () => {
    vi.mocked(db.getUserEmailCampaigns).mockResolvedValue([
      { ...campaign, targetEmail: DNC_TARGET },
    ]);
    ENV.suppressionList = DNC_TARGET;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const dns = await import("node:dns");
    const mx = vi.spyOn(dns.promises, "resolveMx");

    const caller = emailCampaignsRouter.createCaller(makeCtx("admin"));
    const result = await caller.send(sendInput);

    expect(result).toEqual({
      success: false,
      skipped: true,
      reason: "suppression_list",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mx).not.toHaveBeenCalled();
    expect(db.updateEmailCampaign).not.toHaveBeenCalled();
  });

  it("appends the unsubscribe footer and List-Unsubscribe header", async () => {
    const fetchMock = await stubGuardedNetwork();
    const caller = emailCampaignsRouter.createCaller(makeCtx("admin"));
    await caller.send(sendInput);

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, { body: string }])[1].body
    ) as { text: string; headers: { "List-Unsubscribe": string } };
    expect(body.text).toContain("Unsubscribe:");
    expect(body.text).toContain("123 Main St, Detroit MI 48226");
    expect(body.headers["List-Unsubscribe"]).toMatch(
      /^<https:\/\/authichain\.com\/api\/outreach\/unsubscribe\?e=jane\.doe%40acmelabs\.com&t=[0-9a-f]{32}>$/
    );
  });

  it("ignores a caller-supplied targetEmail and sends to the stored audience", async () => {
    const fetchMock = await stubGuardedNetwork();
    const caller = emailCampaignsRouter.createCaller(makeCtx("admin"));
    await caller.send({
      campaignId: CAMPAIGN_ID,
      targetEmail: ATTACKER,
    } as { campaignId: string });

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, { body: string }])[1].body
    ) as { to: string };
    expect(body.to).toBe(TARGET);
    expect(body.to).not.toBe(ATTACKER);
    expect(db.updateEmailCampaign).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      expect.objectContaining({ targetEmail: TARGET })
    );
  });

  it("trips the send rate limit", async () => {
    const fetchMock = await stubGuardedNetwork();
    const caller = emailCampaignsRouter.createCaller(makeCtx("admin", 99));
    for (let i = 0; i < EMAIL_CAMPAIGN_SEND_MAX; i++) {
      await caller.send(sendInput);
    }
    await expect(caller.send(sendInput)).rejects.toThrow(/Rate limit exceeded/);
    expect(fetchMock).toHaveBeenCalledTimes(EMAIL_CAMPAIGN_SEND_MAX);
  });
});
