/**
 * Sign a Living QR attestation for POST /api/generate when the edge signing
 * key is bound. Soft-fails to null so generate can still return image_issued.
 */
import { importPKCS8 } from "jose";
import {
  signAttestation,
  type AuthiChainAttestationV01,
} from "../packages/verifier/src/index";
import {
  QRON_ATTESTATION_JWKS_URL,
  buildQronLivingQrAttestation,
  type QronPresentationAttestation,
} from "../src/lib/qron-presentation";
import {
  resolveAttestationKey,
  type AttestationEnv,
} from "./jwks";

async function sha256Digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(hash)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

export async function bindQronGenerateAttestation(
  env: AttestationEnv | undefined,
  args: {
    destinationUrl: string;
    imageUrl: string;
    objectId: string;
    userId: string;
  }
): Promise<QronPresentationAttestation | null> {
  const resolved = await resolveAttestationKey(env);
  if (!resolved.ok || !resolved.key.privatePem) {
    return null;
  }

  const destinationDigest = await sha256Digest(args.destinationUrl);
  // data: URLs can be huge; hash a bounded prefix + length for the image evidence.
  const imageMaterial = args.imageUrl.startsWith("data:")
    ? `${args.imageUrl.slice(0, 256)}|len:${args.imageUrl.length}`
    : args.imageUrl;
  const imageDigest = await sha256Digest(imageMaterial);

  const payload = buildQronLivingQrAttestation({
    destinationUrl: args.destinationUrl,
    imageUrl: args.imageUrl,
    objectId: args.objectId,
    destinationDigest,
    imageDigest,
  });

  const attestation = {
    ...payload,
    evidence: payload.evidence,
  } as AuthiChainAttestationV01;

  try {
    const privateKey = await importPKCS8(resolved.key.privatePem, "EdDSA");
    const jws = await signAttestation(
      attestation,
      privateKey,
      resolved.key.kid
    );
    return {
      jws,
      kid: resolved.key.kid,
      jwks_url: QRON_ATTESTATION_JWKS_URL,
    };
  } catch (err) {
    console.error(
      "[qron-generate-bind] sign failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
