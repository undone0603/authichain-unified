/**
 * Public proof for one AgentZ message.
 * GET /agent/agentz checks the published signature, permission, and expiry.
 * It does not use the message up, and it does not authorize a send.
 */

import { verifyAgentMessage } from "../../authichain-verify-worker/src/agent-verifier";
import type { SignedAgentMessage } from "../../authichain-verify-worker/src/agent-message";
import type {
  AgentCapability,
  AgentIdentityResolver,
  AgentReplayStore,
} from "../../authichain-verify-worker/src/agent-types";
import { AGENTZ_PRESENTATION } from "./agentz-presentation";

const HTML_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
};

type OfferPayload = {
  agent_name: string;
  works_for: string;
  addressed_to: string;
  focus: string;
  text: string;
  acceptance: string;
};

function publishedMessage(): SignedAgentMessage<OfferPayload> {
  const message = AGENTZ_PRESENTATION.message;
  return {
    ...message,
    protocol: "authichain-agent/1",
    capabilities: [...message.capabilities] as AgentCapability[],
    evidence_ids: [...message.evidence_ids],
    payload: { ...message.payload },
  };
}

function resolver(): AgentIdentityResolver {
  const attestation = {
    ...AGENTZ_PRESENTATION.attestation,
    capabilities: [
      ...AGENTZ_PRESENTATION.attestation.capabilities,
    ] as AgentCapability[],
  };
  return {
    resolve: async (agentId, attestationId) =>
      agentId === attestation.agent_id &&
      attestationId === attestation.attestation_id
        ? attestation
        : null,
    isRevoked: async () => false,
    getIssuerPublicKey: async issuerId =>
      issuerId === attestation.issuer_id
        ? AGENTZ_PRESENTATION.issuer_public_key
        : null,
    isIssuerRevoked: async () => false,
  };
}

const unusedReplayStore: AgentReplayStore = {
  recordMessageNonce: async () => {
    throw new Error("The public page must not use the message up");
  },
  purgeExpiredNonces: async () => 0,
};

function esc(value: unknown): string {
  return String(value)
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

export async function renderAgentPresentation(options?: {
  now?: Date;
  message?: SignedAgentMessage<OfferPayload>;
}): Promise<{ valid: boolean; html: string; body: Record<string, unknown> }> {
  const message = options?.message ?? publishedMessage();
  const result = await verifyAgentMessage(message, {
    resolver: resolver(),
    replayStore: unusedReplayStore,
    now: options?.now ?? new Date(),
    mode: "inspect",
  });

  if (!result.valid) {
    const body = {
      valid: false,
      reasons: result.reasons,
      verified_at: result.verified_at,
    };
    const reasons = result.reasons
      .map(reason => `<li>${esc(reason)}</li>`)
      .join("");
    const html = page(
      "This message does not check out",
      `<p class="kicker">authichain-agent/1</p>
       <h1>This message does not check out</h1>
       <p>Nothing in it is authorized. The signature, the permission, or the expiry failed.</p>
       <ul>${reasons}</ul>`
    );
    return { valid: false, html, body };
  }

  const payload = message.payload;
  const body = {
    valid: true,
    agent_id: result.agent_id,
    organization_id: result.organization_id,
    role: message.role,
    capabilities: result.capabilities,
    intent: message.intent,
    expires_at: message.expires_at,
    message_digest: result.message_digest,
    payload,
    verified_at: result.verified_at,
  };
  const html = page(
    "AgentZ",
    `<p class="kicker">authichain-agent/1</p>
     <h1>This message checks out</h1>
     <p>${esc(payload.text)}</p>
     <dl>
       <dt>Agent</dt><dd>${esc(payload.agent_name)} (${esc(result.agent_id)})</dd>
       <dt>Works for</dt><dd>${esc(payload.works_for)} (${esc(result.organization_id)})</dd>
       <dt>Addressed to</dt><dd>${esc(payload.addressed_to)}</dd>
       <dt>Focus</dt><dd>${esc(payload.focus)}</dd>
       <dt>Allowed</dt><dd>${esc((result.capabilities ?? []).join(", "))}</dd>
       <dt>Not allowed</dt><dd>Sending this offer, registering a product, or calling the draft a battery passport.</dd>
       <dt>Expires</dt><dd>${esc(message.expires_at)}</dd>
       <dt>Digest</dt><dd><code>${esc(result.message_digest)}</code></dd>
     </dl>
     <p>${esc(payload.acceptance)}</p>
     <p>Opening this page does not use the message up. A repeat still checks out. Acting on it is a different check, and that check rejects a repeat.</p>`
  );
  return { valid: true, html, body };
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(title)}</title>
  <style>
    body{margin:0;background:#0c0c0d;color:#f2efe8;font-family:Georgia,serif}
    .wrap{max-width:38rem;margin:0 auto;padding:3rem 1.25rem 4rem}
    .kicker{letter-spacing:.14em;text-transform:uppercase;font-size:.75rem;color:#b8b4aa;font-family:system-ui,sans-serif}
    h1{font-size:2rem;font-weight:500;margin:.75rem 0 1rem}
    p,dd{line-height:1.55}
    dt{margin-top:1rem;font-family:system-ui,sans-serif;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:#b8b4aa}
    dd{margin:.25rem 0 0}
    code{font-size:.8rem;word-break:break-all}
    ul{padding-left:1.2rem}
  </style>
</head>
<body><main class="wrap">${body}</main></body>
</html>`;
}

export async function tryHandleAgentPresentation(
  request: Request
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (path !== "/agent/agentz") return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }
  const rendered = await renderAgentPresentation();
  const wantsJson =
    url.searchParams.get("format") === "json" ||
    (request.headers.get("accept") || "").includes("application/json");
  if (wantsJson) {
    return Response.json(rendered.body, {
      status: rendered.valid ? 200 : 400,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return new Response(request.method === "HEAD" ? null : rendered.html, {
    status: rendered.valid ? 200 : 400,
    headers: HTML_HEADERS,
  });
}
