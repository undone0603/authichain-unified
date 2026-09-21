import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FOUNDER_INBOXES,
  formatDraftAlert,
  newlyDrafted,
  notifyDigest,
  notifyDraft,
} from "./notify-draft";
import { FOUNDER_SMS_GATEWAYS, NTFY_URL } from "@/lib/founder-alerts";
import type { Lead } from "./types";

function lead(partial: Partial<Lead> & Pick<Lead, "id" | "email">): Lead {
  return {
    name: "Alex Founder",
    title: "CEO",
    company: partial.company ?? "Acme Co",
    domain: "authichain",
    stage: "contacted",
    score: 62,
    value: 15000,
    city: "Detroit",
    notes: "",
    lastTouch: "2026-09-21T14:00:00.000Z",
    createdAt: "2026-09-21T14:00:00.000Z",
    draftPending: true,
    activities: [],
    lost: false,
    source: "inbound",
    ...partial,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("newlyDrafted", () => {
  it("returns only leads that flipped draftPending on", () => {
    const prev = [
      lead({ id: "a", email: "a@x.test", draftPending: false }),
      lead({ id: "b", email: "b@x.test", draftPending: true, company: "Already" }),
    ];
    const next = [
      lead({ id: "a", email: "a@x.test", draftPending: true }),
      lead({ id: "b", email: "b@x.test", draftPending: true, company: "Already" }),
      lead({ id: "c", email: "c@x.test", draftPending: true, company: "New Co" }),
    ];
    expect(newlyDrafted(prev, next).map((l) => l.id)).toEqual(["a", "c"]);
  });

  it("skips lost leads", () => {
    const next = [lead({ id: "z", email: "z@x.test", draftPending: true, lost: true })];
    expect(newlyDrafted([], next)).toEqual([]);
  });
});

describe("formatDraftAlert", () => {
  it("includes mailto and never targets the lead as a recipient list", () => {
    const alert = formatDraftAlert(lead({ id: "a", email: "buyer@acme.test" }), "cycle");
    expect(alert.text).toContain("buyer@acme.test");
    expect(alert.text).toContain("mailto:buyer%40acme.test");
    expect(alert.text).toContain("Founder-only");
    expect(alert.subject).toContain("Acme Co");
    expect(FOUNDER_INBOXES).toEqual(["authichain@gmail.com", "undone.k@gmail.com"]);
    expect(FOUNDER_INBOXES).not.toContain("buyer@acme.test");
  });
});

describe("notifyDraft", () => {
  it("POSTs ntfy and skips Resend without a key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await notifyDraft(lead({ id: "a", email: "a@x.test" }), "followup");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(NTFY_URL);
    expect(init.headers.Title).toContain("Acme Co");
    expect(init.body).toContain("reason: followup");
    expect(init.body).not.toMatch(/re_|secret|api[_-]?key/i);
  });

  it("sends Resend to founder inboxes and SMS gateways", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await notifyDraft(lead({ id: "a", email: "buyer@acme.test" }), "capture", {
      RESEND_API_KEY2: "re_test_key2",
    });
    const resendCalls = fetchMock.mock.calls.filter(([url]) => url === "https://api.resend.com/emails");
    expect(resendCalls).toHaveLength(2);
    const inbox = JSON.parse(resendCalls[0][1].body);
    const sms = JSON.parse(resendCalls[1][1].body);
    expect(inbox.to).toEqual(["authichain@gmail.com", "undone.k@gmail.com"]);
    expect(inbox.to).not.toContain("buyer@acme.test");
    expect(sms.to).toEqual([...FOUNDER_SMS_GATEWAYS]);
    expect(sms.text.length).toBeLessThanOrEqual(160);
  });

  it("no-ops when draftPending is false", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await notifyDraft(lead({ id: "a", email: "a@x.test", draftPending: false }), "cycle");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("notifyDigest", () => {
  it("posts the digest body to ntfy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await notifyDigest("Founders digest — Mon\n\nEstate: 0 leads");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers.Title).toBe("DreamDash digest");
    expect(fetchMock.mock.calls[0][1].body).toContain("Estate: 0 leads");
  });
});
