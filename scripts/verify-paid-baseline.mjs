#!/usr/bin/env node
// Offline buyer check. Does not authenticate the registry, receipt, or issuer.
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { verifyRecord } from "../protocol/verifier.mjs";

try {
  const [path, expectedSealId] = process.argv.slice(2);
  if (!path || !expectedSealId)
    throw new Error(
      "usage: node scripts/verify-paid-baseline.mjs response.json <expected-seal-uuid>"
    );
  const response = JSON.parse(readFileSync(path, "utf8"));
  const baseline = response.baseline;
  if (response.subject !== expectedSealId)
    throw new Error("unexpected_subject");
  if (baseline?.version !== "1" || baseline.scope !== "signature-and-validity")
    throw new Error("unsupported_baseline");
  if (!baseline.evidence?.record || baseline.evidence.anchor !== null)
    throw new Error("missing_or_unsupported_evidence");
  if (
    typeof baseline.checkedAt !== "string" ||
    !Number.isFinite(Date.parse(baseline.checkedAt))
  )
    throw new Error("invalid_checked_at");
  const result = verifyRecord(baseline.evidence.record, null, {
    now: baseline.checkedAt,
  });
  if (
    !isDeepStrictEqual(result, {
      verdict: baseline.verdict,
      reasons: baseline.reasons,
      checks: baseline.checks,
    })
  )
    throw new Error("reported_result_mismatch");
  // Also evaluate now: a seller-provided historical timestamp cannot make an
  // expired or not-yet-valid record acceptable to the buying agent today.
  const current = verifyRecord(baseline.evidence.record, null);
  console.log(
    JSON.stringify(
      {
        scope: "signature-and-validity",
        reported: result,
        current,
        registryAuthenticated: false,
        paymentVerified: false,
        issuerAuthenticated: false,
      },
      null,
      2
    )
  );
  process.exitCode =
    current.verdict === "valid-unanchored" &&
    result.verdict === "valid-unanchored"
      ? 0
      : 1;
} catch (error) {
  console.error(JSON.stringify({ error: error.message }));
  process.exitCode = 1;
}
