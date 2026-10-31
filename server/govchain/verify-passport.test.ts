import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivity } = vi.hoisted(() => ({ logActivity: vi.fn() }));
vi.mock("../db", () => ({ logActivity }));

import { govchainRouter } from "./router";
import { SIGNATURE_CHECK_UNAVAILABLE, verifySovereignPassport } from "./vc-service";

const fakeVc = {
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  id: "urn:uuid:fake-1",
  type: ["VerifiableCredential", "SovereignDocumentPassport"],
  issuer: "did:authichain:gov:1",
  issuanceDate: "2026-10-09T00:00:00Z",
  credentialSubject: { id: "did:authichain:user:a@b.com", clearance: "TOP" },
  proof: {
    type: "Ed25519Signature2020",
    created: "2026-10-09T00:00:00Z",
    proofPurpose: "assertionMethod",
    verificationMethod: "did:authichain:gov:1#key-1",
    jws: "eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..made_up_signature",
  },
};

function publicCaller() {
  return govchainRouter.createCaller({ user: null, req: {}, res: {} } as any);
}

describe("govchain.verifyPassport fails closed", () => {
  beforeEach(() => logActivity.mockReset());

  it("a made-up jws is not valid", async () => {
    const result = await verifySovereignPassport(fakeVc);
    expect(result.valid).toBe(false);
    expect(result.message).toBe("Signature checking is not available yet");
  });

  it("the hard-coded simulated_signature is not valid either", async () => {
    const vc = { ...fakeVc, proof: { ...fakeVc.proof, jws: "eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..simulated_signature" } };
    expect((await verifySovereignPassport(vc)).valid).toBe(false);
  });

  it("the public route returns valid:false, echoes no claims, and writes no activity log", async () => {
    const result = await publicCaller().verifyPassport({ vc: fakeVc });
    expect(result).toEqual({ valid: false, claims: null, issuer: null, message: SIGNATURE_CHECK_UNAVAILABLE });
    expect(JSON.stringify(result)).not.toContain("TOP");
    expect(logActivity).not.toHaveBeenCalled();
  });
});
