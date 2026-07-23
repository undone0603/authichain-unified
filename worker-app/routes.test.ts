import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../server/webhooks/stripe", () => ({
  handleStripeWebhook: vi.fn().mockResolvedValue({ received: true }),
}));

vi.mock("../server/paddle/webhook", () => ({
  handlePaddleWebhook: vi.fn().mockImplementation(async (_db: unknown, _req: unknown, res: any) => {
    res.json({ received: true });
  }),
}));

vi.mock("../server/webhooks/instantly", () => ({
  handleInstantlyWebhook: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../server/webhooks/docusign", () => ({
  handleDocuSignWebhook: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../server/db", () => ({
  getHyperdriveDb: vi.fn().mockReturnValue({}),
}));

vi.mock("../server/_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn(),
  },
}));

vi.mock("../server/_core/db-helpers", () => ({
  getOpsSummary: vi.fn().mockResolvedValue({ ok: true }),
  upsertUser: vi.fn().mockResolvedValue(undefined),
}));

const app = (await import("./index")).app;

describe("POST /api/stripe/webhook", () => {
  it("passes the raw body and signature header through unchanged", async () => {
    const res = await app.request("/api/stripe/webhook", {
      method: "POST",
      body: "raw-stripe-payload",
      headers: { "stripe-signature": "t=123,v1=fake" },
    });
    expect(res.status).toBe(200);
    const { handleStripeWebhook } = await import("../server/webhooks/stripe");
    expect(handleStripeWebhook).toHaveBeenCalled();
    const args = (handleStripeWebhook as any).mock.calls[0];
    expect(Buffer.from(args[1]).toString()).toBe("raw-stripe-payload");
    expect(args[2]).toBe("t=123,v1=fake");
  });

  it("returns 400 when the stripe-signature header is missing", async () => {
    const res = await app.request("/api/stripe/webhook", {
      method: "POST",
      body: "raw-stripe-payload",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/stripe-signature/i);
  });
});

describe("POST /api/paddle/webhook", () => {
  it("shims a req/res pair for the Express-shaped handler and returns its response", async () => {
    const res = await app.request("/api/paddle/webhook", {
      method: "POST",
      body: "raw-paddle-payload",
      headers: { "paddle-signature": "fake-sig" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true });
    const { handlePaddleWebhook } = await import("../server/paddle/webhook");
    const args = (handlePaddleWebhook as any).mock.calls.at(-1);
    expect(args[1].headers["paddle-signature"]).toBe("fake-sig");
    expect(args[1].body.toString()).toBe("raw-paddle-payload");
  });

  it("returns 400 when the paddle-signature header is missing", async () => {
    const res = await app.request("/api/paddle/webhook", { method: "POST", body: "x" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/webhooks/instantly", () => {
  it("forwards the parsed JSON payload to the handler", async () => {
    const res = await app.request("/api/webhooks/instantly", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "email_opened", email: "a@b.com" }),
    });
    expect(res.status).toBe(200);
    const { handleInstantlyWebhook } = await import("../server/webhooks/instantly");
    const args = (handleInstantlyWebhook as any).mock.calls.at(-1);
    expect(args[1]).toEqual({ event: "email_opened", email: "a@b.com" });
  });
});

describe("POST /api/webhooks/docusign", () => {
  it("forwards the parsed JSON payload to the handler", async () => {
    const res = await app.request("/api/webhooks/docusign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "envelope-sent", recipientEmail: "a@b.com" }),
    });
    expect(res.status).toBe(200);
    const { handleDocuSignWebhook } = await import("../server/webhooks/docusign");
    const args = (handleDocuSignWebhook as any).mock.calls.at(-1);
    expect(args[1]).toEqual({ event: "envelope-sent", recipientEmail: "a@b.com" });
  });
});

describe("GET /api/admin/ops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no session", async () => {
    const { sdk } = await import("../server/_core/sdk");
    (sdk.authenticateRequest as any).mockRejectedValueOnce(new Error("no session"));
    const res = await app.request("/api/admin/ops");
    expect(res.status).toBe(401);
  });

  it("returns 403 when the signed-in user is not an admin", async () => {
    const { sdk } = await import("../server/_core/sdk");
    (sdk.authenticateRequest as any).mockResolvedValueOnce({ role: "user" });
    const res = await app.request("/api/admin/ops");
    expect(res.status).toBe(403);
  });

  it("returns the ops summary for an admin user", async () => {
    const { sdk } = await import("../server/_core/sdk");
    (sdk.authenticateRequest as any).mockResolvedValueOnce({ role: "admin" });
    const res = await app.request("/api/admin/ops");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});

describe("GET /api/oauth/callback", () => {
  it("returns 400 when code or state is missing", async () => {
    const res = await app.request("/api/oauth/callback");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/code and state/i);
  });
});

describe("POST /api/contact", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = await app.request("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid email address", async () => {
    const res = await app.request("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Zac", email: "not-an-email", message: "hi" }),
    });
    expect(res.status).toBe(400);
  });

  it("succeeds without attempting SMTP when unconfigured", async () => {
    const res = await app.request("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Zac", email: "zac@example.com", message: "hi" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe("GPT plugin routes", () => {
  it("POST /api/gpt/verify returns 400 without a productId", async () => {
    const res = await app.request("/api/gpt/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/gpt/certificates/verify returns 400 without certNumber", async () => {
    const res = await app.request("/api/gpt/certificates/verify");
    expect(res.status).toBe(400);
  });
});

describe("Internal gateway API auth guard", () => {
  it("returns 401 when X-Internal-Secret is missing", async () => {
    const res = await app.request("/api/internal/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an incorrect X-Internal-Secret", async () => {
    const res = await app.request("/api/internal/tenant", {
      headers: { "x-internal-secret": "definitely-wrong" },
    });
    expect(res.status).toBe(401);
  });
});
