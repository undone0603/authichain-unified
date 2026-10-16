// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import worker, { type Env } from "./worker";

const env = {
  WORKER_API_KEY: "k_test",
  NEXT_PUBLIC_APP_URL: "https://app.example.test",
} as unknown as Env;
const draftReq = (body: unknown, key: string | null = "k_test") =>
  new Request("https://api.example.test/outbound/draft", {
    method: "POST",
    headers: key ? { "x-api-key": key, "Content-Type": "application/json" } : {},
    body: JSON.stringify(body),
  });

describe("outbound drafts (safe port of 40516a11)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requires WORKER_API_KEY", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    expect((await worker.fetch(draftReq({}, null), env)).status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it("returns a DPP payload and an unsent draft with zero outbound fetches", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    const res = await worker.fetch(
      draftReq({ email: "Ops@Brand.example", company: "Brand Co", name: "Ana Li", product: "Jacket" }),
      env
    );
    expect(res.status).toBe(200);
    const out = (await res.json()) as any;
    expect(out.draft).toMatchObject({ status: "draft", sent: false, to: "ops@brand.example" });
    expect(out.draft.body).toContain("Hi Ana");
    expect(out.draft.body).toContain("https://app.example.test/pricing");
    expect(out.passport.status).toBe("draft");
    expect(out.passport.passport_id).toMatch(/^dpp_[0-9a-f]{16}$/);
    expect(f).not.toHaveBeenCalled();
  });

  it("is deterministic (no model output)", async () => {
    const body = { email: "a@b.example", company: "X", product: "Y" };
    const a = await (await worker.fetch(draftReq(body), env)).json();
    const b = await (await worker.fetch(draftReq(body), env)).json();
    expect(a).toEqual(b);
  });

  it("rejects bad input", async () => {
    expect((await worker.fetch(draftReq({ email: "nope", company: "X" }), env)).status).toBe(400);
    expect((await worker.fetch(draftReq({ email: "a@b.example" }), env)).status).toBe(400);
  });

  it("has no scheduled() handler, so the 0 * * * * cron runs nothing", () => {
    expect("scheduled" in worker).toBe(false);
  });

  it("worker sources reference no LLM or email-provider hosts, SDKs or the hard-coded lead", () => {
    const banned = /anthropic|openai|api\.resend|sendgrid|mailgun|postmark|mailchannels|smtp|founder@target-brand\.com|claude-/i;
    for (const f of ["worker.ts", "sales-inbound.ts", "revenue-drafts.ts"]) {
      // Code only: doc comments may describe what was removed.
      const src = readFileSync(new URL(`./${f}`, import.meta.url), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(src, f).not.toMatch(banned);
    }
  });
});
