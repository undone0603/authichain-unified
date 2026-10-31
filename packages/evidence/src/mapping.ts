import { randomUUID } from "node:crypto";
import { DsCsaEvidence } from "./dscsa";

const EMPTY_DIGEST =
  "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

type EpcisEvent = {
  eventID?: unknown;
  epcList?: unknown;
  action?: unknown;
  bizLocation?: unknown;
  bizLocationName?: unknown;
  eventTime?: unknown;
  hash?: unknown;
  signature?: unknown;
  lotNumber?: unknown;
  expirationDate?: unknown;
  sourceList?: { source?: unknown }[];
  transactionId?: unknown;
};

function rejectPlaceholder(value: unknown, reason: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(reason);
  if (value === "UNKNOWN" || value === "Unknown Partner" || value === "unsigned") {
    throw new Error(reason);
  }
  return value;
}

/**
 * Map one EPCIS-shaped event. Missing transaction fields throw.
 * This does not invent a partner, a digest, an expiration, or a signature.
 */
export function mapEpcisToDsCsa(rawEvent: EpcisEvent): DsCsaEvidence {
  if (!rawEvent || !Array.isArray(rawEvent.epcList) || rawEvent.epcList.length < 1) {
    throw new Error("dscsa_package_missing");
  }
  const subject = rawEvent.epcList[0];
  if (typeof subject !== "string" || subject.trim() === "") {
    throw new Error("dscsa_package_missing");
  }
  if (rawEvent.expirationDate === undefined || rawEvent.expirationDate === null) {
    throw new Error("dscsa_synthesized_expiration");
  }
  const hash = rawEvent.hash;
  const digest = typeof hash === "string" && hash.startsWith("sha256:") ? hash : `sha256:${hash ?? ""}`;
  if (typeof hash !== "string" || hash.trim() === "" || digest === EMPTY_DIGEST) {
    throw new Error("dscsa_placeholder_digest");
  }
  const eventId = rawEvent.eventID;
  return {
    id: typeof eventId === "string" && eventId.trim() !== "" ? eventId : randomUUID(),
    subject_id: subject,
    type: mapEpcisActionToType(typeof rawEvent.action === "string" ? rawEvent.action : ""),
    issuer: {
      id: rejectPlaceholder(rawEvent.bizLocation, "dscsa_ti_incomplete"),
      name: rejectPlaceholder(rawEvent.bizLocationName, "dscsa_ti_incomplete"),
    },
    timestamp: rejectPlaceholder(rawEvent.eventTime, "dscsa_ti_incomplete"),
    digest,
    signature: rejectPlaceholder(rawEvent.signature, "dscsa_ti_incomplete"),
    metadata: {
      lotNumber: rejectPlaceholder(rawEvent.lotNumber, "dscsa_ti_incomplete"),
      expirationDate: rejectPlaceholder(rawEvent.expirationDate, "dscsa_synthesized_expiration"),
      tradingPartnerId: rejectPlaceholder(rawEvent.sourceList?.[0]?.source, "dscsa_ti_incomplete"),
      transactionId: rejectPlaceholder(rawEvent.transactionId, "dscsa_ti_incomplete"),
    },
  };
}

function mapEpcisActionToType(
  action: string
): DsCsaEvidence["type"] {
  const map: Record<string, DsCsaEvidence["type"]> = {
    ADD: "commission",
    OBSERVE: "inspection",
  };
  return map[action] || "manufacturing";
}
