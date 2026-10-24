import { describe, expect, it } from "vitest";
import { tryHandleEmailOptin, emailOptinBlock, PURGE_SQL, type D1Like } from "./email-optin";
import { renderDppCheckPage } from "./dpp-check-page";

function fakeDb() {
  const calls: { sql: string; args: unknown[] }[] = [];
  const db: D1Like = { prepare: sql => ({ bind: (...args) => ({ run: async () => { calls.push({ sql, args }); return {}; } }) }) };
  return { db, calls };
}
const post = (body: unknown) =>
  new Request("https://authichain.com/api/email-optin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

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
  it("stores only email, consent time, pending status and a token hash; purges first", async () => {
    const { db, calls } = fakeDb();
    const r = await tryHandleEmailOptin(post({ email: " A@B.co ", consent: "yes", name: "x" }), { DB: db }, new Date("2026-10-23T12:00:00Z"));
    expect(r!.status).toBe(202);
    expect(calls[0].sql).toBe(PURGE_SQL);
    expect(PURGE_SQL).toContain("-30 days");
    expect(calls[1].args[0]).toBe("a@b.co");
    expect(calls[1].args[1]).toBe("2026-10-23 12:00:00");
    expect(String(calls[1].args[2])).toMatch(/^[a-f0-9]{64}$/);
    expect(calls[1].args).toHaveLength(3);
  });
  it("confirm hashes the token and does not reveal matches", async () => {
    const { db, calls } = fakeDb();
    const r = await tryHandleEmailOptin(new Request("https://authichain.com/api/email-optin/confirm?token=" + "a".repeat(64)), { DB: db });
    expect(r!.status).toBe(200);
    expect(calls[0].args[0]).not.toBe("a".repeat(64));
    expect((await tryHandleEmailOptin(new Request("https://authichain.com/api/email-optin/confirm?token=x"), { DB: db }))!.status).toBe(400);
  });
  it("UI block: optional email, unchecked consent, privacy link, placeholder marked", () => {
    const h = emailOptinBlock("t");
    expect(h).not.toMatch(/required|checked/);
    expect(h).toContain('href="/privacy"');
    expect(h).toContain("[PLACEHOLDER — Research to check]");
  });
  it("free DPP check still renders a result with no email given", () => {
    const html = renderDppCheckPage(new URL("https://authichain.com/dpp-check?category=battery_passport&sells_in_eu=yes"));
    expect(html).toContain("Your result:");
    expect(html).toContain('id="dpp-email-optin"');
  });
  it("flag off (default) or no key: nothing sends, row stays pending", async () => {
    for (const env of [{ RESEND_API_KEY: "k" }, { EMAIL_OPTIN_SEND_ENABLED: "true" }, { EMAIL_OPTIN_SEND_ENABLED: "false", RESEND_API_KEY: "k" }]) {
      const { db } = fakeDb();
      let n = 0;
      const f = (async () => { n++; return new Response("{}"); }) as unknown as typeof fetch;
      const r = await tryHandleEmailOptin(post({ email: "a@b.co", consent: "yes" }), { DB: db, ...env }, new Date(), f);
      expect(r!.status).toBe(202);
      expect(n).toBe(0);
    }
  });
  it("flag on + key: exactly one transactional email with the confirm link", async () => {
    const { db, calls } = fakeDb();
    const sent: { url: string; body: any; auth: string }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)), auth: (init.headers as Record<string, string>).Authorization });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const r = await tryHandleEmailOptin(post({ email: "a@b.co", consent: "yes" }), { DB: db, RESEND_API_KEY: "test-key", EMAIL_OPTIN_SEND_ENABLED: "true" }, new Date(), f);
    expect(r!.status).toBe(202);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://api.resend.com/emails");
    expect(sent[0].body.from).toBe("AuthiChain <no-reply@mail.authichain.com>");
    expect(sent[0].body.to).toEqual(["a@b.co"]);
    expect(sent[0].body.html).toBeUndefined();
    const token = sent[0].body.text.match(/token=([a-f0-9]{64})/)[1];
    // the stored hash is of the emailed token, never the token itself
    expect(calls[1].args[2]).not.toBe(token);
    expect(sent[0].body.text).not.toMatch(/strainchain|unsubscribe|offer|discount|pricing|\$/i);
    expect(JSON.stringify(sent[0].body)).not.toMatch(/strainchain/);
  });
});
