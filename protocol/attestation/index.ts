import { AttestationEngine } from "./engine";

// Keys are resolved lazily at request time so production secrets are never
// parsed during `next build` and no invalid placeholder key can enter a bundle.
export const attestationEngine = new AttestationEngine();

export * from "./types";
export * from "./mapper";
