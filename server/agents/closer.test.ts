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
const { createSystemNotification, logActivity } = await import("../db.js");

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

describe("runGenerateProposal", () => {
  it("drafts a catalogue proposal and does not charge or send", async () => {
    mockLlmJson({
      subject: "Proposal: AuthiChain Pilot",
      body: "Here is our proposal.",
    });

    await runGenerateProposal(
      makeTask({
        leadEmail: "lead@example.com",
        leadOrg: "Acme",
        segment: "RETAIL",
      })
    );

    expect(getStripe).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(createSystemNotification).not.toHaveBeenCalled();
    const prompt = (invokeLLM as any).mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain("dpp_readiness");
    expect(prompt).not.toContain("$5,000");
    expect(prompt).not.toContain("$25,000");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "proposal_drafted",
        details: expect.objectContaining({
          sendStatus: "refused",
          reason: "no inbox named this turn",
          hasPaymentLink: false,
        }),
      })
    );
  });
});

describe("runSendContract", () => {
  it("drafts a catalogue agreement and does not charge or send", async () => {
    mockLlmJson({ subject: "AuthiChain Service Agreement", body: "Terms..." });

    await runSendContract(
      makeTask({
        leadEmail: "lead@example.com",
        leadOrg: "Acme",
        segment: "GOV",
        paymentLink: "https://pay.example/existing",
      })
    );

    expect(getStripe).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(createSystemNotification).not.toHaveBeenCalled();
    const prompt = (invokeLLM as any).mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain("/checkout/dpp_readiness");
    expect(prompt).not.toContain("$25,000");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "contract_drafted",
        details: expect.objectContaining({
          sendStatus: "refused",
          hasPaymentLink: false,
        }),
      })
    );
  });
});
