import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "../_core/env";
import type { TrpcContext } from "../_core/context";
import type { EmailDraft, User } from "../../src/db/schema";

const DRAFT_ID = "00000000-0000-4000-8000-000000000042";
const TARGET = "lead@bigcorp.com";
const DNC_TARGET = "blocked@example.com";

const draft: EmailDraft = {
  id: DRAFT_ID,
  userId: 4,
  prospectEmail: TARGET,
  subject: "Our Partnership",
  body: "<p>Hello!</p>",
  prospectName: "Alice",
  prospectCompany: null,
  prospectTitle: null,
  industry: null,
  status: "pending",
  templateUsed: null,
  generatedBy: "ai_manager",
  approvedBy: null,
  approvedAt: null,
  sentAt: null,
  notes: null,
  taskId: null,
  createdAt: new Date(),
};

vi.mock("../db", () => ({
  getPendingDrafts: vi.fn(async () => [draft]),
  updateDraftStatus: vi.fn(async () => undefined),
  createEmailDraft: vi.fn(async () => ({ id: DRAFT_ID })),
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

const { emailDraftsRouter } = await import("./router");
const db = await import("../db");
const { getDb } = db;

function makeUser(role: "user" | "admin"): User {
  return {
    authUid: null,
    id: 1,
    openId: "test-user-001",
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

function makeCtx(role: "user" | "admin"): TrpcContext {
  return {
    user: makeUser(role),
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("emailDrafts.approve", () => {
  const OLD_ENV = { ...process.env };
  const previousSuppression = ENV.suppressionList;

  beforeEach(() => {
    vi.mocked(db.getPendingDrafts).mockResolvedValue([draft]);
    vi.mocked(db.updateDraftStatus).mockClear();
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

  it("skips a DNC-listed recipient without calling Resend", async () => {
    vi.mocked(db.getPendingDrafts).mockResolvedValue([
      { ...draft, prospectEmail: DNC_TARGET },
    ]);
    ENV.suppressionList = DNC_TARGET;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const dns = await import("node:dns");
    const mx = vi.spyOn(dns.promises, "resolveMx");

    const caller = emailDraftsRouter.createCaller(makeCtx("admin"));
    const result = await caller.approve({ id: DRAFT_ID });

    expect(result).toEqual({
      success: false,
      skipped: true,
      reason: "suppression_list",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mx).not.toHaveBeenCalled();
    expect(db.updateDraftStatus).toHaveBeenCalledWith(DRAFT_ID, "approved", 1);
    expect(db.updateDraftStatus).not.toHaveBeenCalledWith(
      DRAFT_ID,
      "sent",
      expect.anything()
    );
  });

  it("skips a recipient listed in guardrail_suppression_list", async () => {
    vi.mocked(db.getPendingDrafts).mockResolvedValue([
      { ...draft, prospectEmail: DNC_TARGET },
    ]);
    vi.mocked(getDb).mockResolvedValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ email: DNC_TARGET }],
          }),
        }),
      }),
    } as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const caller = emailDraftsRouter.createCaller(makeCtx("admin"));
    const result = await caller.approve({ id: DRAFT_ID });

    expect(result).toEqual({
      success: false,
      skipped: true,
      reason: "suppression_list",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
