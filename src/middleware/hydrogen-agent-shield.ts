import { buildAgentSafeProductEnvelope } from "../security/prompt-injection-guard.ts";

export interface HydrogenProductPayload {
  gtin: string;
  serial: string;
  assuranceTier: string;
  signatureValid: boolean;
  title: string;
  description: string;
  latestReview?: string;
}

export function serializeHydrogenProductForAgent(
  product: HydrogenProductPayload
) {
  return buildAgentSafeProductEnvelope({
    trustedClaims: {
      gtin: product.gtin,
      serial: product.serial,
      assuranceTier: product.assuranceTier,
      signatureValid: product.signatureValid,
    },
    untrustedMetadata: {
      title: product.title,
      description: product.description,
      ...(product.latestReview ? { latestReview: product.latestReview } : {}),
    },
  });
}
