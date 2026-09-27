/**
 * Draft-branch wire: public /api/verify lookup depth through evaluate().
 * No trust_score. No simulated agents. No live mint claim.
 * Fixture rows are labeled source=fixture. Catalog rows are Mendo only.
 * GTR stays unlisted and is not a lookup key here.
 */
import { evaluate, type TrustInput } from "../../../protocol/trust-kernel/evaluate.ts";

export const POLYGON_CONTRACT =
  "0x4da4D2675e52374639C9c954f4f653887A9972BE";

export const MENDO_VT26_URL =
  "https://strainchain.io/genetics/mendo-love-farms/vt-26";

const CATALOG: Record<
  string,
  { objectId: string; serial: string; publicUrl: string }
> = {
  "vt-26": {
    objectId: "vt-26",
    serial: "260320S005-001",
    publicUrl: MENDO_VT26_URL,
  },
  "260320s005-001": {
    objectId: "vt-26",
    serial: "260320S005-001",
    publicUrl: MENDO_VT26_URL,
  },
  "mendo-love-farms/vt-26": {
    objectId: "vt-26",
    serial: "260320S005-001",
    publicUrl: MENDO_VT26_URL,
  },
};

function norm(id: string): string {
  return id.trim().toLowerCase().replace(/^\/+/, "");
}

export function lookupInput(idRaw: string | null | undefined): {
  input: TrustInput;
  source: "none" | "catalog" | "fixture";
  publicUrl: string | null;
  objectId: string | null;
} {
  const id = norm(idRaw ?? "");
  if (!id) {
    return {
      input: { objectFound: false, depth: "lookup" },
      source: "none",
      publicUrl: null,
      objectId: null,
    };
  }

  if (id === "fixture:signed") {
    return {
      input: {
        objectFound: true,
        objectId: "fixture:signed",
        identity: { serial: "FIXTURE-SIGNED" },
        crypto: {
          signatureValid: true,
          issuerTrusted: true,
          identityValid: true,
          evidenceIntact: true,
          statusActive: true,
        },
        evidence: [
          {
            type: "attestation",
            digest:
              "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          },
        ],
        depth: "lookup",
      },
      source: "fixture",
      publicUrl: null,
      objectId: "fixture:signed",
    };
  }

  if (id === "fixture:revoked") {
    return {
      input: {
        objectFound: true,
        objectId: "fixture:revoked",
        identity: { serial: "FIXTURE-REVOKED" },
        attestation: { objectId: "fixture:revoked", status: "revoked" },
        crypto: {
          signatureValid: true,
          issuerTrusted: true,
          identityValid: true,
          statusActive: false,
        },
        depth: "lookup",
      },
      source: "fixture",
      publicUrl: null,
      objectId: "fixture:revoked",
    };
  }

  const row = CATALOG[id];
  if (row) {
    return {
      input: {
        objectFound: true,
        objectId: row.objectId,
        identity: { serial: row.serial },
        depth: "lookup",
      },
      source: "catalog",
      publicUrl: row.publicUrl,
      objectId: row.objectId,
    };
  }

  return {
    input: { objectFound: false, objectId: id, depth: "lookup" },
    source: "none",
    publicUrl: null,
    objectId: id,
  };
}

export function evaluatePublicId(idRaw: string | null | undefined) {
  const looked = lookupInput(idRaw);
  const kernel = evaluate(looked.input);
  return {
    ...kernel,
    id: looked.objectId,
    source: looked.source,
    publicUrl: looked.publicUrl,
    anchored: false,
    chain: {
      contract: POLYGON_CONTRACT,
      check: "in_development",
    },
    jwks: "https://authichain.com/.well-known/jwks.json",
  };
}
