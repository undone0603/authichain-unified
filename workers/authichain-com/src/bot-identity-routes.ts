/**
 * Public identities for AuthiChain's own AI agents.
 *
 *   /agents                       index of every bot (HTML)
 *   /agents/index.json            same, as JSON
 *   /agents/<slug>                verify page: runs the reference verifier live
 *   /agents/<slug>/did.json       did:web document (did:web:authichain.com:agents:<slug>)
 *   /agents/<slug>/agent-card.json  A2A-style agent card (identity only, no task endpoint)
 *   /agents/<slug>/identity.json  the two signed records
 *   /.well-known/did.json         did:web:authichain.com (the agent issuer key)
 *
 * Public keys only. Records are Ed25519Signature2020 over JCS bytes and pass
 * protocol/verifier.mjs offline, with no call to AuthiChain. Not anchored on a
 * chain: the verdict is "valid-unanchored" and the page says so.
 */
import { verifySubmitted } from "../../authichain-verify-worker/src/protocol-verify.mjs";
import { BOT_IDENTITIES } from "./bot-identities";

type Bot = (typeof BOT_IDENTITIES)["bots"][number];
const ORIGIN = "https://authichain.com";
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=300",
  "Access-Control-Allow-Origin": "*",
};
const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=300",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const json = (body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body, null, 2), { headers: { ...JSON_HEADERS, ...extra } });

export function findBot(slug: string): Bot | undefined {
  return BOT_IDENTITIES.bots.find((b) => b.slug === slug);
}

function didDocument(id: string, keyMultibase: string, jwkX: string, controller = id) {
  const vm = `${id}#key-1`;
  return {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/multikey/v1"],
    id,
    controller,
    verificationMethod: [
      {
        id: vm,
        type: "Multikey",
        controller: id,
        publicKeyMultibase: keyMultibase,
      },
      {
        id: `${id}#key-1-jwk`,
        type: "JsonWebKey2020",
        controller: id,
        publicKeyJwk: { kty: "OKP", crv: "Ed25519", x: jwkX },
      },
    ],
    authentication: [vm],
    assertionMethod: [vm],
  };
}

export function botDidDocument(bot: Bot) {
  const doc = didDocument(bot.did, bot.publicKeyMultibase, bot.publicKeyJwkX);
  return {
    ...doc,
    alsoKnownAs: [bot.didKey],
    service: [
      { id: `${bot.did}#profile`, type: "LinkedDomains", serviceEndpoint: `${ORIGIN}/agents/${bot.slug}` },
      { id: `${bot.did}#agent-card`, type: "AgentCard", serviceEndpoint: `${ORIGIN}/agents/${bot.slug}/agent-card.json` },
    ],
  };
}

export function issuerDidDocument() {
  const i = BOT_IDENTITIES.issuer;
  return {
    ...didDocument(i.did, i.publicKeyMultibase, i.publicKeyJwkX),
    alsoKnownAs: [i.didKey],
    service: [{ id: `${i.did}#agents`, type: "LinkedDomains", serviceEndpoint: `${ORIGIN}/agents` }],
  };
}

export function botAgentCard(bot: Bot) {
  return {
    name: `${bot.name} (AuthiChain)`,
    description: `${bot.role}. An AI agent operated by AuthiChain. Not a person. This card publishes identity only; this agent does not accept A2A tasks at this URL.`,
    url: `${ORIGIN}/agents/${bot.slug}`,
    version: "1.0.0",
    provider: { organization: "AuthiChain", url: ORIGIN },
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [],
    identity: {
      did: bot.did,
      didKey: bot.didKey,
      issuer: BOT_IDENTITIES.issuer.did,
      record: `${ORIGIN}/agents/${bot.slug}/identity.json`,
      verifier: "https://github.com/undone0603/authichain-unified/blob/main/protocol/verifier.mjs",
    },
  };
}

export type BotCheck = { ok: boolean; record: string; selfStatement: string; keyMatches: boolean; issuerMatches: boolean };

export function checkBot(bot: Bot): BotCheck {
  const r = verifySubmitted(bot.record as unknown as Record<string, unknown>);
  const s = verifySubmitted(bot.selfStatement as unknown as Record<string, unknown>);
  const keyMatches =
    bot.record.credentialSubject.agentKey === bot.didKey && bot.selfStatement.issuer === bot.didKey;
  const issuerMatches = bot.record.issuer === BOT_IDENTITIES.issuer.didKey;
  const record = r?.verdict ?? "invalid";
  const selfStatement = s?.verdict ?? "invalid";
  return {
    ok: record === "valid-unanchored" && selfStatement === "valid-unanchored" && keyMatches && issuerMatches,
    record,
    selfStatement,
    keyMatches,
    issuerMatches,
  };
}

const STYLE = `body{margin:0;background:#0c0c0d;color:#f2efe8;font-family:system-ui,sans-serif}
.wrap{max-width:42rem;margin:0 auto;padding:3rem 1.25rem 4rem}h1{font-weight:500}
dt{margin-top:1rem;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:#b8b4aa}
dd{margin:.25rem 0 0;line-height:1.5}code{font-size:.8rem;word-break:break-all}a{color:#f2efe8}
.ok{color:#7fd18b}.bad{color:#e07a6a}li{margin:.35rem 0}`;

function page(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="robots" content="index,follow"><style>${STYLE}</style></head><body><main class="wrap">${body}</main></body></html>`;
}

export function renderBotPage(bot: Bot): string {
  const c = checkBot(bot);
  const status = c.ok
    ? `<p class="ok">Signature check passed just now. Status: valid, not anchored on a blockchain.</p>`
    : `<p class="bad">Signature check failed just now. Do not trust messages that point here.</p>`;
  return page(
    `${bot.name}: AuthiChain agent identity`,
    `<p>AuthiChain agent identity</p><h1>${esc(bot.name)}</h1>
<p>${esc(bot.name)} is an AI agent operated by AuthiChain. It is not a person.</p>${status}
<dl><dt>Role</dt><dd>${esc(bot.role)}</dd>
<dt>Identifier</dt><dd><code>${esc(bot.did)}</code></dd>
<dt>Public key (Ed25519)</dt><dd><code>${esc(bot.didKey)}</code></dd>
<dt>Signed by</dt><dd><code>${esc(BOT_IDENTITIES.issuer.didKey)}</code> (AuthiChain agent issuer, <a href="/.well-known/did.json">did:web:authichain.com</a>)</dd>
<dt>Checks</dt><dd>Issuer record: ${esc(c.record)} · Bot key statement: ${esc(c.selfStatement)} · Key matches: ${c.keyMatches ? "yes" : "no"} · Issuer matches: ${c.issuerMatches ? "yes" : "no"}</dd>
<dt>Valid</dt><dd>${esc(bot.record.validFrom)} to ${esc(bot.record.validUntil)}</dd>
<dt>Files</dt><dd><a href="/agents/${bot.slug}/did.json">DID document</a> · <a href="/agents/${bot.slug}/agent-card.json">Agent card</a> · <a href="/agents/${bot.slug}/identity.json">Signed records</a></dd></dl>
<p>Check it yourself, offline: save <code>identity.json</code>, then run <code>node protocol/verifier.mjs record.json</code> from the open-source <a href="https://github.com/undone0603/authichain-unified/tree/main/protocol">AuthiChain verifier</a>. A pass means AuthiChain's key signed this record. It does not rate the agent's work.</p>
<p><a href="/agents">All AuthiChain agents</a></p>`,
  );
}

export function renderIndexPage(): string {
  const items = BOT_IDENTITIES.bots
    .map((b) => `<li><a href="/agents/${b.slug}">${esc(b.name)}</a>: ${esc(b.role)}</li>`)
    .join("");
  return page(
    "AuthiChain agents",
    `<h1>AuthiChain agents</h1><p>These are the AI agents that work for AuthiChain. None of them is a person. Each page checks the agent's Ed25519-signed identity record live.</p><ul>${items}</ul>`,
  );
}

export function tryHandleBotIdentity(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const path = new URL(request.url).pathname.replace(/\/$/, "") || "/";
  if (path === "/.well-known/did.json") return json(issuerDidDocument(), { "Content-Type": "application/did+json" });
  if (path === "/agents") return new Response(renderIndexPage(), { headers: HTML_HEADERS });
  if (path === "/agents/index.json") {
    return json({
      issuer: BOT_IDENTITIES.issuer.did,
      agents: BOT_IDENTITIES.bots.map((b) => ({ name: b.name, role: b.role, did: b.did, didKey: b.didKey, profile: `${ORIGIN}/agents/${b.slug}` })),
    });
  }
  const m = path.match(/^\/agents\/([a-z0-9-]+)(?:\/(did\.json|agent-card\.json|identity\.json))?$/);
  if (!m) return null;
  const bot = findBot(m[1]);
  if (!bot) return null;
  if (m[2] === "did.json") return json(botDidDocument(bot), { "Content-Type": "application/did+json" });
  if (m[2] === "agent-card.json") return json(botAgentCard(bot));
  if (m[2] === "identity.json") return json({ record: bot.record, selfStatement: bot.selfStatement, check: checkBot(bot) });
  return new Response(renderBotPage(bot), { headers: HTML_HEADERS });
}
