import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify as verifySignature,
} from "crypto";
import { ClaimEvaluationResult, ClaimPassport, PassportStatus } from "./types";

type ClaimPassportData = Omit<
  ClaimPassport,
  "documentHash" | "evidenceManifestHash" | "passportHash" | "signature"
>;

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(item => (item === undefined ? "null" : canonicalize(item))).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .filter(key => record[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("Claim passport data must be JSON serializable");
  }
  return serialized;
}

function passportDocumentHash(
  passportData: ClaimPassportData,
  evidenceManifestHash: string
): string {
  return createHash("sha256")
    .update(canonicalize({ ...passportData, evidenceManifestHash }))
    .digest("hex");
}

export function generatePassportHash(
  passportData: ClaimPassportData,
  evidenceManifest: any
): {
  documentHash: string;
  evidenceManifestHash: string;
  passportHash: string;
  signature: string;
} {
  const manifestString = canonicalize(evidenceManifest);
  const evidenceManifestHash = createHash("sha256")
    .update(manifestString)
    .digest("hex");
  const documentHash = passportDocumentHash(
    passportData,
    `sha256:${evidenceManifestHash}`
  );
  const passportPayload = `${documentHash}:${evidenceManifestHash}:${passportData.issuer}`;
  const passportHash = createHash("sha256")
    .update(passportPayload)
    .digest("hex");

  const privateKeyPem = process.env.AUTHICHAIN_COMPLIANCE_SIGNING_PRIVATE_KEY;
  if (!privateKeyPem) {
    throw new Error(
      "AUTHICHAIN_COMPLIANCE_SIGNING_PRIVATE_KEY is required to issue claim passports"
    );
  }
  const privateKey = createPrivateKey(privateKeyPem.replace(/\\n/g, "\n"));
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error(
      "AUTHICHAIN_COMPLIANCE_SIGNING_PRIVATE_KEY must be an Ed25519 private key"
    );
  }
  const signature = sign(
    null,
    Buffer.from(passportHash, "hex"),
    privateKey
  ).toString("base64url");

  return {
    documentHash: `sha256:${documentHash}`,
    evidenceManifestHash: `sha256:${evidenceManifestHash}`,
    passportHash: `sha256:${passportHash}`,
    signature: `ed25519:${signature}`,
  };
}

export function verifyClaimPassport(
  passport: ClaimPassport,
  publicKeyPem: string
): boolean {
  try {
    const {
      documentHash,
      evidenceManifestHash,
      passportHash,
      signature,
      ...passportData
    } = passport;
    const rawEvidenceHash = evidenceManifestHash.replace(/^sha256:/, "");
    const rawDocumentHash = documentHash.replace(/^sha256:/, "");
    const rawPassportHash = passportHash.replace(/^sha256:/, "");
    if (
      !/^[a-f0-9]{64}$/.test(rawEvidenceHash) ||
      !/^[a-f0-9]{64}$/.test(rawDocumentHash) ||
      !/^[a-f0-9]{64}$/.test(rawPassportHash) ||
      !signature.startsWith("ed25519:")
    ) {
      return false;
    }

    const expectedDocumentHash = passportDocumentHash(
      passportData,
      evidenceManifestHash
    );
    if (expectedDocumentHash !== rawDocumentHash) return false;

    const expectedPassportHash = createHash("sha256")
      .update(`${rawDocumentHash}:${rawEvidenceHash}:${passportData.issuer}`)
      .digest("hex");
    if (expectedPassportHash !== rawPassportHash) return false;

    return verifySignature(
      null,
      Buffer.from(rawPassportHash, "hex"),
      createPublicKey(publicKeyPem),
      Buffer.from(signature.slice("ed25519:".length), "base64url")
    );
  } catch {
    return false;
  }
}

export function createClaimPassport(
  productId: string,
  determinationId: string,
  evaluation: ClaimEvaluationResult,
  evidenceManifest: any,
  client?: string
): ClaimPassport {
  const passportId = `miusa_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
  const status: PassportStatus = evaluation.reviewRequired
    ? "REVIEW_REQUIRED"
    : "ACTIVE";
  const passportData: ClaimPassportData = {
    passportId,
    productId,
    determinationId,
    issuer: "AuthiChain Compliance Engine",
    client,
    status,
    metadata: {
      claim: evaluation.claimText,
      decision: evaluation.decision,
      confidence: evaluation.confidence,
      warnings: evaluation.warnings,
      disclaimer:
        "AuthiChain substantiation record. Not legal advice or government certification.",
    },
    createdAt: new Date().toISOString(),
  };
  const hashes = generatePassportHash(passportData, evidenceManifest);

  return {
    ...passportData,
    documentHash: hashes.documentHash,
    evidenceManifestHash: hashes.evidenceManifestHash,
    passportHash: hashes.passportHash,
    signature: hashes.signature,
  };
}
