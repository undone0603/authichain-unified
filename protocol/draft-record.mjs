/**
 * Draft a protocol-shaped ProvenanceRecord from a generation.
 * Unsigned on purpose. A missing proof MUST fail the verifier (SPEC §3.1).
 * No network. No key. Idempotent on generationId.
 */

const CONTEXT = [
  "https://www.w3.org/ns/credentials/v2",
  "https://authichain.com/protocol/v1",
];

export function draftRecord(input) {
  if (!input || typeof input.generationId !== "string" || !input.generationId.trim()) {
    throw new Error("generationId required");
  }
  const generationId = input.generationId.trim();
  const subjectId =
    input.subjectId ||
    `https://authichain.com/g/${encodeURIComponent(generationId)}`;
  const validFrom = input.validFrom || "2026-10-06T00:00:00Z";
  return {
    "@context": CONTEXT,
    type: ["VerifiableCredential", "ProvenanceRecord"],
    issuer: input.issuer || null,
    validFrom,
    credentialSubject: {
      id: subjectId,
      generationId,
      destination: input.destination || null,
      events: [
        {
          stage: "generated",
          at: validFrom,
          location: "US-MI",
        },
      ],
    },
    proof: null,
    meta: {
      verdict: "unsigned-draft",
      seal: false,
      reason: "signed verification is in development; this object is not a seal",
    },
  };
}

export function draftLog(input) {
  const record = draftRecord(input);
  return {
    event: "draft_seal",
    generationId: record.credentialSubject.generationId,
    verdict: "unsigned-draft",
    seal: false,
    idempotencyKey: record.credentialSubject.generationId,
  };
}
