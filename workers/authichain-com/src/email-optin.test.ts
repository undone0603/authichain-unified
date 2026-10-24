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
    expect(await tryHandleEmailOptin(new Request("https://authichain.com/dpp-check"), undefined)).toBeNull();
  });
  it("requires consent and a valid email, writes nothing otherwise", async () => {
    const { db, calls } = fakeDb();
    expect((await tryHandleEmailOptin(post({ email: "a@b.co" }), db))!.status).toBe(400);
    expect((await tryHandleEmailOptin(post({ email: "nope", consent: "yes" }), db))!.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("stores only email, consent time, pending status and a token hash; purges first", async () => {
    const { db, calls } = fakeDb();
    const r = await tryHandleEmailOptin(post({ email: " A@B.co ", consent: "yes", name: "x" }), db, new Date("2026-10-23T12:00:00Z"));
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
    const r = await tryHandleEmailOptin(new Request("https://authichain.com/api/email-optin/confirm?token=" + "a".repeat(64)), db);
    expect(r!.status).toBe(200);
    expect(calls[0].args[0]).not.toBe("a".repeat(64));
    expect((await tryHandleEmailOptin(new Request("https://authichain.com/api/email-optin/confirm?token=x"), db))!.status).toBe(400);
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
});
