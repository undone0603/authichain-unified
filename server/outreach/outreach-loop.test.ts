// @vitest-environment node
// Tests for worker/outreach-loop.ts (the root worker's Gmail outreach loop).
// Kept here because vitest does not include worker/**.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  enqueueLeads,
  leadSendBlockers,
  processInboundReply,
  runOutreachSend,
  shouldAutoNurture,
  type OutreachEnv,
} from "../../worker/outreach-loop";

function fakeEnv(overrides: Partial<OutreachEnv> = {}) {
  const store = new Map<string, string>();
  const SESSIONS = {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => void store.set(k, v),
    list: async ({ prefix }: { prefix: string }) => ({
      keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })),
    }),
  } as unknown as KVNamespace;
  const env: OutreachEnv = {
    SESSIONS,
    GMAIL_CLIENT_ID: "id",
    GMAIL_CLIENT_SECRET: "secret",
    GMAIL_REFRESH_TOKEN: "refresh",
    GMAIL_FROM_EMAIL: "zac@authichain.com",
    OUTREACH_AUTONOMOUS: "true",
    MAILING_ADDRESS: "123 Example St, Town, ST 00000",
    ...overrides,
  };
  return { env, store };
}

function stubGmail(sendStatus = 200) {
  const sent: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "tok" });
      }
      if (url.endsWith("/messages/send")) {
        const raw = JSON.parse(String(init?.body)).raw as string;
        sent.push(
          new TextDecoder().decode(
            Uint8Array.from(atob(raw.replace(/-/g, "+").replace(/_/g, "/")), c =>
              c.charCodeAt(0)
            )
          )
        );
        return sendStatus === 200
          ? Response.json({ id: "m1", threadId: "t1" })
          : new Response("denied", { status: sendStatus });
      }
      return Response.json({});
    })
  );
  return sent;
}

const good = {
  email: "dana@acmelabs.com",
  name: "Dana Reyes",
  company: "Acme Labs",
  verificationSource: "apollo_verified",
};

afterEach(() => vi.unstubAllGlobals());

describe("outreach-loop lead rules", () => {
  it("accepts a verified, named person at a company", () => {
    expect(leadSendBlockers(good)).toEqual([]);
  });

  it("refuses unverified, government, nameless and companyless leads", () => {
    expect(leadSendBlockers({ ...good, verificationSource: undefined })).toContain(
      "untrusted_source:unknown"
    );
    expect(leadSendBlockers({ ...good, email: "tracking@dea.gov" })).toContain(
      "government_or_military_address"
    );
    expect(leadSendBlockers({ ...good, name: "Director" })).toContain("name_not_human");
    expect(leadSendBlockers({ ...good, company: "" })).toContain("missing_company");
  });

  it("enqueue suppresses a lead with no provenance", async () => {
    const { env } = fakeEnv();
    const r = await enqueueLeads(env, [{ ...good, verificationSource: undefined }]);
    expect(r.queued).toBe(0);
    expect(r.rejected[0].reasons).toContain("untrusted_source:unknown");
  });
});

describe("outreach-loop sending", () => {
  it("sends truthful copy with a postal address and a working opt-out", async () => {
    const { env } = fakeEnv();
    const sent = stubGmail();
    await enqueueLeads(env, [good]);
    const r = await runOutreachSend(env);
    expect(r.sent).toBe(1);
    const msg = sent[0];
    expect(msg).toContain("Hi Dana,");
    expect(msg).toContain("123 Example St");
    expect(msg).toContain('reply "unsubscribe"');
    expect(msg).toContain("List-Unsubscribe: <mailto:zac@authichain.com?subject=unsubscribe>");
    expect(msg).not.toMatch(/contact\?unsub=|Hi there|your company|roadmap/);
  });

  it("fails closed without a postal address", async () => {
    const { env, store } = fakeEnv({ MAILING_ADDRESS: "" });
    const sent = stubGmail();
    await enqueueLeads(env, [good]);
    const r = await runOutreachSend(env);
    expect(sent).toHaveLength(0);
    expect(r.sent).toBe(0);
    expect(r.aborted).toBe("mailing_address_not_configured");
    // The lead is untouched and still queued for once the address is set.
    expect(JSON.parse(store.get("outreach:queue")!)).toEqual(["dana@acmelabs.com"]);
    expect(JSON.parse(store.get("outreach:lead:dana@acmelabs.com")!).status).toBe("queued");
  });

  it("stops on a Gmail auth error and leaves the queue untouched", async () => {
    const { env, store } = fakeEnv();
    stubGmail(401);
    await enqueueLeads(env, [good, { ...good, email: "sam@acmelabs.com", name: "Sam Lee" }]);
    const r = await runOutreachSend(env);
    expect(r.aborted).toContain("gmail_send_401");
    expect(JSON.parse(store.get("outreach:queue")!)).toEqual([
      "dana@acmelabs.com",
      "sam@acmelabs.com",
    ]);
    expect(JSON.parse(store.get("outreach:lead:dana@acmelabs.com")!).status).toBe("queued");
  });
});

describe("outreach-loop replies", () => {
  const on = { OUTREACH_AUTONOMOUS: "true", OUTREACH_AUTO_NURTURE: "true" } as const;

  it("never auto-answers unless explicitly enabled", () => {
    const { env } = fakeEnv();
    expect(shouldAutoNurture(env, "Yes, interested, let's talk")).toBe(false);
  });

  it("does not read a negated keyword as a yes", () => {
    const { env } = fakeEnv(on);
    expect(shouldAutoNurture(env, "Please don't call me")).toBe(false);
    expect(shouldAutoNurture(env, "I'm not available this month")).toBe(false);
    expect(shouldAutoNurture(env, "Not interested")).toBe(false);
    expect(shouldAutoNurture(env, "Yes, sounds good, let's talk Tuesday")).toBe(true);
  });

  it("an unsubscribe reply suppresses the lead", async () => {
    const { env, store } = fakeEnv();
    stubGmail();
    const r = await processInboundReply(env, { from: "dana@acmelabs.com", snippet: "unsubscribe" });
    expect(r.action).toBe("suppressed");
    expect(JSON.parse(store.get("outreach:lead:dana@acmelabs.com")!).status).toBe("suppressed");
  });
});
