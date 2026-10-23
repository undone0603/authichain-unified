// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { create } };
  },
}));

import {
  cleanText,
  handleSalesInbound,
  LIMITS,
  SALES_MODEL,
  sellablePlan,
  type SalesInboundEnv,
} from "./sales-inbound";
import worker, { type Env } from "./worker";
import { planById } from "../src/lib/plans";

const SECRET = "sales-secret";
const lead = {
  name: "Jane Doe",
  email: "Jane@Example.com",
  intent:
    "Looking to integrate QRON anti-counterfeiting for my upcoming 5,000 unit apparel drop.",
  plan_id: "dpp_readiness",
};

describe("sales-inbound worker route", () => {
  beforeEach(() => {
    create.mockReset();
  });

  it("rejects unauthorized secret", async () => {
    const res = await worker.fetch(
      new Request("http://localhost/api/sales-inbound", {
        method: "POST",
        headers: {
          "x-sales-secret": "wrong-secret",
        },
      }),
      {
        SALES_SECRET: SECRET,
      } as Env
    );

    expect(res.status).toBe(401);
  });

  it("handles valid inbound request and formats response", async () => {
    create.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            summary: "Wants 5k DPP readiness integration",
            recommended_plan: "dpp_readiness",
            estimated_timeline: "2-3 weeks",
            suggested_reply: "Thanks Jane, let's setup a call.",
            flagged_risks: [],
          }),
        },
      ],
    });

    const res = await worker.fetch(
      new Request("http://localhost/api/sales-inbound", {
        method: "POST",
        headers: {
          "x-sales-secret": SECRET,
          "content-type": "application/json",
        },
        body: JSON.stringify(lead),
      }),
      {
        SALES_SECRET: SECRET,
        ANTHROPIC_API_KEY: "test-key",
      } as Env
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.ok).toBe(true);
    expect(json.data.summary).toContain("5k DPP readiness");
  });
});
