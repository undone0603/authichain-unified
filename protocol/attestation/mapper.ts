import { Identity, Evidence } from "./types";

const REAL_SHA256 = /^sha256:[A-Fa-f0-9]{64}$/;

function digestOrOmit(bytes: string | undefined): string | null {
  if (!bytes) return null;
  if (bytes.startsWith("sha256:mock-digest")) return null;
  if (!REAL_SHA256.test(bytes)) return null;
  return bytes;
}

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

  const mfgDigest = digestOrOmit(product.evidenceDigest || product.manufacturingDigest);
  if (product.manufacturingDate && mfgDigest) {
    evidence.push({
      type: "manufacturing",
      issuer: "Manufacturer",
      timestamp: product.manufacturingDate,
      digest: mfgDigest,
    });
  }

  const inspDigest = digestOrOmit(cert.evidenceDigest || cert.inspectionDigest);
  if (cert.status === "approved" && inspDigest) {
    evidence.push({
      type: "inspection",
      issuer: "AuthiChain-Audit",
      timestamp: cert.issuedAt,
      digest: inspDigest,
    });
  }

  const dppDigest = digestOrOmit(dpp?.evidenceDigest || dpp?.digest);
  if (dpp && dppDigest) {
    evidence.push({
      type: "ownership",
      issuer: "DPP-Registry",
      timestamp: dpp.timestamp || new Date().toISOString(),
      digest: dppDigest,
    });
  }

  return evidence;
}
