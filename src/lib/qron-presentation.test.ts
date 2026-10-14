import { describe, expect, it } from "vitest";
import {
  CANONICAL_VERIFY_URL,
  DECISION_CONTRACT,
  QRON_PRESENTATION_SCHEMA,
  buildQronAttestationSubject,
  buildQronLivingQrAttestation,
  buildQronPresentation,
  fnv1aHex,
  qronObjectIdForDestination,
} from "./qron-presentation";
import { validateAttestation } from "../../packages/verifier/src/index";
import { resolveVerificationDecision } from "../../packages/verifier/src/verification-decision";

describe("qron-presentation", () => {
  it("derives a stable object_id for the same destination URL", () => {
    const a = qronObjectIdForDestination("https://Example.com/sku?x=1");
    const b = qronObjectIdForDestination("https://example.com/sku?x=1");
    expect(a).toBe(b);
    expect(a).toMatch(/^qron:url:[0-9a-f]{8}$/);
    expect(fnv1aHex("https://example.com/sku?x=1")).toHaveLength(8);
  });

  it("builds an image_issued presentation that names Decision v1", () => {
    const presentation = buildQronPresentation({
      destinationUrl: "https://example.com/sku",
      imageUrl: "data:image/png;base64,abc",
      mode: "static",
      prompt: "gold vault",
    });
    expect(presentation.schema).toBe(QRON_PRESENTATION_SCHEMA);
    expect(presentation.status).toBe("image_issued");
    expect(presentation.attestation).toBeNull();
    expect(presentation.verify.decision_contract).toBe(DECISION_CONTRACT);
    expect(presentation.verify.canonical_url).toBe(CANONICAL_VERIFY_URL);
    expect(presentation.verify.estate_urls).toContain(
      "https://qron.space/api/verify"
    );
    expect(presentation.object_id).toBe(
      qronObjectIdForDestination("https://example.com/sku")
    );
    expect(presentation.resolve_url).toBe(
      `https://authichain.com/qron/r/${encodeURIComponent(presentation.object_id)}`
    );
    expect(buildQronAttestationSubject("https://example.com/sku")).toEqual({
      object_id: presentation.object_id,
      product_class: "living_qr",
    });
  });

  it("binds attestation when jws + kid + jwks_url are present", () => {
    const presentation = buildQronPresentation({
      destinationUrl: "https://example.com/sku",
      imageUrl: "https://cdn.example/q.png",
      jws: "a.b.c",
      kid: "kid-1",
      jwksUrl: "https://authichain.com/.well-known/jwks.json",
    });
    expect(presentation.status).toBe("attestation_bound");
    expect(presentation.attestation).toEqual({
      jws: "a.b.c",
      kid: "kid-1",
      jwks_url: "https://authichain.com/.well-known/jwks.json",
    });
  });

  it("maps a cryptographically valid living_qr claim to Decision v1 verified", () => {
    // Presentation binding reuses the same decision collapse as estate verify.
    expect(
      resolveVerificationDecision({
        found: true,
        cryptographicValid: true,
        issuerTrusted: true,
        claimStatus: "active",
        signedDecision: "verified",
        expired: false,
      })
    ).toEqual({
      decision: "verified",
      valid: true,
      reasons: [],
    });
  });

  it("rejects empty destination or image", () => {
    expect(() =>
      buildQronPresentation({ destinationUrl: " ", imageUrl: "x" })
    ).toThrow(/destinationUrl/);
    expect(() =>
      buildQronPresentation({
        destinationUrl: "https://example.com",
        imageUrl: " ",
      })
    ).toThrow(/imageUrl/);
  });

  it("builds a schema-valid Living QR attestation payload for issuer bind", () => {
    const digest =
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const payload = buildQronLivingQrAttestation({
      destinationUrl: "https://example.com/sku",
      imageUrl: "https://cdn.example/q.png",
      destinationDigest: digest,
      imageDigest: digest,
    });
    const attestation = validateAttestation(payload);
    expect(attestation.subject.product_class).toBe("living_qr");
    expect(attestation.subject.object_id).toMatch(/^qron:url:/);
    expect(attestation.evidence[0]?.uri).toBe("https://example.com/sku");
  });
});
