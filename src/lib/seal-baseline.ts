import { verifyRecord } from "../../protocol/verifier.mjs";
import { registryAnswer } from "./agent-verify";
import { extractProtocolRecord } from "./seal-attestation";

/** Reproducible signature/validity evidence, not a real-world truth verdict. */
export function sealBaseline(
  seal: Record<string, unknown> | null,
  checkedAt = new Date().toISOString()
) {
  const answer = registryAnswer(seal);
  const record = seal ? extractProtocolRecord(seal) : null;
  // No chain query is made on this path. Never promote supplied anchor
  // metadata into an on-chain verification claim.
  const result = record
    ? verifyRecord(record, null, { now: checkedAt })
    : {
        verdict: "unsigned",
        reasons: [seal ? "no_ed25519_proof" : "seal_not_found"],
        checks: {},
      };
  if (record) answer.checks.signature = "checked";
  return {
    ...answer,
    details: {
      ...answer.details,
      verdict: result.verdict,
      reasons: result.reasons,
    },
    verified: false,
    baseline: {
      version: "1",
      scope: "signature-and-validity",
      checkedAt,
      ...result,
      evidence: { record, anchor: null },
      unknowns: [
        "issuer_identity_not_authenticated",
        "registry_subject_binding_not_verified",
        "revocation_not_checked",
        "anchor_not_queried",
        "physical_authenticity_not_inspected",
      ],
    },
  };
}
