import {
  readStoredPassport,
  verifySubmitted,
} from "../workers/authichain-verify-worker/src/protocol-verify.mjs";

export type PassportVerdict = {
  verified: boolean;
  onRecord: boolean;
  genuine?: boolean;
  digitalIdentity?: string;
  message: string;
};

/**
 * A product scan is genuine only when a stored DigitalProductPassport
 * verifies. A registry row, including status "active", is not that proof.
 * This does not assign a GTIN.
 */
export function passportVerdict(
  product: { metadata?: unknown } | null | undefined,
  cert: { metadata?: unknown } | null | undefined
): PassportVerdict {
  const onRecord = !!(product || cert);
  const stored =
    readStoredPassport(cert?.metadata) ?? readStoredPassport(product?.metadata);
  if (!stored) {
    return {
      verified: false,
      onRecord,
      message: onRecord
        ? "No product passport is stored for this record."
        : "No product is on record for this id.",
    };
  }
  const scan = verifySubmitted(stored.record, stored.anchor);
  const genuine = scan?.genuine === true;
  const digitalIdentity =
    typeof scan?.digitalIdentity === "string" ? scan.digitalIdentity : undefined;
  const who = digitalIdentity ? ` for ${digitalIdentity}` : "";
  return {
    verified: genuine,
    onRecord: true,
    genuine,
    ...(digitalIdentity ? { digitalIdentity } : {}),
    message: genuine
      ? `Genuine product passport${who}. This is the passport for that digital identity.`
      : `Stored passport${who} did not verify as genuine.`,
  };
}

/**
 * A certification row, including status "approved", is not a passport.
 * decision follows the stored scan. This does not sign a new attestation.
 */
export function certificationScanDecision(
  product: { metadata?: unknown } | null | undefined,
  cert: { metadata?: unknown } | null | undefined
): PassportVerdict & { decision: "verified" | "blocked" } {
  const verdict = passportVerdict(product, cert);
  return {
    decision: verdict.verified ? "verified" : "blocked",
    ...verdict,
  };
}

/** A materials table is a passport heading only when the scan is genuine. */
export function compositionHeading(verified: boolean): string {
  return verified ? "Genuine product passport" : "Recorded composition";
}

export type CallerSignals = {
  source: "caller_supplied";
  qrDecodePass: boolean;
  blockchainCertExists: boolean;
  nfcMatch: boolean;
  visualMatch: number | null;
  geoFenceOk: boolean;
};

/** Flags the caller sent. A missing flag is false. This is not a passport scan. */
export function callerSignalReport(input: {
  qrDecodePass?: unknown;
  blockchainCertExists?: unknown;
  nfcMatch?: unknown;
  visualMatch?: unknown;
  geoFenceOk?: unknown;
} | null | undefined): CallerSignals {
  const body = input ?? {};
  const visual = body.visualMatch;
  return {
    source: "caller_supplied",
    qrDecodePass: body.qrDecodePass === true,
    blockchainCertExists: body.blockchainCertExists === true,
    nfcMatch: body.nfcMatch === true,
    visualMatch:
      typeof visual === "number" && Number.isFinite(visual)
        ? Math.min(100, Math.max(0, visual))
        : null,
    geoFenceOk: body.geoFenceOk === true,
  };
}

const CALLER_FLAGS_NEED_PRODUCT =
  "These flags were supplied by the caller. A product passport scan needs a product id.";

/**
 * Caller flags are recorded beside the scan. They do not set verified.
 * Pass null when the request has no product id.
 */
export function trustScoreReply(
  scan: PassportVerdict | null,
  signals: CallerSignals
): PassportVerdict & { callerSignals: CallerSignals } {
  if (!scan) {
    return {
      verified: false,
      onRecord: false,
      message: CALLER_FLAGS_NEED_PRODUCT,
      callerSignals: signals,
    };
  }
  return { ...scan, callerSignals: signals };
}
