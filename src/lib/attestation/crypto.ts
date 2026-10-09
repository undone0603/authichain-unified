import crypto from "node:crypto";

export function canonicalizeRFC8785(data: unknown): string {
  if (data === null || typeof data !== "object") {
    return JSON.stringify(data);
  }

  if (Array.isArray(data)) {
    return "[" + data.map(item => canonicalizeRFC8785(item)).join(",") + "]";
  }

  const obj = data as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries: string[] = [];

  for (const key of sortedKeys) {
    if (obj[key] !== undefined) {
      entries.push(JSON.stringify(key) + ":" + canonicalizeRFC8785(obj[key]));
    }
  }

  return "{" + entries.join(",") + "}";
}

export function canonicalToBytes(data: unknown): Uint8Array {
  const canonicalString = canonicalizeRFC8785(data);
  return new TextEncoder().encode(canonicalString);
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

export function signCanonicalData(
  data: unknown,
  privateKeyPem: string
): string {
  const canonicalBytes = canonicalToBytes(data);
  const signatureBuffer = crypto.sign(null, canonicalBytes, privateKeyPem);
  return signatureBuffer.toString("base64");
}

export function verifyCanonicalSignature(
  data: unknown,
  signatureBase64: string,
  publicKeyPem: string
): boolean {
  try {
    const canonicalBytes = canonicalToBytes(data);
    const signatureBuffer = Buffer.from(signatureBase64, "base64");
    return crypto.verify(null, canonicalBytes, publicKeyPem, signatureBuffer);
  } catch (err) {
    return false;
  }
}
