// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { exportPKCS8, generateKeyPair, calculateJwkThumbprint, exportJWK } from "jose";
import { verifyAttestationJws } from "../packages/verifier/src/index";

vi.mock("./jwks", async () => {
  const actual = await vi.importActual<typeof import("./jwks")>("./jwks");
  return {
    ...actual,
    resolveAttestationKey: vi.fn(),
  };
});

vi.mock("./attestation-registry", () => ({
  recordStatusEvent: vi.fn(async () => ({ ok: true, eventId: "evt-test" })),
}));

import { resolveAttestationKey } from "./jwks";
import { recordStatusEvent } from "./attestation-registry";
import { bindQronGenerateAttestation } from "./qron-generate-bind";

describe("bindQronGenerateAttestation", () => {
  it("returns null when signing key is unavailable", async () => {
    vi.mocked(resolveAttestationKey).mockResolvedValue({
      ok: false,
      error: "missing",
    } as never);
    const bound = await bindQronGenerateAttestation({}, {
      destinationUrl: "https://example.com/sku",
      imageUrl: "https://cdn.example/q.png",
      objectId: "qron:url:deadbeef",
      userId: "user_1",
    });
    expect(bound).toBeNull();
  });

  it("returns jws/kid/jwks when Ed25519 key is bound", async () => {
    const { privateKey, publicKey } = await generateKeyPair("EdDSA", {
      crv: "Ed25519",
      extractable: true,
    });
    const privatePem = await exportPKCS8(privateKey);
    const publicJwk = await exportJWK(publicKey);
    const kid = await calculateJwkThumbprint(publicJwk);
    vi.mocked(resolveAttestationKey).mockResolvedValue({
      ok: true,
      key: { kid, privatePem, publicJwk },
    } as never);

    const bound = await bindQronGenerateAttestation({}, {
      destinationUrl: "https://example.com/sku",
      imageUrl: "data:image/png;base64,aaa",
      objectId: "qron:url:deadbeef",
      userId: "user_1",
    });
    expect(bound).not.toBeNull();
    expect(bound!.kid).toBe(kid);
    expect(bound!.jwks_url).toContain("protocol/jwks.json");
    expect(bound!.jws.split(".")).toHaveLength(3);
    const verified = await verifyAttestationJws(bound!.jws, { ...publicJwk, kid });
    const image = verified.evidence.find(item => item.id === "living-qr-image");
    expect(image?.digest.startsWith("sha256:")).toBe(true);
    expect(image?.uri).toBeUndefined();
    expect(recordStatusEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "attestation.issued",
        issuerId: "https://authichain.com",
        reasonCode: "qron_generate",
      })
    );
  });

  it("still returns the JWS when the status registry write fails", async () => {
    const { privateKey, publicKey } = await generateKeyPair("EdDSA", {
      crv: "Ed25519",
      extractable: true,
    });
    const privatePem = await exportPKCS8(privateKey);
    const publicJwk = await exportJWK(publicKey);
    const kid = await calculateJwkThumbprint(publicJwk);
    vi.mocked(resolveAttestationKey).mockResolvedValue({
      ok: true,
      key: { kid, privatePem, publicJwk },
    } as never);
    vi.mocked(recordStatusEvent).mockResolvedValueOnce({
      ok: false,
      status: 503,
      error: "attestation registry unavailable",
    });

    const bound = await bindQronGenerateAttestation({}, {
      destinationUrl: "https://example.com/sku",
      imageUrl: "https://cdn.example/q.png",
      objectId: "qron:url:deadbeef",
      userId: "user_1",
    });
    expect(bound?.jws.split(".")).toHaveLength(3);
  });
});
