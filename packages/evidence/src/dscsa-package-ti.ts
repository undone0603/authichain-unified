import { createHash } from "node:crypto";
import { canonicalize } from "./base";

const EMPTY_DIGEST =
  "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export const DSCSA_PACKAGE_SENTENCE =
  "This passport carries transaction information for package {packageId}: product, lot, expiration, shipment date, and a transaction id. That is a package record. It is not an FDA DSCSA compliance determination, and DSCSA does not mandate AuthiChain.";

export const DSCSA_PACKAGE_ABSENT_SENTENCE =
  "No DSCSA package transaction information is stored on this passport.";

export type DscsaPackageReason =
  | "dscsa_ti_incomplete"
  | "dscsa_package_missing"
  | "dscsa_placeholder_digest"
  | "dscsa_synthesized_expiration";

export type DscsaPackageTiResult = {
  pass: boolean;
  reason: DscsaPackageReason | null;
  sentence: string;
};

const TI_FIELDS = [
  "productName",
  "lotNumber",
  "expirationDate",
  "shipmentDate",
  "transactionId",
] as const;

function plain(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function supplied(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value !== "UNKNOWN" &&
    value !== "Unknown Partner" &&
    value !== "unsigned"
  );
}

function fail(reason: DscsaPackageReason): DscsaPackageTiResult {
  return { pass: false, reason, sentence: DSCSA_PACKAGE_ABSENT_SENTENCE };
}

function tiDigest(info: Record<string, string>): string {
  return "sha256:" + createHash("sha256").update(canonicalize(info)).digest("hex");
}

/**
 * One package's transaction information. A pass is a package record.
 * It does not set genuine and it does not call FDA.
 */
export function checkDscsaPackageTi(input: unknown): DscsaPackageTiResult {
  if (!plain(input) || input.type !== "dscsa_package_ti") return fail("dscsa_ti_incomplete");
  const packageId = input.packageId;
  const event = plain(input.event) ? input.event : null;
  const epcList = event && Array.isArray(event.epcList) ? event.epcList : null;
  if (!supplied(packageId) || !epcList || epcList.length !== 1 || epcList[0] !== packageId) {
    return fail("dscsa_package_missing");
  }
  if (!plain(input.transactionInformation)) return fail("dscsa_ti_incomplete");
  const info = input.transactionInformation;
  const present = TI_FIELDS.filter((key) => supplied(info[key]));
  if (!supplied(info.expirationDate) && present.length === 4) {
    return fail("dscsa_synthesized_expiration");
  }
  if (present.length !== TI_FIELDS.length) return fail("dscsa_ti_incomplete");
  if (input.signature === "unsigned") return fail("dscsa_ti_incomplete");
  const canonical: Record<string, string> = {};
  for (const key of TI_FIELDS) canonical[key] = info[key] as string;
  const digest = input.digest;
  if (digest !== undefined && digest !== null) {
    if (typeof digest !== "string" || digest === EMPTY_DIGEST || digest !== tiDigest(canonical)) {
      return fail("dscsa_placeholder_digest");
    }
  }
  return {
    pass: true,
    reason: null,
    sentence: DSCSA_PACKAGE_SENTENCE.replace("{packageId}", packageId),
  };
}
