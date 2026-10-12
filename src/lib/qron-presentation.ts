/**
 * AuthiChain QRON Presentation v0 — Living QR bind to Decision v1.
 *
 * MVP-2: a generated Living QR carries a presentation envelope that names the
 * AuthiChain Verification Decision v1 contract and (when a JWS is present)
 * the attestation that estate verify endpoints accept. Image-only generates
 * stay `image_issued` until an issuer-signed JWS is attached.
 */

export const QRON_PRESENTATION_SCHEMA = "AuthiChain QRON Presentation v0";

export const DECISION_CONTRACT = "AuthiChain Verification Decision v1";

/** Public canonical verify used by estate adapters when unset. */
export const CANONICAL_VERIFY_URL =
  "https://authichain.com/api/v1/attestation/verify";

export const ESTATE_VERIFY_URLS = [
  "https://qron.space/api/verify",
  "https://strainchain.io/api/verify",
  "https://govchain.us/api/verify",
] as const;

export type QronPresentationStatus = "image_issued" | "attestation_bound";

export type QronPresentationAttestation = {
  jws: string;
  kid: string;
  jwks_url: string;
};

export type QronPresentation = {
  schema: typeof QRON_PRESENTATION_SCHEMA;
  status: QronPresentationStatus;
  destination_url: string;
  image_url: string;
  object_id: string;
  mode?: string;
  prompt?: string;
  verify: {
    decision_contract: typeof DECISION_CONTRACT;
    canonical_url: string;
    estate_urls: readonly string[];
  };
  attestation: QronPresentationAttestation | null;
};

export type QronAttestationSubjectDraft = {
  object_id: string;
  product_class: "living_qr";
};

/** FNV-1a 32-bit hex — stable, dependency-free object_id suffix. */
export function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Canonical object_id for a Living QR destination URL.
 * Lowercases scheme/host; leaves path/query as-is after URL normalization.
 */
export function qronObjectIdForDestination(destinationUrl: string): string {
  const raw = destinationUrl.trim();
  let normalized = raw;
  try {
    const u = new URL(raw);
    u.hash = "";
    normalized = u.toString();
  } catch {
    normalized = raw;
  }
  return `qron:url:${fnv1aHex(normalized)}`;
}

export function buildQronAttestationSubject(
  destinationUrl: string
): QronAttestationSubjectDraft {
  return {
    object_id: qronObjectIdForDestination(destinationUrl),
    product_class: "living_qr",
  };
}

/** Issuer id used for AuthiChain-signed Living QR attestations. */
export const QRON_ATTESTATION_ISSUER = {
  id: "https://authichain.com",
  name: "AuthiChain",
} as const;

/** JWKS URL matching worker-app/issuer.ts (same keys as /.well-known/jwks.json). */
export const QRON_ATTESTATION_JWKS_URL =
  "https://authichain.com/protocol/jwks.json";

/**
 * Attestation Contract v0.1 payload for a Living QR destination.
 * Caller supplies sha256 digests (`sha256:` + 64 hex) for evidence.
 */
export function buildQronLivingQrAttestation(input: {
  destinationUrl: string;
  imageUrl: string;
  destinationDigest: string;
  imageDigest?: string;
  objectId?: string;
  issuedAt?: string;
  attestationId?: string;
  expiresAt?: string;
}): {
  version: "0.1";
  attestation_id: string;
  issuer: { id: string; name: string };
  subject: {
    object_id: string;
    product_class: "living_qr";
  };
  decision: "verified";
  status: "active";
  issued_at: string;
  expires_at?: string;
  evidence: Array<{
    id: string;
    type: string;
    digest: string;
    uri?: string;
  }>;
} {
  const destinationUrl = input.destinationUrl.trim();
  const imageUrl = input.imageUrl.trim();
  if (!destinationUrl) throw new Error("destinationUrl is required");
  if (!imageUrl) throw new Error("imageUrl is required");
  if (!/^sha256:[A-Fa-f0-9]{64}$/.test(input.destinationDigest)) {
    throw new Error("destinationDigest must be sha256:<64 hex chars>");
  }
  if (
    input.imageDigest !== undefined &&
    !/^sha256:[A-Fa-f0-9]{64}$/.test(input.imageDigest)
  ) {
    throw new Error("imageDigest must be sha256:<64 hex chars>");
  }

  const object_id =
    input.objectId?.trim() || qronObjectIdForDestination(destinationUrl);
  const issued_at = input.issuedAt || new Date().toISOString();
  const attestation_id =
    input.attestationId ||
    `urn:authichain:attestation:v01:qron-${fnv1aHex(object_id + issued_at)}`;

  const evidence: Array<{
    id: string;
    type: string;
    digest: string;
    uri?: string;
  }> = [
    {
      id: "living-qr-destination",
      type: "living_qr_destination",
      digest: input.destinationDigest,
      uri: destinationUrl,
    },
  ];
  if (input.imageDigest) {
    evidence.push({
      id: "living-qr-image",
      type: "living_qr_image",
      digest: input.imageDigest,
      uri: imageUrl.startsWith("data:") ? undefined : imageUrl,
    });
  }

  return {
    version: "0.1",
    attestation_id,
    issuer: { ...QRON_ATTESTATION_ISSUER },
    subject: { object_id, product_class: "living_qr" },
    decision: "verified",
    status: "active",
    issued_at,
    ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
    evidence,
  };
}

export function buildQronPresentation(input: {
  destinationUrl: string;
  imageUrl: string;
  mode?: string;
  prompt?: string;
  jws?: string | null;
  kid?: string | null;
  jwksUrl?: string | null;
  canonicalVerifyUrl?: string;
}): QronPresentation {
  const destination_url = input.destinationUrl.trim();
  const image_url = input.imageUrl.trim();
  if (!destination_url) throw new Error("destinationUrl is required");
  if (!image_url) throw new Error("imageUrl is required");

  const jws = typeof input.jws === "string" ? input.jws.trim() : "";
  const kid = typeof input.kid === "string" ? input.kid.trim() : "";
  const jwks_url =
    typeof input.jwksUrl === "string" ? input.jwksUrl.trim() : "";
  const bound = Boolean(jws && kid && jwks_url);

  return {
    schema: QRON_PRESENTATION_SCHEMA,
    status: bound ? "attestation_bound" : "image_issued",
    destination_url,
    image_url,
    object_id: qronObjectIdForDestination(destination_url),
    ...(input.mode ? { mode: input.mode } : {}),
    ...(input.prompt ? { prompt: input.prompt } : {}),
    verify: {
      decision_contract: DECISION_CONTRACT,
      canonical_url: input.canonicalVerifyUrl || CANONICAL_VERIFY_URL,
      estate_urls: ESTATE_VERIFY_URLS,
    },
    attestation: bound ? { jws, kid, jwks_url } : null,
  };
}
