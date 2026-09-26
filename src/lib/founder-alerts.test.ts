import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FOUNDER_CLICK,
  FOUNDER_SMS_E164,
  FOUNDER_SMS_GATEWAYS,
  NTFY_URL,
  ntfyHeaders,
  publishFounderAlert,
  smsBody,
} from "./founder-alerts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("founder SMS channel", () => {
  it("targets Verizon only for +1 989-505-6723", () => {
    expect(FOUNDER_SMS_E164).toBe("+19895056723");
    expect(FOUNDER_SMS_GATEWAYS).toEqual(["9895056723@vtext.com"]);
  });

  it("truncates SMS to 160 chars", () => {
    const text = "x".repeat(400);
    const body = smsBody({ title: "T", text, subject: "S" });
    expect(body.length).toBe(160);
    expect(body.endsWith("...")).toBe(true);
  });
});

describe("ntfyHeaders", () => {
  it("sets click + priority 4 for drafts", () => {
    const headers = ntfyHeaders({ title: "DreamDash draft", text: "x", subject: "s", kind: "draft" });
    expect(headers.Click).toBe(FOUNDER_CLICK);
    expect(headers.Priority).toBe("4");
    expect(headers.Tags).toBe("envelope");
    expect(headers.Authorization).toBeUndefined();
  });

  it("sets priority 3 for digest and bearer when token bound", () => {
    const headers = ntfyHeaders(
      { title: "DreamDash digest", text: "x", subject: "s", kind: "digest" },
      { NTFY_TOKEN: "tk_test" },
    );
    expect(headers.Priority).toBe("3");
    expect(headers.Authorization).toBe("Bearer tk_test");
  });
});

describe("publishFounderAlert", () => {
  it("POSTs the topic with Title and Click", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await publishFounderAlert({ title: "AuthiChain onboard", text: "company: X", subject: "s", kind: "intake" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(NTFY_URL);
    expect(init.headers.Tags).toBe("inbox_tray");
    expect(init.headers.Click).toBe(FOUNDER_CLICK);
  });
});
