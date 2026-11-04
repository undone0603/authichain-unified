/**
 * Public MCP + A2A connection setup catalogue.
 *
 * IMPORTANT: not Stripe products, not deployed peer integrations, not
 * permission to publish keys, send messages, sign, settle or charge.
 * Quote-only setup requires a written scope and owner approval.
 */
export const MCP_REMOTE_ENDPOINT = "https://authichain.com/mcp";
export const A2A_AGENT_CARD_URL =
  "https://authichain.com/.well-known/agent-card.json";
export const A2A_JSONRPC_ENDPOINT = "https://authichain.com/api/a2a";

export const AGENT_SETUP_OFFERS = [
  {
    id: "mcp-self-connect",
    name: "Connect AuthiChain MCP",
    availability: "self_service",
    billing: "free",
    description:
      "Add the public read-only MCP tools to a supported client. No keys, no account and no paid call are required for setup.",
    deliverable:
      "An MCP client configuration and a successful tools/list discovery on the user's device.",
    requirements: ["An MCP client that supports Streamable HTTP"],
  },
  {
    id: "mcp-assisted-setup",
    name: "Assisted MCP integration",
    availability: "written_scope_required",
    billing: "quote_only",
    description:
      "Human-reviewed client configuration, tool permission mapping, troubleshooting and a reproducible connection test for the customer's environment.",
    deliverable:
      "Written connection configuration, evidence of read-only discovery, and an acceptance checklist.",
    requirements: [
      "Customer controls the client and explicitly authorizes any credential use",
      "Scope, support window and price must be agreed in writing before charge",
    ],
  },
  {
    id: "a2a-peer-onboarding",
    name: "A2A peer interoperability setup",
    availability: "written_scope_required",
    billing: "quote_only",
    description:
      "Review public Agent Cards and supported interface declarations, plan scoped peer interaction, and document identity and authentication boundaries.",
    deliverable:
      "Validated Agent Card, an explicit peer-connection plan, test evidence and a human-approved trust policy.",
    requirements: [
      "Peer owner's explicit authorization",
      "HTTPS Agent Card and compatible A2A transport",
      "Separate approval for messaging, credentials, payments or persistent tasks",
    ],
  },
] as const;

export function agentConnectionDiscovery() {
  return {
    schema: "authichain-agent-connections/1",
    status: "public_discovery_only",
    negotiation: {
      endpoint: "https://authichain.com/agent-compatibility",
      apiEndpoint: "https://authichain.com/api/agent-compatibility",
      status: "read_only_capability_preflight",
      standardizedHandshake: false,
      authorizationGranted: false,
    },
    mcp: {
      transport: "streamable_http",
      endpoint: MCP_REMOTE_ENDPOINT,
      configuration: {
        mcpServers: {
          authichain: { type: "http", url: MCP_REMOTE_ENDPOINT },
        },
      },
      freeTools: "Inspect using tools/list; paid verify is a separate x402 rail",
      remoteToolsAuthorized: false,
    },
    a2a: {
      version: "1.0",
      agentCard: A2A_AGENT_CARD_URL,
      transport: "JSONRPC",
      endpoint: A2A_JSONRPC_ENDPOINT,
      status: "public_card_available_not_peer_connected",
      connectionRequiresPeerConsent: true,
      taskMessagingAutomaticallyAuthorized: false,
    },
    offers: AGENT_SETUP_OFFERS,
    quoteRequest: "mailto:hello@authichain.com?subject=MCP%20A2A%20integration%20scope",
    boundaries: [
      "No connection to a third-party agent is established by reading this catalogue",
      "No API keys or secrets are requested or transmitted",
      "No charging, contract, agent messaging, issuer signing or outbound sending",
      "x402 pay-per-call is independent of quote-only human setup work",
    ],
  };
}

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, c => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] ?? c;
  });
}

export function renderAgentSetupOffers(): string {
  const cards = AGENT_SETUP_OFFERS.map(offer => {
    const href =
      offer.billing === "free"
        ? "#install"
        : agentConnectionDiscovery().quoteRequest;
    const cta =
      offer.billing === "free"
        ? "Use free install instructions"
        : "Request written scope";
    return `<article class="card">
      <div class="eyebrow">${esc(offer.billing === "free" ? "Free" : "Written quote · no checkout")}</div>
      <h3>${esc(offer.name)}</h3>
      <p style="color:var(--ac-muted);font-size:14.5px">${esc(offer.description)}</p>
      <p style="color:var(--ac-muted);font-size:14px"><strong>Acceptance:</strong> ${esc(offer.deliverable)}</p>
      <a href="${esc(href)}">${esc(cta)} →</a>
    </article>`;
  }).join("");

  return `<section id="agent-connections"><div class="wrap">
    <h2>MCP &amp; A2A connections</h2>
    <p class="sub">Free client setup is available now. Assisted integration and agent-to-agent peer onboarding
    are quote-only services requiring a written scope and owner-approved trust policy. No payment is collected on this page.</p>
    <p class="sub">Read-only compatibility preflight: <a href="/agent-compatibility"><code>/agent-compatibility</code></a>.
    It lists supported versions and compatible public capabilities; it is not an MCP or A2A protocol handshake
    and never authorizes a peer, payment or outbound task.</p>
    <div class="grid two three">${cards}</div>
    <div class="grid two" style="margin-top:14px">
      <div class="card">
        <div class="eyebrow">MCP · Streamable HTTP</div>
        <h3>Public tool connection</h3>
        <p style="color:var(--ac-muted)">Add <code>${esc(MCP_REMOTE_ENDPOINT)}</code> to your client, then call
        <code>initialize</code> and <code>tools/list</code>. Reading the tools does not execute them or authorize a paid verification.</p>
        <a href="${esc(MCP_REMOTE_ENDPOINT)}">Inspect public discovery →</a>
      </div>
      <div class="card">
        <div class="eyebrow">A2A · 1.0 JSON-RPC</div>
        <h3>Review Agent Card before connecting</h3>
        <p style="color:var(--ac-muted)">Fetch the public <a href="${esc(A2A_AGENT_CARD_URL)}">Agent Card</a>
        and inspect its <code>supportedInterfaces</code>, skills and authentication declarations.
        The declared JSON-RPC service is <code>${esc(A2A_JSONRPC_ENDPOINT)}</code>.</p>
        <p class="limit"><b>Boundary.</b> Discovery is not an established peer relationship.
        Messaging, credentials, payments and autonomous tasks require separate consent.</p>
      </div>
    </div>
  </div></section>`;
}
