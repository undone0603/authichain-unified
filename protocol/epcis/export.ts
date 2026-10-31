import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const OBJECT_EVENT_FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "one-unit-object-event.json",
);

type QuantityRow = {
  epcList: string[];
  epsList: string[];
  quantity: number;
};

export type FixtureObjectEvent = {
  type: "ObjectEvent";
  eventTime: string;
  bizStep: string;
  disposition: string;
  quantityList: QuantityRow[];
};

export type ProtocolRecord = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://authichain.com/protocol/v1",
  ];
  type: ["VerifiableCredential", "ProvenanceRecord"];
  validFrom: string;
  credentialSubject: {
    id: string;
    epc: string;
    eventType: "ObjectEvent";
    eventTime: string;
    bizStep: string;
    disposition: string;
    quantity: 1;
  };
};

export function mapObjectEventToProtocolRecord(event: FixtureObjectEvent): ProtocolRecord {
  if (event == null || typeof event !== "object") {
    throw new Error("fixture is not one ObjectEvent");
  }
  if ("proof" in event || "issuer" in event) {
    throw new Error("fixture must not carry a credential");
  }
  if (event.type !== "ObjectEvent") {
    throw new Error("fixture is not one ObjectEvent");
  }
  const rows = event.quantityList;
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("fixture is not one unit");
  }
  const row = rows[0];
  if (row?.quantity !== 1 || !Array.isArray(row.epcList) || row.epcList.length !== 1) {
    throw new Error("fixture is not one unit");
  }
  const epc = row.epcList[0];
  if (typeof epc !== "string" || epc.length === 0) {
    throw new Error("fixture epc missing");
  }
  if (typeof event.eventTime !== "string" || event.eventTime.length === 0) {
    throw new Error("fixture eventTime missing");
  }
  return {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://authichain.com/protocol/v1",
    ],
    type: ["VerifiableCredential", "ProvenanceRecord"],
    validFrom: event.eventTime,
    credentialSubject: {
      id: epc,
      epc,
      eventType: "ObjectEvent",
      eventTime: event.eventTime,
      bizStep: event.bizStep,
      disposition: event.disposition,
      quantity: 1,
    },
  };
}

export function exportFixtureObjectEvent(path = OBJECT_EVENT_FIXTURE): ProtocolRecord {
  const event = JSON.parse(readFileSync(path, "utf8")) as FixtureObjectEvent;
  return mapObjectEventToProtocolRecord(event);
}
