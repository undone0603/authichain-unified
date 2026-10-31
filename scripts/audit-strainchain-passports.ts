import {
  auditAllFarmPassports,
  auditFarmPassports,
  type FarmPassportAudit,
} from "../src/lib/passport-audit";

function formatAudit(audit: FarmPassportAudit): string[] {
  const lines = [
    `${audit.status.toUpperCase()} ${audit.farm} — publication: ${audit.publication}`,
    `  ${audit.certificateCount} certificates; ${audit.cultivarCount} cultivars; ${audit.fingerprintCount} fingerprints`,
  ];

  for (const issue of audit.issues) {
    lines.push(
      `  ${issue.severity.toUpperCase()} ${issue.code} (${issue.subject})`
    );
  }

  return lines;
}

const args = process.argv.slice(2);
const includeUnlisted = args.includes("--include-unlisted");
const farm = args.find(arg => !arg.startsWith("--"));
const audits = farm
  ? [auditFarmPassports(farm, { includeUnlisted })]
  : auditAllFarmPassports();
console.log(audits.flatMap(formatAudit).join("\n"));

if (
  process.argv.includes("--strict") &&
  audits.some(audit => audit.status !== "pass")
) {
  process.exitCode = 1;
}
