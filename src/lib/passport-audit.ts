import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  derive,
  getCultivar,
  getDossier,
  isPublicFarm,
  listFarms,
  toSlug,
  UNLISTED_PREVIEW_ENV,
  type UnlistedAccess,
  type Certificate,
} from "./genetics";
import { fingerprintCultivar } from "./fingerprint";

export type PassportAuditSeverity = "info" | "warning" | "error";

export interface PassportAuditIssue {
  severity: PassportAuditSeverity;
  code: string;
  subject: string;
  detail: string;
}

export interface FarmPassportAudit {
  farm: string;
  publication: "public" | "unlisted" | "withdrawn" | "unknown";
  status: "pass" | "review_required" | "blocked";
  certificateCount: number;
  cultivarCount: number;
  fingerprintCount: number;
  issues: PassportAuditIssue[];
}

export interface PassportAuditOptions {
  repositoryRoot?: string;
  includeUnlisted?: boolean;
}

function addIssue(
  issues: PassportAuditIssue[],
  severity: PassportAuditSeverity,
  code: string,
  subject: string,
  detail: string
) {
  issues.push({ severity, code, subject, detail });
}

function auditCertificate(
  cert: Certificate,
  repositoryRoot: string,
  issues: PassportAuditIssue[]
) {
  const subject = `certificate:${cert.coa_id}`;

  if (!cert.source_pdf) {
    addIssue(
      issues,
      "warning",
      "source_reference_missing",
      subject,
      "No source PDF reference is recorded."
    );
  } else if (/^https?:\/\//i.test(cert.source_pdf)) {
    addIssue(
      issues,
      "warning",
      "source_not_locally_verifiable",
      subject,
      "The source is external; this audit does not fetch or verify remote files."
    );
  } else {
    const sourcePath = resolve(repositoryRoot, cert.source_pdf);
    const fromRoot = relative(repositoryRoot, sourcePath);
    if (
      isAbsolute(cert.source_pdf) ||
      fromRoot === ".." ||
      fromRoot.startsWith(`..${sep}`)
    ) {
      addIssue(
        issues,
        "error",
        "source_path_outside_repository",
        subject,
        "The recorded source path is outside the repository."
      );
    } else {
      try {
        const actual = createHash("sha256")
          .update(readFileSync(sourcePath))
          .digest("hex");
        if (!cert.source_pdf_sha256) {
          addIssue(
            issues,
            "warning",
            "source_hash_missing",
            subject,
            "The local source exists but has no recorded SHA-256."
          );
        } else if (
          actual.toLowerCase() !== cert.source_pdf_sha256.toLowerCase()
        ) {
          addIssue(
            issues,
            "error",
            "source_hash_mismatch",
            subject,
            "The local source bytes do not match the recorded SHA-256."
          );
        }
      } catch {
        addIssue(
          issues,
          "error",
          "source_file_missing",
          subject,
          "The recorded local source file could not be read."
        );
      }
    }
  }

  if (!cert.verified_against_pdf) {
    addIssue(
      issues,
      "warning",
      "source_review_date_missing",
      subject,
      "No date is recorded for review against the source PDF."
    );
  }

  const derived = derive(cert).derived;
  if (derived.mismatch) {
    addIssue(
      issues,
      "error",
      "derived_total_mismatch",
      subject,
      `Published ${derived.mismatch.field} total ${derived.mismatch.published} differs from recomputed ${derived.mismatch.derived}.`
    );
  } else if (cert.arithmetic_check === "not_possible_without_raw_values") {
    addIssue(
      issues,
      "info",
      "raw_values_unavailable",
      subject,
      "The available panel is insufficient to independently derive all totals."
    );
  }
}

export function auditFarmPassports(
  farm: string,
  options: PassportAuditOptions = {}
): FarmPassportAudit {
  const repositoryRoot = resolve(options.repositoryRoot ?? process.cwd());
  const access: UnlistedAccess | undefined = options.includeUnlisted
    ? { env: { [UNLISTED_PREVIEW_ENV]: "1" } }
    : undefined;
  const dossier = getDossier(farm, access);
  const issues: PassportAuditIssue[] = [];

  if (!dossier) {
    addIssue(issues, "error", "unknown_farm", farm, "No farm dossier exists.");
    return {
      farm,
      publication: "unknown",
      status: "blocked",
      certificateCount: 0,
      cultivarCount: 0,
      fingerprintCount: 0,
      issues,
    };
  }

  for (const cert of dossier.certificates) {
    auditCertificate(cert, repositoryRoot, issues);
  }

  let fingerprintCount = 0;
  for (const cultivar of dossier.cultivars) {
    const view = getCultivar(farm, toSlug(cultivar.id), access);
    if (!view) {
      addIssue(
        issues,
        "error",
        "cultivar_view_missing",
        `cultivar:${cultivar.id}`,
        "The dossier cultivar could not be resolved to its certificate and lineage view."
      );
      continue;
    }

    for (const edge of view.parentEdges) {
      if (edge.provenance !== "confirmed_in_writing") {
        addIssue(
          issues,
          "warning",
          "lineage_not_confirmed",
          `cultivar:${cultivar.id}`,
          `Lineage relation "${edge.relation}" has ${edge.provenance} provenance.`
        );
      }
    }

    const fingerprint = fingerprintCultivar(view, farm);
    const recomputed = createHash("sha256")
      .update(fingerprint.canonical, "utf8")
      .digest("hex");
    fingerprintCount++;
    if (`sha256:${recomputed}` !== fingerprint.digest) {
      addIssue(
        issues,
        "error",
        "fingerprint_mismatch",
        `cultivar:${cultivar.id}`,
        "The fingerprint does not match its published canonical bytes."
      );
    }
  }

  for (const question of dossier.openQuestions) {
    addIssue(
      issues,
      "warning",
      "open_question",
      `question:${question.id}`,
      question.blocks
    );
  }

  if (dossier.unlisted) {
    addIssue(
      issues,
      "info",
      "farm_unlisted",
      farm,
      "This dossier is unlisted and must not be served on public routes."
    );
  } else if (!isPublicFarm(farm)) {
    addIssue(
      issues,
      "info",
      "farm_withdrawn",
      farm,
      "This farm is withdrawn from public surfaces."
    );
  }

  const status = issues.some(issue => issue.severity === "error")
    ? "blocked"
    : issues.some(issue => issue.severity === "warning")
      ? "review_required"
      : "pass";

  return {
    farm,
    publication: dossier.unlisted
      ? "unlisted"
      : isPublicFarm(farm)
        ? "public"
        : "withdrawn",
    status,
    certificateCount: dossier.certificates.length,
    cultivarCount: dossier.cultivars.length,
    fingerprintCount,
    issues,
  };
}

export function auditAllFarmPassports(
  options: PassportAuditOptions = {}
): FarmPassportAudit[] {
  return listFarms().map(farm => auditFarmPassports(farm, options));
}
