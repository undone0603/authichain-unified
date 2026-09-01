import { AttestationEngine } from "./engine";

// In production, these would be loaded from a secure Vault/KMS
const PRIVATE_KEY =
  process.env.AUTHICHAIN_PRIVATE_KEY ||
  "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEI... (mock)\n-----END PRIVATE KEY-----";
const PUBLIC_KEY =
  process.env.AUTHICHAIN_PUBLIC_KEY ||
  "-----BEGIN PUBLIC KEY-----\nMCowBwgJKuZrZCNAi la... (mock)\n-----END PUBLIC KEY-----";

export const attestationEngine = new AttestationEngine(PRIVATE_KEY, PUBLIC_KEY);
export * from "./types";
export * from "./mapper";
