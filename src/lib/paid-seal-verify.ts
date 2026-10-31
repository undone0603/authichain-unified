/**
 * Worker-local auth_seals read for paid verify. Settle only after that read
 * succeeds. verified is true only when attestSeal says the stored protocol
 * record is verified. A registry row with no Ed25519 proof stays unverified.
 */
import { createHash } from "node:crypto";
import { parseSealRequest, registryAnswer, type RegistryAnswer } from "./agent-verify";
import { attestSeal, type SealAttestation } from "./seal-attestation";
import {
  buildPaymentRequired,
  dailyCapUsd,
  isDiscoveryExampleSealId,
  parsePaymentHeader,
  paymentResponseHeaders,
  settlePayment,
  usdToAtomic,
  verifyPaymentProof,
  wouldExceedCap,
} from "./x402";

const SEAL_SELECT =
  "id,product_id,batch_id,brand,created_at,qr_payload,polygon_tx";

function withAttestation(
  answer: RegistryAnswer,
  attestation: SealAttestation
): { verified: boolean; answer: RegistryAnswer } {
  answer.details.verdict = attestation.verdict;
  answer.details.reasons = attestation.reasons;
  if (attestation.verdict !== "unsigned") {
    answer.checks.signature = "checked";
  }
  return { verified: attestation.verified, answer };
}

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

/** Replay guard (CFA-343/351): a proof is remembered this long. */
export const REPLAY_TTL_SECONDS = 7 * 24 * 60 * 60;
/** CFA-356: a pending marker outlives a settle attempt, not a week. */
export const PENDING_TTL_SECONDS = 300;
const PENDING = "pending";

/** Minimal KV surface (Cloudflare KVNamespace satisfies it). */
export type ReplayStore = {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    opts?: { expirationTtl?: number }
  ): Promise<void>;
  delete(key: string): Promise<void>;
};

function decodeHeader(proofHeader: string): Record<string, unknown> | null {
  try {
    return JSON.parse(
      Buffer.from(proofHeader, "base64").toString("utf8")
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function authorizationOf(
  proofHeader: string
): Record<string, unknown> | undefined {
  const raw = decodeHeader(proofHeader);
  const payload =
    raw?.payload && typeof raw.payload === "object"
      ? (raw.payload as Record<string, unknown>)
      : undefined;
  return payload?.authorization && typeof payload.authorization === "object"
    ? (payload.authorization as Record<string, unknown>)
    : undefined;
}

/** EIP-3009 authorization nonce from a base64 x402 payment header, if any. */
export function authorizationNonce(proofHeader: string): string | null {
  const nonce =
    authorizationOf(proofHeader)?.nonce ?? decodeHeader(proofHeader)?.nonce;
  return typeof nonce === "string" && nonce ? nonce.toLowerCase() : null;
}

/** EIP-3009 validBefore (unix seconds), if present and numeric. */
export function authorizationValidBefore(proofHeader: string): number | null {
  const v =
    authorizationOf(proofHeader)?.validBefore ??
    decodeHeader(proofHeader)?.validBefore;
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && /^\d+$/.test(v)
        ? Number(v)
        : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * CFA-351: a proof valid for longer than the replay TTL could outlive its KV
 * record and be replayed later, so refuse it. Returns the refusal or null.
 */
export function validityRefusal(
  proofHeader: string,
  nowMs = Date.now()
): { status: number; body: unknown } | null {
  const vb = authorizationValidBefore(proofHeader);
  // CFA-356: without validBefore the proof's lifetime is unbounded, so the
  // 7-day replay record could expire while it is still spendable.
  if (vb === null) {
    return {
      status: 402,
      body: { error: "authorization_missing_valid_before", settled: false },
    };
  }
  if (vb - Math.floor(nowMs / 1000) > REPLAY_TTL_SECONDS) {
    return {
      status: 402,
      body: {
        error: "authorization_validity_too_long",
        settled: false,
        maxValiditySeconds: REPLAY_TTL_SECONDS,
      },
    };
  }
  return null;
}

/**
 * Scope a shared replay KV to one site so the four workers that share
 * X402_REPLAY_KV (authichain-com, qron-space, strainchain-io, govchain-us)
 * never read or write each other's markers. Null store stays null, which paid paths refuse with 503 (CFA-363).
 */
export function scopedReplayStore(
  store: ReplayStore | null | undefined,
  site: string
): ReplayStore | null {
  if (!store) return null;
  const p = `site:${site}:`;
  return {
    get: k => store.get(p + k),
    put: (k, v, o) => store.put(p + k, v, o),
    delete: k => store.delete(p + k),
  };
}

/** KV keys for one payment: nonce (else signature, else sha256 of header) + tx hash. */
export function replayKeys(
  proofHeader: string,
  proof: { signature?: string; txHash?: string }
): string[] {
  const keys: string[] = [];
  const nonce = authorizationNonce(proofHeader);
  if (nonce) keys.push(`x402:nonce:${nonce}`);
  else if (proof.signature)
    keys.push(`x402:sig:${proof.signature.toLowerCase()}`);
  else
    keys.push(
      `x402:hdr:${createHash("sha256").update(proofHeader).digest("hex")}`
    );
  if (proof.txHash) keys.push(`x402:tx:${proof.txHash.toLowerCase()}`);
  return keys;
}

export const REPLAY_REJECTED_BODY = {
  error: "payment_proof_already_used",
  settled: false,
  message: "This payment proof was already used. Sign a new payment.",
};

const STORE_DOWN = {
  status: 503,
  body: { error: "replay_store_unavailable", settled: false },
};

/** Read-only check: 409 if any marker (pending or settled) exists. */
export async function replayRefusal(
  store: ReplayStore | null | undefined,
  keys: string[]
): Promise<{ status: number; body: unknown } | null> {
  if (!store) {
    // CFA-363: a paid path without X402_REPLAY_KV fails closed, never open.
    console.warn(JSON.stringify({ evt: "x402_replay_store_unbound" }));
    return STORE_DOWN;
  }
  try {
    const seen = await Promise.all(keys.map(k => store.get(k)));
    return seen.some(v => v !== null)
      ? { status: 409, body: REPLAY_REJECTED_BODY }
      : null;
  } catch {
    return STORE_DOWN;
  }
}

/**
 * Check, then write a "pending" marker BEFORE settle (CFA-351). KV is
 * eventually consistent (~60s), so this narrows but does not close the race.
 */
export async function claimReplay(
  store: ReplayStore | null | undefined,
  keys: string[]
): Promise<{ status: number; body: unknown } | null> {
  const refusal = await replayRefusal(store, keys);
  if (refusal || !store) return refusal;
  try {
    await Promise.all(
      keys.map(k =>
        store.put(k, PENDING, { expirationTtl: PENDING_TTL_SECONDS })
      )
    );
  } catch {
    return STORE_DOWN;
  }
  return null;
}

/** Settle failed: drop the pending markers so the payer can retry. */
export async function releaseReplay(
  store: ReplayStore | null | undefined,
  keys: string[]
): Promise<void> {
  if (!store) return;
  try {
    await Promise.all(keys.map(k => store.delete(k)));
  } catch {
    // Worst case the payer re-signs; never a second charge.
  }
}

/** Settle succeeded: overwrite markers with the settled record (+ tx hash). */
export async function rememberSettledProof(
  store: ReplayStore | null | undefined,
  keys: string[],
  record: { sealId?: string | null; txHash?: string | null }
): Promise<void> {
  if (!store) return;
  const tx = record.txHash ? record.txHash.toLowerCase() : null;
  const all = tx ? [...new Set([...keys, `x402:tx:${tx}`])] : keys;
  const value = JSON.stringify({
    sealId: record.sealId ?? null,
    txHash: tx,
    at: new Date().toISOString(),
  });
  try {
    await Promise.all(
      all.map(k => store.put(k, value, { expirationTtl: REPLAY_TTL_SECONDS }))
    );
  } catch {
    // Pending markers stay (still block reuse); the on-chain nonce blocks a second charge.
  }
}

/** Settled tx hash from a PAYMENT-RESPONSE header (base64 JSON) or a JSON body. */
export function settledTxHash(
  paymentResponse: string | null,
  body: unknown
): string | null {
  if (paymentResponse) {
    const raw = decodeHeader(paymentResponse);
    const t = raw?.transaction ?? raw?.txHash;
    if (typeof t === "string" && t) return t;
  }
  const b = body as {
    settlement?: { txHash?: unknown };
    transaction?: unknown;
  } | null;
  const t = b?.settlement?.txHash ?? b?.transaction;
  return typeof t === "string" && t ? t : null;
}

/** True for a JSON-RPC error envelope or an MCP tool result flagged isError. */
export function isRpcFailure(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as { error?: unknown; result?: { isError?: unknown } };
  if (b.error !== undefined && b.error !== null && "jsonrpc" in b) return true;
  return b.result?.isError === true;
}

function jsonRefusal(r: { status: number; body: unknown }): Response {
  return new Response(JSON.stringify(r.body), {
    status: r.status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

/**
 * VERIFY_APP fallback: VERIFY_APP settles, so guard at the edge. Claim the
 * proof before forwarding; record it on upstream 2xx, release it otherwise.
 */
export async function guardedForward(input: {
  proofHeader: string;
  replayStore?: ReplayStore | null;
  sealId?: string | null;
  forward: () => Promise<Response>;
}): Promise<Response> {
  const tooLong = validityRefusal(input.proofHeader);
  if (tooLong) return jsonRefusal(tooLong);
  const proof = parsePaymentHeader(input.proofHeader);
  const keys = replayKeys(input.proofHeader, proof ?? {});
  const refusal = await claimReplay(input.replayStore, keys);
  if (refusal) return jsonRefusal(refusal);
  let upstream: Response;
  try {
    upstream = await input.forward();
  } catch (err) {
    await releaseReplay(input.replayStore, keys);
    throw err;
  }
  if (!upstream.ok) {
    await releaseReplay(input.replayStore, keys);
    return upstream;
  }
  if (input.replayStore) {
    let body: unknown = null;
    try {
      body = await upstream.clone().json();
    } catch {
      body = null;
    }
    // CFA-366 P3: a JSON-RPC error (or result.isError) inside HTTP 200 is not
    // a settled payment. Drop the pending marker so the payer can retry.
    if (isRpcFailure(body)) {
      await releaseReplay(input.replayStore, keys);
      return upstream;
    }
    await rememberSettledProof(input.replayStore, keys, {
      sealId: input.sealId,
      txHash: settledTxHash(upstream.headers.get("PAYMENT-RESPONSE"), body),
    });
  }
  return upstream;
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
  /** KV for the replay guard. Absent = 503 replay_store_unavailable (CFA-363). */
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
        parsedBody = coerceSealBody(value as Record<string, unknown>);
      }
    } catch {
      parsedBody = {};
    }
  }
  const parsed = parseSealRequest(parsedBody);
  const listed = listedSealId(parsedBody);
  const discoveryAlias = Boolean(listed) && isDiscoveryExampleSealId(listed);
  // Empty unpaid is the 402 price challenge. x402 clients retry that same
  // empty body with a payment header. Listing samples (`demo`, bazaar UUID)
  // and quote-crawler JSON with no sealId settle as missing-seal evidence.
  // A sealId that is not a UUID stays 400 before settle so the agent is not
  // charged for a key that cannot exist.
  if (!parsed.ok && listed && !discoveryAlias) {
    return { action: "answer", status: parsed.status, body: parsed.body };
  }
  const sealId = parsed.ok ? parsed.sealId : null;

  // Replay guard: refuse any reuse of a settled proof, BEFORE settling.
  const keys = replayKeys(input.proofHeader, proof);
  const replayStore = input.replayStore ?? null;
  const tooLong = validityRefusal(input.proofHeader);
  if (tooLong) return { action: "answer", ...tooLong };
  const refusal = await replayRefusal(replayStore, keys);
  if (refusal) return { action: "answer", ...refusal };

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

  let seal: Record<string, unknown> | null = null;
  if (sealId) {
    const lookup = await readSeal(fetchImpl, creds, sealId);
    if (!lookup.ok) {
      return {
        action: "answer",
        status: 503,
        body: { error: "registry_unavailable", settled: false },
      };
    }
    seal = lookup.seal;
  }

  // Prepare evidence before taking payment; verifier failures cannot charge
  // the caller and then prevent delivery of a result. Empty body is missing
  // evidence, not a registry outage.
  const answer = sealBaseline(seal);

  // Pending marker BEFORE settle (CFA-351); released if settle fails.
  const claim = await claimReplay(replayStore, keys);
  if (claim) return { action: "answer", ...claim };
  let settlement: Awaited<ReturnType<typeof settlePayment>>;
  try {
    settlement = await settlePayment(
      input.proofHeader,
      required.body.accepts[0]
    );
  } catch (err) {
    await releaseReplay(replayStore, keys);
    throw err;
  }
  if (
    !settlement.settled ||
    (!settlement.trustless && !nonTrustlessAllowed())
  ) {
    await releaseReplay(replayStore, keys);
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

  await rememberSettledProof(replayStore, keys, {
    sealId,
    txHash: settlement.txHash ?? proof.txHash ?? null,
  });
  await recordSpend(fetchImpl, creds, proof.payer);
  const attested = withAttestation(
    registryAnswer(lookup.seal),
    attestSeal(lookup.seal)
  );
  const answer = attested.answer;
  return {
    action: "answer",
    status: 200,
    body: {
      verified: attested.verified,
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
