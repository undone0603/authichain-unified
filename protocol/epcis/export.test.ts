import net from "node:net";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { exportFixtureObjectEvent, OBJECT_EVENT_FIXTURE } from "./export";

const originalConnect = net.Socket.prototype.connect;
const originalFetch = globalThis.fetch;

function armSocketTripwire(): void {
  net.Socket.prototype.connect = function connect() {
    throw new Error("socket opened");
  } as typeof net.Socket.prototype.connect;
  globalThis.fetch = () => {
    throw new Error("socket opened");
  };
}

describe("EPCIS fixture export", () => {
  afterEach(() => {
    net.Socket.prototype.connect = originalConnect;
    globalThis.fetch = originalFetch;
  });

  it("maps one fixture ObjectEvent into a protocol record", () => {
    armSocketTripwire();
    const raw = readFileSync(OBJECT_EVENT_FIXTURE, "utf8");
    const record = exportFixtureObjectEvent();
    expect(raw).toContain(record.credentialSubject.epc);
    expect(record.type).toEqual(["VerifiableCredential", "ProvenanceRecord"]);
    expect(record.credentialSubject.eventType).toBe("ObjectEvent");
    expect(record.credentialSubject.quantity).toBe(1);
    expect(record.credentialSubject.id).toBe("urn:epc:id:sgtin:0000000.000000.1");
    expect(record.validFrom).toBe("2026-01-15T12:00:00.000Z");
    expect(record).not.toHaveProperty("proof");
    expect(record).not.toHaveProperty("issuer");
  });
});
