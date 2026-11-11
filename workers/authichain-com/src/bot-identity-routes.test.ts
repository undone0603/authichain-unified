import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyRecord } from "../../../protocol/verifier.mjs";
import { tryHandleAgentPresentation } from "./agent-present-page";
import { BOT_ANCHORS } from "./bot-anchors";
import { BOT_IDENTITIES } from "./bot-identities";
import {
  checkBot,
  polygonTx,
  renderBotPage,
  tryHandleBotIdentity,
} from "./bot-identity-routes";

const get = (p: string) =>
  tryHandleBotIdentity(new Request(`https://authichain.com${p}`));
const ISSUER_DID_KEY =
  "did:key:z6MksGQUHtYbqvuFoQdeznZ6uKEoZkUgMm969a6tqjSjpUy7";
const STORE_PILOT_POLYGON_TX =
  "0x40bc5b867e65141794f041efd354d9b9652917a3899fce24c761898ec98288ce";
const RIDE_AVENTON_BASE_TX =
  "0x5ddf381ab4b3be5e8a2b4879ef3d6821fcf67c82e41b67c5fa6abb492a490f2d";
const AGENTZ_PRESENTATION_DIGEST =
  "ga9qoxmn0Mudm4WRmDbAa6n-hjRVhPqxbNxQLsJum8s";

describe("bot identities", () => {
  it("has 24 bots and no private key material", () => {
    expect(BOT_IDENTITIES.bots).toHaveLength(24);
    expect(JSON.stringify(BOT_IDENTITIES)).not.toMatch(/PRIVATE|"d":/);
  });
  it("every record and self statement passes the reference verifier", () => {
    for (const b of BOT_IDENTITIES.bots) {
      expect(verifyRecord(b.record).verdict).toBe("valid-unanchored");
      expect(verifyRecord(b.selfStatement).verdict).toBe("valid-unanchored");
      const check = checkBot(b);
      expect(check.ok).toBe(true);
      const anchor = BOT_ANCHORS[b.slug as keyof typeof BOT_ANCHORS];
      if (anchor) {
        expect(verifyRecord(b.record, anchor).verdict).toBe("verified");
        expect(check.record).toBe("verified");
        expect(check.anchored).toBe(true);
      } else {
        expect(check.record).toBe("valid-unanchored");
        expect(check.anchored).toBe(false);
        expect(check.selfStatement).toBe("valid-unanchored");
      }
    }
  });
  it("a tampered record fails", () => {
    const b = BOT_IDENTITIES.bots[0];
    const bad = {
      ...b.record,
      credentialSubject: {
        ...b.record.credentialSubject,
        name: "Someone Else",
      },
    };
    expect(verifyRecord(bad).verdict).toBe("invalid");
  });
  it("serves did:web, agent card, identity and page", async () => {
    const did = await get("/agents/grok-bot/did.json")!.json();
    expect(did.id).toBe("did:web:authichain.com:agents:grok-bot");
    const card = await get("/agents/grok-bot/agent-card.json")!.json();
    expect(card.description).toContain("Not a person");
    const html = await get("/agents/grok-bot")!.text();
    expect(html).toContain("anchored on Polygon");
    expect(html).toContain(BOT_ANCHORS["grok-bot"].txHash);
    expect(html).not.toContain("not anchored on a blockchain");
    expect(html).not.toContain("no Polygon anchor recorded yet");
    expect(html).not.toContain("Ride Aventon");
    const identity = await get("/agents/grok-bot/identity.json")!.json();
    expect(identity.anchor.txHash).toBe(BOT_ANCHORS["grok-bot"].txHash);
    expect(identity.check.record).toBe("verified");
    expect(identity.check.anchored).toBe(true);
    expect(identity.check.ok).toBe(true);
    const swapped = verifyRecord(
      BOT_IDENTITIES.bots[0].record,
      BOT_ANCHORS["bankz"]
    );
    expect(swapped.verdict).toBe("invalid");
    expect(polygonTx("grok-bot")).toBe(
      `https://polygonscan.com/tx/${BOT_ANCHORS["grok-bot"].txHash}`
    );
    expect(renderBotPage(BOT_IDENTITIES.bots[0])).toContain(
      "It is not a person"
    );
    expect((await get("/.well-known/did.json")!.json()).id).toBe(
      "did:web:authichain.com"
    );
    expect(get("/agents/nobody")).toBeNull();
    expect(get("/agent/agentz")).toBeNull();
  });
  it("serves all four well-known paths", async () => {
    const did = get("/.well-known/did.json")!;
    expect(did.status).toBe(200);
    expect(did.headers.get("Content-Type")).toBe("application/did+json");
    expect(get("/.well-known/agent-card.json")).toBeNull();
    expect(get("/.well-known/agent.json")).toBeNull();
    const roster = get("/agents/agent-card.json")!;
    expect(roster.status).toBe(200);
    const card = await roster.json();
    expect(card.name).toBe("AuthiChain agents");
    expect(card.description).toContain("None of them is a person");
    expect(card.description).toContain("do not show who operates an agent");
    expect(card.identity.agents).toHaveLength(24);
    const dir = get("/.well-known/http-message-signatures-directory")!;
    expect(dir.status).toBe(200);
    expect(dir.headers.get("Content-Type")).toBe(
      "application/http-message-signatures-directory+json"
    );
    const { keys } = await dir.json();
    expect(keys).toHaveLength(25);
    for (const k of keys) {
      expect(k).toMatchObject({ kty: "OKP", crv: "Ed25519" });
      expect(k.d).toBeUndefined();
      const tp = createHash("sha256")
        .update(`{"crv":"Ed25519","kty":"OKP","x":"${k.x}"}`)
        .digest("base64url");
      expect(k.kid).toBe(tp);
    }
  });
  it("pages carry the proves / does-not-prove statements", async () => {
    const html = await get("/agents/grok-bot")!.text();
    expect(html).toContain(
      "What this proves: the public key published at authichain.com"
    );
    expect(html).toContain("What it does not prove: who operates the agent");
    const card = await get("/agents/grok-bot/agent-card.json")!.json();
    expect(card.description).toContain("they do not show who operates it");
    expect(await get("/agents")!.text()).toContain(
      "it does not show whether an agent's output is accurate or safe"
    );
    expect(BOT_IDENTITIES.bots[0].role).toBe(
      "Drafts X posts for review and reports to AuthiChain Marketing"
    );
  });
});

describe("GET /agents/agentz (unanchored did:web)", () => {
  const agentz = () => BOT_IDENTITIES.bots.find(b => b.slug === "agentz")!;

  it("serves HTML with honest unanchored copy and the Ride Aventon cross-link", async () => {
    const res = get("/agents/agentz")!;
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain("AgentZ");
    expect(html).toContain(
      "Signature check passed just now. Identity record is Ed25519-signed (no Polygon anchor recorded yet)."
    );
    expect(html).toContain(
      'Related: a scoped Ride Aventon presentation artifact lives at <a href="/agent/agentz">/agent/agentz</a> (Base data-only anchor; not this Ed25519 identity record).'
    );
    expect(html).toContain(
      "What this proves: the public key published at authichain.com"
    );
    expect(html).toContain("What it does not prove: who operates the agent");
    expect(html).not.toContain("anchored on Polygon");
    expect(html).not.toContain(STORE_PILOT_POLYGON_TX);
    expect(html).not.toContain(RIDE_AVENTON_BASE_TX);
    expect(html).not.toContain("minted NFT");
    expect(html).not.toContain("ERC-721 live");
    const operator = agentz().record.credentialSubject.operator;
    expect(html).toContain(`operated by ${operator}. It is not a person.`);
    expect(agentz().selfStatement.credentialSubject.statement).toBe(
      `I am AgentZ, an AI agent operated by ${operator}. I am not a person.`
    );
    expect(html).not.toContain(`${operator}, Inc.`);
    expect(get("/agent/agentz")).toBeNull();
  });

  it("serves did.json, agent-card.json, and identity.json", async () => {
    const didRes = get("/agents/agentz/did.json")!;
    expect(didRes.status).toBe(200);
    const did = await didRes.json();
    expect(did.id).toBe("did:web:authichain.com:agents:agentz");

    const cardRes = get("/agents/agentz/agent-card.json")!;
    expect(cardRes.status).toBe(200);
    const card = await cardRes.json();
    expect(card.identity.did).toBe("did:web:authichain.com:agents:agentz");
    expect(card.identity.issuer).toBe("did:web:authichain.com");
    expect(card.identity.anchorTransaction).toBeNull();
    expect(card.description).toContain("Not a person");
    expect(card.description).not.toContain("minted NFT");
    expect(card.description).not.toContain("ERC-721 live");

    const identityRes = get("/agents/agentz/identity.json")!;
    expect(identityRes.status).toBe(200);
    const identity = await identityRes.json();
    expect(identity.record.issuer).toBe(ISSUER_DID_KEY);
    expect(identity.anchor).toBeNull();
    expect(identity.check.ok).toBe(true);
    expect(identity.check.record).toBe("valid-unanchored");
    expect(identity.check.selfStatement).toBe("valid-unanchored");
    expect(identity.check.anchored).toBe(false);
    expect(identity.selfStatement.credentialSubject.statement).toBe(
      `I am AgentZ, an AI agent operated by ${agentz().record.credentialSubject.operator}. I am not a person.`
    );
    const blob = JSON.stringify(identity);
    expect(blob).not.toContain(STORE_PILOT_POLYGON_TX);
    expect(blob).not.toContain(RIDE_AVENTON_BASE_TX);
    expect(blob).not.toContain("minted NFT");
    expect(blob).not.toContain("ERC-721 live");
    expect(blob).not.toContain(
      `${agentz().record.credentialSubject.operator}, Inc.`
    );
  });

  it("lists AgentZ among 24 agents on /agents/index.json without a Polygon tx", async () => {
    const res = get("/agents/index.json")!;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toHaveLength(24);
    const row = body.agents.find(
      (a: { did: string }) => a.did === "did:web:authichain.com:agents:agentz"
    );
    expect(row).toMatchObject({
      name: "AgentZ",
      did: "did:web:authichain.com:agents:agentz",
      didKey: "did:key:z6MkryvgqPJq6qE7zWnw7T62biPzJrLPML3EMSSXxLUoKN82",
      profile: "https://authichain.com/agents/agentz",
      anchorTransaction: null,
    });
    expect(
      body.agents.filter(
        (a: { anchorTransaction: string | null }) => a.anchorTransaction
      )
    ).toHaveLength(23);
  });

  it("leaves GET /agent/agentz on the Ride Aventon presentation route", async () => {
    expect(get("/agent/agentz")).toBeNull();
    const htmlRes = await tryHandleAgentPresentation(
      new Request("https://authichain.com/agent/agentz")
    );
    expect(htmlRes).not.toBeNull();
    expect(htmlRes!.status).toBe(200);
    const html = await htmlRes!.text();
    expect(html).toContain("This message checks out");
    expect(html).toContain("Data-only. No NFT minted.");
    expect(html).toContain(RIDE_AVENTON_BASE_TX.slice(0, 10));
    expect(html).toContain(AGENTZ_PRESENTATION_DIGEST);

    const jsonRes = await tryHandleAgentPresentation(
      new Request("https://authichain.com/agent/agentz?format=json")
    );
    const body = await jsonRes!.json();
    expect(body.valid).toBe(true);
    expect(body.message_digest).toBe(AGENTZ_PRESENTATION_DIGEST);
    expect(body.onchain_anchor.tx).toBe(RIDE_AVENTON_BASE_TX);
    expect(body.onchain_anchor.note).toContain("No NFT minted");
    expect(body.capabilities).toEqual(["PRESENT_ONE_OFFER"]);
  });
});
