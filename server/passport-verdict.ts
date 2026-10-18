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
