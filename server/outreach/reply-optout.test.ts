// @vitest-environment node
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { newReplyText, senderAddress, wantsOptOut } from "./reply-optout";
import { svixSignature, verifySvix } from "./svix-verify";

const QUOTED_ORIGINAL = [
  "On Tue, Sep 23, 2026 at 10:00 AM Zachary <hello@authichain.com> wrote:",
  "> Hi Dana,",
  "> Signed custody records for Acme deliverables...",
  "> Unsubscribe: https://authichain.com/api/outreach/unsubscribe?e=dana%40acme.com&t=abc",
].join("\n");

describe("wantsOptOut", () => {
  it.each([
    ["the mailto opt-out subject", { subject: "unsubscribe", text: "" }],
    [
      "a reply asking to be removed",
      {
        subject: "Re: Signed custody records for Acme deliverables",
        text: `Please remove me from your list.\n\n${QUOTED_ORIGINAL}`,
      },
    ],
    [
      "a plain not interested",
      {
        subject: "Re: Styled QR codes for Acme",
        text: "Not interested, thanks.",
      },
    ],
    ["stop emailing", { subject: "Re: x", text: "Stop emailing me." }],
    [
      "an HTML-only reply",
      {
        subject: "Re: x",
        html: '<div>Please unsubscribe me</div><div class="gmail_quote">On ... wrote: Unsubscribe</div>',
      },
    ],
  ])("recognises %s", (_label, reply) => {
    expect(wantsOptOut(reply)).toBe(true);
  });

  it.each([
    [
      "a positive reply quoting our footer",
      {
        subject: "Re: Signed custody records for Acme deliverables",
        text: `Sounds useful, can we talk Thursday?\n\n${QUOTED_ORIGINAL}`,
      },
    ],
    [
      "a question with > quoted lines",
      {
        subject: "Re: x",
        text: "What does it cost?\n> Unsubscribe: https://x",
      },
    ],
    [
      "an Outlook reply with the original below",
      {
        subject: "RE: x",
        text: "Send me the docs.\n-----Original Message-----\nUnsubscribe: https://x",
      },
    ],
    [
      "our own subject line",
      { subject: "Re: Partnership question: QRON and Acme", text: "" },
    ],
  ])("ignores %s", (_label, reply) => {
    expect(wantsOptOut(reply)).toBe(false);
  });

  it("only reads the new part of the reply", () => {
    expect(newReplyText(`Hi\n${QUOTED_ORIGINAL}`)).toBe("Hi");
  });
});

describe("senderAddress", () => {
  it.each([
    ["Dana Lee <Dana@AcmeLabs.com>", "dana@acmelabs.com"],
    ["<dana@acmelabs.com>", "dana@acmelabs.com"],
    ["dana@acmelabs.com", "dana@acmelabs.com"],
    [{ email: "Dana@acmelabs.com", name: "Dana" }, "dana@acmelabs.com"],
  ])("parses %j", (from, expected) => {
    expect(senderAddress(from)).toBe(expected);
  });

  it("rejects junk", () => {
    for (const from of ["", "Dana", "<not an address>", null, 42]) {
      expect(senderAddress(from)).toBeNull();
    }
  });
});

describe("verifySvix", () => {
  const key = Buffer.from("resend-test-signing-key-32-bytes!").toString(
    "base64"
  );
  const secret = `whsec_${key}`;
  const body = JSON.stringify({
    type: "email.received",
    data: { email_id: "e1" },
  });
  const now = 1_790_000_000_000;
  const ts = String(Math.floor(now / 1000));

  it("matches an independent HMAC per the Svix scheme", async () => {
    const expected = createHmac("sha256", Buffer.from(key, "base64"))
      .update(`msg_1.${ts}.${body}`)
      .digest("base64");
    expect(await svixSignature(secret, "msg_1", ts, body)).toBe(expected);
  });

  it("accepts a valid signature among several", async () => {
    const sig = await svixSignature(secret, "msg_1", ts, body);
    const r = await verifySvix({
      secret,
      id: "msg_1",
      timestamp: ts,
      signature: `v1,bogus v1,${sig}`,
      body,
      now,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a modified body, a stale timestamp and missing headers", async () => {
    const sig = await svixSignature(secret, "msg_1", ts, body);
    expect(
      (
        await verifySvix({
          secret,
          id: "msg_1",
          timestamp: ts,
          signature: `v1,${sig}`,
          body: body + " ",
          now,
        })
      ).ok
    ).toBe(false);
    expect(
      await verifySvix({
        secret,
        id: "msg_1",
        timestamp: ts,
        signature: `v1,${sig}`,
        body,
        now: now + 10 * 60_000,
      })
    ).toEqual({ ok: false, reason: "stale_timestamp" });
    expect(
      await verifySvix({
        secret,
        id: null,
        timestamp: ts,
        signature: `v1,${sig}`,
        body,
        now,
      })
    ).toEqual({ ok: false, reason: "missing_headers" });
  });
});
