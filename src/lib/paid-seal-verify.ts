/**
 * Worker-local auth_seals read for paid verify. Settle only after that read
 * succeeds. verified stays false: a registry row is not an attestation.
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

export function restHeaders(
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

export async function readJson(
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
): Promise<bigint | null> {
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
  // A failed ledger read must never look like zero spend: zero would allow a
  // caller to bypass the daily cap during an outage or RLS/config regression.
  if (!read.ok || !Array.isArray(read.body)) return null;
  return BigInt(read.body.length) * priceAtomic;
}

export async function readSeal(
  fetchImpl: typeof fetch,
  creds: SealLookupCredentials,
  sealId: string
): Promise<{ ok: true; seal: Record<string, unknown> | null } | { ok: false }> {
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
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // The caller already settled. Dropping the ledger row fails the cap
    // open on the next call; it must not drop the answer.
  }
}

/** Replay guard (CFA-343): a settled proof is remembered this long. */
export const REPLAY_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Minimal KV surface (Cloudflare KVNamespace satisfies it). */
export type ReplayStore = {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    opts?: { expirationTtl?: number }
  ): Promise<void>;
};

/** EIP-3009 authorization nonce from a base64 x402 payment header, if any. */
export function authorizationNonce(proofHeader: string): string | null {
  try {
    const raw = JSON.parse(
      Buffer.from(proofHeader, "base64").toString("utf8")
    ) as Record<string, unknown>;
    const payload =
      raw.payload && typeof raw.payload === "object"
        ? (raw.payload as Record<string, unknown>)
        : undefined;
    const auth =
      payload?.authorization && typeof payload.authorization === "object"
        ? (payload.authorization as Record<string, unknown>)
        : undefined;
    const nonce = auth?.nonce ?? raw.nonce;
    return typeof nonce === "string" && nonce ? nonce.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** KV keys identifying one payment: nonce (else signature, else header) + tx hash. */
export function replayKeys(
  proofHeader: string,
  proof: { signature?: string; txHash?: string }
): string[] {
  const keys: string[] = [];
  const nonce = authorizationNonce(proofHeader);
  if (nonce) keys.push(`x402:nonce:${nonce}`);
  else if (proof.signature)
    keys.push(`x402:sig:${proof.signature.toLowerCase()}`);
  else keys.push(`x402:hdr:${proofHeader.slice(0, 400)}`);
  if (proof.txHash) keys.push(`x402:tx:${proof.txHash.toLowerCase()}`);
  return keys;
}

export const REPLAY_REJECTED_BODY = {
  error: "payment_proof_already_used",
  settled: false,
  message: "This payment proof was already settled. Sign a new payment.",
};

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
  /** KV for the replay guard. Absent = guard off (logged). */
  replayStore?: ReplayStore | null;
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

  // Replay guard: refuse any reuse of a settled proof, BEFORE settling.
  const keys = replayKeys(input.proofHeader, proof);
  const replayStore = input.replayStore ?? null;
  if (replayStore) {
    let seen: Array<string | null>;
    try {
      seen = await Promise.all(keys.map(k => replayStore.get(k)));
    } catch {
      return {
        action: "answer",
        status: 503,
        body: { error: "replay_store_unavailable", settled: false },
      };
    }
    if (seen.some(v => v !== null)) {
      return { action: "answer", status: 409, body: REPLAY_REJECTED_BODY };
    }
  } else {
    console.warn(JSON.stringify({ evt: "x402_replay_guard_unbound" }));
  }

  const priceAtomic = BigInt(usdToAtomic(input.priceUsd));
  const capAtomic = BigInt(usdToAtomic(dailyCapUsd()));
  const spent = await dailySpentAtomic(
    fetchImpl,
    creds,
    proof.payer,
    priceAtomic
  );
  if (spent === null) {
    return {
      action: "answer",
      status: 503,
      body: { error: "spend_ledger_unavailable", settled: false },
    };
  }
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

  if (replayStore) {
    const settledTx = (settlement.txHash ?? proof.txHash)?.toLowerCase();
    const all = settledTx
      ? [...new Set([...keys, `x402:tx:${settledTx}`])]
      : keys;
    const record = JSON.stringify({
      sealId: parsed.sealId,
      txHash: settledTx ?? null,
      at: new Date().toISOString(),
    });
    try {
      await Promise.all(
        all.map(k =>
          replayStore.put(k, record, { expirationTtl: REPLAY_TTL_SECONDS })
        )
      );
    } catch {
      // Already settled; the on-chain nonce still blocks a second charge.
    }
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
