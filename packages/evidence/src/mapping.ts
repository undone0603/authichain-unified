import { DsCsaEvidence } from "./dscsa";

export function mapEpcisToDsCsa(rawEvent: any): DsCsaEvidence {
  // EPCIS-like event mapping to DSCSA Evidence
  // This assumes a standardized EPCIS JSON format:
  // eventTime, action, epcList, readPoint, businessLocation, etc.

  return {
    id: rawEvent.eventID || crypto.randomUUID(),
    subject_id: rawEvent.epcList[0],
    type: mapEpcisActionToType(rawEvent.action),
    issuer: {
      id: rawEvent.bizLocation,
      name: rawEvent.bizLocationName || "Unknown Partner",
    },
    timestamp: rawEvent.eventTime,
    digest: `sha256:${rawEvent.hash || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}`, // Placeholder digest if not provided
    signature: rawEvent.signature || "unsigned",
    metadata: {
      lotNumber: rawEvent.lotNumber || "UNKNOWN",
      expirationDate: rawEvent.expirationDate || new Date().toISOString(),
      tradingPartnerId: rawEvent.sourceList?.[0]?.source || "UNKNOWN",
      transactionId: rawEvent.transactionId || "UNKNOWN",
    },
  };
}

function mapEpcisActionToType(
  action: string
):
  | "manufacturing"
  | "inspection"
  | "shipment"
  | "commission"
  | "pack"
  | "receive"
  | "dispense" {
  const map: Record<string, any> = {
    ADD: "commission",
    OBSERVE: "inspection",
  };
  return map[action] || "manufacturing";
}
