import { Attestation, Identity, Evidence } from "./types";

export function mapDbToIdentity(product: any, cert: any): Identity {
  return {
    profile:
      product.category === "pharma"
        ? "pharma-dscsa"
        : product.category === "medical"
          ? "medical-device-udi"
          : "generic-provenance",
    gtin14: product.metadata?.gtin14,
    udiDi: product.metadata?.udiDi,
    udiPi: product.metadata?.udiPi,
    serial: cert.serial_number || product.serialNumber,
    lot: product.metadata?.lot,
    expirationDate: cert.expiresAt,
  };
}

export function mapDbToEvidence(product: any, cert: any, dpp: any): Evidence[] {
  const evidence: Evidence[] = [];

  if (product.manufacturingDate) {
    evidence.push({
      type: "manufacturing",
      issuer: "Manufacturer",
      timestamp: product.manufacturingDate,
      digest: "sha256:mock-digest-mfg",
    });
  }

  if (cert.status === "approved") {
    evidence.push({
      type: "inspection",
      issuer: "AuthiChain-Audit",
      timestamp: cert.issuedAt,
      digest: "sha256:mock-digest-insp",
    });
  }

  if (dpp) {
    evidence.push({
      type: "ownership",
      issuer: "DPP-Registry",
      timestamp: new Date().toISOString(),
      digest: "sha256:mock-digest-dpp",
    });
  }

  return evidence;
}
