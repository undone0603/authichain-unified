// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { registerComplianceEvaluate } from "./compliance-evaluate";

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

function app() {
  const hono = new Hono();
  registerComplianceEvaluate(hono);
  return hono;
}

function post(body: unknown) {
  return app().request("/api/v1/compliance/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("worker-app POST /api/v1/compliance/evaluate", () => {
  it("rejects client-supplied supplier documents", async () => {
    const res = await post({
      productId: "prod_api_test",
      bom: usBom,
      documents: [{ supplierId: "sup_us" }],
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
  });
});
