/**
 * Paid verify for the public edge, where POST /api/x402 and POST /mcp
 * actually arrive.
 *
 * authichain-app does not answer POST /api/v1/agent-verify (it 404s), so
 * forwarding VERIFY_APP cannot complete a call. When this worker has
 * SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY,
 * it reads auth_seals over PostgREST and settles only after that read
 * succeeds. A missing row is a real answer (not_registered). A lookup
 * failure is HTTP 503 with settled:false, before settlePayment().
 *
 * verified stays false. attestSeal needs the Node verifier and is not
 * bundled here; a registry row is not an Ed25519 attestation.
 *
 * X402_PAID_VERIFY_BOUND stays false until a live paid POST returns 200.
 */
import { parseSealRequest, registryAnswer } from "./agent-verify";
import {
  buildPaymentRequired,
  dailyCapUsd,
  parsePaymentHeader,
  paymentResponseHeaders,
  settlePayment,
  usdToAtomic,
  verifyPaymentProof,
  wouldExceedCap,
} from "./x402";

const SEAL_SELECT = "id,product_id,batch_id,brand,created_at";

export type SealLookupEnv = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export type SealLookupCredentials = {
  url: string;
  key: string;
  role: "service" | "anon";
};

export function sealLookupCredentials(
  env?: SealLookupEnv
): SealLookupCredentials | null {
  const url = (env?.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const service = (env?.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const anon = (env?.SUPABASE_ANON_KEY || "").trim();
  if (!url || !/^https:\/\//i.test(url)) return null;
  if (service) return { url, key: service, role: "service" };
  if (anon) return { url, key: anon, role: "anon" };
  return null;
}

export type PaidSealDecision =
  | {
      action: "answer";
      status: number;
      body: unknown;
      headers?: Record<string, string>;
    }
  | { action: "forward" }
  | { action: "unbound" };

/**
 * Dev-mode settlement (no facilitator, settled:true, trustless:false) is
 * allowed only in test and development. A public worker with NODE_ENV
 * unset must not answer 200 for an unsettled proof.
 */
function nonTrustlessAllowed(): boolean {
  const mode = process.env.NODE_ENV;
  return mode === "test" || mode === "development";
}

function restHeaders(
  key: string,
  extra?: Record<string, string>
): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    ...extra,
  };
}

async function readJson(
  fetchImpl: typeof fetch,
  url: string,
  key: string
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    const res = await fetchImpl(url, {
      headers: restHeaders(key),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false };
    return { ok: true, body: await res.json() };
  } catch {
    return { ok: false };
  }
}

async function dailySpentAtomic(
  fetchImpl: typeof fetch,
  creds: SealLookupCredentials,
  payer: string,
  priceAtomic: bigint
): Promise<bigint> {
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const query = [
    "automation_logs?select=id",
    "workflow_name=eq.x402_spend",
    `payload=eq.${encodeURIComponent(payer)}`,
    `created_at=gt.${encodeURIComponent(windowStart)}`,
    "limit=1000",
  ].join("&");
  const read = await readJson(
    fetchImpl,
    `${creds.url}/rest/v1/${query}`,
    creds.key
  );
  if (!read.ok || !Array.isArray(read.body)) return 0n;
  return BigInt(read.body.length) * priceAtomic;
}

async function readSeal(
  fetchImpl: typeof fetch,
  creds: SealLookupCredentials,
  sealId: string
): Promise<
  { ok: true; seal: Record<string, unknown> | null } | { ok: false }
> {
  const query = `auth_seals?id=eq.${encodeURIComponent(sealId)}&select=${SEAL_SELECT}`;
  const read = await readJson(
    fetchImpl,
    `${creds.url}/rest/v1/${query}`,
    creds.key
  );
  if (!read.ok || !Array.isArray(read.body)) return { ok: false };
  const row = read.body[0];
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return { ok: true, seal: null };
  }
  return { ok: true, seal: row as Record<string, unknown> };
}

async function recordSpend(
  fetchImpl: typeof fetch,
  creds: SealLookupCredentials,
  payer: string
): Promise<void> {
  if (creds.role !== "service") return;
  try {
    await fetchImpl(`${creds.url}/rest/v1/automation_logs`, {
      method: "POST",
      headers: restHeaders(creds.key, {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      }),
      body: JSON.stringify({
        workflow_name: "x402_spend",
        trigger_type: "event",
        status: "success",
        payload: payer,
      }),
    });
  } catch {
    // The caller already settled. Dropping the ledger row fails the cap
    // open on the next call; it must not drop the answer.
  }
}

export async function resolvePaidSealVerify(input: {
  hasVerifyApp: boolean;
  proofHeader: string;
  bodyText: string;
  resource: string;
  priceUsd: number;
  payTo: string;
  description: string;
  env?: SealLookupEnv;
  fetchImpl?: typeof fetch;
}): Promise<PaidSealDecision> {
  const creds = sealLookupCredentials(input.env);
  if (!creds) {
    return input.hasVerifyApp ? { action: "forward" } : { action: "unbound" };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const required = buildPaymentRequired({
    resource: input.resource,
    priceUsd: input.priceUsd,
    payTo: input.payTo,
    description: input.description,
  });
  const proof = parsePaymentHeader(input.proofHeader);
  if (!proof) {
    return {
      action: "answer",
      status: 402,
      body: required.v2,
      headers: required.headers,
    };
  }

  const verification = verifyPaymentProof(proof, required.body.accepts[0]);
  if (!verification.valid) {
    return {
      action: "answer",
      status: 402,
      body: { ...required.v2, error: verification.reason },
      headers: required.headers,
    };
  }

  let parsedBody: Record<string, unknown> = {};
  if (input.bodyText.trim()) {
    try {
      const value = JSON.parse(input.bodyText) as unknown;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        parsedBody = value as Record<string, unknown>;
      }
    } catch {
      parsedBody = {};
    }
  }
  const parsed = parseSealRequest(parsedBody);
  if (!parsed.ok) {
    return { action: "answer", status: parsed.status, body: parsed.body };
  }

  const priceAtomic = BigInt(usdToAtomic(input.priceUsd));
  const capAtomic = BigInt(usdToAtomic(dailyCapUsd()));
  const spent = await dailySpentAtomic(
    fetchImpl,
    creds,
    proof.payer,
    priceAtomic
  );
  if (wouldExceedCap(spent, priceAtomic, capAtomic)) {
    return {
      action: "answer",
      status: 402,
      body: { error: "daily_spend_cap_exceeded", capUsd: dailyCapUsd() },
    };
  }

  const lookup = await readSeal(fetchImpl, creds, parsed.sealId);
  if (!lookup.ok) {
    return {
      action: "answer",
      status: 503,
      body: { error: "registry_unavailable", settled: false },
    };
  }

  const settlement = await settlePayment(
    input.proofHeader,
    required.body.accepts[0]
  );
  if (
    !settlement.settled ||
    (!settlement.trustless && !nonTrustlessAllowed())
  ) {
    return {
      action: "answer",
      status: 402,
      body: {
        ...required.v2,
        error: settlement.reason ?? "payment_not_settled",
      },
      headers: required.headers,
    };
  }

  await recordSpend(fetchImpl, creds, proof.payer);
  const answer = registryAnswer(lookup.seal);
  return {
    action: "answer",
    status: 200,
    body: {
      verified: false,
      registered: answer.registered,
      status: answer.status,
      checks: answer.checks,
      subject: parsed.sealId,
      details: answer.details,
      settlement: {
        payer: proof.payer,
        amountAtomic: verification.amount.toString(),
        txHash: settlement.txHash ?? proof.txHash ?? null,
        trustless: settlement.trustless,
      },
      timestamp: new Date().toISOString(),
    },
    headers: paymentResponseHeaders({
      success: true,
      transaction: settlement.txHash ?? proof.txHash,
      network: required.body.accepts[0].network,
      payer: proof.payer,
    }),
  };
}

