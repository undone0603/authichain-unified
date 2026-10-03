/**
 * Paid verify may say `verified` only when the protocol verifier does.
 * A registry row with no Ed25519 proof is not an attestation.
 */
import { verifyRecord } from "../../protocol/verifier.mjs";

type Verdict = "verified" | "valid-unanchored" | "invalid" | "unsigned";

export type SealAttestation = {
  verified: boolean;
  verdict: Verdict;
  reasons: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  const obj = asRecord(value);
  if (!obj) return null;
  if (obj.proof) return obj;
  const nested = asRecord(obj.record);
  if (nested?.proof) return nested;
  return null;
}

export function extractProtocolRecord(
  seal: Record<string, unknown>
): Record<string, unknown> | null {
  const direct = recordFrom(seal.record);
  if (direct) return direct;
  const payload = seal.qr_payload ?? seal.qrPayload;
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed.startsWith("{")) return null;
    try {
      return recordFrom(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  return recordFrom(payload);
}

export function extractProtocolAnchor(
  seal: Record<string, unknown>
): Record<string, unknown> | null {
  const anchor = asRecord(seal.anchor);
  if (anchor?.recordHash && anchor.chain && anchor.txHash) return anchor;
  return null;
}

export function attestSeal(
  seal: Record<string, unknown> | null
): SealAttestation {
  if (!seal) {
    return { verified: false, verdict: "unsigned", reasons: ["seal_not_found"] };
  }
  const record = extractProtocolRecord(seal);
  if (!record) {
    return {
      verified: false,
      verdict: "unsigned",
      reasons: ["no_ed25519_proof"],
    };
  }
  const result = verifyRecord(record, extractProtocolAnchor(seal)) as {
    verdict?: string;
    reasons?: string[];
  };
  const verdict = result.verdict;
  if (
    verdict !== "verified" &&
    verdict !== "valid-unanchored" &&
    verdict !== "invalid"
  ) {
    return { verified: false, verdict: "invalid", reasons: ["verifier_error"] };
  }
  return {
    verified: verdict === "verified",
    verdict,
    reasons: result.reasons ?? [],
  };
}
