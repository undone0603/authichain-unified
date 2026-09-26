/**
 * Workers-safe Trust Kernel. Twin of evaluate.mjs without the Node CLI block.
 * Crypto verdict is an INPUT. Do not invent signatureValid:false.
 */
export type Decision =
  | "verified"
  | "anomaly"
  | "blocked"
  | "expired"
  | "invalid"
  | "not_found";

export type Depth = "lookup" | "history";

export type Scan = { at: string; lat?: number; lon?: number; region?: string };

export type Evidence = {
  type: string;
  issuer?: string;
  timestamp?: string;
  digest?: string;
};

export type CryptoInput = {
  signatureValid?: boolean;
  issuerTrusted?: boolean;
  identityValid?: boolean;
  evidenceIntact?: boolean;
  statusActive?: boolean;
};

export type EvaluateInput = {
  objectFound?: boolean;
  depth?: Depth;
  crypto?: CryptoInput;
  identity?: { serial?: string };
  attestation?: {
    objectId?: string;
    decision?: string;
    status?: string;
    issuer?: string;
    evidence?: Evidence[];
  };
  evidence?: Evidence[];
  scans?: Scan[];
};

export type Vector = {
  identity: string;
  issuer: string;
  signature: string;
  provenance: string;
  physical_binding: string;
  scan_behavior: string;
  revocation: string;
  freshness: string;
};

export type Verdict = {
  decision: Decision;
  vector: Vector;
  reasons: string[];
  unknowns: string[];
  depthUsed: Depth;
};

const MAX_PLAUSIBLE_MPS = 250;
const EARTH_KM = 6371;
const MOCK_DIGEST = /^sha256:mock-digest/;
const REAL_SHA256 = /^sha256:[A-Fa-f0-9]{64}$/;

export function isMockDigest(d: unknown): boolean {
  return typeof d === "string" && MOCK_DIGEST.test(d);
}
export function isRealSha256(d: unknown): boolean {
  return typeof d === "string" && REAL_SHA256.test(d);
}

function toRad(n: number): number {
  return (n * Math.PI) / 180;
}

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(x));
}

function parseTs(at: string): number {
  const n = Date.parse(at);
  if (Number.isNaN(n)) throw new Error(`scan_timestamp_malformed:${at}`);
  return n / 1000;
}

export function scanAnomalies(scans: Scan[] = []): string[] {
  const reasons: string[] = [];
  const ordered = [...scans].sort((x, y) => parseTs(x.at) - parseTs(y.at));
  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i];
    const b = ordered[i + 1];
    if ([a.lat, a.lon, b.lat, b.lon].some((v) => typeof v !== "number")) continue;
    const km = haversineKm(
      { lat: a.lat as number, lon: a.lon as number },
      { lat: b.lat as number, lon: b.lon as number },
    );
    const dt = parseTs(b.at) - parseTs(a.at);
    if (dt <= 0) {
      reasons.push("scan_timestamp_non_monotonic");
      continue;
    }
    if ((km * 1000) / dt > MAX_PLAUSIBLE_MPS) {
      reasons.push(`impossible_travel:${Math.round(km)}km_in_${Math.round(dt)}s`);
    }
  }
  if (ordered.length >= 3) {
    const window = parseTs(ordered[ordered.length - 1].at) - parseTs(ordered[0].at);
    const regions = new Set(ordered.map((s) => s.region).filter(Boolean));
    if (window <= 7200 && regions.size >= 3) reasons.push("cloned_identity_pattern");
  }
  return reasons;
}

function emptyVector(): Vector {
  return {
    identity: "not_supplied",
    issuer: "unknown",
    signature: "unknown",
    provenance: "unknown",
    physical_binding: "unknown",
    scan_behavior: "clear",
    revocation: "clear",
    freshness: "unknown",
  };
}

export function evaluate(input: EvaluateInput = {}): Verdict {
  const depthUsed: Depth = input.depth === "history" ? "history" : "lookup";
  const vector = emptyVector();
  const reasons: string[] = [];
  const unknowns: string[] = ["physical_binding_not_inspected"];
  const att = input.attestation;
  const crypto = input.crypto || {};
  const evidence = [...(input.evidence || []), ...((att && att.evidence) || [])];

  if (!input.objectFound && !att && !input.crypto) {
    return {
      decision: "not_found",
      vector,
      reasons: ["object_not_found"],
      unknowns,
      depthUsed,
    };
  }

  if (crypto.signatureValid === true) vector.signature = "verified";
  else if (crypto.signatureValid === false) {
    vector.signature = "failed";
    reasons.push("signature_invalid");
  }

  if (crypto.issuerTrusted === true) vector.issuer = "verified";
  else if (crypto.issuerTrusted === false) {
    vector.issuer = "failed";
    reasons.push("issuer_untrusted");
  }

  if (crypto.identityValid === true) vector.identity = "verified";
  else if (crypto.identityValid === false) {
    vector.identity = input.identity ? "failed" : "not_supplied";
    reasons.push("identity_mismatch");
  } else if (input.identity && input.identity.serial) {
    vector.identity = "partial";
  }

  if (crypto.statusActive === true) {
    vector.revocation = "clear";
    vector.freshness = "verified";
  }

  const realEvidence = evidence.filter((e) => isRealSha256(e.digest));
  const mockEvidence = evidence.filter((e) => isMockDigest(e.digest));
  if (mockEvidence.length) {
    vector.provenance = "unknown";
    reasons.push("mock_digest_unusable");
    unknowns.push("evidence_digest_not_computed");
  } else if (crypto.evidenceIntact === true && realEvidence.length) {
    vector.provenance = "verified";
  } else if (realEvidence.length) {
    vector.provenance = "partial";
  }

  if (att?.status === "revoked") {
    vector.revocation = "failed";
    reasons.push("attestation_revoked");
  }
  if (att?.status === "expired" || att?.decision === "expired") {
    vector.freshness = "failed";
    reasons.push("attestation_expired");
  }
  if (att?.decision === "blocked") reasons.push("attestation_blocked");

  if (realEvidence.some((e) => e.type === "inspection")) {
    vector.physical_binding = "partial";
    const idx = unknowns.indexOf("physical_binding_not_inspected");
    if (idx >= 0) unknowns.splice(idx, 1);
    unknowns.push("physical_condition_not_fully_inspected");
  }

  if (depthUsed === "history") {
    const scanReasons = scanAnomalies(input.scans || []);
    if (scanReasons.length) {
      vector.scan_behavior = "anomalous";
      reasons.push(...scanReasons);
    } else if ((input.scans || []).length) {
      vector.scan_behavior = "clear";
    }
  } else {
    vector.scan_behavior = "unknown";
    unknowns.push("scan_history_not_in_lookup_depth");
  }

  let decision: Decision;
  if (reasons.includes("object_not_found")) decision = "not_found";
  else if (reasons.includes("signature_invalid") || reasons.includes("issuer_untrusted"))
    decision = "invalid";
  else if (reasons.includes("attestation_revoked") || reasons.includes("attestation_blocked"))
    decision = "blocked";
  else if (reasons.includes("attestation_expired")) decision = "expired";
  else if (vector.scan_behavior === "anomalous" || att?.decision === "anomaly")
    decision = "anomaly";
  else if (vector.signature === "verified" && vector.revocation === "clear")
    decision = "verified";
  else decision = "invalid";

  return { decision, vector, reasons, unknowns, depthUsed };
}
