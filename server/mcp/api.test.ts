import { describe, expect, it } from "vitest";
import { paidVerifyPayload } from "./api";
import { verifyPaidUnpaidReply } from "./index";

const SEAL = "00000000-0000-4000-8000-000000000000";

describe("paid verify payload", () => {
  it("sends a seal UUID and refuses productId-shaped subjects", () => {
    expect(paidVerifyPayload(SEAL)).toEqual({
      ok: true,
      body: { sealId: SEAL },
    });
    expect(paidVerifyPayload("demo")).toMatchObject({
      ok: false,
      status: 400,
      body: { error: "seal_id_not_uuid", settled: false },
    });
    expect(JSON.stringify(paidVerifyPayload("demo"))).not.toContain("productId");
  });

  it("tells an unpaid caller to retry with sealId", () => {
    const paid = JSON.parse(verifyPaidUnpaidReply(` ${SEAL.toUpperCase()} `)) as {
      status: number;
      then: string;
    };
    expect(paid.status).toBe(402);
    expect(paid.then).toContain(`"sealId": "${SEAL.toUpperCase()}"`);
    expect(paid.then).not.toContain("productId");
    const refused = JSON.parse(verifyPaidUnpaidReply("AC-1")) as {
      status: number;
      error: string;
      settled: boolean;
    };
    expect(refused.status).toBe(400);
    expect(refused.error).toBe("seal_id_not_uuid");
    expect(refused.settled).toBe(false);
  });
});
