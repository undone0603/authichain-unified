import { describe, expect, it } from "vitest";
import {
  tryHandleEmailOptin, emailOptinBlock, confirmEmailText, PURGE_SQL, UPSERT_SQL, RATE_SQL, RATE_MAX,
  EMAIL_OPTIN_CONSENT_TEXT, EMAIL_OPTIN_PRIVACY_LINE, EMAIL_OPTIN_PRIVACY_LINE_IS_THIS_REAL, type D1Like,
} from "./email-optin";
import { renderDppCheckPage } from "./dpp-check-page";
import { renderIsThisRealPage } from "./is-this-real-page";

type Opts = { upsertChanges?: number; hits?: number; throwOn?: string };
function fakeDb(o: Opts = {}) {
  const calls: { sql: string; args: unknown[] }[] = [];
  const db: D1Like = {
    prepare: sql => ({
      bind: (...args) => ({
        run: async () => {
          calls.push({ sql, args });
          if (o.throwOn && sql.includes(o.throwOn)) throw new Error("d1 down");
          return { meta: { changes: sql === UPSERT_SQL ? (o.upsertChanges ?? 1) : 0 } };
        },
        first: async <T,>() => {
          calls.push({ sql, args });
          if (o.throwOn && sql.includes(o.throwOn)) throw new Error("d1 down");
          return { hits: o.hits ?? 1 } as T;
        },
      }),
    }),
  };
  return { db, calls };
}
const ORIGIN = "https://authichain.com";
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://authichain.com/api/email-optin", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "cf-connecting-ip": "203.0.113.9", ...headers },
    body: JSON.stringify(body),
  });
const ok = { email: "a@b.co", consent: "yes" };
function mockFetch() {
  const sent: { url: string; body: any }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)) });
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  return { sent, f };
}
const ON = { RESEND_API_KEY: "test-key", EMAIL_OPTIN_SEND_ENABLED: "true" };

describe("email opt-in", () => {
  it("ignores other paths", async () => {
    expect(await tryHandleEmailOptin(new Request("https://authichain.com/dpp-check"), {})).toBeNull();
  });
  it("requires consent and a valid email, writes nothing otherwise", async () => {
    const { db, calls } = fakeDb();
    expect((await tryHandleEmailOptin(post({ email: "a@b.co" }), { DB: db }))!.status).toBe(400);
    expect((await tryHandleEmailOptin(post({ email: "nope", consent: "yes" }), { DB: db }))!.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("rejects POST without an allowed Origin", async () => {
    const { db, calls } = fakeDb();
    expect((await tryHandleEmailOptin(post(ok, { origin: "https://evil.example" }), { DB: db }))!.status).toBe(403);
    const noOrigin = new Request("https://authichain.com/api/email-optin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ok) });
    expect((await tryHandleEmailOptin(noOrigin, { DB: db }))!.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it("stores only email, consent time, pending status and a token hash; purges first", async () => {
    const { db, calls } = fakeDb();
    const r = await tryHandleEmailOptin(post({ email: " A@B.co ", consent: "yes", name: "x" }), { DB: db }, new Date("2026-10-23T12:00:00Z"));
    expect(r!.status).toBe(202);
    expect(calls.map(c => c.sql)).toContain(PURGE_SQL);
    const up = calls.find(c => c.sql === UPSERT_SQL)!;
    expect(up.args).toEqual(["a@b.co", "2026-10-23 12:00:00", expect.stringMatching(/^[a-f0-9]{64}$/)]);
    expect(PURGE_SQL).toContain("-30 days");
  });
  it("per-IP rate limit returns 429 above RATE_MAX and never upserts", async () => {
    const { db, calls } = fakeDb({ hits: RATE_MAX + 1 });
    const { sent, f } = mockFetch();
    expect((await tryHandleEmailOptin(post(ok), { DB: db, ...ON }, new Date(), f))!.status).toBe(429);
    expect(calls.some(c => c.sql === UPSERT_SQL)).toBe(false);
    expect(sent).toHaveLength(0);
    const rate = calls.find(c => c.sql === RATE_SQL)!;
    expect(rate.args[0]).not.toContain("203.0.113.9");
  });
  it("10-minute resend floor: upsert only refreshes rows older than 10 minutes; no send when changes = 0", async () => {
    expect(UPSERT_SQL).toContain("-10 minutes");
    const { db } = fakeDb({ upsertChanges: 0 });
    const { sent, f } = mockFetch();
    expect((await tryHandleEmailOptin(post(ok), { DB: db, ...ON }, new Date(), f))!.status).toBe(202);
    expect(sent).toHaveLength(0);
  });
  it("D1 failures return 503 {ok:false}", async () => {
    for (const t of ["email_optin_rate", "DELETE FROM email_optins", "INSERT INTO email_optins"]) {
      const { db } = fakeDb({ throwOn: t });
      const r = await tryHandleEmailOptin(post(ok), { DB: db });
      expect(r!.status).toBe(503);
      expect((await r!.json()).ok).toBe(false);
    }
    const { db } = fakeDb({ throwOn: "UPDATE email_optins" });
    const form = new FormData(); form.set("token", "a".repeat(64));
    const r = await tryHandleEmailOptin(new Request("https://authichain.com/api/email-optin/confirm", { method: "POST", body: form }), { DB: db });
    expect(r!.status).toBe(503);
    expect((await r!.json()).ok).toBe(false);
  });
  it("confirm: GET only shows a button that POSTs; POST hashes the token and confirms", async () => {
    const { db, calls } = fakeDb();
    const tok = "a".repeat(64);
    const g = await tryHandleEmailOptin(new Request("https://authichain.com/api/email-optin/confirm?token=" + tok), { DB: db });
    expect(g!.status).toBe(200);
    const page = await g!.text();
    expect(page).toContain('method="post"');
    expect(page).toContain(`name="token" value="${tok}"`);
    expect(calls).toHaveLength(0);
    const form = new FormData(); form.set("token", tok);
    const p = await tryHandleEmailOptin(new Request("https://authichain.com/api/email-optin/confirm", { method: "POST", body: form }), { DB: db });
    expect(p!.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(calls[0].args[0]).not.toBe(tok);
    expect((await tryHandleEmailOptin(new Request("https://authichain.com/api/email-optin/confirm?token=x"), { DB: db }))!.status).toBe(400);
  });
  it("plain form POST (no JS, e.g. /dpp-check) gets HTML, not raw JSON", async () => {
    const { db } = fakeDb();
    const form = new URLSearchParams({ email: "a@b.co", consent: "yes" });
    const r = await tryHandleEmailOptin(new Request("https://authichain.com/api/email-optin", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: ORIGIN }, body: form,
    }), { DB: db });
    expect(r!.status).toBe(202);
    expect(r!.headers.get("content-type")).toContain("text/html");
    expect(await r!.text()).not.toContain('{"ok"');
  });
  it("flag off (default) or no key: nothing sends", async () => {
    for (const env of [{ RESEND_API_KEY: "k" }, { EMAIL_OPTIN_SEND_ENABLED: "true" }, { EMAIL_OPTIN_SEND_ENABLED: "false", RESEND_API_KEY: "k" }]) {
      const { db } = fakeDb();
      const { sent, f } = mockFetch();
      expect((await tryHandleEmailOptin(post(ok), { DB: db, ...env }, new Date(), f))!.status).toBe(202);
      expect(sent).toHaveLength(0);
    }
  });
  it("flag on + key + changes > 0: exactly one transactional email with the confirm link", async () => {
    const { db, calls } = fakeDb();
    const { sent, f } = mockFetch();
    expect((await tryHandleEmailOptin(post(ok), { DB: db, ...ON }, new Date(), f))!.status).toBe(202);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://api.resend.com/emails");
    expect(sent[0].body.from).toBe("AuthiChain <no-reply@mail.authichain.com>");
    expect(sent[0].body.subject).toBe("Confirm your email for AuthiChain");
    expect(sent[0].body.to).toEqual(["a@b.co"]);
    expect(sent[0].body.html).toBeUndefined();
    const token = sent[0].body.text.match(/token=([a-f0-9]{64})/)[1];
    expect(sent[0].body.text).toBe(confirmEmailText(token));
    expect(calls.find(c => c.sql === UPSERT_SQL)!.args[2]).not.toBe(token);
    expect(JSON.stringify(sent[0].body)).not.toMatch(/strainchain/);
  });
  it("Research wording is byte-identical to gate PR2013-b2dbd98d", () => {
    expect(EMAIL_OPTIN_CONSENT_TEXT).toBe("Optional: email me AuthiChain product updates, at most once a month. We will first send one email asking you to confirm. To unsubscribe at any time, email authichain@mail.grokbot.com.");
    expect(EMAIL_OPTIN_PRIVACY_LINE_IS_THIS_REAL).toBe('If you tick the box, we store your email, the first seal ID you check, the page address, when you agreed, and whether you confirmed. We send updates only after you confirm, and the confirm link expires after 30 days. We keep the record until you ask us to delete it at authichain@mail.grokbot.com. See the <a href="/privacy">privacy policy</a>.');
    expect(confirmEmailText("TOK")).toBe("Someone entered this email address on authichain.com and asked for AuthiChain product updates (at most once a month).\n\nTo confirm, open this link (valid for 30 days):\n\nhttps://authichain.com/api/email-optin/confirm?token=TOK\n\nIf you did not ask for this, ignore this email. Unless you confirm, we will not send you anything else.");
  });
  it("served consent text never contains PLACEHOLDER (both pages)", () => {
    const dpp = renderDppCheckPage(new URL("https://authichain.com/dpp-check?category=battery_passport&sells_in_eu=yes"));
    const itr = renderIsThisRealPage();
    for (const h of [dpp, itr, emailOptinBlock("t")]) {
      expect(h).not.toMatch(/PLACEHOLDER|Research to check/);
      expect(h).toContain(EMAIL_OPTIN_CONSENT_TEXT);
    }
    expect(itr).toContain(EMAIL_OPTIN_PRIVACY_LINE_IS_THIS_REAL);
    expect(dpp).toContain(EMAIL_OPTIN_PRIVACY_LINE);
    expect(EMAIL_OPTIN_PRIVACY_LINE).toBe('We store only your email, when you agreed, and whether you confirmed. We send updates only after you confirm, and the confirm link expires after 30 days. To delete your email, write to authichain@mail.grokbot.com. See the <a href="/privacy">privacy policy</a>.');
    expect(dpp).not.toContain("first seal ID");
  });
  it("UI block: optional email, unchecked consent, privacy link", () => {
    const h = emailOptinBlock("t");
    expect(h).not.toMatch(/\brequired\b|\bchecked\b(?!\))/);
    expect(h).toContain('href="/privacy"');
  });
  it("free DPP check still renders a result with no email given", () => {
    const html = renderDppCheckPage(new URL("https://authichain.com/dpp-check?category=battery_passport&sells_in_eu=yes"));
    expect(html).toContain("Your result:");
    expect(html).toContain('id="dpp-email-optin"');
  });
});
