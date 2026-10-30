import { describe, expect, it } from "vitest";
import { emitTrustEvent, trustEvent, TRUST_EVENTS, TRUST_EVENT_SCHEMA } from "./trust-events";

const at = new Date("2026-10-15T12:00:00Z");

describe("trust events", () => {
  it("covers the whole lifecycle vocabulary", () => {
    for (const name of [
      "attestation.created",
      "attestation.verified",
      "attestation.rejected",
      "identifier.resolved",
      "dpp.created",
      "checkout.started",
      "payment.verified",
      "fulfillment.started",
      "fulfillment.completed",
      "fulfillment.failed",
      "entitlement.granted",
      "agent.action.proposed",
      "agent.action.executed",
      "agent.action.denied",
      "policy.blocked",
      "human_hold.triggered",
      "recovery.started",
      "recovery.completed",
    ]) {
      expect(TRUST_EVENTS).toContain(name);
    }
  });

  it("keeps allowlisted fields and drops everything else", () => {
    const rec = trustEvent(
      "attestation.verified",
      {
        attestation_id: "urn:authichain:attestation:v01:x",
        decision: "verified",
        valid: true,
        reasons: [],
        http_status: 200,
        jws: "eyJhbGciOiJFZERTQSJ9.eyJhIjoxfQ.c2ln",
        email: "buyer@example.com",
        amount_total: 29900,
        private_key: "secret",
      },
      at,
    );
    expect(rec).toEqual({
      schema: TRUST_EVENT_SCHEMA,
      event: "attestation.verified",
      at: "2026-10-15T12:00:00.000Z",
      attestation_id: "urn:authichain:attestation:v01:x",
      decision: "verified",
      valid: true,
      reasons: [],
      http_status: 200,
    });
  });

  it("refuses address-shaped and token-shaped values even in allowlisted fields", () => {
    const rec = trustEvent(
      "fulfillment.failed",
      {
        profile_id: "buyer@example.com",
        reason_code: "eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJ4In0.sigsigsig",
        error_class: "RetryableFulfillmentError",
        reasons: ["ok_reason", "leak@example.com"],
      },
      at,
    );
    expect(rec.profile_id).toBeUndefined();
    expect(rec.reason_code).toBeUndefined();
    expect(rec.error_class).toBe("RetryableFulfillmentError");
    expect(rec.reasons).toEqual(["ok_reason"]);
  });

  it("emits one JSON line and never throws", () => {
    const lines: string[] = [];
    emitTrustEvent("payment.verified", { session_id: "cs_live_x" }, l => lines.push(l));
    expect(JSON.parse(lines[0])).toMatchObject({ event: "payment.verified", session_id: "cs_live_x" });
    expect(() =>
      emitTrustEvent("payment.verified", {}, () => {
        throw new Error("sink down");
      }),
    ).not.toThrow();
  });
});
