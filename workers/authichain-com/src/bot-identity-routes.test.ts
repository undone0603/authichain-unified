import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyRecord } from "../../../protocol/verifier.mjs";
import { BOT_IDENTITIES } from "./bot-identities";
import { checkBot, renderBotPage, tryHandleBotIdentity } from "./bot-identity-routes";

const get = (p: string) => tryHandleBotIdentity(new Request(`https://authichain.com${p}`));

describe("bot identities", () => {
  it("has 23 bots and no private key material", () => {
    expect(BOT_IDENTITIES.bots).toHaveLength(23);
    expect(JSON.stringify(BOT_IDENTITIES)).not.toMatch(/PRIVATE|"d":/);
  });
  it("every record and self statement passes the reference verifier", () => {
    for (const b of BOT_IDENTITIES.bots) {
      expect(verifyRecord(b.record).verdict).toBe("valid-unanchored");
      expect(verifyRecord(b.selfStatement).verdict).toBe("valid-unanchored");
      expect(checkBot(b).ok).toBe(true);
    }
  });
  it("a tampered record fails", () => {
    const b = BOT_IDENTITIES.bots[0];
    const bad = { ...b.record, credentialSubject: { ...b.record.credentialSubject, name: "Someone Else" } };
    expect(verifyRecord(bad).verdict).toBe("invalid");
  });
  it("serves did:web, agent card, identity and page", async () => {
    const did = await get("/agents/grok-bot/did.json")!.json();
    expect(did.id).toBe("did:web:authichain.com:agents:grok-bot");
    const card = await get("/agents/grok-bot/agent-card.json")!.json();
    expect(card.description).toContain("Not a person");
    const html = await get("/agents/grok-bot")!.text();
    expect(html).toContain("not anchored on a blockchain");
    expect(renderBotPage(BOT_IDENTITIES.bots[0])).toContain("It is not a person");
    expect((await get("/.well-known/did.json")!.json()).id).toBe("did:web:authichain.com");
    expect(get("/agents/nobody")).toBeNull();
    expect(get("/agent/agentz")).toBeNull();
  });
  it("serves all four well-known paths", async () => {
    const did = get("/.well-known/did.json")!;
    expect(did.status).toBe(200);
    expect(did.headers.get("Content-Type")).toBe("application/did+json");
    for (const p of ["/.well-known/agent-card.json", "/.well-known/agent.json"]) {
      const r = get(p)!;
      expect(r.status).toBe(200);
      const card = await r.json();
      expect(card.name).toBe("AuthiChain agents");
      expect(card.description).toContain("None of them is a person");
      expect(card.description).toContain("do not show who operates an agent");
      expect(card.identity.agents).toHaveLength(23);
    }
    const dir = get("/.well-known/http-message-signatures-directory")!;
    expect(dir.status).toBe(200);
    expect(dir.headers.get("Content-Type")).toBe("application/http-message-signatures-directory+json");
    const { keys } = await dir.json();
    expect(keys).toHaveLength(24);
    for (const k of keys) {
      expect(k).toMatchObject({ kty: "OKP", crv: "Ed25519" });
      expect(k.d).toBeUndefined();
      const tp = createHash("sha256").update(`{"crv":"Ed25519","kty":"OKP","x":"${k.x}"}`).digest("base64url");
      expect(k.kid).toBe(tp);
    }
  });
  it("pages carry the proves / does-not-prove statements", async () => {
    const html = await get("/agents/grok-bot")!.text();
    expect(html).toContain("What this proves: the public key published at authichain.com");
    expect(html).toContain("What it does not prove: who operates the agent");
    const card = await get("/agents/grok-bot/agent-card.json")!.json();
    expect(card.description).toContain("they do not show who operates it");
    expect(await get("/agents")!.text()).toContain("it does not show whether an agent's output is accurate or safe");
    expect(BOT_IDENTITIES.bots[0].role).toBe("Drafts X posts for review and reports to AuthiChain Marketing");
  });
});
