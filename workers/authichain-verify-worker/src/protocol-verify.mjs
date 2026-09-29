/**
 * Run the reference verifier. The verdict is verifyRecord's, not the kernel's.
 * A well-formed tx hash is not a chain read. anchorTransactionQueried stays false.
 */
import { verifyRecord } from "../../../protocol/verifier.mjs";

export function verifySubmitted(record, anchor = null) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const result = verifyRecord(record, anchor ?? null);
  return {
    verdict: result.verdict,
    reasons: result.reasons,
    checks: result.checks,
    decision: result.verdict,
    anchored: result.verdict === "verified",
    anchorTransactionQueried: false,
  };
}
