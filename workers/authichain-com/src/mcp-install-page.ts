/**
 * Public MCP install surface at /mcp/install (and /mcp/app).
 *
 * Why this exists: server.json registers this endpoint as
 * io.github.undone0603/authichain with a remote streamable-http URL, but
 * nothing on the site ever told a human how to connect it. A grep for
 * "cursor://", "vscode:mcp" or "mcpServers" across the repo returned only
 * internal config — there was no install path a reader could follow.
 *
 * Two rules govern everything below.
 *
 * 1. The tool list is NOT retyped. It is rendered from the live `TOOLS`
 *    array exported by mcp-routes.ts, so this page cannot drift from what
 *    tools/list actually answers. Adding a tool there adds a row here.
 *
 * 2. Showcases are seeded ONLY from records that are already public. That
 *    means the four published /m/ microsite packs (content/microsites/
 *    manifest.json), the one published protocol record, the cited EU DPP
 *    category table, and the deployed ACPT contract. The StrainChain packs
 *    under content/strainchain/ (gtr-seeds, mendo-love-farms) are marked
 *    `"unlisted": true` and carry transcribed customer CoAs — they are
 *    deliberately NOT shown here. Do not add them to make the grid fuller.
 *
 * The same honesty rule the MCP tools follow applies to the copy: each
 * showcase states what the call proves and what it does not. No card
 * claims a physical product was inspected, because no tool does that.
 */

import { ESTATE_FONTS_LINK } from "../../_shared/estate-landing";
// Extensionless on purpose: tsconfig.workers.json charges one TS5097 per
// ".ts" import and the ratchet fails on any increase.
import { DPP_CATEGORIES } from "../../../src/lib/dpp-readiness";
import {
  ANCHOR_EXAMPLE_ID,
  ANCHOR_EXAMPLE_TX,
  CERT_CONTRACT,
  TOOLS,
} from "./mcp-routes";
import { PUBLISHED_PACKS as PACKS, packUrl } from "./published-packs";

export const MCP_INSTALL_PATHS = [
  "/mcp/install",
  "/mcp/install/",
  "/mcp/app",
  "/mcp/app/",
] as const;

export const MCP_INSTALL_CANONICAL = "https://authichain.com/mcp/install";
export const MCP_ENDPOINT = "https://authichain.com/mcp";

export function isMcpInstallPath(pathname: string): boolean {
  return (MCP_INSTALL_PATHS as readonly string[]).includes(pathname);
}

function esc(value: unknown): string {
  return String(value ?? "").replace(
    /[<>&"']/g,
    c =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string
  );
}

/** Workers expose btoa; Node's test environment does too. */
function b64(value: string): string {
  return typeof btoa === "function"
    ? btoa(value)
    : Buffer.from(value, "utf8").toString("base64");
}

/* ------------------------------------------------------------------ *
 * Install targets
 * ------------------------------------------------------------------ */

/**
 * Client config, in the two shapes that actually exist.
 *
 * Claude Code and Cursor key off `mcpServers`; VS Code keys off `servers`
 * (verified against VS Code's MCP configuration reference). Shipping only
 * the `mcpServers` form sends VS Code users to a config their editor
 * silently ignores, so both are published.
 */
export const MCP_CLIENT_CONFIG = {
  mcpServers: {
    authichain: { type: "http", url: MCP_ENDPOINT },
  },
} as const;

/** VS Code's `.vscode/mcp.json` / user settings shape. */
export const VSCODE_CLIENT_CONFIG = {
  servers: {
    authichain: { type: "http", url: MCP_ENDPOINT },
  },
} as const;

export const CURSOR_DEEPLINK = `cursor://anysphere.cursor-deeplink/mcp/install?name=authichain&config=${encodeURIComponent(
  b64(JSON.stringify({ url: MCP_ENDPOINT }))
)}`;

/**
 * Claude Code. Verified against code.claude.com/docs/en/mcp:
 * `claude mcp add --transport http <name> <url>`.
 */
export const CLAUDE_CODE_COMMAND = `claude mcp add --transport http authichain ${MCP_ENDPOINT}`;

/**
 * VS Code gets a documented CLI command, not a deeplink.
 *
 * There was a `vscode:mcp/install?<urlencoded JSON>` button here. Two
 * incompatible shapes for that URI circulate (a bare encoded JSON blob
 * versus `?name=…&config=…`), and neither appears in Microsoft's own MCP
 * docs — those document `code --add-mcp` and the config file only. A
 * button whose format cannot be verified is a dead button at launch, so
 * this ships the mechanism Microsoft actually documents.
 *
 * If VS Code later publishes the URI format, add the deeplink back — do
 * not guess at it.
 */
export const VSCODE_COMMAND = `code --add-mcp '${JSON.stringify({
  name: "authichain",
  type: "http",
  url: MCP_ENDPOINT,
})}'`;

/* ------------------------------------------------------------------ *
 * Showcases — real records only
 * ------------------------------------------------------------------ */

/** The battery category is the only one that is law, not a target. */
const BATTERY = DPP_CATEGORIES.find(c => c.id === "battery_passport");
const LAW_COUNT = DPP_CATEGORIES.filter(c => c.status === "law").length;
const EXPECTED_COUNT = DPP_CATEGORIES.filter(
  c => c.status === "expected"
).length;

export type Showcase = {
  slug: string;
  eyebrow: string;
  title: string;
  /** What the agent actually sends. */
  call: { tool: string; args: Record<string, unknown> };
  /** Plain-language result of that exact call. */
  returns: string;
  /** The limit. Every card has one; this is not decoration. */
  limit: string;
  /** A public URL a reader can open to check the claim. */
  evidence: { label: string; href: string } | null;
};

/**
 * Each entry is a call a reader can paste and run, against a record that
 * is already published. Nothing here is a mock-up of a future feature.
 */
export const SHOWCASES: readonly Showcase[] = [
  {
    slug: "anchor",
    eyebrow: "Polygon mainnet",
    title: "Verify a signed record against its on-chain anchor",
    call: { tool: "verify_record", args: { id: ANCHOR_EXAMPLE_ID } },
    returns:
      "Checks the Ed25519 signature, confirms the signer is allowlisted, then reads Polygon transaction " +
      `${ANCHOR_EXAMPLE_TX.slice(0, 10)}…${ANCHOR_EXAMPLE_TX.slice(-4)} and confirms it carries this record's hash. ` +
      "Returns verified, valid-unanchored or invalid, with the reason list.",
    limit:
      "This is the protocol demonstration record. Its own credentialSubject says it is not a product and not a battery passport.",
    evidence: {
      label: "protocol/examples/polygon-anchor-1",
      href: "https://authichain.com/protocol",
    },
  },
  {
    slug: "battery",
    eyebrow: BATTERY ? `Law from ${BATTERY.date}` : "EU battery regulation",
    title: "Score EU Digital Product Passport readiness for a battery",
    call: {
      tool: "dpp_readiness_check",
      args: {
        category: "battery_passport",
        sells_in_eu: true,
        unique_id: true,
        supplier_data: false,
        footprint: false,
      },
    },
    returns:
      "Returns a 0–100 score, the specific gaps behind it, and the dated obligation for the category. " +
      (BATTERY
        ? `For this one: ${BATTERY.when} Source: ${BATTERY.source}.`
        : ""),
    limit:
      "Self-assessment from the answers supplied. Not legal advice, and not an audit of any document.",
    evidence: {
      label: "Run it as a form instead",
      href: "https://authichain.com/dpp-check",
    },
  },
  {
    slug: "batch",
    eyebrow: "Published pack · BAT-2026-001",
    title: "Read a restated certificate for a real batch",
    call: { tool: "query_provenance", args: { assetId: "BAT-2026-001" } },
    returns:
      "A public lookup surface for an asset id. The BAT-2026-001 pack restates MVCL_Certificate_BAT-2026-001.pdf " +
      "— Insulin Vial 100IU, EU market, verdict PASS — as a published page.",
    limit:
      "query_provenance never attests. An id with no registry row returns status unknown, and the pack is a restatement of a certificate, not a re-audit of it.",
    evidence: {
      label: "/m/bat-2026-001",
      href: "https://authichain.com/m/bat-2026-001",
    },
  },
  {
    slug: "pricing",
    eyebrow: "Free",
    title: "Ask what a call costs before making it",
    call: { tool: "get_pricing", args: {} },
    returns:
      "Verification is free: no API key, no payment header, no account. Returns the free tool list and the status of the paid plans, which are currently on hold.",
    limit:
      "The legacy x402 seal verify tool is a separate rail and answers 402 on an unpaid call. Use verify_record instead.",
    evidence: null,
  },
];

/**
 * Published packs come from published-packs.ts, the same module
 * query_provenance resolves against — so the page and the tool can never
 * disagree about what is published.
 */
export { PUBLISHED_PACKS } from "./published-packs";

/* ------------------------------------------------------------------ *
 * Render
 * ------------------------------------------------------------------ */

const TOKENS = `:root{
  --ac-bg:#ffffff; --ac-fg:#0b1220; --ac-muted:#55607a; --ac-line:#e3e7ef;
  --ac-accent:#4F46E5; --ac-accent-weak:#eef0fe; --ac-card:#ffffff;
  --ac-ink:#0d1324; --ac-ink-fg:#e8ecf8; --ac-ink-muted:#99a3bd;
  --ac-ok:#0f7a5a; --ac-warn:#9a5b00;
  --ac-radius:14px; --ac-pad:clamp(16px,4vw,28px);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ac-bg:#0b0f1a; --ac-fg:#eef1f8; --ac-muted:#9aa4bd; --ac-line:#232a3b;
  --ac-accent:#8b85ff; --ac-accent-weak:#1a1b35; --ac-card:#111626;
  --ac-ink:#060912; --ac-ink-fg:#e8ecf8; --ac-ink-muted:#8e99b5;
  --ac-ok:#4ade9f; --ac-warn:#f0b65c;
}}`;

const CSS = `${TOKENS}
*{box-sizing:border-box}
body{margin:0;background:var(--ac-bg);color:var(--ac-fg);
  font-family:"Plus Jakarta Sans",system-ui,-apple-system,Segoe UI,sans-serif;
  line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:1060px;margin:0 auto;padding:0 16px}
a{color:var(--ac-accent)}
h1{font-size:clamp(30px,5.2vw,50px);line-height:1.1;letter-spacing:-.025em;margin:0 0 14px}
h2{font-size:clamp(21px,3vw,28px);letter-spacing:-.015em;margin:0 0 6px}
h3{font-size:17px;margin:0 0 6px;letter-spacing:-.01em}
p{margin:0 0 12px}
.lede{font-size:clamp(16px,2.1vw,19px);color:var(--ac-muted);max-width:60ch}
header.hero{padding:clamp(40px,7vw,76px) 0 8px}
.pill{display:inline-block;font-size:12px;font-weight:650;letter-spacing:.07em;
  text-transform:uppercase;color:var(--ac-accent);background:var(--ac-accent-weak);
  border-radius:999px;padding:5px 12px;margin-bottom:16px}
section{padding:clamp(30px,5vw,54px) 0;border-top:1px solid var(--ac-line)}
section:first-of-type{border-top:0}
.sub{color:var(--ac-muted);max-width:62ch;margin-bottom:22px}
.grid{display:grid;gap:14px}
@media(min-width:720px){.grid.two{grid-template-columns:1fr 1fr}}
.card{background:var(--ac-card);border:1px solid var(--ac-line);
  border-radius:var(--ac-radius);padding:var(--ac-pad)}
.eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:var(--ac-muted);margin-bottom:7px}
pre{background:var(--ac-ink);color:var(--ac-ink-fg);border-radius:10px;
  padding:14px 16px;overflow-x:auto;margin:12px 0 0;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.55}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em}
p code,li code,td code{background:var(--ac-accent-weak);color:var(--ac-accent);
  padding:1.5px 5px;border-radius:5px}
.btns{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 0}
.btn{display:inline-flex;align-items:center;gap:8px;text-decoration:none;
  font-weight:620;font-size:14.5px;padding:11px 17px;border-radius:10px;
  border:1px solid var(--ac-line);color:var(--ac-fg);background:var(--ac-card)}
.btn.primary{background:var(--ac-accent);border-color:var(--ac-accent);color:#fff}
table{width:100%;border-collapse:collapse;font-size:14.5px;margin-top:6px}
th,td{text-align:left;padding:11px 10px;border-bottom:1px solid var(--ac-line);
  vertical-align:top}
th{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ac-muted)}
.limit{font-size:13.5px;color:var(--ac-muted);border-left:2px solid var(--ac-line);
  padding-left:11px;margin-top:13px}
.limit b{color:var(--ac-warn);font-weight:650}
.tag{display:inline-block;font-size:11.5px;font-weight:650;border-radius:5px;
  padding:2px 7px;background:var(--ac-accent-weak);color:var(--ac-accent)}
.tag.free{background:color-mix(in srgb,var(--ac-ok) 14%,transparent);color:var(--ac-ok)}
ul.packs{list-style:none;padding:0;margin:0;display:grid;gap:10px}
@media(min-width:720px){ul.packs{grid-template-columns:1fr 1fr}}
ul.packs li{border:1px solid var(--ac-line);border-radius:11px;padding:14px 16px}
footer{border-top:1px solid var(--ac-line);padding:28px 0 54px;color:var(--ac-muted);font-size:14px}
`;

function showcaseCard(s: Showcase): string {
  const body = JSON.stringify(
    {
      method: "tools/call",
      params: { name: s.call.tool, arguments: s.call.args },
    },
    null,
    2
  );
  return `<article class="card">
  <div class="eyebrow">${esc(s.eyebrow)}</div>
  <h3>${esc(s.title)}</h3>
  <p style="color:var(--ac-muted);font-size:14.5px">${esc(s.returns)}</p>
  <pre><code>${esc(body)}</code></pre>
  <p class="limit"><b>Limit.</b> ${esc(s.limit)}</p>
  ${
    s.evidence
      ? `<p style="margin-top:11px;font-size:14px"><a href="${esc(s.evidence.href)}">${esc(s.evidence.label)} →</a></p>`
      : ""
  }
</article>`;
}

export function renderMcpInstallPage(): string {
  const configJson = JSON.stringify(MCP_CLIENT_CONFIG, null, 2);
  const vscodeConfigJson = JSON.stringify(VSCODE_CLIENT_CONFIG, null, 2);

  const toolRows = TOOLS.map(t => {
    const paid = t.name === "verify";
    return `<tr>
      <td><code>${esc(t.name)}</code> ${
        paid
          ? '<span class="tag">legacy x402</span>'
          : '<span class="tag free">free</span>'
      }</td>
      <td style="color:var(--ac-muted)">${esc(t.description)}</td>
    </tr>`;
  }).join("");

  const packItems = PACKS.map(
    p => `<li>
      <strong>${esc(p.name)}</strong>
      <div style="color:var(--ac-muted);font-size:14px;margin:4px 0 8px">${esc(p.note)}</div>
      <a href="${esc(packUrl(p.slug))}" style="font-size:14px">/m/${esc(p.slug)} →</a>
    </li>`
  ).join("");

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Install the AuthiChain MCP server | AuthiChain</title>
<meta name="description" content="Connect AuthiChain to Claude, Cursor or VS Code in one step. Free verification of Polygon-anchored signed records and EU Digital Product Passport readiness, over MCP.">
<link rel="canonical" href="${MCP_INSTALL_CANONICAL}">
${ESTATE_FONTS_LINK}
<style>${CSS}</style>
</head><body>

<header class="hero"><div class="wrap">
  <span class="pill">Model Context Protocol</span>
  <h1>Give your agent a way to check what's real.</h1>
  <p class="lede">AuthiChain scores EU Digital Product Passport readiness against the dated
  obligations. Free over MCP — no key, no account, no payment header.</p>
  <div class="btns">
    <a class="btn primary" href="${esc(CURSOR_DEEPLINK)}">Add to Cursor</a>
    <a class="btn" href="#install">Claude, VS Code &amp; everything else</a>
  </div>
</div></header>

<section id="install"><div class="wrap">
  <h2>Install</h2>
  <p class="sub">One remote endpoint, <code>${esc(MCP_ENDPOINT)}</code>. Nothing runs on your machine.</p>
  <div class="grid two">
    <div class="card">
      <div class="eyebrow">Claude Code</div>
      <h3>One command</h3>
      <pre><code>${esc(CLAUDE_CODE_COMMAND)}</code></pre>
    </div>
    <div class="card">
      <div class="eyebrow">VS Code</div>
      <h3>One command</h3>
      <pre><code>${esc(VSCODE_COMMAND)}</code></pre>
    </div>
    <div class="card">
      <div class="eyebrow">Claude desktop &amp; web</div>
      <h3>Add a custom connector</h3>
      <p style="color:var(--ac-muted);font-size:14.5px;margin:0">Settings → Connectors → Add custom
      connector, then paste the endpoint URL above. There is no OAuth step: the tools are free and
      unauthenticated.</p>
    </div>
  </div>
  <div class="grid two" style="margin-top:14px">
    <div class="card" id="manual">
      <div class="eyebrow">Claude Code, Cursor &amp; most clients</div>
      <h3><code>mcpServers</code> config</h3>
      <pre><code>${esc(configJson)}</code></pre>
    </div>
    <div class="card">
      <div class="eyebrow">VS Code · .vscode/mcp.json</div>
      <h3><code>servers</code> config</h3>
      <p style="color:var(--ac-muted);font-size:14px;margin:0">VS Code keys off
      <code>servers</code>, not <code>mcpServers</code> — the other shape is ignored silently.</p>
      <pre><code>${esc(vscodeConfigJson)}</code></pre>
    </div>
  </div>
</div></section>

<section><div class="wrap">
  <h2>What it can do</h2>
  <p class="sub">Rendered from the server's live tool list, so this table cannot drift from what
  <code>tools/list</code> answers.</p>
  <table>
    <thead><tr><th style="width:230px">Tool</th><th>Description</th></tr></thead>
    <tbody>${toolRows}</tbody>
  </table>
</div></section>

<section><div class="wrap">
  <h2>Showcases</h2>
  <p class="sub">Four calls you can paste and run right now. Every one of them hits a record that is
  already published — none of this is a mock-up, and each card states what the call does
  <em>not</em> prove.</p>
  <div class="grid two">${SHOWCASES.map(showcaseCard).join("")}</div>
</div></section>

<section><div class="wrap">
  <h2>Published passports</h2>
  <p class="sub">The packs live at <code>/m/&lt;slug&gt;</code>. Private cultivar libraries held for
  named growers are deliberately not listed here.</p>
  <ul class="packs">${packItems}</ul>
</div></section>

<section><div class="wrap">
  <h2>The regulation behind the DPP tool</h2>
  <p class="sub">${esc(String(LAW_COUNT))} of the ${esc(String(DPP_CATEGORIES.length))} categories
  carries an obligation that is already law; ${esc(String(EXPECTED_COUNT))} are European Commission
  targets, not adopted law. <code>dpp_readiness_check</code> returns the distinction with every
  score, because treating a target as a deadline is how a compliance programme gets mispriced.</p>
  <div class="card">
    <div class="eyebrow">In force</div>
    <h3>${esc(BATTERY?.label ?? "Battery passport")}</h3>
    <p style="margin:0;color:var(--ac-muted);font-size:14.5px">${esc(BATTERY?.when ?? "")}
    <br><span style="font-size:13.5px">${esc(BATTERY?.source ?? "")}</span></p>
  </div>
  <p class="limit" style="margin-top:16px"><b>Limit.</b> Self-assessment from answers you supply.
  Not legal advice.</p>
</div></section>

<footer><div class="wrap">
  <p>Certificates are ERC-721 on Polygon at <code>${esc(CERT_CONTRACT)}</code>.
  Verification is free and always will be: <a href="https://authichain.com/protocol">read the open
  verifier</a>, or run it offline with <code>npx authichain-verify</code>.</p>
  <p style="margin:0"><a href="${esc(MCP_ENDPOINT)}">MCP discovery</a> ·
  <a href="https://authichain.com/protocol">Protocol</a> ·
  <a href="https://authichain.com/dpp-check">DPP check</a> ·
  <a href="https://github.com/undone0603/authichain-unified">Source</a></p>
</div></footer>

</body></html>`;
}
