import { generateKeyPairSync, sign, verify } from 'crypto';

/**
 * AuthiChain Protocol Cryptographic Utilities
 * Implementation of Ed25519 signing for W3C Verifiable Credentials.
 */

export function generateProtocolKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  };
}

export function signCredential(payload: string, privateKeyPem: string): string {
  // In a real production HSM, this would call AWS CloudHSM or similar
  const signature = sign(null, Buffer.from(payload), privateKeyPem);
  return signature.toString('base64');
}

export function verifySignature(payload: string, signatureBase64: string, publicKeyPem: string): boolean {
  return verify(null, Buffer.from(payload), publicKeyPem, Buffer.from(signatureBase64, 'base64'));
}
