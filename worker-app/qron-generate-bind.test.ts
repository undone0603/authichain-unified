// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { exportPKCS8, generateKeyPair, calculateJwkThumbprint, exportJWK } from "jose";

vi.mock("./jwks", async () => {
  const actual = await vi.importActual<typeof import("./jwks")>("./jwks");
  return {
    ...actual,
    resolveAttestationKey: vi.fn(),
  };
});

import { resolveAttestationKey } from "./jwks";
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
  });
});
