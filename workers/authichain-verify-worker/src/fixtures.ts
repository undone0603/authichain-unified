/**
 * Draft-branch demo catalog. Not a live mint. Not GTR.
 * Production worker on main does not serve these until this PR is reviewed.
 */
import type { TrustInput } from "./evaluate";

export type FixtureRecord = {
  id: string;
  source: "fixture";
  label: string;
  page?: string;
  input: TrustInput;
};

const VERIFIED: TrustInput = {
  objectFound: true,
  objectId: "AC:DEMO:VERIFIED",
  identity: { serial: "AC:DEMO:VERIFIED" },
  depth: "lookup",
  crypto: {
    signatureValid: true,
    issuerTrusted: true,
    identityValid: true,
    evidenceIntact: true,
    statusActive: true,
  },
  attestation: {
    objectId: "AC:DEMO:VERIFIED",
    status: "active",
    decision: "verified",
    issuer: "did:key:z6MkjchhfUsD6mmvni8mCdXHw216Xrm9bQe2mBH1P5RDjVJG",
    evidence: [{ type: "coa", digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
  },
};

const REVOKED: TrustInput = {
  objectFound: true,
  objectId: "AC:DEMO:REVOKED",
  identity: { serial: "AC:DEMO:REVOKED" },
  depth: "lookup",
  crypto: {
    signatureValid: true,
    issuerTrusted: true,
    identityValid: true,
    evidenceIntact: true,
    statusActive: false,
  },
  attestation: {
    objectId: "AC:DEMO:REVOKED",
    status: "revoked",
    decision: "verified",
    issuer: "did:key:z6MkjchhfUsD6mmvni8mCdXHw216Xrm9bQe2mBH1P5RDjVJG",
    evidence: [],
  },
};

const EXPIRED: TrustInput = {
  objectFound: true,
  objectId: "AC:DEMO:EXPIRED",
  identity: { serial: "AC:DEMO:EXPIRED" },
  depth: "lookup",
  crypto: {
    signatureValid: true,
    issuerTrusted: true,
    identityValid: true,
    evidenceIntact: true,
    statusActive: true,
  },
  attestation: {
    objectId: "AC:DEMO:EXPIRED",
    status: "expired",
    decision: "expired",
    issuer: "did:key:z6MkjchhfUsD6mmvni8mCdXHw216Xrm9bQe2mBH1P5RDjVJG",
    evidence: [],
  },
};

const CATALOG: Record<string, FixtureRecord> = {
  "AC:DEMO:VERIFIED": {
    id: "AC:DEMO:VERIFIED",
    source: "fixture",
    label: "Signed fixture — not a live Polygon mint",
    input: VERIFIED,
  },
  "AC:DEMO:REVOKED": {
    id: "AC:DEMO:REVOKED",
    source: "fixture",
    label: "Revoked fixture — kernel blocked",
    input: REVOKED,
  },
  "AC:DEMO:EXPIRED": {
    id: "AC:DEMO:EXPIRED",
    source: "fixture",
    label: "Expired fixture",
    input: EXPIRED,
  },
};

const ALIASES: Record<string, string> = {
  DEMO: "AC:DEMO:VERIFIED",
  "DEMO-VERIFIED": "AC:DEMO:VERIFIED",
  "DEMO-REVOKED": "AC:DEMO:REVOKED",
  "DEMO-EXPIRED": "AC:DEMO:EXPIRED",
};

export function lookupFixture(identifier: string): FixtureRecord | null {
  const id = identifier.trim().toUpperCase();
  const mapped = ALIASES[id] || id;
  return CATALOG[mapped] ?? null;
}

/** Public genetics pages are not seals. Do not map them to verified. */
export function libraryPageFor(identifier: string): string | null {
  const id = identifier.trim().toUpperCase();
  if (id === "VT-26" || id === "MENDO" || id === "MENDO-VT-26" || id === "MENDO-LOVE-FARMS") {
    return "https://strainchain.io/genetics/mendo-love-farms";
  }
  return null;
}
