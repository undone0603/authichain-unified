import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivity } = vi.hoisted(() => ({ logActivity: vi.fn() }));
vi.mock("../db", () => ({ logActivity }));

import { govchainRouter } from "./router";
import { issueSovereignPassport } from "./vc-service";

function adminCaller() {
  return govchainRouter.createCaller({
    user: { id: 1, role: "admin" },
    req: {},
    res: {},
  } as any);
}

describe("govchain.issuePassport returns no placeholder proof", () => {
  beforeEach(() => logActivity.mockReset());

  it("issueSovereignPassport attaches no proof", async () => {
    const vc = await issueSovereignPassport({
      documentId: "doc1",
      issuerDid: "did:authichain:gov:1",
      subjectDid: "did:authichain:user:a@b.com",
      claims: { purpose: "test" },
    });
    expect(vc.proof).toBeUndefined();
    expect(JSON.stringify(vc)).not.toContain("simulated_signature");
  });

  it("the admin route returns a credential with no proof and no simulated_signature", async () => {
    const result = await adminCaller().issuePassport({
      documentId: "doc1",
      claims: { purpose: "test" },
      recipientEmail: "a@b.com",
    });
    expect(result.success).toBe(true);
    expect(result.vc.proof).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("simulated_signature");
    expect(JSON.stringify(result)).not.toContain("jws");
  });
});
