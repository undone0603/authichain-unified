import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../_core/llm.js", () => ({
  invokeLLM: vi.fn(),
  parseLLMContent: vi.fn((raw: string) => JSON.parse(raw)),
}));

vi.mock("../email-service.js", () => ({
  checkThreadReplies: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("../stripe-service.js", () => ({
  getStripe: vi.fn(),
}));

const dbUpdateChain = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(undefined),
};
const dbStub = { update: vi.fn().mockReturnValue(dbUpdateChain) };

vi.mock("../db.js", () => ({
  createProposal: vi.fn().mockResolvedValue("proposal-1"),
  createSystemNotification: vi.fn(),
  enqueueTask: vi.fn(),
  getAllAdminIds: vi.fn().mockResolvedValue([1, 2]),
  getDb: vi.fn().mockResolvedValue(dbStub),
  logActivity: vi.fn(),
}));

const { runGenerateProposal, runSendContract } = await import("./closer.js");
const { invokeLLM } = await import("../_core/llm.js");
const { sendEmail } = await import("../email-service.js");
const { getStripe } = await import("../stripe-service.js");
const { createSystemNotification, getAllAdminIds, logActivity } =
  await import("../db.js");

function makeTask(payload: Record<string, unknown>) {
  return { id: "task-1", missionId: "mission-1", payload } as any;
}

function mockLlmJson(json: Record<string, unknown>) {
  (invokeLLM as any).mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(json) } }],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (sendEmail as any).mockResolvedValue({
    status: "sent",
    threadId: "thread-1",
  });
});

describe("runGenerateProposal: Stripe checkout failure is no longer silent", () => {
  it("notifies every admin and logs the failure when checkout session creation throws, but still sends the proposal email", async () => {
    mockLlmJson({
      subject: "Proposal: AuthiChain Pilot",
      body: "Here is our proposal.",
    });
    (getStripe as any).mockReturnValue({
      checkout: {
        sessions: {
          create: vi.fn().mockRejectedValue(new Error("Stripe API down")),
        },
      },
    });

    await runGenerateProposal(
      makeTask({
        leadEmail: "lead@example.com",
        leadOrg: "Acme",
        segment: "RETAIL",
      })
    );

    // Email still goes out even without a payment link -- non-fatal by design.
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "lead@example.com" })
    );

    // But the failure is no longer swallowed silently.
    expect(getAllAdminIds).toHaveBeenCalled();
    expect(createSystemNotification).toHaveBeenCalledTimes(2); // one per admin id
    expect(createSystemNotification).toHaveBeenCalledWith(
      1,
      expect.stringContaining("Payment link failed"),
      expect.stringContaining("Stripe API down"),
      "alert"
    );
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "checkout_link_creation_failed",
        details: expect.objectContaining({
          context: "proposal",
          error: "Stripe API down",
        }),
      })
    );
  });

  it("does not notify admins when checkout session creation succeeds", async () => {
    mockLlmJson({ subject: "Proposal", body: "Body" });
    (getStripe as any).mockReturnValue({
      checkout: {
        sessions: {
          create: vi
            .fn()
            .mockResolvedValue({ url: "https://pay.example/1", id: "cs_1" }),
        },
      },
    });

    await runGenerateProposal(
      makeTask({
        leadEmail: "lead@example.com",
        leadOrg: "Acme",
        segment: "RETAIL",
      })
    );

    expect(createSystemNotification).not.toHaveBeenCalled();
  });
});

describe("runSendContract: Stripe checkout failure is no longer silent", () => {
  it("notifies every admin and logs the failure when checkout session creation throws, but still sends the contract email", async () => {
    mockLlmJson({ subject: "AuthiChain Service Agreement", body: "Terms..." });
    (getStripe as any).mockReturnValue({
      checkout: {
        sessions: {
          create: vi.fn().mockRejectedValue(new Error("network timeout")),
        },
      },
    });

    await runSendContract(
      makeTask({
        leadEmail: "lead@example.com",
        leadOrg: "Acme",
        segment: "GOV",
      })
    );

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "lead@example.com" })
    );
    expect(createSystemNotification).toHaveBeenCalledWith(
      1,
      expect.stringContaining("Payment link failed"),
      expect.stringContaining("network timeout"),
      "alert"
    );
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "checkout_link_creation_failed",
        details: expect.objectContaining({ context: "contract" }),
      })
    );
  });

  it("reuses an existing payment link from the payload without calling Stripe again", async () => {
    mockLlmJson({ subject: "Agreement", body: "Terms" });

    await runSendContract(
      makeTask({
        leadEmail: "lead@example.com",
        leadOrg: "Acme",
        segment: "GOV",
        paymentLink: "https://pay.example/existing",
      })
    );

    expect(getStripe).not.toHaveBeenCalled();
    expect(createSystemNotification).not.toHaveBeenCalled();
  });
});
