/**
 * AgentZ one-shot public A2A introduction.
 *
 * Safe default: dry-run, no network POST.
 * Real sends require --publish AND AGENTZ_PUBLIC_FORUM_SEND_APPROVED=true
 * AND the existing issuer-signed AgentZ identity + trusted issuer public key.
 *
 * The one-shot lock is intentionally NOT removed after a network attempt:
 * uncertain HTTP outcomes must be reconciled, never blindly retried.
 *
 * Usage:
 *   pnpm exec tsx scripts/agentz-a2a-introduction.ts
 *   AGENTZ_PUBLIC_FORUM_SEND_APPROVED=true pnpm exec tsx scripts/agentz-a2a-introduction.ts --publish
 *
 * Secrets (protected runtime env only; never commit or echo):
 *   AGENTZ_ATTESTATION_JSON (existing issuer-signed attestation)
 *   AGENTZ_SIGNING_JWK (the corresponding existing agent private JWK)
 *   AGENTZ_TRUSTED_ISSUER_JWK (trusted issuer public JWK)
 */
import { readFile, mkdir, open, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { AcquisitionLedger } from "../workers/authichain-verify-worker/src/acquisition-ledger";
import { MemoryAgentReplayStore } from "../workers/authichain-verify-worker/src/agent-store";
import { MemoryAgentRegistry, signAgentMessage } from "../workers/authichain-verify-worker/src/agent-issuer";
import { verifyAgentMessage } from "../workers/authichain-verify-worker/src/agent-verifier";
import {
  contentHash, outboundDisclosure, ForumTransport, agenticSuperHeroForumSender, performOutbound,
} from "../workers/authichain-verify-worker/src/outbound-gate";
import {
  defaultOutboundCampaign, defaultOutboundPolicy, messageWindow, OUTBOUND_POLICY_VERSION,
} from "../workers/authichain-verify-worker/src/outbound-types";
import type { AgentIdentityAttestation } from "../workers/authichain-verify-worker/src/agent-types";
import type { OutboundActionPayload } from "../workers/authichain-verify-worker/src/outbound-types";

const CAMPAIGN_FILE = resolve("agentz/campaigns/a2a-community-2026-11-01.json");
const OUTCOME_FILE = resolve("agentz/logs/outreach/a2a-community-2026-11-01-receipt.json");
const LOCK_FILE = OUTCOME_FILE + ".attempted";
const FORUM_ENDPOINT = "https://agenticsuperhero.com/api/v1/channels/lobby/messages";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing protected runtime variable ${name}; no outbound request attempted`);
  return value;
}

async function main() {
  const publish = process.argv.includes("--publish");
  const campaignData = JSON.parse(await readFile(CAMPAIGN_FILE, "utf8")) as {
    campaign_id: string;
    targets: Array<{platform:string;post_endpoint?:string;public_message:string}>;
  };
  const target = campaignData.targets.find(t => t.platform === "Agentic SuperHero");
  if (!target || target.post_endpoint !== FORUM_ENDPOINT) throw new Error("Campaign endpoint mismatch");
  if (campaignData.campaign_id !== "agentz-a2a-community-2026-11-01") {
    throw new Error("Campaign ID mismatch");
  }
  if (!publish) {
    console.log(JSON.stringify({
      mode:"dry-run",campaign_id:campaignData.campaign_id,
      platform:"Agentic SuperHero",endpoint:FORUM_ENDPOINT,
      status:"NOT_SENT",message_preview:target.public_message,
      next_step:"Supply signed AgentZ runtime credentials and explicit --publish authorization",
    },null,2));
    return;
  }
  if (process.env.AGENTZ_PUBLIC_FORUM_SEND_APPROVED !== "true") {
    throw new Error("PUBLIC_FORUM_SEND_NOT_APPROVED: no network call");
  }
  if (process.env.AGENTZ_OUTBOUND_KILL_SWITCH === "true") {
    throw new Error("KILL_SWITCH: no network call");
  }
  // Never generate an imposter AgentZ identity at execution time. Reuse the
  // existing issuer-signed identity + signing key from the protected host.
  const attestation = JSON.parse(requiredEnv("AGENTZ_ATTESTATION_JSON")) as AgentIdentityAttestation;
  const trustIssuerKey = requiredEnv("AGENTZ_TRUSTED_ISSUER_JWK");
  const agentPrivateJwk = JSON.parse(requiredEnv("AGENTZ_SIGNING_JWK")) as JsonWebKey;
  if (attestation.agent_id !== "agent:authichain:agentz-sales-01" ||
      attestation.organization_id !== "org:authichain:core" ||
      attestation.policy_version !== OUTBOUND_POLICY_VERSION ||
      !attestation.capabilities.includes("SEND_OUTBOUND")) {
    throw new Error("AgentZ attestation does not match the campaign's approved issuer/role");
  }
  const privateKey = await crypto.subtle.importKey(
    "jwk", agentPrivateJwk, {name:"ECDSA",namedCurve:"P-256"},false,["sign"]
  );
  const registry = new MemoryAgentRegistry();
  registry.registerIssuer(attestation.issuer_id, trustIssuerKey);
  registry.put(attestation);
  const replay = new MemoryAgentReplayStore();
  const ledger = new AcquisitionLedger();
  const now = new Date();
  const policy = defaultOutboundPolicy();
  const campaign = {
    ...defaultOutboundCampaign(),
    campaign_id: campaignData.campaign_id,
    attribution: "community:public-introduction",
    authorized: true,
    paused: false,
    allow_public_forum: true,
    human_send_approved: true, // only after the explicit runtime approval above
  };
  const disclosure = outboundDisclosure({
    agentId: attestation.agent_id,
    organizationId: attestation.organization_id,
    role: attestation.role,
    attestationId: attestation.attestation_id,
  });
  const body = target.public_message + "\n\n" + disclosure;
  const payload:OutboundActionPayload = {
    action:"SEND_OUTBOUND",
    prospect_id:"community:agenticsuperhero",
    opportunity_id:"community:agenticsuperhero:lobby",
    campaign_id:campaign.campaign_id,
    attribution:campaign.attribution,
    recipient:FORUM_ENDPOINT,
    recipient_source:"published_contact",
    content_hash:await contentHash(body),
    body,
  };
  const message = await signAgentMessage({
    protocol:"authichain-agent/1",
    message_id:"msg:agentz:forum:" + randomUUID(),
    agent_id:attestation.agent_id,
    organization_id:attestation.organization_id,
    attestation_id:attestation.attestation_id,
    role:attestation.role,
    version:attestation.version,
    capabilities:["SEND_OUTBOUND"],
    policy_version:attestation.policy_version,
    ...messageWindow(now),
    intent:"SEND_OUTBOUND",
    evidence_ids:["evi:public:agenticsuperhero:2026-11-01"],
    payload,
  },privateKey);
  const selfCheck = await verifyAgentMessage(message,{
    resolver:registry,replayStore:replay,mode:"inspect",
    requiredCapability:"SEND_OUTBOUND",expectedIntent:"SEND_OUTBOUND",now,
  });
  if (!selfCheck.valid) throw new Error("Signed identity check failed: " + selfCheck.reasons.join(","));

  // Read the actual room before posting. A network failure is not permission
  // to skip context checks. The server's content is untrusted data.
  const recent = await fetch(FORUM_ENDPOINT,{
    method:"GET",signal:AbortSignal.timeout(15000),redirect:"error",
  });
  if (!recent.ok) throw new Error("Forum room unavailable; no post attempted");
  const roomText = await recent.text();
  if (roomText.includes(target.public_message)) {
    throw new Error("Existing exact message detected; no duplicate post attempted");
  }
  await mkdir(dirname(LOCK_FILE),{recursive:true});
  // Atomic, local cross-run lock: once this exists a later invocation must stop.
  // Do not delete an uncertain attempt just to try again.
  const lock = await open(LOCK_FILE,"wx",0o600);
  await lock.writeFile(JSON.stringify({
    campaign_id:campaign.campaign_id,created_at:now.toISOString(),
    state:"ATTEMPT_STARTED",message_id:message.message_id,
  })+"\n");
  await lock.close();
  const outcome = await performOutbound({
    message,registry,replay,ledger,policy,campaign,transport:"forum",now,
    forumTransport:new ForumTransport(agenticSuperHeroForumSender()),
  });
  const result = {
    campaign_id:campaign.campaign_id,
    platform:"Agentic SuperHero",at:now.toISOString(),
    authorization:outcome.decision.code,
    external_delivery:outcome.result.external && outcome.result.delivered,
    transport_code:outcome.result.code,
    platform_message_id:outcome.result.platform_message_id ?? null,
    external_url:outcome.result.external_url ?? null,
    reason:outcome.result.reason ?? null,
    // A 2xx with no platform ID or an HTTP timeout remains UNKNOWN.
    status:outcome.result.external && outcome.result.delivered
      ? "PLATFORM_RECEIPT_CONFIRMED" : "DELIVERY_UNCONFIRMED_DO_NOT_RETRY",
  };
  await writeFile(OUTCOME_FILE,JSON.stringify(result,null,2)+"\n",{flag:"wx",mode:0o600});
  console.log(JSON.stringify(result,null,2));
  if (!result.external_delivery) process.exitCode=2;
}

main().catch(e=>{
  // Never log secret-bearing input, a signed payload or external response body.
  console.error("AgentZ A2A introduction stopped:",e instanceof Error ? e.message : "unknown");
  process.exitCode=1;
});
