import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const usBom = {
  productId: "prod_api_test",
  version: "v1.0",
  components: [
    {
      componentId: "comp_1",
      componentName: "American Aluminum",
      quantity: 1,
      unitCost: 150,
      currency: "USD",
      supplierId: "sup_us",
      supplierCountry: "USA",
      manufacturingCountry: "USA",
      laborCost: 30,
      materialCost: 100,
      overheadCost: 20,
      freightCost: 0,
      htsCode: "7601.10",
      countryOfOrigin: "USA",
      finalTransformationCountry: "USA",
    },
  ],
};

function post(body: unknown) {
  return POST(
    new NextRequest("https://authichain.com/api/v1/compliance/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/v1/compliance/evaluate", () => {
  it("rejects client-supplied supplier documents", async () => {
    const res = await post({
      productId: "prod_api_test",
      bom: usBom,
      documents: [{ supplierId: "sup_us", signatureStatus: "SIGNATURE_VERIFIED" }],
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.passport).toBeUndefined();
  });

  it("returns a determination without signing a passport", async () => {
    const res = await post({ productId: "prod_api_test", bom: usBom });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.passport).toBeUndefined();
    expect(json.claimEvaluation.decision).toBe("REVIEW_REQUIRED");
    expect(json.claimEvaluation.claimText).toBe("No Made in USA claim");
  });

  it("returns 400 for an unknown jurisdiction", async () => {
    const res = await post({
      productId: "prod_api_test",
      jurisdiction: "MARS",
      bom: usBom,
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.passport).toBeUndefined();
  });
});
