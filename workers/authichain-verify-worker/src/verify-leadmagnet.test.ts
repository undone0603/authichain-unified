// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { normalizeEmail, ONBOARD_URL, type Env } from "./index";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "test-anon",
  NEXT_PUBLIC_SITE_URL: "https://authichain.com",
} as Env;

function stubFetch() {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("/rest/v1/verify_email_captures")) return new Response(null, { status: 201 });
    if (String(url).includes("/rest/v1/products")) return Response.json([]);
    throw new Error("offline");
  }));
  return calls;
}

const post = (body: unknown) =>
  new Request("https://authichain.com/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("/verify lead magnet", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("includes the upgrade CTA on every /verify response, including errors", async () => {
    stubFetch();
    const ok = (await (await worker.fetch(new Request("https://authichain.com/verify?id=polygon-anchor-1"), env)).json()) as any;
    expect(ok.cta.url).toBe(ONBOARD_URL);
    expect(ok.emailCapture).toBe("not_requested");
    const bad = await worker.fetch(new Request("https://authichain.com/verify"), env);
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as any).cta.url).toBe(ONBOARD_URL);
  });

  it("stores email only with consent=true and logs without the address", async () => {
    const calls = stubFetch();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const body = (await (await worker.fetch(post({ input: "ABC123", email: " A@Example.com ", consent: true }), env)).json()) as any;
    expect(body.emailCapture).toBe("stored");
    const insert = calls.find((c) => c.url.includes("verify_email_captures"))!;
    expect(JSON.parse(String(insert.init!.body)).email).toBe("a@example.com");
    const events = log.mock.calls.map((c) => JSON.parse(String(c[0])).evt);
    expect(events).toEqual(expect.arrayContaining(["verify_started", "verify_success", "verify_email_captured"]));
    expect(log.mock.calls.join("\n")).not.toContain("a@example.com");
    expect(log.mock.calls.join("\n")).not.toContain("test-anon");
  });

  it("does not store without consent or with an invalid email", async () => {
    const calls = stubFetch();
    const noConsent = (await (await worker.fetch(post({ input: "ABC123", email: "a@example.com", consent: "yes" }), env)).json()) as any;
    expect(noConsent.emailCapture).toBe("consent_missing");
    const invalid = (await (await worker.fetch(post({ input: "ABC123", email: "nope", consent: true }), env)).json()) as any;
    expect(invalid.emailCapture).toBe("invalid_email");
    expect(calls.some((c) => c.url.includes("verify_email_captures"))).toBe(false);
  });

  it("GET /verify/cta logs verify_cta_clicked and 302s to onboard", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await worker.fetch(new Request("https://authichain.com/verify/cta?id=ABC123"), env);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(ONBOARD_URL);
    expect(JSON.parse(String(log.mock.calls[0][0])).evt).toBe("verify_cta_clicked");
  });

  it("validates emails", () => {
    expect(normalizeEmail("x@y.io")).toBe("x@y.io");
    expect(normalizeEmail("x@y")).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });
});
