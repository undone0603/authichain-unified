import { describe, expect, it } from "vitest";
import {
  tryHandleEmailOptin,
  emailOptinBlock,
  confirmEmailText,
  PURGE_SQL,
  UPSERT_SQL,
  UNSUBSCRIBE_SQL,
  CONFIRMED_FOR_MARKETING_SQL,
  unsubscribeFooter,
  unsubscribeHeaders,
  normalizeCountry,
  canReceiveMarketing,
  sendUpdateEmail,
  sendOptinMail,
  isEmailOptinPath,
  RATE_SQL,
  RATE_MAX,
  EMAIL_UNSUBSCRIBE_MAILTO,
  EMAIL_OPTIN_CONSENT_TEXT,
  EMAIL_OPTIN_PRIVACY_LINE,
  EMAIL_OPTIN_PRIVACY_LINE_IS_THIS_REAL,
  type D1Like,
} from "./email-optin";
import { renderDppCheckPage } from "./dpp-check-page";
import { renderIsThisRealPage } from "./is-this-real-page";

type Opts = {
  upsertChanges?: number;
  unsubChanges?: number;
  hits?: number;
  throwOn?: string;
};
function fakeDb(o: Opts = {}) {
  const calls: { sql: string; args: unknown[] }[] = [];
  const db: D1Like = {
    prepare: sql => ({
      bind: (...args) => ({
        run: async () => {
          calls.push({ sql, args });
          if (o.throwOn && sql.includes(o.throwOn)) throw new Error("d1 down");
          return {
            meta: {
              changes:
                sql === UPSERT_SQL
                  ? (o.upsertChanges ?? 1)
                  : sql === UNSUBSCRIBE_SQL
                    ? (o.unsubChanges ?? 1)
                    : 0,
            },
          };
        },
        first: async <T>() => {
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
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      "cf-connecting-ip": "203.0.113.9",
      ...headers,
    },
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
    expect(
      await tryHandleEmailOptin(
        new Request("https://authichain.com/dpp-check"),
        {}
      )
    ).toBeNull();
  });
  it("requires consent and a valid email, writes nothing otherwise", async () => {
    const { db, calls } = fakeDb();
    expect(
      (await tryHandleEmailOptin(post({ email: "a@b.co" }), { DB: db }))!.status
    ).toBe(400);
    expect(
      (await tryHandleEmailOptin(post({ email: "nope", consent: "yes" }), {
        DB: db,
      }))!.status
    ).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("rejects POST without an allowed Origin", async () => {
    const { db, calls } = fakeDb();
    expect(
      (await tryHandleEmailOptin(post(ok, { origin: "https://evil.example" }), {
        DB: db,
      }))!.status
    ).toBe(403);
    const noOrigin = new Request("https://authichain.com/api/email-optin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ok),
    });
    expect((await tryHandleEmailOptin(noOrigin, { DB: db }))!.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it("stores only email, consent time, pending status and a token hash; purges first", async () => {
    const { db, calls } = fakeDb();
    const r = await tryHandleEmailOptin(
      post({ email: " A@B.co ", consent: "yes", name: "x" }),
      { DB: db },
      new Date("2026-10-23T12:00:00Z")
    );
    expect(r!.status).toBe(202);
    expect(calls.map(c => c.sql)).toContain(PURGE_SQL);
    const up = calls.find(c => c.sql === UPSERT_SQL)!;
    expect(up.args).toEqual([
      "a@b.co",
      "2026-10-23 12:00:00",
      expect.stringMatching(/^[a-f0-9]{64}$/),
      null,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    ]);
    expect(PURGE_SQL).toContain("-30 days");
  });
  it("per-IP rate limit returns 429 above RATE_MAX and never upserts", async () => {
    const { db, calls } = fakeDb({ hits: RATE_MAX + 1 });
    const { sent, f } = mockFetch();
    expect(
      (await tryHandleEmailOptin(post(ok), { DB: db, ...ON }, new Date(), f))!
        .status
    ).toBe(429);
    expect(calls.some(c => c.sql === UPSERT_SQL)).toBe(false);
    expect(sent).toHaveLength(0);
    const rate = calls.find(c => c.sql === RATE_SQL)!;
    expect(rate.args[0]).not.toContain("203.0.113.9");
  });
  it("10-minute resend floor: upsert only refreshes rows older than 10 minutes; no send when changes = 0", async () => {
    expect(UPSERT_SQL).toContain("-10 minutes");
    const { db } = fakeDb({ upsertChanges: 0 });
    const { sent, f } = mockFetch();
    expect(
      (await tryHandleEmailOptin(post(ok), { DB: db, ...ON }, new Date(), f))!
        .status
    ).toBe(202);
    expect(sent).toHaveLength(0);
  });
  it("D1 failures return 503 {ok:false}", async () => {
    for (const t of [
      "email_optin_rate",
      "DELETE FROM email_optins",
      "INSERT INTO email_optins",
    ]) {
      const { db } = fakeDb({ throwOn: t });
      const r = await tryHandleEmailOptin(post(ok), { DB: db });
      expect(r!.status).toBe(503);
      expect((await r!.json()).ok).toBe(false);
    }
    const { db } = fakeDb({ throwOn: "UPDATE email_optins" });
    const form = new FormData();
    form.set("token", "a".repeat(64));
    const r = await tryHandleEmailOptin(
      new Request("https://authichain.com/api/email-optin/confirm", {
        method: "POST",
        body: form,
      }),
      { DB: db }
    );
    expect(r!.status).toBe(503);
    expect((await r!.json()).ok).toBe(false);
  });
  it("confirm: GET only shows a button that POSTs; POST hashes the token and confirms", async () => {
    const { db, calls } = fakeDb();
    const tok = "a".repeat(64);
    const g = await tryHandleEmailOptin(
      new Request(
        "https://authichain.com/api/email-optin/confirm?token=" + tok
      ),
      { DB: db }
    );
    expect(g!.status).toBe(200);
    const page = await g!.text();
    expect(page).toContain('method="post"');
    expect(page).toContain(`name="token" value="${tok}"`);
    expect(calls).toHaveLength(0);
    const form = new FormData();
    form.set("token", tok);
    const p = await tryHandleEmailOptin(
      new Request("https://authichain.com/api/email-optin/confirm", {
        method: "POST",
        body: form,
      }),
      { DB: db }
    );
    expect(p!.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(calls[0].args[0]).not.toBe(tok);
    expect(
      (await tryHandleEmailOptin(
        new Request("https://authichain.com/api/email-optin/confirm?token=x"),
        { DB: db }
      ))!.status
    ).toBe(400);
  });
  it("plain form POST (no JS, e.g. /dpp-check) gets HTML, not raw JSON", async () => {
    const { db } = fakeDb();
    const form = new URLSearchParams({ email: "a@b.co", consent: "yes" });
    const r = await tryHandleEmailOptin(
      new Request("https://authichain.com/api/email-optin", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: ORIGIN,
        },
        body: form,
      }),
      { DB: db }
    );
    expect(r!.status).toBe(202);
    expect(r!.headers.get("content-type")).toContain("text/html");
    expect(await r!.text()).not.toContain('{"ok"');
  });
  it("flag off (default) or no key: nothing sends", async () => {
    for (const env of [
      { RESEND_API_KEY: "k" },
      { EMAIL_OPTIN_SEND_ENABLED: "true" },
      { EMAIL_OPTIN_SEND_ENABLED: "false", RESEND_API_KEY: "k" },
    ]) {
      const { db } = fakeDb();
      const { sent, f } = mockFetch();
      expect(
        (await tryHandleEmailOptin(
          post(ok),
          { DB: db, ...env },
          new Date(),
          f
        ))!.status
      ).toBe(202);
      expect(sent).toHaveLength(0);
    }
  });
  it("flag on + key + changes > 0: exactly one transactional email with the confirm link", async () => {
    const { db, calls } = fakeDb();
    const { sent, f } = mockFetch();
    expect(
      (await tryHandleEmailOptin(post(ok), { DB: db, ...ON }, new Date(), f))!
        .status
    ).toBe(202);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://api.resend.com/emails");
    expect(sent[0].body.from).toBe("AuthiChain <no-reply@mail.authichain.com>");
    expect(sent[0].body.subject).toBe("Confirm your email for AuthiChain");
    expect(sent[0].body.to).toEqual(["a@b.co"]);
    expect(sent[0].body.html).toBeUndefined();
    const token = sent[0].body.text.match(/confirm\?token=([a-f0-9]{64})/)[1];
    const unsub = sent[0].body.text.match(
      /unsubscribe\?token=([a-f0-9]{64})/
    )[1];
    expect(sent[0].body.text).toBe(
      confirmEmailText(token) + unsubscribeFooter(unsub)
    );
    expect(calls.find(c => c.sql === UPSERT_SQL)!.args[4]).toBe(unsub);
    expect(calls.find(c => c.sql === UPSERT_SQL)!.args[2]).not.toBe(token);
    expect(JSON.stringify(sent[0].body)).not.toMatch(/strainchain/);
  });
  it("Research wording is byte-identical to gate PR2013-b2dbd98d", () => {
    expect(EMAIL_OPTIN_CONSENT_TEXT).toBe(
      "Optional: email me AuthiChain product updates, at most once a month. We will first send one email asking you to confirm. To unsubscribe at any time, email authichain@mail.grokbot.com."
    );
    expect(EMAIL_OPTIN_PRIVACY_LINE_IS_THIS_REAL).toBe(
      'If you tick the box, we store your email, the first seal ID you check, the page address, your country if you give it, when you agreed, and whether you confirmed. We send updates only after you confirm, and the confirm link expires after 30 days. Unconfirmed sign-ups may be removed from our mailing list after 30 days; we keep a copy of the sign-up until you ask us to delete it at authichain@mail.grokbot.com. See the <a href="/privacy">privacy policy</a>.'
    );
    expect(confirmEmailText("TOK")).toBe(
      "Someone entered this email address on authichain.com and asked for AuthiChain product updates (at most once a month).\n\nTo confirm, open this link (valid for 30 days):\n\nhttps://authichain.com/api/email-optin/confirm?token=TOK\n\nIf you did not ask for this, ignore this email. Unless you confirm, we will not send you anything else."
    );
  });
  it("served consent text never contains PLACEHOLDER (both pages)", () => {
    const dpp = renderDppCheckPage(
      new URL(
        "https://authichain.com/dpp-check?category=battery_passport&sells_in_eu=yes"
      )
    );
    const itr = renderIsThisRealPage();
    for (const h of [dpp, itr, emailOptinBlock("t")]) {
      expect(h).not.toMatch(/PLACEHOLDER|Research to check/);
      expect(h).toContain(EMAIL_OPTIN_CONSENT_TEXT);
    }
    expect(itr).toContain(EMAIL_OPTIN_PRIVACY_LINE_IS_THIS_REAL);
    expect(dpp).toContain(EMAIL_OPTIN_PRIVACY_LINE);
    expect(EMAIL_OPTIN_PRIVACY_LINE).toBe(
      'We store only your email, your country if you give it, when you agreed, and whether you confirmed. We send updates only after you confirm, and the confirm link expires after 30 days. Unconfirmed sign-ups may be deleted after 30 days, and you can ask us to delete yours at any time at authichain@mail.grokbot.com. See the <a href="/privacy">privacy policy</a>.'
    );
    expect(dpp).not.toContain("first seal ID");
  });
  it("UI block: optional email, unchecked consent, privacy link", () => {
    const h = emailOptinBlock("t");
    expect(h).not.toMatch(/\brequired\b|\bchecked\b(?!\))/);
    expect(h).toContain('href="/privacy"');
  });
  it("free DPP check still renders a result with no email given", () => {
    const html = renderDppCheckPage(
      new URL(
        "https://authichain.com/dpp-check?category=battery_passport&sells_in_eu=yes"
      )
    );
    expect(html).toContain("Your result:");
    expect(html).toContain('id="dpp-email-optin"');
  });

  it("country: optional, uppercased, ISO alpha-2 only; stored on insert", async () => {
    expect(normalizeCountry(undefined)).toBeNull();
    expect(normalizeCountry("")).toBeNull();
    expect(normalizeCountry(" us ")).toBe("US");
    for (const bad of ["USA", "U", "1A", "u$", 12])
      expect(normalizeCountry(bad)).toBeUndefined();
    const { db, calls } = fakeDb();
    expect(
      (await tryHandleEmailOptin(post({ ...ok, country: "us" }), { DB: db }))!
        .status
    ).toBe(202);
    expect(calls.find(c => c.sql === UPSERT_SQL)!.args[3]).toBe("US");
    const bad = fakeDb();
    const r = await tryHandleEmailOptin(post({ ...ok, country: "USA" }), {
      DB: bad.db,
    });
    expect(r!.status).toBe(400);
    expect((await r!.json()).error).toBe("invalid_country");
    expect(bad.calls).toHaveLength(0);
  });
  it("both opt-in forms have a 2-letter country field", () => {
    const dpp = renderDppCheckPage(
      new URL(
        "https://authichain.com/dpp-check?category=battery_passport&sells_in_eu=yes"
      )
    );
    for (const h of [dpp, renderIsThisRealPage()]) {
      expect(h).toMatch(
        /name="country" maxlength="2" pattern="\[A-Za-z\]\{2\}"/
      );
      expect(h).toContain("country:");
    }
  });
  it("unsubscribe: GET shows a confirm button and never changes the DB", async () => {
    const { db, calls } = fakeDb();
    const tok = "b".repeat(64);
    const r = await tryHandleEmailOptin(
      new Request("https://authichain.com/email/unsubscribe?token=" + tok),
      { DB: db }
    );
    expect(r!.status).toBe(200);
    const h = await r!.text();
    expect(h).toContain("<h1>Unsubscribe</h1>");
    expect(h).toContain("Click the button to stop emails to this address.");
    expect(h).toContain(
      `<form method="post" action="/email/unsubscribe"><input type="hidden" name="token" value="${tok}"><button type="submit">Unsubscribe</button></form>`
    );
    expect(h).not.toContain("You are unsubscribed.");
    expect(calls).toHaveLength(0);
    // Unknown token on GET: same page, still no DB call (no existence leak).
    const miss = fakeDb({ unsubChanges: 0 });
    const u = await tryHandleEmailOptin(
      new Request(
        "https://authichain.com/email/unsubscribe?token=" + "c".repeat(64)
      ),
      { DB: miss.db }
    );
    expect(u!.status).toBe(200);
    expect(miss.calls).toHaveLength(0);
  });
  it("unsubscribe: POST from the button (form token) flips status to unsubscribed", async () => {
    const { db, calls } = fakeDb();
    const tok = "b".repeat(64);
    const r = await tryHandleEmailOptin(
      new Request("https://authichain.com/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "token=" + tok,
      }),
      { DB: db }
    );
    expect(r!.status).toBe(200);
    expect(await r!.text()).toContain("You are unsubscribed.");
    expect(calls).toEqual([{ sql: UNSUBSCRIBE_SQL, args: [tok] }]);
    expect(UNSUBSCRIBE_SQL).toContain("status = 'unsubscribed'");
  });
  it("unsubscribe: RFC 8058 one-click POST (query token, List-Unsubscribe=One-Click body) works", async () => {
    const { db, calls } = fakeDb();
    const tok = "d".repeat(64);
    const p = await tryHandleEmailOptin(
      new Request("https://authichain.com/email/unsubscribe?token=" + tok, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }),
      { DB: db }
    );
    expect(p!.status).toBe(200);
    expect(await p!.text()).toContain("You are unsubscribed.");
    expect(calls).toEqual([{ sql: UNSUBSCRIBE_SQL, args: [tok] }]);
  });
  it("unsubscribe: POST with malformed token is 400 (no DB call); unknown token is 404", async () => {
    const { db, calls } = fakeDb();
    for (const body of [
      "",
      "token=",
      "token=xyz",
      "List-Unsubscribe=One-Click",
    ]) {
      expect(
        (await tryHandleEmailOptin(
          new Request("https://authichain.com/email/unsubscribe", {
            method: "POST",
            body,
          }),
          { DB: db }
        ))!.status
      ).toBe(400);
    }
    expect(calls).toHaveLength(0);
    const miss = fakeDb({ unsubChanges: 0 });
    const r = await tryHandleEmailOptin(
      new Request("https://authichain.com/email/unsubscribe", {
        method: "POST",
        body: "token=" + "c".repeat(64),
      }),
      { DB: miss.db }
    );
    expect(r!.status).toBe(404);
    expect(miss.calls.every(c => c.sql === UNSUBSCRIBE_SQL)).toBe(true);
  });
  it("unsubscribe: malformed token is 400 with no DB call; unknown token is 404 with no change", async () => {
    const { db, calls } = fakeDb();
    for (const q of ["", "?token=", "?token=xyz", "?token=" + "G".repeat(64)]) {
      expect(
        (await tryHandleEmailOptin(
          new Request("https://authichain.com/email/unsubscribe" + q),
          { DB: db }
        ))!.status
      ).toBe(400);
    }
    expect(calls).toHaveLength(0);
    const miss = fakeDb({ unsubChanges: 0 });
    const r = await tryHandleEmailOptin(
      new Request(
        "https://authichain.com/email/unsubscribe?token=" + "c".repeat(64),
        { method: "POST" }
      ),
      { DB: miss.db }
    );
    expect(r!.status).toBe(404);
    expect(miss.calls.every(c => c.sql === UNSUBSCRIBE_SQL)).toBe(true);
  });
  it("every sent email has a visible unsubscribe link and List-Unsubscribe headers", async () => {
    const { db } = fakeDb();
    const { sent, f } = mockFetch();
    await tryHandleEmailOptin(post(ok), { DB: db, ...ON }, new Date(), f);
    expect(sent).toHaveLength(1);
    const m = sent[0].body.text.match(
      /https:\/\/authichain\.com\/email\/unsubscribe\?token=([a-f0-9]{64})/
    );
    expect(m).not.toBeNull();
    expect(sent[0].body.headers["List-Unsubscribe"]).toContain(
      `<https://authichain.com/email/unsubscribe?token=${m[1]}>`
    );
    expect(sent[0].body.headers["List-Unsubscribe"]).toContain(
      `<mailto:${EMAIL_UNSUBSCRIBE_MAILTO}?subject=unsubscribe>`
    );
    expect(sent[0].body.headers["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click"
    );
    expect(EMAIL_UNSUBSCRIBE_MAILTO).toBe("authichain@mail.grokbot.com");
  });
  it("form POST stores a valid country and rejects a bad one without writing", async () => {
    const { db, calls } = fakeDb();
    const form = new URLSearchParams({
      email: "a@b.co",
      consent: "yes",
      country: "gb",
    });
    const r = await tryHandleEmailOptin(
      new Request("https://authichain.com/api/email-optin", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: ORIGIN,
        },
        body: form,
      }),
      { DB: db }
    );
    expect(r!.status).toBe(202);
    expect(calls.find(c => c.sql === UPSERT_SQL)!.args[3]).toBe("GB");
    const bad = fakeDb();
    const badForm = new URLSearchParams({
      email: "a@b.co",
      consent: "yes",
      country: "GBR",
    });
    const br = await tryHandleEmailOptin(
      new Request("https://authichain.com/api/email-optin", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: ORIGIN,
        },
        body: badForm,
      }),
      { DB: bad.db }
    );
    expect(br!.status).toBe(400);
    expect(bad.calls).toHaveLength(0);
  });
  it("marketing is allowed only for confirmed rows", () => {
    expect(canReceiveMarketing("confirmed")).toBe(true);
    for (const s of ["pending", "unsubscribed", "", "CONFIRMED", "yes"])
      expect(canReceiveMarketing(s)).toBe(false);
    expect(CONFIRMED_FOR_MARKETING_SQL).toBe(
      "SELECT email, country, unsub_token FROM email_optins WHERE status = 'confirmed'"
    );
    expect(CONFIRMED_FOR_MARKETING_SQL).not.toMatch(
      /pending|unsubscribed|lead_captures/
    );
  });
  it("update mail is refused unless confirmed, and when sent always carries RFC 8058 headers", async () => {
    const tok = "e".repeat(64);
    const base = {
      to: "a@b.co",
      subject: "Update",
      text: "A product update.",
      unsubToken: tok,
    };
    for (const status of ["pending", "unsubscribed", ""]) {
      const { sent, f } = mockFetch();
      expect(await sendUpdateEmail({ ...ON }, { ...base, status }, f)).toBe(
        false
      );
      expect(sent).toHaveLength(0);
    }
    const { sent, f } = mockFetch();
    expect(
      await sendUpdateEmail({ ...ON }, { ...base, status: "confirmed" }, f)
    ).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].body.headers).toEqual(unsubscribeHeaders(tok));
    expect(sent[0].body.headers["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click"
    );
    expect(sent[0].body.headers["List-Unsubscribe"]).toContain(
      `mailto:${EMAIL_UNSUBSCRIBE_MAILTO}`
    );
    expect(sent[0].body.text).toBe(
      "A product update." + unsubscribeFooter(tok)
    );
    const off = mockFetch();
    expect(
      await sendOptinMail(
        { RESEND_API_KEY: "k" },
        { ...base, kind: "update", status: "confirmed" },
        off.f
      )
    ).toBe(false);
    expect(off.sent).toHaveLength(0);
  });
  it("unsubscribe trailing slash is the same tokenized endpoint", async () => {
    expect(isEmailOptinPath("/email/unsubscribe")).toBe(true);
    expect(isEmailOptinPath("/email/unsubscribe/")).toBe(true);
    expect(isEmailOptinPath("/email/unsubscribe/extra")).toBe(false);
    const { db, calls } = fakeDb();
    const tok = "f".repeat(64);
    const r = await tryHandleEmailOptin(
      new Request("https://authichain.com/email/unsubscribe/?token=" + tok, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }),
      { DB: db }
    );
    expect(r!.status).toBe(200);
    expect(calls).toEqual([{ sql: UNSUBSCRIBE_SQL, args: [tok] }]);
  });
  it('sending is disabled unless EMAIL_OPTIN_SEND_ENABLED is exactly "true"', async () => {
    for (const v of [undefined, "", "TRUE", "1", "yes", "false"]) {
      const { db } = fakeDb();
      const { sent, f } = mockFetch();
      await tryHandleEmailOptin(
        post(ok),
        { DB: db, RESEND_API_KEY: "k", EMAIL_OPTIN_SEND_ENABLED: v },
        new Date(),
        f
      );
      expect(sent).toHaveLength(0);
    }
  });
});
