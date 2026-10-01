const CONTEXT = [
  "https://www.w3.org/ns/credentials/v2",
  "https://authichain.com/protocol/v1",
];

function assertIso(value, field) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new TypeError(field + " must be an ISO-8601 date-time string");
  }
}

function subjectId(identity) {
  if (identity?.scheme === "gs1") {
    const gtin = String(identity.gtin ?? "");
    const serial = String(identity.serial ?? "");
    if (!/^\d{8,14}$/.test(gtin) || !serial) throw new TypeError("GS1 identity requires a valid GTIN and serial");
    return "https://id.gs1.org/01/" + gtin + "/21/" + encodeURIComponent(serial);
  }
  if (!identity?.objectId || typeof identity.objectId !== "string") throw new TypeError("identity.objectId is required");
  return identity.objectId;
}

/**
 * Convert an Asset Passport into the unsigned payload shape defined by
 * AuthiChain Verification Specification §3.
 *
 * This function does not sign, anchor, or assert authenticity. The caller
 * supplies the issuer DID and must perform signing with protocol/verifier.mjs.
 */
export function passportToRecordPayload(passport, {
  issuerDid,
  validFrom = new Date().toISOString(),
  validUntil,
  created = validFrom,
} = {}) {
  if (!passport || typeof passport !== "object" || Array.isArray(passport)) throw new TypeError("passport must be an object");
  if (typeof issuerDid !== "string" || !issuerDid.startsWith("did:key:")) throw new TypeError("issuerDid must be a did:key identifier");
  assertIso(validFrom, "validFrom");
  assertIso(created, "created");
  if (validUntil !== undefined) assertIso(validUntil, "validUntil");

  const id = subjectId(passport.identity);
  const credentialSubject = {
    id,
    ...(passport.identity.gtin ? { gtin: passport.identity.gtin } : {}),
    ...(passport.identity.serial ? { serial: passport.identity.serial } : {}),
    ...(passport.identity.lot ? { batch: passport.identity.lot } : {}),
    assetClass: passport.assetClass,
    claims: passport.claims ?? [],
    evidence: passport.evidence ?? [],
    inspections: passport.inspections ?? [],
    lifecycle: passport.lifecycle ?? [],
    status: passport.status,
  };

  return {
    "@context": CONTEXT,
    type: ["VerifiableCredential", "ProvenanceRecord", "HighValueAssetPassport"],
    issuer: issuerDid,
    validFrom,
    ...(validUntil ? { validUntil } : {}),
    credentialSubject,
    proof: {
      type: "Ed25519Signature2020",
      created,
      verificationMethod: issuerDid + "#" + issuerDid.slice(8),
      proofPurpose: "assertionMethod",
      proofValue: "",
    },
  };
}