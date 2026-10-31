import { attestationEngine } from "../protocol/attestation/index";
import type {
  Attestation,
  Evidence,
  Identity,
} from "../protocol/attestation/types";
import { passportVerdict, type PassportVerdict } from "./passport-verdict";

export const ATTESTATION_SIGNED_SENTENCE =
  "A signed attestation for {digitalIdentity} uses the passport verdict. The certificate status was not the decision.";

export const ATTESTATION_UNSIGNED_SENTENCE =
  "An approved row is not signed as verified. The scan reads a stored passport.";

type PassportCarrier = { metadata?: unknown } | null | undefined;
type CertCarrier =
  | {
      metadata?: unknown;
      id?: unknown;
      serial_number?: unknown;
      serialNumber?: unknown;
    }
  | null
  | undefined;
type ProductCarrier = PassportCarrier & {
  serialNumber?: unknown;
  id?: unknown;
};

export type AttestSigner = (
  objectId: string,
  identity: Identity,
  evidence: Evidence[],
  decision: "verified"
) => Promise<Attestation>;

export type AttestStoredPassportResult =
  | {
      signed: false;
      reason: "passport_not_genuine";
      message: typeof ATTESTATION_UNSIGNED_SENTENCE;
    }
  | {
      signed: true;
      digitalIdentity: string;
      message: string;
      attestation: Attestation;
    };

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function objectIdOf(verdict: PassportVerdict, cert: CertCarrier): string {
  return (
    nonEmpty(verdict.digitalIdentity) ??
    (nonEmpty(cert?.id) ? `authi:${nonEmpty(cert?.id)}` : null) ??
    "stored-passport"
  );
}

function identityFor(
  product: ProductCarrier,
  cert: CertCarrier,
  digitalIdentity: string
): Identity {
  const serial =
    nonEmpty(cert?.serial_number) ??
    nonEmpty(cert?.serialNumber) ??
    nonEmpty(product?.serialNumber) ??
    digitalIdentity;
  return {
    profile: "generic-provenance",
    serial,
  };
}

/**
 * Sign decision "verified" only after passportVerdict.verified is true.
 * Certificate status is not the decision. This does not issue a certificate.
 */
export async function attestStoredPassport(
  product: ProductCarrier,
  cert: CertCarrier,
  deps?: { createAttestation?: AttestSigner }
): Promise<AttestStoredPassportResult> {
  const verdict = passportVerdict(product, cert);
  if (verdict.verified !== true) {
    return {
      signed: false,
      reason: "passport_not_genuine",
      message: ATTESTATION_UNSIGNED_SENTENCE,
    };
  }
  const digitalIdentity = nonEmpty(verdict.digitalIdentity) ?? "";
  const sign =
    deps?.createAttestation ??
    attestationEngine.createAttestation.bind(attestationEngine);
  const attestation = await sign(
    objectIdOf(verdict, cert),
    identityFor(product, cert, digitalIdentity),
    [],
    "verified"
  );
  return {
    signed: true,
    digitalIdentity,
    message: ATTESTATION_SIGNED_SENTENCE.replace(
      "{digitalIdentity}",
      digitalIdentity
    ),
    attestation,
  };
}
