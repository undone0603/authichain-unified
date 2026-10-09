/**
 * x402 payment-proof replay guard (PM-330 item 2).
 *
 * Before this, nothing in our API stopped the same X-PAYMENT /
 * PAYMENT-SIGNATURE proof being submitted twice. Only the on-chain EIP-3009
 * nonce (when a facilitator really settles) and the per-payer daily cap
 * limited it. Every paid path now claims the proof in
 * public.x402_payment_proofs (PRIMARY KEY proof_key) BEFORE settlement:
 *
 *   - new proof            -> "claimed"   (settle; release if settlement fails)
 *   - proof seen before    -> "duplicate" (409 payment_proof_already_used)
 *   - ledger not reachable -> "unavailable" (503, fail closed, nothing settled)
 *
 * and a proof whose EIP-3009 `validBefore` has passed is refused (402
 * payment_proof_expired) before any claim.
 *
 * Only a SHA-256 digest of the proof identity is stored, never the proof.
 */

export type X402ProofKind = "eip3009_nonce" | "tx_hash" | "header";

export type X402ProofIdentity = {
  key: string;
  kind: X402ProofKind;
  network: string;
  payer: string;
  /** EIP-3009 validBefore, when the proof carries one. */
  validBefore: Date | null;
};

export type X402ProofClaim = "claimed" | "duplicate" | "unavailable";

export type X402LedgerCredentials = {
  url: string;
  key: string;
  role: "service" | "anon";
};

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function decodeHeader(header: string): Record<string, unknown> | null {
  try {
    const json = Buffer.from(header, "base64").toString("utf8");
    const value = JSON.parse(json) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function str(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

/**
 * Stable identity for one payment. Two encodings of the same EIP-3009
 * authorization (v1 X-PAYMENT vs v2 PAYMENT-SIGNATURE, re-ordered JSON) map to
 * the same key, because the key is network + payer + nonce, not the bytes.
 */
export async function x402ProofIdentity(
  proofHeader: string,
  proof: { network: string; payer: string; txHash?: string }
): Promise<X402ProofIdentity> {
  const raw = decodeHeader(proofHeader) ?? {};
  const payload = asRecord(raw.payload);
  const auth = asRecord(payload?.authorization);
  const network = proof.network.trim().toLowerCase();
  const payer = proof.payer.trim().toLowerCase();

  const validBeforeSec = Number(str(auth?.validBefore));
  const validBefore =
    Number.isFinite(validBeforeSec) && validBeforeSec > 0
      ? new Date(validBeforeSec * 1000)
      : null;

  const nonce = str(auth?.nonce).toLowerCase();
  if (nonce) {
    return {
      key: await sha256Hex(`eip3009:${network}:${payer}:${nonce}`),
      kind: "eip3009_nonce",
      network,
      payer,
      validBefore,
    };
  }
  const txHash = (proof.txHash ?? "").trim().toLowerCase();
  if (txHash) {
    return {
      key: await sha256Hex(`tx:${network}:${txHash}`),
      kind: "tx_hash",
      network,
      payer,
      validBefore,
    };
  }
  return {
    key: await sha256Hex(`header:${proofHeader.trim()}`),
    kind: "header",
    network,
    payer,
    validBefore,
  };
}

export function x402ProofExpired(
  identity: X402ProofIdentity,
  now: Date = new Date()
): boolean {
  return identity.validBefore !== null && identity.validBefore <= now;
}

export const X402_PROOF_ALREADY_USED = {
  error: "payment_proof_already_used",
  settled: false,
  message:
    "This payment proof was already submitted. Each x402 payment authorizes one call; sign a new one.",
} as const;

export const X402_PROOF_EXPIRED = {
  error: "payment_proof_expired",
  settled: false,
} as const;

export const X402_REPLAY_GUARD_UNAVAILABLE = {
  error: "replay_guard_unavailable",
  settled: false,
  message: "Refused before settlement; no payment was taken.",
} as const;

function restHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
}

/**
 * Insert-once claim over PostgREST. Needs the service role: the table has no
 * anon/authenticated grant, so an anon-only Worker fails closed here.
 */
export async function claimX402Proof(
  creds: X402LedgerCredentials | null,
  identity: X402ProofIdentity,
  resource: string,
  fetchImpl: typeof fetch = fetch
): Promise<X402ProofClaim> {
  if (!creds || creds.role !== "service") return "unavailable";
  try {
    const res = await fetchImpl(`${creds.url}/rest/v1/x402_payment_proofs`, {
      method: "POST",
      headers: restHeaders(creds.key),
      body: JSON.stringify({
        proof_key: identity.key,
        proof_kind: identity.kind,
        network: identity.network,
        payer: identity.payer,
        resource,
        expires_at: identity.validBefore
          ? identity.validBefore.toISOString()
          : "infinity",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return "claimed";
    if (res.status === 409) return "duplicate";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

/**
 * Settlement did not happen, so the authorization was never spent on-chain:
 * free the proof so the agent can retry it. Best effort.
 */
export async function releaseX402Proof(
  creds: X402LedgerCredentials | null,
  identity: X402ProofIdentity,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  if (!creds || creds.role !== "service") return;
  try {
    await fetchImpl(
      `${creds.url}/rest/v1/x402_payment_proofs?proof_key=eq.${identity.key}`,
      {
        method: "DELETE",
        headers: restHeaders(creds.key),
        signal: AbortSignal.timeout(8000),
      }
    );
  } catch {
    // A stuck claim only blocks a retry of an unsettled proof; the agent
    // can sign a new authorization.
  }
}
