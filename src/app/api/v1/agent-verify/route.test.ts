import { afterEach, describe, expect, it } from "vitest";
import { GET, POST } from "./route";

const PAY_TO = "0xabc0000000000000000000000000000000000001";
const SEAL = "3f6c2a4e-8b1d-4c7a-9e2f-0a1b2c3d4e5f";
const NIL = "00000000-0000-4000-8000-000000000000";

function post(body: string) {
  return POST(
    new Request("https://authichain.com/api/v1/agent-verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    })
  );
}

describe("POST /api/v1/agent-verify (Next)", () => {
  afterEach(() => {
    delete process.env.X402_PAY_TO;
  });

  it("returns 402 for quote JSON without sealId and 400 for a non-UUID sealId", async () => {
    process.env.X402_PAY_TO = PAY_TO;
    for (const body of [{ probe: "suggestions" }, { productId: "p-1" }]) {
      const res = await post(JSON.stringify(body));
      expect(res.status).toBe(402);
      expect(res.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
    }
    const bad = await post(JSON.stringify({ sealId: "AC-DEMO-001" }));
    expect(bad.status).toBe(400);
    expect(bad.headers.get("PAYMENT-REQUIRED")).toBeNull();
    const json = (await bad.json()) as { error: string; settled: boolean };
    expect(json.settled).toBe(false);
    expect(json.error).toBe("seal_id_not_uuid");
  });

  it("keeps the stale PayAI sample `demo` on the 402 challenge", async () => {
    process.env.X402_PAY_TO = PAY_TO;
    const res = await post(JSON.stringify({ sealId: "demo" }));
    expect(res.status).toBe(402);
    expect(res.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
  });

  it("GET unpaid is HTTP 402 so GET-first crawlers see a paywall", async () => {
    process.env.X402_PAY_TO = PAY_TO;
    const res = await GET(
      new Request("https://authichain.com/api/v1/agent-verify")
    );
    expect(res.status).toBe(402);
    expect(res.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
  });

  it("keeps an empty unpaid POST on the 402 challenge", async () => {
    process.env.X402_PAY_TO = PAY_TO;
    const res = await post("{}");
    expect(res.status).toBe(402);
    expect(res.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
  });

  it("keeps a valid unpaid seal UUID on the 402 challenge", async () => {
    process.env.X402_PAY_TO = PAY_TO;
    const res = await post(JSON.stringify({ sealId: SEAL }));
    expect(res.status).toBe(402);
    expect(res.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
  });

  it("refuses the all-zero discovery example before the 402", async () => {
    process.env.X402_PAY_TO = PAY_TO;
    const res = await post(JSON.stringify({ sealId: NIL }));
    expect(res.status).toBe(400);
    expect(res.headers.get("PAYMENT-REQUIRED")).toBeNull();
    const json = (await res.json()) as { error: string; settled: boolean };
    expect(json.error).toBe("seal_id_nil");
    expect(json.settled).toBe(false);
  });
});
