/**
 * Trust Kernel types. WRAP protocol/attestation/types.ts.
 * Do not introduce REVIEW as a public decision string.
 */
import type {
  Attestation,
  Evidence,
  Identity,
  VerificationResult,
} from "../attestation/types";

export type { Attestation, Evidence, Identity, VerificationResult };

/** Public operational decision. invalid|not_found are lookup-only. */
export type TrustDecision =
  | Attestation["decision"]
  | "invalid"
  | "not_found";

export type CheckState =
  | "verified"
  | "failed"
  | "partial"
  | "clear"
  | "unknown"
  | "not_supplied"
  | "anomalous";

export interface EvidenceVector {
  identity: CheckState;
  issuer: CheckState;
  signature: CheckState;
  provenance: CheckState;
  physical_binding: "unknown" | "partial";
  scan_behavior: CheckState;
  revocation: CheckState;
  freshness: CheckState;
}

export interface ScanEvent {
  at: string;
  lat?: number;
  lon?: number;
  region?: string;
  source?: string;
}

export interface TrustInput {
  objectFound: boolean;
  objectId?: string;
  identity?: Identity;
  attestation?: Attestation;
  crypto?: VerificationResult["checks"];
  evidence?: Evidence[];
  scans?: ScanEvent[];
  now?: string;
  depth?: "lookup" | "history";
}

export interface TrustEvaluation {
  decision: TrustDecision;
  vector: EvidenceVector;
  reasons: string[];
  unknowns: string[];
  depthUsed: "lookup" | "history";
}

export function isMockDigest(digest: string | undefined): boolean {
  return typeof digest === "string" && digest.startsWith("sha256:mock-digest");
}

export function isRealSha256(digest: string | undefined): boolean {
  return typeof digest === "string" && /^sha256:[A-Fa-f0-9]{64}$/.test(digest);
}
