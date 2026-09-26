import { afterEach, describe, expect, it, vi } from "vitest";
import { formatPilotIntakeBody, notifyPilotIntake } from "./onboard-notify";
import { FOUNDER_SMS_GATEWAYS, NTFY_URL } from "../src/lib/founder-alerts";

const payload = {
  company: "Trulieve",
  contact: "Kalee",
  email: "kalee@example.com",
  vertical: "strainchain",
  product: "Jar Seal 01",
  ref: "abcd1234ef",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("notifyPilotIntake", () => {
  it("POSTs the intake fields to ntfy with the onboard title", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyPilotIntake(payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(NTFY_URL);
    expect(init.method).toBe("POST");
    expect(init.headers.Title).toBe("AuthiChain onboard");
    expect(init.body).toContain("company: Trulieve");
    expect(init.body).toContain("contact: Kalee");
    expect(init.body).toContain("email: kalee@example.com");
    expect(init.body).toContain("vertical: strainchain");
    expect(init.body).toContain("product: Jar Seal 01");
    expect(init.body).toContain("ref: abcd1234ef");
    expect(init.body).not.toMatch(/re_|secret|api[_-]?key/i);
  });

  it("sends Resend email and SMS gateways when RESEND_API_KEY2 is bound", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyPilotIntake({
      ...payload,
      env: { RESEND_API_KEY2: "re_test_key2" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const resendCalls = fetchMock.mock.calls.filter(
      ([url]) => url === "https://api.resend.com/emails"
    );
    expect(resendCalls).toHaveLength(2);
    const inbox = JSON.parse(resendCalls[0][1].body);
    const sms = JSON.parse(resendCalls[1][1].body);
    expect(inbox.from).toContain("authichain.com");
    expect(inbox.to).toEqual(["authichain@gmail.com", "undone.k@gmail.com"]);
    expect(inbox.subject).toBe("[onboard] Trulieve abcd1234ef");
    expect(sms.to).toEqual([...FOUNDER_SMS_GATEWAYS]);
  });

  it("uses RESEND_API_KEY when KEY2 is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyPilotIntake({
      ...payload,
      env: { RESEND_API_KEY: "re_test_key" },
    });

    const resendCall = fetchMock.mock.calls.find(
      ([url]) => url === "https://api.resend.com/emails"
    );
    expect(resendCall![1].headers.Authorization).toBe("Bearer re_test_key");
  });

  it("skips Resend when no key is bound", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyPilotIntake({ ...payload, env: {} });

    expect(
      fetchMock.mock.calls.every(([url]) => url !== "https://api.resend.com/emails")
    ).toBe(true);
  });

  it("swallows ntfy and Resend failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(
      notifyPilotIntake({
        ...payload,
        env: { RESEND_API_KEY2: "re_test_key2" },
      })
    ).resolves.toBeUndefined();
  });

  it("does not log the submitter email — only company + ref", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("ok", { status: 200 }))
    );
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });

    await notifyPilotIntake(payload);

    const joined = logs.join("\n");
    expect(joined).toContain("Trulieve");
    expect(joined).toContain("abcd1234ef");
    expect(joined).not.toContain("kalee@example.com");
  });

  it("formats the same field set for ntfy and email", () => {
    const body = formatPilotIntakeBody(payload);
    expect(body.split("\n")).toEqual([
      "company: Trulieve",
      "contact: Kalee",
      "email: kalee@example.com",
      "vertical: strainchain",
      "product: Jar Seal 01",
      "ref: abcd1234ef",
    ]);
  });
});
