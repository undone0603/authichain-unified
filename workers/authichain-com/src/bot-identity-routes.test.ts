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
});
