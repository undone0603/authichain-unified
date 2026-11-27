import { describe, expect, it } from "vitest";
import { BOT_IDENTITIES } from "./bot-identities";
import { tryHandleBotIdentity } from "./bot-identity-routes";
import { checkOperatorProof, OPERATOR_PROOFS } from "./bot-operator-proofs";

const agentz = () => BOT_IDENTITIES.bots.find(b => b.slug === "agentz")!;
const get = (p: string) => tryHandleBotIdentity(new Request(`https://authichain.com${p}`));

const tamper = (jws: string, edit: (p: any) => void) => {
  const [h, p, s] = jws.split(".");
  const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  edit(payload);
  return `${h}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${s}`;
};

describe("operator key-possession proof", () => {
  it("agentz proof verifies against the published key and names undone0603", () => {
    const c = checkOperatorProof(agentz())!;
    expect(c.reasons).toEqual([]);
    expect(c.ok).toBe(true);
    expect(c.operatorGithub).toBe("undone0603");
    expect(c.operatorDomain).toBe("authichain.com");
    expect(c.gist).toMatch(/^https:\/\/gist\.github\.com\/undone0603\//);
  });

  it("a tampered payload fails the signature check", () => {
    const p = OPERATOR_PROOFS.agentz;
    const c = checkOperatorProof(agentz(), {
      ...p,
      jws: tamper(p.jws, x => (x.operator.github = "someone-else")),
    })!;
    expect(c.ok).toBe(false);
    expect(c.reasons).toContain("signature_invalid");
  });

  it("a proof checked against another bot's key fails", () => {
    const other = BOT_IDENTITIES.bots.find(b => b.slug !== "agentz")!;
    const c = checkOperatorProof(other, OPERATOR_PROOFS.agentz)!;
    expect(c.ok).toBe(false);
    expect(c.reasons).toEqual(expect.arrayContaining(["signature_invalid", "did_key_mismatch"]));
  });

  it("a gist from a different account than the named operator fails", () => {
    const p = OPERATOR_PROOFS.agentz;
    const c = checkOperatorProof(agentz(), { ...p, gist: "https://gist.github.com/someone-else/abc" })!;
    expect(c.ok).toBe(false);
    expect(c.reasons).toContain("gist_not_operator_account");
  });

  it("bots without a proof get no operator line", async () => {
    expect(checkOperatorProof(BOT_IDENTITIES.bots.find(b => b.slug === "grok-bot")!)).toBeNull();
    expect(get("/agents/grok-bot/operator-proof.jws")).toBeNull();
    expect(await get("/agents/grok-bot")!.text()).not.toContain("<dt>Operator</dt>");
  });

  it("serves the JWS and links it from the page", async () => {
    const res = get("/agents/agentz/operator-proof.jws")!;
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/application\/jose/);
    expect((await res.text()).trim()).toBe(OPERATOR_PROOFS.agentz.jws);
    const html = await get("/agents/agentz")!.text();
    expect(html).toContain('<a href="/agents/agentz/operator-proof.jws">');
    expect(html).toContain(OPERATOR_PROOFS.agentz.gist);
  });
});
